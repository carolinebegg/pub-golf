-- Phase 2A step 1. Membership, plus foreign-key delete actions that match
-- the live database. This does not enable restrictive RLS on existing tables
-- and does not revoke current score writes.
--
-- Deleting a course cascades to its teams, players, holes, and results.
-- Deleting a team cascades to that team's results and unassigns its players.
-- Moving or unassigning a player does not delete results.
-- Deleting a player removes that person and their derived stats. Team result
-- rows stay, with the player attribution cleared. A Split the G vote keeps
-- the team stored on that vote. The vote is removed only when nothing is left.
--
-- One account may hold a player at a time. The same account can join again.
-- A different account cannot take that player. The course organizer releases
-- the link with release_player_access; that does not move the player or
-- delete any results.

alter table public.courses
  add column if not exists organizer_id uuid references auth.users (id) on delete set null;

alter table public.players
  alter column team_id drop not null;

-- Team deletion currently cascades to players. Unassign them instead.
alter table public.players drop constraint if exists players_team_id_fkey;
alter table public.players
  add constraint players_team_id_fkey
  foreign key (team_id) references public.teams (id) on delete set null;

-- These player links currently delete the team result, or block the delete.
-- Keep the result and clear the person.
-- players.team_id was NOT NULL. keg and bunker player_id are not created in
-- this repo, so drop NOT NULL before SET NULL. That changes no stored values.
-- paid_by_player_id and rule_results.player_id are already nullable.
alter table public.keg_stand_entries alter column player_id drop not null;
alter table public.keg_stand_entries drop constraint if exists keg_stand_entries_player_id_fkey;
alter table public.keg_stand_entries
  add constraint keg_stand_entries_player_id_fkey
  foreign key (player_id) references public.players (id) on delete set null;

alter table public.bunker_hazard_entries alter column player_id drop not null;
alter table public.bunker_hazard_entries drop constraint if exists bunker_hazard_entries_player_id_fkey;
alter table public.bunker_hazard_entries
  add constraint bunker_hazard_entries_player_id_fkey
  foreign key (player_id) references public.players (id) on delete set null;

alter table public.pitcher_finishes drop constraint if exists pitcher_finishes_paid_by_player_id_fkey;
alter table public.pitcher_finishes
  add constraint pitcher_finishes_paid_by_player_id_fkey
  foreign key (paid_by_player_id) references public.players (id) on delete set null;

alter table public.rule_results drop constraint if exists rule_results_player_id_fkey;
alter table public.rule_results
  add constraint rule_results_player_id_fkey
  foreign key (player_id) references public.players (id) on delete set null;

create table if not exists public.team_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists team_access_one_account_per_player
  on public.team_access (player_id);

create unique index if not exists team_access_one_team_per_account_per_course
  on public.team_access (user_id, course_id);

create or replace function public.normalized_name(value text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(btrim(coalesce(value, '')), '\s+', ' ', 'g'));
$$;

create or replace function public.team_access_matches_roster()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  roster_team uuid;
  roster_course uuid;
begin
  select players.team_id, players.course_id
    into roster_team, roster_course
  from public.players
  where players.id = new.player_id;

  if roster_team is null or roster_team is distinct from new.team_id then
    raise exception 'Team access must match the player''s current team';
  end if;

  if roster_course is null or roster_course is distinct from new.course_id then
    raise exception 'Team access must match the player''s course';
  end if;

  return new;
end;
$$;

drop trigger if exists team_access_matches_roster on public.team_access;
create trigger team_access_matches_roster
  before insert or update on public.team_access
  for each row execute function public.team_access_matches_roster();

create or replace function public.revoke_team_access_on_roster_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.team_id is distinct from old.team_id then
    delete from public.team_access
    where player_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists players_revoke_team_access on public.players;
create trigger players_revoke_team_access
  after update of team_id on public.players
  for each row execute function public.revoke_team_access_on_roster_change();

