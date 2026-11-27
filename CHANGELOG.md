# Changelog

All notable changes, newest first. Every entry sits under Added, Changed, Fixed, Removed or Security, in that order. Versions follow [Semantic Versioning](https://semver.org). Release notes are taken from this file automatically.

## [Unreleased]

## [1.1.0] - 2026-11-27

### Added

- Setup now shows the four looks on a full set of text samples (several sizes, light and bold weights, code and links), labelled A to D so you choose by eye. Try them on five common page backgrounds or any color, then fine-tune the one you pick and save it as your own look.
- Save as many looks of your own as you like, put them in any order, and delete the built-in ones you don't use (Bring them back restores them).
- The toolbar popup's own text is now drawn without colored edges too.

### Changed

- Firefox 142 or newer is now required, the first version that understands the add-on's data collection declaration (none collected).

### Security

- The add-on can no longer write HTML markup into its own pages: the unused part of Preact that could do so is removed at build time.

## [1.0.0] - 2026-11-24

### Added

- Removes colored text edges from web pages in Chromium browsers and Firefox.
- Four looks (Clean, Crisp, Bold, Soft), each with separate thickness, contrast and softness for light and dark text, plus your own.
- Rules per site: on, off, or a different look, with wildcards and regular expressions.
- Rules per screen: keep it on for a monitor and off for a TV.
- Screen detection with a list of over 360 OLED models, a model search, and a camera check for the subpixel layout.
- Hold to compare, and Check this page (Chromium), which counts colored edge pixels on your computer.
- Pause for a tab, an hour, or until restart. Keyboard shortcuts.
- Dark and light themes, sync, and backup to a file.
- Experimental layout filter for QD-OLED and custom panels (Chromium, off by default).

[Unreleased]: https://github.com/iammarxg/fringeless/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/iammarxg/fringeless/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/iammarxg/fringeless/releases/tag/v1.0.0
