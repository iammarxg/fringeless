import { buildCss, needsGray, type Env } from './css';
import { filterElement, filterSpec, type FilterSpec } from './layout-filter';
import type { Panel } from './panels';
import type { Profile } from '../settings/model';

export interface Look { profile: Profile; panel: Panel }

/**
 * Applies one look to one document and can remove every trace of it.
 *
 * Chromium: an invisible full-page overlay with an SVG backdrop filter makes the compositor draw all text under it
 * without LCD (coloured) smoothing; at opacity 0 nothing is painted. Firefox: see buildCss.
 */
export class Applier {
  private css = '';
  private style: HTMLStyleElement | null = null;
  private sheet: CSSStyleSheet | null = null;
  private overlay: HTMLElement | null = null;
  private overlayKey = '';
  private look: Look | null = null;
  private readonly id = 'fl-' + Math.random().toString(36).slice(2, 9);
  private readonly playing = new Set<HTMLVideoElement>();
  private observer: MutationObserver | null = null;
  private repairs = 0;

  constructor(private readonly doc: Document, private readonly env: Env, private readonly topFrame: boolean) {}

  /** A previous copy (extension updated or reloaded) may not have had the chance to clean up. Firefox never gives it one. */
  private sweep(): void {
    for (const e of this.doc.querySelectorAll('fringeless-overlay,style[data-fringeless]')) e.remove();
    try {
      const keep = this.doc.adoptedStyleSheets.filter((x) => ![...x.cssRules].some((r) => r.cssText.includes('fringeless-overlay')));
      if (keep.length !== this.doc.adoptedStyleSheets.length) this.doc.adoptedStyleSheets = keep;
    } catch { /* not readable here */ }
  }

  start(): void {
    this.sweep();
    this.doc.addEventListener('fullscreenchange', this.refresh);
    for (const t of ['play', 'playing', 'pause', 'ended', 'emptied'] as const) this.doc.addEventListener(t, this.onMedia, true);
    // Pages that rebuild <html> (document.open, some frameworks) drop our nodes: put them back, within reason.
    this.observer = new MutationObserver(() => {
      if (!this.look || this.repairs > 40) return;
      if ((this.overlay && !this.overlay.isConnected) || (this.style && !this.style.isConnected)) { this.repairs++; this.reattach(); }
    });
    this.observer.observe(this.doc, { childList: true });
    this.observer.observe(this.doc.documentElement, { childList: true });
  }

  stop(): void {
    this.set(null);
    this.observer?.disconnect();
    this.doc.removeEventListener('fullscreenchange', this.refresh);
    for (const t of ['play', 'playing', 'pause', 'ended', 'emptied'] as const) this.doc.removeEventListener(t, this.onMedia, true);
  }

  set(look: Look | null): void { this.look = look; this.refresh(); }

  readonly refresh = (): void => {
    this.setCss(this.look ? buildCss(this.look.profile, this.env) : '');
    this.setOverlay();
  };

  private readonly onMedia = (e: Event): void => {
    const v = e.target;
    if (!(v instanceof HTMLVideoElement)) return;
    if (e.type === 'play' || e.type === 'playing') this.playing.add(v); else this.playing.delete(v);
    if (this.look?.profile.filter.on) this.setOverlay();
  };

  private videoBusy(): boolean {
    for (const v of this.playing) {
      if (!v.isConnected || v.paused || v.ended) { this.playing.delete(v); continue; }
      const r = v.getBoundingClientRect();
      const w = Math.min(r.right, innerWidth) - Math.max(r.left, 0), h = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
      if (w > 0 && h > 0 && w * h > innerWidth * innerHeight * 0.08) return true;
    }
    return false;
  }

  /** The layout filter runs once, in the top frame: its backdrop already contains child frames. */
  private spec(): FilterSpec | null {
    const l = this.look;
    if (!l || !this.topFrame || !l.profile.filter.on) return null;
    if (l.profile.filter.pauseForVideo && this.videoBusy()) return null;
    return filterSpec(l.panel.offsets, l.profile.filter);
  }

  private setOverlay(): void {
    const l = this.look;
    const spec = this.env.browser === 'chromium' ? this.spec() : null;
    const want = this.env.browser === 'chromium' && !!l && !this.doc.fullscreenElement && (needsGray(l.profile, this.env) || !!spec);
    if (!want) { this.overlay?.remove(); this.overlay = null; this.overlayKey = ''; return; }
    const key = JSON.stringify(spec);
    if (this.overlay?.isConnected && key === this.overlayKey) return;
    this.overlay?.remove();
    const el = this.doc.createElement('fringeless-overlay');
    const set = (k: string, v: string) => el.style.setProperty(k, v, 'important');
    set('all', 'initial'); set('position', 'fixed'); set('inset', '0'); set('display', 'block'); set('pointer-events', 'none');
    set('z-index', '2147483647'); set('opacity', spec ? '1' : '0'); set('backdrop-filter', `url(#${this.id})`);
    el.setAttribute('aria-hidden', 'true');
    const svg = this.doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.style.setProperty('position', 'absolute', 'important');
    svg.append(filterElement(this.doc, this.id, spec));
    el.append(svg);
    this.overlay = el; this.overlayKey = key;
    this.doc.documentElement?.append(el);
  }

  private setCss(css: string): void {
    // Keep the overlay out of print; the rest of our css is already screen-only.
    const full = this.look ? `${css}\n@media print{fringeless-overlay{display:none!important}}` : '';
    if (full === this.css) return;
    this.css = full;
    if (!full) { this.style?.remove(); this.style = null; this.dropSheet(); return; }
    if (this.sheet) { this.sheet.replaceSync(full); return; }
    if (!this.style) { this.style = this.doc.createElement('style'); this.style.dataset.fringeless = ''; }
    this.style.textContent = full;
    if (!this.style.isConnected) this.doc.documentElement?.append(this.style);
    if (!this.style.sheet?.cssRules.length) this.useSheet(full); // a page CSP refused the element
  }

  private useSheet(css: string): void {
    try {
      const S = (this.doc.defaultView as unknown as { CSSStyleSheet: typeof CSSStyleSheet } | null)?.CSSStyleSheet ?? CSSStyleSheet;
      const s = new S(); s.replaceSync(css);
      this.doc.adoptedStyleSheets = [...this.doc.adoptedStyleSheets, s];
      this.sheet = s; this.style?.remove(); this.style = null;
    } catch { /* neither way is available here: smoothing still works through the overlay in Chromium */ }
  }

  private dropSheet(): void {
    if (!this.sheet) return;
    this.doc.adoptedStyleSheets = this.doc.adoptedStyleSheets.filter((s) => s !== this.sheet);
    this.sheet = null;
  }

  private reattach(): void {
    const root = this.doc.documentElement;
    if (!root) return;
    if (this.style && !this.style.isConnected) root.append(this.style);
    if (this.overlay && !this.overlay.isConnected) root.append(this.overlay);
    this.observer?.observe(root, { childList: true });
  }
}
