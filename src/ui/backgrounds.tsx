import type { ComponentChildren } from 'preact';

/** Common page backgrounds, with the text color sites usually put on them. */
export const BACKGROUNDS = [
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
export const isDarkBg = (hex: string) => luminance(hex) < 0.179;
export type Background = (typeof BACKGROUNDS)[number];
/** CSS variables the samples read their colors from. */
export const paint = (b: Background) => `--eye-bg:${b.bg};--eye-fg:${b.fg}`;

/** Round buttons for common backgrounds, plus one that opens the color picker. */
export function Swatches({ value, onChange }: { value: Background; onChange: (b: Background) => void }): ComponentChildren {
  const custom = !BACKGROUNDS.some((b) => b.bg === value.bg);
  return (
      <div class="swatches" role="radiogroup" aria-label="Background">
        {BACKGROUNDS.map((b) => <button type="button" role="radio" aria-checked={b.bg === value.bg} aria-label={b.name} title={b.name} class="swatch" style={`--sw:${b.bg};--sw-fg:${b.fg}`} onClick={() => onChange(b)}><span aria-hidden="true">Aa</span></button>)}
        <label class={'swatch pick' + (custom ? ' on' : '')} title="Any color" style={custom ? `--sw:${value.bg};--sw-fg:${value.fg}` : ''}>
          <input type="color" aria-label="Any background color" value={value.bg} onInput={(e) => { const v = e.currentTarget.value; onChange({ name: 'Custom', bg: v, fg: isDarkBg(v) ? '#ffffff' : '#000000' }); }} />
          <span aria-hidden="true">+</span>
        </label>
        <span class="small muted">{custom ? 'Your color' : value.name}</span>
      </div>
  );
}

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

