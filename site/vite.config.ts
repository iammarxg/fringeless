import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const root = import.meta.dirname, repo = resolve(root, '..');

export default defineConfig({
  root,
  base: process.env.SITE_BASE ?? '/',
  // fonts, panel pictures, icons and theme.js are the extension's own
  publicDir: resolve(repo, 'public'),
  resolve: { alias: { 'wxt/browser': resolve(root, 'src/no-browser.ts') } },
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  build: { outDir: resolve(repo, '.output/site'), emptyOutDir: true, target: 'es2022' },
  server: { fs: { allow: [repo] } },
  plugins: [{
    name: 'social-picture',
    generateBundle() { this.emitFile({ type: 'asset', fileName: 'og.png', source: readFileSync(resolve(repo, 'docs/images/social-preview.png')) }); },
  }],
});
