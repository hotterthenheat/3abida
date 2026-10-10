/*
==================================================
  SLAYER TERMINAL - THE WINDOWS IN STEP
  (components/layout/deskChannel.ts)

  Pop-out windows for a second monitor (the ideas
  report, 2026-10-10; thinkorswim's Detach): a Pulse
  panel or a Terrain pane opens in a window of its own
  (pages/popout/PopOut.tsx), and every window of the
  terminal on this machine keeps three things in step
  through one BroadcastChannel —

    the name         the terminal's own (a panel that
                     follows it follows it in any window)
    the link groups  A–D: a name picked in a group, in
                     any window, moves the group in all
    the theme        dark, light or the machine's

  Each window says what changed as it changes it, and
  takes what another says unless it changed the same
  thing itself later. A window that opens says hello and
  is told the state. Nothing leaves the machine: the
  channel is the browser's, between tabs of one origin.

  ONE DESK, NOT EVERY TAB: a window speaks only to the
  windows of its own desk — the tab and the pop-outs it
  opened. The desk's name is kept in the tab's session,
  which a window opened from it inherits; a tab opened
  on its own is a desk of its own, and keeps its own
  name as it always did.

  The prices are each window's own until a feed is
  connected — the simulator walks its live ticks in each
  window — and then every window reads the one feed.
==================================================
*/

import { useEffect } from 'react';
import { changeTicker, marketStore, setLinkGroup, LINK_GROUPS, type LinkGroup } from '../../context/marketStore';
import { getThemeChoice, setThemeChoice, subscribeTheme, type ThemeChoice } from '../../theme/theme';
import { EMBEDDED } from '../../embed';

const CHANNEL = 'slayer-desk';
const SELF = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const DESK_KEY = 'slayer_desk_id';
/** This window's desk — the tab's own, or the one it was opened from (window.open hands a pop-out the tab's session) */
const DESK: string = (() => {
  try {
    const kept = sessionStorage.getItem(DESK_KEY);
    if (kept) return kept;
    sessionStorage.setItem(DESK_KEY, SELF);
  } catch {
    /* no session storage — a desk of one */
  }
  return SELF;
})();

type Groups = Record<LinkGroup, string | null>;
type Said =
  | { kind: 'hello' }
  | { kind: 'name'; ticker: string }
  | { kind: 'groups'; groups: Groups }
  | { kind: 'theme'; choice: ThemeChoice };
type Msg = Said & { from: string; desk: string; at: number };

const THEMES: ThemeChoice[] = ['dark', 'light', 'system'];

/** Keep this window in step with every other window of the terminal — mounted once by the shell and by a pop-out */
export function useDeskChannel(): void {
  useEffect(() => {
    if (EMBEDDED || typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(CHANNEL);
    /* when this window last changed each thing itself — an older word from elsewhere does not undo it */
    const mine = { name: 0, groups: 0, theme: 0 };
    /* what was last taken from elsewhere — taking it is not a change of this window's to say again */
    let heard = { name: '', groups: '', theme: '' };
    const say = (s: Said) => ch.postMessage({ ...s, from: SELF, desk: DESK, at: Date.now() } satisfies Msg);

    let last = marketStore.get();
    let lastTheme = getThemeChoice();
    const groupsKey = (g: Groups) => LINK_GROUPS.map(k => g[k] ?? '').join('|');
    const tellAll = () => {
      const s = marketStore.get();
      say({ kind: 'name', ticker: s.active });
      say({ kind: 'groups', groups: s.groups });
      say({ kind: 'theme', choice: getThemeChoice() });
    };

    const offStore = marketStore.subscribe(() => {
      const s = marketStore.get();
      /* a change that is what was just heard is taken, not said again — once */
      if (s.active !== last.active) {
        if (s.active === heard.name) heard = { ...heard, name: '' };
        else {
          mine.name = Date.now();
          say({ kind: 'name', ticker: s.active });
        }
      }
      if (groupsKey(s.groups) !== groupsKey(last.groups)) {
        if (groupsKey(s.groups) === heard.groups) heard = { ...heard, groups: '' };
        else {
          mine.groups = Date.now();
          say({ kind: 'groups', groups: s.groups });
        }
      }
      last = s;
    });
    const offTheme = subscribeTheme(() => {
      const c = getThemeChoice();
      if (c !== lastTheme) {
        if (c === heard.theme) heard = { ...heard, theme: '' };
        else {
          mine.theme = Date.now();
          say({ kind: 'theme', choice: c });
        }
      }
      lastTheme = c;
    });

    ch.onmessage = (e: MessageEvent<Msg>) => {
      const m = e.data;
      if (!m || typeof m !== 'object' || m.from === SELF || m.desk !== DESK) return;
      if (m.kind === 'hello') return tellAll();
      if (m.kind === 'name' && typeof m.ticker === 'string' && m.at >= mine.name) {
        if (m.ticker === marketStore.get().active) return;
        heard = { ...heard, name: m.ticker };
        changeTicker(m.ticker);
      } else if (m.kind === 'groups' && m.groups && m.at >= mine.groups) {
        const cur = marketStore.get().groups;
        heard = { ...heard, groups: groupsKey(m.groups) };
        for (const g of LINK_GROUPS) {
          const name = m.groups[g];
          if (typeof name === 'string' && name && name !== cur[g]) setLinkGroup(g, name);
        }
      } else if (m.kind === 'theme' && THEMES.includes(m.choice) && m.at >= mine.theme) {
        if (m.choice === getThemeChoice()) return;
        heard = { ...heard, theme: m.choice };
        setThemeChoice(m.choice);
      }
    };
    /* a window that has just opened asks for the state; one already open answers */
    say({ kind: 'hello' });
    return () => {
      offStore();
      offTheme();
      ch.close();
    };
  }, []);
}

/* ---- opening one --------------------------------------------------------------------------------------------- */

/** Open a pop-out: its own window, sized for a panel, named so a second press brings the same window forward */
export function openPopOut(path: string, name: string, size: { w: number; h: number } = { w: 960, h: 640 }): void {
  const left = Math.max(0, Math.round((window.screenX ?? 0) + 40));
  const top = Math.max(0, Math.round((window.screenY ?? 0) + 40));
  const win = window.open(path, `slayer-${name}`, `popup=yes,width=${size.w},height=${size.h},left=${left},top=${top}`);
  win?.focus();
}
