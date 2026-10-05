-- =============================================================================
-- 6. Settlements
-- Payments between members, stored separately from expenses. Only `paid`
-- settlements affect balances. Rows are never deleted; they are cancelled.
--
-- Allowed status transitions:  pending -> paid | cancelled,  paid -> cancelled
-- =============================================================================

create table public.settlements (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups (id) on delete cascade,
  from_user     uuid not null references public.profiles (id),
  to_user       uuid not null references public.profiles (id),
  amount        bigint not null check (amount > 0 and amount <= 100000000000),
  status        text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  note          text check (note is null or char_length(note) <= 200),
  created_by    uuid references public.profiles (id) on delete set null,
  paid_at       timestamptz,
  cancelled_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (from_user <> to_user),
  check (status <> 'paid' or paid_at is not null),
  check (status <> 'cancelled' or cancelled_at is not null)
);

comment on table public.settlements is 'Payments between group members. Only status = paid affects balances.';

create trigger settlements_set_updated_at
  before update on public.settlements
  for each row execute function public.set_updated_at();
