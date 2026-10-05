-- =============================================================================
-- 10. RPC functions called by the app
--
-- SECURITY DEFINER functions perform their own explicit authorization checks
-- based on auth.uid() — never on ids supplied by the client.
-- SECURITY INVOKER functions run under the caller's RLS policies; they exist
-- to make multi-row writes (expense + splits) atomic.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Groups
-- -----------------------------------------------------------------------------

-- Create a group and make the caller its owner, atomically.
create or replace function public.create_group(
  p_name text,
  p_description text default null,
  p_currency text default 'INR'
)
returns public.groups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_group public.groups;
  v_attempt integer := 0;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 80 then
    raise exception 'INVALID_INPUT';
  end if;

  perform public.ensure_profile(v_uid);

  loop
    begin
      insert into public.groups (name, description, currency, created_by)
      values (btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), coalesce(p_currency, 'INR'), v_uid)
      returning * into v_group;
      exit;
    exception when unique_violation then
      -- Astronomically unlikely invite token/code collision: retry with new values.
      v_attempt := v_attempt + 1;
      if v_attempt >= 5 then
        raise;
      end if;
    end;
  end loop;

  insert into public.group_members (group_id, user_id, role)
  values (v_group.id, v_uid, 'owner');

  return v_group;
end;
$$;

-- Replace the invite link and code (old ones stop working immediately).
create or replace function public.regenerate_invite(p_group_id uuid)
returns public.groups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group public.groups;
  v_attempt integer := 0;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if not public.is_group_admin(p_group_id) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  loop
    begin
      update public.groups
      set invite_token = public.generate_invite_token(),
          invite_code  = public.generate_invite_code()
      where id = p_group_id
      returning * into v_group;
      exit;
    exception when unique_violation then
      v_attempt := v_attempt + 1;
      if v_attempt >= 5 then
        raise;
      end if;
    end;
  end loop;

  return v_group;
end;
$$;

