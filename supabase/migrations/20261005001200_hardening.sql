-- =============================================================================
-- 12. Hardening (from security review)
--
--  a. Membership row locks in write triggers, so remove_member() cannot race
--     with a concurrent expense/split/settlement write for the same person.
--  b. The receiver of a payment can always dispute (cancel) it — even if the
--     payer has since left — so a debtor cannot record a fake payment, leave,
--     and make it permanent.
--  c. Expense lock (former member involved) is enforced on split rows too.
--  d. Invite-code lookups are rate limited per user (anti brute force).
--  e. Removing someone rotates the group's invite, so they cannot simply
--     rejoin with the link they already have.
--  f. Email addresses are private: co-members can read names, not emails.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- a. Lock an active membership row (FOR SHARE). remove_member() takes FOR UPDATE
--    on the same row, so the two serialize. Volatile: row locks are not allowed
--    in stable functions.
-- -----------------------------------------------------------------------------
create or replace function public.lock_active_member(p_group_id uuid, p_user_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform 1
  from public.group_members m
  where m.group_id = p_group_id
    and m.user_id = p_user_id
    and m.removed_at is null
  for share;
  return found;
end;
$$;

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
  else
    new.created_by := coalesce((select auth.uid()), new.created_by);
  end if;

  if not public.lock_active_member(new.group_id, new.paid_by) then
    raise exception 'PAYER_NOT_MEMBER';
  end if;

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

-- -----------------------------------------------------------------------------
-- a + c. Splits: lock the participant's membership; refuse changes to locked expenses.
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
  if public.expense_involves_former_member(new.expense_id) then
    raise exception 'EXPENSE_LOCKED';
  end if;
  if not public.lock_active_member(v_group_id, new.user_id) then
    raise exception 'PARTICIPANT_NOT_MEMBER';
  end if;
  return new;
end;
$$;

create or replace function public.expense_splits_before_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Skip when the parent expense or group is itself being deleted (cascade).
  if exists (
       select 1 from public.expenses e
       join public.groups g on g.id = e.group_id
       where e.id = old.expense_id
     )
     and public.expense_involves_former_member(old.expense_id) then
    raise exception 'EXPENSE_LOCKED';
  end if;
  return old;
end;
$$;

-- -----------------------------------------------------------------------------
-- a + b. Settlements.
-- -----------------------------------------------------------------------------
create or replace function public.settlements_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(v_uid, new.created_by);
    if not public.lock_active_member(new.group_id, new.from_user)
       or not public.lock_active_member(new.group_id, new.to_user) then
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
    if not (public.lock_active_member(old.group_id, old.from_user)
            and public.lock_active_member(old.group_id, old.to_user)) then
      -- A former member's settlements are frozen, EXCEPT that the receiver can
      -- always dispute a payment recorded to them (e.g. one that never arrived).
      if not (new.status = 'cancelled'
              and v_uid = old.to_user
              and public.is_active_member(old.group_id, old.to_user)) then
        raise exception 'SETTLEMENT_PARTY_NOT_MEMBER';
      end if;
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

-- -----------------------------------------------------------------------------
-- d. Rate-limited invite code lookup: 10 failed attempts per user per hour.
-- -----------------------------------------------------------------------------
create table public.invite_code_attempts (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  attempted_at  timestamptz not null default now()
);
create index invite_code_attempts_user_idx on public.invite_code_attempts (user_id, attempted_at desc);
alter table public.invite_code_attempts enable row level security;
revoke all on public.invite_code_attempts from anon, authenticated;
comment on table public.invite_code_attempts is 'Failed invite-code lookups, for rate limiting. Not accessible to clients.';

create or replace function public.find_invite_by_code(p_code text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_token text;
begin
  if v_uid is null then
    return null;
  end if;

  if (select count(*) from public.invite_code_attempts a
      where a.user_id = v_uid and a.attempted_at > now() - interval '1 hour') >= 10 then
    raise exception 'RATE_LIMITED';
  end if;

  select g.invite_token into v_token
  from public.groups g
  where g.invite_code = upper(btrim(coalesce(p_code, '')));

  if v_token is null then
    insert into public.invite_code_attempts (user_id) values (v_uid);
    delete from public.invite_code_attempts a
    where a.user_id = v_uid and a.attempted_at < now() - interval '1 day';
  end if;
  return v_token;
end;
$$;

-- -----------------------------------------------------------------------------
-- e. Rotate the invite when an admin removes someone.
-- -----------------------------------------------------------------------------
create or replace function public.rotate_invite(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt integer := 0;
begin
  loop
    begin
      update public.groups
      set invite_token = public.generate_invite_token(),
          invite_code  = public.generate_invite_code()
      where id = p_group_id;
      return;
    exception when unique_violation then
      v_attempt := v_attempt + 1;
      if v_attempt >= 5 then
        raise;
      end if;
    end;
  end loop;
end;
$$;

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
  v_result text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select m.role into v_caller_role from public.group_members m
  where m.group_id = p_group_id and m.user_id = v_uid and m.removed_at is null;
  if not found then
    raise exception 'NOT_A_MEMBER';
  end if;

  -- FOR UPDATE serializes with lock_active_member() in concurrent writes.
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
    v_result := 'removed';
  else
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
    v_result := 'deactivated';
  end if;

  -- Someone removed by an admin must not be able to rejoin with the old link.
  if p_user_id <> v_uid then
    perform public.rotate_invite(p_group_id);
  end if;
  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- f. Private emails: clients may read profile names/avatars only.
-- -----------------------------------------------------------------------------
revoke select on public.profiles from authenticated;
grant select (id, name, avatar_url, created_at, updated_at) on public.profiles to authenticated;

-- New internal functions are not callable by clients (default privileges
-- already revoke EXECUTE); find_invite_by_code / remove_member keep their grants.
revoke execute on function public.lock_active_member(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.rotate_invite(uuid) from public, anon, authenticated;
