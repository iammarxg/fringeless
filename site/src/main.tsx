import { render } from 'preact';
import { useState } from 'preact/hooks';
import '../../src/ui/theme.css';
import './style.css';
import { ThemeSwitch, Wordmark } from '../../src/ui/components';
import popDark from '../../docs/images/popup-dark.png';
import popLight from '../../docs/images/popup-light.png';
import { Finder } from './finder';
import { Hero, type Layout } from './hero';
import { Install, LATEST, detect, linkFor, nameOf, phone } from './install';
import { Live, safari, useFix } from './live';
import { Pixels } from './pixels';

const REPO = 'https://github.com/iammarxg/fringeless';

function Page() {
  const [layout, setLayout] = useState<Layout>('woled-rwbg');
  const [on, setOn, has] = useFix();
  const me = detect();
  return <>
    <a class="skip" href="#main">Skip to content</a>
    <header class="top wrap">
      <a href="#main" class="brand" aria-label="Fringeless"><Wordmark on={on || has} /></a>
      <nav aria-label="Page"><a href="#try">Try it</a><a href="#monitors">Monitors</a><a href="#install">Install</a><a href={REPO}>GitHub</a></nav>
      <ThemeSwitch remember={false} />
    </header>
    <main id="main">
      <div class="wrap intro">
        <h1>Text without the colored edges</h1>
        <div class="lede">
          <p>Fringeless is a free extension that makes web pages easier to read on WOLED and <span class="nb">QD-OLED</span> screens.</p>
          <div class="row">
            {phone || safari ? <a class="btn primary big" href="#install">How to install</a> : <a class="btn primary big" href={linkFor(me)}>Download for {nameOf(me)}</a>}
            {!safari && !has && <button type="button" class="btn big" aria-pressed={on} onClick={() => setOn(!on)}>{on ? 'Turn it off on this page' : 'Try it on this page'}</button>}
          </div>
        </div>
      </div>
      <Hero layout={layout} setLayout={setLayout} />
      <Pixels />
      <Live on={on} setOn={setOn} has={has} />
      <section class="wrap sect control">
        <div class="pops"><img class="d" src={popDark} width="384" height="471" alt="The Fringeless popup, dark theme" loading="lazy" /><img class="l" src={popLight} width="384" height="471" alt="" loading="lazy" /></div>
        <div class="stack loose">
          <h2>Yours to set, site by site and screen by screen</h2>
          <dl>
            <div><dt>Sites</dt><dd>Run everywhere, everywhere but a few, or only where you choose. Give a site its own look.</dd></div>
            <div><dt>Screens</dt><dd>On for the monitor, off for the TV, untouched on the LCD next to it. ClearType has one setting for all of them.</dd></div>
            <div><dt>Light and dark</dt><dd>White text on black and black text on white need different help, so each has its own thickness, contrast and softness.</dd></div>
            <div><dt>Compare</dt><dd>Hold a button to see the original. In Chromium, <b>Check this page</b> counts colored edge pixels before and after.</dd></div>
            <div><dt>Privacy</dt><dd>No account, analytics, servers or network requests. Allow all sites or only the ones you want.</dd></div>
          </dl>
        </div>
      </section>
      <Finder show={(l) => { setLayout(l); document.querySelector('.sim')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' }); }} />
      <section class="wrap sect limits">
        <h2>What it cannot change</h2>
        <ul>
          <li>Browser menus and tabs, store pages, settings pages and the built-in PDF viewer.</li>
          <li>Text that a site paints into a canvas or a picture, as Google Docs does.</li>
          <li>Edges on icons, photos and colored boxes. Those come from the panel.</li>
          <li>Other programs. On Windows, <a href="https://github.com/bp2008/BetterClearTypeTuner">Better ClearType Tuner</a> and <a href="https://github.com/snowie2000/mactype">MacType</a> cover many of them.</li>
        </ul>
      </section>
      <Install />
    </main>
    <footer class="wrap foot">
      <p>Free and open source under GPL-3.0. Made on a WOLED RWBG monitor; tested on Windows in Chrome, Edge, Brave and Firefox. Not affiliated with any monitor or browser maker.</p>
      <nav aria-label="More"><a href={REPO}>Source</a><a href={LATEST}>Latest release</a><a href={`${REPO}/blob/main/CHANGELOG.md`}>Changelog</a><a href={`${REPO}/blob/main/PRIVACY.md`}>Privacy</a><a href={`${REPO}/issues`}>Report a problem</a></nav>
    </footer>
  </>;
}

render(<Page />, document.getElementById('app')!);
