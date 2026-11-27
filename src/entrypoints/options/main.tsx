import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { browser } from 'wxt/browser';
import '../../ui/theme.css';
import './style.css';
import { Looks, OffsetArt, PanelPic, PhotoNote, Seg, Select, Slider, Specimen, ThemeSwitch, Toggle, TuningSliders, Wordmark, editProfile, env, usePageLook, useSettings } from '../../ui/components';
import { DetectScreens } from '../../ui/detect-screens';
import { screenInfo } from '../../engine/detect';
import { safeSelector } from '../../engine/css';
import { PRESETS, allPanels, clean, defaults, deleteLook, findPanel, findProfile, moveLook, restoreLooks, saveLook, type Profile, type Settings } from '../../settings/model';
import { matches, screenRule, type ScreenInfo } from '../../settings/resolve';

type Change = (fn: (s: Settings) => Settings) => void;
const uid = () => crypto.randomUUID().slice(0, 8);
const TABS = [['look', 'Look'], ['screens', 'Screens'], ['sites', 'Sites'], ['backup', 'Backup'], ['guide', 'Guide']] as const;
type TabId = (typeof TABS)[number][0];

function useScreen(): ScreenInfo {
  const [i, set] = useState(screenInfo());
  useEffect(() => { const t = setInterval(() => { const n = screenInfo(); set((o) => (JSON.stringify(o) === JSON.stringify(n) ? o : n)); }, 700); return () => clearInterval(t); }, []);
  return i;
}
function PanelSelect({ s, value, onChange, label }: { s: Settings; value: string; onChange: (v: string) => void; label: string }) {
  return <Select label={label} value={value} options={allPanels(s).map((p) => ({ value: p.id, label: p.name }))} onChange={onChange} />;
}
function LookSelect({ s, value, onChange, none, label }: { s: Settings; value: string | null; onChange: (v: string | null) => void; none: string; label: string }) {
  return <Select label={label} value={value ?? ''} options={[{ value: '', label: none }, ...s.profiles.map((p) => ({ value: p.id, label: p.name }))]} onChange={(v) => onChange(v || null)} />;
}

