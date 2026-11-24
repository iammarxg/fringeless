// Scroll cost of the finalists: frame intervals plus GPU 3D-engine time of the browser's processes.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { launch, sleep } from './browsers.mjs';
import { serve } from './server.mjs';

const DATA = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='fl' color-interpolation-filters='sRGB'%3E%3CfeOffset/%3E%3C/filter%3E%3C/svg%3E#fl")`;
const ovl = (css) => `html::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:2147483647;${css}}`;
const sets = {
  chrome: {
    base: '',
    'html filter dataurl': `html{filter:${DATA}!important}`,
    'overlay opacity0': ovl(`opacity:0;backdrop-filter:${DATA}`),
    'overlay visible': ovl(`backdrop-filter:${DATA}`),
    'leaf opacity': 'p,li,h3,a,b,i,code,header{opacity:.999}',
    'base again': '',
  },
  firefox: {
    base: '',
    'html filter opacity': 'html{filter:opacity(.9999)!important}',
    'stroke transparent': 'html{-webkit-text-stroke:.01px transparent}',
    'html mask': 'html{mask-image:linear-gradient(#000,#000)!important}',
    'base again': '',
  },
};
const gpu = (secs, exe) => new Promise((res) => {
  const p = spawn('pwsh', ['-NoProfile', '-Command', `$ids=(Get-Process ${exe}).Id; $s=Get-Counter '\\GPU Engine(*engtype_3D)\\Utilization Percentage' -SampleInterval 1 -MaxSamples ${secs} -ErrorAction SilentlyContinue; $t=0;$n=0; foreach($x in $s){$n++; foreach($c in $x.CounterSamples){ if($c.InstanceName -match '^pid_(\\d+)_' -and $ids -contains [int]$Matches[1]){$t+=$c.CookedValue}}}; if($n){[math]::Round($t/$n,2)}else{-1}`]);
  let o = ''; p.stdout.on('data', (d) => (o += d)); p.on('close', () => res(parseFloat(o)));
});
const server = await serve(8799), out = [];
for (const name of ['chrome', 'firefox']) {
  const url = 'http://localhost:8799/scroll.html';
  const b = await launch(name, { port: 9900 + Math.floor(Math.random() * 90), url, extra: name === 'chrome' ? ['--window-size=2400,1300'] : ['-width', '2400', '-height', '1300'] });
  await sleep(1500);
  const size = await b.ev('[innerWidth,innerHeight,devicePixelRatio].join("x")');
  for (const [t, css] of Object.entries(sets[name])) {
    await b.goto(url + '?' + encodeURIComponent(t));
    await b.ev(`(()=>{const s=document.createElement('style');s.textContent=${JSON.stringify(css)};document.head.append(s);return 1})()`);
    await sleep(800);
    const g = gpu(4, name === 'chrome' ? 'chrome' : 'firefox'); // note: includes any other open windows of that browser
    const r = await b.ev(`new Promise(r=>{const d=[];let l=performance.now(),e=l+6500;(function f(){const n=performance.now();d.push(n-l);l=n;scrollBy(0,14);n<e?requestAnimationFrame(f):(d.shift(),d.sort((a,b)=>a-b),r({n:d.length,mean:d.reduce((a,b)=>a+b)/d.length,p95:d[d.length*.95|0],p99:d[d.length*.99|0]}))})()})`);
    const row = { browser: b.version, size, t, frames: r.n, mean: +r.mean.toFixed(2), p95: +r.p95.toFixed(2), p99: +r.p99.toFixed(2), gpu3d: await g };
    out.push(row); console.log(JSON.stringify(row));
  }
  await b.close();
}
server.close(); writeFileSync('lab/results/perf.json', JSON.stringify(out, null, 1)); process.exit(0);
