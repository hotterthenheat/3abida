import { useState } from 'react';
import {
  MAX_ALERTS, armFlow, armGexFlip, armIndicator, armLevel, armNews, armNewSupreme,
  armPrice, armWallMove, priceAlertProblem, removeAlert, useAlerts,
  type Alert, type IndicatorSource, type LevelName,
} from './alertStore';
import { ALERT, alpha } from './paletteInk';

/*
==================================================
  SLAYER TERMINAL - ALERTS MENU (gex/AlertsMenu.tsx)

  Arm the things this pane can watch. A DOOR, NOT
  AN INBOX (the alerts rule, 2026-09-10): what is
  set and what alerted are read in the drawer behind
  the sidebar's bell — one place, every name.
==================================================

  THE MARKS ON THE PANE ARE THE ALERT. This menu is only where you put one
  down and take it away — the state a reader actually watches lives on the
  pane (the price kind's dashed line, and the armed rail for everything
  else), because the whole toolbar this menu hangs off is hidden until the
  cursor is over its pane. A badge here would be invisible almost all of the
  time, and an alert you cannot see fire is not an alert.

  EVERY KIND IS A CHIP, NOT A FORM (T-22). The four levels, the pane's own
  indicators, the book's three state changes and the tape's premium floors
  are all finite sets — chips arm in one click and cannot be typed wrong.
  The one thing that is genuinely a number the reader owns, a price, keeps
  the one input. An armed chip lights and says so; arming it again is
  refused, not doubled.

  The last line is the most important one in the file. This fires while the
  tab is open and not otherwise, and saying so is the difference between a
  modest feature and a promise that quietly is not kept.
*/

interface AlertsMenuProps {
  ticker: string;
  /** Where the market is — fixes which way a new price alert has to be
      crossed, and seeds the box so the reader types near the price. */
  spot: number;
  /** The pane's timeframe — an indicator alert is stamped with it, because
      an EMA on 1m and on 15m are different lines. */
  tf: string;
}

const LEVEL_CHIPS: { level: LevelName; label: string }[] = [
  { level: 'callWall', label: 'Call wall' },
  { level: 'putWall', label: 'Put wall' },
  { level: 'flip', label: 'Flip' },
  { level: 'supreme', label: 'Supreme' },
];

const INDICATOR_CHIPS: { source: IndicatorSource; threshold: number; label: string }[] = [
  { source: 'vwap', threshold: 0, label: 'VWAP' },
  { source: 'ema9', threshold: 0, label: 'EMA 9' },
  { source: 'ema21', threshold: 0, label: 'EMA 21' },
  { source: 'ema50', threshold: 0, label: 'EMA 50' },
  { source: 'rsi', threshold: 70, label: 'RSI 70' },
  { source: 'rsi', threshold: 30, label: 'RSI 30' },
];

const FLOW_CHIPS = [
  { floor: 250_000, label: '$250K' },
  { floor: 1_000_000, label: '$1M' },
  { floor: 5_000_000, label: '$5M' },
];

const WALL_CHIPS = [2, 4];

