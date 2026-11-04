-- Matchwerk – Datenbank-Update: Stufen (Plus/VIP, Funken) + Freunde-Modus
-- Einmal komplett in Supabase → SQL Editor einfügen und auf RUN klicken.

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

-- >>> supabase/migrations/0006_friends_mode.sql
-- Matchwerk – "Freunde" mode next to Dating.
-- Swipes and matches are kept per mode: passing someone in Dating doesn't hide them in Freunde.

alter table public.profiles
  add column if not exists modes text[] not null default '{dating}'
  check (cardinality(modes) >= 1 and modes <@ array['dating','friends']);

alter table public.swipes add column if not exists mode text not null default 'dating' check (mode in ('dating','friends'));
alter table public.swipes drop constraint if exists swipes_pkey;
alter table public.swipes add primary key (swiper, target, mode);

alter table public.matches add column if not exists mode text not null default 'dating' check (mode in ('dating','friends'));
alter table public.matches drop constraint if exists matches_user_a_user_b_key;
alter table public.matches add constraint matches_pair_mode_key unique (user_a, user_b, mode);

-- old signatures (without mode) would make calls ambiguous
drop function if exists public.swipe(uuid, text, jsonb);
drop function if exists public.undo_swipe(uuid);
drop function if exists public.get_deck(int, int, int, text[], boolean, int);
drop function if exists public.incoming_likes();
drop function if exists public.my_matches();

create or replace function public.swipe(target_id uuid, act text, note jsonb default null, mode text default 'dating')
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); mid uuid; lim record; used record; tier text;
begin
  if me is null or target_id = me or mode not in ('dating','friends') then raise exception 'invalid'; end if;
  if is_blocked(me, target_id) then return null; end if;
  if (select count(*) from profiles p where p.id in (me, target_id) and swipe.mode = any(p.modes)) < 2 then
    raise exception 'mode not enabled';
  end if;
  tier := coalesce(user_tier(me), 'free');
  select * into lim from tier_limits(tier);
  select count(*) as total,
         count(*) filter (where s.action <> 'pass') as likes,
         count(*) filter (where s.action = 'superlike' and not coalesce((s.note->>'paid')::boolean, false)) as funken
    into used from swipes s where s.swiper = me and s.created_at > now() - interval '24 hours';
  if used.total >= lim.swipes then raise exception 'LIMIT:swipes'; end if;
  if act <> 'pass' and used.likes >= lim.likes then raise exception 'LIMIT:likes'; end if;
  if act = 'superlike' and used.funken >= lim.funken then
    update profiles set funken_credits = funken_credits - 1 where id = me and funken_credits > 0;
    if not found then raise exception 'LIMIT:superlikes'; end if;
    note := coalesce(note, '{}'::jsonb) || '{"paid": true}';
  end if;
  if note is not null and char_length(coalesce(note->>'comment', '')) > 200 then raise exception 'Kommentar zu lang'; end if;
  insert into swipes (swiper, target, action, note, mode) values (me, target_id, act, note, swipe.mode)
    on conflict on constraint swipes_pkey do update set action = excluded.action, note = excluded.note, created_at = now();
  update profiles set last_active_at = now() where id = me;
  if act <> 'pass' and exists (select 1 from swipes s where s.swiper = target_id and s.target = me and s.mode = swipe.mode and s.action <> 'pass') then
    insert into matches (user_a, user_b, mode) values (least(me, target_id), greatest(me, target_id), swipe.mode)
      on conflict on constraint matches_pair_mode_key do nothing returning id into mid;
    if mid is null then
      select m.id into mid from matches m where m.user_a = least(me, target_id) and m.user_b = greatest(me, target_id) and m.mode = swipe.mode;
    end if;
  end if;
  return mid;
end $$;

create or replace function public.undo_swipe(target_id uuid, mode text default 'dating')
returns void language sql security definer set search_path = public as $$
  delete from swipes s where s.swiper = auth.uid() and s.target = target_id and s.mode = undo_swipe.mode
    and not exists (select 1 from matches m where m.user_a = least(auth.uid(), target_id) and m.user_b = greatest(auth.uid(), target_id) and m.mode = undo_swipe.mode)
$$;

create or replace function public.get_deck(min_age int, max_age int, max_km int, intentions text[], verified_only boolean,
                                           lim int default 30, mode text default 'dating')
