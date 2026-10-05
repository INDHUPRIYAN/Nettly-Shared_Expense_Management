-- =============================================================================
-- 7. Indexes
-- (invite_token / invite_code and (group_id, user_id) are already indexed by
-- their UNIQUE constraints.)
-- =============================================================================

create index group_members_user_id_idx      on public.group_members (user_id);
create index group_members_group_active_idx on public.group_members (group_id) where removed_at is null;

create index expenses_group_id_idx          on public.expenses (group_id, expense_date desc);
create index expenses_paid_by_idx           on public.expenses (paid_by);
create index expenses_created_at_idx        on public.expenses (created_at);

create index expense_splits_expense_id_idx  on public.expense_splits (expense_id);
create index expense_splits_group_user_idx  on public.expense_splits (group_id, user_id);
create index expense_splits_user_id_idx     on public.expense_splits (user_id);

create index settlements_group_id_idx       on public.settlements (group_id, created_at desc);
create index settlements_from_user_idx      on public.settlements (from_user);
create index settlements_to_user_idx        on public.settlements (to_user);

create index groups_created_by_idx          on public.groups (created_by);
