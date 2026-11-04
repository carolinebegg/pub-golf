-- Let each course number its holes from 1.
-- Does not edit earlier migrations and does not change existing hole rows.
-- The courses migration already added holes_course_number_unique on
-- (course_id, hole_number). The original table still has
-- holes_hole_number_key on hole_number alone, which blocks a second course
-- from having hole 1.

do $$
begin
  if exists (
    select 1
    from public.holes
    where holes.course_id is null
  ) then
    raise exception 'A hole has no course. Nothing was changed.';
  end if;

  if exists (
    select 1
    from public.holes
    group by holes.course_id, holes.hole_number
    having count(*) > 1
  ) then
    raise exception 'Two holes on the same course share a hole number. Nothing was changed.';
  end if;
end $$;

alter table public.holes drop constraint if exists holes_hole_number_key;

drop index if exists public.holes_hole_number_key;

create unique index if not exists holes_course_number_unique
  on public.holes (course_id, hole_number);