function Look({ s, change, id, setId, hold, setHold }: { s: Settings; change: Change; id: string; setId: (v: string) => void; hold: boolean; setHold: (v: boolean) => void }) {
  const p = findProfile(s, id) ?? s.profiles[0]!;
  const set = (patch: Partial<Profile>) => change((v) => editProfile(v, p.id, patch));
  const preset = PRESETS.find((x) => x.id === p.id);
  const at = s.profiles.indexOf(p);
  const panel = findPanel(s, screenRule(s, screenInfo())?.panel ?? s.panel);
  const fl = p.filter, setF = (f: Partial<Profile['filter']>) => set({ filter: { ...fl, ...f } });
  return <div class="stack loose">
    <Looks name="options" profiles={s.profiles} value={p.id} onPick={setId} />
    <div class="row" style="gap:8px">
      {s.profileId === p.id ? <span class="muted">Used by default.</span> : <button class="btn primary" onClick={() => change((v) => ({ ...v, profileId: p.id }))}>Use by default</button>}
      <button class="btn" onClick={() => { let n = ''; change((v) => { const [w, id] = saveLook(v, p.id); n = id; return w; }); setId(n); }}>Save as new look</button>
      <button class="btn" aria-label="Move earlier" disabled={at === 0} onClick={() => change((v) => moveLook(v, p.id, -1))}>Move up</button>
      <button class="btn" aria-label="Move later" disabled={at === s.profiles.length - 1} onClick={() => change((v) => moveLook(v, p.id, 1))}>Move down</button>
      {preset && <button class="btn" onClick={() => set(structuredClone(preset))}>Reset to original</button>}
      <button class="btn" disabled={s.profiles.length <= 1} title={s.profiles.length <= 1 ? 'Keep at least one look' : undefined} onClick={() => { const next = s.profiles[at === 0 ? 1 : at - 1]!.id; change((v) => deleteLook(v, p.id)); setId(next); }}>Delete</button>
    </div>
    {s.removedLooks.length > 0 && <p class="small muted row" style="gap:8px">Deleted default looks: {s.removedLooks.map((x) => PRESETS.find((q) => q.id === x)?.name).join(', ')}. <button class="btn ghost" onClick={() => change((v) => restoreLooks(v))}>Bring them back</button></p>}
    <Specimen profile={hold ? null : p} id="opt-specimen" onHold={setHold} />
    {!preset && <label class="field"><span>Name</span><input type="text" value={p.name} maxLength={60} onInput={(e) => set({ name: e.currentTarget.value })} /></label>}
    <section class="stack"><h3>Color fringes</h3>
      <Seg label="Smoothing" value={p.smoothing} options={[['gray', 'Remove color'], ['native', 'Leave as is']]} onChange={(v) => set({ smoothing: v })} />
      <p class="small muted">{env.os === 'mac' ? 'macOS already draws text without color, so this has no effect on a Mac.' : 'Removing color is right for WOLED and QD-OLED. Leave it as is for RGB-stripe screens.'}</p>
    </section>
    <div class="two">
      <section class="stack"><h3>Light text on dark</h3><TuningSliders value={p.dark} onChange={(dark) => set({ dark })} /></section>
      <section class="stack"><h3>Dark text on light</h3><TuningSliders value={p.light} onChange={(light) => set({ light })} /></section>
    </div>
    <p class="small muted">Thickness adds weight. Contrast strengthens thin edges without widening letters. Soften pulls pure white and pure black text toward gray to reduce glow.</p>
    <section class="stack"><h3>Type</h3>
      <Slider label="Spacing" min={-50} max={200} step={5} value={p.spacing} onInput={(spacing) => set({ spacing })} format={(v) => (v / 100).toFixed(2) + ' px'} />
      <label class="field"><span>Replace fonts with</span><input type="text" placeholder="Leave empty for each site's own font" value={p.font} onInput={(e) => set({ font: e.currentTarget.value })} /></label>
      {p.font && <Toggle on={p.keepCodeFont} onChange={(keepCodeFont) => set({ keepCodeFont })} label={<>Keep code in its own font</>} />}
      {env.os === 'mac' && <Toggle on={p.macThin} onChange={(macThin) => set({ macThin })} label={<>Thinner macOS smoothing</>} />}
      <label class="field"><span>Leave these elements alone (CSS selectors, one per line)</span><textarea value={p.exclude} onInput={(e) => set({ exclude: e.currentTarget.value })} /></label>
      {p.exclude.trim() && !safeSelector(p.exclude) && <p class="small warn">None of these can be used as selectors.</p>}
    </section>
    <section class="stack"><h3>Layout filter (experimental)</h3>
      {env.browser === 'firefox' ? <p class="muted">Firefox does not offer a way to run this filter without breaking pages, so it is only available in Chromium browsers.</p>
        : !panel.filterUseful ? <p class="muted">Nothing to gain on {panel.name}. In our simulations this filter helps QD-OLED and custom layouts only. Choose one under Screens to use it.</p>
          : <>
            <Toggle on={fl.on} onChange={(on) => setF({ on })} label={<>Shift colors to match {panel.name}</>} />
            <p class="small muted">Moves each color to where its subpixel sits, for the whole page including pictures. It uses more GPU, text gets slightly softer, and popups drawn above the page are not covered. Tested in simulation, not yet on real QD-OLED panels.</p>
            {fl.on && <>
              <Slider label="Horizontal" max={150} value={fl.strengthX} onInput={(strengthX) => setF({ strengthX })} format={(v) => v + '%'} />
              <Slider label="Vertical" max={150} value={fl.strengthY} onInput={(strengthY) => setF({ strengthY })} format={(v) => v + '%'} />
              <Seg label="Kernel" value={fl.kernel} options={[['sharp', 'Sharp'], ['balanced', 'Balanced'], ['smooth', 'Smooth']]} onChange={(kernel) => setF({ kernel })} />
              <Toggle on={fl.pauseForVideo} onChange={(pauseForVideo) => setF({ pauseForVideo })} label={<>Pause while a video plays</>} />
              <Toggle on={fl.linear} onChange={(linear) => setF({ linear })} label={<>Process in linear light (can show banding in dark areas)</>} />
            </>}
          </>}
    </section>
  </div>;
}

