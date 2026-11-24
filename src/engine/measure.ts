/**
 * Compares a capture with smoothing left alone to one with the fix on. Only pixels that differ are text edges the
 * fix touched, so pictures and coloured UI do not count.
 */
export function fringePixels(native: Uint8ClampedArray, fixed: Uint8ClampedArray, threshold = 16): { changed: number; before: number; after: number } {
  let changed = 0, before = 0, after = 0;
  const spread = (d: Uint8ClampedArray, i: number) => Math.max(d[i]!, d[i + 1]!, d[i + 2]!) - Math.min(d[i]!, d[i + 1]!, d[i + 2]!);
  const len = Math.min(native.length, fixed.length);
  for (let i = 0; i < len; i += 4) {
    if (Math.abs(native[i]! - fixed[i]!) + Math.abs(native[i + 1]! - fixed[i + 1]!) + Math.abs(native[i + 2]! - fixed[i + 2]!) < 12) continue;
    changed++;
    if (spread(native, i) > threshold) before++;
    if (spread(fixed, i) > threshold) after++;
  }
  return { changed, before, after };
}
