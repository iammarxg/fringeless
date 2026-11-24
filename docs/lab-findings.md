# Lab findings (2026-11-24)

Windows 11, ClearType on. Chrome 158.0.8127.37, Edge 158.0.4370.33, Firefox 157.0.1. Throwaway profiles.
Captures are lossless pixels of the lab's own window (PrintWindow). Firefox's screenshot API was avoided on purpose: it may re-rasterize instead of reading what was composited.
Score = pixels with visible color (channel spread > 8) across 20 zones of neutral text, before -> after.

## Can an extension remove LCD (ClearType) color from page text? Yes.

| Browser | Technique | Scale 100% light | 125 / 150 / 200% | Images | Layout / fixed / sticky | Scroll |
|---|---|---|---|---|---|---|
| Chrome, Edge | `opacity:0` full-page overlay, `backdrop-filter:url(#svg)` identity | 20394 -> 883 | 95-96% removed (Chrome) | identical | unchanged | same frame times; GPU 2.85% vs 2.92% baseline |
| Firefox | `html{filter:opacity(.9999)}` | 15918 -> 0 | 0 | identical | unchanged | same frame times; GPU 3.83% vs 2.3% |
| Firefox | `html{-webkit-text-stroke:.01px transparent}` (inherited) | 15918 -> 0 | 0 | identical | unchanged | same frame times; GPU 3.33% vs 2.3% |

- The 883 left in Chromium are all in the cross-origin iframe; the extension's own content script runs there too.
- Edge was checked at 100% only. Dark pages gave the same result everywhere.
- Chromium overlay also covers modal dialogs, popovers and late-added text, and works under a strict CSP when the SVG filter is in the document. Data-URL filters are blocked by CSP, and root `filter` misses dialogs, so neither is used.
- Firefox dialog/popover and CSP cases were **inconclusive**: that page was already gray at baseline.
- Firefox stroke changes glyph ink slightly (path rendering); `opacity(.9999)` barely does. Default: opacity, stroke as alternative.
- Not usable: `-webkit-font-smoothing`, `text-rendering`, text shadow, brightness/blur-style root filters (Chromium), `will-change` and body filters (break `position:fixed` or leave areas), 1px or hidden overlays (partial or no effect).
- Untested: macOS, Linux, fullscreen video, HDR, real sites, canvas text (cannot be affected).

## Does it help on each layout? (simulation, not a real panel)

S-CIELAB color error, lower is better, 110 PPI at 60 cm. Average of 13 and 16 px text.

| Panel | Text | ClearType | Grayscale | Best filter tried on grayscale |
|---|---|---|---|---|
| WOLED RWBG | white on black | 4.54 | 1.61 | 1.52 (0.2) |
| WOLED RWBG | black on white | 2.59 | 1.67 | none better |
| WOLED RGWB | white on black | 3.81 | 1.29 | none better |
| WOLED RGWB | black on white | 2.43 | 1.62 | 1.59 (0.2) |
| QD-OLED 27" 1440p | white on black | 5.07 | 3.54 | 2.35 (0.9) |
| QD-OLED 27" 1440p | black on white | 3.17 | 2.78 | 1.52 (0.9) |

- WOLED: grayscale does nearly all the work; a layout filter adds nothing worth its cost.
- QD-OLED: grayscale alone is a partial fix; the layout filter is where the real gain is.
- Lightness error barely differs (within ~6%), except strong WOLED filtering.
- Caveat: the model also scores grayscale below ClearType in color on an ordinary RGB stripe (1.84 vs 3.65), so part of the gain is ClearType's own color, not layout mismatch. The model ignores the panel's real RGB-to-RGBW conversion (two white-share values averaged).

## Reproduce

`node lab/runner/run.mjs --browsers=chrome,edge,firefox --dpr=1 --out=matrix-dpr1`, `node lab/runner/edge-cases.mjs`, `node lab/runner/perf.mjs`, `python -I lab/panel-sim/sim.py`. Windows only (Python + Pillow + numpy). Note: the first full run's Edge rows are contaminated by a first-run dialog; use `matrix-r2.json` for Edge.
