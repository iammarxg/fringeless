import { findPanel, findProfile, type Profile, type ScreenRule, type Settings, type SiteRule } from './model';
import type { Panel } from '../engine/panels';

export interface ScreenInfo { width: number; height: number; left: number; top: number }
export interface Context { url: string; screen: ScreenInfo; now: number; tab: 'on' | 'off' | null }
export type Reason = 'tab' | 'paused' | 'off' | 'site' | 'screen' | 'scope' | 'on';
export interface Resolved { on: boolean; reason: Reason; profile: Profile; panel: Panel; site: SiteRule | null; screen: ScreenRule | null }

/**
 * Pattern forms: "example.com" (and its subdomains), "*.example.com" (subdomains only),
 * "example.com/docs*" (path with *), "/regex/i" (whole URL).
 */
export function matches(pattern: string, url: string): boolean {
  const p = pattern.trim();
  const re = /^\/(.+)\/([a-z]*)$/.exec(p);
  if (re) { try { return new RegExp(re[1]!, re[2]!.replace(/[gy]/g, '')).test(url); } catch { return false; } }
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  const m = /^(?:[a-z]+:\/\/)?([^/]+)(\/.*)?$/i.exec(p);
  if (!m) return false;
  let host = m[1]!.toLowerCase();
  const path = m[2] ?? '';
  const onlySub = host.startsWith('*.');
  if (onlySub) host = host.slice(2);
  const portGiven = /:\d+$/.test(host);
  const h = portGiven ? u.host.toLowerCase() : u.hostname.toLowerCase();
  const hostOk = onlySub ? h.endsWith('.' + host) : h === host || h.endsWith('.' + host);
  if (!hostOk) return false;
  if (!path || path === '/') return true;
  const rx = new RegExp('^' + path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + (path.endsWith('*') ? '' : '(?:[/?#].*)?') + '$');
  return rx.test(u.pathname + u.search);
}

/** First matching rule wins, so people can order them. */
export const siteRule = (s: Settings, url: string): SiteRule | null => s.sites.find((r) => matches(r.pattern, url)) ?? null;

/** A rule with a position beats one that only matches size. */
export function screenRule(s: Settings, sc: ScreenInfo): ScreenRule | null {
  const size = s.screens.filter((r) => r.match.width === sc.width && r.match.height === sc.height);
  return size.find((r) => r.match.left === sc.left && r.match.top === sc.top && r.match.left !== null)
    ?? size.find((r) => r.match.left === null) ?? null;
}

export function resolve(s: Settings, c: Context): Resolved {
  const site = siteRule(s, c.url), screen = screenRule(s, c.screen);
  const profile = findProfile(s, site?.profileId ?? null) ?? findProfile(s, screen?.profileId ?? null) ?? findProfile(s, s.profileId) ?? s.profiles[0]!;
  const panel = findPanel(s, screen?.panel ?? s.panel);
  const r = (on: boolean, reason: Reason): Resolved => ({ on, reason, profile, panel, site, screen });
  if (c.tab) return r(c.tab === 'on', 'tab');
  if (s.pauseUntil > c.now) return r(false, 'paused');
  if (!s.on) return r(false, 'off');
  if (site?.action === 'off') return r(false, 'site');
  // A screen switched off stays off even for sites that are listed: it exists to protect a TV or a colour-critical display.
  if (screen && !screen.enabled) return r(false, 'screen');
  if (site?.action === 'on') return r(true, 'site');
  return s.scope === 'all' ? r(true, 'on') : r(false, 'scope');
}

/** The pattern the popup's site switch edits. */
export function hostPattern(url: string): string | null {
  try { const u = new URL(url); return /^https?:$/.test(u.protocol) ? u.host.replace(/^www\./, '') : u.protocol === 'file:' ? null : null; } catch { return null; }
}

/** Set the on/off rule for one host, keeping any profile attached to it. */
export function setSite(s: Settings, url: string, action: SiteRule['action']): Settings {
  const pattern = hostPattern(url);
  if (!pattern) return s;
  const i = s.sites.findIndex((r) => r.pattern === pattern);
  const old = i >= 0 ? s.sites[i]! : null;
  const isDefault = (s.scope === 'all' && action === 'on') || (s.scope === 'listed' && action === 'off');
  const rest = s.sites.filter((_, k) => k !== i);
  const rule: SiteRule = { pattern, action: isDefault ? 'inherit' : action, profileId: old?.profileId ?? null };
  // keep a redundant default rule only when a broader rule would otherwise decide
  const broader = rest.find((r) => matches(r.pattern, url) && r.action !== 'inherit');
  if (broader) rule.action = action;
  if (rule.action === 'inherit' && !rule.profileId) return { ...s, sites: rest };
  return { ...s, sites: [rule, ...rest] };
}
