import { PANELS, customPanel, type Offsets, type Panel } from '../engine/panels';

/** Each value is 0-100. */
export interface Tuning { thickness: number; contrast: number; soften: number }
export type Kernel = 'sharp' | 'balanced' | 'smooth';
export interface LayoutFilter { on: boolean; strengthX: number; strengthY: number; kernel: Kernel; linear: boolean; pauseForVideo: boolean }
export interface Profile {
  id: string;
  name: string;
  /** gray: remove the colour ClearType adds. native: leave the browser's smoothing alone. */
  smoothing: 'gray' | 'native';
  /** Light text on dark backgrounds. */
  dark: Tuning;
  /** Dark text on light backgrounds. */
  light: Tuning;
  /** Extra letter spacing, hundredths of a pixel. */
  spacing: number;
  /** Replacement font family, empty for the site's own. */
  font: string;
  keepCodeFont: boolean;
  /** macOS only: use thinner system smoothing. */
  macThin: boolean;
  /** CSS selectors that keep the site's own text. */
  exclude: string;
  filter: LayoutFilter;
}
export interface SiteRule { pattern: string; action: 'on' | 'off' | 'inherit'; profileId: string | null }
export interface ScreenMatch { width: number; height: number; left: number | null; top: number | null }
export interface ScreenRule { id: string; name: string; match: ScreenMatch; enabled: boolean; panel: string; profileId: string | null }
export interface CustomPanel { id: string; name: string; offsets: Offsets }
export interface Settings {
  v: 1;
  on: boolean;
  scope: 'all' | 'listed';
  panel: string;
  profileId: string;
  /** In the order people arranged them. */
  profiles: Profile[];
  /** Built-in looks someone deleted, so they are not added back. */
  removedLooks: string[];
  sites: SiteRule[];
  screens: ScreenRule[];
  customPanels: CustomPanel[];
  /** 0: not paused. Timestamp in ms: paused until then. */
  pauseUntil: number;
  sync: boolean;
  onboarded: boolean;
}

const t = (thickness = 0, contrast = 0, soften = 0): Tuning => ({ thickness, contrast, soften });
const filter = (): LayoutFilter => ({ on: false, strengthX: 90, strengthY: 100, kernel: 'sharp', linear: false, pauseForVideo: true });
const profile = (id: string, name: string, dark: Tuning, light: Tuning): Profile => ({
  id, name, smoothing: 'gray', dark, light, spacing: 0, font: '', keepCodeFont: true, macThin: false, exclude: '', filter: filter(),
});

/** Built-in looks. Ids are stable; people's edits are stored on copies in settings.profiles. */
export const PRESETS: Profile[] = [
  profile('clean', 'Clean', t(), t()),
  profile('crisp', 'Crisp', t(0, 25, 0), t(0, 60, 0)),
  profile('bold', 'Bold', t(30, 20, 0), t(45, 30, 0)),
  profile('soft', 'Soft', t(0, 0, 45), t(0, 15, 35)),
];

export const defaults = (): Settings => ({
  v: 1, on: true, scope: 'all', panel: 'unknown', profileId: 'clean', profiles: structuredClone(PRESETS), removedLooks: [],
  sites: [], screens: [], customPanels: [], pauseUntil: 0, sync: false, onboarded: false,
});

export function allPanels(s: Settings): Panel[] {
  return [...PANELS, ...s.customPanels.map((c) => customPanel(c.id, c.name, c.offsets))];
}
export const findPanel = (s: Settings, id: string): Panel => allPanels(s).find((p) => p.id === id) ?? PANELS[PANELS.length - 1]!;
export const findProfile = (s: Settings, id: string | null): Profile | undefined => s.profiles.find((p) => p.id === id);

// --- validation: anything read from storage, sync or an imported file goes through here ---
type Any = Record<string, unknown>;
const obj = (x: unknown): Any => (x && typeof x === 'object' && !Array.isArray(x) ? (x as Any) : {});
const num = (x: unknown, d: number, lo: number, hi: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d);
const str = (x: unknown, d: string, max = 400) => (typeof x === 'string' ? x.slice(0, max) : d);
const bool = (x: unknown, d: boolean) => (typeof x === 'boolean' ? x : d);
const pick = <T extends string>(x: unknown, all: readonly T[], d: T): T => (all.includes(x as T) ? (x as T) : d);
const list = (x: unknown, max: number): unknown[] => (Array.isArray(x) ? x.slice(0, max) : []);
const tuning = (x: unknown): Tuning => { const o = obj(x); return { thickness: num(o.thickness, 0, 0, 100), contrast: num(o.contrast, 0, 0, 100), soften: num(o.soften, 0, 0, 100) }; };
const pair = (x: unknown): [number, number] => { const a = list(x, 2); return [num(a[0], 0, -1, 1), num(a[1], 0, -1, 1)]; };

function cleanProfile(x: unknown): Profile | null {
  const o = obj(x), f = obj(o.filter), id = str(o.id, '', 60);
  if (!id) return null;
  return {
    id, name: str(o.name, 'Untitled', 60) || 'Untitled', smoothing: pick(o.smoothing, ['gray', 'native'] as const, 'gray'),
    dark: tuning(o.dark), light: tuning(o.light), spacing: num(o.spacing, 0, -50, 200), font: str(o.font, '', 120),
    keepCodeFont: bool(o.keepCodeFont, true), macThin: bool(o.macThin, false), exclude: str(o.exclude, '', 2000),
    filter: {
      on: bool(f.on, false), strengthX: num(f.strengthX, 90, 0, 150), strengthY: num(f.strengthY, 100, 0, 150),
      kernel: pick(f.kernel, ['sharp', 'balanced', 'smooth'] as const, 'sharp'), linear: bool(f.linear, false), pauseForVideo: bool(f.pauseForVideo, true),
    },
  };
}

