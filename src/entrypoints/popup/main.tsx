import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { browser } from 'wxt/browser';
import '../../ui/theme.css';
import './style.css';
import { Looks, Seg, Select, Toggle, TuningSliders, Wordmark, editProfile, env, useSettings } from '../../ui/components';
import { findProfile } from '../../settings/model';
import { hostPattern, resolve, setSite, siteRule, type Reason } from '../../settings/resolve';
import { fringePixels } from '../../engine/measure';
import type { ProbeReply, TabOverride } from '../../messages';

const WHY: Record<Reason, string> = {
  tab: 'Switched for this tab only', paused: 'Paused', off: 'Turned off everywhere', site: 'You set this site', screen: 'This screen is set to off', scope: 'Only runs on sites you choose', on: 'On for all sites',
};
interface Tab { id: number; url: string; windowId: number }
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function capture(windowId: number): Promise<Uint8ClampedArray> {
  const img = new Image(); img.src = await browser.tabs.captureVisibleTab(windowId, { format: 'png' }); await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d', { willReadFrequently: true })!; x.drawImage(img, 0, 0);
  return x.getImageData(0, 0, c.width, c.height).data;
}

function Popup() {
  const [s, change] = useSettings();
  const [tab, setTab] = useState<Tab | null>(null);
  const [probe, setProbe] = useState<ProbeReply | null>(null);
  const [override, setOverride] = useState<TabOverride>(null);
  const [access, setAccess] = useState<boolean | null>(null);
  const [kind, setKind] = useState<'dark' | 'light'>(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const [check, setCheck] = useState('');

  const ask = (id: number) => browser.tabs.sendMessage(id, { t: 'probe' }, { frameId: 0 }).then((r) => setProbe((r as ProbeReply) ?? null)).catch(() => setProbe(null));
  useEffect(() => {
    void (async () => {
      // ?tab=<id> lets the popup be opened as a page for testing
      const given = Number(new URLSearchParams(location.search).get('tab'));
      const t = given ? await browser.tabs.get(given) : (await browser.tabs.query({ active: true, currentWindow: true }))[0];
      if (!t?.id) return;
      const info = { id: t.id, url: t.url ?? '', windowId: t.windowId };
      setTab(info);
      const o = ((await browser.storage.session.get('tabs')).tabs as Record<string, TabOverride> | undefined)?.[t.id] ?? null;
      setOverride(o);
      setAccess(hostPattern(info.url) ? await browser.permissions.contains({ origins: [new URL(info.url).origin + '/*'] }).catch(() => false) : null);
      await ask(t.id);
    })();
  }, []);
  if (!s || !tab) return null;

  const host = hostPattern(tab.url);
  const now = resolve(s, { url: tab.url, screen: probe?.screen ?? { width: 0, height: 0, left: 0, top: 0 }, now: Date.now(), tab: override });
  const on = !!host && access === true && now.on;
  const rule = siteRule(s, tab.url);
  const p = now.profile;
  const grant = async (all: boolean) => {
    const ok = await browser.permissions.request({ origins: all ? ['<all_urls>'] : [new URL(tab.url).origin + '/*'] });
    if (ok) { setAccess(true); change((v) => ({ ...v, onboarded: true })); }
  };
  const setTabMode = async (v: TabOverride) => { await browser.runtime.sendMessage({ t: 'set-tab', tabId: tab.id, value: v }); setOverride(v); };
  const toggle = (v: boolean) => {
    if (override) void setTabMode(null);
    change((x) => { const y = { ...x, on: v ? true : x.on, pauseUntil: v ? 0 : x.pauseUntil }; return setSite(y, tab.url, v ? 'on' : 'off'); });
  };
  const preview = (mode: 'native' | null) => browser.tabs.sendMessage(tab.id, { t: 'preview', mode }).catch(() => {});
  const runCheck = async () => {
    setCheck('Checking…');
    try {
      await preview('native'); await wait(450); const a = await capture(tab.windowId);
      await preview(null); await wait(700); const b = await capture(tab.windowId);
      const r = fringePixels(a, b);
      setCheck(!r.changed ? 'No difference found on the visible part of this page.' : `Colored text-edge pixels in view: ${r.before.toLocaleString()} without Fringeless, ${r.after.toLocaleString()} with it.`);
    } catch { await preview(null); setCheck('The browser would not let this page be captured.'); }
  };
  const pickLook = (id: string) => change((x) => (rule?.profileId ? { ...x, sites: x.sites.map((r) => (r === rule ? { ...r, profileId: id } : r)) } : now.screen?.profileId ? { ...x, screens: x.screens.map((r) => (r.id === now.screen!.id ? { ...r, profileId: id } : r)) } : { ...x, profileId: id }));
  const ownLook = (v: boolean) => change((x) => {
    if (!host) return x;
    if (!v) { const sites = x.sites.map((r) => (r === rule ? { ...r, profileId: null } : r)).filter((r) => r.action !== 'inherit' || r.profileId); return { ...x, sites }; }
    return rule && rule.pattern === host ? { ...x, sites: x.sites.map((r) => (r === rule ? { ...r, profileId: p.id } : r)) } : { ...x, sites: [{ pattern: host, action: rule?.action ?? 'inherit', profileId: p.id }, ...x.sites] };
  });

  return <main class="stack">
    <header class="row between"><Wordmark on={on} /><button class="btn ghost" onClick={() => { void browser.runtime.openOptionsPage(); close(); }}>Settings</button></header>

    {!host ? <p class="muted">Extensions cannot run on this page. Open a website to use Fringeless.</p>
      : access === false ? <section class="stack">
        <h3>Let Fringeless change text here</h3>
        <p class="small muted">The browser asks you to confirm. Nothing you read leaves your computer.</p>
        <button class="btn primary" onClick={() => void grant(true)}>Turn on for all sites</button>
        <button class="btn" onClick={() => void grant(false)}>Only for {host}</button>
      </section>
        : <>
          <Toggle on={on} onChange={toggle} label={<>{on ? 'On' : 'Off'} for {host}</>} hint={WHY[now.reason]} />
          <section class="stack">
            {s.profiles.length <= 6 ? <Looks compact name="popup" profiles={s.profiles} value={p.id} onPick={pickLook} />
              : <Select label="Look" value={p.id} style="max-width:none" options={s.profiles.map((x) => ({ value: x.id, label: x.name }))} onChange={pickLook} />}
            <Toggle on={!!rule?.profileId} onChange={ownLook} label={<>Different look on this site</>} />
          </section>
          <section class="stack">
            <Seg label="Which text to tune" value={kind} options={[['dark', 'Light text on dark'], ['light', 'Dark text on light']]} onChange={setKind} />
            <TuningSliders value={p[kind]} onChange={(t) => change((x) => editProfile(x, p.id, { [kind]: t }))} />
            <p class="note muted">Changes the “{findProfile(s, p.id)?.name}” look everywhere it is used.</p>
          </section>
          <section class="stack">
            <div class="actions">
              <button class="btn" onPointerDown={() => void preview('native')} onPointerUp={() => void preview(null)} onPointerLeave={() => void preview(null)} onKeyDown={(e) => e.key === ' ' && void preview('native')} onKeyUp={() => void preview(null)} onBlur={() => void preview(null)}>Hold to compare</button>
              {env.browser === 'chromium' && <button class="btn" onClick={() => void runCheck()} disabled={check === 'Checking…'}>Check this page</button>}
              <Select label="Pause" placeholder="Pause" value={null} options={[
                { value: 'tab', label: override === 'off' ? 'Resume this tab' : 'This tab' },
                ...(s.pauseUntil > Date.now() ? [{ value: 'resume', label: 'Resume everywhere' }] : [{ value: 'hour', label: 'Everywhere, 1 hour' }, { value: 'restart', label: 'Everywhere, until restart' }]),
                { value: 'all', label: s.on ? 'Turn off everywhere' : 'Turn on everywhere' },
              ]} onChange={(v: string) => {
                if (v === 'tab') void setTabMode(override === 'off' ? null : 'off');
                if (v === 'hour') change((x) => ({ ...x, pauseUntil: Date.now() + 3600e3 }));
                if (v === 'restart') change((x) => ({ ...x, pauseUntil: Number.MAX_SAFE_INTEGER }));
                if (v === 'resume') change((x) => ({ ...x, pauseUntil: 0 }));
                if (v === 'all') change((x) => ({ ...x, on: !x.on }));
              }} />
            </div>
            {check && <p class="small" role="status">{check}</p>}
            {!check && probe === null && <p class="small warn">Reload this page for changes to show.</p>}
          </section>
        </>}
  </main>;
}

render(<Popup />, document.getElementById('app')!);
