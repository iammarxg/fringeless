// Controls for the real-site numbers: is leftover colour just coloured text, and do elements move with no change at all?
import { chromium, firefox, grabber, sleep } from './drivers.mjs';
const G = grabber();
for (const name of ['chrome', 'firefox']) {
  const b = name === 'firefox' ? await firefox('.output-test/firefox-mv3') : await chromium('.output-test/chrome-mv3', { size: '1400,1000' });
  const cfg = await b.open(b.extPage('options.html')); await sleep(600); const api = name === 'firefox' ? 'browser' : 'chrome';
  const on = (v) => cfg.ev(`(async()=>{const s=(await ${api}.storage.local.get('settings')).settings;await ${api}.storage.local.set({settings:{...s,on:${v}}});return 1})()`);
  const page = await b.open('about:blank', true);
  await page.goto('https://en.wikipedia.org/wiki/OLED'); await sleep(3500);
  await page.ev(`(()=>{const s=document.createElement('style');s.textContent='*{color:#000!important;transition:none!important}';document.head.append(s);return 1})()`);
  const shot = async () => { await page.ev(`(()=>{document.title='fringeless-lab';return 1})()`); await sleep(900); return G.grab('lab/captures/ctl.png'); };
  await on(false); await sleep(800); const a = await shot(); await on(true); await sleep(800); const c = await shot();
  let before = 0, after = 0; for (let i = 0; i < a.data.length; i += 4) { const x = a.data, y = c.data; if (Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]) < 12) continue; const s = (d) => Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]); if (s(x) > 16) before++; if (s(y) > 16) after++; }
  console.log(name, 'wikipedia, all text forced black:', before, '->', after);
  if (name === 'firefox') {
    await on(false); await page.goto('https://www.theverge.com/'); await sleep(4500);
    const sig = `(()=>JSON.stringify([...document.querySelectorAll('body *')].slice(0,1500).map(e=>{const r=e.getBoundingClientRect();return [r.x|0,r.y|0,r.width|0,r.height|0]})))()`;
    const cmp = (p, q) => { const A = JSON.parse(p), B = JSON.parse(q); return A.filter((r, i) => JSON.stringify(r) !== JSON.stringify(B[i])).length; };
    for (let k = 0; k < 4; k++) { const p = await page.ev(sig); await sleep(2500); const q = await page.ev(sig); console.log('verge control, no change made: moved', cmp(p, q)); }
    for (let k = 0; k < 3; k++) { const p = await page.ev(sig); await on(k % 2 === 0); await sleep(1500); const q = await page.ev(sig); console.log('verge toggled: moved', cmp(p, q)); }
  }
  await b.close();
}
G.end(); process.exit(0);
