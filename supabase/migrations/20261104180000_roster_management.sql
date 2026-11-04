-- Phase 2A step 4B.1. Organizer roster rules.
-- Does not edit earlier migrations and does not change existing rows.
-- The original course keeps organizer_id null. Nothing here claims it.
--
-- Team deletion, player moves, and player deletion already behave correctly:
-- team delete cascades that team's results, unassigns its players, removes
-- team_access, and clears the deleted team on other teams' Split the G votes.
-- Changing players.team_id revokes that player's sign-in claim and leaves
-- historical results on the team that recorded them. Deleting a player
-- removes the roster row, the sign-in claim, and player_stats, clears
-- attribution columns, and keeps a stored Split the G team when one exists.
-- An empty Split the G vote is removed by the existing follow-up trigger.
-- This file does not replace those foreign keys or triggers.
--
-- New rules: generated team join codes, one readable name per team, and a
-- player can only be assigned to a team on their own course. Anonymous
-- users and other organizers cannot manage the roster.

create or replace function public.make_team_code(target_course uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  attempt integer;
  index integer;
begin
  if target_course is null then
    raise exception 'A team must belong to a course.';
  end if;

  for attempt in 1..12 loop
    candidate := '';
    for index in 1..6 loop
      candidate := candidate || substr(
        alphabet,
        1 + floor(random() * length(alphabet))::integer,
        1
      );
    end loop;

    exit when not exists (
      select 1
      from public.teams
      where teams.course_id = target_course
        and lower(btrim(teams.join_code)) = lower(candidate)
    );
  end loop;

  if exists (
    select 1
    from public.teams
    where teams.course_id = target_course
      and lower(btrim(teams.join_code)) = lower(candidate)
  ) then
    raise exception 'Could not generate a unique team code.';
  end if;

  return candidate;
end;
$$;

create or replace function public.protect_team_roster()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text := coalesce(auth.role(), '');
begin
  if new.theme is null or btrim(new.theme) = '' then
    raise exception 'A team name is required.';
  end if;

  new.theme := regexp_replace(btrim(new.theme), '\s+', ' ', 'g');
  if char_length(new.theme) > 60 then
    raise exception 'Team name must be 60 characters or fewer.';
  end if;

  if new.emoji is not null then
    new.emoji := nullif(btrim(new.emoji), '');
    if new.emoji is not null and char_length(new.emoji) > 16 then
      raise exception 'Team emoji must be 16 characters or fewer.';
    end if;
  end if;

  if actor_role = 'anon'
    or (actor_role = 'authenticated' and public.caller_is_anonymous()) then
    raise exception 'Only the course organizer can manage teams and players.';
  end if;

  if actor_role = 'authenticated' then
    if auth.uid() is null then
      raise exception 'Only the course organizer can manage teams and players.';
    end if;

    if tg_op = 'INSERT' then
      if not public.is_course_organizer(new.course_id) then
        raise exception 'Only the course organizer can manage teams and players.';
      end if;
      new.join_code := public.make_team_code(new.course_id);
    else
      if not public.is_course_organizer(old.course_id) then
        raise exception 'Only the course organizer can manage teams and players.';
      end if;
      if new.course_id is distinct from old.course_id then
        raise exception 'A team cannot be moved to another course.';
      end if;
      new.join_code := old.join_code;
    end if;
  elsif tg_op = 'INSERT' and (new.join_code is null or btrim(new.join_code) = '') then
    new.join_code := public.make_team_code(new.course_id);
  elsif tg_op = 'UPDATE' and new.course_id is distinct from old.course_id then
    raise exception 'A team cannot be moved to another course.';
  end if;

  return new;
end;
$$;

create or replace function public.protect_player_roster()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text := coalesce(auth.role(), '');
  team_course uuid;
begin
  if new.name is null or btrim(new.name) = '' then
    raise exception 'A player name is required.';
  end if;

  new.name := regexp_replace(btrim(new.name), '\s+', ' ', 'g');
  if char_length(new.name) > 40 then
    raise exception 'Player name must be 40 characters or fewer.';
  end if;

  if new.team_id is not null then
    select teams.course_id into team_course
    from public.teams
    where teams.id = new.team_id;

    if team_course is null or team_course is distinct from new.course_id then
      raise exception 'That team is not on this player''s course.';
    end if;
  end if;

  if actor_role = 'anon'
    or (actor_role = 'authenticated' and public.caller_is_anonymous()) then
    raise exception 'Only the course organizer can manage teams and players.';
  end if;

  if actor_role = 'authenticated' then
    if auth.uid() is null then
      raise exception 'Only the course organizer can manage teams and players.';
    end if;

    if tg_op = 'INSERT' then
      if not public.is_course_organizer(new.course_id) then
        raise exception 'Only the course organizer can manage teams and players.';
      end if;
    else
      if not public.is_course_organizer(old.course_id) then
        raise exception 'Only the course organizer can manage teams and players.';
      end if;
      if new.course_id is distinct from old.course_id then
        raise exception 'A player cannot be moved to another course.';
      end if;
    end if;
  elsif tg_op = 'UPDATE' and new.course_id is distinct from old.course_id then
    raise exception 'A player cannot be moved to another course.';
  end if;

  return new;
end;
$$;

drop trigger if exists teams_protect_roster on public.teams;
create trigger teams_protect_roster
  before insert or update on public.teams
  for each row
  execute function public.protect_team_roster();

drop trigger if exists players_protect_roster on public.players;
create trigger players_protect_roster
  before insert or update on public.players
  for each row
  execute function public.protect_player_roster();

-- Join matches a name within one team. The same first name may exist on
-- another team, or more than once while unassigned.
create unique index if not exists players_one_name_per_team
  on public.players (team_id, public.normalized_name(name))
  where team_id is not null;

-- Assigned players stay readable for the leaderboard and score forms.
-- Unassigned players are visible to that course's organizer only.
drop policy if exists players_read on public.players;
create policy players_read
  on public.players
  for select
  to anon, authenticated
  using (team_id is not null);

-- Step 3 allowed organizer writes with one FOR ALL policy. Split that into
-- select, insert, update, and delete so each roster change is organizer-only.
-- Anonymous users fail is_course_organizer, and so does any other organizer.
drop policy if exists teams_organizer_write on public.teams;
drop policy if exists teams_organizer_select on public.teams;
drop policy if exists teams_organizer_insert on public.teams;
drop policy if exists teams_organizer_update on public.teams;
drop policy if exists teams_organizer_delete on public.teams;

create policy teams_organizer_select
  on public.teams
  for select
  to authenticated
  using (public.is_course_organizer(course_id));

create policy teams_organizer_insert
  on public.teams
  for insert
  to authenticated
  with check (public.is_course_organizer(course_id));

create policy teams_organizer_update
  on public.teams
  for update
  to authenticated
  using (public.is_course_organizer(course_id))
  with check (public.is_course_organizer(course_id));

create policy teams_organizer_delete
  on public.teams
  for delete
  to authenticated
  using (public.is_course_organizer(course_id));

drop policy if exists players_organizer_write on public.players;
drop policy if exists players_organizer_select on public.players;
drop policy if exists players_organizer_insert on public.players;
drop policy if exists players_organizer_update on public.players;
drop policy if exists players_organizer_delete on public.players;

create policy players_organizer_select
  on public.players
  for select
  to authenticated
  using (public.is_course_organizer(course_id));

create policy players_organizer_insert
  on public.players
  for insert
  to authenticated
  with check (public.is_course_organizer(course_id));

create policy players_organizer_update
  on public.players
  for update
  to authenticated
  using (public.is_course_organizer(course_id))
  with check (public.is_course_organizer(course_id));

create policy players_organizer_delete
  on public.players
  for delete
  to authenticated
  using (public.is_course_organizer(course_id));

-- The client role needs these privileges. Row policies still decide which rows.
revoke insert, update, delete on public.teams from anon;
revoke insert, update, delete on public.players from anon;
grant select, insert, update, delete on public.teams to authenticated;
grant select, insert, update, delete on public.players to authenticated;

-- Release already deletes the sign-in row and leaves the player in place.
-- Anonymous callers are not organizers, even if a user id matched.
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

  if public.caller_is_anonymous() then
    raise exception 'Only the course organizer can release a player link';
  end if;

  select players.course_id into player_course
  from public.players
  where players.id = target_player_id;

  if player_course is null then
    raise exception 'Player was not found';
  end if;

  if not public.is_course_organizer(player_course) then
    raise exception 'Only the course organizer can release a player link';
  end if;

  delete from public.team_access
  where player_id = target_player_id;
end;
$$;

revoke all on function public.make_team_code(uuid) from public, anon, authenticated;
revoke all on function public.protect_team_roster() from public, anon, authenticated;
revoke all on function public.protect_player_roster() from public, anon, authenticated;
grant execute on function public.protect_team_roster() to authenticated;
grant execute on function public.protect_player_roster() to authenticated;

-- The name index calls this while an organizer saves a player.
grant execute on function public.normalized_name(text) to authenticated;

revoke all on function public.release_player_access(uuid) from public, anon, authenticated;
grant execute on function public.release_player_access(uuid) to authenticated;

-- New teams can omit the legacy members list and emoji. Existing values stay.
do $$
declare
  member_type text;
  member_generated "char";
begin
  select pg_catalog.format_type(attribute.atttypid, attribute.atttypmod),
         attribute.attgenerated
    into member_type, member_generated
  from pg_catalog.pg_attribute as attribute
  where attribute.attrelid = 'public.teams'::regclass
    and attribute.attname = 'members'
    and not attribute.attisdropped;

  if member_type is not null and member_generated = '' then
    if member_type in ('text[]', 'character varying[]') then
      execute 'alter table public.teams alter column members set default ''{}''::text[]';
    elsif member_type = 'jsonb' then
      execute 'alter table public.teams alter column members set default ''[]''::jsonb';
    elsif member_type = 'json' then
      execute 'alter table public.teams alter column members set default ''[]''::json';
    end if;

    execute 'alter table public.teams alter column members drop not null';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_attribute as attribute
    where attribute.attrelid = 'public.teams'::regclass
      and attribute.attname = 'emoji'
      and not attribute.attisdropped
      and attribute.attgenerated = ''
  ) then
    execute 'alter table public.teams alter column emoji drop not null';
  end if;
end $$;

notify pgrst, 'reload schema';
