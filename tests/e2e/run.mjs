// End-to-end: the built extension in real browsers. Build first with FRINGELESS_TEST=1 (see npm run e2e).
import http from 'node:http';
import { writeFileSync } from 'node:fs';
import { chromium, firefox, grabber, origin, sleep, zone } from './drivers.mjs';
import { serve } from '../../lab/runner/server.mjs';
import { NEUTRAL, ZONES } from '../../lab/runner/techniques.mjs';

const which = (process.argv[2] ?? 'chrome,edge,firefox').split(',');
const LAB = (scheme, t = '') => `http://localhost:8799/page.html?scheme=${scheme}&t=${t}`;
const CSP = `<!doctype html><meta charset=utf-8><title>fringeless-lab</title><link rel=icon href=data:,><style>html,body{margin:0;background:#fff;color:#000;font:16px/24px "Segoe UI"}#fid1{width:12px;height:12px;background:#f0f}#t{height:24px;width:400px}</style><div id=fid1></div><div id=t>CSP page Illiwm HAVE quick</div>`;
const results = []; let fails = 0;
const G = grabber();
const labServer = await serve(8799);
const cspServer = http.createServer((_, a) => { a.writeHead(200, { 'content-type': 'text/html', 'content-security-policy': "default-src 'none'; style-src 'sha256-" + (CSP_HASH()) + "'" }); a.end(CSP); }).listen(8796, '127.0.0.1');
import { createHash } from 'node:crypto';
function CSP_HASH() { return createHash('sha256').update(CSP.match(/<style>([\s\S]*)<\/style>/)[1]).digest('base64'); }

