-- Matchwerk – complete database schema for Supabase (Postgres 15+)
-- Apply with: supabase db push   (or paste into the SQL editor)

create extension if not exists pgcrypto;

-- ───────────────────────── tables ─────────────────────────
create table public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  name          text not null check (char_length(name) between 1 and 40),
  birthdate     date not null check (birthdate <= (current_date - interval '18 years')),
  gender        text not null check (gender in ('woman','man','nonbinary')),
  interested_in text not null check (interested_in in ('women','men','everyone')),
  bio           text not null default '' check (char_length(bio) <= 500),
  photos        text[] not null default '{}' check (cardinality(photos) between 0 and 6),
  prompts       jsonb not null default '[]',
  interests     text[] not null default '{}',
  intention     text not null default 'unsure',
  job           text,
  school        text,
  height_cm     int check (height_cm between 120 and 240),
  city          text,
  lat           double precision,
  lng           double precision,
  verified      boolean not null default false,  -- only set server-side (see trigger)
  first_move    text not null default 'anyone' check (first_move in ('me','them','anyone')),
  paused        boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

create table public.push_tokens (
  user_id uuid primary key references auth.users on delete cascade,
  token   text not null,
  updated_at timestamptz not null default now()
);

create table public.swipes (
  swiper uuid not null references auth.users on delete cascade,
  target uuid not null references auth.users on delete cascade,
  action text not null check (action in ('like','pass','superlike')),
  note   jsonb,
  created_at timestamptz not null default now(),
  primary key (swiper, target),
  check (swiper <> target)
);
create index swipes_target_idx on public.swipes (target) where action <> 'pass';

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users on delete cascade,
  user_b uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '48 hours',
  extended boolean not null default false,
  read_a timestamptz not null default now(),
  read_b timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);
create index matches_a_idx on public.matches (user_a);
create index matches_b_idx on public.matches (user_b);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches on delete cascade,
  sender_id uuid not null references auth.users on delete cascade,
  text text not null check (char_length(text) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_match_idx on public.messages (match_id, created_at);

create table public.blocks (
  blocker uuid not null references auth.users on delete cascade,
  blocked uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid references auth.users on delete set null,
  reported uuid references auth.users on delete set null,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open','reviewing','actioned','dismissed')),
  created_at timestamptz not null default now()
);

-- ───────────────────────── helpers ─────────────────────────
create or replace function public.km_between(lat1 float8, lng1 float8, lat2 float8, lng2 float8)
returns float8 language sql immutable as $$
  select case when lat1 is null or lat2 is null then null else
    2 * 6371 * asin(sqrt(power(sin(radians(lat2 - lat1) / 2), 2)
      + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2))) end
$$;

create or replace function public.is_blocked(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a))
$$;

create or replace function public.wants(pref text, g text)
returns boolean language sql immutable as $$
  select pref = 'everyone' or (pref = 'women' and g = 'woman') or (pref = 'men' and g = 'man')
$$;

create or replace function public.resolve_opener(mine text, theirs text)
returns text language sql immutable as $$
  select case
    when mine = 'me' and theirs <> 'me' then 'me'
    when theirs = 'me' and mine <> 'me' then 'them'
    when mine = 'them' and theirs <> 'them' then 'them'
    when theirs = 'them' and mine <> 'them' then 'me'
    else 'anyone' end
$$;

-- public profile representation (never exposes exact coordinates)
create or replace function public.profile_json(p public.profiles, my_lat float8, my_lng float8)
returns jsonb language sql stable as $$
  select (to_jsonb(p) - 'lat' - 'lng' - 'created_at' - 'updated_at')
    || jsonb_build_object('distance_km', round(coalesce(km_between(my_lat, my_lng, p.lat, p.lng), 0)::numeric))
$$;

-- users cannot self-verify; keep updated_at fresh
create or replace function public.profiles_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then new.verified := false;
  elsif current_user = 'authenticated' then new.verified := old.verified;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger profiles_guard before insert or update on public.profiles
  for each row execute function public.profiles_guard();

