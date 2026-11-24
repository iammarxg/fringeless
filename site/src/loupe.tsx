import { useEffect, useRef } from 'preact/hooks';
import { strokeWidth } from '../../src/engine/css';
import type { Profile } from '../../src/settings/model';

/** Words to enlarge, with the size and weight they have on the page. */
export interface Word { text: string; size: number; weight: number }
export type Kind = 'dark' | 'light';
export const INK: Record<Kind, [string, string]> = { dark: ['#0b0b0c', '#ececec'], light: ['#ffffff', '#1b1b1b'] };
const FAMILY = '"Segoe UI", system-ui, sans-serif';

/** The words under a point of the page. */
export function wordAt(x: number, y: number): Word | null {
  const d = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null; caretRangeFromPoint?: (x: number, y: number) => Range | null };
  const p = d.caretPositionFromPoint?.(x, y), r = p ? null : d.caretRangeFromPoint?.(x, y);
  return wordIn(p?.offsetNode ?? r?.startContainer ?? null, p?.offset ?? r?.startOffset ?? 0);
}
export function wordIn(node: Node | null, offset: number): Word | null {
  if (!node || node.nodeType !== Node.TEXT_NODE || !node.parentElement) return null;
  const all = node.textContent ?? '', from = all.lastIndexOf('\n', offset - 1) + 1, to = all.indexOf('\n', offset), line = all.slice(from, to < 0 ? undefined : to), at = offset - from;
  if (!line.trim()) return null;
  let start = line.lastIndexOf(' ', Math.max(0, at - 1)) + 1;
  // near the end of a line, step back so there is enough to see
  while (line.length - start < 14 && start > 0) start = line.lastIndexOf(' ', start - 2) + 1;
  const css = getComputedStyle(node.parentElement);
  return { text: line.slice(start, start + 40), size: parseFloat(css.fontSize), weight: Number(css.fontWeight) || 400 };
}

/** Neutral ink moved to a given oklab lightness, as the "soften" setting does. */
function soften(ink: string, p: Profile): string {
  const c = parseInt(ink.slice(1, 3), 16) / 255, lin = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const l = Math.min(1 - p.dark.soften * 0.0028, Math.max(p.light.soften * 0.0035, Math.cbrt(lin))), y = l ** 3;
  const v = Math.round((y <= 0.0031308 ? y * 12.92 : 1.055 * y ** (1 / 2.4) - 0.055) * 255);
  return `rgb(${v} ${v} ${v})`;
}

const ZOOM = 6;

/**
 * Real pixels, not a drawing of them: an opaque canvas gets the browser's own colored smoothing and a transparent one
 * gets gray, which is what the extension makes of page text. The result is enlarged without smoothing.
 */
export function Loupe({ word, kind, profile }: { word: Word; kind: Kind; profile: Profile | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const out = ref.current!;
    const draw = () => {
      const dpr = devicePixelRatio || 1, W = Math.round(out.clientWidth * dpr), H = Math.round(out.clientHeight * dpr), z = Math.max(2, Math.min(Math.round((ZOOM * dpr) / Math.max(1, Math.round(dpr))), Math.floor(H / (word.size * dpr * 1.12))));
      if (!W || !H) return;
      const w = Math.ceil(W / z), h = Math.ceil(H / z), [paper, ink] = INK[kind];
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const t = c.getContext('2d', { alpha: !!profile })!;
      if (!profile) { t.fillStyle = paper; t.fillRect(0, 0, w, h); }
      const size = word.size * dpr, y = Math.round(h / 2 + size * 0.34), x = Math.round((22 * dpr) / z);
      t.font = `${word.weight} ${size}px ${FAMILY}`;
      t.fillStyle = profile ? soften(ink, profile) : ink;
      if (profile) {
        const p = profile[kind], top = Math.max(profile.dark.thickness, profile.light.thickness);
        if (top && p.thickness) { t.globalAlpha = p.thickness / top; t.strokeStyle = t.fillStyle; t.lineJoin = 'round'; t.lineWidth = strokeWidth(profile) * dpr; t.strokeText(word.text, x, y); t.globalAlpha = 1; }
        if (p.contrast) { t.globalAlpha = p.contrast / 100; t.fillText(word.text, x, y); t.globalAlpha = 1; }
      }
      t.fillText(word.text, x, y);
      out.width = W; out.height = H;
      const o = out.getContext('2d', { alpha: false })!;
      o.fillStyle = paper; o.fillRect(0, 0, W, H);
      o.imageSmoothingEnabled = false; o.drawImage(c, 0, 0, w * z, h * z);
    };
    draw();
    const ro = new ResizeObserver(draw); ro.observe(out);
    return () => ro.disconnect();
  }, [word, kind, profile]);
  return <canvas ref={ref} class="loupe" role="img" aria-label={`“${word.text}”, enlarged ${profile ? 'with' : 'without'} Fringeless`} />;
}
