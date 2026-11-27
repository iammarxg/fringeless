import { defineConfig } from 'wxt';

// FRINGELESS_TEST=1 makes site access a required permission so automated tests need no permission prompt. Never ship it.
const TEST = process.env.FRINGELESS_TEST === '1';

// Preact can write raw HTML through its dangerouslySetInnerHTML prop. Fringeless never uses it, so the build removes
// that one assignment: the store linter flags it, and no page HTML should ever be written as markup by the add-on.
const PREACT_HTML = '(t.innerHTML=h.__html)';
function noInnerHtml() {
  return {
    name: 'fringeless-no-inner-html',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (!/[\\/]preact[\\/]dist[\\/]preact\.mjs/.test(id)) return;
      if (!code.includes(PREACT_HTML)) throw new Error('Preact changed: update noInnerHtml in wxt.config.ts');
      return { code: code.replace(PREACT_HTML, 'void 0'), map: null };
    },
  };
}

export default defineConfig({
  srcDir: 'src',
  outDir: TEST ? '.output-test' : '.output',
  manifestVersion: 3,
  imports: false,
  zip: { excludeSources: ['lab/captures/**', 'lab/.profiles/**', 'lab/results/**', '.output-test/**', 'docs/**', 'store/**', 'site/**', 'tools/images/**', '.github/**', 'store-upload/**', 'promo/**', '.claude/**', '.output-site/**'] },
  vite: () => ({ oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } }, plugins: [noInnerHtml()] }) as never,
  manifest: ({ browser }) => ({
    name: 'Fringeless: Clearer text for OLED screens',
    short_name: 'Fringeless',
    description: 'Removes colored fringes from web text on WOLED and QD-OLED screens, and tunes its weight and contrast per site and per screen.',
    homepage_url: 'https://github.com/iammarxg/fringeless',
    permissions: ['storage', 'scripting', 'activeTab'],
    ...(TEST ? { host_permissions: ['<all_urls>'] } : { optional_host_permissions: ['<all_urls>'] }),
    action: { default_title: 'Fringeless' },
    icons: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' },
    commands: {
      'toggle-site': { suggested_key: { default: 'Alt+Shift+F' }, description: 'Turn Fringeless on or off for this site' },
      'toggle-tab': { suggested_key: { default: 'Alt+Shift+C' }, description: 'Compare: switch Fringeless in this tab only' },
      'toggle-all': { description: 'Turn Fringeless on or off everywhere' },
    },
    ...(browser === 'firefox'
      ? { browser_specific_settings: { gecko: { id: '{6f1c2f0a-5a0e-4f43-9d39-0b6a8e0c7d51}', strict_min_version: '142.0', data_collection_permissions: { required: ['none'] } } } as never }
      : { minimum_chrome_version: '131' }),
  }),
});
