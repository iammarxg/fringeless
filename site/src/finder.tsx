import { useState } from 'preact/hooks';
import { MONITORS, searchMonitors, type Monitor } from '../../src/data/monitors';
import { PANELS } from '../../src/engine/panels';
import { LAYOUTS, type Layout } from './hero';

const BASE = import.meta.env.BASE_URL;
const START = MONITORS.find((m) => m.model === 'PG27AQDM')!;
const toLayout = (panel: string): Layout => ((LAYOUTS as readonly string[]).includes(panel) ? (panel as Layout) : panel.startsWith('qd') ? 'qd-27-1440' : 'rgb');
function verdict(m: Monitor): [string, string] {
  if (m.panel === 'rgb') return ['Little to fix', 'Its subpixels run red, green, blue, so ClearType fits. Use Fringeless only if you like the looks.'];
  const dense = m.w >= 3840 && !/49|39|45|42/.test(m.size);
  if (m.panel.startsWith('woled')) return [dense ? 'A smaller win' : 'A clear win', dense ? 'Grayscale removes the color from text smoothing. At this density the fringes are small to begin with.' : 'Grayscale removes the color from text smoothing, which is nearly all of the fringe on this layout.'];
  return ['A partial fix', `Grayscale removes the color from text smoothing. A milder green and magenta edge above and below letters comes from the panel; an experimental filter targets it in Chromium browsers.${dense ? ' At this density it is hard to see.' : ''}`];
}

export function Finder({ show }: { show: (l: Layout) => void }) {
  const [q, setQ] = useState('');
  const [m, setM] = useState<Monitor>(START);
  const hits = searchMonitors(q, 7), panel = PANELS.find((p) => p.id === m.panel)!, [title, text] = verdict(m);
  const pick = (x: Monitor) => { setM(x); setQ(''); };
  return <section class="wrap sect finder" id="monitors">
    <div class="findleft">
      <div class="head"><h2>Will it help your monitor?</h2><p>Search {MONITORS.length} OLED models. The extension uses the same list to recognize your screen.</p></div>
      <div class="searchbox">
        <input type="text" value={q} placeholder="Model, such as AW3423DWF" aria-label="Monitor model" spellcheck={false} autocomplete="off" onInput={(e) => setQ(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === 'Enter' && hits[0]) pick(hits[0]); if (e.key === 'Escape') setQ(''); }} />
        {q.trim() && <ul class="results">{hits.length ? hits.map((x) => <li><button type="button" onClick={() => pick(x)}><span>{x.brand} {x.model}</span><span class="muted">{x.size}</span></button></li>) : <li class="none">Not in the list. <a href="https://github.com/iammarxg/fringeless/issues/new?template=screen_report.yml">Tell us about it</a>; the extension has a camera check for screens like yours.</li>}</ul>}
      </div>
    </div>
    <article class="result" aria-live="polite">
      <img src={`${BASE}panels/${m.panel}.webp`} width="480" height="360" alt={`Illustration of the ${panel.name} subpixel layout`} />
      <div><p class="muted">{m.brand} {m.model}, {m.size}</p><h3>{title}</h3><p>{text}</p><p class="small muted">Layout: {panel.name}</p><button type="button" class="btn" onClick={() => show(toLayout(m.panel))}>See this layout in the simulator</button></div>
    </article>
  </section>;
}
