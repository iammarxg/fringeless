// The changelog is the only source of release notes. Commands:
//   check            validate CHANGELOG.md and that its newest version matches package.json (used by CI)
//   notes [version]  print one version's notes (used by the release workflow)
//   amo [version]    print those notes as the JSON addons.mozilla.org expects
//   prepare <x.y.z>  move "Unreleased" into a dated version and bump package.json and the lockfile
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const SECTIONS = ['Added', 'Changed', 'Fixed', 'Removed', 'Security'];
const SEMVER = /^\d+\.\d+\.\d+$/;

/** Returns { versions: [{ version, date, body, sections }], errors }. "Unreleased" is the first entry, with date null. */
export function parse(text) {
  const errors = [], versions = [];
  let v = null, s = null, inIntro = true;
  text.replace(/\r/g, '').split('\n').forEach((line, i) => {
    const at = (m) => errors.push(`line ${i + 1}: ${m}`);
    if (line.startsWith('## ')) {
      inIntro = false; s = null;
      const m = /^## \[(Unreleased|\d+\.\d+\.\d+)\](?: - (\d{4}-\d{2}-\d{2}))?$/.exec(line);
      if (!m) { at('use "## [x.y.z] - YYYY-MM-DD" or "## [Unreleased]"'); v = { version: '?', date: null, body: [], sections: {} }; versions.push(v); return; }
      if ((m[1] === 'Unreleased') === Boolean(m[2])) at(m[2] ? 'Unreleased has no date' : 'a version needs a date');
      if (m[2] && Number.isNaN(Date.parse(m[2]))) at('not a real date');
      v = { version: m[1], date: m[2] ?? null, body: [], sections: {} }; versions.push(v); return;
    }
    if (inIntro || /^\[[^\]]+\]: \S+$/.test(line)) return;
    if (line.startsWith('### ')) {
      s = line.slice(4);
      if (!SECTIONS.includes(s)) at(`unknown section "${s}"; use ${SECTIONS.join(', ')}`);
      else if (v.sections[s]) at(`"${s}" appears twice`);
      else if (Object.keys(v.sections).some((x) => SECTIONS.indexOf(x) > SECTIONS.indexOf(s))) at(`"${s}" is out of order`);
      v.sections[s] = [];
    } else if (line.startsWith('- ')) { if (!s) at('an entry needs a section above it'); else v.sections[s].push(line.slice(2)); }
    else if (line.trim() !== '') at('only "### Section" headings and "- entry" lines belong here');
    v.body.push(line);
  });
  if (versions[0]?.version !== 'Unreleased') errors.push('the first entry must be [Unreleased]');
  for (const x of versions) {
    if (x.version !== 'Unreleased' && !Object.keys(x.sections).length) errors.push(`${x.version}: no entries`);
    for (const [k, list] of Object.entries(x.sections)) if (!list.length) errors.push(`${x.version}: "${k}" is empty`);
  }
  const rel = versions.slice(1), num = (x) => x.version.split('.').reduce((a, n) => a * 1000 + Number(n), 0);
  rel.forEach((x, i) => { if (i && num(x) >= num(rel[i - 1])) errors.push(`${x.version}: versions must go from newest to oldest, once each`); });
  return { versions, errors };
}

export const notes = (versions, version) => {
  const v = versions.find((x) => x.version === version);
  if (!v) throw new Error(`CHANGELOG.md has no ${version}`);
  return v.body.join('\n').trim();
};

/** Pure text step of `prepare`. */
export function release(text, version, date, repo) {
  const { versions, errors } = parse(text);
  if (errors.length) throw new Error(errors.join('\n'));
  if (!SEMVER.test(version)) throw new Error('version must look like 1.2.3');
  if (versions.some((v) => v.version === version)) throw new Error(`${version} is already in CHANGELOG.md`);
  if (!Object.keys(versions[0].sections).length) throw new Error('Nothing under [Unreleased]');
  const last = versions[1]?.version;
  let out = text.replace(/\r/g, '').replace('## [Unreleased]\n', `## [Unreleased]\n\n## [${version}] - ${date}\n`);
  out = out.replace(/^\[Unreleased\]: .*$/m, `[Unreleased]: ${repo}/compare/v${version}...HEAD\n[${version}]: ${last ? `${repo}/compare/v${last}...v${version}` : `${repo}/releases/tag/v${version}`}`);
  const bad = parse(out).errors; if (bad.length) throw new Error(bad.join('\n'));
  return out;
}

function main([cmd, arg]) {
  const text = readFileSync('CHANGELOG.md', 'utf8'), pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const { versions, errors } = parse(text);
  if (cmd === 'check') {
    if (versions[1]?.version !== pkg.version) errors.push(`package.json is ${pkg.version} but the newest changelog entry is ${versions[1]?.version}`);
    if (errors.length) { console.error('CHANGELOG.md\n  ' + errors.join('\n  ')); process.exit(1); }
    console.log(`CHANGELOG.md is fine (${pkg.version})`);
  } else if (cmd === 'notes') console.log(notes(versions, arg ?? pkg.version));
  else if (cmd === 'amo') console.log(JSON.stringify({ version: { release_notes: { 'en-US': notes(versions, arg ?? pkg.version).replace(/^### (.*)$/gm, '$1') } } }));
  else if (cmd === 'prepare') {
    writeFileSync('CHANGELOG.md', release(text, arg ?? '', new Date().toISOString().slice(0, 10), pkg.homepage));
    execFileSync('npm', ['version', arg, '--no-git-tag-version', '--allow-same-version'], { stdio: 'inherit', shell: process.platform === 'win32' });
    console.log(`Ready. Commit, push to main, and the release workflow publishes v${arg}.`);
  } else { console.error('check | notes | amo | prepare'); process.exit(1); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
