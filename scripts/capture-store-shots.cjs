// Captures raw app screens for the store screenshots from the web build in demo mode.
// 1) EXPO_PUBLIC_SUPABASE_URL= EXPO_PUBLIC_SUPABASE_ANON_KEY= npx expo start --web --port 8086
// 2) node scripts/capture-store-shots.cjs   3) python3 scripts/compose-store-shots.py /tmp/claude-0/store2
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const me = { id: 'me', name: 'Alex', birthdate: '1992-03-14', gender: 'man', interestedIn: 'women', bio: 'Neugierig, Kaffee-Liebhaber, Wochenend-Wanderer.', photos: ['https://i.pravatar.cc/800?img=12','https://picsum.photos/seed/alex-a/800/1000','https://picsum.photos/seed/alex-b/800/1000'], prompts: [{ question: 'Ein perfekter Sonntag sieht so aus …', answer: 'Lange frühstücken, dann raus.' }], interests: ['Kaffee', 'Wandern', 'Design', 'Kochen', 'Brettspiele'], intention: 'long_term', verified: true, firstMove: 'anyone', paused: false, lat: 52.52, lng: 13.4, city: 'Berlin', job: 'Produktdesigner', heightCm: 182, modes: ['dating','friends'] };
  const mk = async (mode = 'dating') => {
    const ctx = await b.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 3 });
    await ctx.addInitScript(([s, m]) => { if (!localStorage.getItem('matchwerk.demo.v1')) { localStorage.setItem('matchwerk.demo.v1', s); localStorage.setItem('matchwerk.mode', m); } }, [JSON.stringify({ signedIn: true, me, swipes: {}, matches: [], messages: [], blocked: [], likeLog: [], boostCredits: 0 }), mode]);
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); return p;
  };
  const shot = async (p, n) => { await p.waitForTimeout(1500); await p.screenshot({ path: `/tmp/claude-0/store2/${n}.png` }); };
  const scroll = (p, y) => p.evaluate((y) => { const s = [...document.querySelectorAll('div')].find(d => getComputedStyle(d).overflowY === 'auto' && d.scrollHeight > d.clientHeight + 200); if (s) s.scrollTop = y; }, y);
  let p = await mk();
  await p.goto('http://localhost:8086', { waitUntil: 'networkidle' }); await p.waitForTimeout(3500);
  await shot(p, '1-discover');
  await scroll(p, 700); await shot(p, '2-why');
  await p.getByLabel('Auf diese Antwort reagieren').first().click(); await p.waitForTimeout(800);
  await p.getByPlaceholder(/Schreib etwas dazu/).fill('Flohmarkt und Pasta? Da bin ich dabei!');
  await shot(p, '3-comment');
  await p.getByText('Mit Kommentar senden').click(); await p.waitForTimeout(1200);
  await p.getByText('Likes', { exact: true }).first().click(); await shot(p, '4-likes');
  await p.getByText(/Amara/).first().click(); await p.waitForTimeout(1500);
  await p.getByLabel('Like', { exact: true }).last().click(); await p.waitForTimeout(2500);
  await shot(p, '5-match');
  await p.getByText('Zum Chat').click(); await p.waitForTimeout(7000);
  await p.getByPlaceholder('Nachricht schreiben …').fill('Catan-Revanche diese Woche? 😄');
  await p.getByLabel('Senden', { exact: true }).click(); await p.waitForTimeout(4000);
  await shot(p, '6-chat');
  p = await mk('friends');
  await p.goto('http://localhost:8086', { waitUntil: 'networkidle' }); await p.waitForTimeout(3500);
  await shot(p, '7-friends');
  await p.goto('http://localhost:8086/premium', { waitUntil: 'networkidle' }); await shot(p, '8-premium');
  console.log(errs.join(' | ') || 'no errors');
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
