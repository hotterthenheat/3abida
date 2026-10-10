/*
==================================================
  SLAYER TERMINAL - TRACKER PAGE
  Dedicated page for all bookmarked setups.
  Live-updating metrics, two view tabs, and
  quick actions to untrack or review in Compass.
==================================================
*/

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bookmark, Trash2, ArrowUpRight } from 'lucide-react';
import { useTracker } from '../context/TrackerContext';
import { useMarketData } from '../context/MarketDataContext';
import Simulator from '../core/simulator';
import { gradeOfConfidence, makeSetup, setupIdOf } from '../data/compass';
import { adoptRecord, recordOf, statusOf } from '../components/compass/campaignStore';
import { SESSION_CLOSE_MIN, nyDay, nyIsoDate, nyMinutes } from '../core/nyTime';
import { undoable } from '../components/ui/undo';
import type { Setup, SleeveKey } from '../types/compass';
import type { TrackedSetup } from '../types/tracker';
import PageHeader from '../components/ui/PageHeader';
import SegmentedControl from '../components/ui/SegmentedControl';
import Panel from '../components/ui/Panel';
import SignalBadge from '../components/ui/SignalBadge';
import VerdictBadge from '../components/compass/VerdictBadge';
import GradeMeter, { GRADE_INK } from '../components/ui/GradeMeter';
import DataTable, { type Column } from '../components/ui/DataTable';

/* ONE LIST, TWO VIEWS (Noah, 2026-09-28: "what is the difference of the compass tracker between the tracked setups and
   the tracked cons i tried to distinguish them and i really couldnt" — there was none; both tabs drew the same tracked
   setups, once as cards and once as a table). The switch now says what it is. Contracts you WATCH live on the Weigher. */
const TAB_OPTIONS = [
  { value: 'setups', label: 'Cards' },
  { value: 'contracts', label: 'Table' },
] as const;

type TabKey = (typeof TAB_OPTIONS)[number]['value'];

/** Days-to-expiry per SLEEVE — the tenor owns the clock now (2026-08-04).
    Swings carry no calendar at all: they retire on level break, never a date. */
const DTE_BY_SLEEVE: Record<SleeveKey, number> = {
  odte: 0,
  weekly: 5,
  swing: Number.POSITIVE_INFINITY,
  leaps: 365,
};

/** Rows tracked before the sleeve axis carry no sleeve — treat as same-day. */
const sleeveOf = (tracked: TrackedSetup): SleeveKey => tracked.sleeve ?? 'odte';

/** THE CONTRACT'S OWN EXPIRY (the audit's CO-18): a row that carries its real expiry date dies at that day's close in
    New York. Older rows keep the old reckoning — a 0DTE at the end of its tracked day, a weekly a few days later; swings
    never date-expire (Infinity DTE), the floor is their clock. */
function isExpired(tracked: TrackedSetup): boolean {
  if (tracked.expiryDate) {
    const today = nyIsoDate();
    return today > tracked.expiryDate || (today === tracked.expiryDate && nyMinutes() >= SESSION_CLOSE_MIN);
  }
  const dte = DTE_BY_SLEEVE[sleeveOf(tracked)] ?? 0;
  if (!Number.isFinite(dte)) return false;
  const expiryDay = new Date(tracked.trackedAt);
  expiryDay.setHours(0, 0, 0, 0);
  return Date.now() >= expiryDay.getTime() + (dte + 1) * 86_400_000;
}

/* "Oct 9" — the one date style (the audit's X2.9: "TRACKED 10/9/2026", "0DTE · 10/09/26" and "Oct 12 · Mon" in one
   workflow). A calendar date (YYYY-MM-DD) is read as written; an instant is read in New York. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const calendarDay = (iso: string) => {
  const [, m, d] = iso.split('-').map(Number);
  return `${MONTHS[(m || 1) - 1]} ${d || 1}`;
};
/** When the row's contract expires (its real date), else the day it was tracked on */
const expiryWords = (t: TrackedSetup) => (t.expiryDate ? calendarDay(t.expiryDate) : nyDay(t.trackedAt));

/** Rebuild a tracked setup's live data from the simulator. */
function rebuildLive(tracked: TrackedSetup): Setup {
  Simulator.ensureTicker(tracked.ticker);
  const cfg = Simulator.TICKERS[tracked.ticker];
  return makeSetup(
    tracked.ticker,
    cfg.currentPrice,
    tracked.strike,
    tracked.right,
    tracked.scanner,
    cfg.iv,
    sleeveOf(tracked)
  );
}

