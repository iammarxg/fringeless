// Q1: do relative-color stroke/fill/shadow stay unresolved when inherited (so one html rule adapts to each element's color)?
// Q2: does offset+arithmetic shift a channel by an exact fraction at any device scale (Chromium overlay)?
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import http from 'node:http';
import { PNG } from 'pngjs';
import { launch, sleep } from './browsers.mjs';

mkdirSync('lab/captures', { recursive: true });
const py = spawn('python', ['-I', 'lab/runner/grab.py'], { stdio: ['pipe', 'pipe', 'inherit'] });
const rl = createInterface({ input: py.stdout }), q = []; rl.on('line', (l) => q.shift()?.(l));
const grab = async (o) => { await new Promise((r) => { q.push(r); py.stdin.write(`fringeless-lab\t${resolve(o)}\n`); }); return PNG.sync.read(readFileSync(o)); };
const PAGE = `<!doctype html><meta charset=utf-8><title>fringeless-lab</title><style>html,body{margin:0;background:#000}
#fid{position:fixed;left:0;top:0;width:12px;height:12px;background:#f0f}
.w{position:absolute;left:20px;width:360px;height:40px;font:600 30px/40px "Segoe UI";padding-left:4px;box-sizing:border-box}
#a{top:20px;background:#000;color:#fff}#b{top:60px;background:#fff;color:#000}#c{top:100px;background:#000;color:#8cf}
#bar{position:absolute;left:100px;top:160px;width:40px;height:40px;background:#fff}</style>
<div id=fid></div><div class=w id=a>HIIIIH light</div><div class=w id=b>HIIIIH dark</div><div class=w id=c>HIIIIH blue</div><div id=bar></div>`;
const server = http.createServer((_, a) => { a.writeHead(200, { 'content-type': 'text/html' }); a.end(PAGE); }).listen(8797, '127.0.0.1');
const fid = (img) => { for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) { const i = (y * img.width + x) * 4; if (img.data[i] > 240 && img.data[i + 1] < 15 && img.data[i + 2] > 240) return [x, y]; } };
const out = {};
const gate = (lo, hi) => `clamp(0, (l - .5) * 1000, 1) * ${hi} + clamp(0, (.5 - l) * 1000, 1) * ${lo}`;
const css = {
  base: '',
  'stroke only on light text': `html{-webkit-text-stroke:.6px oklch(from currentcolor l c h / calc(${gate(0, 1)}))}`,
  'stroke only on dark text': `html{-webkit-text-stroke:.6px oklch(from currentcolor l c h / calc(${gate(1, 0)}))}`,
  'shadow boost': 'html{text-shadow:0 0 0 currentcolor}',
  'shadow boost light only': `html{text-shadow:0 0 0 oklch(from currentcolor l c h / calc(${gate(0, 1)}))}`,
  'soften fill': 'html{-webkit-text-fill-color:oklch(from currentcolor clamp(.2, l, .85) c h)}',
};
Object.assign(css, Object.fromEntries(Object.entries(css).filter(([k]) => /stroke|soften/.test(k)).map(([k, v]) => ['* ' + k, v.replace('html{', '*{')])));
for (const name of process.argv.includes('--q2') ? [] : ['chrome', 'firefox']) {
  const b = await launch(name, { port: 9600 + Math.floor(Math.random() * 90), url: 'http://localhost:8797/' }); await sleep(1200);
  for (const [t, c] of Object.entries(css)) {
    await b.goto('http://localhost:8797/?' + encodeURIComponent(t));
    await b.ev(`(()=>{const s=document.createElement('style');s.textContent=${JSON.stringify(c)};document.head.append(s);return 1})()`); await sleep(500);
    const img = await grab('lab/captures/q.png'), [x0, y0] = fid(img);
    const m = (top) => { let s = 0, mx = 0, mn = 255; for (let y = y0 + top; y < y0 + top + 40; y++) for (let x = x0 + 20; x < x0 + 380; x++) { const v = img.data[(y * img.width + x) * 4 + 1]; s += v; mx = Math.max(mx, v); mn = Math.min(mn, v); } return [Math.round(s / 1000), mn, mx]; };
    (out[name] ??= {})[t] = { light: m(20), dark: m(60), blue: m(100) };
    console.log(name.padEnd(8), t.padEnd(26), 'lightText', m(20), 'darkText', m(60), 'blueText', m(100));
  }
  await b.close();
}
// Q2
for (const dpr of [1, 1.25, 1.5, 2]) {
  const b = await launch('chrome', { dpr, port: 9600 + Math.floor(Math.random() * 90), url: 'http://localhost:8797/' }); await sleep(1200);
  for (const [label, d, conv] of [['linear .5 x', .5], ['linear .25 x', .25], ['CONV .5', .5, 1], ['CONV sharp', .5, 2]]) {
    await b.goto('http://localhost:8797/?f' + d);
    await b.ev(`(()=>{const N='http://www.w3.org/2000/svg',mk=(t,a,p)=>{const e=document.createElementNS(N,t);for(const k in a)e.setAttribute(k,a[k]);p&&p.append(e);return e};
      const h=document.createElement('div'),v=mk('svg',{width:0,height:0},h),f=mk('filter',{id:'fq',x:0,y:0,width:1,height:1,'color-interpolation-filters':'sRGB'},v),px=1/devicePixelRatio;
      mk('feColorMatrix',{in:'SourceGraphic',values:'1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1',result:'r'},f);
      mk('feColorMatrix',{in:'SourceGraphic',values:'0 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 0 1',result:'gb'},f);
      if(${conv||0}){mk('feConvolveMatrix',{in:'r',order:'5 1',divisor:1,preserveAlpha:'true',edgeMode:'duplicate',kernelMatrix:${conv===2?1:0}?'0 -.0625 .5625 .5625 -.0625':'0 0 .5 .5 0',result:'rs'},f)}else{mk('feOffset',{in:'r',dx:px,dy:0,result:'r1'},f);
      mk('feComposite',{in:'r',in2:'r1',operator:'arithmetic',k1:0,k2:${1 - d},k3:${d},k4:0,result:'rs'},f);}
      mk('feComposite',{in:'rs',in2:'gb',operator:'arithmetic',k1:0,k2:1,k3:1,k4:0},f);
      h.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:99;backdrop-filter:url(#fq)';document.documentElement.append(h);return 1})()`);
    await sleep(500);
    const img = await grab('lab/captures/q.png'), [x0, y0] = fid(img);
    const y = y0 + Math.round(180 * dpr), row = []; const c = x0 + Math.round(100 * dpr);
    for (let x = c - 3; x < c + 4; x++) row.push(img.data[(y * img.width + x) * 4] + '/' + img.data[(y * img.width + x) * 4 + 1]);
    console.log('dpr', dpr, label, 'R/G across left edge', row.join(' '));
    (out.shift ??= []).push({ dpr, label, row });
  }
  await b.close();
}
py.stdin.end(); server.close(); writeFileSync('lab/results/engine-questions.json', JSON.stringify(out, null, 1)); process.exit(0);
