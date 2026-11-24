import { browser } from 'wxt/browser';
import { clean, type Settings } from './model';

const KEY = 'settings';
export async function load(): Promise<Settings> { return clean((await browser.storage.local.get(KEY))[KEY]); }
export async function save(s: Settings): Promise<void> { await browser.storage.local.set({ [KEY]: clean(s) }); }
export async function update(fn: (s: Settings) => Settings): Promise<Settings> { const s = clean(fn(await load())); await save(s); return s; }
export function watch(fn: (s: Settings) => void): () => void {
  const on = (c: Record<string, { newValue?: unknown }>, area: string) => { if (area === 'local' && c[KEY]) fn(clean(c[KEY].newValue)); };
  browser.storage.onChanged.addListener(on);
  return () => browser.storage.onChanged.removeListener(on);
}