// ---- Tracked Setup Card (grid view) ----------------------------------------

interface TrackedCardProps {
  tracked: TrackedSetup;
  live: Setup;
  expired: boolean;
  onUntrack: () => void;
  onReview: () => void;
  /** Arrived here via "Open in Tracker" — scroll to this card and flash it
      once so the reader lands ON their campaign, not just on the page. */
  spotlight?: boolean;
}

const TrackedCard = ({ tracked, live, expired, onUntrack, onReview, spotlight = false }: TrackedCardProps) => {
  const moveUp = live.expectedMovePct >= 0;
  const read = gradeOfConfidence(live.confidence);
  /* the targets by the one derivation the board and the page read (campaignStore) */
  const status = statusOf(recordOf(tracked.id));
  const entryMid = tracked.campaign?.mid;
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!spotlight) return;
    cardRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [spotlight]);

  return (
    <div
      ref={cardRef}
      className={`border border-borderSubtle bg-panel rounded-lg overflow-hidden flex flex-col ${spotlight ? 'animate-focus-flash' : ''}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-borderSubtle">
        <span className="font-mono text-sm font-bold text-textPrimary tracking-tight">{live.contract}</span>
        {expired ? <SignalBadge tone="bear">EXPIRED</SignalBadge> : <VerdictBadge verdict={live.verdict} dot />}
        {status.hitLevel != null && !expired && <SignalBadge tone="bull">TP{status.hitLevel} HIT</SignalBadge>}
        <span className="ml-auto font-mono text-[10px] text-textMuted">
          Tracked {nyDay(tracked.trackedAt)}
        </span>
      </div>

      {/* Live metrics grid — the score cell is gone: grades are engine-internal (Noah, 2026-08-16). AN EXPIRED ROW RECEDES
          BY A TEXT TIER, never by opacity (the theme rule — the audit's X12: opacity-50 took the figures under 3:1) */}
      <div className="grid grid-cols-2 gap-px bg-borderSubtle/30" data-expired={expired || undefined}>
        <div className="bg-panel px-3 py-2.5" title="Entry: the premium when the sweep found it · now: the bid/ask midpoint this tick">
          <div className="font-mono text-[9px] uppercase tracking-widest text-textMuted">Premium</div>
          <div className={`mt-0.5 font-mono text-sm font-semibold tnum ${expired ? 'text-textMuted' : 'text-textPrimary'}`}>
            {entryMid != null && (
              <>
                <span className="text-[10px] font-normal text-textMuted">entry </span>${entryMid.toFixed(2)}{' '}
              </>
            )}
            <span className="text-[10px] font-normal text-textMuted">now </span>${live.mid.toFixed(2)}
          </div>
        </div>
        <div className="bg-panel px-3 py-2.5">
          <div className="font-mono text-[9px] uppercase tracking-widest text-textMuted">Expected move</div>
          <div className={`mt-0.5 font-mono text-sm font-semibold tnum ${expired ? 'text-textMuted' : moveUp ? 'text-bull' : 'text-bear'}`}>
            {moveUp ? '+' : ''}{live.expectedMovePct.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* THE READ — or the expiry notice once the contract is dead. It printed "Confidence 92%" over a green bar as long as the
          figure: a score of ours, in public (Noah, 2026-09-19: "change the tracker confidence to the four words"). Now the
          word and the four-step meter (ui/GradeMeter.tsx); the figure stays inside the engine and only SORTS the table. */}
      {expired ? (
        <div className="px-4 py-2.5">
          <span className="font-mono text-[10px] text-textSecondary">
            This contract expired {expiryWords(tracked)} — tracking ended.
          </span>
        </div>
      ) : (
        <div className="px-4 py-2.5">
          <div className="flex items-center justify-between mb-1.5" data-tracker-read={read}>
            <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted flex items-center gap-1.5">
              Confidence <SignalBadge tone="select" dot pulse>Live</SignalBadge>
            </span>
            <span className={`font-mono text-[11px] font-semibold ${GRADE_INK[read]}`}>{read}</span>
          </div>
          <GradeMeter grade={read} />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 py-3 mt-auto border-t border-borderSubtle">
        {expired ? (
          <span
            title="Expired contracts have no live setup to review"
            className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-borderSubtle bg-ink/[0.02] font-mono text-[10px] text-textMuted uppercase tracking-wider cursor-not-allowed select-none"
          >
            Expired
          </span>
        ) : (
          <button
            onClick={onReview}
            className="hit flex items-center gap-1 px-3 py-1.5 rounded-md border border-borderSubtle bg-ink/[0.03] hover:bg-ink/[0.06] font-mono text-[10px] text-textSecondary hover:text-textPrimary uppercase tracking-wider transition-colors"
          >
            <ArrowUpRight className="w-3 h-3" /> Review
          </button>
        )}
        <button
          onClick={onUntrack}
          className="hit flex items-center gap-1 px-3 py-1.5 rounded-md border border-bear/20 bg-bear/5 hover:bg-bear/10 font-mono text-[10px] text-bear uppercase tracking-wider transition-colors ml-auto"
        >
          <Trash2 className="w-3 h-3" /> Untrack
        </button>
      </div>
    </div>
  );
};

// ---- Table columns for the Table view ------------------------------------------

type TableRow = { tracked: TrackedSetup; live: Setup; expired: boolean };

/* THE TABLE'S ROWS OPEN (the audit's CO-8 and X6.4: rows did nothing even with a mouse, and the table had no Review or
   Untrack). A row opens its setup's page; the contract is that door as a real button, so the keys reach it, and the row
   ends on its Untrack. The header words are the cards' (CO-23: "Verdict" over ACTIVE, "Exp. Move"). */
const tableColumns = (open: (r: TableRow) => void, untrack: (r: TableRow) => void): Column<TableRow>[] => [
  {
    key: 'contract',
    header: 'Contract',
    render: r => (
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          open(r);
        }}
        aria-label={`Review ${r.live.contract}`}
        className={`hit inline-flex items-center gap-1 font-semibold hover:text-silver transition-colors ${r.expired ? 'text-textMuted' : 'text-textPrimary'}`}
        data-tracker-review={r.tracked.id}
      >
        {r.live.contract}
        <ArrowUpRight className="w-3 h-3 text-textMuted" aria-hidden />
      </button>
    ),
  },
  {
    key: 'state',
    header: 'State',
    render: r => (r.expired ? <SignalBadge tone="bear">EXPIRED</SignalBadge> : <VerdictBadge verdict={r.live.verdict} />),
  },
  {
    key: 'targets',
    header: 'Targets',
    sortValue: r => statusOf(recordOf(r.tracked.id)).hitLevel ?? 0,
    render: r => {
      const hit = statusOf(recordOf(r.tracked.id)).hitLevel;
      return hit != null ? <SignalBadge tone="bull">TP{hit} HIT</SignalBadge> : <span className="text-textMuted">—</span>;
    },
  },
  {
    key: 'premium',
    header: 'Premium now',
    align: 'right',
    sortValue: r => r.live.mid,
    render: r => <span className={`tnum ${r.expired ? 'text-textMuted' : 'text-textPrimary'}`}>${r.live.mid.toFixed(2)}</span>,
  },
  {
    key: 'confidence',
    header: 'Confidence',
    align: 'right',
    sortValue: r => r.live.confidence,
    /* the word, in its ink — the figure still sorts the column (it may order rows, never reach a digit) */
    render: r => {
      const g = gradeOfConfidence(r.live.confidence);
      return <span className={`font-semibold ${r.expired ? 'text-textMuted' : GRADE_INK[g]}`}>{g}</span>;
    },
  },
  {
    key: 'expMove',
    header: 'Expected move',
    align: 'right',
    sortValue: r => r.live.expectedMovePct,
    render: r => {
      const up = r.live.expectedMovePct >= 0;
      return (
        <span className={`tnum ${r.expired ? 'text-textMuted' : up ? 'text-bull' : 'text-bear'}`}>
          {up ? '+' : ''}{r.live.expectedMovePct.toFixed(1)}%
        </span>
      );
    },
  },
  {
    key: 'tracked',
    header: 'Tracked',
    render: r => <span className="text-textMuted">{nyDay(r.tracked.trackedAt)}</span>,
  },
  {
    key: 'untrack',
    header: '',
    align: 'right',
    render: r => (
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          untrack(r);
        }}
        aria-label={`Untrack ${r.live.contract}`}
        title="Untrack — Undo stays open a few seconds"
        className="hit inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-bear/90 hover:text-bear transition-colors"
      >
        <Trash2 className="w-3 h-3" /> Untrack
      </button>
    ),
  },
];

// ---- Main Page Component ---------------------------------------------------

/** `embedded`: under the Compass shell (2026-09-13) — the shell wears the head, the page starts at its tabs */
const Tracker = ({ embedded = false }: { embedded?: boolean } = {}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { trackedSetups, untrackSetup, restoreTracked } = useTracker();
  const { marketData } = useMarketData();
  const [tab, setTab] = useState<TabKey>('setups');
  /* The campaign "Open in Tracker" arrives with the setup id — captured once
     so the flash doesn't replay on every later state change. */
  const [focusId] = useState<string | null>(() => (location.state as { focus?: string } | null)?.focus ?? null);

  /* the campaigns the rows were tracked with join the store, so the targets read the board's derivation */
  useEffect(() => {
    for (const t of trackedSetups) if (t.campaign) adoptRecord(t.campaign);
  }, [trackedSetups]);

  // Rebuild all tracked setups with live data
  const liveData = useMemo(() => {
    if (!marketData) return [];
    return trackedSetups.map(tracked => ({
      tracked,
      live: rebuildLive(tracked),
      expired: isExpired(tracked),
    }));
  }, [trackedSetups, marketData]);

  // Straight into review mode on this exact setup — not the browse feed.
  // The SLEEVE rides along (2026-08-29): a setup's id embeds scanner AND
  // sleeve, so without it Compass rebuilt the campaign on its current tenor —
  // the Analysis page opened on a DIFFERENT campaign (wrong targets, wrong
  // clock) that didn't even read as tracked.
  /* STRAIGHT TO THE SETUP'S PAGE (the audit's CO-17: it went to the board with state and the board redirected, so the
     board loaded first) */
  const handleReview = useCallback(
    (tracked: TrackedSetup) => {
      navigate(`/compass/${setupIdOf({ ticker: tracked.ticker, strike: tracked.strike, right: tracked.right, scanner: tracked.scanner, sleeve: sleeveOf(tracked) })}`);
    },
    [navigate]
  );
  /* UNTRACK AT ONCE, WITH THE WAY BACK (the audit's X5.9): the row goes, and the chip in the toast column puts it back in
     its place */
  const handleUntrack = useCallback(
    (tracked: TrackedSetup) => {
      const at = trackedSetups.findIndex(t => t.id === tracked.id);
      untrackSetup(tracked.id);
      undoable({ label: `Untracked ${tracked.contract}`, undo: () => restoreTracked(tracked, at), key: `untrack-${tracked.id}` });
    },
    [trackedSetups, untrackSetup, restoreTracked]
  );
  const columns = useMemo(() => tableColumns(r => handleReview(r.tracked), r => handleUntrack(r.tracked)), [handleReview, handleUntrack]);
  const openRow = useCallback((r: TableRow) => handleReview(r.tracked), [handleReview]);
  const rowKey = useCallback((r: TableRow) => r.tracked.id, []);

  return (
    <>
      {!embedded && (
        <PageHeader
          breadcrumb={['Terminal', 'Tracker']}
          title="Setup Tracker"
          subtitle="Every setup you track, with its live figures — as cards or as a table"
        />
      )}

      {/* Tabs */}
      <div className="flex items-center gap-3">
        <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-textMuted">View</span>
        <SegmentedControl
          ariaLabel="Tracker view"
          options={TAB_OPTIONS}
          value={tab}
          onChange={setTab}
        />
        <span className="font-mono text-[10px] text-textMuted">
          {trackedSetups.length} tracked setup{trackedSetups.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Empty state */}
      {trackedSetups.length === 0 ? (
        <Panel className="w-full" bodyClassName="flex flex-col items-center justify-center py-16 gap-4">
          <Bookmark className="w-10 h-10 text-textMuted/40" />
          <span className="font-mono text-[11px] text-textMuted uppercase tracking-widest">
            No tracked setups yet
          </span>
          <p className="text-[12px] text-textSecondary text-center max-w-sm leading-relaxed">
            Go to{' '}
            <button
              onClick={() => navigate('/compass')}
              className="text-select hover:underline"
            >
              Compass
            </button>
            , open a setup, and press <strong className="text-textPrimary">Track setup</strong> to keep it here.
          </p>
        </Panel>
      ) : tab === 'setups' ? (
        /* ---- Grid of tracked setup cards ---- */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-view-in">
          {liveData.map(({ tracked, live, expired }) => (
            <TrackedCard
              key={tracked.id}
              tracked={tracked}
              live={live}
              expired={expired}
              onUntrack={() => handleUntrack(tracked)}
              onReview={() => handleReview(tracked)}
              spotlight={tracked.id === focusId}
            />
          ))}
        </div>
      ) : (
        /* ---- The same setups, as a table ---- */
        <Panel title="Tracked setups" flush className="w-full animate-view-in">
          <DataTable columns={columns} rows={liveData} rowKey={rowKey} onRowClick={openRow} maxHeight="520px" />
        </Panel>
      )}
    </>
  );
};

export default Tracker;
