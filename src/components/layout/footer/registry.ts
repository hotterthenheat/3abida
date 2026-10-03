/*
  WHICH PICTURE A PAGE'S FOOTER SHOWS (components/layout/footer/registry.ts) — 2026-10-03, the owner: "each page had its
  own art work similar to that one but thats representive of its page … and then the landing page one you go into more
  depth". The address picks the scene; the scenes themselves (scenes.ts and its parts) are one chunk of their own, fetched
  the first time a footer is drawn, so no page carries them in its first load.
*/

import type { SceneMaker } from './kit';

export type SceneName =
  | 'landing'
  | 'pulse'
  | 'terrain'
  | 'trace'
  | 'dossier'
  | 'pinpoint'
  | 'compass'
  | 'weigher'
  | 'paper'
  | 'backtest'
  | 'journal'
  | 'alerts'
  | 'settings'
  | 'room'
  | 'status'
  | 'about'
  | 'legal'
  | 'account'
  | 'invite'
  | 'maintenance';

/** the rooms by their addresses (App.tsx), the pages outside the terminal by theirs */
const BY_PATH: [RegExp, SceneName][] = [
  [/^\/pulse/, 'pulse'],
  [/^\/terrain/, 'terrain'],
  [/^\/trace/, 'trace'],
  [/^\/(dossier|record)/, 'dossier'],
  [/^\/pinpoint/, 'pinpoint'],
  [/^\/compass/, 'compass'],
  [/^\/weigher/, 'weigher'],
  [/^\/practice\/backtest/, 'backtest'],
  [/^\/practice\/journal/, 'journal'],
  [/^\/practice/, 'paper'],
  [/^\/alerts/, 'alerts'],
  [/^\/settings/, 'settings'],
  [/^\/community/, 'room'],
  [/^\/status/, 'status'],
  [/^\/about/, 'about'],
  [/^\/legal/, 'legal'],
  [/^\/(signup|signin|reset|verified|expired)/, 'account'],
  [/^\/(i\/|welcome)/, 'invite'],
  [/^\/maintenance/, 'maintenance'],
];

export const sceneFor = (pathname: string): SceneName => BY_PATH.find(([re]) => re.test(pathname))?.[1] ?? 'pulse';

let chunk: Promise<Record<SceneName, SceneMaker>> | null = null;
/** the scene's maker, once the scenes' chunk is in (asked for again after a failed fetch) */
export const loadScene = (name: SceneName): Promise<SceneMaker> => {
  chunk ??= import('./scenes').then(
    m => m.SCENES,
    e => {
      chunk = null;
      throw e;
    },
  );
  return chunk.then(s => s[name]);
};
