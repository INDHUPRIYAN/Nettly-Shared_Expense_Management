-- =============================================================================
-- 3. Group members
-- A member who has financial history is never hard-deleted: they are marked
-- removed (removed_at) so historical expenses and settlements stay valid.
-- =============================================================================

create table public.group_members (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at   timestamptz not null default now(),
  removed_at  timestamptz,
  unique (group_id, user_id),
  check (not (role = 'owner' and removed_at is not null))
);

comment on table public.group_members is 'Membership of users in groups. removed_at marks former members.';
comment on column public.group_members.removed_at is 'Set when a member with financial history leaves or is removed.';

-- Exactly one owner per group.
create unique index group_members_one_owner on public.group_members (group_id) where role = 'owner';
