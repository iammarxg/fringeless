// How smooth the website's simulator is: GPU+CPU cost of one full draw, and frame gaps while its controls move.
// Build first: npm run site:build
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { chromium, sleep } from '../../tests/e2e/drivers.mjs';

const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = await new Promise((r) => { const s = http.createServer((q, a) => { let f = new URL(q.url, 'http://x').pathname; if (f === '/') f = '/index.html'; try { const b = readFileSync('.output/site' + f); a.writeHead(200, { 'content-type': T[extname(f)] ?? 'application/octet-stream' }); a.end(b); } catch { a.writeHead(404); a.end(); } }).listen(8795, '127.0.0.1', () => r(s)); });
const b = await chromium(null, { size: '1500,1000', dpr: Number(process.argv[2] ?? 1), args: process.argv.slice(3) });
const p = await b.open('about:blank', true);
await p.goto('http://localhost:8795/'); await sleep(5000);
console.log(await p.ev(`(()=>{const c=document.querySelector('.stage canvas');return c.width+'x'+c.height+' of '+innerWidth+' dpr '+devicePixelRatio+' '+(()=>{const g=c.getContext('webgl2'),e=g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):''})()})()`));
const run = (name, body) => p.ev(`(async()=>{
  const gaps=[],busy=[];let last=performance.now(),go=true;const t0=last;
  const range=document.querySelector('.dist input'),split=document.querySelector('.split'),stage=document.querySelector('.stage');
  const r=stage.getBoundingClientRect();stage.setPointerCapture=()=>{};stage.hasPointerCapture=()=>true;
  const fire=(t,x)=>stage.dispatchEvent(new PointerEvent(t,{bubbles:true,clientX:r.left+r.width*x,clientY:r.top+50,pointerId:1,buttons:1}));
  await new Promise(done=>{const f=(now)=>{gaps.push(now-last);last=now;const t=(now-t0)/3000;if(t>=1)return done();const s=performance.now();${body};busy.push(performance.now()-s);requestAnimationFrame(f)};requestAnimationFrame(f)});
  gaps.shift();gaps.sort((a,b)=>a-b);const q=(k)=>gaps[Math.floor(gaps.length*k)].toFixed(1);
  return ${JSON.stringify(name)}+': '+gaps.length+' frames in 3 s, median '+q(.5)+' ms, 95% '+q(.95)+' ms, worst '+gaps.at(-1).toFixed(1)+' ms';
})()`);
console.log(await run('nothing moving', ''));
console.log(await run('divider', `fire(t<.01?'pointerdown':'pointermove',.5+.45*Math.sin(t*12))`));
console.log(await run('distance', `range.value=.5+.5*Math.sin(t*9);range.dispatchEvent(new Event('input',{bubbles:true}))`));
await b.close(); server.close(); process.exit(0);
