-- Run this whole script in the Supabase SQL editor after applying
-- 20261104180000_roster_management.sql.
--
-- It starts a transaction and ends with rollback. Run it as one script.
-- Do not run a statement from the middle. A passed run rolls back. A failed
-- check aborts the transaction, so those rows are not kept either.
--
-- The script borrows Pub Golf Test and its organizer. It does not claim
-- Pub Golf: The SQL, and it does not delete that course's teams or players.

begin;

do $$
declare
  test_course uuid;
  organizer_id uuid;
  game_code text;
  original_course uuid;
  original_team uuid;
  original_player uuid;
  original_team_count integer;
  original_player_count integer;
  original_score_count integer;
  other_organizer uuid;
  other_course uuid;
  unassigned_player uuid;
  team_a uuid;
  team_b uuid;
  team_c uuid;
  code_a text;
  code_b text;
  renamed_code text;
  player_a uuid;
  player_b uuid;
  player_c uuid;
  test_hole_id uuid;
  auth_player uuid;
  score_id uuid;
  vote_id uuid;
  kept_team uuid;
  kept_player uuid;
  access_count integer;
  changed_rows integer;
  visible_codes integer;
  visible_directory integer;
begin
  select courses.id, courses.organizer_id, courses.join_code
    into test_course, organizer_id, game_code
  from public.courses
  where courses.title = 'Pub Golf Test'
    and courses.organizer_id is not null
  order by courses.created_at
  limit 1;

  select courses.id into original_course
  from public.courses
  where courses.title = 'Pub Golf: The SQL'
    and courses.organizer_id is null;

  if test_course is null or organizer_id is null or original_course is null then
    raise exception 'Pub Golf Test needs an organizer, and Pub Golf: The SQL must stay unclaimed.';
  end if;

  select count(*) into original_team_count from public.teams where course_id = original_course;
  select count(*) into original_player_count from public.players where course_id = original_course;
  select count(*) into original_score_count from public.scores where course_id = original_course;

  select teams.id into original_team
  from public.teams
  where teams.course_id = original_course
  order by teams.created_at
  limit 1;

  select players.id into original_player
  from public.players
  where players.team_id = original_team
  limit 1;

  if original_team is null or original_player is null then
    raise exception 'The original course needs a team and a player for the permission check.';
  end if;

  select users.id into other_organizer
  from auth.users as users
  where users.id <> organizer_id
  limit 1;

  if other_organizer is not null then
    insert into public.courses (title, join_code, team_mode, organizer_id)
    values ('Roster Check Other', 'rostercheck4b1', 'organizer_only', other_organizer)
    returning id into other_course;
  else
    other_organizer := '00000000-0000-0000-0000-000000000099';
    other_course := original_course;
  end if;

  insert into public.holes (
    course_id, hole_number, bar_name, start_time, rule_text,
    score_type, hole_type, primary_type, has_bunker, has_water, has_guinness
  ) values (
    test_course, 91, 'Roster Check', '12:00', 'Check',
    'sips', 'standard', 'normal', false, false, false
  ) returning id into test_hole_id;

  insert into public.teams (course_id, theme)
  values (test_course, 'Roster A')
  returning id, join_code into team_a, code_a;

  insert into public.teams (course_id, theme)
  values (test_course, 'Roster B')
  returning id, join_code into team_b, code_b;

  insert into public.teams (course_id, theme)
  values (test_course, 'Roster C')
  returning id into team_c;

  if code_a is null or code_b is null or code_a = code_b then
    raise exception 'Team codes were not generated.';
  end if;

  update public.teams set theme = 'Roster A Renamed' where id = team_a returning join_code into renamed_code;
  if renamed_code is distinct from code_a then
    raise exception 'Renaming a team changed its join code.';
  end if;

  begin
    insert into public.teams (course_id, theme) values (test_course, 'roster a renamed');
    raise exception 'A duplicate team name was allowed.';
  exception
    when unique_violation then
      null;
  end;

  insert into public.players (course_id, name)
  values (test_course, 'Unassigned')
  returning id into unassigned_player;

  insert into public.players (course_id, name) values (test_course, ' Pat ') returning id into player_a;
  insert into public.players (course_id, name) values (test_course, 'Pat') returning id into player_b;
  if (select name from public.players where id = player_a) <> 'Pat' then
    raise exception 'Player names were not trimmed.';
  end if;

  update public.players set team_id = team_a where id = player_a;
  begin
    update public.players set team_id = team_a where id = player_b;
    raise exception 'Two players with the same name joined one team.';
  exception
    when unique_violation then
      null;
  end;

  update public.players set team_id = team_b where id = player_b;

  begin
    update public.players set team_id = original_team where id = player_a;
    raise exception 'A player was assigned to a team on another course.';
  exception
    when others then
      if sqlerrm not like '%not on this player%' then
        raise;
      end if;
  end;

  insert into public.team_access (user_id, player_id, team_id, course_id)
  values (organizer_id, player_a, team_a, test_course);

  update public.players set team_id = team_b where id = player_b;
  update public.players set team_id = team_c where id = player_a;
  select count(*) into access_count from public.team_access where player_id = player_a;
  if access_count <> 0 then
    raise exception 'Moving a player left the old sign-in claim in place.';
  end if;

  update public.players set team_id = null where id = player_a;
  if not exists (select 1 from public.players where id = player_a and team_id is null and course_id = test_course) then
    raise exception 'Unassigning a player removed them from the course.';
  end if;

  update public.players set team_id = team_a where id = player_a;
  insert into public.players (course_id, team_id, name)
  values (test_course, team_c, 'Pat')
  returning id into player_c;

  insert into public.scores (
    team_id, hole_id, drink_name, sips, player_id, is_guinness,
    water_violated, spilled_drink, threw_up, photobooth_missing,
    split_g_bonus, bonus_penalty
  ) values (
    team_a, test_hole_id, 'water', 1, player_a, false,
    false, false, false, false,
    0, 0
  ) returning id into score_id;

  insert into public.guinness_split_votes (
    hole_id, voting_team_id, best_voted_player_id, worst_voted_player_id
  ) values (
    test_hole_id, team_b, player_a, player_c
  ) returning id into vote_id;

  delete from public.players where id = player_a;
  if exists (select 1 from public.players where id = player_a) then
    raise exception 'The deleted player is still on the roster.';
  end if;
  if not exists (select 1 from public.scores where id = score_id and player_id is null and team_id = team_a) then
    raise exception 'Deleting a player removed the historical score.';
  end if;
  if not exists (
    select 1 from public.guinness_split_votes
    where id = vote_id
      and best_voted_player_id is null
      and best_voted_team_id = team_a
      and worst_voted_player_id = player_c
  ) then
    raise exception 'Deleting a player removed the stored Split the G team.';
  end if;

  delete from public.teams where id = team_a;
  if exists (select 1 from public.scores where id = score_id) then
    raise exception 'Deleting a team left its score in place.';
  end if;
  if not exists (
    select 1
    from public.guinness_split_votes
    where id = vote_id
      and best_voted_team_id is null
      and worst_voted_player_id = player_c
  ) then
    raise exception 'Deleting a team removed another team''s Split the G vote.';
  end if;

  insert into public.players (course_id, team_id, name)
  values (test_course, team_b, 'Riley')
  returning id into kept_player;

  insert into public.team_access (user_id, player_id, team_id, course_id)
  values (organizer_id, kept_player, team_b, test_course);

  perform set_config('request.jwt.claim.sub', organizer_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', organizer_id, 'role', 'authenticated', 'is_anonymous', false)::text,
    true
  );
  execute 'set local role authenticated';

  perform public.release_player_access(kept_player);

  execute 'reset role';
  select count(*) into access_count from public.team_access where player_id = kept_player;
  if access_count <> 0 then
    raise exception 'The organizer could not release the sign-in claim.';
  end if;
  if not exists (select 1 from public.players where id = kept_player and team_id = team_b) then
    raise exception 'Releasing a sign-in claim removed the player.';
  end if;

  perform set_config('request.jwt.claim.sub', organizer_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', organizer_id, 'role', 'authenticated', 'is_anonymous', false)::text,
    true
  );
  execute 'set local role authenticated';

  insert into public.teams (course_id, theme, join_code)
  values (test_course, 'Organizer Team', 'pubgolf')
  returning id, join_code into kept_team, code_a;

  if code_a is null or lower(code_a) = 'pubgolf' then
    raise exception 'The organizer was able to choose the team join code.';
  end if;

  update public.teams
  set theme = 'Organizer Team Renamed'
  where id = kept_team
  returning join_code into renamed_code;
  if renamed_code is distinct from code_a then
    raise exception 'Renaming a team changed its join code.';
  end if;

  if not exists (select 1 from public.players where id = unassigned_player) then
    raise exception 'The organizer could not see an unassigned player.';
  end if;

  insert into public.players (course_id, name)
  values (test_course, 'Casey')
  returning id into auth_player;

  update public.players set team_id = team_b where id = auth_player;
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'The organizer could not assign a player.';
  end if;

  update public.players set team_id = team_c where id = auth_player;
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1
    or (select players.team_id from public.players where players.id = auth_player) is distinct from team_c then
    raise exception 'The organizer could not move a player.';
  end if;

  update public.players set team_id = null where id = auth_player;
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1
    or exists (select 1 from public.players where id = auth_player and team_id is not null) then
    raise exception 'The organizer could not unassign a player.';
  end if;

  delete from public.players where id = auth_player;
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 or exists (select 1 from public.players where id = auth_player) then
    raise exception 'The organizer could not delete a player.';
  end if;

  select join_code into renamed_code from public.teams where id = kept_team;
  if renamed_code is null then
    raise exception 'The organizer could not read the new team join code.';
  end if;

  delete from public.teams where id = kept_team;
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 or exists (select 1 from public.teams where id = kept_team) then
    raise exception 'The organizer could not delete a team.';
  end if;

  select count(*) into visible_codes
  from public.teams
  where course_id = original_course
    and join_code is not null;
  if visible_codes <> 0 then
    raise exception 'The organizer could read join codes for another course.';
  end if;

  update public.teams set theme = theme where id = original_team;
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'The organizer updated a team on another course.';
  end if;

  update public.players set name = name where id = original_player;
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'The organizer updated a player on another course.';
  end if;

  begin
    insert into public.teams (course_id, theme) values (other_course, 'Not Mine');
    raise exception 'The organizer created a team on another course.';
  exception
    when others then
      if sqlerrm not like '%Only the course organizer%' and sqlstate <> '42501' then
        raise;
      end if;
  end;

  begin
    insert into public.players (course_id, name) values (original_course, 'Nope');
    raise exception 'The organizer added a player to another course.';
  exception
    when others then
      if sqlerrm not like '%Only the course organizer%' and sqlstate <> '42501' then
        raise;
      end if;
  end;

  delete from public.teams where id = original_team;
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'The organizer deleted a team on another course.';
  end if;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', other_organizer, 'role', 'authenticated', 'is_anonymous', true)::text,
    true
  );
  perform set_config('request.jwt.claim.sub', other_organizer::text, true);

  begin
    insert into public.teams (course_id, theme) values (test_course, 'Anonymous Team');
    raise exception 'An anonymous player created a team.';
  exception
    when others then
      if sqlerrm not like '%Only the course organizer%' and sqlstate <> '42501' then
        raise;
      end if;
  end;

  begin
    insert into public.players (course_id, name) values (test_course, 'Anonymous Player');
    raise exception 'An anonymous player added a roster entry.';
  exception
    when others then
      if sqlerrm not like '%Only the course organizer%' and sqlstate <> '42501' then
        raise;
      end if;
  end;

  update public.players set name = 'Changed' where id = player_b;
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0
    or (select players.name from public.players where players.id = player_b) is distinct from 'Pat' then
    raise exception 'An anonymous player renamed a roster entry.';
  end if;

  delete from public.teams where id = team_b;
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'An anonymous player deleted a team.';
  end if;

  begin
    perform public.release_player_access(kept_player);
    raise exception 'An anonymous player released a sign-in claim.';
  exception
    when others then
      if sqlerrm not like '%Only the course organizer%' then
        raise;
      end if;
  end;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', other_organizer, 'role', 'authenticated', 'is_anonymous', false)::text,
    true
  );

  update public.players set team_id = team_c where id = kept_player;
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0
    or (select players.team_id from public.players where players.id = kept_player) is distinct from team_b then
    raise exception 'Another organizer moved a player.';
  end if;

  execute 'set local role anon';
  select count(*) into visible_codes from public.teams;
  select count(*) into visible_directory from public.teams_public;
  if visible_codes <> 0 or visible_directory = 0 then
    raise exception 'Team visibility changed for anonymous visitors.';
  end if;
  if exists (select 1 from public.players where id = unassigned_player) then
    raise exception 'An anonymous visitor could see an unassigned player.';
  end if;
  if not exists (select 1 from public.players where id = player_b) then
    raise exception 'An assigned player was hidden from the game.';
  end if;

  execute 'reset role';

  select count(*) into changed_rows from public.teams where course_id = original_course;
  if changed_rows <> original_team_count then
    raise exception 'The original course teams changed.';
  end if;

  select count(*) into changed_rows from public.players where course_id = original_course;
  if changed_rows <> original_player_count then
    raise exception 'The original course players changed.';
  end if;

  select count(*) into changed_rows from public.scores where course_id = original_course;
  if changed_rows <> original_score_count then
    raise exception 'The original course scores changed.';
  end if;

  if exists (
    select 1
    from public.courses as courses
    where courses.id = original_course
      and courses.organizer_id is not null
  ) then
    raise exception 'The original course was claimed.';
  end if;

  perform set_config('request.jwt.claim.sub', organizer_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', organizer_id, 'role', 'authenticated', 'is_anonymous', false)::text,
    true
  );

  if not exists (
    select 1
    from public.join_team(game_code, code_b, 'Pat') as joined
    where joined.player_id = player_b
      and joined.team_id = team_b
      and joined.course_id = test_course
  ) then
    raise exception 'An existing player could not join with the game code and team code.';
  end if;
  if not exists (
    select 1
    from public.team_access
    where player_id = player_b
      and team_id = team_b
      and user_id = organizer_id
  ) then
    raise exception 'An existing player could not join with the game code and team code.';
  end if;

  execute 'set local role authenticated';

  insert into public.scores (
    team_id, hole_id, drink_name, sips, player_id, is_guinness,
    water_violated, spilled_drink, threw_up, photobooth_missing,
    split_g_bonus, bonus_penalty
  ) values (
    team_b, test_hole_id, 'water', 1, player_b, false,
    false, false, false, false,
    0, 0
  );

  update public.scores
  set sips = 2
  where scores.team_id = team_b
    and scores.hole_id = test_hole_id;
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'A joined player could not update their team score.';
  end if;

  perform set_config('request.jwt.claim.sub', other_organizer::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', other_organizer, 'role', 'authenticated', 'is_anonymous', false)::text,
    true
  );

  update public.scores
  set sips = 9
  where scores.team_id = team_b
    and scores.hole_id = test_hole_id;
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'Another account updated this team score.';
  end if;
end $$;

rollback;
