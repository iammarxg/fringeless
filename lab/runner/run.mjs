import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { launch, sleep } from './browsers.mjs';
import { serve } from './server.mjs';
import { techniques, ZONES, NEUTRAL } from './techniques.mjs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const browsers = arg('browsers', 'chrome,edge,firefox').split(',');
const dprs = arg('dpr', '1').split(',').map(Number);
const only = arg('only', '');
const PORT = 8799;
mkdirSync('lab/captures', { recursive: true }); mkdirSync('lab/results', { recursive: true });

const py = spawn('python', ['-I', 'lab/runner/grab.py'], { stdio: ['pipe', 'pipe', 'inherit'] });
const rl = createInterface({ input: py.stdout }); const q = []; rl.on('line', l => q.shift()?.(l));
const grab = async (out) => { const r = await new Promise(r => { q.push(r); py.stdin.write(`fringeless-lab\t${resolve(out)}\n`); }); if (!r.startsWith('ok')) throw new Error('grab ' + r); return PNG.sync.read(readFileSync(out)); };
const isMag = (p, i) => p[i] > 240 && p[i + 1] < 15 && p[i + 2] > 240;
function fiducials(img) { // content rect from the two magenta corner blocks
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (isMag(img.data, (y * img.width + x) * 4)) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}
function zoneStats(img, o, r, dpr) {
  const X0 = Math.round(o.x0 + r.x * dpr), Y0 = Math.round(o.y0 + r.y * dpr), X1 = Math.min(img.width, Math.round(X0 + r.w * dpr)), Y1 = Math.min(img.height, Math.round(Y0 + r.h * dpr));
  let chroma = 0, ink = 0, maxc = 0; const px = [];
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) { const i = (y * img.width + x) * 4, d = img.data, c = Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]); if (c > 8) chroma++; if (c > maxc) maxc = c; ink += (d[i] + d[i + 1] + d[i + 2]) / 3; px.push(d[i], d[i + 1], d[i + 2]); }
  return { chroma, maxc, ink: Math.round(ink), px };
}
const rectsJs = `(()=>{const o={};for(const z of ${JSON.stringify(ZONES)}){const e=document.getElementById(z),b=e.getBoundingClientRect();o[z]={x:b.x,y:b.y,w:b.width,h:b.height}}return o})()`;
const settle = (b) => b.ev(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(()=>r(1),350))))`);
const out = { when: new Date().toISOString(), platform: process.platform, runs: [] };
const server = await serve(PORT);
for (const name of browsers) for (const dpr of dprs) {
  let b; try { b = await launch(name, { dpr, port: 9400 + Math.floor(Math.random() * 400), url: `http://localhost:${PORT}/page.html?scheme=light` }); }
  catch (e) { console.error(name, dpr, e.message); continue; }
  console.log('##', b.version, 'dpr', dpr, 'actual', await b.ev('devicePixelRatio'));
  try {
    await sleep(1500);
    for (const scheme of ['light', 'dark']) {
      let ref = null, o = null; const bad = [];
      for (const [t, def] of Object.entries(techniques)) {
        if (only && t !== 'base' && !t.includes(only)) continue;
        const url = `http://localhost:${PORT}/page.html?scheme=${scheme}&t=${encodeURIComponent(t)}`;
        await b.goto(url);
        if (def.js) await b.ev(`(()=>{${def.js};return 1})()`);
        if (def.css) await b.ev(`(()=>{const s=document.createElement('style');s.textContent=${JSON.stringify(def.css)};document.head.append(s);return 1})()`);
        await settle(b);
        const rects = await b.ev(rectsJs);
        const img = await grab(`lab/captures/${name}-${dpr}-${scheme}-${t.replace(/[^a-z0-9.]+/gi, '_')}.png`);
        if (t === 'base') { o = fiducials(img); if (!o) throw new Error('no fiducials'); }
        const z = {}; for (const k of ZONES) z[k] = zoneStats(img, o, rects[k], dpr);
        if (t === 'base') ref = { z, rects };
        const sum = (f) => NEUTRAL.reduce((a, k) => a + f(k), 0);
        const base = sum(k => ref.z[k].chroma), cur = sum(k => z[k].chroma);
        // zones that were LCD in baseline and still are
        const left = NEUTRAL.filter(k => ref.z[k].chroma > 25 && z[k].chroma > ref.z[k].chroma * .05);
        let imgMax = 0; for (let i = 0; i < z.img.px.length; i++) imgMax = Math.max(imgMax, Math.abs(z.img.px[i] - ref.z.img.px[i]));
        let shift = 0; for (const k of ZONES) shift = Math.max(shift, Math.abs(rects[k].x - ref.rects[k].x), Math.abs(rects[k].y - ref.rects[k].y), Math.abs(rects[k].w - ref.rects[k].w));
        const ink = sum(k => z[k].ink) - sum(k => ref.z[k].ink);
        // fixed must stay put after scroll; sticky must stick
        const sc = await b.ev(`(()=>{scrollTo(0,300);const f=document.getElementById('fixed').getBoundingClientRect().top,s=document.getElementById('sticky').getBoundingClientRect().top;scrollTo(0,0);return [f,s]})()`);
        const row = { browser: b.version, name, dpr, scheme, t, base, cur, left, imgMax, shift: +shift.toFixed(2), inkDelta: ink, fixedTop: sc[0], stickyTop: sc[1] };
        out.runs.push(row);
        console.log(scheme.padEnd(5), t.padEnd(36), `${cur}/${base}`.padEnd(12), 'img', String(imgMax).padEnd(4), 'shift', String(row.shift).padEnd(5), 'fix', sc[0], 'stk', sc[1], left.length && cur ? 'LCD left: ' + left.join(',') : '');
      }
    }
  } catch (e) { console.error('FAIL', name, dpr, e.message); }
  await b.close();
}
py.stdin.end(); server.close();
writeFileSync(`lab/results/${arg('out', 'matrix')}.json`, JSON.stringify(out, null, 1));
process.exit(0);
