// What does each browser reveal about the display an extension page is on?
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, firefox, sleep } from '../../tests/e2e/drivers.mjs';
const dir = 'lab/.profiles/probe-ext'; mkdirSync(dir, { recursive: true });
const mf = (extra) => JSON.stringify({ manifest_version: 3, name: 'probe', version: '1', ...extra });
writeFileSync(dir + '/p.html', '<!doctype html><title>probe</title>');
writeFileSync(dir + '/manifest.json', mf({ permissions: ['system.display'] }));
for (const exe of ['chrome', 'edge']) {
  const b = await chromium(dir, { exe }); const p = await b.open(b.extPage('p.html')); await sleep(600);
  console.log(exe, 'system.display:', JSON.stringify(await p.ev(`(async()=>{try{return (await chrome.system.display.getInfo()).map(d=>({name:d.name,id:d.id,edid:d.edid,primary:d.isPrimary,bounds:d.bounds,dpi:d.dpiX,modes:d.modes?.length}))}catch(e){return String(e)}})()`)));
  console.log(exe, 'screen here:', JSON.stringify(await p.ev('({w:screen.width,h:screen.height,l:screen.availLeft,t:screen.availTop,ext:screen.isExtended,label:screen.label,dpr:devicePixelRatio,api:typeof getScreenDetails})')));
  await b.send('Browser.grantPermissions', { permissions: ['windowManagement'], origin: `chrome-extension://${b.extId}` }).catch((e) => console.log('grant', e.message));
  console.log(exe, 'getScreenDetails:', JSON.stringify(await p.ev(`(async()=>{try{const d=await getScreenDetails();return d.screens.map(s=>({label:s.label,w:s.width,h:s.height,left:s.left,top:s.top,cur:s===d.currentScreen,dpr:s.devicePixelRatio}))}catch(e){return String(e)}})()`, true)));
  console.log(exe, 'optional?', JSON.stringify(await p.ev(`chrome.runtime.getManifest().permissions`)));
  await b.close();
}
const f = await firefox(null); const fp = await f.open('http://example.com/');
console.log('firefox:', JSON.stringify(await fp.ev('({api:typeof window.getScreenDetails,label:screen.label??null,w:screen.width,h:screen.height,l:screen.availLeft,t:screen.availTop})'))); await f.close();
process.exit(0);