const RECTS = `(()=>{const o={};for(const z of ${JSON.stringify(ZONES)}){const b=document.getElementById(z).getBoundingClientRect();o[z]={x:b.x,y:b.y,w:b.width,h:b.height}}return o})()`;
for (const name of which) {
  const check = (label, ok, info = '') => { results.push({ name, label, ok, info }); if (!ok) fails++; console.log(ok ? 'ok  ' : 'FAIL', name.padEnd(8), label, info); };
  const b = name === 'firefox' ? await firefox('.output-test/firefox-mv3') : await chromium('.output-test/chrome-mv3', { exe: name });
  console.log('##', b.version);
  try {
    if (b.kind === 'chromium') check('welcome page opens on install', (await b.targets()).some((t) => t.url.endsWith('welcome.html')));
    else check('welcome page opens on install', (await b.tree()).some((t) => t.url.endsWith('welcome.html')));
    const cfg = await b.open(b.extPage('options.html'));
    await sleep(600);
    const api = b.kind === 'firefox' ? 'browser' : 'chrome';
    const get = () => cfg.ev(`(async()=>(await ${api}.storage.local.get('settings')).settings)()`);
    const put = async (patch) => { const s = { ...(await get()), ...patch }; await cfg.ev(`(async()=>{await ${api}.storage.local.set({settings:${JSON.stringify(s)}});return 1})()`); await sleep(700); };
    const base = await get();
    check('default settings saved', base?.v === 1 && base.profileId === 'clean');
    const page = await b.open(LAB('light'), true); await sleep(900);
    const shoot = async () => { await page.ev(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(()=>r(1),300))))`); const img = await G.grab(`lab/captures/e2e-${name}.png`); return { img, o: origin(img), rects: await page.ev(RECTS) }; };
    const neutral = (s) => NEUTRAL.reduce((a, z) => a + zone(s.img, s.o, s.rects[z]).chroma, 0);
    const same = (a, c, z) => JSON.stringify(zone(a.img, a.o, a.rects[z]).px) === JSON.stringify(zone(c.img, c.o, c.rects[z]).px);
    const state = () => page.ev(`(()=>({ov:document.querySelectorAll('fringeless-overlay').length,op:document.querySelector('fringeless-overlay')?.style.opacity??null,f:getComputedStyle(document.documentElement).filter,st:document.documentElement.querySelectorAll(':scope > style').length,sw:getComputedStyle(document.getElementById('t16')).webkitTextStrokeWidth}))()`);

    for (const scheme of ['light', 'dark']) {
      await put({ on: false }); await page.goto(LAB(scheme)); await sleep(900); const off = await shoot();
      await put({ on: true }); await page.goto(LAB(scheme)); await sleep(900); const on = await shoot();
      const x = neutral(off), y = neutral(on);
      check(`${scheme}: color removed, all zones incl. cross-site frame and closed shadow`, x > 5000 && y === 0, `${x} -> ${y}`);
      check(`${scheme}: pictures unchanged`, same(off, on, 'img'));
      check(`${scheme}: nothing moved`, JSON.stringify(off.rects) === JSON.stringify(on.rects));
      await put({ on: false }); const back = await shoot(); // live, no reload
      check(`${scheme}: switching off live restores identical pixels`, ZONES.every((z) => same(off, back, z)), ZONES.filter((z) => !same(off, back, z)).join());
      await put({ on: true });
    }
    const fx = await page.ev(`(()=>{scrollTo(0,300);const r=[document.getElementById('fixed').getBoundingClientRect().top,document.getElementById('sticky').getBoundingClientRect().top];scrollTo(0,0);return r})()`);
    check('fixed and sticky hold while scrolled', fx[0] === 40 && fx[1] === 90, fx.join());
    check('clicks pass through', await page.ev(`document.elementFromPoint(60,60)?.id!==undefined&&!document.elementFromPoint(400,300)?.matches('fringeless-overlay')`));
    const alive = (s) => (b.kind === 'chromium' ? s.ov === 1 : /opacity/.test(s.f) || parseFloat(s.sw) > 0);
    check('active by default', alive(await state()));
    await put({ sites: [{ pattern: 'localhost', action: 'off', profileId: null }] }); check('site rule off', !alive(await state()));
    await put({ sites: [] }); check('site rule removed', alive(await state()));
    await put({ pauseUntil: Date.now() + 1e7 }); check('pause', !alive(await state())); await put({ pauseUntil: 0 });
    const sc = await page.ev('({w:screen.width,h:screen.height,l:screen.availLeft??0,t:screen.availTop??0})');
    await put({ screens: [{ id: 'tv', name: 'TV', match: { width: sc.w, height: sc.h, left: null, top: null }, enabled: false, panel: 'rgb', profileId: null }] }); check('screen set to off', !alive(await state()));
    await put({ screens: [{ id: 'tv', name: 'TV', match: { width: sc.w, height: sc.h, left: 99999, top: 0 }, enabled: false, panel: 'rgb', profileId: null }] }); check('same size at another position is not matched', alive(await state()));
    await put({ screens: [], scope: 'listed' }); check('listed scope without rule', !alive(await state())); await put({ scope: 'all' });
    // tuning
    const bold = structuredClone(base.profiles); bold.find((p) => p.id === 'clean').dark = { thickness: 60, contrast: 40, soften: 0 }; bold.find((p) => p.id === 'clean').light = { thickness: 60, contrast: 40, soften: 0 };
    const plain = await shoot(); await put({ profiles: bold }); const thick = await shoot();
    const ink = (s, z) => zone(s.img, s.o, s.rects[z]).px.reduce((a, v) => a + v, 0);
    for (const z of ['t16', 'nested', 'shadow', 'if1', 'if2', 'inp']) check(`thickness reaches ${z}`, ink(thick, z) > ink(plain, z) * 1.02, `${ink(plain, z)} -> ${ink(thick, z)}`);
    check('thickness keeps text colorless', neutral(thick) === 0, String(neutral(thick)));
    check('thickness moves nothing', JSON.stringify(plain.rects) === JSON.stringify(thick.rects));
    // CSP page
    await page.goto('http://localhost:8796/'); await sleep(900);
    let img = await G.grab('lab/captures/e2e-csp.png');
    check('strict CSP: tuning applies', parseFloat(await page.ev(`getComputedStyle(document.getElementById('t')).webkitTextStrokeWidth`)) > 0);
    check('strict CSP: color removed', zone(img, origin(img), { x: 0, y: 12, w: 400, h: 24 }).chroma === 0);
    await put({ profiles: base.profiles }); await page.goto(LAB('light')); await sleep(800);
    // resilience
    await page.ev(`(()=>{document.querySelector('fringeless-overlay')?.remove();document.documentElement.querySelectorAll(':scope > style').forEach(s=>s.remove());return 1})()`); await sleep(300);
    check('puts itself back if a page removes it', alive(await state()));
    const fs = await page.ev(`document.body.requestFullscreen().then(()=>new Promise(r=>setTimeout(()=>r(document.querySelectorAll('fringeless-overlay').length),400)),e=>'err '+e.message)`, true);
    if (String(fs).startsWith('err')) console.log('skip', name, 'fullscreen:', fs); else if (b.kind === 'chromium') check('overlay is gone in fullscreen', fs === 0, String(fs));
    await page.ev(`document.exitFullscreen().catch(()=>{})`); await sleep(500); check('back after fullscreen', alive(await state()));
    // layout filter
    const lf = structuredClone(base.profiles); lf.find((p) => p.id === 'clean').filter.on = true;
    const before = await shoot();
    await put({ panel: 'qd-27-1440', profiles: lf }); await sleep(400);
    const st = await state();
    if (b.kind === 'chromium') {
      check('layout filter shows one visible overlay', st.ov === 1 && st.op === '1', JSON.stringify(st));
      const f = await shoot(); const w = zone(f.img, f.o, f.rects.img).px, w0 = zone(before.img, before.o, before.rects.img).px, W = Math.round(f.rects.img.w);
      const at = (p, x, y) => p.slice((y * W + x) * 3, (y * W + x) * 3 + 3);
      // yellow block (20..50, 20..50): green must not move, red moves up by about half a pixel
      let gSame = 0, n = 0; for (let y = 10; y < 60; y++) for (let x = 10; x < 60; x++) { n++; if (Math.abs(at(w, x, y)[1] - at(w0, x, y)[1]) <= 1) gSame++; }
      check('layout filter leaves the reference color in place', gSame / n > 0.99, (gSame / n).toFixed(3));
      let rDiff = 0; for (let x = 25; x < 45; x++) rDiff += Math.abs(at(w, x, 19)[0] - at(w0, x, 19)[0]);
      check('layout filter shifts red vertically', rDiff > 200, String(rDiff));
      await put({ panel: 'rgb' }); check('no visible filter on RGB stripe', (await state()).op === '0');
    } else check('layout filter never runs in Firefox', st.ov === 0);
    await put({ panel: 'unknown', profiles: base.profiles });
    check('no errors logged', b.errors.filter((e) => /fringeless|extension/i.test(e)).length === 0, b.errors.slice(0, 2).join(' | ').slice(0, 200));
  } catch (e) { check('run completed', false, e.stack?.slice(0, 400)); }
  await b.close();
}
G.end(); labServer.close(); cspServer.close();
writeFileSync('lab/results/e2e.json', JSON.stringify(results, null, 1));
console.log(`\n${results.length - fails}/${results.length} passed`);
process.exit(fails ? 1 : 0);
