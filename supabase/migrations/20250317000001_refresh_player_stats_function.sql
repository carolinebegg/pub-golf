-- Refreshes public.player_stats from scores, keg_stand_entries, and bunker_hazard_entries.
-- total_drinks = standard drinks (scores where player had the drink) + bunker hazards count.
-- Call via supabase.rpc('refresh_player_stats') after any mutation that affects those tables.

create or replace function public.refresh_player_stats()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.player_stats (
    player_id,
    total_drinks,
    keg_stand_length_seconds,
    holes_completed,
    bunker_hazards,
    average_sips,
    updated_at
  )
  select
    p.id as player_id,
    (coalesce(s.total_drinks, 0) + coalesce(b.bunker_hazards, 0))::integer as total_drinks,
    k.keg_stand_length_seconds,
    coalesce(s.holes_completed, 0)::integer as holes_completed,
    coalesce(b.bunker_hazards, 0)::integer as bunker_hazards,
    s.average_sips,
    now() as updated_at
  from public.players p
  left join (
    select
      sc.player_id,
      count(*)::integer as total_drinks,
      count(distinct sc.hole_id)::integer as holes_completed,
      avg(sc.sips)::numeric(6,2) as average_sips
    from public.scores sc
    where sc.player_id is not null
    group by sc.player_id
  ) s on s.player_id = p.id
  left join (
    select
      kse.player_id,
      max(kse.seconds)::numeric(6,2) as keg_stand_length_seconds
    from public.keg_stand_entries kse
    group by kse.player_id
  ) k on k.player_id = p.id
  left join (
    select
      bhe.player_id,
      count(*)::integer as bunker_hazards
    from public.bunker_hazard_entries bhe
    where bhe.player_id is not null
    group by bhe.player_id
  ) b on b.player_id = p.id
  on conflict (player_id) do update set
    total_drinks = excluded.total_drinks,
    keg_stand_length_seconds = excluded.keg_stand_length_seconds,
    holes_completed = excluded.holes_completed,
    bunker_hazards = excluded.bunker_hazards,
    average_sips = excluded.average_sips,
    updated_at = excluded.updated_at;
end;
$$;

comment on function public.refresh_player_stats() is 'Recomputes player_stats from scores, keg_stand_entries, and bunker_hazard_entries. Call after mutations that affect those tables.';
