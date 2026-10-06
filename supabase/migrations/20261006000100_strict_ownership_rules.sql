-- =============================================================================
-- 14. Strict ownership rules
--
-- Expenses: ONLY the person who added an expense can edit or delete it
--           (group owners/admins no longer can).
--
-- Settlements: money is only "paid" when the RECEIVER says so.
--   * The receiver (to_user) records a payment as paid, or confirms a request.
--   * The payer (from_user) can only send a request ("I've paid") — a pending
--     settlement that does not affect balances until the receiver confirms.
--   * Nobody else can create or change a settlement.
--
--   Transitions:  pending -> paid       receiver only
--                 pending -> cancelled  payer (withdraw) or receiver (not received)
--                 paid    -> cancelled  receiver only (undo / dispute)
--
-- Group deletion stays owner-only (unchanged; see "groups: owner can delete").
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Expenses: creator only
-- -----------------------------------------------------------------------------
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
      and e.created_by = (select auth.uid())
  );
$$;

drop policy "expenses: creator or admin can update" on public.expenses;
drop policy "expenses: creator or admin can delete" on public.expenses;

create policy "expenses: creator can update"
  on public.expenses for update to authenticated
  using (public.is_group_member(group_id) and created_by = (select auth.uid()))
  with check (public.is_group_member(group_id));

create policy "expenses: creator can delete"
  on public.expenses for delete to authenticated
  using (public.is_group_member(group_id) and created_by = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Settlements: receiver confirms, payer requests
-- -----------------------------------------------------------------------------
drop policy "settlements: parties or admin can record" on public.settlements;
drop policy "settlements: parties or admin can update status" on public.settlements;

create policy "settlements: receiver records paid, payer requests"
  on public.settlements for insert to authenticated
  with check (
    public.is_group_member(group_id)
    and created_by = (select auth.uid())
    and (
      (status = 'paid' and to_user = (select auth.uid()))
      or (status = 'pending' and from_user = (select auth.uid()))
    )
  );

create policy "settlements: parties can update"
  on public.settlements for update to authenticated
  using (public.is_group_member(group_id) and (select auth.uid()) in (from_user, to_user))
  with check (public.is_group_member(group_id) and (select auth.uid()) in (from_user, to_user));

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
    -- Defence in depth (RLS enforces the same): only the receiver says "paid".
    if v_uid is not null then
      if new.status = 'paid' and v_uid <> new.to_user then
        raise exception 'ONLY_RECEIVER_CAN_MARK_PAID';
      end if;
      if new.status = 'pending' and v_uid <> new.from_user then
        raise exception 'NOT_AUTHORIZED';
      end if;
      if exists (
        select 1 from public.settlements t
        where t.group_id = new.group_id and t.from_user = new.from_user
          and t.to_user = new.to_user and t.status = 'pending'
      ) then
        raise exception 'SETTLEMENT_REQUEST_EXISTS';
      end if;
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
    if old.status = 'pending' and new.status = 'paid' then
      if v_uid is not null and v_uid <> old.to_user then
        raise exception 'ONLY_RECEIVER_CAN_MARK_PAID';
      end if;
    elsif old.status = 'pending' and new.status = 'cancelled' then
      if v_uid is not null and v_uid not in (old.from_user, old.to_user) then
        raise exception 'NOT_AUTHORIZED';
      end if;
    elsif old.status = 'paid' and new.status = 'cancelled' then
      if v_uid is not null and v_uid <> old.to_user then
        raise exception 'ONLY_RECEIVER_CAN_MARK_PAID';
      end if;
    else
      raise exception 'SETTLEMENT_INVALID_TRANSITION';
    end if;

    -- A former member's settlements are frozen, except that the receiver can
    -- always cancel (dispute) a payment recorded to them.
    if not (public.lock_active_member(old.group_id, old.from_user)
            and public.lock_active_member(old.group_id, old.to_user)) then
      if not (new.status = 'cancelled'
              and v_uid = old.to_user
              and public.is_active_member(old.group_id, old.to_user)) then
        raise exception 'SETTLEMENT_PARTY_NOT_MEMBER';
      end if;
    end if;

    if new.status = 'paid' then
      new.paid_at := now();
    else
      new.paid_at := old.paid_at;
      new.cancelled_at := now();
    end if;
  else
    new.paid_at := old.paid_at;
    new.cancelled_at := old.cancelled_at;
  end if;
  new.note := nullif(btrim(new.note), '');
  return new;
end;
$$;
