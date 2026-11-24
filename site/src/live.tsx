import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Applier } from '../../src/engine/apply';
import { lcdTextOn } from '../../src/engine/detect';
import { PANELS } from '../../src/engine/panels';
import { PRESETS, type Profile } from '../../src/settings/model';
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

The quick brown fox jumps over 1,234 lazy dogs, 0O8B, and five boxing wizards. Try Bold for thin light text, Crisp for a little more bite, or Soft if white on black glares.

Click here and type your own.`;

export function Live({ on, setOn, has }: { on: boolean; setOn: (v: boolean) => void; has: boolean }) {
  const [profiles, setProfiles] = useState<Profile[]>(() => structuredClone(PRESETS));
  const [id, setId] = useState('clean');
  const [kind, setKind] = useState<'dark' | 'light'>('light');
  const [size, setSize] = useState<'14' | '16' | '20'>('16');
  const lcd = useMemo(() => (env.browser === 'chromium' && !safari ? lcdTextOn() : null), []);
  const p = profiles.find((x) => x.id === id)!;
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { const t = document.createElement('div'), b = document.createElement('div'); t.className = 'title'; t.textContent = TITLE; b.textContent = SAMPLE; box.current!.replaceChildren(t, b); }, []);
  const state = safari ? 'Safari cannot run Fringeless, but the looks below still show.'
    : has ? 'Fringeless is already running here.'
      : env.os === 'mac' ? 'macOS already draws text in gray, so this switch changes little. The looks still work.'
        : lcd === false ? 'Your browser already draws this page in gray (common at high zoom or with ClearType off), so you may see no change.'
          : lcd ? 'Your browser is using colored smoothing on this page. Look closely at any text, then switch.' : 'Look closely at any text on this page, then switch.';

  return <section class="sect tint" id="try"><div class="wrap">
    <div class="head"><h2>Try it here, without installing</h2><p>This runs the extension’s own engine on this whole page. Nothing is installed or saved.</p></div>
    <div class="livegrid">
      <div class="stack loose controls">
        <Toggle on={on || has} disabled={safari || has} onChange={setOn} label="Fringeless on this page" hint={state} />
        <Looks compact name="site" profiles={profiles} value={id} onPick={setId} />
        <div class="stack"><Seg label="Text to tune" value={kind} options={[['light', 'Dark text on light'], ['dark', 'Light text on dark']]} onChange={setKind} />
          <TuningSliders value={p[kind]} onChange={(t) => setProfiles((all) => all.map((x) => (x.id === id ? { ...x, [kind]: t } : x)))} /></div>
        <div class="row"><button type="button" class="btn" onClick={() => setProfiles(structuredClone(PRESETS))}>Reset looks</button></div>
      </div>
      <Scoped id="live" profile={p} class={'paper ' + kind}>
        <div class="paperbar"><span>{p.name}</span><Seg label="Text size" value={size} options={[['14', '14 px'], ['16', '16 px'], ['20', '20 px']]} onChange={setSize} /></div>
        <div ref={box} class="write" style={`font-size:${size}px`} contentEditable role="textbox" aria-multiline="true" aria-label="Sample text you can edit" spellcheck={false} />
      </Scoped>
    </div>
  </div></section>;
}
