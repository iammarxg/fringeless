import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Applier } from '../../src/engine/apply';
import { lcdTextOn } from '../../src/engine/detect';
import { PANELS } from '../../src/engine/panels';
import { PRESETS, type Profile } from '../../src/settings/model';
import { Loupe, wordAt, wordIn, type Word } from './loupe';
import { Looks, Scoped, Seg, Toggle, TuningSliders, env } from '../../src/ui/components';

export const safari = /Safari\//.test(navigator.userAgent) && !/Chrome|Chromium|CriOS|Firefox/.test(navigator.userAgent);
/** The extension is already working on this page. */
const installed = () => !!document.querySelector('fringeless-overlay,style[data-fringeless]');

/** The extension's own engine, on this page only. Not started with start(), which would clear a real install's styles. */
export function useFix(): [boolean, (v: boolean) => void, boolean] {
  const a = useMemo(() => new Applier(document, env, true), []);
  const [on, set] = useState(false);
  useEffect(() => { a.set(on ? { profile: structuredClone(PRESETS[0]!), panel: PANELS[0]! } : null); }, [on]);
  const [has, setHas] = useState(installed);
  // The extension may start after this page does. While our own copy is off, anything present is the extension's.
  useEffect(() => {
    if (on) return;
    const look = () => setHas(installed()), o = new MutationObserver(look);
    look(); o.observe(document.documentElement, { childList: true });
    return () => o.disconnect();
  }, [on]);
  useEffect(() => () => a.set(null), []);
  return [on, set, has];
}

const TITLE = 'Bold titles show colored edges too';
const SAMPLE = `Illinois millilitre, 1lI| rn m. Reading small text for an hour is where thin letters and colored edges start to matter.

The quick brown fox jumps over 1,234 lazy dogs. Click here and type your own.`;

export function Live({ on, setOn, has }: { on: boolean; setOn: (v: boolean) => void; has: boolean }) {
  const [profiles, setProfiles] = useState<Profile[]>(() => structuredClone(PRESETS));
  const [id, setId] = useState('clean');
  const [kind, setKind] = useState<'dark' | 'light'>('light');
  const [size, setSize] = useState<'14' | '16' | '20'>('16');
  const lcd = useMemo(() => (env.browser === 'chromium' && !safari ? lcdTextOn() : null), []);
  const p = profiles.find((x) => x.id === id)!;
  const plain = useRef<HTMLDivElement>(null), fixed = useRef<HTMLDivElement>(null);
  const [word, setWord] = useState<Word>({ text: 'Illinois millilitre, 1lI| rn m.', size: 16, weight: 400 });
  useEffect(() => { for (const box of [plain, fixed]) { const t = document.createElement('div'), b = document.createElement('div'); t.className = 'title'; t.textContent = TITLE; b.textContent = SAMPLE; box.current!.replaceChildren(t, b); } }, []);
  useEffect(() => { setWord((w) => ({ ...w, size: w.weight > 500 ? Number(size) * 1.5 : Number(size) })); }, [size]);
  // Typing in one copy writes the other.
  const typed = (e: Event) => { const from = e.currentTarget as HTMLElement, to = from === plain.current ? fixed.current! : plain.current!; to.innerHTML = from.innerHTML; caret(); };
  const caret = () => { const q = getSelection(), w = q?.anchorNode ? wordIn(q.anchorNode, q.anchorOffset) : null; if (w) setWord(w); };
  const point = (e: PointerEvent) => { const w = wordAt(e.clientX, e.clientY); if (w && (w.text !== word.text || w.size !== word.size || w.weight !== word.weight)) setWord(w); };
  const copy = (ref: typeof plain, name: string) => <div ref={ref} class="write" style={`font-size:${size}px`} contentEditable={'plaintext-only' as never} role="textbox" aria-multiline="true" aria-label={name} spellcheck={false} onInput={typed} onKeyUp={caret} onPointerMove={point} onPointerDown={point} />;
  const both = !on && !has;
  const state = safari ? 'Safari cannot run Fringeless, but the looks below still show.'
    : has ? 'Fringeless is already running here.'
      : env.os === 'mac' ? 'macOS already draws text in gray, so this switch changes little. The looks still work.'
        : lcd === false ? 'Your browser already draws this page in gray (common at high zoom or with ClearType off), so you may see no change.'
          : lcd ? 'Your browser is using colored smoothing on this page. Point at a word in the box to enlarge it.' : 'Point at a word in the box to enlarge it.';

  return <section class="sect tint" id="try"><div class="wrap">
    <div class="head"><h2>Try it here, without installing</h2><p>Point at a word to see the pixels your own browser draws for it. The switch runs the extension’s engine on this whole page. Nothing is installed or saved.</p></div>
    <div class="livegrid">
      <div class="stack loose controls">
        <Toggle on={on || has} disabled={safari || has} onChange={setOn} label="Fringeless on this page" hint={state} />
        <Looks compact name="site" profiles={profiles} value={id} onPick={setId} />
        <div class="stack"><Seg label="Text to tune" value={kind} options={[['light', 'Dark text on light'], ['dark', 'Light text on dark']]} onChange={setKind} />
          <TuningSliders value={p[kind]} onChange={(t) => setProfiles((all) => all.map((x) => (x.id === id ? { ...x, [kind]: t } : x)))} /></div>
        <div class="row"><button type="button" class="btn" onClick={() => setProfiles(structuredClone(PRESETS))}>Reset looks</button></div>
      </div>
      <div class={'paper ' + kind}>
        <div class="paperbar"><span>Point at any word, or type</span><Seg label="Text size" value={size} options={[['14', '14 px'], ['16', '16 px'], ['20', '20 px']]} onChange={setSize} /></div>
        <div class="loupes">
          <figure><figcaption>Without Fringeless, enlarged</figcaption><Loupe word={word} kind={kind} profile={null} /></figure>
          <figure><figcaption>With Fringeless ({p.name}), enlarged</figcaption><Loupe word={word} kind={kind} profile={p} /></figure>
        </div>
        <div class={'copies' + (both ? '' : ' one')}>
          <div class="copy-l" hidden={!both}><p class="tagline">Without, actual size</p>{copy(plain, 'Sample text without Fringeless, editable')}</div>
          <Scoped id="live" profile={p} class={both ? 'gray' : ''}><p class="tagline">With Fringeless, actual size</p>{copy(fixed, 'Sample text with Fringeless, editable')}</Scoped>
        </div>
      </div>
    </div>
  </div></section>;
}
