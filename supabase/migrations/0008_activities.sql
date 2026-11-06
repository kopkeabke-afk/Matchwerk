-- Matchwerk – Aktivitäten: gemeinsam etwas unternehmen, mit Gruppenchat.
-- Anyone nearby can see an upcoming activity, join until it is full and chat with the group.
-- Tables are only changed through the functions below; members can read their own group.

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  category text not null check (category in ('coffee', 'hike', 'drinks', 'games', 'sport', 'culture', 'food', 'other')),
  title text not null check (char_length(title) between 3 and 80),
  description text not null default '' check (char_length(description) <= 500),
  starts_at timestamptz not null,
  place text not null check (char_length(place) between 2 and 80),
  city text,
  lat float8,
  lng float8,
  max_people int not null default 6 check (max_people between 2 and 30),
  cancelled boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists activities_starts_idx on public.activities (starts_at) where not cancelled;
create index if not exists activities_host_idx on public.activities (host_id);

create table if not exists public.activity_members (
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);
create index if not exists activity_members_user_idx on public.activity_members (user_id);

create table if not exists public.activity_messages (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists activity_messages_idx on public.activity_messages (activity_id, created_at);

alter table public.activities enable row level security;
alter table public.activity_members enable row level security;
alter table public.activity_messages enable row level security;

create or replace function public.is_activity_member(aid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from activity_members where activity_id = aid and user_id = auth.uid())
$$;

drop policy if exists "members read activity" on public.activities;
create policy "members read activity" on public.activities for select to authenticated
  using (host_id = auth.uid() or public.is_activity_member(id));
drop policy if exists "members see each other" on public.activity_members;
create policy "members see each other" on public.activity_members for select to authenticated
  using (public.is_activity_member(activity_id));
drop policy if exists "members read group chat" on public.activity_messages;
create policy "members read group chat" on public.activity_messages for select to authenticated
  using (public.is_activity_member(activity_id));
drop policy if exists "members write group chat" on public.activity_messages;
create policy "members write group chat" on public.activity_messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_activity_member(activity_id));

