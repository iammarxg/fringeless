import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { buildCss, type Env } from '../engine/css';
import { Applier } from '../engine/apply';
import { detectEnv } from '../engine/detect';
import type { Panel } from '../engine/panels';
import type { Profile, Settings, Tuning } from '../settings/model';
import { load, save, watch } from '../settings/store';

export const env: Env = detectEnv();

export function useSettings(): [Settings | null, (fn: (s: Settings) => Settings) => void] {
  const [s, set] = useState<Settings | null>(null);
  const cur = useRef<Settings | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const writing = useRef(false);
  useEffect(() => {
    void load().then((v) => { cur.current = v; set(v); });
    const off = watch((v) => { if (!timer.current && !writing.current) { cur.current = v; set(v); } });
    const flush = () => { if (timer.current && cur.current) { clearTimeout(timer.current); timer.current = undefined; void save(cur.current); } };
    addEventListener('pagehide', flush);
    return () => { flush(); off(); removeEventListener('pagehide', flush); };
  }, []);
  const change = (fn: (s: Settings) => Settings) => {
    if (!cur.current) return;
    cur.current = fn(cur.current); set(cur.current);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = undefined; writing.current = true; void save(cur.current!).finally(() => { writing.current = false; }); }, 120);
  };
  return [s, change];
}

export const editProfile = (s: Settings, id: string, patch: Partial<Profile>): Settings => ({ ...s, profiles: s.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)) });

// ---- theme: 'system' | 'dark' | 'light', shared by all our pages ----
const THEME = 'fringeless-theme';
const ICON = {
  system: 'M3 4h18v12H3zM8 20h8M12 16v4',
  dark: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  light: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
} as const;
type Theme = keyof typeof ICON;
const readTheme = (): Theme => { try { const v = localStorage.getItem(THEME); return v === 'dark' || v === 'light' ? v : 'system'; } catch { return 'system'; } };
function applyTheme(v: Theme) {
  if (v === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', v);
  try { if (v === 'system') localStorage.removeItem(THEME); else localStorage.setItem(THEME, v); } catch { /* applies for this visit */ }
}
export function ThemeSwitch() {
  const [v, set] = useState<Theme>(readTheme());
  useEffect(() => { const on = (e: StorageEvent) => { if (e.key === THEME) { const t = readTheme(); set(t); applyTheme(t); } }; addEventListener('storage', on); return () => removeEventListener('storage', on); }, []);
  return <div class="theme" role="radiogroup" aria-label="Theme">{(['system', 'dark', 'light'] as const).map((t) => (
    <button type="button" role="radio" aria-checked={v === t} title={{ system: 'Match system', dark: 'Dark', light: 'Light' }[t]} onClick={() => { set(t); applyTheme(t); }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={ICON[t]} /></svg>
      <span class="sr">{{ system: 'Match system', dark: 'Dark', light: 'Light' }[t]}</span>
    </button>))}</div>;
}

export function Wordmark({ on }: { on: boolean }) { return <span class={'wordmark' + (on ? '' : ' off')}>Fringeless</span>; }

export function Toggle({ on, onChange, label, hint, disabled }: { on: boolean; onChange: (v: boolean) => void; label: ComponentChildren; hint?: ComponentChildren; disabled?: boolean }) {
  return <button type="button" class="toggle" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)}>
    <span class="grow"><span class="label">{label}</span>{hint && <span class="small muted">{hint}</span>}</span><span class="track" aria-hidden="true"><span class="thumb" /></span>
  </button>;
}

export function Slider({ label, value, onInput, min = 0, max = 100, step = 1, format = (v: number) => String(v) }: { label: string; value: number; onInput: (v: number) => void; min?: number; max?: number; step?: number; format?: (v: number) => string }) {
  return <label class="slider"><span>{label}</span><input type="range" min={min} max={max} step={step} value={value} style={`--p:${((value - min) / (max - min)) * 100}%`} onInput={(e) => onInput(Number(e.currentTarget.value))} /><output>{format(value)}</output></label>;
}

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return <div class="seg" role="group" aria-label={label}>{options.map(([v, text]) => <button type="button" aria-pressed={v === value} onClick={() => onChange(v)}>{text}</button>)}</div>;
}

