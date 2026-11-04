// Builds the public website (privacy policy, terms, safety, account deletion) for GitHub Pages
// from the same texts the app shows (src/constants/legal.ts + app.ts).
// Usage: node --experimental-strip-types scripts/build-site.mjs  → writes ./site
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), 'utf8');

// legal.ts imports ./app without extension; inline both into one module Node can strip-load
const mod = join(tmpdir(), `matchwerk-legal-${process.pid}.mts`);
writeFileSync(mod, read('src/constants/app.ts') + '\n' + read('src/constants/legal.ts').replace(/^import .*$/m, ''));
const { APP, LEGAL } = await import(pathToFileURL(mod).href);
rmSync(mod);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const NAV = [['index.html', 'Start'], ['datenschutz.html', 'Datenschutz'], ['agb.html', 'Nutzungsbedingungen'], ['sicherheit.html', 'Sicherheit'], ['konto-loeschen.html', 'Konto löschen']];

const page = (file, title, body) => `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · ${esc(APP.name)}</title>
<link rel="icon" href="logo.png">
<meta property="og:image" content="${esc(APP.site)}/feature.png">
<meta name="description" content="${esc(APP.name)} – die Dating-App, bei der du siehst, warum ihr zusammenpasst.">
<style>
:root{--bg:#fbf8ff;--fg:#22171a;--muted:#6f5e64;--line:#e6dcf2;--accent:#7a2bb8;--card:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#161013;--fg:#f7ebee;--muted:#b39fa5;--line:#3a2c31;--accent:#c39bff;--card:#20171b}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:17px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
.wrap{max-width:760px;margin:0 auto;padding:32px max(16px,env(safe-area-inset-left))}
header{display:flex;flex-wrap:wrap;gap:12px 20px;align-items:center;justify-content:space-between;margin-bottom:32px}
.logo{font-weight:900;font-size:26px;color:var(--accent);text-decoration:none;letter-spacing:-.5px}
nav{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:15px}nav a{color:var(--muted);text-decoration:none}nav a[aria-current]{color:var(--fg);font-weight:700}
h1{font-size:clamp(30px,6vw,44px);line-height:1.1;margin:0 0 12px}h2{font-size:20px;margin:28px 0 6px}
p{margin:0 0 12px;color:var(--muted)}a{color:var(--accent)}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;margin:20px 0}
footer{margin-top:48px;padding-top:20px;border-top:1px solid var(--line);font-size:14px;color:var(--muted)}
ol li{margin-bottom:8px;color:var(--muted)}
</style></head><body><div class="wrap">
<header><a class="logo" href="index.html"><img src="logo.png" alt="" width="40" height="40" style="vertical-align:middle;border-radius:10px;margin-right:8px">Matchwerk</a><nav>${NAV.map(([f, l]) => `<a href="${f}"${f === file ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav></header>
<main>${body}</main>
<footer>${esc(APP.company)} · ${esc(APP.address)} · <a href="mailto:${esc(APP.supportEmail)}">${esc(APP.supportEmail)}</a></footer>
</div></body></html>
`;

const legalPage = (key) => {
  const d = LEGAL[key];
  return `<h1>${esc(d.title)}</h1><p>Stand: ${new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</p>`
    + d.sections.map(([h, b]) => `<h2>${esc(h)}</h2><p>${esc(b)}</p>`).join('');
};

const out = join(root, 'site');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const pages = {
  'index.html': ['Dating und neue Freunde', `<img src="feature.png" alt="Matchwerk – ${esc(APP.slogan)}" style="width:100%;border-radius:16px;margin-bottom:20px"><h1>${esc(APP.slogan)}</h1>
<p>${esc(APP.name)} zeigt dir, warum ihr zusammenpasst: transparenter Match-Score, Reaktionen auf einzelne Fotos und Antworten, Dating oder neue Freunde – und sehen, wer dich mag, ist kostenlos.</p>
<div class="card"><h2 style="margin-top:0">Bald bei Google Play</h2><p><a href="${esc(APP.playStoreUrl)}">${esc(APP.name)} bei Google Play ansehen</a></p></div>
<h2>Sicherheit zuerst</h2><p>Verifizierte Profile, Melden und Blockieren in jedem Chat, Moderation innerhalb von 24 Stunden. Kein Werbe-Tracking.</p>`],
  'datenschutz.html': ['Datenschutzerklärung', legalPage('privacy')],
  'agb.html': ['Nutzungsbedingungen', legalPage('terms')],
  'sicherheit.html': ['Sicherheits-Center', legalPage('safety')],
  'konto-loeschen.html': ['Konto löschen', `<h1>Konto und Daten löschen</h1>
<p>Du kannst dein ${esc(APP.name)}-Konto jederzeit selbst löschen. Dabei werden dein Profil, deine Fotos, Likes, Matches und Nachrichten endgültig entfernt.</p>
<h2>In der App (sofort)</h2><ol><li>App öffnen und unten auf <b>Profil</b> tippen.</li><li>Oben rechts das Zahnrad <b>Einstellungen</b> öffnen.</li><li><b>Konto löschen</b> wählen und bestätigen.</li></ol>
<h2>Ohne App</h2><p>Schreib uns von der E-Mail-Adresse bzw. mit der Telefonnummer oder dem Google-Konto, mit dem du angemeldet bist, an <a href="mailto:${esc(APP.supportEmail)}?subject=Konto%20l%C3%B6schen">${esc(APP.supportEmail)}</a>. Wir löschen dein Konto innerhalb von 30 Tagen und bestätigen dir das.</p>
<h2>Was aufbewahrt wird</h2><p>Meldungen über Regelverstöße bewahren wir zur Missbrauchsbekämpfung bis zu 12 Monate pseudonymisiert auf. Kaufbelege speichern Google bzw. Apple nach ihren eigenen Regeln. Ein laufendes Abo kündigst du in Google Play unter Abos.</p>`],
};
for (const [file, [title, body]] of Object.entries(pages)) writeFileSync(join(out, file), page(file, title, body));
writeFileSync(join(out, '.nojekyll'), '');
copyFileSync(join(root, 'assets/brand/play-icon-512.png'), join(out, 'logo.png'));
copyFileSync(join(root, 'assets/brand/feature-graphic-1024x500.png'), join(out, 'feature.png'));
console.log(`site/: ${Object.keys(pages).join(', ')}`);
