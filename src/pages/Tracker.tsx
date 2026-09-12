/*
==================================================
  SLAYER TERMINAL - TRACKER PAGE
  Dedicated page for all bookmarked setups.
  Live-updating metrics, two view tabs, and
  quick actions to untrack or review in Compass.
==================================================
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bookmark, Trash2, ArrowUpRight } from 'lucide-react';
import { useTracker } from '../context/TrackerContext';
import { useMarketData } from '../context/MarketDataContext';
import Simulator from '../core/simulator';
import { makeSetup } from '../data/compass';
import type { Setup, SleeveKey } from '../types/compass';
import type { TrackedSetup } from '../types/tracker';
import PageHeader from '../components/ui/PageHeader';
import SegmentedControl from '../components/ui/SegmentedControl';
import Panel from '../components/ui/Panel';
import SignalBadge from '../components/ui/SignalBadge';
import VerdictBadge from '../components/compass/VerdictBadge';
import DataTable, { type Column } from '../components/ui/DataTable';

const TAB_OPTIONS = [
  { value: 'setups', label: 'Tracked Setups' },
  { value: 'contracts', label: 'Tracked Contracts' },
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

/** A 0DTE contract dies at the end of its tracked day; a weekly a few days
    later. Swings never date-expire (Infinity DTE) — the floor is their clock. */
function isExpired(tracked: TrackedSetup): boolean {
  const dte = DTE_BY_SLEEVE[sleeveOf(tracked)] ?? 0;
  if (!Number.isFinite(dte)) return false;
  const expiryDay = new Date(tracked.trackedAt);
  expiryDay.setHours(0, 0, 0, 0);
  return Date.now() >= expiryDay.getTime() + (dte + 1) * 86_400_000;
}

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
        <span className="ml-auto font-mono text-[9px] text-textMuted uppercase tracking-wider">
          Tracked {new Date(tracked.trackedAt).toLocaleDateString()}
        </span>
      </div>

      {/* Live metrics grid — the score cell is gone: grades are
          engine-internal (Noah, 2026-08-16) */}
      <div className={`grid grid-cols-2 gap-px bg-borderSubtle/30 ${expired ? 'opacity-50' : ''}`}>
        <div className="bg-panel px-3 py-2.5">
          <div className="font-mono text-[9px] uppercase tracking-widest text-textMuted">Premium</div>
          <div className="mt-0.5 font-mono text-sm font-semibold text-textPrimary tnum">${live.mid.toFixed(2)}</div>
        </div>
        <div className="bg-panel px-3 py-2.5">
          <div className="font-mono text-[9px] uppercase tracking-widest text-textMuted">Exp. Move</div>
          <div className={`mt-0.5 font-mono text-sm font-semibold tnum ${moveUp ? 'text-bull' : 'text-bear'}`}>
            {moveUp ? '+' : ''}{live.expectedMovePct}%
          </div>
        </div>
      </div>

      {/* Confidence bar — or the expiry notice once the contract is dead */}
      {expired ? (
        <div className="px-4 py-2.5">
          <span className="font-mono text-[10px] text-textSecondary">
            This contract expired {new Date(tracked.trackedAt).toLocaleDateString()} — tracking ended.
          </span>
        </div>
      ) : (
        <div className="px-4 py-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted flex items-center gap-1.5">
              Confidence <SignalBadge tone="select" dot pulse>Live</SignalBadge>
            </span>
            <span className="font-mono text-[10px] font-semibold text-textPrimary tnum">{live.confidence}%</span>
          </div>
          <div className="h-1 rounded-full bg-ink/[0.06] overflow-hidden">
            <span className="block h-full rounded-full bg-bull/95 transition-all duration-500" style={{ width: `${live.confidence}%` }} />
          </div>
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
            className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-borderSubtle bg-ink/[0.03] hover:bg-ink/[0.06] font-mono text-[10px] text-textSecondary hover:text-textPrimary uppercase tracking-wider transition-colors"
          >
            <ArrowUpRight className="w-3 h-3" /> Review
          </button>
        )}
        <button
          onClick={onUntrack}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-bear/20 bg-bear/5 hover:bg-bear/10 font-mono text-[10px] text-bear uppercase tracking-wider transition-colors ml-auto"
        >
          <Trash2 className="w-3 h-3" /> Untrack
        </button>
      </div>
    </div>
  );
};

