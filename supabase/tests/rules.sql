-- Assertion-based checks for the security rules. Fails (non-zero exit) on the first violated rule.
\set ON_ERROR_STOP 1
create schema tst;
create or replace function tst.check(ok boolean, what text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok  %', what; end $$;
create or replace function tst.fails(stmt text, what text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when others then raise notice 'ok  % (%)', what, sqlerrm; return; end;
  raise exception 'FAILED: % – statement succeeded', what;
end $$;

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001','a@x'),('bbbbbbbb-0000-0000-0000-000000000002','b@x'),
  ('cccccccc-0000-0000-0000-000000000003','c@x'),('dddddddd-0000-0000-0000-000000000004','d@x'),
  ('eeeeeeee-0000-0000-0000-000000000005','e@x');
grant usage on schema tst to authenticated;

set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
insert into profiles (id,name,birthdate,gender,interested_in,lat,lng,verified) values (auth.uid(),'Alex','1995-01-01','man','women',52.52,13.40,true);
select tst.check(not verified, 'users cannot verify themselves') from profiles where id = auth.uid();
set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';
insert into profiles (id,name,birthdate,gender,interested_in,lat,lng,first_move) values (auth.uid(),'Bea','1997-05-05','woman','men',52.50,13.45,'me');
set request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';
select tst.fails($$insert into profiles (id,name,birthdate,gender,interested_in) values (auth.uid(),'Kid',current_date - interval '16 years','woman','men')$$, 'minors are rejected');

set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select tst.check((select count(*) from get_deck(18,99,50,'{}',false)) = 1, 'deck shows compatible profile');
select tst.check(not (d ? 'lat') and not (d ? 'hidden'), 'deck hides coordinates and moderation flags') from get_deck(18,99,50,'{}',false) d;
select tst.check((select count(*) from profiles where id <> auth.uid()) = 0, 'profiles not readable before match');
select tst.check(swipe('bbbbbbbb-0000-0000-0000-000000000002','like') is null, 'one-sided like is no match');

set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';
select tst.check((select count(*) from incoming_likes()) = 1, 'incoming like visible');
select tst.check(swipe('aaaaaaaa-0000-0000-0000-000000000001','like') is not null, 'mutual like creates match');

set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select tst.check((select opener from my_matches()) = 'them', 'first-move preference resolved');
select tst.fails($$insert into messages (match_id, sender_id, text) select id, auth.uid(), 'Hi' from matches$$, 'first-move rule enforced');
set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';
insert into messages (match_id, sender_id, text) select id, auth.uid(), 'Hallo' from matches;
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
insert into messages (match_id, sender_id, text) select id, auth.uid(), 'Hey' from matches;
select tst.check((select count(*) from profiles where id <> auth.uid()) = 1, 'matched profile readable');
set request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';
select tst.check((select count(*) from messages) = 0, 'outsiders cannot read chats');
select tst.fails($$select * from moderation_queue$$, 'moderation queue is private');
select tst.fails($$select moderate('aaaaaaaa-0000-0000-0000-000000000001','ban')$$, 'users cannot moderate');

set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select block_user('bbbbbbbb-0000-0000-0000-000000000002');
select tst.check((select count(*) from my_matches()) = 0, 'block removes match');

reset role;
insert into reports (reporter, reported, reason) values
  ('aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002','Spam'),
  ('cccccccc-0000-0000-0000-000000000003','bbbbbbbb-0000-0000-0000-000000000002','Spam');
select tst.check(not hidden, 'two reports do not hide') from profiles where name = 'Bea';
insert into reports (reporter, reported, reason) values ('dddddddd-0000-0000-0000-000000000004','bbbbbbbb-0000-0000-0000-000000000002','Fake');
select tst.check(hidden, 'three reports hide the profile') from profiles where name = 'Bea';
select moderate('bbbbbbbb-0000-0000-0000-000000000002','dismiss');
select tst.check(not hidden, 'moderator can restore') from profiles where name = 'Bea';

set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select delete_account();
reset role;
select tst.check(not exists (select 1 from profiles where name = 'Alex'), 'account deletion removes profile');

-- ───────── tiers, limits, Funken, boosts ─────────
reset role;
insert into auth.users (id) select ('f0000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid from generate_series(1, 70) i;
insert into profiles (id, name, birthdate, gender, interested_in)
  select id, 'T', '1990-01-01', 'woman', 'men' from auth.users where id::text like 'f0000000%';
insert into profiles (id, name, birthdate, gender, interested_in) values ('eeeeeeee-0000-0000-0000-000000000005', 'Eli', '1992-02-02', 'man', 'women');
-- 25 likes + 34 passes already today
insert into swipes (swiper, target, action)
  select 'eeeeeeee-0000-0000-0000-000000000005', id, case when rn <= 25 then 'like' else 'pass' end
  from (select id, row_number() over (order by id) rn from auth.users where id::text like 'f0000000%') x where rn <= 59;

set role authenticated;
set request.jwt.claim.sub = 'eeeeeeee-0000-0000-0000-000000000005';
select tst.check(my_limits()->>'tier' = 'free', 'new users are on the free tier');
select tst.check((my_limits()->>'likes_left')::int = 0, 'free: 25 likes per day counted');
select tst.check((my_limits()->>'swipes_left')::int = 1, 'free: 60 profiles per day counted');
select tst.fails($$select swipe('f0000000-0000-0000-0000-000000000060', 'like')$$, 'free: 26th like blocked');
select tst.check(swipe('f0000000-0000-0000-0000-000000000060', 'pass') is null, 'free: passing allowed until profile limit');
select tst.fails($$select swipe('f0000000-0000-0000-0000-000000000061', 'pass')$$, 'free: 61st profile blocked');
select tst.fails($$select activate_boost()$$, 'free: no boost without credits');
update profiles set premium_until = now() + interval '1 year', vip_until = now() + interval '1 year', boost_credits = 99, funken_credits = 99 where id = auth.uid();
select tst.check(my_limits()->>'tier' = 'free' and (my_limits()->>'funken_credits')::int = 0, 'users cannot grant themselves a tier or credits');
select tst.fails($$select billing_apply('x', auth.uid(), 'INITIAL_PURCHASE', 'matchwerk_vip_1m', 'PLAY_STORE', 17.99, now() + interval '1 month')$$, 'users cannot call billing');

reset role;
select billing_apply('evt1', 'eeeeeeee-0000-0000-0000-000000000005', 'INITIAL_PURCHASE', 'matchwerk_plus_1m', 'PLAY_STORE', 9.99, now() + interval '1 month');
select billing_apply('evt1', 'eeeeeeee-0000-0000-0000-000000000005', 'INITIAL_PURCHASE', 'matchwerk_plus_1m', 'PLAY_STORE', 9.99, now() + interval '1 month');
select tst.check((select count(*) from purchases) = 1, 'webhook events are idempotent');
set role authenticated;
set request.jwt.claim.sub = 'eeeeeeee-0000-0000-0000-000000000005';
select tst.check(my_limits()->>'tier' = 'plus', 'purchase unlocks Matchwerk+');
select tst.check(my_limits()->>'likes_left' is null and (my_limits()->>'swipes_left')::int = 190, 'Plus: unlimited likes, 250 profiles');
select tst.check((my_limits()->>'superlikes_left')::int = 3, 'Plus: 3 Funken per day');
select swipe('f0000000-0000-0000-0000-000000000061', 'like');
select tst.check((my_limits()->>'free_boost_available')::boolean, 'Plus: monthly boost available');
select tst.check(activate_boost() > now(), 'boost activates');
select tst.check(not (my_limits()->>'free_boost_available')::boolean, 'monthly boost used up');
select swipe('f0000000-0000-0000-0000-000000000062', 'superlike');
select swipe('f0000000-0000-0000-0000-000000000063', 'superlike');
select swipe('f0000000-0000-0000-0000-000000000064', 'superlike');
select tst.fails($$select swipe('f0000000-0000-0000-0000-000000000065', 'superlike')$$, 'Plus: 4th Funke blocked without credits');

reset role;
select billing_apply('evt2', 'eeeeeeee-0000-0000-0000-000000000005', 'NON_RENEWING_PURCHASE', 'matchwerk_funken_5', 'PLAY_STORE', 4.99, null);
set role authenticated;
set request.jwt.claim.sub = 'eeeeeeee-0000-0000-0000-000000000005';
select tst.check((my_limits()->>'funken_credits')::int = 5, 'Funken pack adds 5 credits');
select swipe('f0000000-0000-0000-0000-000000000065', 'superlike');
select tst.check((my_limits()->>'funken_credits')::int = 4, 'extra Funke spends a purchased credit');
set request.jwt.claim.sub = 'f0000000-0000-0000-0000-000000000065';
select tst.check((select note is null or not (note ? 'paid') from incoming_likes() limit 1), 'billing flag hidden from receiver');
select tst.check(not (d ? 'premium_until') and not (d ? 'vip_until') and not (d ? 'funken_credits'), 'billing fields stay private') from get_deck(18, 99, 500, '{}', false) d;

reset role;
select billing_apply('evt3', 'eeeeeeee-0000-0000-0000-000000000005', 'INITIAL_PURCHASE', 'matchwerk_vip_1m', 'PLAY_STORE', 17.99, now() + interval '1 month');
set role authenticated;
set request.jwt.claim.sub = 'eeeeeeee-0000-0000-0000-000000000005';
select tst.check(my_limits()->>'tier' = 'vip' and my_limits()->>'swipes_left' is null, 'VIP: unlimited profiles');
select tst.check((my_limits()->>'superlikes_left')::int = 4, 'VIP: 7 Funken per day (3 used)');
reset role;
select billing_apply('evt4', 'eeeeeeee-0000-0000-0000-000000000005', 'EXPIRATION', 'matchwerk_vip_1m', 'PLAY_STORE', null, now());
select tst.check(user_tier('eeeeeeee-0000-0000-0000-000000000005') = 'plus', 'VIP expiry falls back to Plus');
select billing_apply('evt5', 'eeeeeeee-0000-0000-0000-000000000005', 'EXPIRATION', 'matchwerk_plus_1m', 'PLAY_STORE', null, now());
select tst.check(user_tier('eeeeeeee-0000-0000-0000-000000000005') = 'free', 'Plus expiry ends premium');
select billing_apply('evt6', 'eeeeeeee-0000-0000-0000-000000000005', 'NON_RENEWING_PURCHASE', 'matchwerk_boost_5', 'PLAY_STORE', 14.99, null);
select tst.check((select boost_credits from profiles where name = 'Eli') = 5, 'boost pack adds credits');
select tst.check((select count(*) from revenue_daily) = 1, 'revenue view works');

-- ───────── Freunde mode ─────────
reset role;
insert into auth.users (id) values ('99999999-0000-0000-0000-000000000001'),('99999999-0000-0000-0000-000000000002'),('99999999-0000-0000-0000-000000000003');
insert into profiles (id, name, birthdate, gender, interested_in, modes, first_move) values
  ('99999999-0000-0000-0000-000000000001', 'Gerd', '1960-01-01', 'man', 'women', '{dating,friends}', 'them'),
  ('99999999-0000-0000-0000-000000000002', 'Hans', '1962-01-01', 'man', 'women', '{friends}', 'anyone'),
  ('99999999-0000-0000-0000-000000000003', 'Ilse', '1961-01-01', 'woman', 'men', '{dating}', 'anyone');
set role authenticated;
set request.jwt.claim.sub = '99999999-0000-0000-0000-000000000001';
select tst.check((select count(*) from get_deck(18, 99, 500, '{}', false, 30, 'dating') d where d->>'name' = 'Hans') = 0, 'friends-only profiles stay out of Dating');
select tst.check((select count(*) from get_deck(18, 99, 500, '{}', false, 30, 'friends') d where d->>'name' = 'Hans') = 1, 'Freunde shows same-gender friends');
select tst.check((select count(*) from get_deck(18, 99, 500, '{}', false, 30, 'friends') d where d->>'name' = 'Ilse') = 0, 'dating-only profiles stay out of Freunde');
select tst.check((select count(*) from get_deck(18, 99, 500, '{}', false, 30, 'dating') d where d->>'name' = 'Ilse') = 1, 'Dating still works for the same user');
select swipe('99999999-0000-0000-0000-000000000003', 'pass', null, 'dating');
select swipe('99999999-0000-0000-0000-000000000002', 'like', null, 'friends');
set request.jwt.claim.sub = '99999999-0000-0000-0000-000000000003';
select tst.fails($$select swipe('99999999-0000-0000-0000-000000000001', 'like', null, 'friends')$$, 'Freunde needs Freunde mode on both sides');
set request.jwt.claim.sub = '99999999-0000-0000-0000-000000000002';
select tst.check((select count(*) from incoming_likes('friends')) = 1 and (select count(*) from incoming_likes('dating')) = 0, 'likes are kept per mode');
select tst.check(swipe('99999999-0000-0000-0000-000000000001', 'like', null, 'friends') is not null, 'mutual Freunde like creates a connection');
select tst.check((select mode from my_matches()) = 'friends' and (select opener from my_matches()) = 'anyone', 'Freunde connection: anyone may write first');
set request.jwt.claim.sub = '99999999-0000-0000-0000-000000000002';
insert into messages (match_id, sender_id, text) select id, auth.uid(), 'Lust auf Skat?' from matches where mode = 'friends' and '99999999-0000-0000-0000-000000000002' in (user_a, user_b);
select tst.check((select count(*) from messages) >= 1, 'first-move rule not applied to Freunde');

-- ───────── voice messages ─────────
reset role;
grant usage on schema storage to authenticated;
grant execute on all functions in schema storage to authenticated;
grant select, insert, delete on storage.objects to authenticated;
set role authenticated;
set request.jwt.claim.sub = '99999999-0000-0000-0000-000000000002';
select tst.check(
  (select count(*) from (select 1 from matches where mode = 'friends' and auth.uid() in (user_a, user_b)) x) = 1,
  'voice tests: friends match exists');
insert into storage.objects (bucket_id, name)
  select 'voice', id::text || '/' || auth.uid()::text || '/hallo.m4a' from matches where mode = 'friends' and auth.uid() in (user_a, user_b);
select tst.check((select count(*) from storage.objects where bucket_id = 'voice') = 1, 'member can upload voice into own match folder');
select id as voice_match from matches where mode = 'friends' and auth.uid() in (user_a, user_b) \gset
insert into messages (match_id, sender_id, text, kind, audio_path, duration_ms)
  select id, auth.uid(), '', 'voice', id::text || '/' || auth.uid()::text || '/hallo.m4a', 4200 from matches where mode = 'friends' and auth.uid() in (user_a, user_b);
select tst.check((select count(*) from messages where kind = 'voice') = 1, 'voice message can be sent');
select tst.fails($$insert into messages (match_id, sender_id, text, kind, audio_path)
  select id, auth.uid(), '', 'voice', 'someone-else/file.m4a' from matches where mode = 'friends' and auth.uid() in (user_a, user_b)$$, 'voice message must point into its own match folder');
select tst.fails($$insert into messages (match_id, sender_id, text) select id, auth.uid(), '' from matches where mode = 'friends' and auth.uid() in (user_a, user_b)$$, 'empty text message rejected');
set request.jwt.claim.sub = '99999999-0000-0000-0000-000000000001';
select tst.check((select count(*) from storage.objects where bucket_id = 'voice') = 1, 'the other match member can hear it');
set request.jwt.claim.sub = '99999999-0000-0000-0000-000000000003';
select tst.check((select count(*) from storage.objects where bucket_id = 'voice') = 0, 'outsiders cannot list voice messages');
select tst.fails(format($f$insert into storage.objects (bucket_id, name) values ('voice', %L)$f$,
  :'voice_match' || '/99999999-0000-0000-0000-000000000003/x.m4a'), 'outsiders cannot upload into a foreign match');
-- ───────── Aktivitäten (group activities) ─────────
reset role;
insert into auth.users (id, email) values
  ('77777777-0000-0000-0000-000000000001','h@x'),('77777777-0000-0000-0000-000000000002','j@x'),
  ('77777777-0000-0000-0000-000000000003','k@x'),('77777777-0000-0000-0000-000000000004','far@x');
set role authenticated;
set request.jwt.claim.sub = '77777777-0000-0000-0000-000000000001';
insert into profiles (id,name,birthdate,gender,interested_in,lat,lng,city,modes) values (auth.uid(),'Hanna','1960-02-02','woman','men',48.10,11.60,'München','{friends}');
select create_activity('hike', 'Sonntagswanderung', 'Gemütlich, ca. 10 km', now() + interval '2 days', 'Parkplatz am See', 2) as act \gset
select tst.check((select (a->>'is_host')::boolean and (a->>'member_count')::int = 1 from get_activities(50) a), 'host is a member of the new activity');
select tst.check(not (get_activity(:'act') ? 'lat') and get_activity(:'act')->'host' ? 'name', 'activity shows host card but no coordinates');
select tst.fails($$select create_activity('food', 'Pizza', '', now() + interval '3 days', 'Bei Toni', 4)$$, 'free users host one activity at a time');
select tst.fails($$select create_activity('food', 'Gestern', '', now() - interval '1 day', 'Bei Toni', 4)$$, 'no activities in the past');
select tst.fails($$insert into activities (host_id, category, title, starts_at, place) values (auth.uid(), 'other', 'Direkt', now() + interval '1 day', 'Hier')$$, 'activities cannot be inserted directly');

set request.jwt.claim.sub = '77777777-0000-0000-0000-000000000002';
insert into profiles (id,name,birthdate,gender,interested_in,lat,lng,modes) values (auth.uid(),'Jonas','1999-03-03','man','women',48.12,11.58,'{dating}');
select tst.check((select count(*) from get_activities(50)) = 1, 'nearby activity is listed – for every age and mode');
select tst.check((select count(*) from activity_messages) = 0, 'group chat hidden before joining');
select tst.fails(format('insert into activity_messages (activity_id, sender_id, text) values (%L, auth.uid(), %L)', :'act', 'Hi'), 'non-members cannot post');
select join_activity(:'act');
select tst.check((get_activity(:'act')->>'member_count')::int = 2 and (get_activity(:'act')->>'joined')::boolean, 'joining works');
insert into activity_messages (activity_id, sender_id, text) values (:'act', auth.uid(), 'Ich bring Kaffee mit!');
select tst.check((select count(*) from activity_messages) = 1, 'members can chat');

set request.jwt.claim.sub = '77777777-0000-0000-0000-000000000003';
insert into profiles (id,name,birthdate,gender,interested_in,lat,lng) values (auth.uid(),'Kim','1990-04-04','nonbinary','everyone',48.11,11.61);
select tst.fails(format('select join_activity(%L)', :'act'), 'full activities cannot be joined');
set request.jwt.claim.sub = '77777777-0000-0000-0000-000000000004';
insert into profiles (id,name,birthdate,gender,interested_in,lat,lng) values (auth.uid(),'Fern','1990-04-04','woman','men',53.55,9.99);
select tst.check((select count(*) from get_activities(50)) = 0, 'activities far away are not listed');

set request.jwt.claim.sub = '77777777-0000-0000-0000-000000000002';
select tst.fails(format('select cancel_activity(%L)', :'act'), 'only the host can cancel');
select leave_activity(:'act');
select tst.check((select count(*) from activity_messages) = 0, 'after leaving the chat is closed again');

set request.jwt.claim.sub = '77777777-0000-0000-0000-000000000003';
select join_activity(:'act');
select tst.check((get_activity(:'act')->>'member_count')::int = 2, 'free spot can be taken again');
set request.jwt.claim.sub = '77777777-0000-0000-0000-000000000001';
select block_user('77777777-0000-0000-0000-000000000003');
select tst.check((get_activity(:'act')->>'member_count')::int = 1, 'blocking removes the person from my activity');
set request.jwt.claim.sub = '77777777-0000-0000-0000-000000000003';
select tst.check(get_activity(:'act') is null and (select count(*) from get_activities(50)) = 0, 'blocked person no longer sees the activity');
select tst.fails(format('select join_activity(%L)', :'act'), 'blocked person cannot rejoin');

set request.jwt.claim.sub = '77777777-0000-0000-0000-000000000001';
select cancel_activity(:'act');
select tst.fails(format('insert into activity_messages (activity_id, sender_id, text) values (%L, auth.uid(), %L)', :'act', 'Noch da?'), 'no messages in cancelled activities');
select tst.fails(format('select activity_json(a, p, true) from activities a, profiles p where a.id = %L limit 1', :'act'), 'internal activity helpers are not callable');
select tst.check(create_activity('coffee', 'Kaffee am Markt', '', now() + interval '1 day', 'Marktcafé', 6) is not null, 'after cancelling a new activity can be hosted');
-- ───────── activity covers, invites, "Macht mit bei" ─────────
set request.jwt.claim.sub = '99999999-0000-0000-0000-000000000002';
select tst.fails($$select create_activity('hike', 'Mit fremdem Bild', '', now() + interval '1 day', 'Wald', 5, 'https://evil.example/x.jpg')$$, 'cover must be an own uploaded photo');
select create_activity('hike', 'Mit eigenem Bild', '', now() + interval '1 day', 'Wald', 5,
  'https://p.supabase.co/storage/v1/object/public/photos/99999999-0000-0000-0000-000000000002/cover.jpg') as cov \gset
select tst.check(get_activity(:'cov')->>'cover_url' like '%/cover.jpg', 'own cover photo is stored');
insert into messages (match_id, sender_id, text, kind, activity_id)
  select id, auth.uid(), 'Kommst du mit?', 'invite', :'cov' from matches where mode = 'friends' and auth.uid() in (user_a, user_b);
select tst.check((select count(*) from messages where kind = 'invite' and activity_id = :'cov') = 1, 'match can be invited to an activity');
select tst.fails($$insert into messages (match_id, sender_id, text, kind) select id, auth.uid(), '', 'invite' from matches where mode = 'friends' and auth.uid() in (user_a, user_b)$$, 'invite needs an activity');
set request.jwt.claim.sub = '99999999-0000-0000-0000-000000000001';
select tst.check((select count(*) from person_activities('99999999-0000-0000-0000-000000000002')) = 1, 'profile shows "Macht mit bei"');
select tst.check(get_activity(:'cov') is not null, 'invited person can open the activity');
set request.jwt.claim.sub = '99999999-0000-0000-0000-000000000002';
select cancel_activity(:'cov');
select tst.fails(format($f$insert into messages (match_id, sender_id, text, kind, activity_id) select id, auth.uid(), '', 'invite', %L from matches where mode = 'friends' and auth.uid() in (user_a, user_b)$f$, :'cov'), 'no invites to cancelled activities');
set request.jwt.claim.sub = '99999999-0000-0000-0000-000000000001';
select tst.check((select count(*) from person_activities('99999999-0000-0000-0000-000000000002')) = 0, 'cancelled activities leave the profile');
-- ───────── seeking, traits & dealbreakers ─────────
reset role;
insert into auth.users (id, email) values
  ('66666666-0000-0000-0000-000000000001','s1@x'),('66666666-0000-0000-0000-000000000002','s2@x'),('66666666-0000-0000-0000-000000000003','s3@x');
set role authenticated;
set request.jwt.claim.sub = '66666666-0000-0000-0000-000000000001';
insert into profiles (id,name,birthdate,gender,interested_in,seeking,lat,lng,traits,prefs)
  values (auth.uid(),'Noa','1994-01-01','nonbinary','everyone','{woman,nonbinary}',-33.80,151.00,'{"smoking":"never","kidsWish":"want"}','{"nonSmokerOnly":true,"kidsMatch":true}');
select tst.fails($$update profiles set seeking = '{aliens}' where id = auth.uid()$$, 'seeking only allows known genders');
set request.jwt.claim.sub = '66666666-0000-0000-0000-000000000002';
insert into profiles (id,name,birthdate,gender,interested_in,seeking,lat,lng,traits)
  values (auth.uid(),'Ida','1995-02-02','woman','everyone','{nonbinary}',-33.81,151.01,'{"smoking":"never","kidsWish":"open"}');
set request.jwt.claim.sub = '66666666-0000-0000-0000-000000000003';
insert into profiles (id,name,birthdate,gender,interested_in,seeking,lat,lng,traits)
  values (auth.uid(),'Rae','1996-03-03','woman','everyone','{nonbinary}',-33.82,151.02,'{"smoking":"yes"}');
set request.jwt.claim.sub = '66666666-0000-0000-0000-000000000001';
select tst.check((select count(*) from get_deck(18,99,50,'{}',false)) = 1
  and (select d->>'name' from get_deck(18,99,50,'{}',false) d) = 'Ida', 'seeking + non-smoker dealbreaker filter the deck');
set request.jwt.claim.sub = '66666666-0000-0000-0000-000000000003';
select tst.check((select count(*) from get_deck(18,99,50,'{}',false)) = 0, 'dealbreakers work in both directions');
set request.jwt.claim.sub = '66666666-0000-0000-0000-000000000002';
update profiles set traits = '{"smoking":"never","kidsWish":"no"}' where id = auth.uid();
set request.jwt.claim.sub = '66666666-0000-0000-0000-000000000001';
select tst.check((select count(*) from get_deck(18,99,50,'{}',false)) = 0, 'different Kinderwunsch hidden when it matters');
\echo ALL DATABASE CHECKS PASSED
