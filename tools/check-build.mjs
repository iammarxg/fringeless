// Fails if a package asks for more than it should, carries remote code, or breaks a store's length limit.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const bad = [], version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
for (const b of ['chrome', 'firefox']) {
  const dir = `.output/${b}-mv3`, m = JSON.parse(readFileSync(`${dir}/manifest.json`, 'utf8'));
  const want = (ok, msg) => { if (!ok) bad.push(`${b}: ${msg}`); };
  want(m.version === version, `version ${m.version}, expected ${version}`);
  want(m.permissions.slice().sort().join() === 'activeTab,scripting,storage', `permissions ${m.permissions}`);
  want(!m.host_permissions?.length && !m.content_scripts?.length, 'site access must stay optional');
  want(m.optional_host_permissions?.join() === '<all_urls>', 'optional site access');
  want(m.name.length <= 75 && m.description.length <= 132, 'name or description too long for the stores');
  for (const f of walk(dir)) if (/\.(js|html)$/.test(f)) {
    const t = readFileSync(f, 'utf8');
    want(!/<script[^>]+src=["']https?:/.test(t) && !/\bimport\(\s*["']https?:/.test(t), `${f} loads remote code`);
    want(!/\bnew XMLHttpRequest\b|\bnew WebSocket\(|\bsendBeacon\(|\bEventSource\(/.test(t), `${f} can reach the network`);
  }
}
if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
console.log('Packages are fine.');
