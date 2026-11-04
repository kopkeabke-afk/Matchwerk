-- Funke – safety & anti-abuse layer

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
