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
\echo ALL DATABASE CHECKS PASSED
