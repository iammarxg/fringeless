// Makes every picture used by the README and the stores, from the real extension in installed Chrome on Windows.
// Needs `npm run e2e:build` first. Text crops are lossless captures of the composited window (PrintWindow).
import http from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname } from 'node:path';
import { PNG } from 'pngjs';
import { chromium, grabber, origin, sleep } from '../../tests/e2e/drivers.mjs';

const CAP = 'lab/captures/promo', DOCS = 'docs/images', STORE = 'store/images';
for (const d of [CAP, DOCS, STORE]) mkdirSync(d, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = await new Promise((r) => { const s = http.createServer((q, a) => {
  let f = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (f === '/') f = '/tools/images/demo.html';
  try { if (f.includes('..')) throw 0; const b = readFileSync('.' + f); a.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream', 'cache-control': 'no-store' }); a.end(b); } catch { a.writeHead(404); a.end(); }
}).listen(8797, '127.0.0.1', () => r(s)); });
const only = process.argv[2];

const G = grabber();
const b = await chromium('.output-test/chrome-mv3', { size: '1000,800', args: ['--host-resolver-rules=MAP reading.example 127.0.0.1:8797'] });
const cfg = await b.open(b.extPage('options.html')); await sleep(700);
const set = (patch) => cfg.ev(`(async()=>{const s=(await chrome.storage.local.get('settings')).settings;await chrome.storage.local.set({settings:{...s,...${JSON.stringify(patch)}}});return 1})()`).then(() => sleep(900));
const shot = async (p, out, { clip, alpha = false } = {}) => { const png = Buffer.from((await p.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip } : {}) })).data, 'base64'); writeFileSync(out, alpha ? png : PNG.sync.write(PNG.sync.read(png), { colorType: 2 })); };
const size = (p, width, height, deviceScaleFactor = 1) => p.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor, mobile: false }).then(() => p.send('Emulation.setScrollbarsHidden', { hidden: true }));
const scheme = (p, value) => p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value }] });
const cut = (img, [x, y, w, h]) => { const o = new PNG({ width: w, height: h }); PNG.bitblt(img, o, x, y, w, h, 0, 0); return PNG.sync.write(o); };

if (!only || only === 'crops') {
  for (const mode of ['dark', 'light']) {
    const p = await b.open(`http://reading.example/?${mode}`, true); await sleep(1200);
    for (const on of [false, true]) {
      await set({ on }); await p.front(); await sleep(700);
      const img = await G.grab(`${CAP}/raw.png`), [ox, oy] = origin(img);
      const r = await p.ev(`(()=>{const r=document.getElementById('crop').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()`);
      const x = ox + Math.round(r.x) - 6, y = oy + Math.round(r.y) - 3, n = on ? 'on' : 'off';
      writeFileSync(`${CAP}/crop-${mode}-${n}.png`, cut(img, [x + 2, y + 3, 80, 22]));
    }
    await p.close();
  }
  await set({ on: true });
}

if (!only || only === 'ui') {
  await b.send('Browser.grantPermissions', { permissions: ['windowManagement'], origin: `chrome-extension://${b.extId}` });
  const base = await cfg.ev(`chrome.storage.local.get('settings').then(r=>r.settings)`);
  await set({ onboarded: true, panel: 'woled-rwbg', sites: [{ pattern: 'docs.google.com', action: 'off', profileId: null }, { pattern: 'github.com', action: 'inherit', profileId: 'bold' }, { pattern: '*.wikipedia.org', action: 'inherit', profileId: 'crisp' }] });
  const page = await b.open('http://reading.example/', true); await sleep(1500);
  const tabId = await cfg.ev(`(async()=>(await chrome.tabs.query({})).find(t=>(t.url||'').includes('reading.example')).id)()`);
  await size(page, 853, 534, 1.5); await page.ev(`(()=>{document.querySelector('.mark').remove();document.querySelector('main').style.width='425px';return 1})()`); await sleep(500);
  for (const theme of ['dark', 'light']) {
    const pop = await b.open(b.extPage(`popup.html?tab=${tabId}`)); await scheme(pop, theme); await size(pop, 384, 600, 1.5); await sleep(900);
    const h = await pop.ev(`Math.ceil(document.querySelector('main').getBoundingClientRect().height)`);
    await shot(pop, `${CAP}/popup-${theme}.png`, { clip: { x: 0, y: 0, width: 384, height: h, scale: 1 } });
    await size(pop, 384, 600, 2); await sleep(400); await shot(pop, `${DOCS}/popup-${theme}.png`, { clip: { x: 0, y: 0, width: 384, height: h, scale: 1 } });
    await pop.close();
    if (theme === 'dark') writeFileSync(`${CAP}/popup.png`, readFileSync(`${CAP}/popup-dark.png`));
  }
  await page.front(); await sleep(500); await shot(page, `${CAP}/page.png`);
  const views = [['look', 'options.html#look', 'dark', 0], ['screens', 'options.html#screens', 'dark', 0], ['sites', 'options.html#sites', 'dark', 0], ['welcome', 'welcome.html', 'light', 0], ['welcome-dark', 'welcome.html', 'dark', 0]];
  for (const [n, f, theme] of views) {
    const p = await b.open(b.extPage(f)); await scheme(p, theme); await size(p, 1280, 800); await sleep(1000);
    if (n === 'screens') { await p.ev(`(()=>{[...document.querySelectorAll('button')].find(x=>/Detect/.test(x.textContent))?.click();return 1})()`, true); await sleep(1500); await p.ev(`(()=>{let e=[...document.querySelectorAll('body *')].find(x=>!x.children.length&&/^LG TV/.test(x.textContent));while(e&&!/this screen/.test(e.parentElement.textContent))e=e.parentElement;e?.remove();return 1})()`); await sleep(300); }
    await shot(p, `${CAP}/${n}.png`); await p.close();
  }
  await set(base);
}

if (!only || only === 'compose') {
  const p = await b.open('about:blank', true);
  const render = async (q, w, h, out, { opaque = true } = {}) => {
    await size(p, w, h); if (!opaque) await p.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
    await p.goto(`http://127.0.0.1:8797/tools/images/compose.html?${q}`);
    for (let i = 0; i < 40 && (await p.ev('document.title')) !== 'ready'; i++) await sleep(150);
    await sleep(300); await shot(p, out, { alpha: !opaque }); if (!opaque) await p.send('Emulation.setDefaultBackgroundColorOverride', {});
  };
  await render('kind=ba', 1280, 800, `${STORE}/1-before-after.png`);
  await render('kind=ba&foot=', 1280, 470, `${DOCS}/before-after.png`);
  await render('kind=popup&w=576', 1280, 800, `${STORE}/2-popup.png`);
  ['look', 'screens', 'sites'].forEach((n, i) => writeFileSync(`${STORE}/${i + 3}-${n}.png`, readFileSync(`${CAP}/${n}.png`)));
  for (const n of ['look', 'screens', 'sites']) writeFileSync(`${DOCS}/${n}.png`, readFileSync(`${CAP}/${n}.png`));
  await render('kind=small', 440, 280, `${STORE}/promo-440x280.png`);
  await render('kind=wide', 1400, 560, `${STORE}/promo-1400x560.png`);
  await render('kind=wide&f=100&p=34', 1280, 640, `${DOCS}/social-preview.png`);
  await render('kind=icon&w=96', 128, 128, `${STORE}/icon-128.png`, { opaque: false });
  await render('kind=icon&w=300', 300, 300, `${STORE}/icon-300.png`, { opaque: false });
}
console.log('errors:', b.errors.slice(0, 3)); await b.close(); G.end(); server.close(); process.exit(0);
