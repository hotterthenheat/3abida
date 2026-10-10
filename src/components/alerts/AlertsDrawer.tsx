/*
==================================================
  SLAYER TERMINAL - THE ALERTS DRAWER (components/alerts/AlertsDrawer.tsx)

  Every alert the reader has, in one place, over
  any page (the rule, Noah, 2026-09-10 — "why is
  the alerts page just the targets page?"):

    set in place · SEE IN ONE PLACE · hear it everywhere

  The sidebar's bell opens it at the right, on the
  draw rail's glass (Noah: "translucent"). Two
  shelves: SET (waiting, one hairline card per name
  with the name's logo at its head, one row per
  alert inside) and ALERTED (the session's log,
  newest first, one card) — the word is ALERTED,
  never "fired" or "rang" (Noah, 2026-09-10).

  THE ROW (redrawn 2026-09-10, Noah: "i dont like
  the looks of this aside from the translucentness
  … maybe a lack of icons, borders"): a lucide icon
  for the KIND at the left, muted while waiting and
  in the alert orange once it alerted; the thing in
  plain words on the first line; the state and its
  time on a muted second line; a small bordered pill
  for the door back to the surface that shows it;
  the one action as an icon button (take it off, or
  set it again). "This name" is a filter card,
  never a different list: alerts belong to a name
  and a thing, not a page.

  Opening it marks every firing seen — the bell
  goes quiet because the reader looked. Esc and a
  click outside close it; the innermost rule holds
  (a menu open inside takes the key first).
==================================================
*/

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Activity, AlarmClock, ArrowUpRight, Bell, BellOff, Code2, Crosshair, Crown, Droplets, Layers, MoveHorizontal, Newspaper, Repeat, RotateCcw, SlidersHorizontal, X,
  type LucideIcon,
} from 'lucide-react';
import Simulator from '../../core/simulator';
import { useActiveTicker, changeTicker } from '../../context/MarketDataContext';
import DropdownSelect, { type DropdownOption } from '../ui/DropdownSelect';
import CompanyLogo from '../ui/CompanyLogo';
import {
  MAX_ALERTS, clearFiredLog, firedWords, fmtAlertValue, isResting, markSeenAll, rearmFromRecord, removeAlert, restoreAlerts,
  restoreFiredLog, setLifecycle, snoozeAlert, snoozeFromRecord, useAllAlerts, waitingWords,
  type Alert, type AlertKind, type AlertRepeat, type FiredRecord,
} from '../gex/alertStore';
import { ALERT, alpha } from '../gex/paletteInk';
import { closeAlertsDrawer, useAlertsDrawer } from '../../data/alertsDrawer';
import { useOverlay } from '../ui/layers';
import { undoable } from '../ui/undo';
import { nyClock, nyDay, nyParts, nyWallTime } from '../../core/nyTime';
import { SNOOZE_MS } from './AlertToasts';

/** The kind's icon — a lucide outline, one per thing an alert can watch */
const KIND_ICON: Record<AlertKind, LucideIcon> = {
  price: Crosshair,
  level: Layers,
  indicator: Activity,
  gexflip: Repeat,
  newsupreme: Crown,
  wallmove: MoveHorizontal,
  flow: Droplets,
  news: Newspaper,
  script: Code2,
};

/** Where an alert shows — the surface a row's door opens */
const doorOf = (a: Alert): { label: string; to: string } => {
  switch (a.kind) {
    /* the chart a price sits on is Terrain's — "Chart" opened the Map, which is a ladder (the audit's SH-7) */
    case 'price':
    case 'indicator':
      return { label: 'Chart', to: '/terrain' };
    case 'level':
    case 'gexflip':
    case 'newsupreme':
    case 'wallmove':
      return { label: 'Targets', to: '/pinpoint/targets' };
    case 'flow':
      return { label: 'Tape', to: '/trace/live-tape' };
    case 'news':
      return { label: 'News', to: '/dossier/news' };
    /* a script's alert opens the pane it was armed on */
    case 'script':
      return a.paneId.startsWith('terrain') ? { label: 'Terrain', to: '/terrain' }
        : a.paneId === 'weigher' ? { label: 'Weigher', to: '/weigher' }
        : a.paneId.startsWith('pulse') ? { label: 'Pulse', to: '/pulse' }
        : { label: 'Map', to: '/pinpoint' };
  }
};

