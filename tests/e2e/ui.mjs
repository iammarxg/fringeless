// Clicks through popup, welcome and settings the way a person would, and checks the page reacts.
import { chromium, firefox, sleep } from './drivers.mjs';
import { serve } from '../../lab/runner/server.mjs';
const server = await serve(8799); let fails = 0, total = 0;
for (const name of (process.argv[2] ?? 'chrome,firefox').split(',')) {
  const check = (l, ok, i = '') => { total++; if (!ok) fails++; console.log(ok ? 'ok  ' : 'FAIL', name.padEnd(8), l, i); };
  const b = name === 'firefox' ? await firefox('.output-test/firefox-mv3') : await chromium('.output-test/chrome-mv3');
  const api = name === 'firefox' ? 'browser' : 'chrome';
  const page = await b.open('http://localhost:8799/page.html?scheme=light'); await sleep(800);
  const cfg = await b.open(b.extPage('options.html')); await sleep(500);
  const S = () => cfg.ev(`(async()=>(await ${api}.storage.local.get('settings')).settings)()`);
  const tabId = await cfg.ev(`(async()=>(await ${api}.tabs.query({})).find(t=>(t.url||'').includes('page.html')).id)()`);
  const alive = () => page.ev(`document.querySelectorAll('fringeless-overlay').length===1||/opacity/.test(getComputedStyle(document.documentElement).filter)||parseFloat(getComputedStyle(document.documentElement).webkitTextStrokeWidth)>0`);
  const click = (p, text) => p.ev(`(()=>{const e=[...document.querySelectorAll('button')].find(x=>x.textContent.includes(${JSON.stringify(text)}));if(!e)return 'missing';e.click();return 'ok'})()`).then(async (r) => { await sleep(700); return r; });
  const slide = (p, i, v) => p.ev(`(()=>{const e=document.querySelectorAll('input[type=range]')[${i}];e.value=${v};e.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`).then(() => sleep(700));
  const pop = await b.open(b.extPage(`popup.html?tab=${tabId}`)); await sleep(900);
  check('popup shows the site', await pop.ev(`document.body.textContent.includes('On for localhost:8799')`), (await pop.ev('document.body.innerText')).slice(0, 80).replace(/\n/g, ' '));
  await click(pop, 'On for'); let s = await S();
  check('popup switch adds an off rule and the page reacts', s.sites[0]?.action === 'off' && !(await alive()), JSON.stringify(s.sites));
  await click(pop, 'Off for'); s = await S(); check('switching back removes the rule', s.sites.length === 0 && (await alive()));
  await click(pop, 'Different look on this site'); await pop.ev(`(()=>{document.querySelector('.look[aria-label=Bold]').click();return 1})()`); await sleep(700); s = await S();
  check('site gets its own look, default unchanged', s.sites[0]?.profileId === 'bold' && s.profileId === 'clean', JSON.stringify(s.sites));
  check('page uses it', (await page.ev(`getComputedStyle(document.getElementById('t16')).webkitTextStrokeWidth`)) !== '0px');
  await slide(pop, 0, 77); s = await S(); check('slider edits that look', [s.profiles.find((p) => p.id === 'bold').dark.thickness, s.profiles.find((p) => p.id === 'bold').light.thickness].includes(77));
  await click(pop, 'Different look on this site'); s = await S(); check('own look removed', s.sites.length === 0);
  const openSel = (pg, label) => pg.ev(`(()=>{const e=document.querySelector('.select .trigger[aria-label^="${label}"]');e.scrollIntoView({block:'center'});e.click();return 1})()`).then(() => sleep(500));
  const pickOpt = (pg, text) => pg.ev(`(()=>{const e=[...document.querySelectorAll('.select li')].find(x=>x.textContent===${JSON.stringify(text)});if(!e)return 'missing';e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}));return 'ok'})()`).then(async (r) => { await sleep(900); return r; });
  await openSel(pop, 'Pause');
  const flip = await pop.ev(`(()=>{const t=document.querySelector('.select .trigger.open');const m=document.querySelector('.select .menu').getBoundingClientRect();return {exp:t?.getAttribute('aria-expanded'),rot:getComputedStyle(t.querySelector('.chev')).transform,inside:m.top>=0&&m.bottom<=innerHeight&&m.left>=0&&m.right<=innerWidth}})()`);
  check('dropdown opens, arrow flips, menu stays inside the popup', flip.exp === 'true' && /matrix\(-1/.test(flip.rot) && flip.inside, JSON.stringify(flip));
  check('option found', (await pickOpt(pop, 'This tab')) === 'ok');
  check('pause this tab', !(await alive())); await click(pop, 'Off for'); check('popup switch clears the tab pause', await alive());
  // height: browsers cap popups at 600px
  const height = () => pop.ev(`Math.ceil(document.querySelector('main').getBoundingClientRect().height)`);
  const normal = await height(); check('popup fits with room to spare', normal <= 520, normal + 'px');
  const wide = await pop.ev(`(()=>{const m=document.querySelector('main').getBoundingClientRect();return [...document.querySelectorAll('main *')].filter(e=>!e.closest('svg')&&e.getBoundingClientRect().right>m.right+0.5).length})()`); check('nothing sticks out sideways', wide === 0, String(wide));
  const six = structuredClone((await S()).profiles); six.push({ ...six[0], id: 'x1', name: 'A rather long custom name' }, { ...six[0], id: 'x2', name: 'Night' });
  const prof = (p) => cfg.ev(`(async()=>{const s=(await ${api}.storage.local.get('settings')).settings;await ${api}.storage.local.set({settings:{...s,profiles:${JSON.stringify(p)}}});return 1})()`).then(() => sleep(700));
  await prof(six); if (name !== 'firefox') { await click(pop, 'Check this page'); await sleep(2500); }
  const worst = await height(); check('popup fits in the worst case', worst <= 600, worst + 'px');
  await prof([...six, { ...six[0], id: 'x3', name: 'Seven' }]); check('many looks become a dropdown', await pop.ev(`!!document.querySelector('.select .trigger[aria-label^="Look"]')&&document.querySelector('main').getBoundingClientRect().height<=600`));
  await prof(six.slice(0, 4));
  const wel = await b.open(b.extPage('welcome.html')); await sleep(700);
  await click(wel, 'WOLED RWBG'); s = await S(); check('panel pictures load', await wel.ev(`[...document.querySelectorAll('img.pic')].length>=8&&[...document.querySelectorAll('img.pic')].every(i=>i.naturalWidth>100)`));
  check('welcome saves the panel', s.panel === 'woled-rwbg');
  await click(wel, 'RGB stripe'); s = await S(); check('RGB stripe leaves smoothing alone', s.profiles.find((p) => p.id === 'clean').smoothing === 'native' && !(await alive()));
  await click(wel, 'WOLED RWBG'); check('and back', await alive());
  // camera check: each answer leads to the right layout
  await click(wel, 'Start the check');
  check('check pictures load', await wel.ev(`[...document.querySelectorAll('.test img')].length===3&&[...document.querySelectorAll('.test img')].every(i=>i.naturalWidth>100)`));
  const walk = async (...steps) => { for (const t of steps) if ((await click(wel, t)) !== 'ok') return 'missing ' + t; const p = (await S()).panel; await click(wel, 'Start over'); return p; };
  const res = await wel.ev('[Math.round(screen.width*devicePixelRatio),Math.round(screen.height*devicePixelRatio)]');
  check('white stripe, RWBG', (await walk('A white stripe', 'RWBG1440p')) === 'woled-rwbg');
  check('white stripe, RGWB', (await walk('A white stripe', 'RGWB1440p')) === 'woled-rgwb');
  check('three stripes -> RGB', (await walk('Red, green and blue stripes')) === 'rgb');
  if (res[0] === 2560) check('dots on 1440p -> QD-OLED 27"', (await walk('Green dots above')) === 'qd-27-1440');
  check('cannot tell -> not sure', (await walk('I cannot tell')) === 'unknown');
  // a known model is never overruled silently
  await cfg.ev(`(async()=>{const s=(await ${api}.storage.local.get('settings')).settings;await ${api}.storage.local.set({settings:{...s,screens:[{id:'m',name:'XG27AQDMGR',match:{width:screen.width,height:screen.height,left:null,top:null},enabled:true,panel:'woled-rwbg',profileId:null}]}});return 1})()`); await sleep(700);
  await click(wel, 'A white stripe');
  check('white stripe on a known WOLED keeps its layout', (await S()).screens[0].panel === 'woled-rwbg' && (await wel.ev(`document.querySelector('.test').innerText.includes('Your layout is WOLED RWBG')`)));
  await click(wel, 'Start over'); await click(wel, 'Red, green and blue stripes');
  check('conflict with a known model asks first', (await S()).screens[0].panel === 'woled-rwbg' && (await wel.ev(`document.querySelector('.test').innerText.includes('listed as WOLED RWBG')`)));
  await click(wel, 'Keep WOLED RWBG'); check('keeping the list keeps it', (await S()).screens[0].panel === 'woled-rwbg');
  await click(wel, 'Start over'); await click(wel, 'I cannot tell'); check('cannot tell keeps a known model', (await S()).screens[0].panel === 'woled-rwbg'); await click(wel, 'Start over');
  await click(wel, 'Red, green and blue stripes'); await click(wel, 'Use RGB stripe'); check('but can be overruled on purpose', (await S()).screens[0].panel === 'rgb');
  await cfg.ev(`(async()=>{const s=(await ${api}.storage.local.get('settings')).settings;await ${api}.storage.local.set({settings:{...s,screens:[]}});return 1})()`); await sleep(700);
  await click(wel, 'WOLED RWBG');
  await cfg.ev(`(()=>{location.hash='screens';location.reload();return 1})()`); await sleep(1500);
  const o = await b.open(b.extPage('options.html#screens')); await sleep(700);
  await click(o, 'Add this screen'); s = await S(); check('screen added from settings', s.screens.length === 1 && s.screens[0].match.width > 0);
  await click(o, 'Fringeless runs on this screen'); check('turning the screen off reaches the page', !(await alive()));
  await click(o, 'Remove'); check('removing it turns the page back on', await alive());
  // keyboard on a dropdown
  await o.ev(`(()=>{const t=document.querySelector('.select .trigger[aria-label^="Default panel"]');t.focus();for(const k of ['Enter','End','Home','ArrowDown','Enter'])t.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true}));return 1})()`); await sleep(300);
  const oneKey = async (k) => { await o.ev(`(()=>{document.querySelector('.select .trigger[aria-label^="Default panel"]').dispatchEvent(new KeyboardEvent('keydown',{key:'${k}',bubbles:true,cancelable:true}));return 1})()`); await sleep(150); };
  await o.ev(`(()=>{document.querySelectorAll('.select .trigger.open').forEach(t=>t.click());return 1})()`); await sleep(200);
  for (const k of ['Enter', 'Home', 'ArrowDown', 'Enter']) await oneKey(k); await sleep(600); s = await S();
  check('dropdown works with the keyboard', s.panel === 'woled-rgwb', s.panel);
  // search
  await o.ev(`(()=>{const e=document.querySelector('input[placeholder*="XG27AQDMG"]');e.value='aw3423dwf';e.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`); await sleep(400);
  await click(o, 'AW3423DWF'); s = await S();
  check('model search sets this screen', s.screens.some((x) => x.panel === 'qd-34' && x.name === 'Dell AW3423DWF'), JSON.stringify(s.screens));
  if (name !== 'firefox') {
    await b.send('Browser.grantPermissions', { permissions: ['windowManagement'], origin: `chrome-extension://${b.extId}` });
    await o.ev(`(()=>{[...document.querySelectorAll('button')].find(x=>x.textContent==='Detect my screens').click();return 1})()`, true); await sleep(1200);
    const txt = await o.ev(`document.querySelector('.found')?.innerText ?? 'nothing'`);
    check('detects and matches the connected screens', /XG27AQDMGR/.test(txt) && /WOLED RWBG/.test(txt) && /LG TVs do not report/.test(txt), txt.replace(/\n+/g, ' / ').slice(0, 260));
    await click(o, 'Use this layout'); s = await S();
    check('detected layout is saved for that screen', s.screens.some((x) => x.panel === 'woled-rwbg'), JSON.stringify(s.screens));
    await o.ev(`(()=>{const d=[...document.querySelectorAll('.found > div')].find(x=>x.textContent.includes('LG TV'));[...d.querySelectorAll('button')].find(x=>x.textContent.includes('off here')).click();return 1})()`); await sleep(700); s = await S();
    check('the TV can be switched off from there', s.screens.some((x) => !x.enabled && x.match.width === 3840), JSON.stringify(s.screens.map((x) => [x.name, x.enabled])));
  } else check('firefox offers search instead of detection', await o.ev(`document.body.innerText.includes('does not share screen names')`));
  // theme
  await o.ev(`(()=>{document.querySelector('.theme button[title=Light]').click();return 1})()`); await sleep(300);
  check('theme switch applies and is remembered', await o.ev(`getComputedStyle(document.body).backgroundColor==='rgb(255, 255, 255)'&&localStorage.getItem('fringeless-theme')==='light'`));
  const l = await b.open(b.extPage('options.html#look'));
  check('theme carries over to other pages', await l.ev(`document.documentElement.dataset.theme==='light'`));
  await l.ev(`(()=>{document.querySelector('.theme button[title="Match system"]').click();return 1})()`); await sleep(700);
  await click(l, 'Duplicate'); s = await S(); check('look duplicated', s.profiles.length === 5 && s.profiles[4].name === 'Clean copy');
  await click(l, 'Delete'); s = await S(); check('look deleted', s.profiles.length === 4);
  check('no errors', b.errors.filter((e) => !/Content-Security/.test(e)).length === 0, b.errors.slice(0, 2).join('|').slice(0, 160));
  await b.close();
}
server.close(); console.log(`${total - fails}/${total} passed`); process.exit(fails ? 1 : 0);
