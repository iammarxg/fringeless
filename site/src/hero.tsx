import { useEffect, useRef, useState } from 'preact/hooks';
import { PANELS } from '../../src/engine/panels';
import { Seg, Select } from '../../src/ui/components';
import { Simulator } from './sim';

export const LAYOUTS = ['woled-rwbg', 'woled-rgwb', 'qd-27-1440', 'rgb'] as const;
export type Layout = (typeof LAYOUTS)[number];
const NAME: Record<Layout, string> = { 'woled-rwbg': 'WOLED RWBG', 'woled-rgwb': 'WOLED RGWB', 'qd-27-1440': 'QD-OLED', rgb: 'RGB stripe' };
const WHY: Record<Layout, string> = {
  'woled-rwbg': 'Blue and green have traded places and a white stripe sits between red and blue, so the color ClearType adds to a letter’s edge lights up on the wrong side.',
  'woled-rgwb': 'Red and green are where ClearType expects them. Blue is pushed out by the white stripe, so the mistake is smaller but still there.',
  'qd-27-1440': 'Green sits above red and blue. Sideways smoothing has no matching stripes to use, and tops and bottoms of letters keep a green or magenta tint that grayscale cannot remove.',
  rgb: 'This is the layout ClearType was made for. Leave Fringeless off on screens like this.',
};

const REST = 0.62;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
/** Share of a gap closed after dt ms, whatever the frame rate. */
const close = (dt: number, tau: number) => 1 - Math.exp(-dt / tau);

/** Moves the picture, divider and slider directly, outside the UI framework, so nothing re-renders while they move. */
class Motion {
  private distance = 0; private split = 1;
  private toDistance = 0;
  /** What is left of a jump: the divider sits at split + lag, and lag fades out. Dragging itself has no delay. */
  private lag = 0;
  private intro = 0; private last = 0; private raf = 0;
  private width = 0;
  constructor(private readonly sim: Simulator, private readonly el: { bar: HTMLElement; left: HTMLElement; right: HTMLElement; range: HTMLInputElement }) {}

  resize(width: number): void { this.width = width; this.paint(); }
  start(still: boolean): void {
    if (still) { this.distance = this.toDistance = REST; this.split = 0.5; this.paint(); return; }
    this.intro = performance.now() + 150; this.paint(); this.run();
  }
  stop(): void { cancelAnimationFrame(this.raf); }
  private take(): void { if (this.intro) { this.intro = 0; this.toDistance = this.distance; } }
  setDistance(v: number): void { this.take(); this.toDistance = v; this.run(); }
  /** smooth: glide there. Otherwise follow exactly. */
  setSplit(v: number, smooth: boolean): void { this.take(); const n = clamp(v); if (smooth) this.lag += this.split - n; this.split = n; this.run(); }
  nudge(d: number): void { this.setSplit(this.split + d, true); }
  still(): void { this.lag = 0; this.distance = this.toDistance; this.paint(); }

  private run(): void { if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(this.step); } }
  private readonly step = (now: number): void => {
    this.raf = 0;
    const dt = Math.min(64, Math.max(0, now - this.last)); this.last = now;
    let more = false;
    if (this.intro) {
      const t = Math.max(0, now - this.intro);
      this.distance = this.toDistance = ease(clamp(t / 1050)) * REST; this.split = 1 - ease(clamp((t - 620) / 800)) * 0.5;
      if (t < 1420) more = true; else this.intro = 0;
    } else {
      const gap = this.toDistance - this.distance;
      if (Math.abs(gap) > 0.0004) { this.distance += gap * close(dt, 55); more = true; } else this.distance = this.toDistance;
      if (Math.abs(this.lag) > 0.0003) { this.lag *= 1 - close(dt, 65); more = true; } else this.lag = 0;
    }
    this.paint();
    if (more) this.raf = requestAnimationFrame(this.step);
  };
  private paint(): void {
    const s = clamp(this.split + this.lag), { bar, left, right, range } = this.el;
    this.sim.look({ distance: this.distance, split: s });
    bar.style.transform = `translate3d(${s * this.width}px,0,0)`;
    bar.setAttribute('aria-valuenow', String(Math.round(this.split * 100)));
    left.style.opacity = s < 0.16 ? '0' : '1'; right.style.opacity = s > 0.84 ? '0' : '1';
    // the thumb follows the hand, except in the opening, where it follows the picture
    if (this.intro || document.activeElement !== range) range.value = String(this.toDistance);
    range.style.setProperty('--p', `${this.toDistance * 100}%`);
  }
}