returns setof jsonb language sql stable security definer set search_path = public as $$
  with me as (select * from profiles where id = auth.uid())
  select profile_json(p, me.lat, me.lng)
  from profiles p, me
  where p.id <> me.id
    and not p.paused and not p.hidden and not me.hidden
    and get_deck.mode = any(p.modes) and get_deck.mode = any(me.modes)
    and (get_deck.mode = 'friends' or (wants(me.interested_in, p.gender) and wants(p.interested_in, me.gender)))
    and extract(year from age(p.birthdate)) between min_age and max_age
    and (get_deck.mode = 'friends' or cardinality(intentions) = 0 or p.intention = any(intentions))
    and (not verified_only or p.verified)
    and (me.lat is null or p.lat is null or km_between(me.lat, me.lng, p.lat, p.lng) <= max_km)
    and not exists (select 1 from swipes s where s.swiper = me.id and s.target = p.id and s.mode = get_deck.mode)
    and not is_blocked(me.id, p.id)
  order by
    exists (select 1 from swipes s where s.swiper = p.id and s.target = me.id and s.mode = get_deck.mode and s.action <> 'pass') desc,
    coalesce(p.boosted_until > now(), false) desc,
    coalesce(p.vip_until > now(), false) desc,
    p.verified desc,
    p.last_active_at desc
  limit lim
$$;

create or replace function public.incoming_likes(mode text default 'dating')
returns table (profile jsonb, action text, note jsonb, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  with me as (select * from profiles where id = auth.uid())
  select profile_json(p, me.lat, me.lng), s.action, s.note - 'paid', s.created_at
  from swipes s join profiles p on p.id = s.swiper, me
  where s.target = me.id and s.mode = incoming_likes.mode and s.action <> 'pass' and not p.hidden
    and not exists (select 1 from swipes mine where mine.swiper = me.id and mine.target = s.swiper and mine.mode = incoming_likes.mode)
    and not is_blocked(me.id, p.id)
  order by (s.action = 'superlike') desc, coalesce(p.vip_until > now(), false) desc, s.created_at desc
$$;

create or replace function public.my_matches()
returns table (id uuid, profile jsonb, created_at timestamptz, expires_at timestamptz, extended boolean,
               opener text, last_message jsonb, unread bigint, mode text)
language sql stable security definer set search_path = public as $$
  with me as (select * from profiles where id = auth.uid())
  select m.id, profile_json(p, me.lat, me.lng), m.created_at, m.expires_at, m.extended,
    case when m.mode = 'friends' then 'anyone' else resolve_opener(me.first_move, p.first_move) end,
    (select to_jsonb(x) from messages x where x.match_id = m.id order by x.created_at desc limit 1),
    (select count(*) from messages x where x.match_id = m.id and x.sender_id <> me.id
       and x.created_at > case when m.user_a = me.id then m.read_a else m.read_b end),
    m.mode
  from matches m, me, profiles p
  where me.id in (m.user_a, m.user_b)
    and p.id = case when m.user_a = me.id then m.user_b else m.user_a end
    and not is_blocked(me.id, p.id)
    and (m.expires_at > now() or exists (select 1 from messages x where x.match_id = m.id))
  order by coalesce((select max(x.created_at) from messages x where x.match_id = m.id), m.created_at) desc
$$;

-- first-move rule only applies to dating matches
create or replace function public.messages_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare m matches; other uuid; mine text; theirs text; has_msgs boolean;
begin
  select * into m from matches where id = new.match_id;
  if m is null or new.sender_id not in (m.user_a, m.user_b) then raise exception 'not a member'; end if;
  other := case when new.sender_id = m.user_a then m.user_b else m.user_a end;
  if is_blocked(new.sender_id, other) then raise exception 'blocked'; end if;
  select exists(select 1 from messages where match_id = m.id) into has_msgs;
  if not has_msgs then
    if m.expires_at < now() then raise exception 'match expired'; end if;
    if m.mode = 'dating' then
      select first_move into mine from profiles where id = new.sender_id;
      select first_move into theirs from profiles where id = other;
      if resolve_opener(mine, theirs) = 'them' then raise exception 'your match makes the first move'; end if;
    end if;
  end if;
  return new;
end $$;

-- matched profiles stay readable regardless of mode
drop policy if exists "matched profiles readable" on public.profiles;
create policy "matched profiles readable" on public.profiles for select to authenticated
  using (exists (select 1 from matches where (user_a = auth.uid() and user_b = profiles.id) or (user_b = auth.uid() and user_a = profiles.id)));

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.moderate(uuid, text) from authenticated;
revoke execute on function public.billing_apply(text, uuid, text, text, text, numeric, timestamptz) from authenticated;

select 'Update eingespielt' as fertig;
