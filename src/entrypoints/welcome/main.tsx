import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { browser } from 'wxt/browser';
import '../../ui/theme.css';
import './style.css';
import { Looks, PanelPic, PhotoNote, Specimen, ThemeSwitch, Toggle, Wordmark, useSettings, usePageLook } from '../../ui/components';
import { DetectScreens } from '../../ui/detect-screens';
import { LayoutTest } from '../../ui/layout-test';
import { PANELS, type Panel } from '../../engine/panels';
import { findPanel, findProfile } from '../../settings/model';
import { screenInfo } from '../../engine/detect';
import { screenRule } from '../../settings/resolve';

const GROUPS: [string, (p: Panel) => boolean][] = [['WOLED', (p) => p.family === 'woled'], ['QD-OLED', (p) => p.family === 'qdoled'], ['Everything else', (p) => p.family === 'rgb' || p.family === 'custom']];

function Welcome() {
  const [s, change] = useSettings();
  const [access, setAccess] = useState(false);
  const [test, setTest] = useState(false);
  const [on, setOn] = useState(true);
  const [hold, setHold] = useState(false);
  useEffect(() => { void browser.permissions.contains({ origins: ['<all_urls>'] }).then(setAccess); }, []);
  const rule = s ? screenRule(s, screenInfo()) : null;
  const profile = s ? findProfile(s, s.profileId) : undefined;
  const panel = s ? findPanel(s, rule?.panel ?? s.panel) : undefined;
  // the pattern has to reach the screen untouched while someone looks at it through a camera
  usePageLook(profile && test ? { ...profile, filter: { ...profile.filter, on: false } } : profile, panel, on && !hold);
  if (!s || !profile || !panel) return null;

  const smoothing = (id: string) => change((v) => ({ ...v, profiles: v.profiles.map((p) => (p.id === 'clean' ? { ...p, smoothing: id === 'rgb' ? 'native' : 'gray' } : p)) }));
  const pickPanel = (id: string) => { change((v) => { const r = screenRule(v, screenInfo()); return { ...v, panel: id, screens: r ? v.screens.map((x) => (x === r ? { ...x, panel: id } : x)) : v.screens }; }); smoothing(id); };
  const grant = async () => { if (await browser.permissions.request({ origins: ['<all_urls>'] })) { setAccess(true); change((v) => ({ ...v, onboarded: true, scope: 'all', on: true })); } };
  const later = () => change((v) => ({ ...v, onboarded: true, scope: 'listed' }));

  return <main>
    <header class="stack">
      <div class="row between"><h1><Wordmark on={on && !hold} /></h1><ThemeSwitch /></div>
      <p class="lede">Your OLED does not arrange its colors the way browsers expect, so text gets colored edges. Fringeless removes them and lets you tune how text looks.</p>
      <div class="preview"><Toggle on={on} onChange={setOn} label="Preview on this page" /></div>
    </header>

    <section class="stack loose">
      <div class="stack"><h2>1. Which screen are you using?</h2><DetectScreens s={s} change={change} onPicked={smoothing} /></div>
      {GROUPS.map(([name, fits]) => <div class="stack"><h3>{name}</h3>
        <div class="cards" role="radiogroup" aria-label={name}>{PANELS.filter(fits).map((p) => <button type="button" class="card" role="radio" aria-checked={p.id === panel.id} onClick={() => pickPanel(p.id)}>
          <PanelPic panel={p} /><span class="text"><strong>{p.name}</strong><span class="small muted">{p.examples}</span></span>
        </button>)}</div></div>)}
      <PhotoNote />
      {panel.family === 'rgb' && <p>This layout matches what browsers expect, so Fringeless leaves smoothing alone here. You can still tune weight and contrast.</p>}
      <div class="stack"><div class="row between"><h3>Still not sure? Check with your phone camera</h3><button type="button" class="btn" aria-expanded={test} onClick={() => setTest(!test)}>{test ? 'Hide the check' : 'Start the check'}</button></div>
        {!test && <p class="small muted">You can skip this. “Not sure” removes fringes the same way; the exact layout only matters for the experimental layout filter.</p>}
        {test && <LayoutTest s={s} onPick={pickPanel} />}</div>
    </section>

    <section class="stack">
      <h2>2. Choose how text should look</h2>
      <p class="muted">There is no correct answer. Pick what reads easiest to you; everything can be adjusted later.</p>
      <Looks name="welcome" profiles={s.profiles} value={s.profileId} onPick={(id) => change((v) => ({ ...v, profileId: id }))} />
      <Specimen profile={hold || !on ? null : profile} onHold={setHold} />
    </section>

    <section class="stack">
      <h2>3. Turn it on</h2>
      {access ? <><p>Fringeless is on. Open any site, and use the toolbar button to adjust or switch it off there.</p><div class="row"><button class="btn primary" onClick={() => { void browser.runtime.openOptionsPage(); }}>Open settings</button></div></>
        : <><p>To change text, Fringeless needs access to the sites you visit. It has no servers and makes no network requests; nothing you read leaves your computer.</p>
          <div class="row"><button class="btn primary" onClick={() => void grant()}>Turn on for all sites</button><button class="btn" onClick={later}>I will choose sites one by one</button></div>
          {s.scope === 'listed' && s.onboarded && <p role="status">Done. On a site you want, click the Fringeless toolbar button and turn it on there.</p>}</>}
    </section>
  </main>;
}

render(<Welcome />, document.getElementById('app')!);
