# Store listing text

Copy from here into each store. Pictures are in [images](images). The name and short description come from the package.

| Field | Text |
|---|---|
| Name | Fringeless: Clearer text for OLED screens |
| Short description (132 max) | Removes colored fringes from web text on WOLED and QD-OLED screens, and tunes its weight and contrast per site and per screen. |
| Homepage | https://github.com/iammarxg/fringeless |
| Support | https://github.com/iammarxg/fringeless/issues |
| Privacy policy | https://github.com/iammarxg/fringeless/blob/main/PRIVACY.md |
| License | GPL-3.0-only |
| Language | English |
| Mature content | No |

## Full description

```
Fringeless removes the colored edges around web text on WOLED and QD-OLED monitors, laptops and TVs.

Browsers smooth text for screens whose subpixels run red, green, blue. These panels arrange theirs differently, so the color meant to sharpen a letter lands beside it. Fringeless makes the browser draw the same text without that color, then lets you adjust it until it reads well.

WHAT YOU CAN DO
• Pick a look: Clean removes fringes and nothing else. Crisp, Bold and Soft also change weight or glare. Make your own.
• Adjust thickness, contrast and softness separately for light text on dark and dark text on light.
• Run it everywhere, everywhere except some sites, or only where you choose. Give a site its own look.
• Give each screen its own settings, such as on for your monitor and off for your TV.
• Find your screen's model and subpixel layout from a list of about 400 models.
• Hold a button to compare with the original.
• Pause it, use keyboard shortcuts, sync, and back up to a file.

PRIVATE BY DESIGN
No analytics, no servers, no network requests, no account. It asks before it can change any site, and you can allow only the sites you want. Free and open source under GPL-3.0.

GOOD TO KNOW
• It changes text that pages draw as text. It cannot change browser menus, store pages, the built-in PDF viewer, or text painted into pictures and canvases.
• Edges on icons and photos come from the panel itself and stay.
• On QD-OLED, a milder fringe from the panel's triangular layout remains above and below letters. An experimental layout filter (off by default) targets it in Chromium browsers.
• macOS already draws text without this color. There, only the looks and the layout filter make a difference.
• The biggest effect is on Windows at 100% to 150% scale.

Works in all Chromium browsers (Chrome, Edge, Brave, Opera, Vivaldi and others) and in Firefox.

Not affiliated with any monitor or browser maker.
```

## Chrome Web Store

| Field | Value |
|---|---|
| Category | Functionality & UI |
| Store icon | `icon-128.png` |
| Screenshots | `1-before-after.png`, `2-popup.png`, `3-look.png`, `4-screens.png`, `5-sites.png` |
| Small promo tile | `promo-440x280.png` |
| Marquee promo tile | `promo-1400x560.png` |

Privacy tab:

| Field | Text |
|---|---|
| Single purpose | Makes text on web pages easier to read on OLED screens by removing colored edges and adjusting its weight and contrast. |
| `storage` | Saves the user's settings: looks, rules for sites and screens, and theme. |
| `scripting` | Adds the style that changes how text is drawn, on sites the user allowed. Registered only after the user grants access. |
| `activeTab` | Applies or pauses the style in the current tab when the user opens the popup or uses a shortcut, and takes one picture of the visible tab when the user presses Check this page. The picture is counted on the device and discarded. |
| Host permissions (`<all_urls>`, optional) | Text can need correcting on any site, so the user may allow all sites during setup, or only some. Nothing is granted at install. Page content is not read, stored or sent. |
| Remote code | No, I am not using remote code |
| Data usage | Tick nothing. Tick all three certifications. |

Notes for the reviewer:

```
After installing, the setup page opens. Choose "Turn on for all sites" in step 3 (or use the popup on any page) and accept the browser prompt. The effect is easiest to see on Windows with ClearType on: zoom a screenshot of text with the popup switch off and on. "Detect my screens" asks for the window-management permission only to read the names of connected displays. No account is needed. Source: https://github.com/iammarxg/fringeless
```

## Firefox Add-ons

| Field | Value |
|---|---|
| Summary (250 max) | Removes colored fringes from web text on WOLED and QD-OLED screens, and tunes its weight and contrast per site and per screen. |
| Description | The full description above, without the line about Chromium browsers |
| Category | Appearance |
| Tags | font |
| License | GNU General Public License v3.0 only |
| Platforms | Firefox for desktop (not Android) |
| Source code | Upload `fringeless-x.y.z-sources.zip` and answer Yes to "do you use a bundler" |
| Screenshots | The same five |

Notes for the reviewer:

```
Built with WXT (Vite) and Preact. Build: npm ci && npm run build-for-amo. Output: .output/firefox-mv3. Tested with Node 22 and 24; any OS.

The linter's "Unsafe assignment to innerHTML" is inside Preact (unmodified, from npm), for its dangerouslySetInnerHTML feature, which this add-on does not use.

No data is collected and no network requests are made. Site access is optional and requested during setup. Content is styled only: the add-on adds one style element and, in Firefox, filter: opacity(.9999) on the root element, which makes text draw without LCD smoothing.
```

## Microsoft Edge Add-ons

Use the Chrome package and text. Category: Accessibility. Logo: `icon-300.png`. Tiles and screenshots as for Chrome. Search terms: `oled text`, `text fringing`, `cleartype`, `font rendering`, `qd-oled`.

## Opera Add-ons

Use the Chrome package and text. Its guidelines ask that the name not contain "Opera", which it does not. Reviews can take long; the Chrome Web Store version also installs in Opera.
