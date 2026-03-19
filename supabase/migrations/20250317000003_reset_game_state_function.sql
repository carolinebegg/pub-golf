-- Utility to clear all game-state tables and refresh player_stats.
-- Call via supabase.rpc('reset_game_state') when starting a new game.

create or replace function public.reset_game_state()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Clear game-state tables (must match actual table names in your schema)
  truncate table
    public.bunker_hazard_entries,
    public.guinness_split_votes,
    public.scores,
    public.keg_stand_entries,
    public.pitcher_finishes
  restart identity cascade;

  -- Rebuild derived stats after reset
  perform public.refresh_player_stats();
end;
$$;

comment on function public.reset_game_state()
is 'Clears all game-state tables (bunker hazards, guinness split votes, scores, keg stands, pitcher finishes) and refreshes player_stats.';