-- group chat: no posting into cancelled or long-past activities, max 30 messages a minute
create or replace function public.activity_messages_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from activities a where a.id = new.activity_id and (a.cancelled or a.starts_at < now() - interval '7 days')) then
    raise exception 'Diese Aktivität ist beendet.';
  end if;
  if (select count(*) from activity_messages where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Zu viele Nachrichten – bitte kurz warten.';
  end if;
  new.created_at := now();
  return new;
end $$;
drop trigger if exists activity_messages_guard on public.activity_messages;
create trigger activity_messages_guard before insert on public.activity_messages
  for each row execute function public.activity_messages_guard();

-- how many upcoming activities someone may host at once
create or replace function public.activity_host_limit(tier text)
returns int language sql immutable as $$
  select case tier when 'vip' then 10 when 'plus' then 5 else 1 end
$$;

-- a short, public card of a person (no exact location, no billing fields)
create or replace function public.person_json(p public.profiles)
returns jsonb language sql stable as $$
  select jsonb_build_object('id', p.id, 'name', p.name, 'photo', p.photos[1], 'verified', p.verified,
                            'age', extract(year from age(p.birthdate))::int)
$$;

create or replace function public.activity_visible(a public.activities, me uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles h where h.id = a.host_id and not h.hidden)
     and not is_blocked(me, a.host_id)
$$;

create or replace function public.activity_json(a public.activities, me public.profiles, with_members boolean)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', a.id, 'category', a.category, 'title', a.title, 'description', a.description,
    'starts_at', a.starts_at, 'place', a.place, 'city', a.city, 'max_people', a.max_people,
    'cancelled', a.cancelled,
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

-- upcoming activities near me, plus everything I host or joined
create or replace function public.get_activities(max_km int default 50)
returns setof jsonb language sql stable security definer set search_path = public as $$
  with me as (select * from profiles where id = auth.uid())
  select activity_json(a, me, false)
  from activities a, me
  where not me.hidden
    and activity_visible(a, me.id)
    and (
      a.host_id = me.id
      or exists (select 1 from activity_members m where m.activity_id = a.id and m.user_id = me.id)
      or (not a.cancelled and a.starts_at > now()
          and (me.lat is null or a.lat is null or km_between(me.lat, me.lng, a.lat, a.lng) <= max_km))
    )
    and a.starts_at > now() - interval '1 day'
  order by
    (a.host_id = me.id or exists (select 1 from activity_members m where m.activity_id = a.id and m.user_id = me.id)) desc,
    a.starts_at
  limit 100
$$;

create or replace function public.get_activity(aid uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with me as (select * from profiles where id = auth.uid())
  select activity_json(a, me, true)
  from activities a, me
  where a.id = aid and activity_visible(a, me.id)
    and (not a.cancelled or a.host_id = me.id or exists (select 1 from activity_members m where m.activity_id = a.id and m.user_id = me.id))
$$;

create or replace function public.create_activity(category text, title text, description text, starts_at timestamptz,
                                                  place text, max_people int)
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
  select count(*) into hosting from activities a where a.host_id = me.id and not a.cancelled and a.starts_at > now();
  if hosting >= activity_host_limit(user_tier(me.id)) then raise exception 'LIMIT:activities'; end if;

  insert into activities (host_id, category, title, description, starts_at, place, city, lat, lng, max_people)
  values (me.id, create_activity.category, trim(create_activity.title), trim(coalesce(create_activity.description, '')),
          create_activity.starts_at, trim(create_activity.place), me.city, me.lat, me.lng, create_activity.max_people)
  returning id into new_id;
  insert into activity_members (activity_id, user_id) values (new_id, me.id);
  return new_id;
end $$;

create or replace function public.join_activity(aid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  a activities;
  me uuid := auth.uid();
begin
  select * into a from activities where id = aid for update;
  if a.id is null or not activity_visible(a, me) then raise exception 'Diese Aktivität gibt es nicht mehr.'; end if;
  if exists (select 1 from activity_members where activity_id = aid and user_id = me) then return; end if;
  if a.cancelled then raise exception 'Diese Aktivität wurde abgesagt.'; end if;
  if a.starts_at < now() then raise exception 'Diese Aktivität hat schon begonnen.'; end if;
  if exists (select 1 from profiles where id = me and hidden) then raise exception 'Dein Profil ist gesperrt.'; end if;
  if exists (select 1 from activity_members m where m.activity_id = aid and is_blocked(me, m.user_id)) then
    raise exception 'Du kannst dieser Aktivität nicht beitreten.';
  end if;
  if (select count(*) from activity_members where activity_id = aid) >= a.max_people then
    raise exception 'Diese Aktivität ist schon voll.';
  end if;
  insert into activity_members (activity_id, user_id) values (aid, me);
end $$;

create or replace function public.leave_activity(aid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from activities where id = aid and host_id = auth.uid()) then
    raise exception 'Als Gastgeber:in kannst du die Aktivität absagen.';
  end if;
  delete from activity_members where activity_id = aid and user_id = auth.uid();
end $$;

create or replace function public.cancel_activity(aid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update activities set cancelled = true where id = aid and host_id = auth.uid();
  if not found then raise exception 'Nur die Gastgeberin oder der Gastgeber kann absagen.'; end if;
end $$;

create or replace function public.remove_activity_member(aid uuid, uid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from activities where id = aid and host_id = auth.uid()) then
    raise exception 'Nur die Gastgeberin oder der Gastgeber kann Personen entfernen.';
  end if;
  if uid = auth.uid() then raise exception 'Du kannst dich nicht selbst entfernen.'; end if;
  delete from activity_members where activity_id = aid and user_id = uid;
end $$;

-- blocking someone also takes them out of activities I host (and me out of theirs)
create or replace function public.block_user(target_id uuid)
returns void language sql security definer set search_path = public as $$
  insert into blocks (blocker, blocked) values (auth.uid(), target_id) on conflict do nothing;
  delete from matches where user_a = least(auth.uid(), target_id) and user_b = greatest(auth.uid(), target_id);
  delete from activity_members m using activities a
    where a.id = m.activity_id and a.host_id = auth.uid() and m.user_id = target_id;
  delete from activity_members m using activities a
    where a.id = m.activity_id and a.host_id = target_id and m.user_id = auth.uid();
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.moderate(uuid, text) from authenticated;
revoke execute on function public.billing_apply(text, uuid, text, text, text, numeric, timestamptz) from authenticated;
-- internal helpers: they take whole rows and would otherwise leak other groups
revoke execute on function public.activity_json(public.activities, public.profiles, boolean) from authenticated;
revoke execute on function public.activity_visible(public.activities, uuid) from authenticated;
revoke execute on function public.person_json(public.profiles) from authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'activity_messages') then
    alter publication supabase_realtime add table public.activity_messages;
  end if;
end $$;
