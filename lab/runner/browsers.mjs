import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PATHS = {
  chrome: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  edge: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  firefox: 'C:/Program Files/Mozilla Firefox/firefox.exe',
};
const W = 820, H = 720;

class Sock {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.p = new Map();
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data), x = this.p.get(m.id);
      if (!x) return;
      this.p.delete(m.id);
      if (m.error) x.j(new Error(JSON.stringify(m).slice(0, 400))); else x.r(m.result);
    };
  }
  static async open(url) {
    const ws = new WebSocket(url);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws ' + url)); });
    return new Sock(ws);
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((r, j) => this.p.set(id, { r, j }));
  }
}

/** Own throwaway profile and flags: no automation defaults that could change text rendering. */
export async function launch(name, { dpr = 1, port = 9400, url, extra = [], prefs = {} }) {
  const prof = resolve(`lab/.profiles/${name}-${dpr}-${Date.now()}`);
  mkdirSync(prof, { recursive: true });
  const finish = async (p) => {
    await new Promise((r) => spawn('taskkill', ['/PID', String(p.pid), '/T', '/F'], { stdio: 'ignore' }).on('exit', r));
    await sleep(800);
    try { rmSync(prof, { recursive: true, force: true, maxRetries: 8, retryDelay: 400 }); } catch {}
  };
  if (name !== 'firefox') {
    const p = spawn(PATHS[name], [
      `--user-data-dir=${prof}`, `--remote-debugging-port=${port}`, '--no-first-run', '--no-default-browser-check',
      '--disable-features=CalculateNativeWinOcclusion', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
      `--force-device-scale-factor=${dpr}`, `--window-size=${W},${H}`, '--window-position=60,60', ...(name === 'edge' ? ['--inprivate'] : []), ...extra, `--app=${url}`], { stdio: 'ignore' });
    let t;
    for (let i = 0; i < 60 && !t; i++) {
      await sleep(300);
      try { t = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((x) => x.type === 'page' && x.url.startsWith('http')); } catch {}
    }
    if (!t) { await finish(p); throw new Error(name + ': no debug target'); }
    const v = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    const s = await Sock.open(t.webSocketDebuggerUrl);
    const ev = async (expr) => {
      const r = await s.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 500));
      return r.result.value;
    };
    return {
      name, version: v.Browser, ev,
      goto: async (u) => {
        await s.send('Page.navigate', { url: u });
        for (let i = 0; i < 80; i++) {
          await sleep(100);
          try { if (await ev(`document.readyState==='complete'&&location.href===${JSON.stringify(u)}`)) return; } catch {}
        }
        throw new Error('nav timeout ' + u);
      },
      shot: async () => Buffer.from((await s.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'),
      close: () => finish(p),
    };
  }
  const all = {
    'layout.css.devPixelsPerPx': String(dpr), 'widget.windows.window_occlusion_tracking.enabled': false,
    'browser.shell.checkDefaultBrowser': false, 'browser.aboutwelcome.enabled': false, 'datareporting.policy.dataSubmissionEnabled': false,
    'browser.startup.homepage_override.mstone': 'ignore', 'browser.startup.page': 0, 'browser.preonboarding.enabled': false,
    'termsofuse.acceptedVersion': 999, 'remote.active-protocols': 1, ...prefs,
  };
  writeFileSync(prof + '/user.js', Object.entries(all).map(([k, v]) => `user_pref(${JSON.stringify(k)},${JSON.stringify(v)});`).join('\n'));
  const p = spawn(PATHS.firefox, ['-no-remote', '-profile', prof, `-remote-debugging-port=${port}`, '-width', String(W), '-height', String(H + 60), ...extra, 'about:blank'], { stdio: 'ignore' });
  let s;
  for (let i = 0; i < 80 && !s; i++) { await sleep(300); try { s = await Sock.open(`ws://127.0.0.1:${port}/session`); } catch {} }
  if (!s) { await finish(p); throw new Error('firefox: no BiDi socket'); }
  const ses = await s.send('session.new', { capabilities: {} });
  const ctx = (await s.send('browsingContext.getTree', {})).contexts[0].context;
  const ev = async (expr) => {
    const r = await s.send('script.evaluate', { expression: `(async()=>JSON.stringify(await (${expr})))()`, target: { context: ctx }, awaitPromise: true });
    if (r.type === 'exception') throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 500));
    return r.result.value === undefined ? undefined : JSON.parse(r.result.value);
  };
  const goto = (u) => s.send('browsingContext.navigate', { context: ctx, url: u, wait: 'complete' });
  await goto(url);
  return {
    name, version: 'Firefox/' + ses.capabilities.browserVersion, ev, goto,
    shot: async () => Buffer.from((await s.send('browsingContext.captureScreenshot', { context: ctx })).data, 'base64'),
    close: async () => { try { await Promise.race([s.send('browser.close'), sleep(1500)]); } catch {} await finish(p); },
  };
}
