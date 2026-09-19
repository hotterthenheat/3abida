/*
==================================================
  SLAYER TERMINAL - THE DESK'S KEYS (pages/paper/useHotkeys.ts)

  Every binding lives in prefs (rebindable, the
  directive's rule); this hook only listens. A
  binding is a chord ("Shift+X") or a short
  sequence ("B L" — B then L inside a moment). A
  chord that is also the start of a sequence waits
  a beat for the second key before it fires on
  its own, so B and B L can both exist.

  Keys never fire while the reader is typing, or
  while a menu or a card has the keyboard.
==================================================
*/

import { useEffect, useRef } from 'react';
import { comboOf, getPaperPrefs, sequenceOf, type HotkeyAction } from '../../core/paper/prefs';

const SEQUENCE_MS = 700;
const SOLO_WAIT_MS = 320;

export function useHotkeys(on: boolean, actions: Partial<Record<HotkeyAction, () => void>>): void {
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  useEffect(() => {
    if (!on) return;
    let pending: string[] = [];
    let seqTimer = 0;
    let soloTimer = 0;
    let solo: HotkeyAction | null = null;
    const clear = () => {
      pending = [];
      window.clearTimeout(seqTimer);
      window.clearTimeout(soloTimer);
      solo = null;
    };
    const fire = (a: HotkeyAction) => {
      clear();
      actionsRef.current[a]?.();
    };
    const onKey = (e: KeyboardEvent) => {
      const prefs = getPaperPrefs();
      if (!prefs.hotkeys || e.defaultPrevented || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (document.querySelector('[data-trade-menu], [data-trade-card], [data-order-edit], [role="dialog"][aria-modal="true"], [data-radix-popper-content-wrapper]')) return;
      const combo = comboOf(e);
      if (!combo) return;
      const next = [...pending, combo];
      const bound = (Object.keys(prefs.bindings) as HotkeyAction[]).map(a => ({ a, seq: sequenceOf(prefs.bindings[a]) }));
      const exact = bound.filter(b => b.seq.length === next.length && b.seq.every((k, i) => k === next[i]));
      const longer = bound.filter(b => b.seq.length > next.length && next.every((k, i) => k === b.seq[i]));
      if (exact.length === 0 && longer.length === 0) {
        clear();
        return;
      }
      e.preventDefault();
      window.clearTimeout(soloTimer);
      solo = null;
      if (longer.length === 0) {
        fire(exact[0].a);
        return;
      }
      pending = next;
      window.clearTimeout(seqTimer);
      seqTimer = window.setTimeout(clear, SEQUENCE_MS);
      if (exact.length > 0) {
        solo = exact[0].a;
        soloTimer = window.setTimeout(() => {
          if (solo) fire(solo);
        }, SOLO_WAIT_MS);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      clear();
    };
  }, [on]);
}
