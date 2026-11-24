// Loads the built extension into installed browsers with throwaway profiles. No automation flags that touch rendering.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const FIREFOX = process.env.FIREFOX ?? 'C:/Program Files/Mozilla Firefox/firefox.exe';
const FF_ID = '{6f1c2f0a-5a0e-4f43-9d39-0b6a8e0c7d51}', FF_UUID = '0b6a8e0c-7d51-4f43-9d39-6f1c2f0a5a0e';
const kill = async (p, prof) => { await new Promise((r) => spawn('taskkill', ['/PID', String(p.pid), '/T', '/F'], { stdio: 'ignore' }).on('exit', r)); await sleep(800); try { rmSync(prof, { recursive: true, force: true, maxRetries: 8, retryDelay: 400 }); } catch {} };

export async function chromium(ext, { exe = 'chrome', dpr = 1, size = '900,800', args = [] } = {}) {
  const prof = resolve(`lab/.profiles/e2e-${exe}-${Date.now()}`); mkdirSync(prof, { recursive: true });
  const p = spawn(exe === 'edge' ? EDGE : CHROME, [`--user-data-dir=${prof}`, '--remote-debugging-pipe', '--enable-unsafe-extension-debugging', '--no-first-run', '--no-default-browser-check', '--disable-features=CalculateNativeWinOcclusion', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', `--force-device-scale-factor=${dpr}`, `--window-size=${size}`, '--window-position=60,60', ...args, 'about:blank'], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
  const [, , , w, r] = p.stdio; let id = 0, buf = ''; const pend = new Map(), errors = [];
  r.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\0')) >= 0) { const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); const x = pend.get(m.id); if (x) { pend.delete(m.id); m.error ? x.j(new Error(JSON.stringify(m.error))) : x.r(m.result); } else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text); } });
  const send = (method, params = {}, sessionId) => new Promise((res, j) => { const n = ++id; pend.set(n, { r: res, j }); w.write(JSON.stringify({ id: n, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0'); });
  const version = (await send('Browser.getVersion')).product;
  const extId = ext ? (await send('Extensions.loadUnpacked', { path: resolve(ext) })).id : null;
  await sleep(1500);
  const targets = async () => (await send('Target.getTargets')).targetInfos;
  const attach = async (targetId) => {
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Runtime.enable', {}, sessionId); await send('Page.enable', {}, sessionId).catch(() => {});
    const ev = async (expression, userGesture = false) => { const q = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture }, sessionId); if (q.exceptionDetails) throw new Error(q.exceptionDetails.exception?.description ?? q.exceptionDetails.text); return q.result.value; };
    return { targetId, ev, send: (m, a) => send(m, a, sessionId), goto: async (u) => { await send('Page.navigate', { url: u }, sessionId); for (let i = 0; i < 120; i++) { await sleep(100); try { if (await ev(`document.readyState==='complete'&&location.href!=='about:blank'`)) return; } catch {} } }, close: () => send('Target.closeTarget', { targetId }), front: () => send('Target.activateTarget', { targetId }) };
  };
  const open = async (url, newWindow = false) => { const t = await send('Target.createTarget', { url, newWindow }); const s = await attach(t.targetId); await sleep(900); return s; };
  const extPage = (f) => `chrome-extension://${extId}/${f}`;
  return { kind: 'chromium', version, extId, open, targets, attach, extPage, errors, send, close: () => kill(p, prof) };
}

export async function firefox(ext, { dpr = 1 } = {}) {
  const prof = resolve(`lab/.profiles/e2e-ff-${Date.now()}`); mkdirSync(prof, { recursive: true });
  const port = 9500 + Math.floor(Math.random() * 300);
  writeFileSync(prof + '/user.js', Object.entries({ 'layout.css.devPixelsPerPx': String(dpr), 'widget.windows.window_occlusion_tracking.enabled': false, 'browser.shell.checkDefaultBrowser': false, 'browser.aboutwelcome.enabled': false, 'datareporting.policy.dataSubmissionEnabled': false, 'browser.startup.homepage_override.mstone': 'ignore', 'browser.startup.page': 0, 'browser.preonboarding.enabled': false, 'termsofuse.acceptedVersion': 999, 'remote.active-protocols': 1, 'extensions.webextensions.uuids': JSON.stringify({ [FF_ID]: FF_UUID }) }).map(([k, v]) => `user_pref(${JSON.stringify(k)},${JSON.stringify(v)});`).join('\n'));
  const p = spawn(FIREFOX, ['-no-remote', '-profile', prof, `-remote-debugging-port=${port}`, '-remote-allow-system-access', '-width', '900', '-height', '800', 'about:blank'], { stdio: 'ignore' });
  let ws; for (let i = 0; i < 80 && !ws; i++) { await sleep(300); ws = await new Promise((r) => { const x = new WebSocket(`ws://127.0.0.1:${port}/session`); x.onopen = () => r(x); x.onerror = () => r(null); }); }
  if (!ws) { await kill(p, prof); throw new Error('firefox: no BiDi'); }
  let id = 0; const pend = new Map(), errors = [];
  ws.onmessage = (e) => { const m = JSON.parse(e.data), x = pend.get(m.id); if (x) { pend.delete(m.id); m.error ? x.j(new Error(m.error + ': ' + m.message)) : x.r(m.result); } else if (m.method === 'log.entryAdded' && m.params.level === 'error') errors.push(m.params.text); };
  const send = (method, params = {}) => new Promise((r, j) => { const n = ++id; pend.set(n, { r, j }); ws.send(JSON.stringify({ id: n, method, params })); });
  const ses = await send('session.new', { capabilities: {} });
  await send('session.subscribe', { events: ['log.entryAdded'] });
  if (ext) await send('webExtension.install', { extensionData: { type: 'path', path: resolve(ext) } });
  await sleep(1800);
  const attach = (ctx) => {
    const ev = async (expression, userActivation = false) => { const r = await send('script.evaluate', { expression: `(async()=>JSON.stringify(await (${expression})))()`, target: { context: ctx }, awaitPromise: true, userActivation }); if (r.type === 'exception') throw new Error(r.exceptionDetails.text); return r.result.value === undefined ? undefined : JSON.parse(r.result.value); };
    return { ev, goto: (u) => send('browsingContext.navigate', { context: ctx, url: u, wait: 'complete' }), close: () => send('browsingContext.close', { context: ctx }), front: () => send('browsingContext.activate', { context: ctx }) };
  };
  const open = async (url) => { const { context } = await send('browsingContext.create', { type: 'tab' }); const s = attach(context); await s.goto(url); await sleep(500); return s; };
  return { kind: 'firefox', version: 'Firefox/' + ses.capabilities.browserVersion, open, attach, extPage: (f) => `moz-extension://${FF_UUID}/${f}`, tree: async () => (await send('browsingContext.getTree', {})).contexts, errors, send, close: async () => { try { await Promise.race([send('browser.close'), sleep(1500)]); } catch {} await kill(p, prof); } };
}

export function grabber() {
  mkdirSync('lab/captures', { recursive: true });
  const py = spawn('python', ['-I', 'lab/runner/grab.py'], { stdio: ['pipe', 'pipe', 'inherit'] });
  const rl = createInterface({ input: py.stdout }), q = []; rl.on('line', (l) => q.shift()?.(l));
  const grab = async (out, title = 'fringeless-lab') => { const r = await new Promise((res) => { q.push(res); py.stdin.write(`${title}\t${resolve(out)}\n`); }); if (!r.startsWith('ok')) throw new Error('grab ' + r); return PNG.sync.read(readFileSync(out)); };
  return { grab, end: () => py.stdin.end() };
}
export function origin(img) { for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) { const i = (y * img.width + x) * 4; if (img.data[i] > 240 && img.data[i + 1] < 15 && img.data[i + 2] > 240) return [x, y]; } throw new Error('no marker'); }
export function zone(img, [ox, oy], r, dpr = 1) {
  const px = []; let chroma = 0;
  for (let y = Math.round(oy + r.y * dpr); y < Math.min(img.height, Math.round(oy + (r.y + r.h) * dpr)); y++) for (let x = Math.round(ox + r.x * dpr); x < Math.min(img.width, Math.round(ox + (r.x + r.w) * dpr)); x++) { const i = (y * img.width + x) * 4, d = img.data; px.push(d[i], d[i + 1], d[i + 2]); if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 8) chroma++; }
  return { chroma, px };
}
