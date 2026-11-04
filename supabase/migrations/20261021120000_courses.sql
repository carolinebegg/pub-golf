-- Foundation for multiple courses. Do not run until this file is approved.
-- It does not delete scores, teams, players, or holes, and it does not drop
-- players.rank. The existing app keeps working: new columns are filled in,
-- and score writes still succeed without sending a course id.
--
-- The dummy course "Pub Golf: The SQL" uses public game code pubgolf.
-- course_secrets is created empty. Set the organizer code yourself after
-- this file is applied, and do not commit that code.

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text,
  starts_at timestamptz,
  organizer_name text,
  join_code text not null,
  team_mode text not null default 'organizer_only',
  created_at timestamptz not null default now(),
  constraint courses_team_mode_check check (team_mode = 'organizer_only')
);

create unique index if not exists courses_join_code_unique
  on public.courses (lower(btrim(join_code)));

create table if not exists public.course_secrets (
  course_id uuid primary key references public.courses (id) on delete cascade,
  organizer_code_hash text not null
);

insert into public.courses (title, join_code, team_mode)
select 'Pub Golf: The SQL', 'pubgolf', 'organizer_only'
where not exists (
  select 1 from public.courses where title = 'Pub Golf: The SQL'
);

alter table public.holes
  add column if not exists course_id uuid,
  add column if not exists primary_type text,
  add column if not exists address text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table public.teams add column if not exists course_id uuid;
alter table public.players add column if not exists course_id uuid;
alter table public.scores add column if not exists course_id uuid;
alter table public.keg_stand_entries add column if not exists course_id uuid;
alter table public.pitcher_finishes add column if not exists course_id uuid;
alter table public.guinness_split_votes add column if not exists course_id uuid;
alter table public.bunker_hazard_entries add column if not exists course_id uuid;
alter table public.player_stats add column if not exists course_id uuid;

update public.holes
set course_id = courses.id
from public.courses
where courses.title = 'Pub Golf: The SQL'
  and holes.course_id is null;

-- Hole numbers 2 and 9 are pitcher races in the original event even when
-- hole_type does not say so. That rule is copied onto the row here.
update public.holes
set primary_type = case
  when hole_number in (2, 9) or hole_type = 'pitcher' then 'pitcher_kill'
  when hole_type = 'keg_stand' then 'keg_stand'
  when has_guinness then 'split_the_g'
  when has_bunker then 'bunker'
  else 'normal'
end
where primary_type is null;

update public.teams
set course_id = courses.id
from public.courses
where courses.title = 'Pub Golf: The SQL'
  and teams.course_id is null;

update public.players as players
set course_id = teams.course_id
from public.teams as teams
where players.team_id = teams.id
  and players.course_id is null
  and teams.course_id is not null;

update public.players
set course_id = courses.id
from public.courses
where courses.title = 'Pub Golf: The SQL'
  and players.course_id is null;

update public.scores as scores
set course_id = holes.course_id
from public.holes as holes
where scores.hole_id = holes.id
  and scores.course_id is null
  and holes.course_id is not null;

update public.keg_stand_entries as entries
set course_id = holes.course_id
from public.holes as holes
where entries.hole_id = holes.id
  and entries.course_id is null
  and holes.course_id is not null;

update public.pitcher_finishes as finishes
set course_id = holes.course_id
from public.holes as holes
where finishes.hole_id = holes.id
  and finishes.course_id is null
  and holes.course_id is not null;

update public.guinness_split_votes as votes
set course_id = holes.course_id
from public.holes as holes
where votes.hole_id = holes.id
  and votes.course_id is null
  and holes.course_id is not null;

update public.bunker_hazard_entries as entries
set course_id = holes.course_id
from public.holes as holes
where entries.hole_id = holes.id
  and entries.course_id is null
  and holes.course_id is not null;

update public.player_stats as stats
set course_id = players.course_id
from public.players as players
where stats.player_id = players.id
  and stats.course_id is null
  and players.course_id is not null;

