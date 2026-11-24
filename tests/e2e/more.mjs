// Lifecycle, shipping build before access is granted, real sites, UI screenshots.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { chromium, firefox, grabber, sleep } from './drivers.mjs';
import { serve } from '../../lab/runner/server.mjs';

const part = process.argv[2] ?? 'all', has = (x) => part === 'all' || part.split(',').includes(x);
const server = await serve(8799), G = grabber();
mkdirSync('lab/captures/ui', { recursive: true });
let fails = 0; const check = (l, ok, i = '') => { if (!ok) fails++; console.log(ok ? 'ok  ' : 'FAIL', l, i); };
const LAB = 'http://localhost:8799/page.html?scheme=light';
const ov = (p) => p.ev(`document.querySelectorAll('fringeless-overlay').length`);

if (has('life')) {
  const b = await chromium(null); const page = await b.open(LAB, true); await sleep(800);
  const { id } = await b.send('Extensions.loadUnpacked', { path: resolve('.output-test/chrome-mv3') }); await sleep(2500);
  check('page open before install gets the fix without a reload', (await ov(page)) === 1);
  await b.send('Extensions.uninstall', { id }).catch((e) => console.log(e.message)); await sleep(4500);
  check('removing the extension cleans up open pages', (await ov(page)) === 0);
  await b.close();
  const f = await firefox(null); const fp = await f.open(LAB);
  const { extension } = await f.send('webExtension.install', { extensionData: { type: 'path', path: resolve('.output-test/firefox-mv3') } }); await sleep(2500);
  const filt = () => fp.ev('getComputedStyle(document.documentElement).filter');
  check('firefox: page open before install gets the fix', /opacity/.test(await filt()), await filt());
  await f.send('webExtension.uninstall', { extension }); await sleep(1500);
  await f.send('webExtension.install', { extensionData: { type: 'path', path: resolve('.output-test/firefox-mv3') } }); await sleep(2500);
  check('firefox: reinstalling leaves one copy of our style', (await fp.ev(`document.querySelectorAll('style[data-fringeless]').length`)) === 1);
  await f.send('webExtension.uninstall', { extension }); await fp.goto(LAB);
  check('firefox: gone after removal and reload', (await filt()) === 'none', await filt());
  await f.close();
}
if (has('ship')) {
  const b = await chromium('.output/chrome-mv3'); const page = await b.open(LAB, true); await sleep(1200);
  check('shipping build does nothing before access is granted', (await ov(page)) === 0);
  const cfg = await b.open(b.extPage('options.html')); await sleep(500);
  const r = await cfg.ev(`(async()=>({reg:(await chrome.scripting.getRegisteredContentScripts()).length,m:chrome.runtime.getManifest().host_permissions??null,o:chrome.runtime.getManifest().optional_host_permissions}))()`);
  check('no script registered, no required site access', r.reg === 0 && r.m === null, JSON.stringify(r));
  await b.close();
}
if (has('ui')) {
  const b = await chromium('.output-test/chrome-mv3', { size: '1280,1000' });
  const cfg = await b.open(b.extPage('options.html')); await sleep(600);
  const site = await b.open('https://en.wikipedia.org/wiki/Subpixel_rendering'); await sleep(2500);
  const tabId = await cfg.ev(`(async()=>(await chrome.tabs.query({})).find(t=>(t.url||'').includes('wikipedia')).id)()`);
  const set = (patch) => cfg.ev(`(async()=>{const s=(await chrome.storage.local.get('settings')).settings;await chrome.storage.local.set({settings:{...s,...${JSON.stringify(patch)}}});return 1})()`);
  const tall = { welcome: 4300, look: 2700, screens: 2100, narrow: 2600 };
  const shots = [['welcome', 'welcome.html', 1200], ['look', 'options.html#look', 1200], ['screens', 'options.html#screens', 1200], ['sites', 'options.html#sites', 1200], ['narrow', 'options.html#look', 400], ['popup', `popup.html?tab=${tabId}`, 384]];
  await b.send('Browser.grantPermissions', { permissions: ['windowManagement'], origin: `chrome-extension://${b.extId}` });
  await set({ panel: 'woled-rwbg', sites: [{ pattern: 'docs.google.com', action: 'off', profileId: null }, { pattern: 'github.com', action: 'inherit', profileId: 'bold' }], screens: [{ id: 'a', name: 'LG G4', match: { width: 1111, height: 2222, left: null, top: null }, enabled: false, panel: 'rgb', profileId: null }], customPanels: [{ id: 'c-1', name: 'My laptop', offsets: { r: [-0.2, 0.3], g: [0, 0], b: [0.25, 0.1] } }] });
  for (const scheme of ['light', 'dark']) for (const [n, f, w] of shots) {
    const p = await b.open(b.extPage(f)); await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
    await p.send('Emulation.setDeviceMetricsOverride', { width: w, height: tall[n] ?? (n === 'popup' ? 600 : 1000), deviceScaleFactor: 1, mobile: false }); await sleep(700);
    if (n === 'welcome') { await p.ev(`(()=>{[...document.querySelectorAll('button')].find(x=>x.textContent==='Detect my screens')?.click();[...document.querySelectorAll('button')].find(x=>x.textContent==='Start the check')?.click();return 1})()`, true); await sleep(1500); if (scheme === 'light') { await p.ev(`(()=>{[...document.querySelectorAll('.test .card')][0].click();return 1})()`); await sleep(700); } }
    if (n === 'sites') { await p.ev(`(()=>{const t=[...document.querySelectorAll('.select .trigger')];t[t.length-1].click();return 1})()`); await sleep(500); }
    const over = await p.ev('document.documentElement.scrollWidth>innerWidth'); if (over) check(`${n} ${scheme} has no sideways scroll`, false);
    writeFileSync(`lab/captures/ui/${n}-${scheme}.png`, Buffer.from((await p.send('Page.captureScreenshot', { format: 'png' })).data, 'base64')); await p.close();
  }
  console.log('ui errors:', b.errors.slice(0, 3)); check('ui pages log no errors', b.errors.length === 0); await b.close();
}
if (has('sites')) {
  const SITES = ['https://en.wikipedia.org/wiki/OLED', 'https://github.com/microsoft/PowerToys', 'https://www.youtube.com/', 'https://news.ycombinator.com/', 'https://www.bbc.com/news', 'https://stackoverflow.com/questions', 'https://developer.mozilla.org/en-US/docs/Web/CSS/filter', 'https://www.theverge.com/'];
  for (const name of ['chrome', 'firefox']) {
    const b = name === 'firefox' ? await firefox('.output-test/firefox-mv3') : await chromium('.output-test/chrome-mv3', { size: '1400,1000' });
    const cfg = await b.open(b.extPage('options.html')); await sleep(600); const api = name === 'firefox' ? 'browser' : 'chrome';
    const on = (v) => cfg.ev(`(async()=>{const s=(await ${api}.storage.local.get('settings')).settings;await ${api}.storage.local.set({settings:{...s,on:${v}}});return 1})()`);
    const page = await b.open('about:blank', true);
    for (const u of SITES) try {
      await Promise.race([page.goto(u), sleep(15000)]); await sleep(3500);
      // freeze motion so two captures can be compared
      await page.ev(`(()=>{document.title='fringeless-lab';const s=document.createElement('style');s.textContent='*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';document.head.append(s);document.querySelectorAll('video').forEach(v=>v.pause());return 1})()`);
      const sig = `(()=>JSON.stringify([...document.querySelectorAll('body *')].slice(0,1500).map(e=>{const r=e.getBoundingClientRect();return [r.x|0,r.y|0,r.width|0,r.height|0]})))()`;
      await sleep(600); await on(false); await sleep(1000); await page.ev(`(()=>{document.title='fringeless-lab';return 1})()`); const g0 = await page.ev(sig), a = await G.grab('lab/captures/site.png');
      await on(true); await sleep(1000); await page.ev(`(()=>{document.title='fringeless-lab';return 1})()`); const g1 = await page.ev(sig), c = await G.grab(`lab/captures/site-${name}.png`);
      let before = 0, after = 0, ch = 0; for (let i = 0; i < a.data.length; i += 4) { const x = a.data, y = c.data; if (Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]) < 12) continue; ch++; const s = (d) => Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]); if (s(x) > 16) before++; if (s(y) > 16) after++; }
      const A = JSON.parse(g0), B = JSON.parse(g1); let moved = 0; A.forEach((r, i) => { if (JSON.stringify(r) !== JSON.stringify(B[i])) moved++; });
      console.log(name.padEnd(8), u.padEnd(60), 'changed', ch, 'colored', before, '->', after, 'elements moved', moved + '/' + A.length);
    } catch (e) { console.log(name, u, 'error', e.message.slice(0, 120)); }
    await b.close();
  }
}
G.end(); server.close(); console.log(fails ? fails + ' failed' : 'done'); process.exit(fails ? 1 : 0);
