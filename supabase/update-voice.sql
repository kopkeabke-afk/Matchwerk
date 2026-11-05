-- Matchwerk: Sprachnachrichten (Migration 0007)
-- Einmal im Supabase SQL-Editor ausführen (New query → einfügen → Run). Kann gefahrlos mehrfach laufen.

-- Matchwerk – voice messages in chats.
-- Audio files live in the private "voice" bucket under <match id>/<sender id>/<file>.m4a and are readable
-- only by the two people of that match (signed URLs). Unmatching or blocking removes the access.

alter table public.messages
  add column if not exists kind text not null default 'text' check (kind in ('text','voice')),
  add column if not exists audio_path text,
  add column if not exists duration_ms int check (duration_ms between 0 and 61000);

alter table public.messages drop constraint if exists messages_text_check;
alter table public.messages drop constraint if exists messages_content_check;
alter table public.messages add constraint messages_content_check check (
  (kind = 'text' and char_length(text) between 1 and 2000)
  or (kind = 'voice' and audio_path is not null and char_length(text) <= 2000)
);

insert into storage.buckets (id, name, public) values ('voice', 'voice', false) on conflict (id) do nothing;

create or replace function public.is_match_member(match_text text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from matches m where m.id::text = match_text and auth.uid() in (m.user_a, m.user_b))
$$;
grant execute on function public.is_match_member(text) to authenticated;

drop policy if exists "upload voice to own match" on storage.objects;
create policy "upload voice to own match" on storage.objects for insert to authenticated
  with check (bucket_id = 'voice'
    and public.is_match_member((storage.foldername(name))[1])
    and (storage.foldername(name))[2] = auth.uid()::text);

drop policy if exists "match members hear voice" on storage.objects;
create policy "match members hear voice" on storage.objects for select to authenticated
  using (bucket_id = 'voice' and public.is_match_member((storage.foldername(name))[1]));

drop policy if exists "delete own voice" on storage.objects;
create policy "delete own voice" on storage.objects for delete to authenticated
  using (bucket_id = 'voice' and (storage.foldername(name))[2] = auth.uid()::text);

-- a voice message must point to a file of its own match, uploaded by the sender
create or replace function public.voice_guard() returns trigger language plpgsql as $$
begin
  if new.kind = 'voice' and new.audio_path not like new.match_id::text || '/' || new.sender_id::text || '/%' then
    raise exception 'invalid audio path';
  end if;
  return new;
end $$;
drop trigger if exists voice_guard on public.messages;
create trigger voice_guard before insert on public.messages for each row execute function public.voice_guard();
