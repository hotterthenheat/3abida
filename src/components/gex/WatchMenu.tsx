/*
==================================================
  SLAYER TERMINAL - THE ALERTS MENU (Pinpoint)
  (components/gex/WatchMenu.tsx)

  "Tell me when", as its own notification dropdown
  (Noah, 2026-09-05: "the entire tell me when
  section can be its own notification dropdown").
  One bell on the toolbar with the armed count on
  it; the card underneath lists every structural
  thing a dealer map can change its mind about,
  each with a switch:

    price reaches the call wall · the put wall ·
    the supreme · price crosses the gamma flip ·
    dealers change sides · the supreme moves to
    another strike · a wall moves two strikes

  and nothing else. A DOOR, NOT AN INBOX (the alerts
  rule, Noah, 2026-09-10: "we have 2 alert
  sections. is that intuitive?"): it used to carry
  what alerted, a "set again" and the honest-reach
  footnote under the switches — that half lives in
  ONE place now, the drawer behind the sidebar's
  bell, and this card only sets. Price alerts on
  single strikes live on the rows; this card is for
  the structure. The store is the chart's own
  (alertStore.ts): an alert armed here shows on the
  Pulse chart's rail and bell, and one armed there
  shows here.
==================================================
*/

import * as Switch from '@radix-ui/react-switch';
import PopoverCard from '../ui/PopoverCard';
import JingleBell from '../ui/JingleBell';
import {
  armGexFlip,
  armLevel,
  armNewSupreme,
  armWallMove,
  MAX_ALERTS,
  removeAlert,
  useAlerts,
  type Alert,
} from './alertStore';
import type { ExposureLevels } from '../../types/gex';

/* ARMED WEARS HOLO SILVER here — the label, its count and the switches (Noah,
   2026-09-05: "change the alerts button and the sub toggle buttons to holo
   silver on active"); the bell itself wears the alert orange (2026-09-10). */
const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const SILVER_FILL = 'rgb(var(--silver-fill))'; /* the silver as a SURFACE — a filled pill with the dark word on it, the holo flat form on either ground */
const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));

interface Watch {
  key: string;
  words: (levels: ExposureLevels | null) => string;
  hint: string;
  arm: (ticker: string) => Alert | null;
  is: (a: Alert) => boolean;
}

const WATCHES: Watch[] = [
  { key: 'callWall', words: L => `Price reaches the call wall${L ? ` ${fmtStrike(L.callWall)}` : ''}`, hint: 'The strike above with the most call gamma — a lid on rallies', arm: t => armLevel(t, 'callWall'), is: a => a.kind === 'level' && a.level === 'callWall' },
  { key: 'putWall', words: L => `Price reaches the put wall${L ? ` ${fmtStrike(L.putWall)}` : ''}`, hint: 'The strike below with the most put gamma — a floor under drops', arm: t => armLevel(t, 'putWall'), is: a => a.kind === 'level' && a.level === 'putWall' },
  { key: 'flip', words: L => `Price crosses the gamma flip${L ? ` ${fmtStrike(L.flip)}` : ''}`, hint: 'Above it dealers absorb moves, below it they amplify them', arm: t => armLevel(t, 'flip'), is: a => a.kind === 'level' && a.level === 'flip' },
  { key: 'supreme', words: L => `Price reaches the supreme${L ? ` ${fmtStrike(L.supreme)}` : ''}`, hint: 'The strike holding the most dealer gamma of all', arm: t => armLevel(t, 'supreme'), is: a => a.kind === 'level' && a.level === 'supreme' },
  { key: 'gexflip', words: () => 'Dealers change sides', hint: 'Dealer hedging on this name flips from amplifying moves to absorbing them, or back', arm: t => armGexFlip(t), is: a => a.kind === 'gexflip' },
  { key: 'newsupreme', words: () => 'The supreme moves to another strike', hint: 'The strike holding the most dealer gamma changes', arm: t => armNewSupreme(t), is: a => a.kind === 'newsupreme' },
  { key: 'wallmove', words: () => 'A wall moves 2 strikes or more', hint: 'The call wall or the put wall is re-drawn 2 strikes or more from where it stood', arm: t => armWallMove(t, 2), is: a => a.kind === 'wallmove' },
];

/* The plain voice (`waitingWords` / `firedWords`) lives in alertStore.ts, shared with the drawer (2026-09-10) */

const WatchMenu = ({ ticker, levels }: { ticker: string; spot?: number; levels: ExposureLevels | null }) => {
  const alerts = useAlerts(ticker);
  const armed = alerts.filter(a => !a.firedAt);
  const full = armed.length >= MAX_ALERTS;

  const set = (w: Watch, on: boolean) => {
    const hit = alerts.find(w.is);
    if (!on && hit) removeAlert(ticker, hit.id);
    else if (on && !hit) w.arm(ticker);
  };

  const trigger = (
    <button
      type="button"
      data-alerts-menu
      aria-label={`Alerts — ${armed.length} set`}
      className="relative inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-borderSubtle bg-chip hover:border-borderMuted data-[state=open]:border-silver/50 transition-colors font-mono select-none"
    >
      {/* the bell jingles and wears the alert orange while set (Noah, 2026-09-10); the label and count keep their silver (2026-09-05) */}
      <JingleBell count={armed.length} className="w-3 h-3" />
      <span className="text-[11px] font-semibold" style={{ color: armed.length ? SILVER : undefined }}>
        Alerts
      </span>
      {armed.length > 0 && (
        <span className="px-1 rounded-sm text-[9px] font-bold tnum" style={{ background: SILVER_FILL, color: '#0a0a0a' }} data-armed-count>
          {armed.length}
        </span>
      )}
    </button>
  );

  return (
    <PopoverCard trigger={trigger} title="Tell me when" meta={`${ticker} · ${armed.length} of ${MAX_ALERTS} set`} width={400} testId="alerts">
      <ul className="py-1" data-watch-list>
        {WATCHES.map(w => {
          const hit = alerts.find(w.is);
          const on = !!hit && !hit.firedAt;
          const blocked = !on && full;
          const id = `watch-${w.key}`;
          return (
            <li key={w.key} className="flex items-center gap-3 px-3 py-2 border-b border-borderSubtle/40 last:border-b-0" data-watch={w.key}>
              <label htmlFor={id} className="flex-1 min-w-0 flex flex-col gap-[1px] cursor-pointer">
                <span className={`font-mono text-[11px] leading-snug ${on ? 'font-semibold text-silver' : 'text-textPrimary'}`}>{w.words(levels)}</span>
                <span className="font-mono text-[9px] leading-snug text-textMuted">{blocked ? `${MAX_ALERTS} is the most for one name — turn one off first` : w.hint}</span>
              </label>
              <Switch.Root
                id={id}
                checked={on}
                disabled={blocked}
                onCheckedChange={v => set(w, v)}
                aria-label={w.words(levels)}
                className="relative shrink-0 w-8 h-[18px] rounded-full border border-borderSubtle bg-ink/[0.06] data-[state=checked]:bg-silver data-[state=checked]:border-silver disabled:opacity-40 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-silver/60"
              >
                <Switch.Thumb className="block w-3 h-3 rounded-full bg-textPrimary translate-x-[2px] data-[state=checked]:translate-x-[16px] data-[state=checked]:bg-panel transition-transform" />
              </Switch.Root>
            </li>
          );
        })}
      </ul>
    </PopoverCard>
  );
};

export default WatchMenu;
