-- Add optional payment details to pitcher_finishes (who paid, price in USD).
-- Run this migration so the schema cache includes these columns.

alter table public.pitcher_finishes
  add column if not exists paid_by_player_id uuid references public.players(id);

alter table public.pitcher_finishes
  add column if not exists price numeric(10, 2);