-- Dashboard summary for every group the caller belongs to.
create or replace function public.get_my_groups()
returns table (
  id uuid,
  name text,
  description text,
  currency text,
  role text,
  member_count integer,
  total_spent bigint,
  my_balance bigint,
  last_activity_at timestamptz,
  created_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select
    g.id,
    g.name,
    g.description,
    g.currency,
    m.role,
    (select count(*)::integer from public.group_members gm
      where gm.group_id = g.id and gm.removed_at is null) as member_count,
    coalesce((select sum(e.amount) from public.expenses e where e.group_id = g.id), 0)::bigint as total_spent,
    public.member_net_balance(g.id, m.user_id) as my_balance,
    g.last_activity_at,
    g.created_at
  from public.groups g
  join public.group_members m
    on m.group_id = g.id
   and m.user_id = (select auth.uid())
   and m.removed_at is null
  order by g.last_activity_at desc;
$$;

-- Per-member balances computed in SQL (used for server-side checks and to
-- cross-verify the TypeScript engine in integration tests).
create or replace function public.group_balances(p_group_id uuid)
returns table (
  user_id uuid,
  paid bigint,
  share bigint,
  sent bigint,
  received bigint,
  net bigint
)
language sql
stable
set search_path = ''
as $$
  select
    m.user_id,
    coalesce((select sum(e.amount) from public.expenses e
              where e.group_id = p_group_id and e.paid_by = m.user_id), 0)::bigint,
    coalesce((select sum(s.amount) from public.expense_splits s
              where s.group_id = p_group_id and s.user_id = m.user_id), 0)::bigint,
    coalesce((select sum(t.amount) from public.settlements t
              where t.group_id = p_group_id and t.from_user = m.user_id and t.status = 'paid'), 0)::bigint,
    coalesce((select sum(t.amount) from public.settlements t
              where t.group_id = p_group_id and t.to_user = m.user_id and t.status = 'paid'), 0)::bigint,
    public.member_net_balance(p_group_id, m.user_id)
  from public.group_members m
  where m.group_id = p_group_id
    and public.is_group_member(p_group_id)
  order by m.joined_at, m.user_id;
$$;

-- -----------------------------------------------------------------------------
-- Invitations
-- -----------------------------------------------------------------------------

-- Public preview of an invite (callable while logged out). Returns no rows for
-- an invalid token. Reveals only what the invite card needs.
create or replace function public.get_invite_preview(p_token text)
returns table (
  group_id uuid,
  name text,
  description text,
  currency text,
  creator_name text,
  member_count integer,
  is_member boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.id,
    g.name,
    g.description,
    g.currency,
    p.name,
    (select count(*)::integer from public.group_members m
      where m.group_id = g.id and m.removed_at is null),
    exists (
      select 1 from public.group_members m
      where m.group_id = g.id and m.user_id = (select auth.uid()) and m.removed_at is null
    )
  from public.groups g
  left join public.profiles p on p.id = g.created_by
  where p_token is not null
    and char_length(p_token) between 16 and 64
    and g.invite_token = p_token;
$$;

-- Resolve a short invite code to its invite token (authenticated users only).
create or replace function public.find_invite_by_code(p_code text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select g.invite_token
  from public.groups g
  where (select auth.uid()) is not null
    and g.invite_code = upper(btrim(p_code));
$$;

-- Join a group through its invite token. Idempotent: joining twice is safe.
create or replace function public.join_group(p_token text)
returns table (group_id uuid, status text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_member public.group_members;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select g.id into v_group_id from public.groups g where g.invite_token = p_token;
  if not found then
    raise exception 'INVITE_INVALID';
  end if;

  perform public.ensure_profile(v_uid);

  select * into v_member from public.group_members m
  where m.group_id = v_group_id and m.user_id = v_uid
  for update;

  if found and v_member.removed_at is null then
    return query select v_group_id, 'already_member'::text;
    return;
  end if;

  if found then
    update public.group_members
    set removed_at = null, role = 'member', joined_at = now()
    where id = v_member.id;
    return query select v_group_id, 'rejoined'::text;
    return;
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (v_group_id, v_uid, 'member')
  on conflict (group_id, user_id) do nothing;

  return query select v_group_id, 'joined'::text;
end;
$$;

-- -----------------------------------------------------------------------------
-- Membership management
-- -----------------------------------------------------------------------------

-- Remove a member (owner/admin), or leave a group (self).
-- * No financial history  -> membership row is deleted ('removed').
-- * Has history           -> allowed only with a zero balance and no pending
--                            settlements; the member is marked removed
--                            ('deactivated') so history stays intact.
create or replace function public.remove_member(p_group_id uuid, p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_caller_role text;
  v_target public.group_members;
  v_has_history boolean;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select m.role into v_caller_role from public.group_members m
  where m.group_id = p_group_id and m.user_id = v_uid and m.removed_at is null;
  if not found then
    raise exception 'NOT_A_MEMBER';
  end if;

  select * into v_target from public.group_members m
  where m.group_id = p_group_id and m.user_id = p_user_id and m.removed_at is null
  for update;
  if not found then
    raise exception 'MEMBER_NOT_FOUND';
  end if;

  if v_target.role = 'owner' then
    raise exception 'CANNOT_REMOVE_OWNER';
  end if;

  if p_user_id <> v_uid
     and not (v_caller_role = 'owner' or (v_caller_role = 'admin' and v_target.role = 'member')) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  v_has_history :=
       exists (select 1 from public.expenses e where e.group_id = p_group_id and e.paid_by = p_user_id)
    or exists (select 1 from public.expense_splits s where s.group_id = p_group_id and s.user_id = p_user_id)
    or exists (select 1 from public.settlements t where t.group_id = p_group_id
                 and p_user_id in (t.from_user, t.to_user));

  if not v_has_history then
    delete from public.group_members where id = v_target.id;
    return 'removed';
  end if;

  if exists (select 1 from public.settlements t where t.group_id = p_group_id
               and t.status = 'pending' and p_user_id in (t.from_user, t.to_user)) then
    raise exception 'MEMBER_HAS_PENDING_SETTLEMENTS';
  end if;

  if public.member_net_balance(p_group_id, p_user_id) <> 0 then
    raise exception 'MEMBER_HAS_BALANCE';
  end if;

  update public.group_members
  set removed_at = now(), role = 'member'
  where id = v_target.id;
  return 'deactivated';
end;
$$;

-- Promote a member to admin or demote an admin (owner only).
create or replace function public.set_member_role(p_group_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_role not in ('admin', 'member') then
    raise exception 'INVALID_ROLE';
  end if;
  if not public.is_group_owner(p_group_id) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  update public.group_members
  set role = p_role
  where group_id = p_group_id
    and user_id = p_user_id
    and removed_at is null
    and role <> 'owner';
  if not found then
    raise exception 'MEMBER_NOT_FOUND';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Expenses
-- -----------------------------------------------------------------------------

-- Validate a splits payload: [{ "user_id": uuid, "amount": int, "weight": num? }, ...]
create or replace function public.validate_splits(p_amount bigint, p_splits jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_elem jsonb;
  v_user uuid;
  v_amount numeric;
  v_sum numeric := 0;
  v_seen uuid[] := '{}';
begin
  if p_amount is null or p_amount <= 0 or p_amount > 100000000000 then
    raise exception 'INVALID_AMOUNT';
  end if;
  if p_splits is null or jsonb_typeof(p_splits) <> 'array' or jsonb_array_length(p_splits) = 0 then
    raise exception 'SPLIT_EMPTY';
  end if;

  for v_elem in select value from jsonb_array_elements(p_splits) loop
    if coalesce(jsonb_typeof(v_elem -> 'amount'), '') <> 'number' then
      raise exception 'SPLIT_INVALID_AMOUNT';
    end if;
    v_amount := (v_elem ->> 'amount')::numeric;
    if v_amount < 0 or v_amount <> trunc(v_amount) then
      raise exception 'SPLIT_INVALID_AMOUNT';
    end if;
    if coalesce(v_elem ->> 'user_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'INVALID_INPUT';
    end if;
    v_user := (v_elem ->> 'user_id')::uuid;
    if v_user = any (v_seen) then
      raise exception 'SPLIT_DUPLICATE_PARTICIPANT';
    end if;
    v_seen := v_seen || v_user;
    v_sum := v_sum + v_amount;
  end loop;

  if v_sum <> p_amount then
    raise exception 'SPLIT_TOTAL_MISMATCH';
  end if;
end;
$$;

-- Create an expense with its splits atomically. Runs under the caller's RLS.
create or replace function public.create_expense(
  p_group_id uuid,
  p_title text,
  p_amount bigint,
  p_paid_by uuid,
  p_splits jsonb,
  p_split_type text default 'equal',
  p_category text default 'other',
  p_description text default null,
  p_expense_date timestamptz default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if not public.is_group_member(p_group_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 100 then
    raise exception 'INVALID_INPUT';
  end if;
  perform public.validate_splits(p_amount, p_splits);

  insert into public.expenses (group_id, title, description, amount, paid_by, category, split_type, expense_date)
  values (p_group_id, p_title, p_description, p_amount, p_paid_by,
          coalesce(p_category, 'other'), coalesce(p_split_type, 'equal'), coalesce(p_expense_date, now()))
  returning id into v_id;

  insert into public.expense_splits (expense_id, user_id, amount, weight)
  select v_id, s.user_id, s.amount, s.weight
  from jsonb_to_recordset(p_splits) as s (user_id uuid, amount bigint, weight numeric);

  return v_id;
end;
$$;

-- Replace an expense's fields and splits atomically. Runs under the caller's RLS.
create or replace function public.update_expense(
  p_expense_id uuid,
  p_title text,
  p_amount bigint,
  p_paid_by uuid,
  p_splits jsonb,
  p_split_type text default 'equal',
  p_category text default 'other',
  p_description text default null,
  p_expense_date timestamptz default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if not exists (select 1 from public.expenses e where e.id = p_expense_id) then
    raise exception 'EXPENSE_NOT_FOUND';
  end if;
  if not public.can_edit_expense(p_expense_id) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 100 then
    raise exception 'INVALID_INPUT';
  end if;
  perform public.validate_splits(p_amount, p_splits);

  update public.expenses
  set title = p_title,
      description = p_description,
      amount = p_amount,
      paid_by = p_paid_by,
      category = coalesce(p_category, 'other'),
      split_type = coalesce(p_split_type, 'equal'),
      expense_date = coalesce(p_expense_date, expense_date)
  where id = p_expense_id;
  if not found then
    raise exception 'NOT_AUTHORIZED';
  end if;

  delete from public.expense_splits where expense_id = p_expense_id;

  insert into public.expense_splits (expense_id, user_id, amount, weight)
  select p_expense_id, s.user_id, s.amount, s.weight
  from jsonb_to_recordset(p_splits) as s (user_id uuid, amount bigint, weight numeric);
end;
$$;

-- -----------------------------------------------------------------------------
-- Function privileges: nothing is callable by anonymous users except the
-- invite preview. Trigger and internal helpers are not callable at all.
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.get_invite_preview(text) to anon, authenticated;

-- Used inside RLS policies (evaluated as the querying role).
grant execute on function public.is_group_member(uuid)   to authenticated;
grant execute on function public.is_group_admin(uuid)    to authenticated;
grant execute on function public.is_group_owner(uuid)    to authenticated;
grant execute on function public.shares_group_with(uuid) to authenticated;
grant execute on function public.can_edit_expense(uuid)  to authenticated;

-- Called by invoker functions under the caller's role.
grant execute on function public.member_net_balance(uuid, uuid)  to authenticated;
grant execute on function public.validate_splits(bigint, jsonb)  to authenticated;

-- Application RPCs.
grant execute on function public.create_group(text, text, text)            to authenticated;
grant execute on function public.regenerate_invite(uuid)                   to authenticated;
grant execute on function public.get_my_groups()                           to authenticated;
grant execute on function public.group_balances(uuid)                      to authenticated;
grant execute on function public.find_invite_by_code(text)                 to authenticated;
grant execute on function public.join_group(text)                          to authenticated;
grant execute on function public.remove_member(uuid, uuid)                 to authenticated;
grant execute on function public.set_member_role(uuid, uuid, text)         to authenticated;
grant execute on function public.create_expense(uuid, text, bigint, uuid, jsonb, text, text, text, timestamptz) to authenticated;
grant execute on function public.update_expense(uuid, text, bigint, uuid, jsonb, text, text, text, timestamptz) to authenticated;

-- Future functions must be granted explicitly.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
