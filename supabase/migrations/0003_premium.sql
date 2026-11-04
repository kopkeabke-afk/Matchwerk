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