function Screens({ s, change }: { s: Settings; change: Change }) {
  const here = useScreen();
  const rule = screenRule(s, here);
  const add = (pos: boolean) => change((v) => ({ ...v, screens: [...v.screens, { id: uid(), name: `Screen ${v.screens.length + 1}`, match: { width: here.width, height: here.height, left: pos ? here.left : null, top: pos ? here.top : null }, enabled: true, panel: v.panel, profileId: null }] }));
  const edit = (id: string, patch: Partial<Settings['screens'][number]>) => change((v) => ({ ...v, screens: v.screens.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const twin = s.screens.some((x) => x.match.width === here.width && x.match.height === here.height);
  return <div class="stack loose">
    <section class="stack">
      <h3>Find your screens</h3>
      <DetectScreens s={s} change={change} />
    </section>
    <section class="stack">
      <h3>Default panel</h3>
      <div class="paneldef"><div class="frame"><PanelPic panel={findPanel(s, s.panel)} /></div><div class="stack"><PanelSelect s={s} label="Default panel" value={s.panel} onChange={(panel) => change((v) => ({ ...v, panel }))} /><p class="small muted">{findPanel(s, s.panel).examples}</p><PhotoNote /></div></div>
    </section>
    <section class="stack">
      <h3>Screens with their own settings</h3>
      <p class="muted">This window is on a {here.width} x {here.height} screen{rule ? `, matched as “${rule.name}”` : ', which uses the default panel'}. Drag the window to another screen to add that one.</p>
      {!rule && <div><button class="btn primary" onClick={() => add(twin)}>Add this screen</button></div>}
      {rule && rule.match.left === null && <div><button class="btn" onClick={() => add(true)}>Treat this position as a separate screen</button></div>}
      {s.screens.map((x) => <div class="item stack">
        <div class="row between"><input type="text" aria-label="Screen name" value={x.name} onInput={(e) => edit(x.id, { name: e.currentTarget.value })} /><button class="btn ghost" onClick={() => change((v) => ({ ...v, screens: v.screens.filter((y) => y.id !== x.id) }))}>Remove</button></div>
        <Toggle on={x.enabled} onChange={(enabled) => edit(x.id, { enabled })} label={<>{x.enabled ? 'Fringeless runs on this screen' : 'Off on this screen'}</>} />
        {x.enabled && <div class="row"><PanelSelect s={s} label="Panel" value={x.panel} onChange={(panel) => edit(x.id, { panel })} /><LookSelect s={s} label="Look" value={x.profileId} none="Default look" onChange={(profileId) => edit(x.id, { profileId })} /></div>}
        <p class="small muted">{x.match.width} x {x.match.height}{x.match.left !== null ? `, at position ${x.match.left}, ${x.match.top}` : ', any position'}</p>
      </div>)}
      <p class="small muted">Screens are recognized by size, and by position when two have the same size. Rearranging screens in your system settings can change their position.</p>
    </section>
    <section class="stack">
      <h3>Custom panels</h3>
      <p class="muted">Set where red, green and blue sit inside a pixel, measured from the brightest subpixel.</p>
      {s.customPanels.map((c) => {
        const set = (k: 'r' | 'g' | 'b', i: 0 | 1, val: number) => change((v) => ({ ...v, customPanels: v.customPanels.map((y) => { if (y.id !== c.id) return y; const o = structuredClone(y.offsets); o[k][i] = val; return { ...y, offsets: o }; }) }));
        return <div class="item stack">
          <div class="row between"><input type="text" aria-label="Panel name" value={c.name} onInput={(e) => { const name = e.currentTarget.value; change((v) => ({ ...v, customPanels: v.customPanels.map((y) => (y.id === c.id ? { ...y, name } : y)) })); }} /><button class="btn ghost" onClick={() => change((v) => ({ ...v, customPanels: v.customPanels.filter((y) => y.id !== c.id) }))}>Remove</button></div>
          <div class="row" style="align-items:flex-start"><OffsetArt panel={findPanel(s, c.id)} size={150} /><div class="grow">{(['r', 'g', 'b'] as const).flatMap((k) => ([0, 1] as const).map((i) => <Slider label={{ r: 'Red', g: 'Green', b: 'Blue' }[k] + (i ? ' down' : ' right')} min={-0.6} max={0.6} step={0.01} value={c.offsets[k][i]} onInput={(v) => set(k, i, v)} format={(v) => v.toFixed(2)} />))}</div></div>
        </div>;
      })}
      <div><button class="btn" onClick={() => change((v) => ({ ...v, customPanels: [...v.customPanels, { id: 'c-' + uid(), name: `Custom panel ${v.customPanels.length + 1}`, offsets: structuredClone(findPanel(v, v.panel).offsets) }] }))}>Add custom panel</button></div>
    </section>
  </div>;
}

function Sites({ s, change }: { s: Settings; change: Change }) {
  const [add, setAdd] = useState(''), [test, setTest] = useState(''), [access, setAccess] = useState<boolean | null>(null);
  useEffect(() => { void browser.permissions.contains({ origins: ['<all_urls>'] }).then(setAccess); }, []);
  const edit = (i: number, patch: Partial<Settings['sites'][number]>) => change((v) => ({ ...v, sites: v.sites.map((x, k) => (k === i ? { ...x, ...patch } : x)) }));
  const move = (i: number, d: number) => change((v) => { const a = [...v.sites], j = i + d; if (j < 0 || j >= a.length) return v; [a[i], a[j]] = [a[j]!, a[i]!]; return { ...v, sites: a }; });
  const url = test && !/^[a-z]+:/i.test(test) ? 'https://' + test : test;
  const hit = url ? s.sites.findIndex((r) => matches(r.pattern, url)) : -1;
  return <div class="stack loose">
    <section class="stack">
      <Toggle on={s.on} onChange={(on) => change((v) => ({ ...v, on }))} label={<><strong>{s.on ? 'Fringeless is on' : 'Fringeless is off everywhere'}</strong></>} />
      {access === false && <div class="row"><span>The browser has not given Fringeless access to all sites.</span><button class="btn primary" onClick={() => void browser.permissions.request({ origins: ['<all_urls>'] }).then(setAccess)}>Allow all sites</button></div>}
      <h3>Run on</h3>
      <Seg label="Run on" value={s.scope} options={[['all', 'All sites except those I turn off'], ['listed', 'Only sites I turn on']]} onChange={(scope) => change((v) => ({ ...v, scope }))} />
    </section>
    <section class="stack">
      <h3>Site rules</h3>
      <p class="muted">The first rule that fits decides. Use <b>example.com</b> for a site and its subdomains, <b>*.example.com</b> for subdomains only, <b>example.com/docs*</b> for a path, or <b>/regex/</b>.</p>
      <form class="row" onSubmit={(e) => { e.preventDefault(); const pattern = add.trim(); if (pattern) { change((v) => ({ ...v, sites: [{ pattern, action: v.scope === 'all' ? 'off' : 'on', profileId: null }, ...v.sites] })); setAdd(''); } }}>
        <input type="text" class="grow" aria-label="New site rule" placeholder="example.com" value={add} onInput={(e) => setAdd(e.currentTarget.value)} /><button class="btn" type="submit" disabled={!add.trim()}>Add rule</button>
      </form>
      {!s.sites.length && <p class="muted">No rules yet. Add one here, or use the toolbar button on any site.</p>}
      <div class="rules">{s.sites.map((r, i) => <div class={'rule' + (i === hit ? ' hit' : '')}>
        <input type="text" aria-label="Pattern" value={r.pattern} onChange={(e) => edit(i, { pattern: e.currentTarget.value })} />
        <Select label="Action" value={r.action} options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }, { value: 'inherit', label: 'Follow default' }]} onChange={(action) => edit(i, { action })} />
        <LookSelect s={s} label="Look" value={r.profileId} none="Default look" onChange={(profileId) => edit(i, { profileId })} />
        <span class="row" style="gap:0"><button class="btn ghost" aria-label="Move up" disabled={!i} onClick={() => move(i, -1)}>Up</button><button class="btn ghost" aria-label="Move down" disabled={i === s.sites.length - 1} onClick={() => move(i, 1)}>Down</button><button class="btn ghost" onClick={() => change((v) => ({ ...v, sites: v.sites.filter((_, k) => k !== i) }))}>Remove</button></span>
      </div>)}</div>
      {!!s.sites.length && <label class="field"><span>Test an address</span><input type="text" placeholder="docs.example.com/page" value={test} onInput={(e) => setTest(e.currentTarget.value)} /></label>}
      {url && <p class="small" role="status">{hit < 0 ? 'No rule fits this address; the default applies.' : `Rule ${hit + 1}, “${s.sites[hit]!.pattern}”, decides.`}</p>}
    </section>
  </div>;
}

