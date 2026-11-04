// Live check against the real Supabase project with a test account.
// Usage: node scripts/check-supabase.cjs <email> <password>
// Reads EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY from .env. Leaves the account's profile in place.
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const env = Object.fromEntries(fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const U = env.EXPO_PUBLIC_SUPABASE_URL, K = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const [email, password] = process.argv.slice(2);
const IMG = path.join(__dirname, '..', 'assets', 'images', 'icon.png');
const sb = createClient(U, K, { auth: { persistSession: false } });
let fails = 0;
const ok = (cond, what, extra = '') => { console.log(`${cond ? '✅' : '❌'} ${what}${extra ? ' – ' + extra : ''}`); if (!cond) fails++; };
(async () => {
  const { data: s, error: e1 } = await sb.auth.signInWithPassword({ email, password });
  ok(!e1 && s.user, 'Anmeldung mit Passwort', e1?.message);
  if (e1) process.exit(1);
  const me = s.user.id;

  // photos (same way the app uploads: own folder, no overwrite)
  const testPath = `${me}/check-${Date.now()}.png`;
  const { error: eUp } = await sb.storage.from('photos').upload(testPath, fs.readFileSync(IMG), { contentType: 'image/png', upsert: false });
  ok(!eUp, 'Foto hochladen', eUp?.message);
  const head = await fetch(sb.storage.from('photos').getPublicUrl(testPath).data.publicUrl);
  ok(head.status === 200, 'Foto öffentlich abrufbar', String(head.status));
  const { data: own } = await sb.storage.from('photos').list(me);
  const listed = (own ?? []).some((f) => testPath.endsWith(f.name));
  ok(listed, 'Eigene Fotos auflisten (nötig für Konto löschen)');
  // remove leftovers from earlier runs, too
  const leftovers = (own ?? []).filter((f) => f.name.startsWith('check-')).map((f) => `${me}/${f.name}`);
  if (leftovers.length) await sb.storage.from('photos').remove(leftovers);
  const { error: eDel } = await sb.storage.from('photos').remove([testPath]);
  const { data: own2 } = await sb.storage.from('photos').list(me);
  ok(listed && !eDel && !(own2 ?? []).some((f) => testPath.endsWith(f.name)), 'Eigenes Foto löschen', eDel?.message);
  const { error: eFolder } = await sb.storage.from('photos').upload('00000000-0000-0000-0000-000000000000/hack.png', fs.readFileSync(IMG), { contentType: 'image/png' });
  ok(!!eFolder, 'Upload in fremden Ordner wird blockiert', eFolder?.message);

  // profile
  const profile = {
    id: me, name: 'Testkonto', birthdate: '1995-05-05', gender: 'man', interested_in: 'everyone',
    bio: 'Test-Konto für die App-Prüfung. Hier gibt es nichts Echtes zu sehen.',
    prompts: [{ question: 'Ein perfekter Sonntag sieht so aus …', answer: 'Apps testen und danach Pasta.' }, { question: 'Mein größter Green Flag:', answer: 'Ich melde Bugs sofort.' }],
    interests: ['Tech', 'Kaffee', 'Wandern'], intention: 'unsure', city: 'Berlin', lat: 52.52, lng: 13.4, first_move: 'anyone', modes: ['dating', 'friends'],
  };
  const { data: p, error: e2 } = await sb.from('profiles').upsert(profile).select('*').single();
  ok(!e2 && p?.name === 'Testkonto', 'Profil speichern', e2?.message);
  const { error: e3 } = await sb.from('profiles').upsert({ ...profile, birthdate: '2015-01-01' });
  ok(!!e3, 'Minderjährige werden abgelehnt', e3?.message);

  // privilege escalation attempts
  await sb.from('profiles').update({ verified: true, premium_until: '2099-01-01', boost_credits: 99, hidden: false }).eq('id', me);
  const { data: p2 } = await sb.from('profiles').select('verified,premium_until,boost_credits').eq('id', me).single();
  ok(p2 && !p2.verified && !p2.premium_until && p2.boost_credits === 0, 'Selbst-Verifizierung / Gratis-Premium wird ignoriert');
  const { error: e4 } = await sb.from('moderation_queue').select('*');
  ok(!!e4, 'Moderations-Warteschlange gesperrt', e4?.message);
  const { error: e5 } = await sb.rpc('billing_apply', { event_id: 'x', uid: me, kind: 'INITIAL_PURCHASE', product: 'matchwerk_plus_1m', store_name: 'PLAY_STORE', price: 1, expires: '2099-01-01' });
  ok(!!e5, 'Kauf-Funktion für Nutzer gesperrt', e5?.message);

  // app RPCs
  const { data: lim, error: e6 } = await sb.rpc('my_limits');
  ok(!e6 && lim.tier === 'free' && lim.likes_left <= 25 && lim.swipes_left <= 60 && lim.superlikes_left <= 1, 'Gratis-Stufe (25 Likes, 60 Profile, 1 Funke pro Tag)', e6?.message ?? `noch ${lim.swipes_left} Profile, ${lim.likes_left} Likes, ${lim.superlikes_left} Funke heute`);
  const { data: deck, error: e7 } = await sb.rpc('get_deck', { min_age: 18, max_age: 99, max_km: 500, intentions: [], verified_only: false, lim: 30 });
  ok(!e7 && Array.isArray(deck), 'Profil-Stapel laden', e7?.message ?? `${deck.length} andere Profile`);
  const { data: fdeck, error: e7b } = await sb.rpc('get_deck', { min_age: 18, max_age: 99, max_km: 500, intentions: [], verified_only: false, lim: 30, mode: 'friends' });
  ok(!e7b && Array.isArray(fdeck), 'Freunde-Stapel laden', e7b?.message ?? `${fdeck.length} andere Profile`);
  const { data: likes, error: e8 } = await sb.rpc('incoming_likes');
  ok(!e8 && Array.isArray(likes), 'Likes laden', e8?.message);
  const { data: matches, error: e9 } = await sb.rpc('my_matches');
  ok(!e9 && Array.isArray(matches), 'Matches laden', e9?.message);
  const { error: e10 } = await sb.rpc('activate_boost');
  ok(!!e10 && /LIMIT:boost/.test(e10.message), 'Boost ohne Matchwerk+ gesperrt', e10?.message);
  const { error: e11 } = await sb.from('push_tokens').upsert({ user_id: me, token: 'ExponentPushToken[test]' });
  ok(!e11, 'Push-Token speichern', e11?.message);
  await sb.from('push_tokens').delete().eq('user_id', me);

  // realtime channel subscribe
  const status = await new Promise((res) => {
    const ch = sb.channel('t').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {}).subscribe((st) => { if (st !== 'CLOSED') { res(st); sb.removeChannel(ch); } });
    setTimeout(() => res('TIMEOUT'), 10000);
  });
  ok(status === 'SUBSCRIBED', 'Echtzeit-Chat verbunden', status);

  await sb.auth.signOut();
  console.log(fails ? `\n${fails} Prüfung(en) fehlgeschlagen` : '\nAlle Prüfungen bestanden');
  process.exit(fails ? 1 : 0);
})();
