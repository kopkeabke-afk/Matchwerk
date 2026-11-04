-- ============================================================
-- Matchwerk – komplettes Datenbank-Setup für Supabase
-- Einmal komplett in Supabase → SQL Editor einfügen und auf RUN klicken.
-- Enthält: 0001_init.sql 0002_safety.sql 0003_premium.sql 0004_storage_own_files.sql 0005_tiers.sql 
-- ============================================================

-- >>> supabase/migrations/0001_init.sql
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

-- >>> supabase/migrations/0002_safety.sql
-- Matchwerk – safety & anti-abuse layer

-- ───────── auto-hide profiles that several people reported ─────────
alter table public.profiles add column if not exists hidden boolean not null default false;

create or replace function public.profiles_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.verified := false;
    new.hidden := false;
  elsif current_user = 'authenticated' then
    new.verified := old.verified;
    new.hidden := old.hidden;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- one report per person and target is enough
create unique index if not exists reports_once on public.reports (reporter, reported);

create or replace function public.reports_after_insert() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(distinct reporter) from reports where reported = new.reported and status in ('open','reviewing')) >= 3 then
    update profiles set hidden = true where id = new.reported;
  end if;
  return new;
end $$;
drop trigger if exists reports_after_insert on public.reports;
create trigger reports_after_insert after insert on public.reports
  for each row execute function public.reports_after_insert();

-- ───────── rate limits ─────────
create or replace function public.messages_rate_limit() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from messages where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Zu viele Nachrichten – bitte kurz warten.';
  end if;
  update profiles set last_active_at = now() where id = new.sender_id;
  return new;
end $$;
drop trigger if exists messages_rate_limit on public.messages;
create trigger messages_rate_limit before insert on public.messages
  for each row execute function public.messages_rate_limit();