create or replace function public.join_team(
  game_code text,
  team_code text,
  player_name text
)
returns table (
  course_id uuid,
  team_id uuid,
  player_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  found_course uuid;
  found_team uuid;
  found_player uuid;
  linked_user uuid;
  account_player uuid;
  name_matches integer;
begin
  if uid is null then
    raise exception 'Sign in before joining a team';
  end if;

  if btrim(coalesce(game_code, '')) = ''
    or btrim(coalesce(team_code, '')) = ''
    or public.normalized_name(player_name) = '' then
    raise exception 'Game code, team code, and player name are required';
  end if;

  select courses.id into found_course
  from public.courses
  where lower(btrim(courses.join_code)) = lower(btrim(game_code));

  if found_course is null then
    raise exception 'No course matches that game code';
  end if;

  select teams.id into found_team
  from public.teams
  where teams.course_id = found_course
    and lower(btrim(teams.join_code)) = lower(btrim(team_code));

  if found_team is null then
    raise exception 'No team on that course matches that team code';
  end if;

  select count(*) into name_matches
  from public.players
  where players.course_id = found_course
    and players.team_id = found_team
    and public.normalized_name(players.name) = public.normalized_name(player_name);

  if name_matches = 0 then
    raise exception 'No player with that name is assigned to that team';
  end if;

  if name_matches > 1 then
    raise exception 'More than one player on that team matches that name';
  end if;

  select players.id into found_player
  from public.players
  where players.course_id = found_course
    and players.team_id = found_team
    and public.normalized_name(players.name) = public.normalized_name(player_name);

  select team_access.user_id into linked_user
  from public.team_access
  where team_access.player_id = found_player;

  if linked_user is not null and linked_user is distinct from uid then
    raise exception 'This player is already linked to another account. The course organizer must release that link first';
  end if;

  select team_access.player_id into account_player
  from public.team_access
  where team_access.user_id = uid
    and team_access.course_id = found_course;

  if account_player is not null and account_player is distinct from found_player then
    raise exception 'This account is already linked to another player on this course';
  end if;

  if linked_user is null then
    begin
      insert into public.team_access (user_id, player_id, team_id, course_id)
      values (uid, found_player, found_team, found_course);
    exception
      when unique_violation then
        if exists (
          select 1
          from public.team_access
          where team_access.player_id = found_player
            and team_access.user_id = uid
        ) then
          null;
        elsif exists (
          select 1
          from public.team_access
          where team_access.player_id = found_player
        ) then
          raise exception 'This player is already linked to another account. The course organizer must release that link first';
        else
          raise exception 'This account is already linked to another player on this course';
        end if;
    end;
  end if;

  return query
  select found_course, found_team, found_player;
end;
$$;

create or replace function public.release_player_access(target_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  player_course uuid;
begin
  if uid is null then
    raise exception 'Sign in before releasing a player link';
  end if;

  select players.course_id into player_course
  from public.players
  where players.id = target_player_id;

  if player_course is null then
    raise exception 'Player was not found';
  end if;

  if not exists (
    select 1
    from public.courses
    where courses.id = player_course
      and courses.organizer_id = uid
  ) then
    raise exception 'Only the course organizer can release a player link';
  end if;

  delete from public.team_access
  where player_id = target_player_id;
end;
$$;

-- A deleted player's vote keeps the team already stored on that side.
-- Clearing the awarded team does not write that team id back, which would
-- block deletion. A vote with no player and no team left is deleted afterward.
create or replace function public.reject_own_team_split_g_vote()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  hole_course uuid;
  voting_course uuid;
  best_player_team uuid;
  best_player_course uuid;
  worst_player_team uuid;
  worst_player_course uuid;
  stored_course uuid;
  best_player_cleared boolean := false;
  worst_player_cleared boolean := false;
  best_team_cleared boolean := false;
  worst_team_cleared boolean := false;
begin
  if tg_op = 'UPDATE' then
    best_player_cleared := old.best_voted_player_id is not null
      and new.best_voted_player_id is null
      and old.best_voted_team_id is not distinct from new.best_voted_team_id;
    worst_player_cleared := old.worst_voted_player_id is not null
      and new.worst_voted_player_id is null
      and old.worst_voted_team_id is not distinct from new.worst_voted_team_id;
    best_team_cleared := old.best_voted_team_id is not null
      and new.best_voted_team_id is null
      and old.best_voted_player_id is not distinct from new.best_voted_player_id;
    worst_team_cleared := old.worst_voted_team_id is not null
      and new.worst_voted_team_id is null
      and old.worst_voted_player_id is not distinct from new.worst_voted_player_id;
  end if;

  if new.best_voted_player_id is null
    and new.worst_voted_player_id is null
    and new.best_voted_team_id is null
    and new.worst_voted_team_id is null then
    if best_player_cleared or worst_player_cleared or best_team_cleared or worst_team_cleared then
      return new;
    end if;

    raise exception 'Split the G vote must include a best or worst player';
  end if;

  if new.best_voted_player_id is not null
    and new.best_voted_player_id is not distinct from new.worst_voted_player_id then
    raise exception 'Best and worst Split the G votes must be different players';
  end if;

  select holes.course_id into hole_course
  from public.holes
  where holes.id = new.hole_id;

  if hole_course is null then
    raise exception 'Split the G hole was not found on a course';
  end if;

  select teams.course_id into voting_course
  from public.teams
  where teams.id = new.voting_team_id;

  if voting_course is null then
    raise exception 'Split the G voting team was not found';
  end if;

  if voting_course is distinct from hole_course then
    raise exception 'Split the G voting team is not on this hole''s course';
  end if;

  if new.best_voted_player_id is not null then
    select players.team_id, players.course_id
      into best_player_team, best_player_course
    from public.players
    where players.id = new.best_voted_player_id;

    if not found or best_player_course is distinct from hole_course then
      raise exception 'Best Split the G player is not on this hole''s course';
    end if;

    if not best_team_cleared then
      if best_player_team is null then
        raise exception 'Best Split the G player is not on this hole''s course';
      end if;

      if best_player_team = new.voting_team_id then
        raise exception 'Split the G votes cannot target your own team';
      end if;

      if new.best_voted_team_id is not null then
        select teams.course_id into stored_course
        from public.teams
        where teams.id = new.best_voted_team_id;

        if stored_course is null or stored_course is distinct from hole_course then
          raise exception 'Best Split the G team is not on this hole''s course';
        end if;

        if new.best_voted_team_id = new.voting_team_id then
          raise exception 'Split the G votes cannot target your own team';
        end if;

        if new.best_voted_team_id is distinct from best_player_team then
          raise exception 'Best Split the G team does not match the selected player';
        end if;
      end if;

      new.best_voted_team_id := best_player_team;
    end if;
  elsif new.best_voted_team_id is not null then
    if tg_op <> 'UPDATE' or old.best_voted_team_id is distinct from new.best_voted_team_id then
      raise exception 'Best Split the G team was set without a player';
    end if;

    select teams.course_id into stored_course
    from public.teams
    where teams.id = new.best_voted_team_id;

    if stored_course is null or stored_course is distinct from hole_course then
      raise exception 'Best Split the G team is not on this hole''s course';
    end if;

    if new.best_voted_team_id = new.voting_team_id then
      raise exception 'Split the G votes cannot target your own team';
    end if;
  end if;

  if new.worst_voted_player_id is not null then
    select players.team_id, players.course_id
      into worst_player_team, worst_player_course
    from public.players
    where players.id = new.worst_voted_player_id;

    if not found or worst_player_course is distinct from hole_course then
      raise exception 'Worst Split the G player is not on this hole''s course';
    end if;

    if not worst_team_cleared then
      if worst_player_team is null then
        raise exception 'Worst Split the G player is not on this hole''s course';
      end if;

      if worst_player_team = new.voting_team_id then
        raise exception 'Split the G votes cannot target your own team';
      end if;

      if new.worst_voted_team_id is not null then
        select teams.course_id into stored_course
        from public.teams
        where teams.id = new.worst_voted_team_id;

        if stored_course is null or stored_course is distinct from hole_course then
          raise exception 'Worst Split the G team is not on this hole''s course';
        end if;

        if new.worst_voted_team_id = new.voting_team_id then
          raise exception 'Split the G votes cannot target your own team';
        end if;

        if new.worst_voted_team_id is distinct from worst_player_team then
          raise exception 'Worst Split the G team does not match the selected player';
        end if;
      end if;

      new.worst_voted_team_id := worst_player_team;
    end if;
  elsif new.worst_voted_team_id is not null then
    if tg_op <> 'UPDATE' or old.worst_voted_team_id is distinct from new.worst_voted_team_id then
      raise exception 'Worst Split the G team was set without a player';
    end if;

    select teams.course_id into stored_course
    from public.teams
    where teams.id = new.worst_voted_team_id;

    if stored_course is null or stored_course is distinct from hole_course then
      raise exception 'Worst Split the G team is not on this hole''s course';
    end if;

    if new.worst_voted_team_id = new.voting_team_id then
      raise exception 'Split the G votes cannot target your own team';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.delete_cleared_split_g_vote()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.best_voted_player_id is null
    and new.worst_voted_player_id is null
    and new.best_voted_team_id is null
    and new.worst_voted_team_id is null then
    delete from public.guinness_split_votes
    where id = new.id;
  end if;

  return null;
end;
$$;

drop trigger if exists guinness_split_votes_delete_cleared on public.guinness_split_votes;
create trigger guinness_split_votes_delete_cleared
  after update on public.guinness_split_votes
  for each row execute function public.delete_cleared_split_g_vote();

alter table public.team_access enable row level security;

revoke all on public.team_access from public, anon, authenticated;
revoke all on function public.normalized_name(text) from public, anon, authenticated;
revoke all on function public.join_team(text, text, text) from public, anon, authenticated;
revoke all on function public.release_player_access(uuid) from public, anon, authenticated;

grant execute on function public.join_team(text, text, text) to authenticated;
grant execute on function public.release_player_access(uuid) to authenticated;

notify pgrst, 'reload schema';