do $$
begin
  if exists (select 1 from public.holes where course_id is null or primary_type is null)
    or exists (select 1 from public.teams where course_id is null)
    or exists (select 1 from public.players where course_id is null)
    or exists (select 1 from public.scores where course_id is null)
    or exists (select 1 from public.keg_stand_entries where course_id is null)
    or exists (select 1 from public.pitcher_finishes where course_id is null)
    or exists (select 1 from public.guinness_split_votes where course_id is null)
    or exists (select 1 from public.bunker_hazard_entries where course_id is null)
  then
    raise exception 'Could not attach every existing game row to Pub Golf: The SQL';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'holes_course_id_fkey') then
    alter table public.holes
      add constraint holes_course_id_fkey
      foreign key (course_id) references public.courses (id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'holes_primary_type_check') then
    alter table public.holes
      add constraint holes_primary_type_check
      check (primary_type in ('normal', 'bunker', 'keg_stand', 'pitcher_kill', 'split_the_g'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'teams_course_id_fkey') then
    alter table public.teams
      add constraint teams_course_id_fkey
      foreign key (course_id) references public.courses (id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'players_course_id_fkey') then
    alter table public.players
      add constraint players_course_id_fkey
      foreign key (course_id) references public.courses (id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'scores_course_id_fkey') then
    alter table public.scores
      add constraint scores_course_id_fkey
      foreign key (course_id) references public.courses (id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'keg_stand_entries_course_id_fkey') then
    alter table public.keg_stand_entries
      add constraint keg_stand_entries_course_id_fkey
      foreign key (course_id) references public.courses (id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pitcher_finishes_course_id_fkey') then
    alter table public.pitcher_finishes
      add constraint pitcher_finishes_course_id_fkey
      foreign key (course_id) references public.courses (id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'guinness_split_votes_course_id_fkey') then
    alter table public.guinness_split_votes
      add constraint guinness_split_votes_course_id_fkey
      foreign key (course_id) references public.courses (id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bunker_hazard_entries_course_id_fkey') then
    alter table public.bunker_hazard_entries
      add constraint bunker_hazard_entries_course_id_fkey
      foreign key (course_id) references public.courses (id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'player_stats_course_id_fkey') then
    alter table public.player_stats
      add constraint player_stats_course_id_fkey
      foreign key (course_id) references public.courses (id) on delete cascade;
  end if;
end $$;

alter table public.holes alter column course_id set not null;
alter table public.holes alter column primary_type set not null;
alter table public.teams alter column course_id set not null;
alter table public.players alter column course_id set not null;
alter table public.scores alter column course_id set not null;
alter table public.keg_stand_entries alter column course_id set not null;
alter table public.pitcher_finishes alter column course_id set not null;
alter table public.guinness_split_votes alter column course_id set not null;
alter table public.bunker_hazard_entries alter column course_id set not null;

create table if not exists public.course_rules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  hole_id uuid references public.holes (id) on delete cascade,
  label text not null,
  instructions text,
  points integer not null,
  record_kind text not null,
  scope text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint course_rules_record_kind_check check (record_kind in ('boolean', 'count')),
  constraint course_rules_scope_check check (scope in ('team', 'player')),
  constraint course_rules_label_not_blank check (btrim(label) <> '')
);

create table if not exists public.rule_results (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.course_rules (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  hole_id uuid not null references public.holes (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  player_id uuid references public.players (id),
  count integer not null default 1,
  created_at timestamptz not null default now(),
  constraint rule_results_count_check check (count >= 0)
);

create unique index if not exists rule_results_team_once
  on public.rule_results (rule_id, hole_id, team_id)
  where player_id is null;

create unique index if not exists rule_results_player_once
  on public.rule_results (rule_id, hole_id, team_id, player_id)
  where player_id is not null;

create or replace function public.assign_course_id_from_hole()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  hole_course uuid;
begin
  if new.hole_id is null then
    return new;
  end if;

  select holes.course_id into hole_course
  from public.holes
  where holes.id = new.hole_id;

  if hole_course is null then
    raise exception 'hole % is not on a course', new.hole_id;
  end if;

  if new.course_id is null then
    new.course_id := hole_course;
  elsif new.course_id is distinct from hole_course then
    raise exception 'course_id does not match the hole';
  end if;

  return new;
end;
$$;

drop trigger if exists scores_assign_course on public.scores;
create trigger scores_assign_course
  before insert or update on public.scores
  for each row execute function public.assign_course_id_from_hole();

drop trigger if exists keg_stand_entries_assign_course on public.keg_stand_entries;
create trigger keg_stand_entries_assign_course
  before insert or update on public.keg_stand_entries
  for each row execute function public.assign_course_id_from_hole();

drop trigger if exists pitcher_finishes_assign_course on public.pitcher_finishes;
create trigger pitcher_finishes_assign_course
  before insert or update on public.pitcher_finishes
  for each row execute function public.assign_course_id_from_hole();

drop trigger if exists guinness_split_votes_assign_course on public.guinness_split_votes;
create trigger guinness_split_votes_assign_course
  before insert or update on public.guinness_split_votes
  for each row execute function public.assign_course_id_from_hole();

drop trigger if exists bunker_hazard_entries_assign_course on public.bunker_hazard_entries;
create trigger bunker_hazard_entries_assign_course
  before insert or update on public.bunker_hazard_entries
  for each row execute function public.assign_course_id_from_hole();

-- New and edited votes only. Rows already stored are left as they are.
-- supabase/preflight/phase1_courses_checks.sql lists any invalid combinations.
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
begin
  if new.best_voted_player_id is null and new.worst_voted_player_id is null then
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
    select players.team_id, teams.course_id
      into best_player_team, best_player_course
    from public.players
    left join public.teams on teams.id = players.team_id
    where players.id = new.best_voted_player_id;

    if not found or best_player_team is null or best_player_course is distinct from hole_course then
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
  elsif new.best_voted_team_id is not null then
    raise exception 'Best Split the G team was set without a player';
  end if;

  if new.worst_voted_player_id is not null then
    select players.team_id, teams.course_id
      into worst_player_team, worst_player_course
    from public.players
    left join public.teams on teams.id = players.team_id
    where players.id = new.worst_voted_player_id;

    if not found or worst_player_team is null or worst_player_course is distinct from hole_course then
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
  elsif new.worst_voted_team_id is not null then
    raise exception 'Worst Split the G team was set without a player';
  end if;

  return new;
end;
$$;

drop trigger if exists guinness_split_votes_reject_own_team on public.guinness_split_votes;
create trigger guinness_split_votes_reject_own_team
  before insert or update on public.guinness_split_votes
  for each row execute function public.reject_own_team_split_g_vote();

-- Same no-argument function the current app calls. Also records the course.
create or replace function public.refresh_player_stats()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.player_stats (
    player_id,
    course_id,
    total_drinks,
    keg_stand_length_seconds,
    holes_completed,
    bunker_hazards,
    average_sips,
    updated_at
  )
  select
    players.id,
    players.course_id,
    (coalesce(scores.total_drinks, 0) + coalesce(bunkers.bunker_hazards, 0))::integer,
    kegs.keg_stand_length_seconds,
    coalesce(scores.holes_completed, 0)::integer,
    coalesce(bunkers.bunker_hazards, 0)::integer,
    scores.average_sips,
    now()
  from public.players as players
  left join (
    select
      player_id,
      count(*)::integer as total_drinks,
      count(distinct hole_id)::integer as holes_completed,
      avg(sips)::numeric(6, 2) as average_sips
    from public.scores
    where player_id is not null
    group by player_id
  ) as scores on scores.player_id = players.id
  left join (
    select player_id, max(seconds)::numeric(6, 2) as keg_stand_length_seconds
    from public.keg_stand_entries
    group by player_id
  ) as kegs on kegs.player_id = players.id
  left join (
    select player_id, count(*)::integer as bunker_hazards
    from public.bunker_hazard_entries
    where player_id is not null
    group by player_id
  ) as bunkers on bunkers.player_id = players.id
  on conflict (player_id) do update set
    course_id = excluded.course_id,
    total_drinks = excluded.total_drinks,
    keg_stand_length_seconds = excluded.keg_stand_length_seconds,
    holes_completed = excluded.holes_completed,
    bunker_hazards = excluded.bunker_hazards,
    average_sips = excluded.average_sips,
    updated_at = excluded.updated_at;
end;
$$;

alter table public.courses enable row level security;
alter table public.course_secrets enable row level security;
alter table public.course_rules enable row level security;
alter table public.rule_results enable row level security;

drop policy if exists courses_read on public.courses;
create policy courses_read
  on public.courses
  for select
  to anon, authenticated
  using (true);

do $$
begin
  if exists (
    select 1
    from public.teams
    group by course_id, lower(btrim(theme))
    having count(*) > 1
  ) then
    raise exception 'Two teams on the same course share a name. Rename one before adding the unique name rule.';
  end if;

  if exists (
    select 1
    from public.teams
    where join_code is not null and btrim(join_code) <> ''
    group by course_id, lower(btrim(join_code))
    having count(*) > 1
  ) then
    raise exception 'Two teams on the same course share a join code.';
  end if;

  if exists (
    select 1
    from public.holes
    group by course_id, hole_number
    having count(*) > 1
  ) then
    raise exception 'Two holes on the same course share a hole number.';
  end if;
end $$;

create unique index if not exists holes_course_number_unique
  on public.holes (course_id, hole_number);

create unique index if not exists teams_course_name_unique
  on public.teams (course_id, lower(btrim(theme)));

create unique index if not exists teams_course_join_code_unique
  on public.teams (course_id, lower(btrim(join_code)))
  where join_code is not null and btrim(join_code) <> '';

grant select on public.courses to anon, authenticated;
revoke all on public.course_secrets from anon, authenticated;
revoke all on public.course_rules from anon, authenticated;
revoke all on public.rule_results from anon, authenticated;

-- The app does not call this. It wipes scores and the other result tables.
revoke all on function public.reset_game_state() from public, anon, authenticated;

-- Before another course or the organizer builder can be used, database or
-- trusted-backend checks must block cross-course writes and edits to other
-- teams. Frontend checks are not enough. This file does not add that yet.

notify pgrst, 'reload schema';
