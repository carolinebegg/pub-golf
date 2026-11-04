-- Read-only checks before supabase/migrations/20261021120000_courses.sql.
-- Paste this whole file into the Supabase SQL editor and run it.
-- It does not insert, update, delete, or change schema.
--
-- How to read the results:
--   problem_count = 0 means that check is clear.
--   blocks_migration = true and problem_count > 0 means the migration will
--   roll back until that data is fixed by hand.
--   Invalid Split the G rows are listed for review only. The migration leaves
--   them in place. A later edit of one of those rows must satisfy the new rule.

-- 1. Summary. One row per check.
select check_name, problem_count, blocks_migration
from (
  select
    'courses table already exists' as check_name,
    case
      when exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
          and table_name = 'courses'
      ) then 1
      else 0
    end as problem_count,
    true as blocks_migration

  union all
  select
    'duplicate team names',
    count(*)::integer,
    true
  from (
    select lower(btrim(theme))
    from public.teams
    group by lower(btrim(theme))
    having count(*) > 1
  ) as duplicate_names

  union all
  select
    'duplicate team join codes',
    count(*)::integer,
    true
  from (
    select lower(btrim(join_code))
    from public.teams
    where join_code is not null
      and btrim(join_code) <> ''
    group by lower(btrim(join_code))
    having count(*) > 1
  ) as duplicate_codes

  union all
  select
    'duplicate hole numbers',
    count(*)::integer,
    true
  from (
    select hole_number
    from public.holes
    group by hole_number
    having count(*) > 1
  ) as duplicate_holes

  union all
  select
    'scores whose hole is missing',
    count(*)::integer,
    true
  from public.scores
  where hole_id is null
    or not exists (select 1 from public.holes where holes.id = scores.hole_id)

  union all
  select
    'keg entries whose hole is missing',
    count(*)::integer,
    true
  from public.keg_stand_entries as entries
  where entries.hole_id is null
    or not exists (select 1 from public.holes where holes.id = entries.hole_id)

  union all
  select
    'pitcher finishes whose hole is missing',
    count(*)::integer,
    true
  from public.pitcher_finishes as finishes
  where finishes.hole_id is null
    or not exists (select 1 from public.holes where holes.id = finishes.hole_id)

  union all
  select
    'split the g votes whose hole is missing',
    count(*)::integer,
    true
  from public.guinness_split_votes as votes
  where votes.hole_id is null
    or not exists (select 1 from public.holes where holes.id = votes.hole_id)

  union all
  select
    'bunker entries whose hole is missing',
    count(*)::integer,
    true
  from public.bunker_hazard_entries as entries
  where entries.hole_id is null
    or not exists (select 1 from public.holes where holes.id = entries.hole_id)

  union all
  select
    'invalid split the g votes',
    count(*)::integer,
    false
  from public.guinness_split_votes as votes
  left join public.players as best_player
    on best_player.id = votes.best_voted_player_id
  left join public.players as worst_player
    on worst_player.id = votes.worst_voted_player_id
  where (votes.best_voted_player_id is null and votes.worst_voted_player_id is null)
    or (
      votes.best_voted_player_id is not null
      and votes.best_voted_player_id is not distinct from votes.worst_voted_player_id
    )
    or (votes.best_voted_player_id is not null and best_player.id is null)
    or (votes.worst_voted_player_id is not null and worst_player.id is null)
    or (votes.best_voted_player_id is not null and best_player.team_id is null)
    or (votes.worst_voted_player_id is not null and worst_player.team_id is null)
    or (
      votes.best_voted_player_id is not null
      and best_player.team_id is not distinct from votes.voting_team_id
    )
    or (
      votes.worst_voted_player_id is not null
      and worst_player.team_id is not distinct from votes.voting_team_id
    )
    or (
      votes.best_voted_team_id is not null
      and votes.best_voted_team_id is not distinct from votes.voting_team_id
    )
    or (
      votes.worst_voted_team_id is not null
      and votes.worst_voted_team_id is not distinct from votes.voting_team_id
    )
    or (
      votes.best_voted_team_id is not null
      and votes.best_voted_team_id is distinct from best_player.team_id
    )
    or (
      votes.worst_voted_team_id is not null
      and votes.worst_voted_team_id is distinct from worst_player.team_id
    )
    or (votes.best_voted_player_id is null and votes.best_voted_team_id is not null)
    or (votes.worst_voted_player_id is null and votes.worst_voted_team_id is not null)
    or not exists (select 1 from public.teams where teams.id = votes.voting_team_id)
) as checks
order by blocks_migration desc, problem_count desc, check_name;

-- 2. Duplicate team names that would stop the migration.
select lower(btrim(theme)) as team_name, count(*) as copies
from public.teams
group by lower(btrim(theme))
having count(*) > 1
order by team_name;

-- 3. Duplicate join codes that would stop the migration.
select lower(btrim(join_code)) as join_code, count(*) as copies
from public.teams
where join_code is not null
  and btrim(join_code) <> ''
group by lower(btrim(join_code))
having count(*) > 1
order by join_code;