/** Custom dropdown: button + listbox. Up/Down/Home/End move, Enter/Space choose, Escape closes, letters jump. */
export function Select<T extends string>({ value, options, onChange, label, placeholder, style }: { value: T | null; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string; placeholder?: string; style?: string }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState({ up: false, end: false, max: 288 });
  const root = useRef<HTMLDivElement>(null), button = useRef<HTMLButtonElement>(null), menu = useRef<HTMLUListElement>(null);
  const id = useMemo(() => 'sel-' + Math.random().toString(36).slice(2, 9), []);
  const current = options.find((o) => o.value === value);
  useEffect(() => {
    if (!open) return;
    const out = (e: Event) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    addEventListener('pointerdown', out); addEventListener('blur', out);
    return () => { removeEventListener('pointerdown', out); removeEventListener('blur', out); };
  }, [open]);
  useEffect(() => { if (open) menu.current?.children[active]?.scrollIntoView({ block: 'nearest' }); }, [open, active]);
  const show = () => {
    const r = button.current!.getBoundingClientRect(), need = Math.min(288, options.length * 37 + 10);
    const below = innerHeight - r.bottom - 12, above = r.top - 12, up = below < need && above > below;
    setPlace({ up, end: r.left > innerWidth / 2, max: Math.max(96, Math.min(288, up ? above : below)) });
    setActive(Math.max(0, options.findIndex((o) => o.value === value))); setOpen(true);
  };
  const choose = (i: number) => { setOpen(false); button.current?.focus(); const o = options[i]; if (o) onChange(o.value); };
  const key = (e: KeyboardEvent) => {
    if (!open) { if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); show(); } return; }
    const last = options.length - 1;
    if (e.key === 'ArrowDown') setActive(Math.min(last, active + 1));
    else if (e.key === 'ArrowUp') setActive(Math.max(0, active - 1));
    else if (e.key === 'Home') setActive(0);
    else if (e.key === 'End') setActive(last);
    else if (e.key === 'Enter' || e.key === ' ') choose(active);
    else if (e.key === 'Escape') setOpen(false);
    else if (e.key === 'Tab') { setOpen(false); return; }
    else if (e.key.length === 1) { const k = options.findIndex((o, i) => i > active && o.label.toLowerCase().startsWith(e.key.toLowerCase())); const j = k >= 0 ? k : options.findIndex((o) => o.label.toLowerCase().startsWith(e.key.toLowerCase())); if (j >= 0) setActive(j); }
    else return;
    e.preventDefault();
  };
  return <div class="select" ref={root} style={style}>
    <button type="button" ref={button} class={'trigger' + (open ? ' open' : '')} aria-haspopup="listbox" aria-expanded={open} aria-controls={id} aria-label={`${label}${current ? ': ' + current.label : ''}`} aria-activedescendant={open ? `${id}-${active}` : undefined} onClick={() => (open ? setOpen(false) : show())} onKeyDown={key}>
      <span class="clip">{current?.label ?? placeholder ?? ''}</span>
      <svg class="chev" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </button>
    {open && <ul ref={menu} class={'menu' + (place.up ? ' up' : '') + (place.end ? ' end' : '')} role="listbox" id={id} aria-label={label} style={`max-block-size:${place.max}px`}>
      {options.map((o, i) => <li id={`${id}-${i}`} role="option" aria-selected={o.value === value} class={i === active ? 'active' : ''} onPointerEnter={() => setActive(i)} onPointerDown={(e) => { e.preventDefault(); choose(i); }}>
        <span>{o.label}</span>{o.value === value && <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M5 12l5 5 9-10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>}
      </li>)}
    </ul>}
  </div>;
}

/** Tuning applied only inside one element, so a preview shows the real rules. */
export function Scoped({ id, profile, children, class: cls }: { id: string; profile: Profile | null; children: ComponentChildren; class?: string }) {
  return <div id={id} class={cls}><style>{profile ? buildCss(profile, env, '#' + id) : ''}</style>{children}</div>;
}

