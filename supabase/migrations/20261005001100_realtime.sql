-- =============================================================================
-- 11. Realtime
--
-- Clients subscribe to UPDATE events on their group's row (filter id=eq.<id>).
-- Triggers bump groups.last_activity_at whenever expenses, settlements or
-- membership change, so one RLS-checked, filterable subscription per open
-- group is enough to keep every screen in sync. Only active members pass the
-- groups SELECT policy, so nobody receives events for groups they are not in.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;

alter publication supabase_realtime add table public.groups;