function Backup({ s, change }: { s: Settings; change: Change }) {
  const [msg, setMsg] = useState('');
  const save = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' })); a.download = 'fringeless-settings.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  const open = async (f: File | undefined) => { if (!f) return; try { const raw = JSON.parse(await f.text()) as unknown; if (!raw || typeof raw !== 'object' || (raw as { v?: unknown }).v !== 1) throw 0; change(() => clean(raw)); setMsg(`Imported ${f.name}.`); } catch { setMsg(`${f.name} is not a Fringeless settings file. Nothing was changed.`); } };
  return <div class="stack loose">
    <section class="stack"><h3>Save or restore</h3><div class="row"><button class="btn" onClick={save}>Export settings</button><label class="btn">Import settings<input type="file" accept=".json,application/json" hidden onChange={(e) => { void open(e.currentTarget.files?.[0]); e.currentTarget.value = ''; }} /></label></div>{msg && <p role="status">{msg}</p>}</section>
    <section class="stack"><h3>Sync</h3><Toggle on={s.sync} onChange={(sync) => { change((v) => ({ ...v, sync })); }} label={<>Sync looks and site rules through your browser account</>} /><p class="small muted">Screens stay on this computer. When you turn this on somewhere new, choose which settings to keep.</p>{s.sync && <div><button class="btn" onClick={() => void browser.runtime.sendMessage({ t: 'sync-now' }).then(() => setMsg('Loaded settings from your browser account.'))}>Load synced settings now</button></div>}</section>
    <section class="stack"><h3>Start over</h3><p class="muted">Removes your looks, rules and screens.</p><div><button class="btn" onClick={() => { if (confirm('Reset all Fringeless settings? Export first if you want a copy.')) { change(() => ({ ...defaults(), onboarded: true })); setMsg('Settings reset.'); } }}>Reset everything</button></div></section>
  </div>;
}

