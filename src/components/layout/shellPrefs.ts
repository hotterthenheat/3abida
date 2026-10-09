/*
==================================================
  SLAYER TERMINAL - THE SHELL'S OWN SWITCHES (components/layout/shellPrefs.ts)

  Three choices the shell reads, set in Settings and
  kept on this machine (2026-10-09):

    sessionStrip   the session strip under the rail's
                   signature — where New York's day
                   stands and how long to its next
                   phase (SessionStrip.tsx). On.
    notify         an alert that fires while this tab
                   is hidden also shows as the
                   machine's own notification — off
                   until the reader turns it on, and
                   the browser asks its own question
                   then (Notification.requestPermission).
    speak          an alert that fires is also said
                   aloud in the browser's own voice
                   (speechSynthesis): "SPY crossed the
                   gamma flip at 475". Off.

  Nothing here leaves the machine.
==================================================
*/

import { useSyncExternalStore } from 'react';

export interface ShellPrefs {
  sessionStrip: boolean;
  notify: boolean;
  speak: boolean;
}

const KEY = 'slayer_shell_prefs';
export const DEFAULT_SHELL_PREFS: ShellPrefs = { sessionStrip: true, notify: false, speak: false };

let prefs: ShellPrefs = (() => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SHELL_PREFS;
    const p = JSON.parse(raw) as Partial<ShellPrefs>;
    return {
      sessionStrip: p.sessionStrip !== false,
      notify: p.notify === true,
      speak: p.speak === true,
    };
  } catch {
    return DEFAULT_SHELL_PREFS;
  }
})();
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export function setShellPrefs(patch: Partial<ShellPrefs>): void {
  prefs = { ...prefs, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* storage off — the choice lives for the visit */
  }
  listeners.forEach(fn => fn());
}

export const readShellPrefs = (): ShellPrefs => prefs;
export const useShellPrefs = (): ShellPrefs => useSyncExternalStore(subscribe, readShellPrefs, () => DEFAULT_SHELL_PREFS);

/* ── THE MACHINE'S NOTIFICATIONS ─────────────────────────────────────────────────────────────────────────────────── */

/** What the browser says about notifications here: 'unsupported' where there is no Notification API */
export type NotifyPermission = NotificationPermission | 'unsupported';
export const notifyPermission = (): NotifyPermission => (typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported');

/** Turn notifications on: the browser's own question first; on only if it says yes. Returns what it said. */
export async function enableNotify(): Promise<NotifyPermission> {
  if (notifyPermission() === 'unsupported') return 'unsupported';
  let said: NotificationPermission = Notification.permission;
  if (said === 'default') {
    try {
      said = await Notification.requestPermission();
    } catch {
      said = Notification.permission;
    }
  }
  setShellPrefs({ notify: said === 'granted' });
  return said;
}

/** Show a notification when the tab is hidden and the reader asked for them — a click brings the tab forward */
export function notifyIfHidden(title: string, body: string, tag: string): void {
  if (!prefs.notify || typeof document === 'undefined' || !document.hidden) return;
  if (notifyPermission() !== 'granted') return;
  try {
    const n = new Notification(title, { body, tag, silent: false });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* a browser that only allows them from a service worker — nothing to do */
  }
}

/* ── SPOKEN ALERTS ──────────────────────────────────────────────────────────────────────────────────────────────── */

export const canSpeak = (): boolean => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

/** Say a line in the browser's own voice; `force` says it whatever the switch (the Settings page's Hear button) */
export function speak(line: string, force = false): void {
  if ((!prefs.speak && !force) || !canSpeak()) return;
  try {
    const u = new SpeechSynthesisUtterance(line);
    u.rate = 1.05;
    u.lang = 'en-US';
    window.speechSynthesis.speak(u);
  } catch {
    /* no voice here — the chip still shows */
  }
}
