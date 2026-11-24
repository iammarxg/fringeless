import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JS tool without types
import { body, notes, parse, release } from '../tools/release.mjs';

const REPO = 'https://github.com/o/r';
const ok = `# Changelog

Intro text.

## [Unreleased]

### Fixed

- A bug.

## [1.0.0] - 2026-11-24

### Added

- First.

[Unreleased]: ${REPO}/compare/v1.0.0...HEAD
[1.0.0]: ${REPO}/releases/tag/v1.0.0
`;

describe('changelog', () => {
  it('accepts the fixed format', () => expect(parse(ok).errors).toEqual([]));
  it('returns only one version, without links', () => expect(notes(parse(ok).versions, '1.0.0')).toBe('### Added\n\n- First.'));
  it('links every file in the release text', () => {
    const t = body(parse(ok).versions, '1.0.0', REPO);
    for (const k of ['chrome', 'firefox', 'sources']) expect(t).toContain(`[\`fringeless-1.0.0-${k}.zip\`](${REPO}/releases/download/v1.0.0/fringeless-1.0.0-${k}.zip)`);
  });
  it.each([
    ['unknown section', ok.replace('### Fixed', '### Bugs')],
    ['loose text', ok.replace('- A bug.', 'A bug.')],
    ['missing date', ok.replace(' - 2026-11-24', '')],
    ['wrong order', ok.replace('### Fixed\n\n- A bug.', '### Fixed\n\n- A bug.\n\n### Added\n\n- X')],
    ['empty section', ok.replace('- A bug.', '')],
    ['no Unreleased', ok.replace('## [Unreleased]', '## [1.1.0] - 2026-12-01')],
    ['duplicate version', ok.replace('[Unreleased]: ', '## [1.0.0] - 2026-11-24\n\n### Added\n\n- Again\n\n[Unreleased]: ')],
  ])('rejects %s', (_, text) => expect(parse(text).errors.length).toBeGreaterThan(0));
  it('prepares a version', () => {
    const out = release(ok, '1.1.0', '2026-12-01', REPO), p = parse(out);
    expect(p.errors).toEqual([]);
    expect(p.versions.map((v: { version: string }) => v.version)).toEqual(['Unreleased', '1.1.0', '1.0.0']);
    expect(notes(p.versions, '1.1.0')).toBe('### Fixed\n\n- A bug.');
    expect(out).toContain(`[Unreleased]: ${REPO}/compare/v1.1.0...HEAD\n[1.1.0]: ${REPO}/compare/v1.0.0...v1.1.0`);
  });
  it('refuses a repeated or malformed version, or nothing to release', () => {
    expect(() => release(ok, '1.0.0', '2026-12-01', REPO)).toThrow();
    expect(() => release(ok, 'v2', '2026-12-01', REPO)).toThrow();
    expect(() => release(release(ok, '1.1.0', '2026-12-01', REPO), '1.2.0', '2026-12-01', REPO)).toThrow('Nothing');
  });
});
