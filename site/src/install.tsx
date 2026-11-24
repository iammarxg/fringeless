import { useEffect, useState } from 'preact/hooks';
import { safari } from './live';

declare const __VERSION__: string;
const REPO = 'https://github.com/iammarxg/fringeless';
const file = (k: string) => `${REPO}/releases/download/v${__VERSION__}/fringeless-${__VERSION__}-${k}.zip`;
/** Fill these in when a store approves the listing; the page then links there. */
const STORE: Partial<Record<Id, string>> = {};

const BROWSERS = [
  ['chrome', 'Chrome', 'chrome://extensions'], ['edge', 'Edge', 'edge://extensions'], ['brave', 'Brave', 'brave://extensions'], ['opera', 'Opera', 'opera://extensions'],
  ['vivaldi', 'Vivaldi', 'vivaldi://extensions'], ['other', 'Other Chromium', 'chrome://extensions'], ['firefox', 'Firefox', 'about:debugging#/runtime/this-firefox'],
] as const;
type Id = (typeof BROWSERS)[number][0];

export function detect(): Id {
  const u = navigator.userAgent;
  if (/Firefox\//.test(u)) return 'firefox';
  if (/Edg\//.test(u)) return 'edge';
  if (/OPR\//.test(u)) return 'opera';
  if (/Vivaldi/.test(u)) return 'vivaldi';
  if ('brave' in navigator) return 'brave';
  return 'chrome';
}
export const phone = /Android|iPhone|iPad|Mobile/.test(navigator.userAgent);
export const nameOf = (id: Id) => BROWSERS.find((b) => b[0] === id)![1];
export const linkFor = (id: Id) => STORE[id] ?? STORE[id === 'firefox' ? 'firefox' : 'chrome'] ?? file(id === 'firefox' ? 'firefox' : 'chrome');

function Copy({ text }: { text: string }) {
  const [done, set] = useState(false);
  useEffect(() => { if (!done) return; const t = setTimeout(() => set(false), 1600); return () => clearTimeout(t); }, [done]);
  return <button type="button" class="copy" onClick={() => void navigator.clipboard.writeText(text).then(() => set(true)).catch(() => {})}><code>{text}</code><span>{done ? 'Copied' : 'Copy'}</span></button>;
}

export function Install() {
  const [id, setId] = useState<Id>(detect);
  const [, name, url] = BROWSERS.find((b) => b[0] === id)!, ff = id === 'firefox', store = STORE[id];
  return <section class="sect tint" id="install"><div class="wrap">
    <div class="head"><h2>Install</h2><p>All Chromium browsers (version 131 or newer) and Firefox 140 or newer, on Windows, macOS and Linux.{phone ? ' Phones are not supported; open this page on a computer.' : ''}{safari ? ' Safari is not supported.' : ''}</p></div>
    <div class="tabs" role="tablist" aria-label="Browser">{BROWSERS.map(([b, n]) => <button type="button" role="tab" aria-selected={b === id} onClick={() => setId(b)}>{n}</button>)}</div>
    {store ? <a class="btn primary big" href={store}>Get it for {name}</a> : <>
      <ol class="steps">
        <li><h3>Download</h3><a class="btn primary" href={file(ff ? 'firefox' : 'chrome')}>fringeless-{__VERSION__}-{ff ? 'firefox' : 'chrome'}.zip</a>{!ff && <p class="small muted">Unzip it into a folder you will keep.</p>}</li>
        <li><h3>Open this address</h3><Copy text={url} /><p class="small muted">Browsers do not allow links to it.</p></li>
        {ff ? <li><h3>Load the zip</h3><p>Choose <b>Load Temporary Add-on</b> and pick the file. It stays until Firefox closes.</p></li>
          : <li><h3>Load the folder</h3><p>Turn on <b>Developer mode</b>, choose <b>Load unpacked</b>, and pick the folder.</p></li>}
      </ol>
      <p class="muted">Store listings are being prepared. They will install in one click and update on their own.</p>
    </>}
  </div></section>;
}
