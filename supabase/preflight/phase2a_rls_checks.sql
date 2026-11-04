-- Run this whole script in the Supabase SQL editor after applying
-- 20261104140000_result_rls.sql.
--
-- The script starts a transaction and ends with rollback. Run it as one
-- script. Do not run an individual statement from the middle.
-- If a check fails, the error aborts the transaction, so the test update
-- is not kept. A passed run rolls back too.

begin;

create temp table rls_probe (
  user_id uuid,
  team_id uuid,
  other_team_id uuid,
  course_id uuid
);

insert into rls_probe (user_id, team_id, other_team_id, course_id)
select
  access.user_id,
  access.team_id,
  other_team.id,
  access.course_id
from public.team_access as access
join public.scores on scores.team_id = access.team_id
join public.teams as other_team
  on other_team.course_id = access.course_id
 and other_team.id <> access.team_id
order by access.created_at
limit 1;

grant select on rls_probe to authenticated;

do $$
begin
  if not exists (select 1 from rls_probe) then
    raise exception 'Join a team that already has a score, then run this check again.';
  end if;
end $$;

select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from rls_probe),
  true
);

select set_config(
  'request.jwt.claims',
  (
    select json_build_object(
      'sub', user_id,
      'role', 'authenticated',
      'is_anonymous', true
    )::text
    from rls_probe
  ),
  true
);

set local role authenticated;

do $$
declare
  visible_team_rows integer;
  visible_directory integer;
  visible_courses integer;
  changed_courses integer;
  own_scores integer;
  other_scores integer;
  probe rls_probe%rowtype;
begin
  select * into probe from rls_probe;

  select count(*) into visible_team_rows from public.teams;
  if visible_team_rows <> 0 then
    raise exception 'Team rows, including join codes, are still readable (% rows).', visible_team_rows;
  end if;

  select count(*) into visible_directory from public.teams_public;
  if visible_directory = 0 then
    raise exception 'The public team directory returned no teams.';
  end if;

  select count(*) into visible_courses from public.courses;
  if visible_courses = 0 then
    raise exception 'Courses are no longer readable.';
  end if;

  update public.courses
  set title = title
  where id = probe.course_id;
  get diagnostics changed_courses = row_count;
  if changed_courses <> 0 then
    raise exception 'An anonymous player was able to update a course.';
  end if;

  update public.scores
  set sips = sips
  where team_id = probe.other_team_id;
  get diagnostics other_scores = row_count;
  if other_scores <> 0 then
    raise exception 'Scores for another team were writable.';
  end if;

  update public.scores
  set sips = sips
  where team_id = probe.team_id;
  get diagnostics own_scores = row_count;
  if own_scores = 0 then
    raise exception 'The linked player could not update their own team scores.';
  end if;

  begin
    insert into public.scores (team_id, hole_id, course_id, sips)
    select probe.other_team_id, scores.hole_id, probe.course_id, 1
    from public.scores
    where scores.team_id = probe.team_id
    limit 1;
    raise exception 'A score for another team was inserted.';
  exception
    when insufficient_privilege then
      null;
  end;
end $$;

rollback;