/* EVERY TIME HERE IS NEW YORK'S (the audit's X2.6 — the drawer printed the machine's own clock beside toasts in ET) */
const hhmm = (ms: number) => nyClock(ms, { zone: true });
const hhmmss = (ms: number) => nyClock(ms, { seconds: true, zone: true });
/** A time that may be another day: "16:00 ET", or "Oct 12, 16:00 ET" */
const whenAt = (ms: number) => (nyDay(ms) === nyDay(Date.now()) ? hhmm(ms) : `${nyDay(ms)}, ${hhmm(ms)}`);
const ALL = 'all';

/* ---- the lifecycle's words (2026-10-09) ------------------------------------------------ */

const REPEAT_OPTIONS: DropdownOption<AlertRepeat>[] = [
  { value: 'once', label: 'Once', hint: 'It alerts, then it is gone' },
  { value: 'every', label: 'Every time', hint: 'It alerts each time it happens, and stays set' },
  { value: 'bar', label: 'Once a bar', hint: 'At most once in each bar — a minute for a price, the alert’s own bars for an indicator' },
  { value: 'minute', label: 'Once a minute', hint: 'At most once in any minute' },
];
const REPEAT_WORD: Record<AlertRepeat, string> = { once: 'once', every: 'every time', bar: 'once a bar', minute: 'once a minute' };

type EndChoice = 'never' | 'close' | 'hour' | 'week';
/** The next close of the cash session from now: today's 16:00 New York while it is ahead, else the next weekday's */
const nextClose = (now: number): number => {
  for (let i = 0; i <= 7; i++) {
    const p = nyParts(now + i * 86_400_000);
    if (p.weekday === 0 || p.weekday === 6) continue;
    const close = nyWallTime(p.year, p.month, p.day, 16, 0);
    if (close > now) return close;
  }
  return now + 86_400_000;
};
/** Friday's close, this week's (or next week's once it has passed) */
const weekClose = (now: number): number => {
  let t = nextClose(now);
  for (let i = 0; i < 6 && nyParts(t).weekday !== 5; i++) t = nextClose(t + 60_000);
  return t;
};
const endAt = (c: EndChoice, now: number): number => (c === 'never' ? 0 : c === 'close' ? nextClose(now) : c === 'hour' ? now + 3_600_000 : weekClose(now));
const END_OPTIONS: DropdownOption<EndChoice>[] = [
  { value: 'never', label: 'Never', hint: 'It stays set until you take it off' },
  { value: 'close', label: 'At the close', hint: 'The next 16:00 New York' },
  { value: 'hour', label: 'In an hour', hint: 'An hour from now' },
  { value: 'week', label: 'At the week’s close', hint: 'Friday, 16:00 New York' },
];
/** What the current end reads as, for the menu: the choice it matches, else "never" if none is set */
const endChoiceOf = (a: Alert): EndChoice => {
  if (!a.expiresAt) return 'never';
  const now = Date.now();
  if (Math.abs(a.expiresAt - nextClose(now)) < 60_000) return 'close';
  if (Math.abs(a.expiresAt - weekClose(now)) < 60_000) return 'week';
  return 'hour';
};

/** The waiting row's second line: its state, when it was set, how often, until when */
const stateOf = (a: Alert): string => {
  const now = Date.now();
  const parts: string[] = [];
  if (isResting(a, now)) parts.push((a.quietUntil ?? 0) > now ? `resting until ${whenAt(a.quietUntil!)}` : 'back on watch on the next tick');
  else parts.push(a.setAt ? `waiting · set ${hhmm(a.setAt)}` : 'waiting');
  if (a.repeat && a.repeat !== 'once') parts.push(REPEAT_WORD[a.repeat]);
  if (a.expiresAt) parts.push(`ends ${whenAt(a.expiresAt)}`);
  return parts.join(' · ');
};


/* ---- the parts ------------------------------------------------------------------------ */

/* The shelf heads read as heads, not footnotes (Noah, 2026-09-10: "a bit too muted") */
const Shelf = ({ label, count, action, onAction, children }: { label: string; count: number; action?: string; onAction?: () => void; children: React.ReactNode }) => (
  <section className="px-3.5 pt-4" data-alerts-shelf={label.toLowerCase()}>
    <div className="flex items-baseline gap-1.5 pb-2">
      <span className="text-[12px] font-semibold text-textPrimary">{label}</span>
      <span className="font-mono text-[11px] tnum text-textSecondary">{count}</span>
      {action && count > 0 && (
        <button type="button" onClick={onAction} className="hit ml-auto h-6 px-2 -mr-2 rounded-md text-[11px] text-textSecondary hover:text-textPrimary hover:bg-ink/[0.05] transition-colors" data-alerts-clear={label.toLowerCase()}>
          {action}
        </button>
      )}
    </div>
    {children}
  </section>
);

