import type { Env } from './engine/css';
import type { Reason, ScreenInfo } from './settings/resolve';

export type TabOverride = 'on' | 'off' | null;
export type ToBackground =
  | { t: 'hello' }
  | { t: 'status'; on: boolean; reason: Reason }
  | { t: 'set-tab'; tabId: number; value: TabOverride }
  | { t: 'sync-now' };
export interface HelloReply { tab: TabOverride; url: string | null }
export type ToContent =
  | { t: 'tab'; value: TabOverride }
  /** native: show the page without us. null: back to normal. */
  | { t: 'preview'; mode: 'native' | null }
  | { t: 'probe' };
export interface ProbeReply { env: Env; screen: ScreenInfo; lcd: boolean | null; on: boolean; reason: Reason; panel: string; profile: string }
