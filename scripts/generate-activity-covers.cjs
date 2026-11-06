// Draws the default cover image of each activity category (Noto Color Emoji on Matchwerk colours).
// Run: NODE_PATH=$(npm root -g) node scripts/generate-activity-covers.cjs, then scale the PNGs to assets/activities/*.jpg (960x600).
const { chromium } = require('playwright');
const C = {
  coffee:  { main: '☕', side: ['🥐', '🍰', '📖'], a: '#6B3A2A', b: '#2A0E3F', glow: '#E9A92E', land: 'cafe' },
  hike:    { main: '🥾', side: ['🌲', '⛰️', '🌤️'], a: '#2F6B4F', b: '#2A0E3F', glow: '#9BE3B5', land: 'mountains' },
  drinks:  { main: '🍻', side: ['🌇', '🥨', '✨'], a: '#B8642A', b: '#3A1358', glow: '#FFB938', land: 'city' },
  games:   { main: '🎲', side: ['♟️', '🃏', '🧩'], a: '#3B3FA8', b: '#2A0E3F', glow: '#9AA8FF', land: 'table' },
  sport:   { main: '🏃', side: ['⚽', '🚴', '🏸'], a: '#1F7A8C', b: '#2A0E3F', glow: '#7EE0F0', land: 'track' },
  culture: { main: '🎨', side: ['🎭', '🎵', '🖼️'], a: '#9B2F6B', b: '#2A0E3F', glow: '#FF9BD0', land: 'stage' },
  food:    { main: '🍝', side: ['🍕', '🥗', '🍷'], a: '#A8432E', b: '#3A1358', glow: '#FFC07A', land: 'table' },
  other:   { main: '✨', side: ['🎉', '🎈', '💜'], a: '#7B3FBF', b: '#2A0E3F', glow: '#E9A92E', land: 'hills' },
};
const lands = {
  mountains: `<div class="m" style="left:-10%;width:70%;height:55%;background:#1d4a39;clip-path:polygon(0 100%,45% 10%,100% 100%)"></div>
              <div class="m" style="left:35%;width:80%;height:68%;background:#163a2e;clip-path:polygon(0 100%,50% 0,100% 100%)"></div>
              <div class="m" style="left:52%;width:16%;height:18%;bottom:50%;background:#e9f5ee;clip-path:polygon(0 100%,50% 0,100% 100%);opacity:.85"></div>`,
  hills: `<div class="m" style="left:-20%;width:90%;height:40%;background:#3A1358;border-radius:50% 50% 0 0"></div>
          <div class="m" style="left:40%;width:90%;height:32%;background:#2A0E3F;border-radius:50% 50% 0 0"></div>`,
  city: `<div class="m" style="left:0;width:100%;height:38%;background:linear-gradient(#1b0a28,#120618);clip-path:polygon(0 40%,8% 40%,8% 15%,16% 15%,16% 35%,24% 35%,24% 0,33% 0,33% 30%,42% 30%,42% 10%,50% 10%,50% 45%,60% 45%,60% 5%,68% 5%,68% 25%,78% 25%,78% 12%,88% 12%,88% 38%,100% 38%,100% 100%,0 100%)"></div>`,
  table: `<div class="m" style="left:-5%;width:110%;height:30%;background:linear-gradient(#5a2d17,#3a1c0e);border-radius:50% 50% 0 0/30% 30% 0 0"></div>`,
  cafe: `<div class="m" style="left:-5%;width:110%;height:26%;background:linear-gradient(#4a2618,#2c140b);border-radius:40% 40% 0 0/25% 25% 0 0"></div>`,
  track: `<div class="m" style="left:-10%;width:120%;height:30%;background:#14505c;border-radius:50% 50% 0 0/40% 40% 0 0"></div>
          <div class="m" style="left:-10%;width:120%;height:22%;border-top:6px dashed rgba(255,255,255,.35);border-radius:50% 50% 0 0/40% 40% 0 0"></div>`,
  stage: `<div class="m" style="left:0;width:100%;height:24%;background:linear-gradient(#5a1a3f,#2e0c20)"></div>
          <div class="m" style="left:0;width:14%;height:100%;background:linear-gradient(90deg,#6b123e,#3d0a24)"></div>
          <div class="m" style="right:0;left:auto;width:14%;height:100%;background:linear-gradient(-90deg,#6b123e,#3d0a24)"></div>`,
};
const html = (k, c) => `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0}body{width:1200px;height:750px;overflow:hidden;font-family:'Noto Color Emoji'}
.bg{position:absolute;inset:0;background:radial-gradient(120% 90% at 30% 20%, ${c.a} 0%, ${c.b} 70%)}
.glow{position:absolute;width:640px;height:640px;left:280px;top:40px;border-radius:50%;background:radial-gradient(circle, ${c.glow}66 0%, transparent 65%);filter:blur(10px)}
.m{position:absolute;bottom:0}
.e{position:absolute;filter:drop-shadow(0 18px 30px rgba(0,0,0,.35))}
.s{position:absolute;color:#FFE3A3;font-family:sans-serif;opacity:.9}
.grain{position:absolute;inset:0;background:linear-gradient(180deg,transparent 55%, rgba(18,6,24,.35))}
</style></head><body>
<div class="bg"></div><div class="glow"></div>${lands[c.land]}
<div class="e" style="font-size:300px;left:450px;top:150px;transform:rotate(-6deg)">${c.main}</div>
<div class="e" style="font-size:120px;left:170px;top:120px;transform:rotate(-12deg)">${c.side[0]}</div>
<div class="e" style="font-size:110px;left:900px;top:90px;transform:rotate(10deg)">${c.side[1]}</div>
<div class="e" style="font-size:100px;left:860px;top:430px;transform:rotate(-8deg)">${c.side[2]}</div>
${[[120,520,46],[300,60,34],[1060,300,40],[760,40,30],[640,600,26],[1100,620,34]].map(([x,y,s])=>`<div class="s" style="left:${x}px;top:${y}px;font-size:${s}px">✦</div>`).join('')}
<div class="grain"></div></body></html>`;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 750 } });
  for (const [k, c] of Object.entries(C)) { await p.setContent(html(k, c)); await p.waitForTimeout(300); await p.screenshot({ path: `/tmp/claude-0/covers/${k}.png` }); }
  await b.close();
})();
