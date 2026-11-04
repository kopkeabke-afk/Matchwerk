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

-- ───────── premium, limits, boosts ─────────
reset role;
insert into auth.users (id) select ('f0000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid from generate_series(1, 52) i;
insert into profiles (id, name, birthdate, gender, interested_in)
  select id, 'T', '1990-01-01', 'woman', 'men' from auth.users where id::text like 'f0000000%';
insert into profiles (id, name, birthdate, gender, interested_in) values ('eeeeeeee-0000-0000-0000-000000000005', 'Eli', '1992-02-02', 'man', 'women');
insert into swipes (swiper, target, action)
  select 'eeeeeeee-0000-0000-0000-000000000005', id, 'like' from auth.users where id::text like 'f0000000%' order by id limit 50;

set role authenticated;
set request.jwt.claim.sub = 'eeeeeeee-0000-0000-0000-000000000005';
select tst.check((my_limits()->>'likes_left')::int = 0, 'free plan: 50 likes per day counted');
select tst.fails($$select swipe('f0000000-0000-0000-0000-000000000052', 'like')$$, 'free plan: 51st like blocked');
select tst.check(swipe('f0000000-0000-0000-0000-000000000052', 'pass') is null, 'free plan: passing still allowed');
select tst.fails($$select activate_boost()$$, 'free plan: no boost without credits');
update profiles set premium_until = now() + interval '1 year', boost_credits = 99 where id = auth.uid();
select tst.check(not (my_limits()->>'premium')::boolean, 'users cannot grant themselves premium');
select tst.fails($$select billing_apply('x', auth.uid(), 'INITIAL_PURCHASE', 'plus_monthly', 'app_store', 7.99, now() + interval '1 month')$$, 'users cannot call billing');

reset role;
select billing_apply('evt1', 'eeeeeeee-0000-0000-0000-000000000005', 'INITIAL_PURCHASE', 'funke_plus_1m', 'APP_STORE', 7.99, now() + interval '1 month');
select billing_apply('evt1', 'eeeeeeee-0000-0000-0000-000000000005', 'INITIAL_PURCHASE', 'funke_plus_1m', 'APP_STORE', 7.99, now() + interval '1 month');
select tst.check((select count(*) from purchases) = 1, 'webhook events are idempotent');
set role authenticated;
set request.jwt.claim.sub = 'eeeeeeee-0000-0000-0000-000000000005';
select tst.check((my_limits()->>'premium')::boolean, 'purchase unlocks funke+');
select tst.check(my_limits()->>'likes_left' is null, 'funke+: unlimited likes');
select swipe('f0000000-0000-0000-0000-000000000051', 'like');
select tst.check((my_limits()->>'free_boost_available')::boolean, 'funke+: weekly boost available');
select tst.check(activate_boost() > now(), 'boost activates');
select tst.check(not (my_limits()->>'free_boost_available')::boolean, 'weekly boost used up');
set request.jwt.claim.sub = 'f0000000-0000-0000-0000-000000000001';
select tst.check(not (d ? 'premium_until') and not (d ? 'boost_credits'), 'billing fields stay private') from get_deck(18, 99, 500, '{}', false) d;
reset role;
select billing_apply('evt2', 'eeeeeeee-0000-0000-0000-000000000005', 'EXPIRATION', 'funke_plus_1m', 'APP_STORE', null, now());
select tst.check(not is_premium('eeeeeeee-0000-0000-0000-000000000005'), 'expiration ends funke+');
select billing_apply('evt3', 'eeeeeeee-0000-0000-0000-000000000005', 'NON_RENEWING_PURCHASE', 'funke_boost_5', 'PLAY_STORE', 9.99, null);
select tst.check((select boost_credits from profiles where name = 'Eli') = 5, 'boost pack adds credits');
select tst.check((select count(*) from revenue_daily) = 1, 'revenue view works');
\echo ALL DATABASE CHECKS PASSED
