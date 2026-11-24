import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { clean, type Settings } from '../settings/model';
import { load, save, update, watch } from '../settings/store';
import { resolve, setSite } from '../settings/resolve';
import type { HelloReply, TabOverride, ToBackground } from '../messages';

const SCRIPT_ID = 'fringeless-page';
const UNTIL_RESTART = Number.MAX_SAFE_INTEGER;

async function overrides(): Promise<Record<string, TabOverride>> { return ((await browser.storage.session.get('tabs')).tabs as Record<string, TabOverride> | undefined) ?? {}; }
async function setOverride(tabId: number, value: TabOverride) {
  const all = await overrides();
  if (value) all[tabId] = value; else delete all[tabId];
  await browser.storage.session.set({ tabs: all });
  await browser.tabs.sendMessage(tabId, { t: 'tab', value }).catch(() => {});
}

/** Registers the page script for exactly the sites the person granted. */
let queue: Promise<void> = Promise.resolve();
function syncRegistration(): Promise<void> {
  queue = queue.then(async () => {
    const granted = (await browser.permissions.getAll()).origins ?? [];
    const matches = granted.includes('<all_urls>') || granted.includes('*://*/*') ? ['<all_urls>'] : granted;
    const old = await browser.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
    if (!matches.length) { if (old.length) await browser.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] }); return; }
    const script = { id: SCRIPT_ID, js: ['page.js'], matches, allFrames: true, matchOriginAsFallback: true, runAt: 'document_start' as const, persistAcrossSessions: true };
    if (old.length) await browser.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
    try { await browser.scripting.registerContentScripts([script]); }
    catch { const { matchOriginAsFallback: _, ...plain } = script; await browser.scripting.registerContentScripts([plain]); } // older Firefox
  }).catch((e) => console.error('Fringeless: registering failed', e));
  return queue;
}

/** Pages already open get the script without a reload. */
async function injectOpenTabs() {
  for (const t of await browser.tabs.query({})) {
    if (t.id !== undefined) await browser.scripting.executeScript({ target: { tabId: t.id, allFrames: true }, files: ['/page.js'], injectImmediately: true }).catch(() => {});
  }
}

// --- optional settings sync, split to fit the 8 KB per item limit ---
const CHUNK = 6500;
async function pushSync(s: Settings) {
  if (!s.sync) return;
  const body = JSON.stringify({ ...s, screens: [], pauseUntil: 0 }); // screens describe this computer only
  const parts = body.match(new RegExp(`[\\s\\S]{1,${CHUNK}}`, 'g')) ?? [];
  const remote = (await browser.storage.sync.get(['n'])) as { n?: number };
  if (parts.length > 14) return; // over the total quota
  await browser.storage.sync.set({ n: parts.length, ...Object.fromEntries(parts.map((p, i) => ['s' + i, p])) });
  const stale = Array.from({ length: Math.max(0, (remote.n ?? 0) - parts.length) }, (_, i) => 's' + (parts.length + i));
  if (stale.length) await browser.storage.sync.remove(stale);
}
async function pullSync() {
  const local = await load();
  if (!local.sync) return;
  const all = (await browser.storage.sync.get(null)) as Record<string, unknown>;
  const n = typeof all.n === 'number' ? all.n : 0;
  if (!n) return;
  try {
    const next = clean({ ...JSON.parse(Array.from({ length: n }, (_, i) => String(all['s' + i] ?? '')).join('')), screens: local.screens, pauseUntil: local.pauseUntil });
    if (JSON.stringify(next) !== JSON.stringify(local)) await save(next);
  } catch { /* a half-written update: the next change event brings the rest */ }
}

async function activeTab() { return (await browser.tabs.query({ active: true, lastFocusedWindow: true }))[0]; }

export default defineBackground({
  type: { chrome: 'module' },
  main() {
    browser.runtime.onInstalled.addListener((d) => {
      void (async () => {
        await save(await load());
        await syncRegistration();
        if (d.reason === 'install') await browser.tabs.create({ url: browser.runtime.getURL('/welcome.html') });
        await injectOpenTabs();
      })();
    });
    browser.runtime.onStartup.addListener(() => {
      void update((s) => (s.pauseUntil === UNTIL_RESTART ? { ...s, pauseUntil: 0 } : s));
      void syncRegistration();
    });
    const permissionsChanged = () => { void syncRegistration().then(injectOpenTabs); };
    browser.permissions.onAdded.addListener(permissionsChanged);
    browser.permissions.onRemoved.addListener(() => { void syncRegistration(); });
    browser.tabs.onRemoved.addListener((id) => { void overrides().then((o) => { if (o[id]) { delete o[id]; void browser.storage.session.set({ tabs: o }); } }); });

    let pushTimer: ReturnType<typeof setTimeout> | undefined;
    watch((s) => { clearTimeout(pushTimer); pushTimer = setTimeout(() => void pushSync(s).catch((e) => console.warn('Fringeless: sync failed', e)), 1500); });
    browser.storage.onChanged.addListener((_c, area) => { if (area === 'sync') void pullSync(); });

    browser.runtime.onMessage.addListener(((m: ToBackground, sender: { tab?: { id?: number; url?: string }; frameId?: number }, reply: (r: unknown) => void) => {
      const id = sender.tab?.id;
      if (m.t === 'hello') { void overrides().then((o) => reply({ tab: id !== undefined ? o[id] ?? null : null, url: sender.tab?.url ?? null } satisfies HelloReply)); return true; }
      if (m.t === 'status' && id !== undefined) {
        void browser.action.setBadgeText({ tabId: id, text: m.on ? '' : 'off' }).catch(() => {});
        void browser.action.setBadgeBackgroundColor({ tabId: id, color: '#5b6472' }).catch(() => {});
      }
      if (m.t === 'set-tab') { void setOverride(m.tabId, m.value).then(() => reply(true)); return true; }
      if (m.t === 'sync-now') { void pullSync().then(() => reply(true)); return true; }
      return undefined;
    }) as never);

    browser.commands.onCommand.addListener((cmd) => {
      void (async () => {
        if (cmd === 'toggle-all') { await update((s) => ({ ...s, on: !s.on })); return; }
        const t = await activeTab();
        if (!t?.id || !t.url) return;
        const tabId = t.id, o = (await overrides())[tabId] ?? null, s = await load();
        const now = resolve(s, { url: t.url, screen: { width: 0, height: 0, left: 0, top: 0 }, now: Date.now(), tab: o });
        if (cmd === 'toggle-tab') await setOverride(tabId, o ? null : now.on ? 'off' : 'on');
        if (cmd === 'toggle-site') { await setOverride(tabId, null); await save(setSite(s, t.url, resolve(s, { url: t.url, screen: { width: 0, height: 0, left: 0, top: 0 }, now: Date.now(), tab: null }).on ? 'off' : 'on')); }
      })();
    });
  },
});
