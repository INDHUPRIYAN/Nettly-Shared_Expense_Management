-- =============================================================================
-- 8. Helper functions and integrity triggers
--
-- Errors raised for business-rule violations use a stable machine-readable
-- message (e.g. 'SPLIT_TOTAL_MISMATCH') which the client maps to a friendly
-- message. Raw database errors are never shown to users.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Membership helpers (SECURITY DEFINER so they can be used inside RLS policies
-- without recursive policy evaluation on group_members).
-- -----------------------------------------------------------------------------

-- Is the current user an active member of the group?
create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = p_group_id
      and m.user_id = (select auth.uid())
      and m.removed_at is null
  );
$$;

-- Is the current user an active owner or admin of the group?
create or replace function public.is_group_admin(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = p_group_id
      and m.user_id = (select auth.uid())
      and m.removed_at is null
      and m.role in ('owner', 'admin')
  );
$$;

-- Is the current user the owner of the group?
create or replace function public.is_group_owner(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = p_group_id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  );
$$;

-- Is an arbitrary user an active member of the group? (internal use)
create or replace function public.is_active_member(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = p_group_id
      and m.user_id = p_user_id
      and m.removed_at is null
  );
$$;

-- Does the current user (as an active member) share a group with p_user_id?
-- Former members of the caller's groups are included so their names still
-- render in historical expenses.
create or replace function public.shares_group_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members me
    join public.group_members them on them.group_id = me.group_id
    where me.user_id = (select auth.uid())
      and me.removed_at is null
      and them.user_id = p_user_id
  );
$$;

-- Can the current user edit/delete this expense? (creator, or group owner/admin)
create or replace function public.can_edit_expense(p_expense_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.expenses e
    where e.id = p_expense_id
      and public.is_group_member(e.group_id)
      and (e.created_by = (select auth.uid()) or public.is_group_admin(e.group_id))
  );
$$;

-- Does the expense involve someone who is no longer an active member?
-- Such expenses are locked: editing them would change the balance of a person
-- who has already left the group with a settled (zero) balance.
create or replace function public.expense_involves_former_member(p_expense_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.expenses e
    where e.id = p_expense_id
      and (
        not public.is_active_member(e.group_id, e.paid_by)
        or exists (
          select 1 from public.expense_splits s
          where s.expense_id = e.id
            and not public.is_active_member(e.group_id, s.user_id)
        )
      )
  );
$$;