create or replace function public.swipe(target_id uuid, act text, note jsonb default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); mid uuid;
begin
  if me is null or target_id = me then raise exception 'invalid'; end if;
  if is_blocked(me, target_id) then return null; end if;
  if (select count(*) from swipes where swiper = me and created_at > now() - interval '24 hours') >= 500 then
    raise exception 'Tageslimit erreicht – morgen geht es weiter.';
  end if;
  if act = 'superlike' and (select count(*) from swipes where swiper = me and action = 'superlike' and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'Du hast heute schon 5 Super-Likes vergeben.';
  end if;
  if note is not null and char_length(coalesce(note->>'comment', '')) > 200 then
    raise exception 'Kommentar zu lang';
  end if;
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

-- ───────── hidden profiles disappear from discovery & likes ─────────
create or replace function public.get_deck(min_age int, max_age int, max_km int, intentions text[], verified_only boolean, lim int default 30)
returns setof jsonb language sql stable security definer set search_path = public as $$
  with me as (select * from profiles where id = auth.uid())
  select profile_json(p, me.lat, me.lng) - 'hidden'
  from profiles p, me
  where p.id <> me.id
    and not p.paused and not p.hidden and not me.hidden
    and wants(me.interested_in, p.gender) and wants(p.interested_in, me.gender)
    and extract(year from age(p.birthdate)) between min_age and max_age
    and (cardinality(intentions) = 0 or p.intention = any(intentions))
    and (not verified_only or p.verified)
    and (me.lat is null or p.lat is null or km_between(me.lat, me.lng, p.lat, p.lng) <= max_km)
    and not exists (select 1 from swipes s where s.swiper = me.id and s.target = p.id)
    and not is_blocked(me.id, p.id)
  order by
    exists (select 1 from swipes s where s.swiper = p.id and s.target = me.id and s.action <> 'pass') desc,
    p.verified desc,
    p.last_active_at desc
  limit lim
$$;

create or replace function public.incoming_likes()
returns table (profile jsonb, action text, note jsonb, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  with me as (select * from profiles where id = auth.uid())
  select profile_json(p, me.lat, me.lng) - 'hidden', s.action, s.note, s.created_at
  from swipes s join profiles p on p.id = s.swiper, me
  where s.target = me.id and s.action <> 'pass' and not p.hidden
    and not exists (select 1 from swipes mine where mine.swiper = me.id and mine.target = s.swiper)
    and not is_blocked(me.id, p.id)
  order by s.created_at desc
$$;

-- ───────── moderation queue (service role / dashboard only) ─────────
create or replace view public.moderation_queue with (security_invoker = true) as
  select r.reported as user_id, p.name, p.photos[1] as photo, p.hidden, p.verified,
         count(*) as reports, array_agg(distinct r.reason) as reasons,
         min(r.created_at) as first_report, max(r.created_at) as last_report
  from reports r left join profiles p on p.id = r.reported
  where r.status in ('open','reviewing')
  group by r.reported, p.name, p.photos, p.hidden, p.verified
  order by count(*) desc, min(r.created_at);
revoke all on public.moderation_queue from anon, authenticated;

-- helper for moderators: resolve all open reports for a user
create or replace function public.moderate(target uuid, decision text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if decision = 'ban' then
    update reports set status = 'actioned' where reported = target and status in ('open','reviewing');
    delete from auth.users where id = target;
  elsif decision = 'dismiss' then
    update reports set status = 'dismissed' where reported = target and status in ('open','reviewing');
    update profiles set hidden = false where id = target;
  elsif decision = 'verify' then
    update profiles set verified = true where id = target;
  else
    raise exception 'decision must be ban, dismiss or verify';
  end if;
end $$;
revoke execute on function public.moderate(uuid, text) from public, anon, authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.moderate(uuid, text) from authenticated;

-- >>> supabase/migrations/0003_premium.sql
-- Matchwerk – premium (matchwerk+), daily limits and boosts
-- Entitlements are written only by the RevenueCat webhook (service role), never by the app.

alter table public.profiles
  add column if not exists premium_until timestamptz,
  add column if not exists boosted_until timestamptz,
  add column if not exists last_boost_at timestamptz,
  add column if not exists boost_credits int not null default 0 check (boost_credits >= 0);

create or replace function public.profiles_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.verified := false; new.hidden := false;
    new.premium_until := null; new.boosted_until := null; new.last_boost_at := null; new.boost_credits := 0;
  elsif current_user = 'authenticated' then
    new.verified := old.verified; new.hidden := old.hidden;
    new.premium_until := old.premium_until; new.boosted_until := old.boosted_until;
    new.last_boost_at := old.last_boost_at; new.boost_credits := old.boost_credits;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- never expose billing / moderation fields to other users
create or replace function public.profile_json(p public.profiles, my_lat float8, my_lng float8)
returns jsonb language sql stable as $$
  select (to_jsonb(p) - 'lat' - 'lng' - 'created_at' - 'updated_at' - 'hidden'
          - 'premium_until' - 'boosted_until' - 'last_boost_at' - 'boost_credits')
    || jsonb_build_object('distance_km', round(coalesce(km_between(my_lat, my_lng, p.lat, p.lng), 0)::numeric))
$$;

create or replace function public.is_premium(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select premium_until > now() from profiles where id = uid), false)
$$;

-- Plan limits (keep in sync with src/lib/plans.ts)
create or replace function public.plan_limits(premium boolean, out likes int, out superlikes int)
language sql immutable as $$
  select case when premium then 100000 else 50 end, case when premium then 5 else 1 end
$$;

create or replace function public.swipe(target_id uuid, act text, note jsonb default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); mid uuid; lim record; used_likes int; used_super int;
begin
  if me is null or target_id = me then raise exception 'invalid'; end if;
  if is_blocked(me, target_id) then return null; end if;
  if (select count(*) from swipes where swiper = me and created_at > now() - interval '24 hours') >= 500 then
    raise exception 'LIMIT:daily';
  end if;
  select * into lim from plan_limits(is_premium(me));
  if act <> 'pass' then
    select count(*) filter (where action <> 'pass'), count(*) filter (where action = 'superlike')
      into used_likes, used_super
      from swipes where swiper = me and created_at > now() - interval '24 hours';
    if used_likes >= lim.likes then raise exception 'LIMIT:likes'; end if;
    if act = 'superlike' and used_super >= lim.superlikes then raise exception 'LIMIT:superlikes'; end if;
  end if;
  if note is not null and char_length(coalesce(note->>'comment', '')) > 200 then raise exception 'Kommentar zu lang'; end if;
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

-- premium may extend a match as often as they like, free users once
create or replace function public.extend_match(match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update matches set extended = true, expires_at = greatest(expires_at, now()) + interval '24 hours'
  where id = match_id and auth.uid() in (user_a, user_b) and (not extended or is_premium(auth.uid()));
  if not found then raise exception 'LIMIT:extend'; end if;
end $$;

-- Boost: profile is shown first for 30 minutes. matchwerk+ includes one per week; extra boosts are credits.
create or replace function public.activate_boost()
returns timestamptz language plpgsql security definer set search_path = public as $$
declare me profiles; until timestamptz := now() + interval '30 minutes';
begin
  select * into me from profiles where id = auth.uid() for update;
  if me is null then raise exception 'invalid'; end if;
  if me.boosted_until > now() then return me.boosted_until; end if;
  if me.premium_until > now() and (me.last_boost_at is null or me.last_boost_at < now() - interval '7 days') then
    update profiles set boosted_until = until, last_boost_at = now() where id = me.id;
  elsif me.boost_credits > 0 then
    update profiles set boosted_until = until, boost_credits = boost_credits - 1 where id = me.id;
  else
    raise exception 'LIMIT:boost';
  end if;
  return until;
end $$;

create or replace function public.my_limits()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me profiles; prem boolean; lim record; used_likes int; used_super int;
begin
  select * into me from profiles where id = auth.uid();
  prem := coalesce(me.premium_until > now(), false);
  select * into lim from plan_limits(prem);
  select count(*) filter (where action <> 'pass'), count(*) filter (where action = 'superlike')
    into used_likes, used_super from swipes where swiper = me.id and created_at > now() - interval '24 hours';
  return jsonb_build_object(
    'premium', prem,
    'premium_until', me.premium_until,
    'likes_left', case when prem then null else greatest(0, lim.likes - used_likes) end,
    'superlikes_left', greatest(0, lim.superlikes - used_super),
    'boost_active_until', case when me.boosted_until > now() then me.boosted_until end,
    'free_boost_available', prem and (me.last_boost_at is null or me.last_boost_at < now() - interval '7 days'),
    'boost_credits', me.boost_credits
  );
end $$;

-- boosted profiles come first in everyone's deck
create or replace function public.get_deck(min_age int, max_age int, max_km int, intentions text[], verified_only boolean, lim int default 30)
returns setof jsonb language sql stable security definer set search_path = public as $$
  with me as (select * from profiles where id = auth.uid())
  select profile_json(p, me.lat, me.lng)
  from profiles p, me
  where p.id <> me.id
    and not p.paused and not p.hidden and not me.hidden
    and wants(me.interested_in, p.gender) and wants(p.interested_in, me.gender)
    and extract(year from age(p.birthdate)) between min_age and max_age
    and (cardinality(intentions) = 0 or p.intention = any(intentions))
    and (not verified_only or p.verified)
    and (me.lat is null or p.lat is null or km_between(me.lat, me.lng, p.lat, p.lng) <= max_km)
    and not exists (select 1 from swipes s where s.swiper = me.id and s.target = p.id)
    and not is_blocked(me.id, p.id)
  order by
    exists (select 1 from swipes s where s.swiper = p.id and s.target = me.id and s.action <> 'pass') desc,
    coalesce(p.boosted_until > now(), false) desc,
    p.verified desc,
    p.last_active_at desc
  limit lim
$$;

create or replace function public.incoming_likes()
returns table (profile jsonb, action text, note jsonb, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  with me as (select * from profiles where id = auth.uid())
  select profile_json(p, me.lat, me.lng), s.action, s.note, s.created_at
  from swipes s join profiles p on p.id = s.swiper, me
  where s.target = me.id and s.action <> 'pass' and not p.hidden
    and not exists (select 1 from swipes mine where mine.swiper = me.id and mine.target = s.swiper)
    and not is_blocked(me.id, p.id)
  order by s.created_at desc
$$;

-- ───────── billing (called by the RevenueCat webhook with the service role) ─────────
create table if not exists public.purchases (
  id text primary key,                -- RevenueCat event id (idempotency)
  user_id uuid references auth.users on delete set null,
  type text not null,
  product_id text,
  store text,
  price_eur numeric,               -- as reported by RevenueCat (USD), for a rough overview
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.purchases enable row level security;
create policy "own purchases" on public.purchases for select to authenticated using (user_id = auth.uid());

create or replace function public.billing_apply(event_id text, uid uuid, kind text, product text, store_name text,
                                                price numeric, expires timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into purchases (id, user_id, type, product_id, store, price_eur, expires_at)
    values (event_id, uid, kind, product, store_name, price, expires)
    on conflict (id) do nothing;
  if not found then return; end if;   -- already processed
  if kind in ('INITIAL_PURCHASE','RENEWAL','PRODUCT_CHANGE','UNCANCELLATION','SUBSCRIPTION_EXTENDED','TEMPORARY_ENTITLEMENT_GRANT') then
    update profiles set premium_until = greatest(coalesce(premium_until, now()), expires) where id = uid;
  elsif kind = 'EXPIRATION' then
    update profiles set premium_until = least(coalesce(premium_until, now()), coalesce(expires, now())) where id = uid;
  elsif kind = 'NON_RENEWING_PURCHASE' and product like '%boost%' then
    update profiles set boost_credits = boost_credits + case when product like '%5%' then 5 else 1 end where id = uid;
  end if;
end $$;

-- revenue overview for you (dashboard / service role)
create or replace view public.revenue_daily with (security_invoker = true) as
  select date_trunc('day', created_at)::date as day,
         count(*) filter (where type = 'INITIAL_PURCHASE') as new_subscriptions,
         count(*) filter (where type = 'RENEWAL') as renewals,
         count(*) filter (where type = 'NON_RENEWING_PURCHASE') as boosts_sold,
         count(*) filter (where type = 'CANCELLATION') as cancellations,
         coalesce(sum(price_eur), 0) as gross_eur
  from purchases group by 1 order by 1 desc;
revoke all on public.revenue_daily from anon, authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.moderate(uuid, text) from authenticated;
revoke execute on function public.billing_apply(text, uuid, text, text, text, numeric, timestamptz) from authenticated;

-- >>> supabase/migrations/0004_storage_own_files.sql
-- Matchwerk – users may list/read their own photo folder through the Storage API.
-- Needed so "Konto löschen" can find and remove all of a user's photos (GDPR).
-- Public display of photos is unaffected: the bucket is public and served via public URLs.
drop policy if exists "read own photos" on storage.objects;
create policy "read own photos" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- >>> supabase/migrations/0005_tiers.sql
-- Matchwerk – two paid tiers (Matchwerk+ and VIP), daily profile limit, buyable Funken (super-likes) and boosts.
-- Keep the numbers in sync with src/lib/plans.ts.

alter table public.profiles
  add column if not exists vip_until timestamptz,
  add column if not exists funken_credits int not null default 0 check (funken_credits >= 0);

create or replace function public.profiles_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.verified := false; new.hidden := false;
    new.premium_until := null; new.vip_until := null; new.boosted_until := null; new.last_boost_at := null;
    new.boost_credits := 0; new.funken_credits := 0;
  elsif current_user = 'authenticated' then
    new.verified := old.verified; new.hidden := old.hidden;
    new.premium_until := old.premium_until; new.vip_until := old.vip_until;
    new.boosted_until := old.boosted_until; new.last_boost_at := old.last_boost_at;
    new.boost_credits := old.boost_credits; new.funken_credits := old.funken_credits;
  end if;
  new.updated_at := now();
  return new;
end $$;

create or replace function public.profile_json(p public.profiles, my_lat float8, my_lng float8)
returns jsonb language sql stable as $$
  select (to_jsonb(p) - 'lat' - 'lng' - 'created_at' - 'updated_at' - 'hidden'
          - 'premium_until' - 'vip_until' - 'boosted_until' - 'last_boost_at' - 'boost_credits' - 'funken_credits')
    || jsonb_build_object('distance_km', round(coalesce(km_between(my_lat, my_lng, p.lat, p.lng), 0)::numeric))
$$;

-- 'free' | 'plus' | 'vip'
create or replace function public.user_tier(uid uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when p.vip_until > now() then 'vip'
    when p.premium_until > now() then 'plus'
    else 'free' end
  from profiles p where p.id = uid
$$;

create or replace function public.is_premium(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(user_tier(uid) in ('plus', 'vip'), false)
$$;

drop function if exists public.plan_limits(boolean);
create or replace function public.tier_limits(tier text,
  out swipes int, out likes int, out funken int, out boost_every interval)
language sql immutable as $$
  select
    case tier when 'vip' then 500 when 'plus' then 250 else 60 end,
    case tier when 'free' then 25 else 100000 end,
    case tier when 'vip' then 7 when 'plus' then 3 else 1 end,
    case tier when 'vip' then interval '7 days' when 'plus' then interval '30 days' else null end
$$;

create or replace function public.swipe(target_id uuid, act text, note jsonb default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); mid uuid; lim record; used record; tier text;
begin
  if me is null or target_id = me then raise exception 'invalid'; end if;
  if is_blocked(me, target_id) then return null; end if;
  tier := coalesce(user_tier(me), 'free');
  select * into lim from tier_limits(tier);
  select count(*) as total,
         count(*) filter (where s.action <> 'pass') as likes,
         count(*) filter (where s.action = 'superlike' and not coalesce((s.note->>'paid')::boolean, false)) as funken
    into used from swipes s where s.swiper = me and s.created_at > now() - interval '24 hours';
  if used.total >= lim.swipes then raise exception 'LIMIT:swipes'; end if;
  if act <> 'pass' and used.likes >= lim.likes then raise exception 'LIMIT:likes'; end if;
  if act = 'superlike' and used.funken >= lim.funken then
    -- daily Funken used up: spend a purchased one
    update profiles set funken_credits = funken_credits - 1 where id = me and funken_credits > 0;
    if not found then raise exception 'LIMIT:superlikes'; end if;
    note := coalesce(note, '{}'::jsonb) || '{"paid": true}';
  end if;
  if note is not null and char_length(coalesce(note->>'comment', '')) > 200 then raise exception 'Kommentar zu lang'; end if;
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

create or replace function public.activate_boost()
returns timestamptz language plpgsql security definer set search_path = public as $$
declare me profiles; until timestamptz := now() + interval '30 minutes'; lim record;
begin
  select * into me from profiles where id = auth.uid() for update;
  if me is null then raise exception 'invalid'; end if;
  if me.boosted_until > now() then return me.boosted_until; end if;
  select * into lim from tier_limits(user_tier(me.id));
  if lim.boost_every is not null and (me.last_boost_at is null or me.last_boost_at < now() - lim.boost_every) then
    update profiles set boosted_until = until, last_boost_at = now() where id = me.id;
  elsif me.boost_credits > 0 then
    update profiles set boosted_until = until, boost_credits = boost_credits - 1 where id = me.id;
  else
    raise exception 'LIMIT:boost';
  end if;
  return until;
end $$;

create or replace function public.my_limits()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me profiles; tier text; lim record; used record;
begin
  select * into me from profiles where id = auth.uid();
  tier := coalesce(user_tier(me.id), 'free');
  select * into lim from tier_limits(tier);
  select count(*) as total,
         count(*) filter (where action <> 'pass') as likes,
         count(*) filter (where action = 'superlike' and not coalesce((note->>'paid')::boolean, false)) as funken
    into used from swipes where swiper = me.id and created_at > now() - interval '24 hours';
  return jsonb_build_object(
    'tier', tier,
    'premium', tier <> 'free',
    'premium_until', case tier when 'vip' then me.vip_until when 'plus' then me.premium_until end,
    'swipes_left', case when tier = 'vip' then null else greatest(0, lim.swipes - used.total) end,
    'likes_left', case when tier = 'free' then greatest(0, lim.likes - used.likes) end,
    'superlikes_left', greatest(0, lim.funken - used.funken),
    'funken_credits', me.funken_credits,
    'boost_active_until', case when me.boosted_until > now() then me.boosted_until end,
    'free_boost_available', lim.boost_every is not null and (me.last_boost_at is null or me.last_boost_at < now() - lim.boost_every),
    'boost_credits', me.boost_credits
  );
end $$;

-- VIPs and boosted profiles are shown earlier in everyone's deck
create or replace function public.get_deck(min_age int, max_age int, max_km int, intentions text[], verified_only boolean, lim int default 30)
returns setof jsonb language sql stable security definer set search_path = public as $$
  with me as (select * from profiles where id = auth.uid())
  select profile_json(p, me.lat, me.lng)
  from profiles p, me
  where p.id <> me.id
    and not p.paused and not p.hidden and not me.hidden
    and wants(me.interested_in, p.gender) and wants(p.interested_in, me.gender)
    and extract(year from age(p.birthdate)) between min_age and max_age
    and (cardinality(intentions) = 0 or p.intention = any(intentions))
    and (not verified_only or p.verified)
    and (me.lat is null or p.lat is null or km_between(me.lat, me.lng, p.lat, p.lng) <= max_km)
    and not exists (select 1 from swipes s where s.swiper = me.id and s.target = p.id)
    and not is_blocked(me.id, p.id)
  order by
    exists (select 1 from swipes s where s.swiper = p.id and s.target = me.id and s.action <> 'pass') desc,
    coalesce(p.boosted_until > now(), false) desc,
    coalesce(p.vip_until > now(), false) desc,
    p.verified desc,
    p.last_active_at desc
  limit lim
$$;

-- Funken first, then VIP likes, then newest
create or replace function public.incoming_likes()
returns table (profile jsonb, action text, note jsonb, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  with me as (select * from profiles where id = auth.uid())
  select profile_json(p, me.lat, me.lng), s.action, s.note - 'paid', s.created_at
  from swipes s join profiles p on p.id = s.swiper, me
  where s.target = me.id and s.action <> 'pass' and not p.hidden
    and not exists (select 1 from swipes mine where mine.swiper = me.id and mine.target = s.swiper)
    and not is_blocked(me.id, p.id)
  order by (s.action = 'superlike') desc, coalesce(p.vip_until > now(), false) desc, s.created_at desc
$$;

create or replace function public.billing_apply(event_id text, uid uuid, kind text, product text, store_name text,
                                                price numeric, expires timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare n int := coalesce(nullif(substring(product from '_(\d+)$'), '')::int, 1);
        is_vip boolean := product like '%vip%';
begin
  insert into purchases (id, user_id, type, product_id, store, price_eur, expires_at)
    values (event_id, uid, kind, product, store_name, price, expires)
    on conflict (id) do nothing;
  if not found then return; end if;   -- already processed
  if kind in ('INITIAL_PURCHASE','RENEWAL','PRODUCT_CHANGE','UNCANCELLATION','SUBSCRIPTION_EXTENDED','TEMPORARY_ENTITLEMENT_GRANT') then
    if is_vip then
      update profiles set vip_until = greatest(coalesce(vip_until, now()), expires) where id = uid;
    else
      update profiles set premium_until = greatest(coalesce(premium_until, now()), expires) where id = uid;
    end if;
  elsif kind = 'EXPIRATION' then
    if is_vip then
      update profiles set vip_until = least(coalesce(vip_until, now()), coalesce(expires, now())) where id = uid;
    else
      update profiles set premium_until = least(coalesce(premium_until, now()), coalesce(expires, now())) where id = uid;
    end if;
  elsif kind = 'NON_RENEWING_PURCHASE' and product like '%funken%' then
    update profiles set funken_credits = funken_credits + n where id = uid;
  elsif kind = 'NON_RENEWING_PURCHASE' and product like '%boost%' then
    update profiles set boost_credits = boost_credits + n where id = uid;
  end if;
end $$;

-- extend_match keeps using is_premium() (Plus or VIP)

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.moderate(uuid, text) from authenticated;
revoke execute on function public.billing_apply(text, uuid, text, text, text, numeric, timestamptz) from authenticated;

select 'Matchwerk-Datenbank ist eingerichtet' as fertig;
