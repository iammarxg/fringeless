import type { Kernel, LayoutFilter } from '../settings/model';
import type { Offsets } from './panels';

const BC: Record<Kernel, [number, number]> = { sharp: [0, 0.5], balanced: [0.2, 0.6], smooth: [0.3, 0.5] };

function bicubic(t: number, kernel: Kernel): number {
  const [B, C] = BC[kernel];
  t = Math.abs(t);
  if (t < 1) return ((12 - 9 * B - 6 * C) * t ** 3 + (-18 + 12 * B + 6 * C) * t ** 2 + (6 - 2 * B)) / 6;
  if (t < 2) return ((-B - 6 * C) * t ** 3 + (6 * B + 30 * C) * t ** 2 + (-12 * B - 48 * C) * t + (8 * B + 24 * C)) / 6;
  return 0;
}

/** Weights for taps -2..2 that sample a signal `d` pixels away. Sums to 1; d = 0 is identity. */
export function taps(d: number, kernel: Kernel): number[] {
  if (Math.abs(d) < 1e-4) return [0, 0, 1, 0, 0];
  const w = [-2, -1, 0, 1, 2].map((k) => bicubic(k - d, kernel));
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / sum);
}

export interface Convolution { orderX: number; orderY: number; kernel: number[]; identity: boolean }

/** 2D kernel for one channel, in SVG feConvolveMatrix order (which flips both axes). */
export function convolution(dx: number, dy: number, kernel: Kernel): Convolution {
  const wx = taps(dx, kernel), wy = taps(dy, kernel);
  const flatX = wx[2] === 1, flatY = wy[2] === 1;
  const X = (flatX ? [1] : [...wx].reverse()), Y = (flatY ? [1] : [...wy].reverse());
  const k: number[] = [];
  for (const y of Y) for (const x of X) k.push(Math.round(x * y * 1e5) / 1e5);
  return { orderX: X.length, orderY: Y.length, kernel: k, identity: flatX && flatY };
}

export interface FilterSpec { linear: boolean; channels: { c: 'r' | 'g' | 'b'; conv: Convolution }[] }

export function filterSpec(o: Offsets, f: LayoutFilter): FilterSpec | null {
  const channels = (['r', 'g', 'b'] as const).map((c) => ({ c, conv: convolution((o[c][0] * f.strengthX) / 100, (o[c][1] * f.strengthY) / 100, f.kernel) }));
  return channels.every((x) => x.conv.identity) ? null : { linear: f.linear, channels };
}

const PASS = { r: '1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1', g: '0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 0 1', b: '0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 0 1' };
const NS = 'http://www.w3.org/2000/svg';

/** Builds the filter with DOM calls only, so a strict page CSP cannot block it. spec null gives an identity filter. */
export function filterElement(doc: Document, id: string, spec: FilterSpec | null): SVGFilterElement {
  const make = (tag: string, at: Record<string, string>) => { const e = doc.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]!); return e; };
  const f = make('filter', { id, x: '0', y: '0', width: '1', height: '1', 'color-interpolation-filters': spec?.linear ? 'linearRGB' : 'sRGB' }) as SVGFilterElement;
  if (!spec) { f.append(make('feOffset', {})); return f; }
  for (const { c, conv } of spec.channels) {
    f.append(make('feColorMatrix', { in: 'SourceGraphic', values: PASS[c], result: c + '0' }));
    if (conv.identity) f.append(make('feOffset', { in: c + '0', result: c }));
    else f.append(make('feConvolveMatrix', { in: c + '0', order: `${conv.orderX} ${conv.orderY}`, kernelMatrix: conv.kernel.join(' '), divisor: '1', edgeMode: 'duplicate', preserveAlpha: 'true', result: c }));
  }
  const add = (a: string, b: string, result: string) => f.append(make('feComposite', { in: a, in2: b, operator: 'arithmetic', k1: '0', k2: '1', k3: '1', k4: '0', result }));
  add('r', 'g', 'rg'); add('rg', 'b', 'rgb');
  return f;
}
