import { describe, expect, it } from 'vitest';
import { clean, defaults, deleteLook, findProfile, moveLook, restoreLooks, saveLook, type Settings } from '../src/settings/model';
import { hostPattern, matches, resolve, screenRule, setSite, type Context } from '../src/settings/resolve';
import { buildCss, safeSelector } from '../src/engine/css';
import { convolution, filterSpec, taps } from '../src/engine/layout-filter';
import { PANELS } from '../src/engine/panels';
import { fringePixels } from '../src/engine/measure';

const scr = { width: 2560, height: 1440, left: 0, top: 0 };
const ctx = (o: Partial<Context> = {}): Context => ({ url: 'https://www.example.com/a/b?q=1', screen: scr, now: 1000, tab: null, ...o });
const S = (o: Partial<Settings> = {}): Settings => ({ ...defaults(), ...o });

describe('site patterns', () => {
  it.each([
    ['example.com', 'https://example.com/', true], ['example.com', 'https://a.example.com/x', true], ['example.com', 'https://notexample.com/', false],
    ['*.example.com', 'https://example.com/', false], ['*.example.com', 'https://a.example.com/', true],
    ['example.com/docs', 'https://example.com/docs/x', true], ['example.com/docs', 'https://example.com/docsify', false], ['example.com/docs*', 'https://example.com/docsify', true],
    ['localhost:3000', 'http://localhost:3000/', true], ['localhost:3000', 'http://localhost:4000/', false],
    ['/^https:.*\\/watch/', 'https://y.com/watch?v=1', true], ['/(/', 'https://y.com/', false], ['', 'https://y.com/', false], ['example.com', 'about:blank', false],
  ])('%s vs %s', (p, u, want) => expect(matches(p, u)).toBe(want));
  it('never applies to non-web hosts', () => { expect(hostPattern('chrome://flags')).toBeNull(); expect(hostPattern('https://www.x.com/a')).toBe('x.com'); });
});

describe('resolution order', () => {
  it('is on everywhere by default', () => expect(resolve(S(), ctx())).toMatchObject({ on: true, reason: 'on' }));
  it('tab override beats everything', () => expect(resolve(S({ on: false, pauseUntil: 9e9 }), ctx({ tab: 'on' }))).toMatchObject({ on: true, reason: 'tab' }));
  it('pause expires', () => { expect(resolve(S({ pauseUntil: 2000 }), ctx()).on).toBe(false); expect(resolve(S({ pauseUntil: 500 }), ctx()).on).toBe(true); });
  it('listed scope needs a rule', () => {
    expect(resolve(S({ scope: 'listed' }), ctx())).toMatchObject({ on: false, reason: 'scope' });
    expect(resolve(S({ scope: 'listed', sites: [{ pattern: 'example.com', action: 'on', profileId: null }] }), ctx()).on).toBe(true);
  });
  it('a disabled screen wins over a listed site', () => {
    const screens = [{ id: 'tv', name: 'TV', match: { width: 2560, height: 1440, left: null, top: null }, enabled: false, panel: 'rgb', profileId: null }];
    expect(resolve(S({ screens, sites: [{ pattern: 'example.com', action: 'on', profileId: null }] }), ctx())).toMatchObject({ on: false, reason: 'screen' });
  });
  it('site look beats screen look beats global, and the screen sets the panel', () => {
    const screens = [{ id: 'a', name: 'A', match: { width: 2560, height: 1440, left: null, top: null }, enabled: true, panel: 'woled-rwbg', profileId: 'bold' }];
    const r = resolve(S({ screens }), ctx());
    expect([r.profile.id, r.panel.id]).toEqual(['bold', 'woled-rwbg']);
    expect(resolve(S({ screens, sites: [{ pattern: 'example.com', action: 'inherit', profileId: 'soft' }] }), ctx()).profile.id).toBe('soft');
  });
  it('tells two same-size screens apart by position', () => {
    const mk = (id: string, left: number | null) => ({ id, name: id, match: { width: 2560, height: 1440, left, top: left === null ? null : 0 }, enabled: true, panel: 'rgb', profileId: null });
    const s = S({ screens: [mk('any', null), mk('right', 2560)] });
    expect(screenRule(s, { ...scr, left: 2560 })?.id).toBe('right');
    expect(screenRule(s, scr)?.id).toBe('any');
    expect(screenRule(s, { ...scr, width: 1280 })).toBeNull();
  });
});

