-- Phase 2A step 3. Row-level security for result writes.
-- Does not change the applied courses or team_access migrations.
-- The original course has no organizer. Players on it keep score access
-- through team_access. Nobody becomes its organizer here.
--
-- A course organizer can edit that course's roster and holes. An organizer
-- does not gain score access unless they also join a team. Anonymous users
-- are never treated as organizers.

create or replace function public.caller_is_anonymous()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'is_anonymous', '') = 'true'
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', '') = 'anonymous';
$$;

create or replace function public.is_course_organizer(target_course uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.courses
    where courses.id = target_course
      and courses.organizer_id = auth.uid()
  )
  and not public.caller_is_anonymous();
$$;

-- Current roster, not a stale access row. Unassigning or moving a player
-- makes this false even if a team_access row were still present.
create or replace function public.user_can_write_team(target_team uuid, target_course uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_access
    join public.players on players.id = team_access.player_id
    join public.teams on teams.id = team_access.team_id
    where team_access.user_id = auth.uid()
      and team_access.team_id = target_team
      and team_access.course_id = target_course
      and players.team_id = target_team
      and players.course_id = target_course
      and teams.id = target_team
      and teams.course_id = target_course
  );
$$;

create or replace function public.hole_belongs_to_course(target_hole uuid, target_course uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.holes
    where holes.id = target_hole
      and holes.course_id = target_course
  );
$$;

