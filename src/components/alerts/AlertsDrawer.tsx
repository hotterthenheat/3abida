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

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Activity, ArrowUpRight, Bell, BellOff, Code2, Crosshair, Crown, Droplets, Layers, MoveHorizontal, Newspaper, Repeat, RotateCcw, X,
  type LucideIcon,
} from 'lucide-react';
import Simulator from '../../core/simulator';
import { useMarketData } from '../../context/MarketDataContext';
import DropdownSelect, { type DropdownOption } from '../ui/DropdownSelect';
import CompanyLogo from '../ui/CompanyLogo';
import NewAlert from './NewAlert';
import {
  MAX_ALERTS, clearAlerts, clearFiredLog, firedWords, markSeenAll,
  rearmFromRecord, removeAlert, useAllAlerts, waitingWords, type Alert, type AlertKind, type FiredRecord,
} from '../gex/alertStore';
import { ALERT, alpha } from '../gex/paletteInk';
import { closeAlertsDrawer, useAlertsDrawer } from '../../data/alertsDrawer';
import { Name } from '../ui/Name';

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
    case 'price':
    case 'indicator':
      return { label: 'Chart', to: '/pinpoint' };
    case 'level':
    case 'gexflip':
    case 'newsupreme':
    case 'wallmove':
      return { label: 'Targets', to: '/pinpoint/targets' };
    case 'flow':
      return { label: 'Tape', to: '/trace/live-tape' };
    case 'news':
      return { label: 'News', to: '/record/news' };
    /* a script's alert opens the pane it was armed on */
    case 'script':
      return a.paneId.startsWith('terrain') ? { label: 'Terrain', to: '/terrain' }
        : a.paneId === 'weigher' ? { label: 'Weigher', to: '/weigher' }
        : a.paneId.startsWith('pulse') ? { label: 'Pulse', to: '/pulse' }
        : { label: 'Map', to: '/pinpoint' };
  }
};

const hhmm = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const hhmmss = (ms: number) => new Date(ms).toLocaleTimeString('en-GB');
const ALL = 'all';

/* ---- the parts ------------------------------------------------------------------------ */

/* The shelf heads read as heads, not footnotes (Noah, 2026-09-10: "a bit too muted") */
const Shelf = ({ label, count, action, onAction, children }: { label: string; count: number; action?: string; onAction?: () => void; children: React.ReactNode }) => (
  <section className="px-3.5 pt-4" data-alerts-shelf={label.toLowerCase()}>
    <div className="flex items-baseline gap-1.5 pb-2">
      <span className="text-[12px] font-semibold text-textPrimary">{label}</span>
      <span className="font-mono text-[10px] tnum text-textSecondary">{count}</span>
      {action && count > 0 && (
        <button onClick={onAction} className="ml-auto font-mono text-[9px] uppercase tracking-wider text-textSecondary hover:text-textPrimary transition-colors">
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
    <Name t={ticker} size={14} className="font-mono text-[11px] font-bold text-textPrimary" />
    <span className="font-mono text-[9px] tnum text-textMuted">{note}</span>
  </div>
);

/** The door back to the surface that shows the alert — a small bordered pill */
const Door = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    title={`Open the ${label.toLowerCase()} on this name`}
    className="shrink-0 inline-flex items-center gap-1 h-6 px-2 rounded-md border border-borderSubtle bg-chip/70 font-mono text-[9px] uppercase tracking-wider text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors"
    data-alert-door
  >
    {label}
    <ArrowUpRight className="w-2.5 h-2.5" />
  </button>
);

const IconButton = ({ onClick, label, title, children, testId }: { onClick: () => void; label: string; title: string; children: React.ReactNode; testId: string }) => (
  <button onClick={onClick} aria-label={label} title={title} className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md border border-transparent text-textMuted hover:text-textPrimary hover:border-borderSubtle hover:bg-ink/[0.04] transition-colors" {...{ [testId]: true }}>
    {children}
  </button>
);

/** One alert, one shape everywhere: the kind's icon, the words, the state line, the door, the action */
const Row = ({ kind, alerted, ticker, words, state, door, action, testId }: { kind: AlertKind; alerted: boolean; ticker?: string; words: string; state: string; door: { label: string; onClick: () => void }; action: React.ReactNode; testId: Record<string, string> }) => {
  const Icon = KIND_ICON[kind];
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 border-b border-borderSubtle/60 last:border-b-0 hover:bg-ink/[0.03] transition-colors" {...testId} data-alert-kind={kind}>
      <span className="shrink-0 w-6 h-6 rounded-md border flex items-center justify-center" style={alerted ? { color: ALERT, borderColor: alpha(ALERT, 0.33), background: alpha(ALERT, 0.08) } : undefined} data-alert-icon={alerted ? 'alerted' : 'waiting'}>
        <Icon className={`w-3.5 h-3.5 ${alerted ? '' : 'text-textMuted'}`} strokeWidth={1.75} />
      </span>
      <span className="flex-1 min-w-0 flex flex-col gap-[2px]">
        <span className="flex items-center gap-1.5 min-w-0">
          {ticker && <Name t={ticker} size={12} className="shrink-0 font-mono text-[10px] font-bold text-textPrimary" />}
          <span className="truncate text-[12px] text-textPrimary">{words}</span>
        </span>
        <span className={`font-mono text-[9px] tnum ${alerted ? '' : 'text-textMuted'}`} style={alerted ? { color: ALERT } : undefined}>
          {state}
        </span>
      </span>
      <Door label={door.label} onClick={door.onClick} />
      {action}
    </div>
  );
};

