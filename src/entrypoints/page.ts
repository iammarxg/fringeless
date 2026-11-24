import { browser } from 'wxt/browser';
import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import { Applier } from '../engine/apply';
import { detectEnv, lcdTextOn, screenInfo } from '../engine/detect';
import { load, watch } from '../settings/store';
import { resolve, type Resolved } from '../settings/resolve';
import type { Settings } from '../settings/model';
import type { HelloReply, ProbeReply, TabOverride, ToContent } from '../messages';

export default defineUnlistedScript(() => {
  const g = globalThis as { __fringeless?: true };
  if (g.__fringeless || !(document.documentElement instanceof HTMLElement) || document.contentType === 'application/pdf') return;
  g.__fringeless = true;

  const env = detectEnv();
  const top = window.top === window;
  const applier = new Applier(document, env, top);
  let settings: Settings | null = null;
  let tab: TabOverride = null;
  let preview: 'native' | null = null;
  let tabUrl: string | null = null;
  let last: Resolved | null = null;
  let seen = '';

  const url = () => {
    if (top) return location.href;
    const anc = (location as Location & { ancestorOrigins?: DOMStringList }).ancestorOrigins;
    return tabUrl ?? (anc && anc.length ? anc[anc.length - 1] + '/' : location.href);
  };
  const run = () => {
    if (!settings) return;
    last = resolve(settings, { url: url(), screen: screenInfo(), now: Date.now(), tab });
    applier.set(last.on && preview === null ? { profile: last.profile, panel: last.panel } : null);
    if (top) void browser.runtime.sendMessage({ t: 'status', on: last.on, reason: last.reason }).catch(() => {});
  };
  const hello = async () => {
    try {
      const r = (await browser.runtime.sendMessage({ t: 'hello' })) as HelloReply | undefined;
      if (r) { tab = r.tab; tabUrl = r.url; run(); }
    } catch { /* background not ready yet: storage alone is enough to start */ }
  };

  applier.start();
  void load().then((s) => { settings = s; run(); });
  void hello();
  const unwatch = watch((s) => { settings = s; run(); });

  const onMessage = (m: ToContent, _s: unknown, reply: (r: unknown) => void): boolean | undefined => {
    if (m.t === 'tab') { tab = m.value; run(); reply(true); }
    else if (m.t === 'preview') { preview = m.mode; run(); reply(true); }
    else if (m.t === 'probe' && top) {
      const r: ProbeReply = { env, screen: screenInfo(), lcd: env.browser === 'chromium' ? lcdTextOn() : null, on: !!last?.on, reason: last?.reason ?? 'off', panel: last?.panel.id ?? '', profile: last?.profile.id ?? '' };
      reply(r);
    }
    return undefined;
  };
  browser.runtime.onMessage.addListener(onMessage as never);

  // Nothing announces "this window moved to another screen" or a single-page-app URL change, so look when it is cheap.
  const check = () => {
    if (!browser.runtime?.id) { teardown(); return; } // extension updated, disabled or removed
    if (document.hidden || !settings) return;
    const key = JSON.stringify(screenInfo()) + url() + (settings.pauseUntil > Date.now());
    if (key !== seen) { seen = key; run(); }
  };
  const timer = setInterval(check, 2000);
  for (const e of ['focus', 'resize', 'pageshow'] as const) window.addEventListener(e, check);
  document.addEventListener('visibilitychange', check);
  const teardown = () => {
    clearInterval(timer);
    for (const e of ['focus', 'resize', 'pageshow'] as const) window.removeEventListener(e, check);
    document.removeEventListener('visibilitychange', check);
    try { unwatch(); } catch { /* context already gone */ }
    applier.stop();
  };
});