export function Hero({ layout, setLayout }: { layout: Layout; setLayout: (l: Layout) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null), stage = useRef<HTMLDivElement>(null), bar = useRef<HTMLDivElement>(null), range = useRef<HTMLInputElement>(null);
  const left = useRef<HTMLSpanElement>(null), right = useRef<HTMLSpanElement>(null);
  const sim = useRef<Simulator | null>(null), motion = useRef<Motion | null>(null), box = useRef<DOMRect | null>(null);
  const [ok, setOk] = useState(true);
  const [text, setText] = useState('Clear little');
  const [kind, setKind] = useState<'dark' | 'light'>('light');

  useEffect(() => {
    const still = matchMedia('(prefers-reduced-motion: reduce)');
    try { sim.current = new Simulator(canvas.current!, () => motion.current?.start(still.matches)); } catch { setOk(false); return; }
    const m = motion.current = new Motion(sim.current, { bar: bar.current!, left: left.current!, right: right.current!, range: range.current! });
    // Beyond 1.5 device pixels per CSS pixel the blur hides any extra detail.
    const ro = new ResizeObserver(([e]) => { const { width, height } = e!.contentRect, d = Math.min(devicePixelRatio || 1, 1.5); sim.current!.size(Math.round(width * d), Math.round(height * d)); m.resize(width); });
    ro.observe(canvas.current!);
    return () => { ro.disconnect(); m.stop(); sim.current?.destroy(); };
  }, []);
  useEffect(() => { sim.current?.show({ text, dark: kind === 'dark', cells: PANELS.find((p) => p.id === layout)!.cells }); }, [text, kind, layout]);

  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const x = (e: PointerEvent) => (e.clientX - box.current!.left) / box.current!.width;
  const down = (e: PointerEvent) => { if (e.button) return; stage.current!.setPointerCapture(e.pointerId); box.current = stage.current!.getBoundingClientRect(); motion.current?.setSplit(x(e), !calm()); };
  const drag = (e: PointerEvent) => { if (box.current && stage.current!.hasPointerCapture(e.pointerId)) motion.current?.setSplit(x(e), false); };
  const keys = (e: KeyboardEvent) => {
    const d = { ArrowLeft: -0.02, ArrowDown: -0.02, ArrowRight: 0.02, ArrowUp: 0.02, PageDown: -0.1, PageUp: 0.1, Home: -1, End: 1 }[e.key];
    if (d) { e.preventDefault(); motion.current?.nudge(d); if (calm()) motion.current?.still(); }
  };

  return <section class="sim" aria-label="Panel simulator">
    <div ref={stage} class={'stage ' + kind} onPointerDown={down} onPointerMove={drag}>
      {ok ? <canvas ref={canvas} aria-hidden="true" /> : <p class="nogl">This simulator needs WebGL 2, which this browser has turned off.</p>}
      {ok && <>
        <span ref={left} class="tag l">Browser default</span><span ref={right} class="tag r">With Fringeless</span>
        <div ref={bar} class="split" tabIndex={0} role="slider" aria-label="Share shown without Fringeless" aria-valuemin={0} aria-valuemax={100} aria-valuenow={100} onKeyDown={keys}><span class="grip" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M9 6l-6 6 6 6M15 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg></span></div>
      </>}
    </div>
    <div class="wrap simbar">
      <label class="field"><span>Type here</span><input type="text" value={text} maxLength={28} spellcheck={false} autocomplete="off" onInput={(e) => setText(e.currentTarget.value)} /></label>
      <div class="field"><span>Panel</span><Select label="Panel" value={layout} options={LAYOUTS.map((id) => ({ value: id, label: NAME[id] }))} onChange={setLayout} /></div>
      <label class="field dist"><span>Distance</span><span class="ends"><span>Subpixels</span><input ref={range} type="range" min={0} max={1} step="any" aria-label="Viewing distance" onInput={(e) => { motion.current?.setDistance(Number(e.currentTarget.value)); if (calm()) motion.current?.still(); }} /><span>Reading</span></span></label>
      <div class="field"><span>Page</span><Seg label="Page color" value={kind} options={[['light', 'Light'], ['dark', 'Dark']]} onChange={setKind} /></div>
      <p class="why" aria-live="polite">{WHY[layout]}</p>
      <p class="small muted fine">A simulation of 16 px text, enlarged even at reading distance so you can see it. Drag across the picture to compare.</p>
    </div>
  </section>;
}
