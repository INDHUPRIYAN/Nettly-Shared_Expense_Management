-- =============================================================================
-- 2. Groups
-- invite_token: long, cryptographically random, URL-safe — used in invite links.
-- invite_code:  short human-friendly code (no ambiguous characters 0/O/1/I).
-- Both are generated in the database; clients can never choose them.
-- =============================================================================

-- 24 random bytes -> 32 URL-safe base64 characters (192 bits of entropy).
create or replace function public.generate_invite_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_');
$$;

-- 6 characters from a 32-symbol alphabet. 256 is divisible by 32, so
-- `byte % 32` is unbiased.
create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(6);
  code text := '';
begin
  for i in 0..5 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return code;
end;
$$;

create table public.groups (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (char_length(btrim(name)) between 1 and 80),
  description       text check (description is null or char_length(description) <= 500),
  currency          text not null default 'INR'
                    check (currency in ('INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD')),
  created_by        uuid references public.profiles (id) on delete set null,
  invite_token      text unique not null default public.generate_invite_token(),
  invite_code       text unique not null default public.generate_invite_code()
                    check (invite_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  -- Bumped by triggers whenever anything in the group changes. Clients subscribe
  -- to UPDATEs on this row via Realtime (RLS-checked, filterable by id).
  last_activity_at  timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.groups is 'A shared-expense group (trip, flat, team, event...).';

-- Only user-editable columns bump updated_at; activity bumps do not.
create trigger groups_set_updated_at
  before update of name, description, currency on public.groups
  for each row execute function public.set_updated_at();
