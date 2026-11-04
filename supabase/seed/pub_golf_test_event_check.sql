-- Read-only check for the Pub Golf Test seed.
-- Run this whole file after supabase/seed/pub_golf_test_event.sql.
-- It does not insert, update, or delete anything.

select courses.title, courses.join_code
from public.courses
where courses.title = 'Pub Golf Test'
  and lower(btrim(courses.join_code)) = 'wx5ff7';

select
  teams.theme,
  teams.join_code,
  players.name as player_name
from public.courses
join public.teams on teams.course_id = courses.id
left join public.players on players.team_id = teams.id
where courses.title = 'Pub Golf Test'
  and lower(btrim(courses.join_code)) = 'wx5ff7'
order by
  case teams.theme
    when 'Red' then 1
    when 'Pink' then 2
    when 'Orange' then 3
    when 'Yellow' then 4
    when 'Green' then 5
    when 'Blue' then 6
    when 'Purple' then 7
    when 'Black' then 8
    else 9
  end,
  players.name;

select
  holes.hole_number,
  holes.bar_name,
  holes.address,
  holes.score_type,
  holes.hole_type,
  holes.primary_type
from public.courses
join public.holes on holes.course_id = courses.id
where courses.title = 'Pub Golf Test'
  and lower(btrim(courses.join_code)) = 'wx5ff7'
order by holes.hole_number;
