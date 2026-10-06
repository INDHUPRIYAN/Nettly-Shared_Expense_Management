-- =============================================================================
-- 13. Member display names (group nicknames)
--
-- A name used for a member inside one group only. It never changes the
-- person's profile. Owners/admins can rename anyone in the group; every member
-- can rename themselves. NULL means "use the profile name".
-- =============================================================================

alter table public.group_members
  add column display_name text
  check (display_name is null or char_length(btrim(display_name)) between 1 and 80);

comment on column public.group_members.display_name is 'Group-specific name for this member; NULL = use profiles.name.';

create or replace function public.set_member_display_name(p_group_id uuid, p_user_id uuid, p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if not public.is_group_member(p_group_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if p_user_id <> v_uid and not public.is_group_admin(p_group_id) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if v_name is not null and char_length(v_name) > 80 then
    raise exception 'INVALID_INPUT';
  end if;

  update public.group_members
  set display_name = v_name
  where group_id = p_group_id
    and user_id = p_user_id
    and removed_at is null;
  if not found then
    raise exception 'MEMBER_NOT_FOUND';
  end if;
  return v_name;
end;
$$;

revoke execute on function public.set_member_display_name(uuid, uuid, text) from public, anon;
grant execute on function public.set_member_display_name(uuid, uuid, text) to authenticated;
