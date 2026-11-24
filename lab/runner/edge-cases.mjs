// Hard cases for the finalists: modal dialog, popover, strict CSP, dark dialog, fullscreen, video, big page.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import http from 'node:http';
import { PNG } from 'pngjs';
import { launch, sleep } from './browsers.mjs';

const DATA = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='fl' color-interpolation-filters='sRGB'%3E%3CfeOffset/%3E%3C/filter%3E%3C/svg%3E#fl")`;
const ovl = `html::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:2147483647;opacity:0;backdrop-filter:${DATA}}`;
// in-document SVG + overlay built with DOM/CSSOM only (what a content script can do under any CSP)
const domOverlay = (extra = '') => `const N='http://www.w3.org/2000/svg',h=document.createElement('fringeless-overlay'),v=document.createElementNS(N,'svg'),f=document.createElementNS(N,'filter');f.id='fl-x';f.append(document.createElementNS(N,'feOffset'));v.append(f);v.style.cssText='position:absolute;width:0;height:0';h.append(v);h.style.cssText='all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647;opacity:0;backdrop-filter:url(#fl-x)';document.documentElement.append(h);${extra}`;
const JS = { 'dom overlay': domOverlay(), 'dom overlay popover': domOverlay("h.popover='manual';h.style.cssText+=';width:100vw;height:100vh;border:0;padding:0;margin:0;background:none;overflow:visible';window.__late=()=>{h.showPopover()}") };
const T = {
  chrome: { base: '', 'dom overlay': '', 'dom overlay popover': '', 'html dataurl': `html{filter:${DATA}!important}`, 'overlay opacity0': ovl, 'html dataurl + dialog/popover': `html,dialog[open],:popover-open{filter:${DATA}!important}`, 'overlay + dialog/popover': `${ovl}dialog[open],:popover-open{filter:${DATA}!important}` },
  firefox: { base: '', 'html opacity': 'html{filter:opacity(.9999)!important}', 'stroke': 'html{-webkit-text-stroke:.01px transparent}', 'html opacity + dialog/popover': 'html,dialog[open],:popover-open{filter:opacity(.9999)!important}' },
};
const HTML = `<!doctype html><meta charset=utf-8><title>fringeless-lab</title><style>html,body{margin:0;background:#fff;color:#000;font:16px/24px "Segoe UI"}div,dialog,[popover]:not(fringeless-overlay){position:absolute;left:20px;width:320px;height:24px;margin:0;border:0;padding:0;background:#fff;color:#000;inset-inline-end:auto}dialog::backdrop{background:none}#fid1,#fid2{position:fixed;width:12px;height:12px;background:#f0f;left:0;top:0}#fid2{left:auto;right:0;top:auto;bottom:0}</style>
<div id=fid1></div><div id=fid2></div><div id=page style="top:20px">Page Illiwm HAVE quick brown fox</div><dialog id=dlg style="top:60px">Dialog Illiwm HAVE quick brown</dialog><section popover=manual id=pop style="top:100px">Popover Illiwm HAVE quick brown</section><div id=late style="top:140px"></div>`;
mkdirSync('lab/captures', { recursive: true });
const py = spawn('python', ['-I', 'lab/runner/grab.py'], { stdio: ['pipe', 'pipe', 'inherit'] });
const rl = createInterface({ input: py.stdout }), q = []; rl.on('line', (l) => q.shift()?.(l));
const grab = async (o) => { await new Promise((r) => { q.push(r); py.stdin.write(`fringeless-lab\t${resolve(o)}\n`); }); return PNG.sync.read(readFileSync(o)); };
const server = http.createServer((rq, a) => { const csp = rq.url.includes('csp'); a.writeHead(200, { 'content-type': 'text/html', ...(csp ? { 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'none'" } : {}) }); a.end(HTML); }).listen(8798, '127.0.0.1');
const out = [];
for (const name of ['chrome', 'firefox']) {
  const b = await launch(name, { port: 9700 + Math.floor(Math.random() * 90), url: 'http://localhost:8798/' });
  await sleep(1500);
  for (const csp of [false, true]) for (const [t, css] of Object.entries(T[name])) {
    await b.goto(`http://localhost:8798/${csp ? 'csp' : 'x'}?${encodeURIComponent(t)}`);
    await b.ev(`(()=>{const s=document.createElement('style');s.textContent=${JSON.stringify(css)};document.head.append(s);${JS[t]||''};document.getElementById('dlg').showModal();document.getElementById('pop').showPopover();document.getElementById('late').textContent='Late Illiwm HAVE quick brown';window.__late&&__late();return 1})()`);
    await sleep(700);
    const img = await grab(`lab/captures/case-${name}.png`);
    let x0 = -1, y0 = -1; for (let y = 0; y < img.height && x0 < 0; y++) for (let x = 0; x < img.width; x++) { const i = (y * img.width + x) * 4; if (img.data[i] > 240 && img.data[i + 1] < 15 && img.data[i + 2] > 240) { x0 = x; y0 = y; break; } }
    const c = (top) => { let n = 0; for (let y = y0 + top; y < y0 + top + 24; y++) for (let x = x0 + 20; x < x0 + 340; x++) { const i = (y * img.width + x) * 4, d = img.data; if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 8) n++; } return n; };
    const row = { browser: b.version, csp, t, page: c(20), dialog: c(60), popover: c(100), late: c(140) };
    out.push(row); console.log(JSON.stringify(row));
  }
  await b.close();
}
py.stdin.end(); server.close(); writeFileSync('lab/results/edge-cases.json', JSON.stringify(out, null, 1)); process.exit(0);