/** Returns valid settings from any input, dropping what it cannot understand. */
export function clean(input: unknown): Settings {
  const o = obj(input), d = defaults();
  const profiles = list(o.profiles, 40).map(cleanProfile).filter((p): p is Profile => !!p);
  const removedLooks = [...new Set(list(o.removedLooks, 20).filter((x): x is string => PRESETS.some((p) => p.id === x)))];
  for (const p of d.profiles) if (!profiles.some((q) => q.id === p.id) && !removedLooks.includes(p.id)) profiles.push(p);
  // there is always at least one look
  if (!profiles.length) { profiles.push(structuredClone(PRESETS[0]!)); removedLooks.splice(removedLooks.indexOf(PRESETS[0]!.id), 1); }
  const ids = new Set(profiles.map((p) => p.id));
  const pid = (x: unknown) => (typeof x === 'string' && ids.has(x) ? x : null);
  const coord = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
  return {
    v: 1, on: bool(o.on, true), scope: pick(o.scope, ['all', 'listed'] as const, 'all'), panel: str(o.panel, d.panel, 60), profileId: pid(o.profileId) ?? profiles[0]!.id, profiles, removedLooks,
    sites: list(o.sites, 1000).map((x) => { const r = obj(x); return { pattern: str(r.pattern, '', 300).trim(), action: pick(r.action, ['on', 'off', 'inherit'] as const, 'inherit'), profileId: pid(r.profileId) }; }).filter((r) => r.pattern),
    screens: list(o.screens, 20).map((x) => { const r = obj(x), m = obj(r.match); return { id: str(r.id, '', 60), name: str(r.name, 'Screen', 60), match: { width: num(m.width, 0, 0, 40000), height: num(m.height, 0, 0, 40000), left: coord(m.left), top: coord(m.top) }, enabled: bool(r.enabled, true), panel: str(r.panel, 'unknown', 60), profileId: pid(r.profileId) }; }).filter((r) => r.id && r.match.width),
    customPanels: list(o.customPanels, 20).map((x) => { const r = obj(x), f = obj(r.offsets); return { id: str(r.id, '', 60), name: str(r.name, 'Custom panel', 60), offsets: { r: pair(f.r), g: pair(f.g), b: pair(f.b) } }; }).filter((r) => r.id),
    pauseUntil: num(o.pauseUntil, 0, 0, Number.MAX_SAFE_INTEGER), sync: bool(o.sync, false), onboarded: bool(o.onboarded, false),
  };
}

// --- looks: save, delete, restore, reorder ---
export const isPreset = (id: string) => PRESETS.some((p) => p.id === id);
const lookId = () => 'p-' + Math.random().toString(36).slice(2, 10);

/** Saves a copy of a look under a new name, right after it. Returns the new id. */
export function saveLook(s: Settings, from: string, name?: string): [Settings, string] {
  const src = findProfile(s, from);
  if (!src) return [s, from];
  const id = lookId(), taken = new Set(s.profiles.map((p) => p.name));
  let n = 1; while (taken.has(`My look ${n}`)) n++;
  const copy: Profile = { ...structuredClone(src), id, name: (name ?? '').trim().slice(0, 60) || `My look ${n}` };
  const i = s.profiles.indexOf(src);
  return [{ ...s, profiles: [...s.profiles.slice(0, i + 1), copy, ...s.profiles.slice(i + 1)] }, id];
}

/** Removes a look. Rules that used it fall back to the default; the last look cannot go. */
export function deleteLook(s: Settings, id: string): Settings {
  if (s.profiles.length <= 1 || !findProfile(s, id)) return s;
  const profiles = s.profiles.filter((p) => p.id !== id);
  return {
    ...s, profiles,
    profileId: s.profileId === id ? profiles[0]!.id : s.profileId,
    removedLooks: isPreset(id) ? [...s.removedLooks, id] : s.removedLooks,
    sites: s.sites.map((r) => (r.profileId === id ? { ...r, profileId: null } : r)).filter((r) => r.action !== 'inherit' || r.profileId),
    screens: s.screens.map((r) => (r.profileId === id ? { ...r, profileId: null } : r)),
  };
}

/** Brings back deleted built-in looks (all, or one), at the end of the list. */
export function restoreLooks(s: Settings, only?: string): Settings {
  const back = s.removedLooks.filter((id) => !only || id === only);
  return { ...s, removedLooks: s.removedLooks.filter((id) => !back.includes(id)), profiles: [...s.profiles, ...PRESETS.filter((p) => back.includes(p.id)).map((p) => structuredClone(p))] };
}

/** Moves a look one place earlier (-1) or later (1). */
export function moveLook(s: Settings, id: string, by: -1 | 1): Settings {
  const i = s.profiles.findIndex((p) => p.id === id), j = i + by;
  if (i < 0 || j < 0 || j >= s.profiles.length) return s;
  const profiles = [...s.profiles];
  [profiles[i], profiles[j]] = [profiles[j]!, profiles[i]!];
  return { ...s, profiles };
}
