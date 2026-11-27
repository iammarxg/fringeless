import { useState } from 'preact/hooks';
import { Scoped, TuningSliders, editProfile } from './components';
import { BACKGROUNDS, LabSample, Swatches, isDarkBg } from './backgrounds';
import { PRESETS, restoreLooks, saveLook, type Profile, type Settings } from '../settings/model';

const LETTERS = ['A', 'B', 'C', 'D'];
const ABOUT: Record<string, string> = { clean: 'fringes removed, nothing else', crisp: 'stronger edges', bold: 'heavier letters', soft: 'less glare' };

/** The four built-in looks on the same text, by letter so the name does not sway the choice. Then sliders for the one picked. */
export function EyeTest({ s, change, hold, onHold }: { s: Settings; change: (fn: (s: Settings) => Settings) => void; hold: boolean; onHold: (v: boolean) => void }) {
  const [color, setColor] = useState(BACKGROUNDS[0]!);
  // text on a dark background uses the look's dark-page settings, and the other way round
  const bg = isDarkBg(color.bg) ? 'dark' : 'light';
  const paint = `--eye-bg:${color.bg};--eye-fg:${color.fg}`;
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
      <Swatches value={color} onChange={setColor} />
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
