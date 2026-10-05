-- =============================================================================
-- 4. Expenses
-- amount is stored in integer minor units (paise for INR). ₹100.50 = 10050.
-- Expenses are never modified by settlements.
-- =============================================================================

create table public.expenses (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups (id) on delete cascade,
  title         text not null check (char_length(btrim(title)) between 1 and 100),
  description   text check (description is null or char_length(description) <= 500),
  -- Upper bound (1,000,000,000.00 in major units) keeps every intermediate
  -- calculation far below 2^53 on the client.
  amount        bigint not null check (amount > 0 and amount <= 100000000000),
  currency      text not null,
  paid_by       uuid not null references public.profiles (id),
  category      text not null default 'other' check (
                  category in ('food', 'transport', 'accommodation', 'entertainment', 'shopping',
                               'groceries', 'utilities', 'medical', 'education', 'other')
                ),
  split_type    text not null default 'equal' check (split_type in ('equal', 'custom', 'percentage', 'shares')),
  expense_date  timestamptz not null default now(),
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.expenses is 'Original expense records. Amounts are integer minor units.';
comment on column public.expenses.amount is 'Integer minor units (e.g. paise). Never a float.';

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();