-- 4. Duplicate hole numbers that would stop the migration.
select hole_number, count(*) as copies
from public.holes
group by hole_number
having count(*) > 1
order by hole_number;

-- 5. Rows whose hole no longer exists. Any row here stops the migration.
select 'scores' as source, scores.hole_id, scores.team_id
from public.scores
where scores.hole_id is null
  or not exists (select 1 from public.holes where holes.id = scores.hole_id)
union all
select 'keg_stand_entries', entries.hole_id, entries.team_id
from public.keg_stand_entries as entries
where entries.hole_id is null
  or not exists (select 1 from public.holes where holes.id = entries.hole_id)
union all
select 'pitcher_finishes', finishes.hole_id, finishes.team_id
from public.pitcher_finishes as finishes
where finishes.hole_id is null
  or not exists (select 1 from public.holes where holes.id = finishes.hole_id)
union all
select 'guinness_split_votes', votes.hole_id, votes.voting_team_id
from public.guinness_split_votes as votes
where votes.hole_id is null
  or not exists (select 1 from public.holes where holes.id = votes.hole_id)
union all
select 'bunker_hazard_entries', entries.hole_id, entries.team_id
from public.bunker_hazard_entries as entries
where entries.hole_id is null
  or not exists (select 1 from public.holes where holes.id = entries.hole_id)
order by source, hole_id;

-- 6. Existing Split the G votes that break the new rule.
-- These do not stop the migration and this query does not change them.
select
  votes.id,
  votes.hole_id,
  votes.voting_team_id,
  votes.best_voted_player_id,
  votes.best_voted_team_id,
  votes.worst_voted_player_id,
  votes.worst_voted_team_id,
  case
    when votes.best_voted_player_id is null and votes.worst_voted_player_id is null
      then 'both selections empty'
    when votes.best_voted_player_id is not distinct from votes.worst_voted_player_id
      then 'same player for best and worst'
    when votes.best_voted_player_id is not null and best_player.id is null
      then 'best player is missing'
    when votes.worst_voted_player_id is not null and worst_player.id is null
      then 'worst player is missing'
    when votes.best_voted_player_id is not null and best_player.team_id is null
      then 'best player has no team'
    when votes.worst_voted_player_id is not null and worst_player.team_id is null
      then 'worst player has no team'
    when not exists (select 1 from public.teams where teams.id = votes.voting_team_id)
      then 'voting team is missing'
    when best_player.team_id is not distinct from votes.voting_team_id
      then 'best player is on the voting team'
    when worst_player.team_id is not distinct from votes.voting_team_id
      then 'worst player is on the voting team'
    when votes.best_voted_team_id is not distinct from votes.voting_team_id
      then 'stored best team is the voting team'
    when votes.worst_voted_team_id is not distinct from votes.voting_team_id
      then 'stored worst team is the voting team'
    when votes.best_voted_player_id is null and votes.best_voted_team_id is not null
      then 'stored best team without a player'
    when votes.worst_voted_player_id is null and votes.worst_voted_team_id is not null
      then 'stored worst team without a player'
    when votes.best_voted_team_id is not null
      and votes.best_voted_team_id is distinct from best_player.team_id
      then 'stored best team does not match the player'
    when votes.worst_voted_team_id is not null
      and votes.worst_voted_team_id is distinct from worst_player.team_id
      then 'stored worst team does not match the player'
    else 'review'
  end as reason
from public.guinness_split_votes as votes
left join public.players as best_player
  on best_player.id = votes.best_voted_player_id
left join public.players as worst_player
  on worst_player.id = votes.worst_voted_player_id
where (votes.best_voted_player_id is null and votes.worst_voted_player_id is null)
  or (
    votes.best_voted_player_id is not null
    and votes.best_voted_player_id is not distinct from votes.worst_voted_player_id
  )
  or (votes.best_voted_player_id is not null and best_player.id is null)
  or (votes.worst_voted_player_id is not null and worst_player.id is null)
  or (votes.best_voted_player_id is not null and best_player.team_id is null)
  or (votes.worst_voted_player_id is not null and worst_player.team_id is null)
  or (
    votes.best_voted_player_id is not null
    and best_player.team_id is not distinct from votes.voting_team_id
  )
  or (
    votes.worst_voted_player_id is not null
    and worst_player.team_id is not distinct from votes.voting_team_id
  )
  or (
    votes.best_voted_team_id is not null
    and votes.best_voted_team_id is not distinct from votes.voting_team_id
  )
  or (
    votes.worst_voted_team_id is not null
    and votes.worst_voted_team_id is not distinct from votes.voting_team_id
  )
  or (
    votes.best_voted_team_id is not null
    and votes.best_voted_team_id is distinct from best_player.team_id
  )
  or (
    votes.worst_voted_team_id is not null
    and votes.worst_voted_team_id is distinct from worst_player.team_id
  )
  or (votes.best_voted_player_id is null and votes.best_voted_team_id is not null)
  or (votes.worst_voted_player_id is null and votes.worst_voted_team_id is not null)
  or not exists (select 1 from public.teams where teams.id = votes.voting_team_id)
order by votes.id;
