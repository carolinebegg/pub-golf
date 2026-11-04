-- Phase 2A step 4B.2. Let a course organizer see which roster entries are
-- claimed, without opening team_access.
-- Does not edit earlier migrations and does not change existing rows.
-- team_access stays locked: no policies, and no select grant for anon or
-- authenticated. This function returns player ids only. It does not return
-- the account id.

create or replace function public.course_player_sign_ins(target_course uuid)
returns table (player_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select team_access.player_id
  from public.team_access
  where team_access.course_id = target_course
    and public.is_course_organizer(target_course);
$$;

revoke all on function public.course_player_sign_ins(uuid) from public, anon;
grant execute on function public.course_player_sign_ins(uuid) to authenticated;

notify pgrst, 'reload schema';