describe('site switch', () => {
  it('turning off then on leaves no rule behind', () => {
    const off = setSite(S(), 'https://www.example.com/', 'off');
    expect(off.sites).toEqual([{ pattern: 'example.com', action: 'off', profileId: null }]);
    expect(setSite(off, 'https://example.com/', 'on').sites).toEqual([]);
  });
  it('overrides a broader rule', () => {
    const s = S({ sites: [{ pattern: 'example.com', action: 'off', profileId: null }] });
    const r = setSite(s, 'https://docs.example.com/', 'on');
    expect(resolve(r, ctx({ url: 'https://docs.example.com/' })).on).toBe(true);
    expect(resolve(r, ctx({ url: 'https://example.com/' })).on).toBe(false);
  });
  it('keeps a site look when toggled', () => {
    const s = S({ sites: [{ pattern: 'example.com', action: 'inherit', profileId: 'bold' }] });
    const r = setSite(setSite(s, 'https://example.com/', 'off'), 'https://example.com/', 'on');
    expect(r.sites).toEqual([{ pattern: 'example.com', action: 'inherit', profileId: 'bold' }]);
  });
});

describe('validation', () => {
  it('survives garbage', () => {
    for (const x of [null, 1, 'x', [], { profiles: 5, sites: [{ pattern: 3 }, null], screens: [{}], panel: {} }]) expect(clean(x)).toEqual(defaults());
  });
  it('clamps numbers and drops dangling looks', () => {
    const s = clean({ profiles: [{ id: 'clean', dark: { thickness: 1e9, contrast: -4 } }], profileId: 'gone', sites: [{ pattern: 'a.com', profileId: 'gone', action: 'off' }] });
    expect(findProfile(s, 'clean')!.dark).toEqual({ thickness: 100, contrast: 0, soften: 0 });
    expect([s.profileId, s.sites[0]!.profileId]).toEqual(['clean', null]);
  });
  it('round-trips through JSON', () => expect(clean(JSON.parse(JSON.stringify(defaults())))).toEqual(defaults()));
});

