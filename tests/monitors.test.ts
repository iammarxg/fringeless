import { describe, expect, it } from 'vitest';
import { MONITORS, matchMonitor, searchMonitors } from '../src/data/monitors';
import { PANELS } from '../src/engine/panels';

const px = (w: number, h: number) => ({ w, h });
describe('monitor database', () => {
  it('uses only known panels and has no empty entries', () => {
    const ids = new Set(PANELS.map((p) => p.id));
    for (const m of MONITORS) { expect(ids.has(m.panel)).toBe(true); expect(m.brand && m.model && m.code.length >= 2 && m.w > 1000).toBeTruthy(); }
    expect(MONITORS.length).toBeGreaterThan(350);
  });
  it.each([
    ['XG27AQDMGR', 'woled-rwbg', 'XG27AQDMGR', 'sure'], ['ROG STRIX XG27AQDMGR', 'woled-rwbg', 'XG27AQDMGR', 'sure'], ['ROG PG27AQDM', 'woled-rwbg', 'PG27AQDM', 'sure'], ['PG27AQDP', 'woled-rgwb', 'PG27AQDP', 'sure'],
    ['XG27AQWMG', 'woled-rgwb', 'XG27AQWMG', 'sure'], ['PG27UCWM', 'rgb', 'PG27UCWM', 'sure'], ['AW3423DWF', 'qd-34', 'AW3423DWF', 'sure'], ['Dell AW3423DW', 'qd-34', 'AW3423DW', 'sure'], ['AW3426DW', 'rgb', 'AW3426DW', 'sure'],
    ['MPG271QRX OLED', 'qd-27-1440', '271QRX', 'sure'], ['MAG 341CQP QD-OLED X28', 'rgb', '341CQPX28', 'sure'], ['MAG 341CQP QD-OLED', 'qd-34', '341CQP', 'sure'], ['MPG 321URX QD-OLED', 'qd-32-4k', '321URX', 'sure'],
    ['Odyssey G60SD', 'qd-27-1440', 'G60SD', 'sure'], ['LS49CG95', 'qd-49', 'S49CG95', 'sure'], ['AORUS FO32U2P', 'qd-32-4k', 'FO32U2P', 'sure'], ['MO27Q28G', 'woled-rgwb', 'MO27Q28G', 'sure'], ['MO27Q2', 'qd-27-1440', 'MO27Q2', 'sure'],
    ['X34 V', 'qd-34', 'X34 V', 'sure'], ['PG32UCDMZZ', 'qd-32-4k', 'PG32UCDM', 'likely'], ['27GR95QE', 'woled-rwbg', '27GR95QE', 'sure'],
  ])('%s', (label, panel, model, kind) => {
    const r = matchMonitor(label);
    expect(r).toMatchObject({ kind, monitor: { panel, model } });
  });
  it('asks when the name is shared by many models', () => {
    const r = matchMonitor('LG ULTRAGEAR+', px(3440, 1440));
    expect(r.kind).toBe('choose');
    if (r.kind === 'choose') { expect(r.candidates.every((m) => m.brand === 'LG' && m.w === 3440)).toBe(true); expect(r.candidates.length).toBeGreaterThan(3); }
  });
  it('knows LG TVs do not say which TV they are', () => expect(matchMonitor('LG TV SSCR2').kind).toBe('tv'));
  it.each(['DELL U2720Q', 'Generic PnP Monitor', 'Internal Display 1', 'BenQ GL2460', 'SAMSUNG', '', 'C27G2', 'VG279Q', 'LC27G7xT', 'HP 27q', 'DELL S2722QC', 'LG HDR 4K'])('does not invent a match for %s', (l) => {
    expect(['sure', 'likely']).not.toContain(matchMonitor(l, px(2560, 1440)).kind);
  });
  it('search finds models by part of the name', () => {
    expect(searchMonitors('xg27aqdmgr')[0]!.model).toBe('XG27AQDMGR');
    expect(searchMonitors('alienware')).toEqual([]);
    expect(searchMonitors('dell aw34').map((m) => m.model)).toContain('AW3423DW');
    expect(searchMonitors('  ')).toEqual([]);
  });
  it('every model finds itself', () => {
    const wrong = MONITORS.filter((m) => { const r = matchMonitor(m.model, px(m.w, m.h)); return !((r.kind === 'sure' || r.kind === 'likely') && r.monitor.panel === m.panel); }).map((m) => m.brand + ' ' + m.model);
    expect(wrong).toEqual([]);
  });
});
