import { useState } from 'preact/hooks';
import { MONITORS, matchMonitor, searchMonitors, type Match, type Monitor } from '../data/monitors';
import { screenInfo } from '../engine/detect';
import { findPanel, type ScreenMatch, type Settings } from '../settings/model';
import { Select } from './components';

interface Detailed { label: string; width: number; height: number; left: number; top: number; availLeft: number; availTop: number; devicePixelRatio: number; isPrimary: boolean }
interface Details { screens: Detailed[]; currentScreen: Detailed }
interface Found { label: string; here: boolean; px: { w: number; h: number }; match: ScreenMatch; result: Match }
type Change = (fn: (s: Settings) => Settings) => void;

export const canDetect = typeof (globalThis as { getScreenDetails?: unknown }).getScreenDetails === 'function';

async function detect(): Promise<Found[]> {
  const d = await (globalThis as unknown as { getScreenDetails(): Promise<Details> }).getScreenDetails();
  return d.screens.map((s) => {
    const px = { w: Math.round(s.width * s.devicePixelRatio), h: Math.round(s.height * s.devicePixelRatio) };
    return { label: s.label, here: s === d.currentScreen, px, match: { width: s.width, height: s.height, left: s.availLeft, top: s.availTop }, result: matchMonitor(s.label, px) };
  }).sort((a, b) => Number(b.here) - Number(a.here));
}

/** Saves a panel for one screen. The screen this window is on also sets the default when nothing was chosen before. */
function assign(s: Settings, f: Found, panel: string, name: string, enabled = true): Settings {
  const same = (m: ScreenMatch) => m.width === f.match.width && m.height === f.match.height && (m.left === null || (m.left === f.match.left && m.top === f.match.top));
  const old = s.screens.find((x) => same(x.match));
  const screens = old ? s.screens.map((x) => (x === old ? { ...x, panel, enabled, name: name || x.name } : x)) : [...s.screens, { id: crypto.randomUUID().slice(0, 8), name: name || 'Screen', match: f.match, enabled, panel, profileId: null }];
  return { ...s, screens, panel: f.here || s.panel === 'unknown' ? panel : s.panel };
}

function Row({ f, s, change, onPicked }: { f: Found; s: Settings; change: Change; onPicked?: (panel: string) => void }) {
  const [done, setDone] = useState<string | null>(null);
  const use = (panel: string, name: string, enabled = true) => { change((v) => assign(v, f, panel, name, enabled)); setDone(enabled ? findPanel(s, panel).name : 'off'); if (f.here && enabled) onPicked?.(panel); };
  const r = f.result;
  return <div>
    <div class="row between"><strong>{f.label || 'Unnamed screen'}</strong><span class="small muted">{f.px.w} x {f.px.h}{f.here ? ', this screen' : ''}</span></div>
    {done ? <p class="small">{done === 'off' ? 'Fringeless stays off on this screen.' : `Set to ${done}.`}</p>
      : <>
        {r.kind === 'sure' || r.kind === 'likely' ? <>
          <p class="small">{r.kind === 'sure' ? 'Matches' : 'Looks like'} {r.monitor.brand} {r.monitor.model}: {r.monitor.size}. Layout: {findPanel(s, r.monitor.panel).name}.</p>
          <div class="row"><button type="button" class="btn primary" onClick={() => use(r.monitor.panel, f.label)}>Use this layout</button><button type="button" class="btn" onClick={() => use(r.monitor.panel, f.label, false)}>Keep Fringeless off here</button></div>
        </>
          : r.kind === 'choose' ? <>
            <p class="small">Several {r.candidates[0]!.brand} models use this name. Which one is it?</p>
            <div class="row"><Select label="Model" placeholder="Choose your model" value={null} options={r.candidates.map((m) => ({ value: m.model, label: `${m.brand} ${m.model}, ${m.size}` }))} onChange={(v) => { const m = r.candidates.find((x) => x.model === v)!; use(m.panel, `${m.brand} ${m.model}`); }} /><button type="button" class="btn" onClick={() => use('unknown', f.label, false)}>Keep Fringeless off here</button></div>
          </>
            : <>
              <p class="small">{r.kind === 'tv' ? 'LG TVs do not report their model. Most LG OLED TVs before the G5 use RWBG. An LCD needs nothing.' : 'Not in the list. It may be an LCD, a laptop screen or a newer model.'}</p>
              <div class="row">{r.kind === 'tv' && <button type="button" class="btn" onClick={() => use('woled-rwbg', f.label)}>It is an OLED before the G5</button>}<button type="button" class="btn" onClick={() => use('rgb', f.label)}>{r.kind === 'tv' ? 'It is an LCD' : 'It is an LCD or RGB stripe'}</button><button type="button" class="btn" onClick={() => use('unknown', f.label, false)}>Keep Fringeless off here</button></div>
            </>}
      </>}
  </div>;
}

export function DetectScreens({ s, change, onPicked }: { s: Settings; change: Change; onPicked?: (panel: string) => void }) {
  const [found, setFound] = useState<Found[] | null>(null);
  const [msg, setMsg] = useState('');
  const [q, setQ] = useState('');
  const hits = searchMonitors(q);
  const run = async () => {
    setMsg('');
    try { setFound(await detect()); } catch (e) { setMsg((e as Error).name === 'NotAllowedError' ? 'The browser did not allow reading screen names. Search for your model instead.' : 'This browser could not read screen names. Search for your model instead.'); }
  };
  const pick = (m: Monitor) => {
    const i = screenInfo();
    change((v) => assign(v, { label: '', here: true, px: { w: m.w, h: m.h }, match: { ...i }, result: { kind: 'none' } }, m.panel, `${m.brand} ${m.model}`));
    onPicked?.(m.panel); setQ(''); setMsg(`Set this screen to ${m.brand} ${m.model}: ${findPanel(s, m.panel).name}.`);
  };
  return <div class="stack">
    {canDetect ? <div class="row"><button type="button" class="btn primary" onClick={() => void run()}>Detect my screens</button><span class="small muted">Your browser will ask to manage windows on your displays. That is how it shares screen names.</span></div>
      : <p class="small muted">This browser does not share screen names. Type your model instead.</p>}
    {found && <div class="found">{found.map((f) => <Row f={f} s={s} change={change} onPicked={onPicked} />)}</div>}
    <label class="field"><span>Or find your model</span><input type="text" placeholder="For example XG27AQDMG or AW3423DWF" value={q} onInput={(e) => setQ(e.currentTarget.value)} /></label>
    {q.trim() && (hits.length ? <ul class="results">{hits.map((m) => <li><button type="button" onClick={() => pick(m)}><span>{m.brand} {m.model}</span><span class="muted">{m.size}</span></button></li>)}</ul> : <p class="small muted">No OLED with that name among the {MONITORS.length} models in the list. Pick a layout below instead.</p>)}
    {msg && <p class="small" role="status">{msg}</p>}
  </div>;
}