describe('css', () => {
  const p = (o = {}) => ({ ...defaults().profiles[0]!, ...o });
  it('clean look in Chromium needs no css, in Firefox one root rule', () => {
    expect(buildCss(p(), { browser: 'chromium', os: 'win' })).toBe('');
    expect(buildCss(p(), { browser: 'firefox', os: 'win' })).toBe('@media screen{html{filter:opacity(.9999)}}');
  });
  it('leaves smoothing alone on macOS and for native', () => {
    expect(buildCss(p(), { browser: 'firefox', os: 'mac' })).toBe('');
    expect(buildCss(p({ smoothing: 'native' }), { browser: 'firefox', os: 'win' })).toBe('');
  });
  it('Firefox gets per-element stroke colour, Chromium an inherited one', () => {
    const b = p({ dark: { thickness: 50, contrast: 0, soften: 0 } });
    expect(buildCss(b, { browser: 'firefox', os: 'win' })).toMatch(/:where\(\*\)\{-webkit-text-stroke-color/);
    expect(buildCss(b, { browser: 'firefox', os: 'win' })).not.toContain('opacity(.9999)');
    expect(buildCss(b, { browser: 'chromium', os: 'win' })).toMatch(/^@media screen\{html\{-webkit-text-stroke-width:0.3px;/);
  });
  it('user input cannot break out of a rule', () => {
    expect(safeSelector('.a, #b > c\n}body{display:none}, x;y, </style>')).toBe('.a,#b > c');
    expect(buildCss(p({ font: 'X"}body{display:none}' }), { browser: 'chromium', os: 'win' })).not.toContain('body{display');
  });
});

describe('layout filter', () => {
  it('kernels sum to one and zero shift is identity', () => {
    for (const k of ['sharp', 'balanced', 'smooth'] as const) for (let d = -1; d <= 1; d += 0.1) expect(taps(d, k).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    expect(taps(0, 'smooth')).toEqual([0, 0, 1, 0, 0]);
    expect(convolution(0, 0, 'sharp').identity).toBe(true);
  });
  it('puts the weight on the side it samples from', () => {
    const t = taps(0.5, 'sharp'); // sample half a pixel to the right: taps 0 and +1 dominate equally
    expect(t[2]).toBeCloseTo(t[3]!); expect(t[2]).toBeGreaterThan(0.5);
    const c = convolution(0.5, 0, 'sharp'); // flipped for SVG
    expect([c.orderX, c.orderY]).toEqual([5, 1]); expect(c.kernel[1]).toBeCloseTo(c.kernel[2]!); expect(Math.abs(c.kernel[3]!)).toBeLessThan(0.1);
  });
  it('has nothing to do on RGB stripe or at zero strength', () => {
    const f = { ...defaults().profiles[0]!.filter };
    expect(filterSpec(PANELS.find((p) => p.id === 'rgb')!.offsets, f)).toBeNull();
    expect(filterSpec(PANELS.find((p) => p.id === 'qd-34')!.offsets, { ...f, strengthX: 0, strengthY: 0 })).toBeNull();
    const s = filterSpec(PANELS.find((p) => p.id === 'qd-34')!.offsets, f)!;
    expect(s.channels.find((c) => c.c === 'g')!.conv.identity).toBe(true);
    for (const c of s.channels) expect(c.conv.kernel.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 3);
  });
  it('sizes fit what browsers accept', () => { for (const p of PANELS) { const s = filterSpec(p.offsets, { ...defaults().profiles[0]!.filter }); for (const c of s?.channels ?? []) expect(c.conv.kernel.length).toBe(c.conv.orderX * c.conv.orderY); } });
});

describe('fringe measurement', () => {
  const px = (...rgb: number[][]) => new Uint8ClampedArray(rgb.flatMap((c) => [...c, 255]));
  it('counts colour only where the two captures differ', () => {
    const native = px([255, 120, 30], [200, 30, 30], [0, 0, 0]), fixed = px([130, 130, 130], [200, 30, 30], [0, 0, 0]);
    expect(fringePixels(native, fixed)).toEqual({ changed: 1, before: 1, after: 0 });
  });
});

describe('looks', () => {
  const site = { pattern: 'a.com', action: 'inherit' as const, profileId: 'crisp' };
  it('saves a copy right after the original, with a free name', () => {
    const [s, id] = saveLook(defaults(), 'bold');
    expect(s.profiles.map((p) => p.id)).toEqual(['clean', 'crisp', 'bold', id, 'soft']);
    expect(s.profiles[3]!.name).toBe('My look 1');
    expect(saveLook(s, id)[0].profiles.some((p) => p.name === 'My look 2')).toBe(true);
  });
  it('deletes a built-in look for good and lets rules fall back', () => {
    const s = deleteLook({ ...defaults(), profileId: 'crisp', sites: [site], screens: [] }, 'crisp');
    expect(s.profiles.map((p) => p.id)).toEqual(['clean', 'bold', 'soft']);
    expect(s.profileId).toBe('clean');
    expect(s.sites).toEqual([]);
    const again = clean(JSON.parse(JSON.stringify(s)));
    expect(again.profiles.map((p) => p.id)).toEqual(['clean', 'bold', 'soft']);
    expect(restoreLooks(again).profiles.map((p) => p.id)).toEqual(['clean', 'bold', 'soft', 'crisp']);
  });
  it('keeps at least one look', () => {
    let s = defaults();
    for (const id of ['clean', 'crisp', 'bold', 'soft']) s = deleteLook(s, id);
    expect(s.profiles.map((p) => p.id)).toEqual(['soft']);
    expect(clean({ profiles: [], removedLooks: ['clean', 'crisp', 'bold', 'soft'] }).profiles.map((p) => p.id)).toEqual(['clean']);
  });
  it('reorders and keeps the order through storage', () => {
    const s = moveLook(moveLook(defaults(), 'soft', -1), 'clean', -1);
    expect(s.profiles.map((p) => p.id)).toEqual(['clean', 'crisp', 'soft', 'bold']);
    expect(clean(JSON.parse(JSON.stringify(s))).profiles.map((p) => p.id)).toEqual(['clean', 'crisp', 'soft', 'bold']);
  });
});
