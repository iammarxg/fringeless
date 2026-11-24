// Each technique is page-level CSS plus optional setup JS.
const SVG = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute"><filter id="fl" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB">${inner}</filter></svg>`;
const ov = (css) => `document.documentElement.append(Object.assign(document.createElement('div'),{id:'fl-ov'}));document.getElementById('fl-ov').style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2147483647;${css}'`;
const svg = (inner) => `document.body.insertAdjacentHTML('beforeend',${JSON.stringify(SVG(inner))})`;
const IDENT = '<feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0"/>';
const CONV = '<feConvolveMatrix order="3" kernelMatrix="0 0 0 0 1 0 0 0 0" divisor="1" preserveAlpha="true" edgeMode="duplicate"/>';
const LEAF = 'p,li,td,th,dt,dd,h1,h2,h3,h4,h5,h6,a,span,label,button,code,pre,blockquote,figcaption,summary,div,input,textarea';

export const techniques = {
  base: {},
  // root, filter family
  'html filter brightness(1)': { css: 'html{filter:brightness(1)!important}' },
  'html filter opacity(1)': { css: 'html{filter:opacity(1)!important}' },
  'html filter opacity(.9999)': { css: 'html{filter:opacity(.9999)!important}' },
  'html filter blur(0)': { css: 'html{filter:blur(0)!important}' },
  'html filter blur(.001px)': { css: 'html{filter:blur(.001px)!important}' },
  'html filter grayscale(0)': { css: 'html{filter:grayscale(0)!important}' },
  'html filter drop-shadow 0': { css: 'html{filter:drop-shadow(0 0 0 transparent)!important}' },
  'html filter svg matrix': { css: 'html{filter:url(#fl)!important}', js: svg(IDENT) },
  'html filter svg convolve': { css: 'html{filter:url(#fl)!important}', js: svg(CONV) },
  'body filter brightness(1)': { css: 'body{filter:brightness(1)!important}' },
  'body filter svg convolve': { css: 'body{filter:url(#fl)!important}', js: svg(CONV) },
  // root, compositing family
  'html opacity .999': { css: 'html{opacity:.999!important}' },
  'body opacity .999': { css: 'body{opacity:.999!important}' },
  'html will-change opacity': { css: 'html{will-change:opacity!important}' },
  'body will-change opacity': { css: 'body{will-change:opacity!important}' },
  'html will-change transform': { css: 'html{will-change:transform!important}' },
  'body will-change transform': { css: 'body{will-change:transform!important}' },
  'body will-change transform + bg none': { css: 'body{will-change:transform!important;background:transparent!important}' },
  'html will-change filter': { css: 'html{will-change:filter!important}' },
  'html mask': { css: 'html{mask-image:linear-gradient(#000,#000)!important}' },
  'body mask': { css: 'body{mask-image:linear-gradient(#000,#000)!important}' },
  'html rotate 1e-4': { css: 'html{rotate:.0001deg!important}' },
  'html mix-blend multiply': { css: 'html{mix-blend-mode:multiply!important}' },
  'body mix-blend darken': { css: 'body{mix-blend-mode:darken!important}' },
  // overlays
  'overlay backdrop brightness(1)': { js: ov('backdrop-filter:brightness(1)') },
  'overlay backdrop blur(0)': { js: ov('backdrop-filter:blur(0)') },
  'overlay backdrop blur(.001px)': { js: ov('backdrop-filter:blur(.001px)') },
  'overlay backdrop svg convolve': { js: svg(CONV) + ';' + ov('backdrop-filter:url(#fl)') },
  'overlay blend multiply': { js: ov('background:#fff;mix-blend-mode:multiply') },
  // R2: minimal-area variants of the Chromium lead
  'R2 ov svg matrix full': { js: svg(IDENT) + ';' + ov('backdrop-filter:url(#fl)') },
  'R2 ov svg conv 1px': { js: svg(CONV) + ';' + ov('inset:0 auto auto 0;width:1px;height:1px;backdrop-filter:url(#fl)') },
  'R2 ov svg conv 0px': { js: svg(CONV) + ';' + ov('inset:0 auto auto 0;width:0;height:0;backdrop-filter:url(#fl)') },
  'R2 ov svg conv 1px offscreen': { js: svg(CONV) + ';' + ov('inset:-9px auto auto -9px;width:1px;height:1px;backdrop-filter:url(#fl)') },
  'R2 ov svg conv hidden': { js: svg(CONV) + ';' + ov('visibility:hidden;backdrop-filter:url(#fl)') },
  'R2 ov svg conv opacity0': { js: svg(CONV) + ';' + ov('opacity:0;backdrop-filter:url(#fl)') },
  'R2 ov svg conv clip0': { js: svg(CONV) + ';' + ov('clip-path:inset(0 0 100% 0);backdrop-filter:url(#fl)') },
  'R2 ov blur .1px full': { js: ov('backdrop-filter:blur(.1px)') },
  'R2 ov blur 1px 1px': { js: ov('inset:0 auto auto 0;width:1px;height:1px;backdrop-filter:blur(1px)') },
  'R2 html svg offset0': { css: 'html{filter:url(#fl)!important}', js: svg('<feOffset dx="0" dy="0"/>') },
  'R2 html svg flood-merge': { css: 'html{filter:url(#fl)!important}', js: svg('<feMerge><feMergeNode in="SourceGraphic"/></feMerge>') },
  'R2 html svg empty-ish': { css: 'html{filter:url(#fl)!important}', js: svg('<feComponentTransfer/>') },
  'R2 html filter dataurl': { css: `html{filter:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='fl' color-interpolation-filters='sRGB'%3E%3CfeOffset/%3E%3C/filter%3E%3C/svg%3E#fl")!important}` },
  'R2 html filter blur .1px': { css: 'html{filter:blur(.1px)!important}' },
  'R2 html drop-shadow far': { css: 'html{filter:drop-shadow(0 0 1px transparent)!important}' },
  // R2: Firefox inherited stroke
  'R2 stroke .005 transparent': { css: 'html{-webkit-text-stroke:.005px transparent}' },
  'R2 stroke .02 transparent': { css: 'html{-webkit-text-stroke:.02px transparent}' },
  'R2 stroke .01 alpha0 cc': { css: 'html{-webkit-text-stroke:.01px rgb(127 127 127 / 0)}' },
  // inherited text properties (reach shadow DOM without extra work)
  'inherit stroke .001px': { css: 'html{-webkit-text-stroke:.001px currentcolor!important}' },
  'inherit stroke .01px': { css: 'html{-webkit-text-stroke:.01px currentcolor!important}' },
  'inherit stroke .1px': { css: 'html{-webkit-text-stroke:.1px currentcolor!important}' },
  'inherit stroke transparent': { css: 'html{-webkit-text-stroke:.01px transparent!important}' },
  'inherit text-shadow': { css: 'html{text-shadow:0 0 0 transparent!important}' },
  'inherit geometricPrecision': { css: 'html{text-rendering:geometricPrecision!important}' },
  'inherit font-smoothing': { css: 'html{-webkit-font-smoothing:antialiased!important;-moz-osx-font-smoothing:grayscale!important}' },
  'fill alpha .996': { css: '*{-webkit-text-fill-color:color-mix(in srgb,currentcolor 99.6%,transparent)!important}' },
  // scoped to elements
  'leaf opacity .999': { css: `${LEAF}{opacity:.999!important}` },
  'leaf will-change opacity': { css: `${LEAF}{will-change:opacity!important}` },
  'leaf filter': { css: `${LEAF}{filter:opacity(1)!important}` },
  'leaf backface': { css: `${LEAF}{backface-visibility:hidden!important}` },
  'body>* opacity .999': { css: 'body>*{opacity:.999!important}' },
  'body>* will-change opacity': { css: 'body>*{will-change:opacity!important}' },
};
export const ZONES = ['t11', 't13', 't16', 't20', 't32', 'light', 'bold', 'code', 'nested', 'link', 'inp', 'ta', 'fixed', 'sticky', 'scroller', 'card', 'glass', 'comp', 'shadow', 'if1', 'if2', 'img', 'cv'];
export const NEUTRAL = ZONES.filter((z) => !['link', 'img', 'cv'].includes(z));
