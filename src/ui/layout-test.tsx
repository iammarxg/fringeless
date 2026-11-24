import { useEffect, useRef, useState } from 'preact/hooks';
import { matchMonitor } from '../data/monitors';
import { screenInfo } from '../engine/detect';
import { PANELS } from '../engine/panels';
import type { Settings } from '../settings/model';
import { screenRule } from '../settings/resolve';

/** Columns exactly 1px wide, far apart: one thing to find and look at. */
function Columns({ label }: { label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const draw = () => {
      const c = ref.current; if (!c) return;
      c.width = Math.round(c.clientWidth * devicePixelRatio); c.height = Math.round(c.clientHeight * devicePixelRatio);
      const x = c.getContext('2d')!;
      x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
      x.fillStyle = '#fff';
      const gap = Math.round(44 * devicePixelRatio), n = Math.max(1, Math.floor(c.width / gap) - 1), x0 = Math.round((c.width - (n - 1) * gap) / 2);
      for (let i = 0; i < n; i++) x.fillRect(x0 + i * gap, Math.round(c.height * 0.12), 1, Math.round(c.height * 0.76));
    };
    draw(); addEventListener('resize', draw);
    return () => removeEventListener('resize', draw);
  }, []);
  return <canvas ref={ref} class="target" role="img" aria-label={label} />;
}

function Choice({ img, title, hint, onClick }: { img: string; title: string; hint?: string; onClick: () => void }) {
  return <button type="button" class="card" onClick={onClick}><img class="pic" src={`/panels/${img}.webp`} alt="" width="420" height="315" /><span class="text"><strong>{title}</strong>{hint && <span class="small muted">{hint}</span>}</span></button>;
}

function qdPanel(): string | null {
  const w = Math.round(screen.width * devicePixelRatio), h = Math.round(screen.height * devicePixelRatio);
  return w === 2560 && h === 1440 ? 'qd-27-1440' : w === 3440 ? 'qd-34' : w === 5120 && h === 1440 ? 'qd-49' : null;
}
const nameOf = (id: string) => PANELS.find((p) => p.id === id)?.name ?? id;

/** What the model list says about this screen, when the person detected or searched for it. */
function listed(s: Settings): { model: string; panel: string } | null {
  const r = screenRule(s, screenInfo());
  const m = r ? matchMonitor(r.name) : null;
  return m && (m.kind === 'sure' || m.kind === 'likely') ? { model: `${m.monitor.brand} ${m.monitor.model}`, panel: m.monitor.panel } : null;
}

type Step = 'white' | 'woled' | 'size' | 'conflict' | 'unsure' | 'done';
export function LayoutTest({ s, onPick }: { s: Settings; onPick: (id: string) => void }) {
  const [step, setStep] = useState<Step>('white');
  const [picked, setPicked] = useState('');
  const known = listed(s);
  const save = (id: string) => { onPick(id); setPicked(id); setStep('done'); };
  // a blurry photo must not silently overrule a model we know
  const finish = (id: string) => { if (known && known.panel !== id) { setPicked(id); setStep('conflict'); } else save(id); };
  const unsure = () => { if (!known) onPick('unknown'); setStep('unsure'); };
  const again = <button type="button" class="btn" onClick={() => setStep('white')}>Start over</button>;
  const cannot = <button type="button" class="btn ghost" onClick={unsure}>I cannot tell</button>;

  return <div class="panel stack test">
    {step === 'white' && <>
      <h3>Zoom in on one white line with your phone camera</h3>
      <p class="muted">Hold the phone as close as it still focuses, then zoom in as far as it goes. Turn off sharpening and features like Clear Pixel Edge in your monitor's menu first; they redraw edges.</p>
      <Columns label="Thin white lines on black" />
      <p><strong>What does one line look like?</strong></p>
      <div class="cards">
        <Choice img="white-woled" title="A white stripe" hint="Any other colors are faint" onClick={() => { if (known?.panel.startsWith('woled')) save(known.panel); else setStep('woled'); }} />
        <Choice img="white-rgb" title="Red, green and blue stripes" hint="No white" onClick={() => finish('rgb')} />
        <Choice img="white-qd" title="Green dots above red and blue dots" hint="No white" onClick={() => { const id = qdPanel(); if (id) finish(id); else setStep('size'); }} />
      </div>
      <div>{cannot}</div>
    </>}
    {step === 'woled' && <>
      <h3>That is a WOLED. Which kind is it?</h3>
      <p>Fringeless treats both the same, so a guess is fine.</p>
      <div class="cards">
        <Choice img="woled-rwbg" title="RWBG" hint='1440p at 240 Hz or less, 42 to 48" 4K, and most LG OLED TVs before the G5' onClick={() => finish('woled-rwbg')} />
        <Choice img="woled-rgwb" title="RGWB" hint='1440p above 240 Hz, 32" 4K, 5K2K ultrawides' onClick={() => finish('woled-rgwb')} />
      </div>
      <div>{again}</div>
    </>}
    {step === 'size' && <>
      <h3>That is a QD-OLED. Which size is it?</h3>
      <div class="row">{PANELS.filter((p) => p.family === 'qdoled').map((p) => <button type="button" class="btn" onClick={() => finish(p.id)}>{p.name.replace('QD-OLED ', '')}</button>)}</div>
      <div>{again}</div>
    </>}
    {step === 'conflict' && known && <>
      <h3>That does not match your model</h3>
      <p>You saw {nameOf(picked)}, but the {known.model} is listed as {nameOf(known.panel)}. Reviews measure panels with proper macro lenses, so the list is usually right. A blurry photo or the monitor's own sharpening can change what you see.</p>
      <div class="row"><button type="button" class="btn primary" onClick={() => save(known.panel)}>Keep {nameOf(known.panel)}</button><button type="button" class="btn" onClick={() => save(picked)}>Use {nameOf(picked)}</button>{again}</div>
    </>}
    {step === 'unsure' && <><h3>That is fine</h3><p>{known ? `Kept ${nameOf(screenRule(s, screenInfo())?.panel ?? known.panel)} for your ${known.model}.` : 'Set to “Not sure”.'} Fringeless removes the color fringes the same way on every OLED; the exact layout only matters for the experimental layout filter.</p><div>{again}</div></>}
    {step === 'done' && <><h3>Your layout is {nameOf(picked)}</h3><p>It is saved for this screen.</p><div>{again}</div></>}
  </div>;
}
