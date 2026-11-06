-- Matchwerk: Eigenschaften, Wünsche & Geschlechter-Auswahl (Migration 0010)
-- Einmal im Supabase SQL-Editor ausführen (New query → einfügen → Run). Kann gefahrlos mehrfach laufen.

-- Matchwerk – Eigenschaften, Wünsche und zeitgemäße Geschlechter-Auswahl.
-- seeking: whom someone wants to meet (any of woman / man / nonbinary), gender_detail: optional, more precise gender,
-- traits: Kinderwunsch, Rauchen, Sport … (all optional), prefs: Wunschgröße, Ausschlusskriterien, was wichtig ist.

alter table public.profiles
  add column if not exists gender_detail text check (char_length(gender_detail) <= 30),
  add column if not exists seeking text[] not null default '{}' check (seeking <@ array['woman', 'man', 'nonbinary']::text[]),
  add column if not exists traits jsonb not null default '{}' check (jsonb_typeof(traits) = 'object' and pg_column_size(traits) < 4000),
  add column if not exists prefs jsonb not null default '{}' check (jsonb_typeof(prefs) = 'object' and pg_column_size(prefs) < 2000);

update public.profiles set seeking = case interested_in
    when 'women' then array['woman'] when 'men' then array['man'] else array['woman', 'man', 'nonbinary'] end
  where cardinality(seeking) = 0;

-- does p want to meet someone of gender g?
create or replace function public.seeks(p public.profiles, g text)
returns boolean language sql immutable as $$
  select case when cardinality(p.seeking) > 0 then g = any(p.seeking) else wants(p.interested_in, g) end
$$;

-- does cand pass viewer's dealbreakers? (unknown answers pass)
create or replace function public.passes_prefs(viewer public.profiles, cand public.profiles)
returns boolean language sql immutable as $$
  select
    (cand.height_cm is null or viewer.prefs->>'heightMin' is null or cand.height_cm >= (viewer.prefs->>'heightMin')::int)
    and (cand.height_cm is null or viewer.prefs->>'heightMax' is null or cand.height_cm <= (viewer.prefs->>'heightMax')::int)
    and (coalesce((viewer.prefs->>'nonSmokerOnly')::boolean, false) = false
         or coalesce(cand.traits->>'smoking', 'never') = 'never')
    and (coalesce((viewer.prefs->>'kidsMatch')::boolean, false) = false
         or viewer.traits->>'kidsWish' is null or cand.traits->>'kidsWish' is null
         or not ((viewer.traits->>'kidsWish' = 'want' and cand.traits->>'kidsWish' = 'no')
              or (viewer.traits->>'kidsWish' = 'no' and cand.traits->>'kidsWish' = 'want')))
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
    and (get_deck.mode = 'friends' or (seeks(me, p.gender) and seeks(p, me.gender)
                                      and passes_prefs(me, p) and passes_prefs(p, me)))
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

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.moderate(uuid, text) from authenticated;
revoke execute on function public.billing_apply(text, uuid, text, text, text, numeric, timestamptz) from authenticated;
revoke execute on function public.activity_json(public.activities, public.profiles, boolean) from authenticated;
revoke execute on function public.activity_visible(public.activities, uuid) from authenticated;
revoke execute on function public.person_json(public.profiles) from authenticated;
