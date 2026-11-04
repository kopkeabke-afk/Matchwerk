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
