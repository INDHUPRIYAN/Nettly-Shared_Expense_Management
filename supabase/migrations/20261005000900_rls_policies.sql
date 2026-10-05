-- =============================================================================
-- 9. Row Level Security
--
-- Principle: a user can only see and touch data of groups where they are an
-- active member. Table privileges are additionally narrowed to the exact
-- columns a client may write, so server-controlled columns (created_by,
-- currency, invite tokens, paid_at, ...) can never be set from the browser.
-- Group creation, joining and membership changes go through SECURITY DEFINER
-- functions (next migration) that perform explicit authorization checks.
-- =============================================================================

alter table public.profiles       enable row level security;
alter table public.groups         enable row level security;
alter table public.group_members  enable row level security;
alter table public.expenses       enable row level security;
alter table public.expense_splits enable row level security;
alter table public.settlements    enable row level security;

-- -----------------------------------------------------------------------------
-- Table / column privileges
-- -----------------------------------------------------------------------------
revoke all on public.profiles, public.groups, public.group_members,
              public.expenses, public.expense_splits, public.settlements
  from anon, authenticated;

grant select on public.profiles, public.groups, public.group_members,
                public.expenses, public.expense_splits, public.settlements
  to authenticated;

grant update (name, avatar_url) on public.profiles to authenticated;

grant update (name, description, currency) on public.groups to authenticated;
grant delete on public.groups to authenticated;

grant insert (group_id, title, description, amount, paid_by, category, split_type, expense_date)
  on public.expenses to authenticated;
grant update (title, description, amount, paid_by, category, split_type, expense_date)
  on public.expenses to authenticated;
grant delete on public.expenses to authenticated;

grant insert (expense_id, user_id, amount, weight) on public.expense_splits to authenticated;
grant delete on public.expense_splits to authenticated;

grant insert (group_id, from_user, to_user, amount, status, note) on public.settlements to authenticated;
grant update (status, note) on public.settlements to authenticated;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create policy "profiles: read own or co-members"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_group_with(id));

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- groups (insert happens only through create_group())
-- -----------------------------------------------------------------------------
create policy "groups: members can read"
  on public.groups for select to authenticated
  using (public.is_group_member(id));

create policy "groups: owner/admin can update"
  on public.groups for update to authenticated
  using (public.is_group_admin(id))
  with check (public.is_group_admin(id));

create policy "groups: owner can delete"
  on public.groups for delete to authenticated
  using (public.is_group_owner(id));

-- -----------------------------------------------------------------------------
-- group_members (writes only through join_group / remove_member / set_member_role)
-- -----------------------------------------------------------------------------
create policy "group_members: members can read"
  on public.group_members for select to authenticated
  using (public.is_group_member(group_id));

-- -----------------------------------------------------------------------------
-- expenses
-- -----------------------------------------------------------------------------
create policy "expenses: members can read"
  on public.expenses for select to authenticated
  using (public.is_group_member(group_id));

create policy "expenses: members can create"
  on public.expenses for insert to authenticated
  with check (public.is_group_member(group_id) and created_by = (select auth.uid()));

create policy "expenses: creator or admin can update"
  on public.expenses for update to authenticated
  using (
    public.is_group_member(group_id)
    and (created_by = (select auth.uid()) or public.is_group_admin(group_id))
  )
  with check (public.is_group_member(group_id));

create policy "expenses: creator or admin can delete"
  on public.expenses for delete to authenticated
  using (
    public.is_group_member(group_id)
    and (created_by = (select auth.uid()) or public.is_group_admin(group_id))
  );

-- -----------------------------------------------------------------------------
-- expense_splits (written together with their expense)
-- -----------------------------------------------------------------------------
create policy "expense_splits: members can read"
  on public.expense_splits for select to authenticated
  using (public.is_group_member(group_id));

create policy "expense_splits: expense editors can insert"
  on public.expense_splits for insert to authenticated
  with check (public.can_edit_expense(expense_id));

create policy "expense_splits: expense editors can delete"
  on public.expense_splits for delete to authenticated
  using (public.can_edit_expense(expense_id));

-- -----------------------------------------------------------------------------
-- settlements (never deleted — cancelled instead)
-- -----------------------------------------------------------------------------
create policy "settlements: members can read"
  on public.settlements for select to authenticated
  using (public.is_group_member(group_id));

create policy "settlements: parties or admin can record"
  on public.settlements for insert to authenticated
  with check (
    public.is_group_member(group_id)
    and created_by = (select auth.uid())
    and ((select auth.uid()) in (from_user, to_user) or public.is_group_admin(group_id))
  );

create policy "settlements: parties or admin can update status"
  on public.settlements for update to authenticated
  using (
    public.is_group_member(group_id)
    and ((select auth.uid()) in (from_user, to_user) or public.is_group_admin(group_id))
  )
  with check (
    public.is_group_member(group_id)
    and ((select auth.uid()) in (from_user, to_user) or public.is_group_admin(group_id))
  );