// ---- Table columns for "Tracked Contracts" tab -----------------------------

const TABLE_COLUMNS: Column<{ tracked: TrackedSetup; live: Setup; expired: boolean }>[] = [
  {
    key: 'contract',
    header: 'Contract',
    render: r => <span className="font-semibold text-textPrimary">{r.live.contract}</span>,
  },
  {
    key: 'verdict',
    header: 'Verdict',
    render: r => (r.expired ? <SignalBadge tone="bear">EXPIRED</SignalBadge> : <VerdictBadge verdict={r.live.verdict} />),
  },
  {
    key: 'premium',
    header: 'Premium',
    align: 'right',
    sortValue: r => r.live.mid,
    render: r => <span className="text-textPrimary tnum">${r.live.mid.toFixed(2)}</span>,
  },
  {
    key: 'confidence',
    header: 'Confidence',
    align: 'right',
    sortValue: r => r.live.confidence,
    render: r => <span className="text-textPrimary tnum">{r.live.confidence}%</span>,
  },
  {
    key: 'expMove',
    header: 'Exp. Move',
    align: 'right',
    sortValue: r => r.live.expectedMovePct,
    render: r => {
      const up = r.live.expectedMovePct >= 0;
      return (
        <span className={`tnum ${up ? 'text-bull' : 'text-bear'}`}>
          {up ? '+' : ''}{r.live.expectedMovePct}%
        </span>
      );
    },
  },
  {
    key: 'tracked',
    header: 'Tracked',
    render: r => (
      <span className="text-textMuted">
        {new Date(r.tracked.trackedAt).toLocaleDateString()}
      </span>
    ),
  },
];

// ---- Main Page Component ---------------------------------------------------

const Tracker = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { trackedSetups, untrackSetup } = useTracker();
  const { marketData } = useMarketData();
  const [tab, setTab] = useState<TabKey>('setups');
  /* The campaign "Open in Tracker" arrives with the setup id — captured once
     so the flash doesn't replay on every later state change. */
  const [focusId] = useState<string | null>(() => (location.state as { focus?: string } | null)?.focus ?? null);

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
  const handleReview = (tracked: TrackedSetup) => {
    navigate('/compass', {
      state: {
        monitor: {
          ticker: tracked.ticker,
          strike: tracked.strike,
          right: tracked.right,
          scanner: tracked.scanner,
          sleeve: sleeveOf(tracked),
        },
      },
    });
  };

  return (
    <>
      <PageHeader
        breadcrumb={['Terminal', 'Tracker']}
        title="Setup Tracker"
        subtitle="Bookmarked setups with live-updating metrics — monitor your watchlist"
      />

      {/* Tabs */}
      <div className="flex items-center gap-3">
        <SegmentedControl
          ariaLabel="Tracker view"
          options={TAB_OPTIONS}
          value={tab}
          onChange={setTab}
        />
        <span className="font-mono text-[10px] text-textMuted uppercase tracking-wider">
          {trackedSetups.length} tracked
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
            , pick a setup, and click <strong className="text-textPrimary">Track Setup +</strong> to bookmark it here.
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
              onUntrack={() => untrackSetup(tracked.id)}
              onReview={() => handleReview(tracked)}
              spotlight={tracked.id === focusId}
            />
          ))}
        </div>
      ) : (
        /* ---- Table view of tracked contracts ---- */
        <Panel title="Tracked Contracts" flush className="w-full animate-view-in">
          <DataTable
            columns={TABLE_COLUMNS}
            rows={liveData}
            rowKey={r => r.tracked.id}
            maxHeight="520px"
          />
        </Panel>
      )}
    </>
  );
};

export default Tracker;