const Empty = ({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) => (
  <div className="rounded-md border border-dashed border-borderSubtle/70 px-4 py-5 flex flex-col items-center gap-2 text-center">
    <Icon className="w-4 h-4 text-textMuted" strokeWidth={1.5} />
    <p className="text-[11px] leading-snug text-textMuted max-w-[280px]">{children}</p>
  </div>
);

/* ---- the drawer ------------------------------------------------------------------------ */

const AlertsDrawer = () => {
  const open = useAlertsDrawer();
  const names = useAllAlerts();
  const { activeTicker, changeTicker } = useMarketData();
  const navigate = useNavigate();
  const [name, setName] = useState<string>(ALL);
  const [refused, setRefused] = useState('');

  /* Opened, or something alerted while it was open — the reader is looking */
  useEffect(() => {
    if (open) markSeenAll();
  }, [open, names]);

  /* Esc — after any layer inside it (a menu) had its say, before the takeovers behind */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      closeAlertsDrawer();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

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

  const armAgain = (ticker: string, r: FiredRecord) => {
    const spot = Simulator.TICKERS[ticker]?.currentPrice ?? 0;
    if (rearmFromRecord(ticker, r.key, spot, Date.now())) setRefused('');
    else setRefused(`Already watching that on ${ticker}, or ${ticker} has its ${MAX_ALERTS} already`);
  };

  return (
    <AnimatePresence>
      {open && <div key="scrim" className="fixed inset-0 z-[87]" onClick={closeAlertsDrawer} aria-hidden data-alerts-scrim />}
      {/* TRANSLUCENT (Noah, 2026-09-10: "the alerts sidetab should be translucent") — the draw rail's glass: the page shows through, blurred */}
      {open && (
      <motion.aside
        key="drawer"
        initial={{ x: 48, opacity: 0 }}
        animate={glideIn}
        exit={glideOut}
        className="fixed top-0 right-0 bottom-0 z-[88] w-[400px] max-w-[92vw] border-l border-borderMuted bg-panel/75 backdrop-blur-md backdrop-saturate-150 flex flex-col shadow-[-16px_0_48px_rgba(0,0,0,0.45)]"
        aria-label="Alerts"
        data-alerts-drawer
      >
        {/* THE HEAD — the house head: the icon in its 24px chip, the name, the facts */}
        <div className="h-12 shrink-0 flex items-center gap-2.5 px-3.5 border-b border-borderSubtle/70">
          <span className="w-6 h-6 rounded-md border border-borderSubtle bg-ink/[0.03] flex items-center justify-center shrink-0" aria-hidden>
            <Bell className="w-3.5 h-3.5 text-textSecondary" strokeWidth={1.75} />
          </span>
          <span className="text-[14px] font-semibold text-textPrimary">Alerts</span>
          <span className="font-mono text-[10px] tnum text-textMuted" data-alerts-facts>
            <span className="text-textSecondary">{setTotal}</span> set · <span className={firedTotal ? 'text-textSecondary' : ''}>{firedTotal}</span> alerted
          </span>
          <button onClick={closeAlertsDrawer} aria-label="Close the alerts" title="Close (Esc)" className="ml-auto shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md text-textMuted hover:text-textPrimary hover:bg-ink/[0.06] transition-colors" data-alerts-close>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* "This name" is a filter, never another list */}
        <div className="shrink-0 flex items-center gap-2 px-3.5 py-2 border-b border-borderSubtle/60">
          <DropdownSelect label="Name" value={pick} options={nameOptions} onChange={setName} />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pb-4" data-alerts-body>
          <Shelf label="Set" count={waitingCount} action="Clear" onAction={() => waiting.forEach(w => clearAlerts(w.ticker))}>
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
                      return (
                        <Row
                          key={a.id}
                          kind={a.kind}
                          alerted={false}
                          words={waitingWords(a)}
                          state={a.setAt ? `waiting · set ${hhmm(a.setAt)}` : 'waiting'}
                          door={{ label: door.label, onClick: () => go(w.ticker, door.to) }}
                          testId={{ 'data-alert-row': a.id }}
                          action={
                            <IconButton onClick={() => removeAlert(w.ticker, a.id)} label={`Take the alert off — ${waitingWords(a)}`} title="Take it off" testId="data-alert-remove">
                              <X className="w-3 h-3" />
                            </IconButton>
                          }
                        />
                      );
                    })}
                  </Card>
                ))}
              </div>
            )}
          </Shelf>

          <Shelf label="Alerted" count={fired.length} action="Clear" onAction={() => shown.forEach(n => clearFiredLog(n.ticker))}>
            {fired.length === 0 ? (
              <Empty icon={Bell}>Nothing has alerted{pick !== ALL ? ` on ${pick}` : ''} while this tab has been open.</Empty>
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
                      state={`alerted ${hhmmss(r.at)}`}
                      door={{ label: door.label, onClick: () => go(ticker, door.to) }}
                      testId={{ 'data-fired-row': r.key }}
                      action={
                        <IconButton onClick={() => armAgain(ticker, r)} label={`Set this alert again — ${firedWords(r.alert, ticker)}`} title="Set it again" testId="data-alert-rearm">
                          <RotateCcw className="w-3 h-3" />
                        </IconButton>
                      }
                    />
                  );
                })}
              </Card>
            )}
            {refused && (
              <p role="status" className="pt-2 font-mono text-[9px] text-bear" data-alerts-refused>
                {refused}
              </p>
            )}
          </Shelf>
        </div>

        <NewAlert onRefused={setRefused} />

        <p className="shrink-0 px-3.5 py-2 border-t border-borderSubtle/70 font-mono text-[9px] leading-snug text-textMuted">
          Runs while this tab is open. Nothing is sent anywhere.
        </p>
      </motion.aside>
      )}
    </AnimatePresence>
  );
};

/*
  SETTING ONE FROM HERE. Every alert in the terminal is armed from the
  surface that shows the thing — a price off the chart, a wall off the
  levels — which is the right default and leaves one gap: a reader who
  knows what they want has to go find a page to say it on. This is that
  sentence, said here.

  It takes the three kinds that need no context to be meaningful. A level
  or an indicator alert without the pane it is read off would be a guess
  at what the reader meant, so those stay where they can be pointed at.
*/

export default AlertsDrawer;
