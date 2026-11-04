-- Phase 2A step 4A. Secure course creation for non-anonymous organizers.
-- Does not edit earlier migrations and does not change existing rows.
-- The original course keeps organizer_id null. Nothing here claims it.
--
-- Authenticated inserts have organizer_id forced to auth.uid() and receive
-- a generated game code. Anonymous users are rejected. Authenticated users
-- cannot change organizer_id, so they cannot take or give away a course.
-- The SQL editor and service role can still set organizer_id directly.

create or replace function public.make_game_code()
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
      from public.courses
      where lower(btrim(courses.join_code)) = lower(candidate)
    );
  end loop;

  if exists (
    select 1
    from public.courses
    where lower(btrim(courses.join_code)) = lower(candidate)
  ) then
    raise exception 'Could not generate a unique game code.';
  end if;

  return candidate;
end;
$$;

create or replace function public.protect_course_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text := coalesce(auth.role(), '');
  first_name text;
begin
  if new.title is null or btrim(new.title) = '' then
    raise exception 'A course name is required.';
  end if;

  new.title := regexp_replace(btrim(new.title), '\s+', ' ', 'g');
  if char_length(new.title) > 80 then
    raise exception 'Course name must be 80 characters or fewer.';
  end if;

  if actor_role = 'anon' or (actor_role = 'authenticated' and public.caller_is_anonymous()) then
    raise exception 'Sign in with an organizer account before creating a course.';
  end if;

  if actor_role = 'authenticated' then
    if auth.uid() is null then
      raise exception 'Sign in with an organizer account before creating a course.';
    end if;

    if tg_op = 'INSERT' then
      new.organizer_id := auth.uid();
      new.join_code := public.make_game_code();
      first_name := nullif(btrim(coalesce(
        auth.jwt() -> 'user_metadata' ->> 'first_name',
        auth.jwt() -> 'user_metadata' ->> 'display_name',
        ''
      )), '');
      new.organizer_name := first_name;
    elsif new.organizer_id is distinct from old.organizer_id then
      raise exception 'Course ownership cannot be changed.';
    elsif new.join_code is null or btrim(new.join_code) = '' then
      new.join_code := old.join_code;
    end if;
  elsif tg_op = 'INSERT' and (new.join_code is null or btrim(new.join_code) = '') then
    new.join_code := public.make_game_code();
  end if;

  return new;
end;
$$;

drop trigger if exists courses_protect_owner on public.courses;
create trigger courses_protect_owner
  before insert or update on public.courses
  for each row
  execute function public.protect_course_owner();

revoke all on function public.make_game_code() from public, anon, authenticated;
revoke all on function public.protect_course_owner() from public, anon, authenticated;
grant execute on function public.protect_course_owner() to authenticated;

revoke insert, update, delete on public.courses from anon;
grant insert, update, delete on public.courses to authenticated;

notify pgrst, 'reload schema';