-- Net balance of a member in minor units:
--   paid for expenses - share of expenses + settlements paid out - settlements received
-- Positive = should receive money, negative = owes money. Only `paid`
-- settlements count. SECURITY INVOKER: respects the caller's RLS.
create or replace function public.member_net_balance(p_group_id uuid, p_user_id uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select (
      coalesce((select sum(e.amount) from public.expenses e
                where e.group_id = p_group_id and e.paid_by = p_user_id), 0)
    - coalesce((select sum(s.amount) from public.expense_splits s
                where s.group_id = p_group_id and s.user_id = p_user_id), 0)
    + coalesce((select sum(t.amount) from public.settlements t
                where t.group_id = p_group_id and t.from_user = p_user_id and t.status = 'paid'), 0)
    - coalesce((select sum(t.amount) from public.settlements t
                where t.group_id = p_group_id and t.to_user = p_user_id and t.status = 'paid'), 0)
  )::bigint;
$$;

-- Make sure a profile row exists for a user (defensive; normally created by
-- the on_auth_user_created trigger).
create or replace function public.ensure_profile(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.profiles (id, name, email)
  select u.id,
         coalesce(nullif(btrim(left(u.raw_user_meta_data ->> 'name', 80)), ''),
                  nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
                  'Member'),
         u.email
  from auth.users u
  where u.id = p_user_id
  on conflict (id) do nothing;
$$;

-- -----------------------------------------------------------------------------
-- Groups: currency cannot change once money has been recorded (amounts would
-- silently change meaning).
-- -----------------------------------------------------------------------------
create or replace function public.groups_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.currency <> old.currency and (
       exists (select 1 from public.expenses where group_id = old.id)
    or exists (select 1 from public.settlements where group_id = old.id)
  ) then
    raise exception 'CURRENCY_LOCKED';
  end if;
  new.name := btrim(new.name);
  new.description := nullif(btrim(new.description), '');
  return new;
end;
$$;

create trigger groups_before_update
  before update of name, description, currency on public.groups
  for each row execute function public.groups_before_update();

-- -----------------------------------------------------------------------------
-- Expenses: server-controlled fields and membership validation.
-- -----------------------------------------------------------------------------
create or replace function public.expenses_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_currency text;
begin
  if tg_op = 'UPDATE' then
    if new.group_id <> old.group_id then
      raise exception 'EXPENSE_IMMUTABLE_FIELD';
    end if;
    if public.expense_involves_former_member(old.id) then
      raise exception 'EXPENSE_LOCKED';
    end if;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    if new.paid_by <> old.paid_by and not public.is_active_member(new.group_id, new.paid_by) then
      raise exception 'PAYER_NOT_MEMBER';
    end if;
  else
    -- Never trust the client for authorship.
    new.created_by := coalesce((select auth.uid()), new.created_by);
    if not public.is_active_member(new.group_id, new.paid_by) then
      raise exception 'PAYER_NOT_MEMBER';
    end if;
  end if;

  -- Currency always follows the group.
  select g.currency into v_currency from public.groups g where g.id = new.group_id;
  if not found then
    raise exception 'GROUP_NOT_FOUND';
  end if;
  new.currency := v_currency;
  new.title := btrim(new.title);
  new.description := nullif(btrim(new.description), '');
  return new;
end;
$$;

create trigger expenses_before_write
  before insert or update on public.expenses
  for each row execute function public.expenses_before_write();

create or replace function public.expenses_before_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Skip the check when the whole group is being deleted (cascade).
  if exists (select 1 from public.groups g where g.id = old.group_id)
     and public.expense_involves_former_member(old.id) then
    raise exception 'EXPENSE_LOCKED';
  end if;
  return old;
end;
$$;

create trigger expenses_before_delete
  before delete on public.expenses
  for each row execute function public.expenses_before_delete();

-- -----------------------------------------------------------------------------
-- Expense splits: group_id is derived; participants must be active members.
-- -----------------------------------------------------------------------------
create or replace function public.expense_splits_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_id uuid;
begin
  select e.group_id into v_group_id from public.expenses e where e.id = new.expense_id;
  if not found then
    raise exception 'EXPENSE_NOT_FOUND';
  end if;
  new.group_id := v_group_id;
  if not public.is_active_member(v_group_id, new.user_id) then
    raise exception 'PARTICIPANT_NOT_MEMBER';
  end if;
  return new;
end;
$$;

create trigger expense_splits_before_insert
  before insert on public.expense_splits
  for each row execute function public.expense_splits_before_insert();

create or replace function public.expense_splits_before_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Removing a former member's share would change their (settled) balance.
  -- Skip when the parent expense or group is itself being deleted (cascade).
  if exists (
       select 1 from public.expenses e
       join public.groups g on g.id = e.group_id
       where e.id = old.expense_id
     )
     and not public.is_active_member(old.group_id, old.user_id) then
    raise exception 'EXPENSE_LOCKED';
  end if;
  return old;
end;
$$;

create trigger expense_splits_before_delete
  before delete on public.expense_splits
  for each row execute function public.expense_splits_before_delete();

-- -----------------------------------------------------------------------------
-- The core accounting invariant, checked at COMMIT time (deferred) so an
-- expense and its splits can be written in any order inside one transaction:
--
--     sum(expense_splits.amount) = expenses.amount,  and at least one split.
-- -----------------------------------------------------------------------------
create or replace function public.assert_expense_split_total(p_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_amount bigint;
  v_sum numeric;
  v_count integer;
begin
  select e.amount into v_amount from public.expenses e where e.id = p_expense_id;
  if not found then
    return; -- expense deleted
  end if;
  select coalesce(sum(s.amount), 0), count(*) into v_sum, v_count
  from public.expense_splits s where s.expense_id = p_expense_id;
  if v_count = 0 then
    raise exception 'SPLIT_EMPTY';
  end if;
  if v_sum <> v_amount then
    raise exception 'SPLIT_TOTAL_MISMATCH'
      using detail = format('expense %s: amount %s, splits %s', p_expense_id, v_amount, v_sum);
  end if;
end;
$$;

create or replace function public.check_expense_split_total_from_expense()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_expense_split_total(new.id);
  return null;
end;
$$;

create or replace function public.check_expense_split_total_from_split()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.assert_expense_split_total(old.expense_id);
  else
    perform public.assert_expense_split_total(new.expense_id);
  end if;
  return null;
end;
$$;

create constraint trigger expenses_split_total
  after insert or update on public.expenses
  deferrable initially deferred
  for each row execute function public.check_expense_split_total_from_expense();

create constraint trigger expense_splits_total
  after insert or update or delete on public.expense_splits
  deferrable initially deferred
  for each row execute function public.check_expense_split_total_from_split();

-- -----------------------------------------------------------------------------
-- Settlements: membership, immutability and the status state machine.
-- -----------------------------------------------------------------------------
create or replace function public.settlements_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce((select auth.uid()), new.created_by);
    if not public.is_active_member(new.group_id, new.from_user)
       or not public.is_active_member(new.group_id, new.to_user) then
      raise exception 'SETTLEMENT_PARTY_NOT_MEMBER';
    end if;
    if new.status = 'cancelled' then
      raise exception 'SETTLEMENT_INVALID_TRANSITION';
    end if;
    new.paid_at := case when new.status = 'paid' then now() end;
    new.cancelled_at := null;
    new.note := nullif(btrim(new.note), '');
    return new;
  end if;

  -- UPDATE
  if new.group_id <> old.group_id
     or new.from_user <> old.from_user
     or new.to_user <> old.to_user
     or new.amount <> old.amount
     or new.created_by is distinct from old.created_by
     or new.created_at <> old.created_at then
    raise exception 'SETTLEMENT_IMMUTABLE_FIELD';
  end if;

  if new.status <> old.status then
    -- Changing a former member's settlement would change their balance.
    if not public.is_active_member(old.group_id, old.from_user)
       or not public.is_active_member(old.group_id, old.to_user) then
      raise exception 'SETTLEMENT_PARTY_NOT_MEMBER';
    end if;
    if old.status = 'pending' and new.status = 'paid' then
      new.paid_at := now();
    elsif old.status in ('pending', 'paid') and new.status = 'cancelled' then
      new.paid_at := old.paid_at;
      new.cancelled_at := now();
    else
      raise exception 'SETTLEMENT_INVALID_TRANSITION';
    end if;
  else
    new.paid_at := old.paid_at;
    new.cancelled_at := old.cancelled_at;
  end if;
  new.note := nullif(btrim(new.note), '');
  return new;
end;
$$;

create trigger settlements_before_write
  before insert or update on public.settlements
  for each row execute function public.settlements_before_write();

-- -----------------------------------------------------------------------------
-- Activity bump: any change to a group's money or membership touches
-- groups.last_activity_at so subscribed clients refresh (see realtime migration).
-- -----------------------------------------------------------------------------
create or replace function public.bump_group_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_id uuid;
begin
  if tg_op = 'DELETE' then
    v_group_id := old.group_id;
  else
    v_group_id := new.group_id;
  end if;
  update public.groups set last_activity_at = now() where id = v_group_id;
  return null;
end;
$$;

create trigger expenses_bump_group_activity
  after insert or update or delete on public.expenses
  for each row execute function public.bump_group_activity();

create trigger settlements_bump_group_activity
  after insert or update or delete on public.settlements
  for each row execute function public.bump_group_activity();

create trigger group_members_bump_group_activity
  after insert or update or delete on public.group_members
  for each row execute function public.bump_group_activity();