/** A hairline card — one per name on the Set shelf, one for the log */
const Card = ({ children, testId }: { children: React.ReactNode; testId?: string }) => (
  <div className="rounded-md border border-borderSubtle/80 bg-ink/[0.02] overflow-hidden" data-alerts-card={testId}>
    {children}
  </div>
);

const NameHead = ({ ticker, note }: { ticker: string; note: string }) => (
  <div className="flex items-center gap-2 h-8 px-3 border-b border-borderSubtle/70 bg-ink/[0.02]" data-alert-name={ticker}>
    <CompanyLogo ticker={ticker} size={14} />
    <span className="font-mono text-[11px] font-bold text-textPrimary">{ticker}</span>
    <span className="font-mono text-[11px] tnum text-textMuted">{note}</span>
  </div>
);

/** The door back to the surface that shows the alert — a small bordered pill */
const Door = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    title={`Open the ${label.toLowerCase()} on this name`}
    className="hit shrink-0 inline-flex items-center gap-1 h-6 px-2 rounded-md border border-borderSubtle bg-chip/70 font-mono text-[11px] text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors"
    data-alert-door
  >
    {label}
    <ArrowUpRight className="w-2.5 h-2.5" />
  </button>
);

const IconButton = ({ onClick, label, title, children, testId, pressed }: { onClick: () => void; label: string; title: string; children: React.ReactNode; testId: string; pressed?: boolean }) => (
  <button type="button" onClick={onClick} aria-label={label} title={title} aria-expanded={pressed} className={`hit shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md border transition-colors ${pressed ? 'border-borderSubtle bg-ink/[0.06] text-textPrimary' : 'border-transparent text-textMuted hover:text-textPrimary hover:border-borderSubtle hover:bg-ink/[0.04]'}`} {...{ [testId]: true }}>
    {children}
  </button>
);

/** One alert, one shape everywhere: the kind's icon, the words, the state line, the door, the action */
const Row = ({ kind, alerted, ticker, words, state, door, action, testId, below }: { kind: AlertKind; alerted: boolean; ticker?: string; words: string; state: string; door: { label: string; onClick: () => void }; action: React.ReactNode; testId: Record<string, string>; below?: React.ReactNode }) => {
  const Icon = KIND_ICON[kind];
  return (
    <div className="border-b border-borderSubtle/60 last:border-b-0">
    <div className="flex items-center gap-2.5 px-3 py-2 hover:bg-ink/[0.03] transition-colors" {...testId} data-alert-kind={kind}>
      <span className="shrink-0 w-6 h-6 rounded-md border flex items-center justify-center" style={alerted ? { color: ALERT, borderColor: alpha(ALERT, 0.33), background: alpha(ALERT, 0.08) } : undefined} data-alert-icon={alerted ? 'alerted' : 'waiting'}>
        <Icon className={`w-3.5 h-3.5 ${alerted ? '' : 'text-textMuted'}`} strokeWidth={1.75} />
      </span>
      <span className="flex-1 min-w-0 flex flex-col gap-[2px]">
        <span className="flex items-center gap-1.5 min-w-0">
          {ticker && <span className="shrink-0 font-mono text-[11px] font-bold text-textPrimary">{ticker}</span>}
          <span className="truncate text-[12px] text-textPrimary">{words}</span>
        </span>
        <span className={`font-mono text-[11px] tnum ${alerted ? '' : 'text-textMuted'}`} style={alerted ? { color: ALERT } : undefined}>
          {state}
        </span>
      </span>
      <Door label={door.label} onClick={door.onClick} />
      {action}
    </div>
    {below}
    </div>
  );
};

