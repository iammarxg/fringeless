# Contributing

The most useful help is a [screen report](https://github.com/iammarxg/fringeless/issues/new?template=screen_report.yml): which panel you have and how text looks with Fringeless on and off.

## Commands

| Command | Does |
|---|---|
| `npm ci` | Installs exact versions |
| `npm run dev` | Live-reloading build |
| `npm run check` | Types and changelog format |
| `npm test` | Unit tests |
| `npm run e2e`, `npm run e2e:more` | Drives the built extension in installed Chrome, Edge and Firefox (Windows; Python with Pillow) |
| `npm run zip` | Store packages |
| `npm run images` | README and store pictures (after `npm run e2e:build`) |
| `npm run lab` | Compares techniques; see [docs/lab-findings.md](docs/lab-findings.md) |

Builds made with `FRINGELESS_TEST=1` ask for site access at install. They go to `.output-test` and must never be shipped.

## Layout

| Folder | Holds |
|---|---|
| `src/engine` | How text is changed, panel layouts, the layout filter |
| `src/settings` | Settings model, and which rule wins |
| `src/data` | Monitor models |
| `src/ui`, `src/entrypoints` | Popup, settings, setup page, background |
| `tests`, `lab` | Unit and browser tests; technique measurements and panel simulation |
| `store`, `tools` | Store listings; release and image scripts |

## Changelog and releases

1. Add a line to `CHANGELOG.md` under `## [Unreleased]`, in one of these sections and in this order: **Added, Changed, Fixed, Removed, Security**. Write it for the person using the extension. CI rejects anything else.
2. To release, run `npm run release -- 1.2.0`. It dates the section and bumps the version. Commit and push to `main`.
3. The release workflow tests, builds, tags, and publishes the GitHub release with notes from the changelog. It then submits to every store that is connected. See [store/README.md](store/README.md).

## Adding a monitor

Edit `src/data/monitors.ts` and link a source for the panel type in the pull request, such as a review with a macro photo.

By contributing you agree that your work is released under GPL-3.0.