const AlertsMenu = ({ ticker, spot, tf }: AlertsMenuProps) => {
  const alerts = useAlerts(ticker);
  const [draft, setDraft] = useState('');
  const [refused, setRefused] = useState('');

  const full = alerts.length >= MAX_ALERTS;
  const capMsg = `${MAX_ALERTS} is the most one pane carries`;

  /** One gate for every chip, both directions (Noah, 2026-08-28: "when i
      click a button in the alerts that is already active then it should do
      the opposite" — a lit chip clicked again takes the watch off). */
  const toggleChip = (existing: Alert | undefined, armFn: () => Alert | null) => {
    if (existing) {
      removeAlert(ticker, existing.id);
      setRefused('');
      return;
    }
    if (full) {
      setRefused(capMsg);
      return;
    }
    if (!armFn()) {
      setRefused('Already watching that');
      return;
    }
    setRefused('');
  };

  const submit = () => {
    const price = Number(draft.trim());
    /* THE STORE SAYS WHICH THING WENT WRONG. This used to guess — anything
       that was not "not a number" and not "the pane is full" was reported as
       "there is already an alert there", which was wrong every time the real
       problem was the number: 999999999 on a $500 name armed nothing and
       explained nothing. */
    const why = priceAlertProblem(ticker, price, spot);
    if (why) {
      setRefused(why);
      return;
    }
    if (!armPrice(ticker, price, spot)) {
      setRefused(capMsg);
      return;
    }
    setDraft('');
    setRefused('');
  };

  const chipClass = (active: boolean) =>
    `px-1.5 py-[3px] rounded border font-mono text-[9px] leading-[12px] transition-all ${
      active
        ? 'hover:opacity-70'
        : 'border-borderSubtle text-textSecondary hover:text-textPrimary hover:border-borderMuted'
    }`;
  const chipStyle = (active: boolean) =>
    active ? { color: ALERT, borderColor: alpha(ALERT, 0.6) } : undefined;

  const section = (label: string) => (
    <div className="px-2.5 pt-1.5 pb-1 font-mono text-[8px] uppercase tracking-[0.14em] text-textMuted">
      {label}
    </div>
  );

  return (
    <div className="w-[248px] py-1">
      <div className="flex items-center gap-1.5 px-2.5 pb-1.5">
        <input
          value={draft}
          onChange={e => {
            setDraft(e.target.value);
            setRefused('');
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
            /* The desk listens for Escape too — the innermost open thing
               takes the key and nothing else sees it. */
            if (e.key === 'Escape') e.stopPropagation();
          }}
          inputMode="decimal"
          placeholder={spot > 0 ? spot.toFixed(2) : 'Price'}
          aria-label={`Alert price for ${ticker}`}
          className="w-full min-w-0 bg-inset border border-borderSubtle rounded px-1.5 py-1 font-mono text-[11px] tnum text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-borderMuted"
        />
        <button
          onClick={submit}
          disabled={full}
          title={full ? capMsg : `Alert me at this price`}
          className="shrink-0 px-2 py-1 rounded border border-borderSubtle bg-inset font-mono text-[10px] text-textSecondary hover:text-textPrimary hover:border-borderMuted disabled:hover:text-textSecondary transition-colors"
        >
          Set
        </button>
      </div>

      {refused && (
        <div role="status" className="px-2.5 pb-1 font-mono text-[9px] text-bear">
          {refused}
        </div>
      )}

      {section('Level crossed — follows the level')}
      <div className="flex flex-wrap gap-1 px-2.5">
        {LEVEL_CHIPS.map(c => {
          const hit = alerts.find(a => a.kind === 'level' && a.level === c.level);
          return (
            <button key={c.level} onClick={() => toggleChip(hit, () => armLevel(ticker, c.level))} aria-pressed={!!hit} title={hit ? 'On — click to turn off' : undefined} className={chipClass(!!hit)} style={chipStyle(!!hit)}>
              {c.label}
            </button>
          );
        })}
      </div>

      {section(`Indicator crossed — on ${tf}`)}
      <div className="flex flex-wrap gap-1 px-2.5">
        {INDICATOR_CHIPS.map(c => {
          const hit = alerts.find(
            a => a.kind === 'indicator' && a.source === c.source && a.tf === tf && Math.abs(a.threshold - c.threshold) < 1e-9
          );
          return (
            <button key={c.label} onClick={() => toggleChip(hit, () => armIndicator(ticker, c.source, tf, c.threshold))} aria-pressed={!!hit} title={hit ? 'On — click to turn off' : undefined} className={chipClass(!!hit)} style={chipStyle(!!hit)}>
              {c.label}
            </button>
          );
        })}
      </div>

      {section('Exposure changes')}
      <div className="flex flex-wrap gap-1 px-2.5">
        {(() => {
          const gexHit = alerts.find(a => a.kind === 'gexflip');
          const supremeHit = alerts.find(a => a.kind === 'newsupreme');
          const newsHit = alerts.find(a => a.kind === 'news');
          return (
            <>
              <button onClick={() => toggleChip(gexHit, () => armGexFlip(ticker))} aria-pressed={!!gexHit} title={gexHit ? 'On — click to turn off' : undefined} className={chipClass(!!gexHit)} style={chipStyle(!!gexHit)}>
                GEX flips sign
              </button>
              <button onClick={() => toggleChip(supremeHit, () => armNewSupreme(ticker))} aria-pressed={!!supremeHit} title={supremeHit ? 'On — click to turn off' : undefined} className={chipClass(!!supremeHit)} style={chipStyle(!!supremeHit)}>
                New supreme
              </button>
              <button onClick={() => toggleChip(newsHit, () => armNews(ticker, Date.now()))} aria-pressed={!!newsHit} title={newsHit ? 'On — click to turn off' : 'Fires when a graded headline lands for this name'} className={chipClass(!!newsHit)} style={chipStyle(!!newsHit)}>
                News lands
              </button>
              {WALL_CHIPS.map(n => {
                const hit = alerts.find(a => a.kind === 'wallmove' && a.strikes === n);
                return (
                  <button key={n} onClick={() => toggleChip(hit, () => armWallMove(ticker, n))} aria-pressed={!!hit} title={hit ? 'On — click to turn off' : undefined} className={chipClass(!!hit)} style={chipStyle(!!hit)}>
                    Wall ±{n}
                  </button>
                );
              })}
            </>
          );
        })()}
      </div>

      {section('Flow — a print over')}
      <div className="flex flex-wrap gap-1 px-2.5 pb-1">
        {FLOW_CHIPS.map(c => {
          const hit = alerts.find(a => a.kind === 'flow' && Math.abs(a.floor - c.floor) < 1e-9);
          return (
            <button key={c.floor} onClick={() => toggleChip(hit, () => armFlow(ticker, c.floor, Date.now()))} aria-pressed={!!hit} title={hit ? 'On — click to turn off' : undefined} className={chipClass(!!hit)} style={chipStyle(!!hit)}>
              {c.label}
            </button>
          );
        })}
      </div>

      {/* A DOOR, NOT AN INBOX (the alerts rule, Noah, 2026-09-10): the
          "Active" list, the "recently alerted" log and the honest-reach line
          that stood here live in ONE place now — the drawer behind the
          sidebar's bell. A typed price alert still shows in place as its
          dashed line on the pane; the drawer takes it off. */}
    </div>
  );
};

export default AlertsMenu;
