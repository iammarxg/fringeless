// Subpixel layouts. Offsets are the centre of each colour relative to the reference (brightest) subpixel,
// in pixels, +x right, +y down. Values are derived from OLEDTextFix presets (MIT), see NOTICE.
export type Family = 'woled' | 'qdoled' | 'rgb' | 'custom';
export interface Offsets { r: [number, number]; g: [number, number]; b: [number, number] }
export interface Cell { c: 'r' | 'g' | 'b' | 'w'; x: number; y: number; w: number; h: number }
export interface Panel {
  id: string;
  name: string;
  family: Family;
  examples: string;
  offsets: Offsets;
  cells: Cell[];
  /** Whether the layout filter is worth offering, from the lab simulation. */
  filterUseful: boolean;
}

const cols = (order: string): Cell[] => {
  const n = order.length, w = 1 / n;
  return [...order].map((c, i) => ({ c: c as Cell['c'], x: i * w + w * 0.1, y: 0.08, w: w * 0.8, h: 0.84 }));
};
const triad = (r: [number, number], b: [number, number]): Cell[] => [
  { c: 'g', x: 0.27, y: 0.06, w: 0.46, h: 0.38 },
  { c: 'r', x: 0.5 + r[0] - 0.19, y: 0.06 + 0.19 + r[1] - 0.16, w: 0.38, h: 0.36 },
  { c: 'b', x: 0.5 + b[0] - 0.18, y: 0.06 + 0.19 + b[1] - 0.16, w: 0.36, h: 0.36 },
];
const qd = (id: string, name: string, examples: string, r: [number, number], b: [number, number]): Panel => ({
  id, name, family: 'qdoled', examples, offsets: { r, g: [0, 0], b }, cells: triad(r, b), filterUseful: true,
});

export const PANELS: Panel[] = [
  { id: 'woled-rwbg', name: 'WOLED RWBG', family: 'woled', examples: '27" 1440p 240 Hz (PG27AQDM, XG27AQDMG, XG27AQDMGR, 27GR95QE), 34/39/45" 3440x1440, LG C1 and C3 TVs', offsets: { r: [-0.32, 0], g: [0.47, 0], b: [0.2, 0] }, cells: cols('rwbg'), filterUseful: false },
  { id: 'woled-rgwb', name: 'WOLED RGWB', family: 'woled', examples: '27" 1440p 480 Hz (PG27AQDP), 32" 4K (PG32UCDP, 32GS95UE), 39/45" 5120x2160, 4th-gen tandem', offsets: { r: [-0.5, 0], g: [-0.25, 0], b: [0.22, 0] }, cells: cols('rgwb'), filterUseful: false },
  qd('qd-34', 'QD-OLED 34" 3440x1440', 'AW3423DW, AW3423DWF, MSI 341CQP, Odyssey G8 34"', [-0.31, 0.49], [0.22, 0.49]),
  qd('qd-27-1440', 'QD-OLED 27" 1440p', 'AW2725DF, Odyssey G6 G60SD and G61SD, MSI 271QRX', [-0.22, 0.5], [0.27, 0.52]),
  qd('qd-49', 'QD-OLED 49" 5120x1440', 'Odyssey G9 G93SC and G95SC, PG49WCD', [-0.18, 0.5], [0.32, 0.5]),
  qd('qd-32-4k', 'QD-OLED 32" 4K', 'AW3225QF, PG32UCDM, MSI 321URX', [-0.13, 0.5], [0.37, 0.5]),
  qd('qd-27-4k', 'QD-OLED 27" 4K', 'PG27UCDM, MSI 272URX, AW2725Q', [-0.17, 0.5], [0.32, 0.5]),
  { id: 'rgb', name: 'RGB stripe', family: 'rgb', examples: '2026 RGB-stripe OLEDs (PG27UCWM, PG32UCWM, PG34WCDN) and nearly all LCDs', offsets: { r: [0, 0], g: [0, 0], b: [0, 0] }, cells: cols('rgb'), filterUseful: false },
  { id: 'unknown', name: 'Not sure, or another OLED', family: 'custom', examples: 'Laptops, portable monitors, anything not listed', offsets: { r: [0, 0], g: [0, 0], b: [0, 0] }, cells: [], filterUseful: false },
];

export function customPanel(id: string, name: string, offsets: Offsets): Panel {
  const at = (c: 'r' | 'g' | 'b', o: [number, number]): Cell => ({ c, x: 0.5 + o[0] - 0.15, y: 0.5 + o[1] - 0.15, w: 0.3, h: 0.3 });
  return { id, name, family: 'custom', examples: 'Your own offsets', offsets, cells: [at('r', offsets.r), at('g', offsets.g), at('b', offsets.b)], filterUseful: true };
}