/** A waiting alert's lifecycle, opened under its row: how often, until when, a rest */
const Lifecycle = ({ ticker, a }: { ticker: string; a: Alert }) => (
  <div className="flex items-center gap-2 flex-wrap px-3 pb-2.5 pl-[46px]" data-alert-lifecycle={a.id}>
    <DropdownSelect<AlertRepeat> label="Repeat" size="sm" value={a.repeat ?? 'once'} options={REPEAT_OPTIONS} onChange={v => setLifecycle(ticker, a.id, { repeat: v })} title="How often it may alert" testId={`alert-repeat-${a.id}`} />
    <DropdownSelect<EndChoice> label="Ends" size="sm" value={endChoiceOf(a)} options={END_OPTIONS} onChange={v => setLifecycle(ticker, a.id, { expiresAt: endAt(v, Date.now()) })} title="When it comes off by itself" testId={`alert-ends-${a.id}`} />
    <button
      type="button"
      onClick={() => snoozeAlert(ticker, a.id, isResting(a) ? 0 : SNOOZE_MS)}
      className="hit inline-flex items-center gap-1 h-6 px-2 rounded-md border border-borderSubtle font-mono text-[11px] text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors"
      title={isResting(a) ? 'Back on watch now, from where the market stands' : 'Rest it for 15 minutes — nothing it sleeps through counts'}
      data-alert-snooze-row={a.id}
    >
      <AlarmClock className="w-3 h-3" />
      {isResting(a) ? 'Wake' : 'Snooze 15m'}
    </button>
  </div>
);

