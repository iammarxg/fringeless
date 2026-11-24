import type { Env, Os } from './css';
import type { ScreenInfo } from '../settings/resolve';

export function detectEnv(): Env {
  const ua = navigator.userAgent;
  const os: Os = /Windows/.test(ua) ? 'win' : /Mac OS X|Macintosh/.test(ua) ? 'mac' : /Linux|X11|CrOS/.test(ua) ? 'linux' : 'other';
  return { browser: /Firefox\//.test(ua) ? 'firefox' : 'chromium', os };
}

/** Position is in the virtual desktop, which is what tells two same-size screens apart. */
export function screenInfo(): ScreenInfo {
  const s = screen as Screen & { availLeft?: number; availTop?: number };
  return { width: s.width, height: s.height, left: s.availLeft ?? 0, top: s.availTop ?? 0 };
}

/** Chromium draws text on an opaque canvas the same way it draws page text, so colour there means LCD smoothing is on. */
export function lcdTextOn(doc: Document = document): boolean | null {
  try {
    const c = doc.createElement('canvas'); c.width = 120; c.height = 30;
    const x = c.getContext('2d', { alpha: false });
    if (!x) return null;
    x.fillStyle = '#fff'; x.fillRect(0, 0, 120, 30); x.fillStyle = '#000'; x.font = '16px system-ui, sans-serif'; x.fillText('Illiwm HAVE', 4, 20);
    const d = x.getImageData(0, 0, 120, 30).data;
    for (let i = 0; i < d.length; i += 4) if (Math.max(d[i]!, d[i + 1]!, d[i + 2]!) - Math.min(d[i]!, d[i + 1]!, d[i + 2]!) > 12) return true;
    return false;
  } catch { return null; }
}
