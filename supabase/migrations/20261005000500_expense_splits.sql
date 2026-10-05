-- =============================================================================
-- 5. Expense splits
-- Every expense has explicit split rows. A deferred constraint trigger (see the
-- helpers migration) guarantees sum(splits.amount) = expenses.amount at commit.
-- =============================================================================

create table public.expense_splits (
  id          uuid primary key default gen_random_uuid(),
  expense_id  uuid not null references public.expenses (id) on delete cascade,
  -- Denormalised from the expense by a trigger (never trusted from the client).
  -- Lets RLS and queries filter by group without a join.
  group_id    uuid not null references public.groups (id) on delete cascade,
  user_id     uuid not null references public.profiles (id),
  amount      bigint not null check (amount >= 0),
  -- The raw input used for percentage / shares splits (percent or share count),
  -- kept so the edit form can be restored exactly. Informational only:
  -- `amount` is always authoritative.
  weight      numeric(12, 4) check (weight is null or weight >= 0),
  created_at  timestamptz not null default now(),
  unique (expense_id, user_id)
);

comment on table public.expense_splits is 'Per-participant share of an expense, in integer minor units.';