const Empty = ({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) => (
  <div className="rounded-md border border-dashed border-borderSubtle/70 px-4 py-5 flex flex-col items-center gap-2 text-center">
    <Icon className="w-4 h-4 text-textMuted" strokeWidth={1.5} />
    <p className="text-[11px] leading-snug text-textSecondary max-w-[280px]">{children}</p>
  </div>
);

/* ---- the drawer ------------------------------------------------------------------------ */

const AlertsDrawer = () => {
  const open = useAlertsDrawer();
  const names = useAllAlerts();
  const activeTicker = useActiveTicker();
  const navigate = useNavigate();
  const [name, setName] = useState<string>(ALL);
  const [refused, setRefused] = useState('');

  /* Opened, or something alerted while it was open — the reader is looking */
  useEffect(() => {
    if (open) markSeenAll();
  }, [open, names]);

  /* A DIALOG (the audit's X13): focus goes in on open, Tab stays inside, Esc closes it when it is the top layer (a menu
     open inside takes the key first — ui/layers.ts), and focus goes back to the bell on close */
  const box = useRef<HTMLElement | null>(null);
  useOverlay({ open, ref: box, onClose: closeAlertsDrawer, initialFocus: 'container' });
  /* which waiting row has its lifecycle open */
  const [editing, setEditing] = useState<string | null>(null);

  /* THE GLIDE (Noah, 2026-09-10: "the alert sidebars transition is not smooth
     enough for me. the in and out is too quick"): the drawer slides in from
     the right over 0.5s and slides back out over 0.36s on the standard
     curve — framer-motion's AnimatePresence keeps it mounted for the way
     out. Reduced motion: it appears and goes. */
  const reduce = useReducedMotion();
  /* the standard curve, not the house expo — the expo is home by 120ms on a
     400px panel and reads as a snap (measured x37 · x4 · x1 · 0) */
  const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];
  const glideIn = { x: 0, opacity: 1, transition: { duration: reduce ? 0 : 0.5, ease: EASE } };
  const glideOut = { x: 48, opacity: 0, transition: { duration: reduce ? 0 : 0.36, ease: EASE } };

  const pick = name !== ALL && names.some(n => n.ticker === name) ? name : ALL;
  const shown = pick === ALL ? names : names.filter(n => n.ticker === pick);
  const setTotal = names.reduce((n, a) => n + a.alerts.filter(x => !x.firedAt).length, 0);
  const firedTotal = names.reduce((n, a) => n + a.fired.length, 0);
  const waiting = shown.map(n => ({ ticker: n.ticker, alerts: n.alerts.filter(a => !a.firedAt) })).filter(n => n.alerts.length > 0);
  const waitingCount = waiting.reduce((n, w) => n + w.alerts.length, 0);
  const fired: { ticker: string; r: FiredRecord }[] = shown
    .flatMap(n => n.fired.map(r => ({ ticker: n.ticker, r })))
    .sort((x, y) => y.r.at - x.r.at);

  const nameOptions: DropdownOption<string>[] = [
    { value: ALL, label: 'All names', hint: names.length === 0 ? 'No name holds an alert yet' : `${names.length} name${names.length === 1 ? '' : 's'} with alerts` },
    ...names.map(n => ({ value: n.ticker, label: n.ticker, hint: `${n.alerts.filter(a => !a.firedAt).length} set · ${n.fired.length} alerted` })),
  ];

  /* A door: the name becomes the subject, the surface opens, the drawer shuts */
  const go = (ticker: string, to: string) => {
    if (ticker !== activeTicker) changeTicker(ticker);
    navigate(to);
    closeAlertsDrawer();
  };

  /* CLEAR, WITH A WAY BACK (the audit's X5.8): the shelf goes at once and the chip in the toast column puts it back */
  const clearSet = () => {
    const gone = waiting.map(w => ({ ticker: w.ticker, alerts: names.find(n => n.ticker === w.ticker)?.alerts.filter(a => !a.firedAt) ?? [] }));
    const count = gone.reduce((n, g) => n + g.alerts.length, 0);
    gone.forEach(g => g.alerts.forEach(a => removeAlert(g.ticker, a.id)));
    undoable({ label: `Took off ${count} alert${count === 1 ? '' : 's'}`, undo: () => gone.forEach(g => restoreAlerts(g.ticker, g.alerts)), key: 'alerts-clear-set' });
  };
  const clearLog = () => {
    const gone = shown.map(n => ({ ticker: n.ticker, fired: n.fired }));
    const count = gone.reduce((n, g) => n + g.fired.length, 0);
    gone.forEach(g => clearFiredLog(g.ticker));
    undoable({ label: `Cleared ${count} from the log`, undo: () => gone.forEach(g => restoreFiredLog(g.ticker, g.fired)), key: 'alerts-clear-log' });
  };
  const takeOff = (ticker: string, a: Alert) => {
    removeAlert(ticker, a.id);
    undoable({ label: `Took off ${ticker} · ${waitingWords(a)}`, undo: () => restoreAlerts(ticker, [a]) });
  };

  const armAgain = (ticker: string, r: FiredRecord) => {
    const spot = Simulator.TICKERS[ticker]?.currentPrice ?? 0;
    if (rearmFromRecord(ticker, r.key, spot, Date.now())) setRefused('');
    else setRefused(`Already watching that on ${ticker}, or ${ticker} has its ${MAX_ALERTS} already`);
  };

  return (
    <AnimatePresence>
      {open && <div key="scrim" className="fixed inset-0 z-[87]" onClick={closeAlertsDrawer} aria-hidden data-alerts-scrim />}
      {/* TRANSLUCENT (Noah, 2026-09-10: "the alerts sidetab should be translucent") — the draw rail's glass, at 92% since
          2026-10-09 (the audit's SH-8: at 75% the footer's art read through the empty state and the small words) */}
      {open && (
      <motion.aside
        key="drawer"
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby="alerts-drawer-title"
        tabIndex={-1}
        initial={{ x: 48, opacity: 0 }}
        animate={glideIn}
        exit={glideOut}
        className="fixed top-0 right-0 bottom-0 z-[88] w-[400px] max-w-[92vw] border-l border-borderMuted bg-panel/[0.92] backdrop-blur-lg backdrop-saturate-150 flex flex-col shadow-[-16px_0_48px_rgba(0,0,0,0.45)] outline-none"
        data-alerts-drawer
      >
        {/* THE HEAD — the house head: the icon in its 24px chip, the name, the facts */}
        <div className="h-12 shrink-0 flex items-center gap-2.5 px-3.5 border-b border-borderSubtle/70">
          <span className="w-6 h-6 rounded-md border border-borderSubtle bg-ink/[0.03] flex items-center justify-center shrink-0" aria-hidden>
            <Bell className="w-3.5 h-3.5 text-textSecondary" strokeWidth={1.75} />
          </span>
          <h2 id="alerts-drawer-title" className="text-[14px] font-semibold text-textPrimary">Alerts</h2>
          <span className="font-mono text-[11px] tnum text-textMuted" data-alerts-facts>
            <span className="text-textSecondary">{setTotal}</span> set · <span className={firedTotal ? 'text-textSecondary' : ''}>{firedTotal}</span> alerted
          </span>
          <button type="button" onClick={closeAlertsDrawer} aria-label="Close the alerts" title="Close (Esc)" className="hit ml-auto shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md text-textMuted hover:text-textPrimary hover:bg-ink/[0.06] transition-colors" data-alerts-close>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* "This name" is a filter, never another list */}
        <div className="shrink-0 flex items-center gap-2 px-3.5 py-2 border-b border-borderSubtle/60">
          <DropdownSelect label="Name" value={pick} options={nameOptions} onChange={setName} />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pb-4" data-alerts-body>
          <Shelf label="Set" count={waitingCount} action="Clear" onAction={clearSet}>
            {waiting.length === 0 ? (
              <Empty icon={BellOff}>
                Nothing waiting{pick !== ALL ? ` on ${pick}` : ''}. Set one where the thing is — a strike row on Targets, a chart's Alerts menu, the Targets bell, a script's gear.
              </Empty>
            ) : (
              <div className="flex flex-col gap-2">
                {waiting.map(w => (
                  <Card key={w.ticker} testId={w.ticker}>
                    <NameHead ticker={w.ticker} note={`${w.alerts.length} of ${MAX_ALERTS}`} />
                    {w.alerts.map(a => {
                      const door = doorOf(a);
                      const editingThis = editing === a.id;
                      return (
                        <Row
                          key={a.id}
                          kind={a.kind}
                          alerted={false}
                          words={waitingWords(a)}
                          state={stateOf(a)}
                          door={{ label: door.label, onClick: () => go(w.ticker, door.to) }}
                          testId={{ 'data-alert-row': a.id }}
                          below={editingThis ? <Lifecycle ticker={w.ticker} a={a} /> : undefined}
                          action={
                            <>
                              <IconButton onClick={() => setEditing(editingThis ? null : a.id)} pressed={editingThis} label={`How often and until when — ${waitingWords(a)}`} title="Repeat, end, snooze" testId="data-alert-life">
                                <SlidersHorizontal className="w-3 h-3" />
                              </IconButton>
                              <IconButton onClick={() => takeOff(w.ticker, a)} label={`Take the alert off — ${waitingWords(a)}`} title="Take it off" testId="data-alert-remove">
                                <X className="w-3 h-3" />
                              </IconButton>
                            </>
                          }
                        />
                      );
                    })}
                  </Card>
                ))}
              </div>
            )}
          </Shelf>

          <Shelf label="Alerted" count={fired.length} action="Clear" onAction={clearLog}>
            {fired.length === 0 ? (
              <Empty icon={Bell}>Nothing has alerted{pick !== ALL ? ` on ${pick}` : ''} yet. Every alert that fires is kept here, on this machine, until you clear it.</Empty>
            ) : (
              <Card testId="alerted">
                {fired.map(({ ticker, r }) => {
                  const door = doorOf(r.alert);
                  return (
                    <Row
                      key={`${ticker}:${r.key}`}
                      kind={r.alert.kind}
                      alerted
                      ticker={ticker}
                      words={firedWords(r.alert, ticker)}
                      state={`alerted ${nyDay(r.at) === nyDay(Date.now()) ? hhmmss(r.at) : `${nyDay(r.at)}, ${hhmmss(r.at)}`}${r.value != null && r.alert.kind !== 'price' ? ` · at ${fmtAlertValue(r.value)}` : ''}`}
                      door={{ label: door.label, onClick: () => go(ticker, door.to) }}
                      testId={{ 'data-fired-row': r.key }}
                      action={
                        <>
                          <IconButton
                            onClick={() => {
                              if (snoozeFromRecord(ticker, r.key, SNOOZE_MS)) setRefused('');
                              else setRefused(`${ticker} has its ${MAX_ALERTS} already`);
                            }}
                            label={`Snooze for 15 minutes — ${firedWords(r.alert, ticker)}`}
                            title="Rest it for 15 minutes, then watch again"
                            testId="data-alert-snooze-log"
                          >
                            <AlarmClock className="w-3 h-3" />
                          </IconButton>
                          <IconButton onClick={() => armAgain(ticker, r)} label={`Set this alert again — ${firedWords(r.alert, ticker)}`} title="Set it again" testId="data-alert-rearm">
                            <RotateCcw className="w-3 h-3" />
                          </IconButton>
                        </>
                      }
                    />
                  );
                })}
              </Card>
            )}
            {refused && (
              <p role="status" className="pt-2 font-mono text-[11px] text-bear" data-alerts-refused>
                {refused}
              </p>
            )}
          </Shelf>
        </div>

        <p className="shrink-0 px-3.5 py-2 border-t border-borderSubtle/70 font-mono text-[11px] leading-snug text-textMuted">
          Runs while this tab is open. Nothing leaves this machine.
        </p>
      </motion.aside>
      )}
    </AnimatePresence>
  );
};

export default AlertsDrawer;
