import type { Profile, Tuning } from '../settings/model';

export type Browser = 'chromium' | 'firefox';
export type Os = 'win' | 'mac' | 'linux' | 'other';
export interface Env { browser: Browser; os: Os }

/** Icon fonts draw pictures with letters; thickening them breaks them. */
export const ICONS = 'i[class*="fa-"],.fa,.fas,.far,.fab,[class*="material-icons"],[class*="material-symbols"],[class^="icon-"],[class*=" icon-"],[class*="glyphicon"],.codicon,[class*="octicon"]';
const CODE = 'code,pre,kbd,samp,tt,textarea,[class*="code"],[class*="mono"],.CodeMirror,.cm-editor,.monaco-editor';

const n = (x: number) => String(Math.round(x * 1000) / 1000);
/** 0 for dark text, 1 for light text, with a soft step around mid lightness. `l` is oklch lightness of the element's own colour. */
const isLight = 'clamp(0, (l - .55) * 10, 1)';
const isDark = 'clamp(0, (.65 - l) * 10, 1)';
/** Colour equal to the text colour, with alpha chosen by whether that text is light or dark. */
const byText = (light: number, dark: number) =>
  light === dark && light >= 1 ? 'currentcolor' : `oklch(from currentcolor l c h / calc(alpha * (${isLight} * ${n(light)} + ${isDark} * ${n(dark)})))`;

const MAX_STROKE = 0.6; // px at thickness 100

export function strokeWidth(p: Profile): number { return (Math.max(p.dark.thickness, p.light.thickness) / 100) * MAX_STROKE; }

function tuningRules(p: Profile, env: Env, root: string): string[] {
  const d: Tuning = p.dark, l: Tuning = p.light, out: string[] = [];
  const inherit: string[] = [], each: string[] = [];
  const top = Math.max(d.thickness, l.thickness);
  if (top > 0) {
    inherit.push(`-webkit-text-stroke-width:${n(strokeWidth(p))}px`, 'paint-order:stroke fill');
    each.push(`-webkit-text-stroke-color:${byText(d.thickness / top, l.thickness / top)}`);
  }
  if (d.contrast > 0 || l.contrast > 0) inherit.push(`text-shadow:0 0 0 ${byText(d.contrast / 100, l.contrast / 100)}`);
  if (d.soften > 0 || l.soften > 0) each.push(`-webkit-text-fill-color:oklch(from currentcolor clamp(${n(l.soften * 0.0035)}, l, ${n(1 - d.soften * 0.0028)}) c h)`);
  if (p.spacing) inherit.push(`letter-spacing:${n(p.spacing / 100)}px`);
  if (p.macThin && env.os === 'mac') inherit.push('-webkit-font-smoothing:antialiased', '-moz-osx-font-smoothing:grayscale');
  // Chromium keeps relative colours unresolved while inheriting, so one rule reaches shadow roots too.
  // Firefox resolves them at the root, so it needs a rule on every element (measured in lab/engine-questions).
  if (env.browser === 'chromium') inherit.push(...each.splice(0));
  if (inherit.length) out.push(`${root}{${inherit.join(';')}}`);
  const all = root === 'html' ? ':where(*)' : `:where(${root},${root} *)`;
  if (each.length) out.push(`${all}{${each.join(';')}}`);
  const reset = ['-webkit-text-stroke-width:0', 'text-shadow:none', '-webkit-text-fill-color:currentcolor', 'letter-spacing:normal'].join(';');
  if (inherit.length || each.length) out.push(`:where(${ICONS}),:where(${ICONS})::before{${reset}}`);
  const ex = safeSelector(p.exclude);
  if (ex && (inherit.length || each.length)) out.push(`:where(${ex}),:where(${ex}) *{${reset}}`);
  const font = p.font.replace(/["\\{};<>]/g, '').trim();
  if (font) {
    const skip = [ICONS, 'svg *', ...(p.keepCodeFont ? [CODE, `:is(${CODE}) *`] : []), ...(ex ? [ex] : [])].join(',');
    const scope = root === 'html' ? 'body,body *' : `${root},${root} *`;
    out.push(`:is(${scope}):not(${skip}){font-family:"${font}",system-ui,sans-serif!important}`);
  }
  return out;
}

/** Selectors come from people and imported files: allow selector characters only, so nothing can close the rule. */
export function safeSelector(s: string): string {
  const lines = s.split(/[\n,]+/).map((x) => x.trim()).filter((x) => x && /^[\w\-.#:*>+~\s[\]="'()|^$]+$/.test(x));
  return lines.join(',');
}

export function needsGray(p: Profile, env: Env): boolean { return p.smoothing === 'gray' && env.os !== 'mac'; }

export function buildCss(p: Profile, env: Env, root = 'html'): string {
  const rules = tuningRules(p, env, root);
  // A stroke already makes Firefox drop LCD smoothing; otherwise a no-op root filter does.
  if (env.browser === 'firefox' && root === 'html' && needsGray(p, env) && strokeWidth(p) < 0.01) rules.push('html{filter:opacity(.9999)}');
  if (!rules.length) return '';
  return `@media screen{${rules.join('\n')}}`;
}
