-- Matchwerk: Update November – Aktivitäten Teil 2 (Titelbilder, Einladungen, „Macht mit bei“) und Eigenschaften/Wünsche/Geschlechter-Auswahl
-- (Migrationen 0009 + 0010). Einmal im Supabase SQL-Editor ausführen (New query → einfügen → Run). Kann gefahrlos mehrfach laufen.

-- Matchwerk – Aktivitäten, Teil 2: Titelbilder, Einladungen im Chat und „Macht mit bei“ im Profil.

-- 1 · optional cover photo (uploaded by the host into their own folder of the photos bucket)
alter table public.activities add column if not exists cover_url text check (char_length(cover_url) <= 500);

drop function if exists public.create_activity(text, text, text, timestamptz, text, int);
create or replace function public.create_activity(category text, title text, description text, starts_at timestamptz,
                                                  place text, max_people int, cover_url text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me profiles;
  new_id uuid;
  hosting int;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null then raise exception 'Bitte zuerst dein Profil anlegen.'; end if;
  if me.hidden then raise exception 'Dein Profil ist gesperrt.'; end if;
  if starts_at < now() + interval '15 minutes' or starts_at > now() + interval '60 days' then
    raise exception 'Wähle einen Termin in den nächsten 60 Tagen.';
  end if;
  if create_activity.cover_url is not null
     and create_activity.cover_url not like '%/storage/v1/object/public/photos/' || me.id::text || '/%' then
    raise exception 'Ungültiges Titelbild.';
  end if;
  select count(*) into hosting from activities a where a.host_id = me.id and not a.cancelled and a.starts_at > now();
  if hosting >= activity_host_limit(user_tier(me.id)) then raise exception 'LIMIT:activities'; end if;

  insert into activities (host_id, category, title, description, starts_at, place, city, lat, lng, max_people, cover_url)
  values (me.id, create_activity.category, trim(create_activity.title), trim(coalesce(create_activity.description, '')),
          create_activity.starts_at, trim(create_activity.place), me.city, me.lat, me.lng, create_activity.max_people,
          create_activity.cover_url)
  returning id into new_id;
  insert into activity_members (activity_id, user_id) values (new_id, me.id);
  return new_id;
end $$;

create or replace function public.activity_json(a public.activities, me public.profiles, with_members boolean)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', a.id, 'category', a.category, 'title', a.title, 'description', a.description,
    'starts_at', a.starts_at, 'place', a.place, 'city', a.city, 'max_people', a.max_people,
    'cancelled', a.cancelled, 'cover_url', a.cover_url,
    'distance_km', round(coalesce(km_between(me.lat, me.lng, a.lat, a.lng), 0)::numeric),
    'host', (select person_json(h) from profiles h where h.id = a.host_id),
    'is_host', a.host_id = me.id,
    'joined', exists (select 1 from activity_members m where m.activity_id = a.id and m.user_id = me.id),
    'member_count', (select count(*) from activity_members m where m.activity_id = a.id),
    'members', (select coalesce(jsonb_agg(person_json(x.p) order by x.joined_at), '[]'::jsonb)
                from (select p, m.joined_at
                      from activity_members m join profiles p on p.id = m.user_id
                      where m.activity_id = a.id and not p.hidden and not is_blocked(me.id, p.id)
                      order by m.joined_at
                      limit case when with_members then 100 else 5 end) x),
    'last_message', (select to_jsonb(x) from activity_messages x where x.activity_id = a.id order by x.created_at desc limit 1)
  )
$$;

-- 2 · „Macht mit bei …“: upcoming activities someone hosts or joined, as far as I may see them
create or replace function public.person_activities(uid uuid)
returns setof jsonb language sql stable security definer set search_path = public as $$
  with me as (select * from profiles where id = auth.uid())
  select activity_json(a, me, false)
  from activities a join activity_members m on m.activity_id = a.id and m.user_id = person_activities.uid, me
  where not a.cancelled and a.starts_at > now()
    and activity_visible(a, me.id)
    and not is_blocked(me.id, person_activities.uid)
  order by a.starts_at
  limit 5
$$;

-- 3 · invite a match to an activity ("Gemeinsam hingehen")
alter table public.messages add column if not exists activity_id uuid references public.activities (id) on delete set null;
alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check check (kind in ('text', 'voice', 'invite'));
alter table public.messages drop constraint if exists messages_content_check;
alter table public.messages add constraint messages_content_check check (
  (kind = 'text' and char_length(text) between 1 and 2000)
  or (kind = 'voice' and audio_path is not null and char_length(text) <= 2000)
  or (kind = 'invite' and char_length(text) <= 2000)
);

create or replace function public.invite_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare a activities;
begin
  if new.kind = 'invite' then
    select * into a from activities where id = new.activity_id;
    if a.id is null or a.cancelled or a.starts_at < now() or not activity_visible(a, new.sender_id) then
      raise exception 'Zu dieser Aktivität kannst du nicht einladen.';
    end if;
  elsif new.activity_id is not null then
    new.activity_id := null;
  end if;
  return new;
end $$;
drop trigger if exists invite_guard on public.messages;
create trigger invite_guard before insert on public.messages for each row execute function public.invite_guard();

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.moderate(uuid, text) from authenticated;
revoke execute on function public.billing_apply(text, uuid, text, text, text, numeric, timestamptz) from authenticated;
revoke execute on function public.activity_json(public.activities, public.profiles, boolean) from authenticated;
revoke execute on function public.activity_visible(public.activities, uuid) from authenticated;
revoke execute on function public.person_json(public.profiles) from authenticated;

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