-- enforce membership, blocks, first-move rule and expiry on every message
create or replace function public.messages_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare m matches; other uuid; mine text; theirs text; opener text; has_msgs boolean;
begin
  select * into m from matches where id = new.match_id;
  if m is null or new.sender_id not in (m.user_a, m.user_b) then raise exception 'not a member'; end if;
  other := case when new.sender_id = m.user_a then m.user_b else m.user_a end;
  if is_blocked(new.sender_id, other) then raise exception 'blocked'; end if;
  select exists(select 1 from messages where match_id = m.id) into has_msgs;
  if not has_msgs then
    if m.expires_at < now() then raise exception 'match expired'; end if;
    select first_move into mine from profiles where id = new.sender_id;
    select first_move into theirs from profiles where id = other;
    opener := resolve_opener(mine, theirs);
    if opener = 'them' then raise exception 'your match makes the first move'; end if;
  end if;
  return new;
end $$;
create trigger messages_guard before insert on public.messages
  for each row execute function public.messages_guard();

-- ───────────────────────── RLS ─────────────────────────
alter table public.profiles enable row level security;
alter table public.push_tokens enable row level security;
alter table public.swipes enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

create policy "own profile rw" on public.profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- other profiles are read via security-definer RPCs only (deck/likes/matches)
create policy "matched profiles readable" on public.profiles for select to authenticated
  using (exists (select 1 from matches where (user_a = auth.uid() and user_b = profiles.id) or (user_b = auth.uid() and user_a = profiles.id)));

create policy "own push token" on public.push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own swipes read" on public.swipes for select to authenticated using (swiper = auth.uid());

create policy "member reads match" on public.matches for select to authenticated
  using (auth.uid() in (user_a, user_b));

create policy "member reads messages" on public.messages for select to authenticated
  using (exists (select 1 from matches m where m.id = match_id and auth.uid() in (m.user_a, m.user_b)));
create policy "member sends messages" on public.messages for insert to authenticated
  with check (sender_id = auth.uid());

create policy "own blocks" on public.blocks for select to authenticated using (blocker = auth.uid());
create policy "file report" on public.reports for insert to authenticated with check (reporter = auth.uid());

-- ───────────────────────── RPCs ─────────────────────────
create or replace function public.get_deck(min_age int, max_age int, max_km int, intentions text[], verified_only boolean, lim int default 30)
returns setof jsonb language sql stable security definer set search_path = public as $$
  with me as (select * from profiles where id = auth.uid())
  select profile_json(p, me.lat, me.lng)
  from profiles p, me
  where p.id <> me.id
    and not p.paused
    and wants(me.interested_in, p.gender) and wants(p.interested_in, me.gender)
    and extract(year from age(p.birthdate)) between min_age and max_age
    and (cardinality(intentions) = 0 or p.intention = any(intentions))
    and (not verified_only or p.verified)
    and (me.lat is null or p.lat is null or km_between(me.lat, me.lng, p.lat, p.lng) <= max_km)
    and not exists (select 1 from swipes s where s.swiper = me.id and s.target = p.id)
    and not is_blocked(me.id, p.id)
  order by
    -- people who already liked me first (higher match chance), then recently active
    exists (select 1 from swipes s where s.swiper = p.id and s.target = me.id and s.action <> 'pass') desc,
    p.verified desc,
    p.last_active_at desc
  limit lim
$$;

create or replace function public.swipe(target_id uuid, act text, note jsonb default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); mid uuid;
begin
  if me is null or target_id = me then raise exception 'invalid'; end if;
  if is_blocked(me, target_id) then return null; end if;
  insert into swipes (swiper, target, action, note) values (me, target_id, act, note)
    on conflict (swiper, target) do update set action = excluded.action, note = excluded.note, created_at = now();
  update profiles set last_active_at = now() where id = me;
  if act <> 'pass' and exists (select 1 from swipes where swiper = target_id and target = me and action <> 'pass') then
    insert into matches (user_a, user_b) values (least(me, target_id), greatest(me, target_id))
      on conflict (user_a, user_b) do nothing returning id into mid;
    if mid is null then select id into mid from matches where user_a = least(me, target_id) and user_b = greatest(me, target_id); end if;
  end if;
  return mid;