-- A null player is allowed. A named player must currently be on that team.
create or replace function public.player_belongs_to_team(
  target_player uuid,
  target_team uuid,
  target_course uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_player is null
    or exists (
      select 1
      from public.players
      where players.id = target_player
        and players.team_id = target_team
        and players.course_id = target_course
    );
$$;

create or replace function public.can_write_team_result(
  target_team uuid,
  target_course uuid,
  target_hole uuid,
  target_player uuid default null,
  target_payer uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_can_write_team(target_team, target_course)
    and public.hole_belongs_to_course(target_hole, target_course)
    and public.player_belongs_to_team(target_player, target_team, target_course)
    and public.player_belongs_to_team(target_payer, target_team, target_course);
$$;

-- Voted players may be on another team on this course. They may not be on
-- the voting team. A stored team with no player is a historical award.
create or replace function public.split_g_side_is_allowed(
  voting_team uuid,
  target_course uuid,
  voted_player uuid,
  voted_team uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when voted_player is null and voted_team is null then true
    when voted_player is not null then exists (
      select 1
      from public.players
      where players.id = voted_player
        and players.course_id = target_course
        and players.team_id is not null
        and players.team_id is distinct from voting_team
        and (voted_team is null or voted_team = players.team_id)
    )
    else exists (
      select 1
      from public.teams
      where teams.id = voted_team
        and teams.course_id = target_course
        and teams.id is distinct from voting_team
    )
  end;
$$;

create or replace function public.can_write_split_g_vote(
  voting_team uuid,
  target_course uuid,
  target_hole uuid,
  best_player uuid,
  best_team uuid,
  worst_player uuid,
  worst_team uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_can_write_team(voting_team, target_course)
    and public.hole_belongs_to_course(target_hole, target_course)
    and public.split_g_side_is_allowed(voting_team, target_course, best_player, best_team)
    and public.split_g_side_is_allowed(voting_team, target_course, worst_player, worst_team);
$$;

revoke all on function public.caller_is_anonymous() from public, anon, authenticated;
revoke all on function public.is_course_organizer(uuid) from public, anon, authenticated;
revoke all on function public.user_can_write_team(uuid, uuid) from public, anon, authenticated;
revoke all on function public.hole_belongs_to_course(uuid, uuid) from public, anon, authenticated;
revoke all on function public.player_belongs_to_team(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.can_write_team_result(uuid, uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.split_g_side_is_allowed(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.can_write_split_g_vote(uuid, uuid, uuid, uuid, uuid, uuid, uuid) from public, anon, authenticated;

grant execute on function public.caller_is_anonymous() to authenticated;
grant execute on function public.is_course_organizer(uuid) to authenticated;
grant execute on function public.user_can_write_team(uuid, uuid) to authenticated;
grant execute on function public.hole_belongs_to_course(uuid, uuid) to authenticated;
grant execute on function public.player_belongs_to_team(uuid, uuid, uuid) to authenticated;
grant execute on function public.can_write_team_result(uuid, uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.split_g_side_is_allowed(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.can_write_split_g_vote(uuid, uuid, uuid, uuid, uuid, uuid, uuid) to authenticated;

-- The vote trigger reads teams. Team rows are no longer publicly readable,
-- so the trigger must run with the owner's privileges.
alter function public.reject_own_team_split_g_vote() security definer;

-- Leaderboard directory. join_code is intentionally absent.
create or replace view public.teams_public
with (security_invoker = false) as
select
  id,
  course_id,
  theme,
  emoji,
  members,
  created_at
from public.teams;

grant select on public.teams_public to anon, authenticated;

alter table public.holes enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.scores enable row level security;
alter table public.keg_stand_entries enable row level security;
alter table public.pitcher_finishes enable row level security;
alter table public.bunker_hazard_entries enable row level security;
alter table public.guinness_split_votes enable row level security;
alter table public.player_stats enable row level security;

drop policy if exists holes_read on public.holes;
create policy holes_read
  on public.holes
  for select
  to anon, authenticated
  using (true);

drop policy if exists holes_organizer_write on public.holes;
create policy holes_organizer_write
  on public.holes
  for all
  to authenticated
  using (public.is_course_organizer(course_id))
  with check (public.is_course_organizer(course_id));

drop policy if exists players_read on public.players;
create policy players_read
  on public.players
  for select
  to anon, authenticated
  using (true);

drop policy if exists players_organizer_write on public.players;
create policy players_organizer_write
  on public.players
  for all
  to authenticated
  using (public.is_course_organizer(course_id))
  with check (public.is_course_organizer(course_id));

-- No public select on teams. That is what hides join_code.
-- Organizers of a course can still read and edit their own teams.
drop policy if exists teams_organizer_write on public.teams;
create policy teams_organizer_write
  on public.teams
  for all
  to authenticated
  using (public.is_course_organizer(course_id))
  with check (public.is_course_organizer(course_id));

drop policy if exists courses_organizer_insert on public.courses;
create policy courses_organizer_insert
  on public.courses
  for insert
  to authenticated
  with check (
    organizer_id = auth.uid()
    and not public.caller_is_anonymous()
  );

drop policy if exists courses_organizer_update on public.courses;
create policy courses_organizer_update
  on public.courses
  for update
  to authenticated
  using (public.is_course_organizer(id))
  with check (public.is_course_organizer(id));

drop policy if exists courses_organizer_delete on public.courses;
create policy courses_organizer_delete
  on public.courses
  for delete
  to authenticated
  using (public.is_course_organizer(id));

drop policy if exists scores_read on public.scores;
create policy scores_read
  on public.scores
  for select
  to anon, authenticated
  using (true);

drop policy if exists scores_team_write on public.scores;
create policy scores_team_write
  on public.scores
  for all
  to authenticated
  using (
    public.can_write_team_result(team_id, course_id, hole_id, player_id, paid_by_player_id)
  )
  with check (
    public.can_write_team_result(team_id, course_id, hole_id, player_id, paid_by_player_id)
  );

drop policy if exists keg_stand_entries_read on public.keg_stand_entries;
create policy keg_stand_entries_read
  on public.keg_stand_entries
  for select
  to anon, authenticated
  using (true);

drop policy if exists keg_stand_entries_team_write on public.keg_stand_entries;
create policy keg_stand_entries_team_write
  on public.keg_stand_entries
  for all
  to authenticated
  using (public.can_write_team_result(team_id, course_id, hole_id, player_id))
  with check (public.can_write_team_result(team_id, course_id, hole_id, player_id));

drop policy if exists pitcher_finishes_read on public.pitcher_finishes;
create policy pitcher_finishes_read
  on public.pitcher_finishes
  for select
  to anon, authenticated
  using (true);

drop policy if exists pitcher_finishes_team_write on public.pitcher_finishes;
create policy pitcher_finishes_team_write
  on public.pitcher_finishes
  for all
  to authenticated
  using (public.can_write_team_result(team_id, course_id, hole_id, null, paid_by_player_id))
  with check (public.can_write_team_result(team_id, course_id, hole_id, null, paid_by_player_id));

drop policy if exists bunker_hazard_entries_read on public.bunker_hazard_entries;
create policy bunker_hazard_entries_read
  on public.bunker_hazard_entries
  for select
  to anon, authenticated
  using (true);

drop policy if exists bunker_hazard_entries_team_write on public.bunker_hazard_entries;
create policy bunker_hazard_entries_team_write
  on public.bunker_hazard_entries
  for all
  to authenticated
  using (public.can_write_team_result(team_id, course_id, hole_id, player_id))
  with check (public.can_write_team_result(team_id, course_id, hole_id, player_id));

drop policy if exists guinness_split_votes_read on public.guinness_split_votes;
create policy guinness_split_votes_read
  on public.guinness_split_votes
  for select
  to anon, authenticated
  using (true);

drop policy if exists guinness_split_votes_team_write on public.guinness_split_votes;
create policy guinness_split_votes_team_write
  on public.guinness_split_votes
  for all
  to authenticated
  using (
    public.can_write_split_g_vote(
      voting_team_id,
      course_id,
      hole_id,
      best_voted_player_id,
      best_voted_team_id,
      worst_voted_player_id,
      worst_voted_team_id
    )
  )
  with check (
    public.can_write_split_g_vote(
      voting_team_id,
      course_id,
      hole_id,
      best_voted_player_id,
      best_voted_team_id,
      worst_voted_player_id,
      worst_voted_team_id
    )
  );

drop policy if exists player_stats_read on public.player_stats;
create policy player_stats_read
  on public.player_stats
  for select
  to anon, authenticated
  using (true);

-- Recomputes derived stats from existing rows. It does not insert scores.
-- The definer bypasses player_stats write policies so a legal score save can
-- still refresh stats. Anonymous callers cannot run it.
revoke all on function public.refresh_player_stats() from public, anon;
grant execute on function public.refresh_player_stats() to authenticated;

-- Truncates every result table. Keep it unavailable to browser roles.
revoke all on function public.reset_game_state() from public, anon, authenticated;

notify pgrst, 'reload schema';