const ABOUT: Record<string, string> = { clean: 'Fringes removed, nothing else', crisp: 'Stronger edges', bold: 'Heavier letters', soft: 'Less glare' };
export function Looks({ profiles, value, onPick, name, compact }: { profiles: Profile[]; value: string; onPick: (id: string) => void; name: string; compact?: boolean }) {
  return <div class={'looks' + (compact ? ' compact' : '')} role="radiogroup" aria-label={name}>{profiles.map((p) => {
    // compact: the name is the sample, so nothing is spent on a title bar
    const sample = compact ? <strong class="clip">{p.name}</strong> : <><strong>Reading text</strong><em>il1I rn m, a quick brown fox jumps over 1234</em></>;
    return <button type="button" class="look" role="radio" aria-label={compact ? p.name : undefined} aria-checked={p.id === value} onClick={() => onPick(p.id)}>
      {!compact && <span class="name"><span class="clip">{p.name}</span><small>{ABOUT[p.id] ?? 'Your look'}</small></span>}
      <Scoped id={`look-${name}-${p.id}`.replace(/[^\w-]/g, '')} profile={p} class="pair"><span>{sample}</span><span>{sample}</span></Scoped>
    </button>;
  })}</div>;
}

export function TuningSliders({ value, onChange }: { value: Tuning; onChange: (t: Tuning) => void }) {
  const set = (k: keyof Tuning) => (v: number) => onChange({ ...value, [k]: v });
  return <div class="stack tight">
    <Slider label="Thickness" value={value.thickness} onInput={set('thickness')} />
    <Slider label="Contrast" value={value.contrast} onInput={set('contrast')} />
    <Slider label="Soften" value={value.soften} onInput={set('soften')} />
  </div>;
}

/** Macro-style picture of the panel. Custom panels have no picture and draw their offsets instead. */
export function PanelPic({ panel }: { panel: Panel }) {
  if (panel.id.startsWith('c-')) return <OffsetArt panel={panel} size={240} />;
  if (panel.id === 'unknown') return <span class="pic blank" aria-hidden="true">?</span>;
  return <img class="pic" src={`/panels/${panel.id}.webp`} alt={`Close-up of the ${panel.name} subpixel layout`} width="480" height="360" />;
}
export function OffsetArt({ panel, size = 120 }: { panel: Panel; size?: number }) {
  return <svg class="subpx" width={size} height={size} viewBox="0 0 1 1" role="img" aria-label={`${panel.name} offsets`}>{panel.cells.map((c) => <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={0.07} fill={`var(--${c.c})`} style="mix-blend-mode:screen" />)}</svg>;
}
export function PhotoNote() {
  return <p class="small muted">Pictures are illustrations drawn from published macro photos. See real photos at <a href="https://pcmonitors.info/articles/qd-oled-and-woled-fringing-issues/" target="_blank" rel="noreferrer">PC Monitors</a> and <a href="https://tftcentral.co.uk/articles/oled-rgb-stripe-panels-explained-should-you-wait" target="_blank" rel="noreferrer">TFTCentral</a>.</p>;
}

export function Specimen({ profile, id = 'specimen', onHold }: { profile: Profile | null; id?: string; onHold?: (v: boolean) => void }) {
  const body = <><b>Illiwm HAVE 1234</b><p>Reading for hours on an OLED should feel like reading on paper, not like squinting past colored edges. <a href="#specimen" onClick={(e) => e.preventDefault()}>A link</a> sits here too.</p><p class="s">Small text at 14 px: il1I rn m, quick brown fox, 0O8B, the five boxing wizards jump quickly.</p></>;
  return <div class="stack">
    <Scoped id={id} profile={profile} class="specimen"><div class="on-dark">{body}</div><div class="on-light">{body}</div></Scoped>
    {onHold && <div><button type="button" class="btn" onPointerDown={() => onHold(true)} onPointerUp={() => onHold(false)} onPointerLeave={() => onHold(false)} onBlur={() => onHold(false)} onKeyDown={(e) => e.key === ' ' && onHold(true)} onKeyUp={() => onHold(false)}>Hold to see it without Fringeless</button></div>}
  </div>;
}

/** Smoothing and layout filter for our own page, so previews match real sites. Text tuning stays inside previews. */
export function usePageLook(profile: Profile | undefined, panel: Panel | undefined, on = true) {
  const ref = useRef<Applier | undefined>(undefined);
  useEffect(() => { const a = new Applier(document, env, true); a.start(); ref.current = a; return () => a.stop(); }, []);
  const key = JSON.stringify([profile?.smoothing, profile?.filter, panel?.offsets, on]);
  useEffect(() => {
    const z = { thickness: 0, contrast: 0, soften: 0 };
    ref.current?.set(profile && panel && on ? { panel, profile: { ...profile, dark: z, light: z, font: '', spacing: 0, exclude: '', macThin: false } } : null);
  }, [key]);
}
