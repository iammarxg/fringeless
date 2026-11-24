import { useEffect, useRef, useState } from 'preact/hooks';
import { Seg } from '../../src/ui/components';
import darkOff from '../assets/crop-dark-off.png';
import darkOn from '../assets/crop-dark-on.png';
import lightOff from '../assets/crop-light-off.png';
import lightOn from '../assets/crop-light-on.png';

const W = 80, H = 22;
const SRC = { dark: [darkOff, darkOn], light: [lightOff, lightOn] } as const;
type Kind = keyof typeof SRC;

async function pixels(src: string): Promise<ImageData> {
  const i = new Image(); i.src = src; await i.decode();
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true })!; x.drawImage(i, 0, 0);
  return x.getImageData(0, 0, W, H);
}

/** Real captured pixels. Pointing at one shows the same pixel in both pictures. */
export function Pixels() {
  const [kind, setKind] = useState<Kind>('light');
  const [at, setAt] = useState<[number, number]>([16, 9]);
  const [data, setData] = useState<ImageData[] | null>(null);
  const refs = [useRef<HTMLCanvasElement>(null), useRef<HTMLCanvasElement>(null)];
  useEffect(() => { let on = true; void Promise.all(SRC[kind].map(pixels)).then((d) => { if (on) setData(d); }); return () => { on = false; }; }, [kind]);
  useEffect(() => { data?.forEach((d, i) => refs[i]!.current?.getContext('2d')?.putImageData(d, 0, 0)); }, [data]);
  const pick = (e: PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setAt([Math.max(0, Math.min(W - 1, Math.floor(((e.clientX - r.left) / r.width) * W))), Math.max(0, Math.min(H - 1, Math.floor(((e.clientY - r.top) / r.height) * H)))]);
  };
  const keys = (e: KeyboardEvent) => {
    const d = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, [number, number]>)[e.key];
    if (d) { e.preventDefault(); setAt(([x, y]) => [Math.max(0, Math.min(W - 1, x + d[0])), Math.max(0, Math.min(H - 1, y + d[1]))]); }
  };
  const rgb = (i: number) => { const d = data?.[i]?.data, o = (at[1] * W + at[0]) * 4; return d ? [d[o]!, d[o + 1]!, d[o + 2]!] : [0, 0, 0]; };
  const spread = (c: number[]) => Math.max(...c) - Math.min(...c);

  return <section class="wrap sect pixels" id="pixels">
    <div class="head"><h2>The pixels Chrome really sends</h2><p>These are captures, not drawings: 16 px Segoe UI on Windows with ClearType on. Point at any pixel to read its red, green and blue. Text is gray when all three agree.</p>
      <Seg label="Page color" value={kind} options={[['light', 'Light page'], ['dark', 'Dark page']]} onChange={setKind} /></div>
    <div class="two">{(['Without Fringeless', 'With Fringeless'] as const).map((name, i) => {
      const c = rgb(i);
      return <figure>
        <div class={'grid ' + kind} tabIndex={0} role="img" aria-label={`${name}, enlarged pixels. Arrow keys move the marker.`} onPointerMove={pick} onPointerDown={pick} onKeyDown={keys}>
          <canvas ref={refs[i]} width={W} height={H} />
          <span class="mark" style={`left:${(at[0] / W) * 100}%;top:${(at[1] / H) * 100}%;width:${100 / W}%;height:${100 / H}%`} />
        </div>
        <figcaption><strong>{name}</strong><span class="read"><i style={`background:rgb(${c.join(' ')})`} />{(['Red', 'Green', 'Blue'] as const).map((n, k) => <span class="ch"><span>{n}</span><b>{c[k]}</b><span class="bar"><span style={`width:${(c[k]! / 255) * 100}%;background:var(--${'rgb'[k]})`} /></span></span>)}<em>{spread(c) > 8 ? 'Colored' : 'Gray'}</em></span></figcaption>
      </figure>;
    })}</div>
  </section>;
}
