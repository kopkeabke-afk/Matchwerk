// Supabase Edge Function: sends Expo push notifications for new messages, matches and group-chat messages.
// Wire it up in Dashboard → Database → Webhooks: on INSERT of public.messages, public.matches and public.activity_messages,
// POST to this function with header `x-webhook-secret: <WEBHOOK_SECRET>`.
import { createClient } from 'npm:@supabase/supabase-js@2';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

async function push(userId: string, title: string, body: string, data: Record<string, unknown>) {
  const { data: row } = await sb.from('push_tokens').select('token').eq('user_id', userId).maybeSingle();
  if (!row?.token) return;
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ to: row.token, title, body, data, sound: 'default' }),
  });
}

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('WEBHOOK_SECRET')) {
    return new Response('forbidden', { status: 403 });
  }
  const { table, record } = await req.json();

  if (table === 'messages') {
    const { data: m } = await sb.from('matches').select('user_a,user_b').eq('id', record.match_id).single();
    if (!m) return new Response('ok');
    const to = m.user_a === record.sender_id ? m.user_b : m.user_a;
    const { data: sender } = await sb.from('profiles').select('name').eq('id', record.sender_id).single();
    await push(to, sender?.name ?? 'Neue Nachricht', record.kind === 'voice' ? '🎤 Sprachnachricht' : String(record.text).slice(0, 120), { url: `/chat/${record.match_id}` });
  }

  if (table === 'matches') {
    for (const uid of [record.user_a, record.user_b]) {
      await push(uid, 'Es funkt! ✨', 'Ihr mögt euch gegenseitig – sag Hallo.', { url: `/chat/${record.id}` });
    }
  }
  if (table === 'activity_messages') {
    const [{ data: act }, { data: members }, { data: sender }] = await Promise.all([
      sb.from('activities').select('title').eq('id', record.activity_id).single(),
      sb.from('activity_members').select('user_id').eq('activity_id', record.activity_id),
      sb.from('profiles').select('name').eq('id', record.sender_id).single(),
    ]);
    for (const m of members ?? []) {
      if (m.user_id === record.sender_id) continue;
      await push(m.user_id, act?.title ?? 'Gruppenchat', `${sender?.name ?? 'Jemand'}: ${String(record.text).slice(0, 110)}`,
        { url: `/activity/chat/${record.activity_id}` });
    }
  }
  return new Response('ok');
});
