import { useState } from 'preact/hooks';
import { Scoped, TuningSliders, editProfile } from './components';
import { PRESETS, restoreLooks, saveLook, type Profile, type Settings } from '../settings/model';

/** Common page backgrounds, with the text color sites usually put on them. */
const BACKGROUNDS = [
  { name: 'White', bg: '#ffffff', fg: '#000000' },
  { name: 'Sepia', bg: '#f4ecd8', fg: '#3b2f22' },
  { name: 'Black', bg: '#000000', fg: '#ffffff' },
  { name: 'Dark gray', bg: '#1e1e1e', fg: '#d4d4d4' },
  { name: 'Night blue', bg: '#0d1117', fg: '#e6edf3' },
];
/** Relative luminance of a #rrggbb color. */
const luminance = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
/** Where black and white text have equal contrast. */
const isDarkBg = (hex: string) => luminance(hex) < 0.179;
const LETTERS = ['A', 'B', 'C', 'D'];
const ABOUT: Record<string, string> = { clean: 'fringes removed, nothing else', crisp: 'stronger edges', bold: 'heavier letters', soft: 'less glare' };

/** The kinds of text where fringes and thin strokes show most: small sizes, light weights, code, links, gray captions. */
export function LabSample() {
  return <div class="lab-sample">
    <p style="font-size:11px">11 px: Illiwm HAVE quick brown fox jumps over the lazy dog, 0O8 il1I rn m</p>
    <p style="font-size:13px">13 px: Illiwm HAVE quick brown fox jumps over the lazy dog</p>
    <p>16 px: Reading should feel like paper, not colored edges.</p>
    <p style="font-size:20px">20 px: Illiwm HAVE quick brown fox</p>
    <p style="font-size:32px">32 px Illiwm HAVE</p>
    <p style="font-weight:300">Light weight: quick brown fox jumps over</p>
    <p style="font-weight:700">Bold weight: quick brown fox jumps over</p>
    <p class="gray">Gray caption text, 13 px, posted 3 hours ago</p>
    <p><span class="link">A link in a sentence</span> with <b>bold</b> and <i>italic</i> words</p>
    <p><code>const fill = (il, li) =&gt; il !== li; // 14 px</code></p>
  </div>;
}

/** The four built-in looks on the same text, by letter so the name does not sway the choice. Then sliders for the one picked. */
export function EyeTest({ s, change, hold, onHold }: { s: Settings; change: (fn: (s: Settings) => Settings) => void; hold: boolean; onHold: (v: boolean) => void }) {
  const [color, setColor] = useState(BACKGROUNDS[0]!);
  // text on a dark background uses the look's dark-page settings, and the other way round
  const bg = isDarkBg(color.bg) ? 'dark' : 'light';
  const paint = `--eye-bg:${color.bg};--eye-fg:${color.fg}`;
  const custom = !BACKGROUNDS.some((b) => b.bg === color.bg);
  const [picked, setPicked] = useState<string | null>(null);
  const [saved, setSaved] = useState('');
  // a built-in look someone deleted still takes part; picking it brings it back
  const looks = PRESETS.map((x) => s.profiles.find((p) => p.id === x.id) ?? x);
  const chosen = s.profiles.find((p) => p.id === picked);
  const preset = chosen && PRESETS.find((x) => x.id === chosen.id);
  const letter = (p: Profile) => LETTERS[looks.findIndex((x) => x.id === p.id)];
  const pick = (id: string) => { setPicked(id); setSaved(''); change((v) => ({ ...(v.removedLooks.includes(id) ? restoreLooks(v, id) : v), profileId: id })); };
  const tuned = chosen && preset && JSON.stringify(chosen[bg]) !== JSON.stringify(preset[bg]);
  const save = () => {
    if (!chosen) return;
    let id = '';
    change((v) => {
      const [w, n] = saveLook(v, chosen.id); id = n;
      // the built-in look goes back to how it was; the tuning lives on in the new one
      return { ...(preset ? editProfile(w, chosen.id, { dark: structuredClone(preset.dark), light: structuredClone(preset.light) }) : w), profileId: n };
    });
    setPicked(id); setSaved(id);
  };

  const holdButton = <button type="button" class="btn" onPointerDown={() => onHold(true)} onPointerUp={() => onHold(false)} onPointerLeave={() => onHold(false)} onBlur={() => onHold(false)} onKeyDown={(e) => e.key === ' ' && onHold(true)} onKeyUp={() => onHold(false)}>Hold to see it without Fringeless</button>;

  return <div class="stack loose">
    <div class="stack tight">
      <div class="swatches" role="radiogroup" aria-label="Background">
        {BACKGROUNDS.map((b) => <button type="button" role="radio" aria-checked={b.bg === color.bg} aria-label={b.name} title={b.name} class="swatch" style={`--sw:${b.bg};--sw-fg:${b.fg}`} onClick={() => setColor(b)}><span aria-hidden="true">Aa</span></button>)}
        <label class={'swatch pick' + (custom ? ' on' : '')} title="Any color" style={custom ? `--sw:${color.bg};--sw-fg:${color.fg}` : ''}>
          <input type="color" aria-label="Any background color" value={color.bg} onInput={(e) => { const v = e.currentTarget.value; setColor({ name: 'Custom', bg: v, fg: isDarkBg(v) ? '#ffffff' : '#000000' }); }} />
          <span aria-hidden="true">+</span>
        </label>
        <span class="small muted">{custom ? 'Your color' : color.name}</span>
      </div>
      <p class="small muted">Try the backgrounds you read on most. Light and dark backgrounds keep separate settings, so if you use dark mode, check one of each.</p>
    </div>
    {!chosen && <div class="row">{holdButton}<span class="small muted">Compare all four with how text looks without Fringeless.</span></div>}
    <div class={'eye-grid ' + bg} style={paint} role="radiogroup" aria-label="Looks">
      {looks.map((p) => <button type="button" class="eye" role="radio" aria-checked={p.id === picked} onClick={() => pick(p.id)}>
        <span class="tag">{letter(p)}</span>
        <Scoped id={`eye-${p.id}`} profile={hold ? null : p} class="eye-text"><LabSample /></Scoped>
      </button>)}
    </div>
    {chosen ? <div class="panel stack eye-tune">
      <div class="row between"><h3>{preset ? `${letter(chosen)} is ${chosen.name}: ${ABOUT[chosen.id]}` : `Your look: ${chosen.name}`}</h3>
        {tuned && <button type="button" class="btn ghost" onClick={() => change((v) => editProfile(v, chosen.id, { [bg]: structuredClone(preset[bg]) }))}>Reset</button>}</div>
      <p class="small muted">Fine-tune it on this {bg} background until it reads easiest. Changes are saved to {chosen.name} right away.</p>
      <div class={'eye-big ' + bg} style={paint}><Scoped id="eye-big" profile={hold ? null : chosen} class="eye-text"><LabSample /></Scoped></div>
      <TuningSliders value={chosen[bg]} onChange={(t) => change((v) => editProfile(v, chosen.id, { [bg]: t }))} />
      <div class="row">
        {holdButton}
        {preset && <button type="button" class="btn" onClick={save}>Save as my own look</button>}
      </div>
      {saved === chosen.id && <p role="status" class="small">Saved as {chosen.name} and used by default. Rename, reorder or delete looks in settings.</p>}
    </div> : <p class="muted">Pick the box that reads easiest to you.</p>}
  </div>;
}
