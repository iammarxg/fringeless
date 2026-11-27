// The website in installed Chrome and Firefox. Build first: npm run site:build
import http from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { PNG } from 'pngjs';
import { chromium, firefox, grabber, sleep } from './drivers.mjs';

const OUT = 'lab/captures/site'; mkdirSync(OUT, { recursive: true });
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const missing = [];
const server = await new Promise((r) => { const s = http.createServer((q, a) => {
  let f = new URL(q.url, 'http://x').pathname; if (f === '/') f = '/index.html';
  try { if (f.includes('..')) throw 0; const b = readFileSync('.output/site' + f); a.writeHead(200, { 'content-type': T[extname(f)] ?? 'application/octet-stream' }); a.end(b); } catch { missing.push(f); a.writeHead(404); a.end(); }
}).listen(8796, '127.0.0.1', () => r(s)); });
const URL_ = 'http://localhost:8796/';
let fails = 0; const check = (l, ok, i = '') => { if (!ok) fails++; console.log(ok ? 'ok  ' : 'FAIL', l, i); };
const only = process.argv[2];

const b = await chromium(null, { size: '1440,1000' });
const p = await b.open('about:blank', true);
const shot = async (n) => writeFileSync(`${OUT}/${n}.png`, Buffer.from((await p.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
const size = (w, h, d = 1) => p.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: d, mobile: false });
const media = (scheme, still = true) => p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }, { name: 'prefers-reduced-motion', value: still ? 'reduce' : 'no-preference' }] });
const see = (sel) => p.ev(`(()=>{document.documentElement.style.scrollBehavior='auto';document.querySelector(${JSON.stringify(sel)}).scrollIntoView();return 1})()`).then(() => sleep(350));
const click = (t, scope = 'body') => p.ev(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(scope)}+' button')].find(x=>x.textContent.trim()===${JSON.stringify(t)});if(!e)return 0;e.click();return 1})()`).then(async (r) => { await sleep(250); if (!r) check('button ' + t, false); });

if (!only || only === 'shots') {
  for (const scheme of ['dark', 'light']) {
    await size(1440, 900); await media(scheme); await p.goto(URL_); await sleep(1200); await shot(`${scheme}-1-hero`);
    for (const [i, s] of ['.simbar', '#pixels', '#try', '.control', '#monitors', '.limits', '#install'].entries()) { await see(s); await shot(`${scheme}-${i + 2}-${s.replace(/\W/g, '')}`); }
  }
  await size(390, 844, 2); await media('dark'); await p.goto(URL_); await sleep(1000); await shot('phone-1');
  for (const [i, s] of ['.simbar', '#pixels', '#try', '.control', '#monitors', '#install'].entries()) { await see(s); await shot(`phone-${i + 2}`); }
}
for (const w of [320, 390, 700, 960, 1100, 1440, 2560]) { await size(w, 900); await p.goto(URL_); await sleep(400); check(`no sideways scroll at ${w}`, !(await p.ev('document.documentElement.scrollWidth>innerWidth'))); }

await size(1440, 900); await media('dark'); await p.goto(URL_); await sleep(1000);
const picture = async () => { await sleep(500); const r = await p.ev(`(()=>{scrollTo(0,0);const r=document.querySelector('.stage').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()`); return PNG.sync.read(Buffer.from((await p.send('Page.captureScreenshot', { format: 'png', clip: r })).data, 'base64')); };
const count = async () => { const i = await picture(), r = [[0, 0], [0, 0]]; for (let y = 0; y < i.height - 50; y++) for (let x = 0; x < i.width; x++) { if (Math.abs(x - i.width / 2) < 26) continue; const o = (y * i.width + x) * 4, d = i.data, m = Math.max(d[o], d[o + 1], d[o + 2]), k = x < i.width / 2 ? 0 : 1; if (m > 40) { r[k][0]++; if (m - Math.min(d[o], d[o + 1], d[o + 2]) > 60) r[k][1]++; } } return r; };
const setRange = (v) => p.ev(`(()=>{const e=document.querySelector('.dist input');e.value=${v};e.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`).then(() => sleep(300));
check('every example starts on white', (await p.ev(`document.querySelector('.stage').classList.contains('light')&&!!document.querySelector('.grid.light')&&!!document.querySelector('.paper.light')`)));
for (const kind of ['Dark', 'Light']) {
  await click(kind, '.simbar'); const i = await picture(); let odd = 0; // above the word there is only background
  for (let y = 2; y < 40; y++) for (let x = 4; x < i.width / 2 - 30; x++) { const v = i.data[(y * i.width + x) * 4 + 1]; if (kind === 'Dark' ? v > 12 : v < 235) odd++; }
  check(`only background above the word (${kind})`, odd === 0, String(odd));
}
await click('Dark', '.simbar');
check('simulator draws', (await count())[0][0] > 500);
await setRange(1);
const [off, on] = await count(); check('reading distance: less color with the fix (RWBG)', on[1] / on[0] < (off[1] / off[0]) * 0.5, JSON.stringify([off, on]));
const before = JSON.stringify(await count());
await p.ev(`(()=>{const e=document.querySelector('.simbar input[type=text]');e.value='Fox';e.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`); await sleep(300);
check('typing changes the picture', JSON.stringify(await count()) !== before);
await p.ev(`(()=>{const e=document.querySelector('.simbar input[type=text]');e.value='';e.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`); await sleep(200); check('empty text does not break', (await p.ev(`!!document.querySelector('.stage canvas')`)));
await p.ev(`(()=>{const e=document.querySelector('.split');e.focus();e.dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}));return 1})()`); await sleep(200); check('divider moves with the keyboard', (await p.ev(`document.querySelector('.split').getAttribute('aria-valuenow')`)) === '100');

const overlay = () => p.ev(`document.querySelectorAll('fringeless-overlay').length`);
await click('Try it on this page'); check('hero button turns the real fix on', (await overlay()) === 1);
await click('Turn it off on this page'); check('and off again, leaving nothing', (await overlay()) === 0 && (await p.ev(`document.querySelectorAll('style[data-fringeless]').length`)) === 0);
await p.ev(`(()=>{document.querySelector('#try .look[aria-label=Bold]').click();return 1})()`); await sleep(200);
check('the sample has a bold title', (await p.ev(`Number(getComputedStyle(document.querySelector('.write .title')).fontWeight)`)) === 700);
check('a look changes the sample', (await p.ev(`getComputedStyle(document.querySelector('.write')).webkitTextStrokeWidth`)) !== '0px');
check('the sample has every text size', (await p.ev(`document.querySelectorAll('.write .lab-sample p').length`)) === 10);
await p.ev(`(()=>{document.querySelector('#try .swatch[aria-label="Night blue"]').click();return 1})()`); await sleep(200);
check('background color changes the sample and the side being tuned', await p.ev(`getComputedStyle(document.querySelector('.paper')).backgroundColor==='rgb(13, 17, 23)'&&document.querySelector('.paper').classList.contains('dark')&&document.querySelector('#try').innerText.includes('text on dark backgrounds')`));
await p.ev(`(()=>{const c=document.querySelector('#try .swatch.pick input');c.value='#ffeecc';c.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`); await sleep(200);
check('any color works', await p.ev(`getComputedStyle(document.querySelector('.paper')).backgroundColor==='rgb(255, 238, 204)'&&document.querySelector('.paper').classList.contains('light')`));
await p.ev(`(()=>{document.querySelector('#try .swatch[aria-label=White]').click();return 1})()`);
await click('Reset looks');
await p.ev(`(()=>{const e=document.querySelector('.searchbox input');e.value='aw3423';e.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`); await sleep(200);
check('monitor search finds models', (await p.ev(`document.querySelectorAll('.results button').length`)) > 0);
await p.ev(`(()=>{document.querySelector('.results button').click();return 1})()`); await sleep(300);
check('result shows a verdict', (await p.ev(`document.querySelector('.result h3').textContent`)) === 'A partial fix');
await click('See this layout in the simulator'); check('and opens it in the simulator', (await p.ev(`document.querySelector('.simbar .trigger').textContent`)).includes('QD-OLED'));
await p.ev(`(()=>{const e=document.querySelector('.searchbox input');e.value='zzzz';e.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`); await sleep(200);
check('unknown model offers a report', (await p.ev(`!!document.querySelector('.results .none a')`)));
for (const n of ['Firefox', 'Brave', 'Chrome']) { await click(n, '.tabs'); check(`install steps for ${n}`, (await p.ev(`document.querySelector('.steps .copy code').textContent`)).startsWith({ Firefox: 'about:', Brave: 'brave:', Chrome: 'chrome:' }[n])); }
check('downloads follow the latest release', (await p.ev(`[...document.querySelectorAll('a[href$=".zip"]')].map(a=>a.href)`)).every((h) => /\/releases\/latest\/download\/fringeless-(chrome|firefox)\.zip$/.test(h)) && (await p.ev(`document.querySelectorAll('a[href$=".zip"]').length`)) === 2);
check('images have loaded', (await p.ev(`(async()=>{const a=[...document.images];a.forEach(i=>i.loading='eager');await Promise.all(a.map(i=>i.decode().catch(()=>0)));return a.every(i=>i.naturalWidth>0)})()`)));
check('images and controls have names', (await p.ev(`[...document.querySelectorAll('button,a,input')].filter(e=>!(e.textContent.trim()||e.getAttribute('aria-label')||e.labels?.length)).length`)) === 0);
await media('dark', false); await p.goto(URL_); await sleep(2400);
check('opening movement ends half and half', (await p.ev(`document.querySelector('.split').getAttribute('aria-valuenow')`)) === '50');
await media('dark', false); await p.goto(URL_); for (const [ms, n] of [[350, 'a'], [400, 'b'], [400, 'c'], [1200, 'd']]) { await sleep(ms); await shot('intro-' + n); }
await p.ev(`(()=>{document.querySelector('.simbar .trigger').click();return 1})()`); await sleep(150);
await p.ev(`(()=>{[...document.querySelectorAll('.simbar li')][2].dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));return 1})()`); await sleep(90); await shot('fade'); await sleep(500); await shot('qd');
for (const w of [2560, 390]) { await size(w, 1100); await p.goto(URL_); await sleep(2200); await setRange(1); await sleep(700); await shot('reading-' + w); await setRange(0); await sleep(700); await shot('close-' + w); }
await size(1440, 900); await sleep(400);
await p.ev(`(()=>{const c=document.querySelector('.stage canvas'),x=c.getContext('webgl2').getExtension('WEBGL_lose_context');x.loseContext();setTimeout(()=>x.restoreContext(),200);return 1})()`); await sleep(1200);
check('simulator survives a graphics reset', (await count())[0][0] > 500);
await p.ev(`(()=>{localStorage.setItem('fringeless-theme','light');return 1})()`); await media('dark'); await p.goto(URL_); await sleep(800);
check('theme follows the system on every visit', await p.ev(`!document.documentElement.hasAttribute('data-theme')&&getComputedStyle(document.body).backgroundColor==='rgb(0, 0, 0)'&&getComputedStyle(document.querySelector('.paper')).backgroundColor==='rgb(255, 255, 255)'`));
await p.ev(`(()=>{document.querySelector('.theme button[title=Light]').click();return 1})()`); await sleep(200);
check('the switch still works for this visit', await p.ev(`document.documentElement.dataset.theme==='light'`));
check('no errors in Chrome', b.errors.length === 0, b.errors.slice(0, 2).join());
await b.close();

// with the extension installed, the page must leave it alone
const e = await chromium('.output-test/chrome-mv3', { size: '1300,900' });
const q = await e.open(URL_, true); await sleep(2500);
check('with the extension: page says so and does not touch it', (await q.ev(`document.querySelectorAll('fringeless-overlay').length===1&&document.body.innerText.includes('already running here')`)));
await e.close();

const f = await firefox(null), fp = await f.open(URL_); await sleep(3500);
check('firefox: simulator runs', await fp.ev(`!!document.querySelector('.stage canvas')&&!document.querySelector('.nogl')`));
check('firefox: offers the Firefox download', await fp.ev(`document.querySelector('.lede a').textContent.includes('Firefox')&&document.querySelector('.lede a').href.endsWith('-firefox.zip')`));
await fp.ev(`(()=>{[...document.querySelectorAll('button')].find(x=>x.textContent==='Try it on this page').click();return 1})()`); await sleep(500);
check('firefox: the fix applies', /opacity/.test(await fp.ev(`getComputedStyle(document.documentElement).filter`)));
await fp.ev(`(()=>{document.title='fringeless-lab';return 1})()`); await sleep(400);
const G = grabber(); await G.grab(`${OUT}/firefox.png`); G.end();
check('no errors in Firefox', f.errors.length === 0, f.errors.slice(0, 2).join());
await f.close();
check('no missing files', missing.filter((x) => x !== '/favicon.ico').length === 0, missing.join());
server.close(); console.log(fails ? fails + ' failed' : 'all passed'); process.exit(fails ? 1 : 0);