end $$;

create or replace function public.undo_swipe(target_id uuid)
returns void language sql security definer set search_path = public as $$
  delete from swipes s where s.swiper = auth.uid() and s.target = target_id
    and not exists (select 1 from matches m where m.user_a = least(auth.uid(), target_id) and m.user_b = greatest(auth.uid(), target_id))
$$;

create or replace function public.incoming_likes()
returns table (profile jsonb, action text, note jsonb, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  with me as (select * from profiles where id = auth.uid())
  select profile_json(p, me.lat, me.lng), s.action, s.note, s.created_at
  from swipes s join profiles p on p.id = s.swiper, me
  where s.target = me.id and s.action <> 'pass'
    and not exists (select 1 from swipes mine where mine.swiper = me.id and mine.target = s.swiper)
    and not is_blocked(me.id, p.id)
  order by s.created_at desc
$$;

create or replace function public.my_matches()
returns table (id uuid, profile jsonb, created_at timestamptz, expires_at timestamptz, extended boolean,
               opener text, last_message jsonb, unread bigint)
language sql stable security definer set search_path = public as $$
  with me as (select * from profiles where id = auth.uid())
  select m.id, profile_json(p, me.lat, me.lng), m.created_at, m.expires_at, m.extended,
    resolve_opener(me.first_move, p.first_move),
    (select to_jsonb(x) from messages x where x.match_id = m.id order by x.created_at desc limit 1),
    (select count(*) from messages x where x.match_id = m.id and x.sender_id <> me.id
       and x.created_at > case when m.user_a = me.id then m.read_a else m.read_b end)
  from matches m, me, profiles p
  where me.id in (m.user_a, m.user_b)
    and p.id = case when m.user_a = me.id then m.user_b else m.user_a end
    and not is_blocked(me.id, p.id)
    and (m.expires_at > now() or exists (select 1 from messages x where x.match_id = m.id))
  order by coalesce((select max(x.created_at) from messages x where x.match_id = m.id), m.created_at) desc
$$;

create or replace function public.extend_match(match_id uuid)
returns void language sql security definer set search_path = public as $$
  update matches set extended = true, expires_at = expires_at + interval '24 hours'
  where id = match_id and auth.uid() in (user_a, user_b) and not extended
$$;

create or replace function public.mark_read(match_id uuid)
returns void language sql security definer set search_path = public as $$
  update matches set
    read_a = case when user_a = auth.uid() then now() else read_a end,
    read_b = case when user_b = auth.uid() then now() else read_b end
  where id = match_id and auth.uid() in (user_a, user_b)
$$;

create or replace function public.unmatch(match_id uuid)
returns void language sql security definer set search_path = public as $$
  delete from matches where id = match_id and auth.uid() in (user_a, user_b)
$$;

create or replace function public.block_user(target_id uuid)
returns void language sql security definer set search_path = public as $$
  insert into blocks (blocker, blocked) values (auth.uid(), target_id) on conflict do nothing;
  delete from matches where user_a = least(auth.uid(), target_id) and user_b = greatest(auth.uid(), target_id);
$$;

-- App Store Guideline 5.1.1(v): in-app account deletion
create or replace function public.delete_account()
-- (the client removes the user's files via the Storage API first; direct SQL deletes on storage.objects are blocked)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  delete from auth.users where id = auth.uid();
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;

-- ───────────────────────── storage ─────────────────────────
insert into storage.buckets (id, name, public) values ('photos', 'photos', true) on conflict do nothing;
create policy "upload own photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own photos" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ───────────────────────── realtime ─────────────────────────
alter publication supabase_realtime add table public.messages, public.matches;