function Guide() {
  return <div class="stack loose prose">
    <section class="stack"><h3>What Fringeless can and cannot change</h3><p>It changes text that web pages draw as text. It cannot reach the browser's own menus and tabs, extension stores, built-in PDF pages, or text that a site paints into a canvas or an image (Google Docs and some code editors do this).</p><p>Colored edges on pictures, icons and colored boxes come from the panel itself. No text setting removes those.</p></section>
    <section class="stack"><h3>Windows, outside the browser</h3><p>For menus and other programs, search Start for “Adjust ClearType text”, or use <a href="https://github.com/bp2008/BetterClearTypeTuner">Better ClearType Tuner</a> to choose grayscale. Chromium browsers on Windows follow the contrast and gamma you set there. <a href="https://github.com/snowie2000/mactype">MacType</a> covers many other programs.</p></section>
    <section class="stack"><h3>Screen settings</h3><p>Use your screen's native resolution, set its own sharpness control to its neutral value, and try a larger system scale: more pixels per letter makes any fringe smaller.</p></section>
    <section class="stack"><h3>Keyboard</h3><p>Alt+Shift+F turns Fringeless on or off for the current site. Alt+Shift+C switches it in the current tab only, for comparing. Change these in your browser's extension shortcuts page.</p></section>
    <section class="stack"><h3>About</h3><p>Fringeless {browser.runtime.getManifest().version}, free and open source under GPL-3.0. <a href="https://github.com/iammarxg/fringeless/issues">Report a problem or a missing screen</a>, or read the <a href="https://github.com/iammarxg/fringeless/blob/main/CHANGELOG.md">changelog</a>.</p></section>
  </div>;
}

function Options() {
  const [s, change] = useSettings();
  const [tab, setTab] = useState<TabId>((location.hash.slice(1) as TabId) || 'look');
  const [id, setId] = useState('');
  const [hold, setHold] = useState(false);
  const here = useScreen();
  const cur = s ? findProfile(s, id) ?? findProfile(s, s.profileId) : undefined;
  usePageLook(cur, s ? findPanel(s, screenRule(s, here)?.panel ?? s.panel) : undefined, !hold);
  useEffect(() => { history.replaceState(null, '', '#' + tab); }, [tab]);
  if (!s || !cur) return null;
  const T = TABS.some(([k]) => k === tab) ? tab : 'look';
  return <div class="layout">
    <nav aria-label="Settings"><div class="brand"><Wordmark on={s.on && !hold} /></div>{TABS.map(([k, l]) => <button type="button" aria-current={k === T ? 'page' : undefined} onClick={() => setTab(k)}>{l}</button>)}<div class="foot"><ThemeSwitch /></div></nav>
    <main><h1>{TABS.find(([k]) => k === T)![1]}</h1>
      {T === 'look' ? <Look s={s} change={change} id={cur.id} setId={setId} hold={hold} setHold={setHold} /> : T === 'screens' ? <Screens s={s} change={change} /> : T === 'sites' ? <Sites s={s} change={change} /> : T === 'backup' ? <Backup s={s} change={change} /> : <Guide />}
    </main>
  </div>;
}

render(<Options />, document.getElementById('app')!);
