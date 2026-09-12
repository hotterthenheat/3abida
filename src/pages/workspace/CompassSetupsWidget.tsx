/*
==================================================
  SLAYER TERMINAL - PULSE DESK · COMPASS SETUPS
  The ACTUAL scan cards (Noah, 2026-08-17: "the
  screenshot should be a actual one of compass not
  a render") — real SetupScanCard components over
  real scan data. Each copy owns its own scanner ×
  sleeve, exactly like the Compass board's tabs
  (Noah: "i have no option to view the top setups,
  discounted, etc for the odte weekly etc").

  CADENCE: the scan recomputes on the SNAPSHOT
  identity — the desk's 10s scan tier — never on
  the 1s heat pulse, and the card list sits behind
  a memo so pulse ticks cannot re-render it. That
  is what killed the "buffering every few seconds"
  (Noah): refreshes land in place through stable
  card keys, nothing remounts, nothing resizes.
==================================================
*/

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, LayoutGrid } from 'lucide-react';
import SetupScanCard from '../../components/compass/SetupScanCard';
import CampaignAnalysis from '../../components/compass/CampaignAnalysis';
import {
  SCANNERS,
  SLEEVES,
  isScannerEligible,
  type ScannerKey,
  type Setup,
  type SleeveKey,
} from '../../types/compass';
import { expiryFor } from '../../core/calendar';
import { buildCompassView, makeSetup } from '../../data/compass';
import Simulator from '../../core/simulator';
import DropdownSelect from '../../components/ui/DropdownSelect';
import type { WorkspaceCtx } from './registry';

/** What a card click opens — enough to rebuild the campaign live. */
interface CampaignTarget {
  ticker: string;
  strike: number;
  right: 'C' | 'P';
  scanner: ScannerKey;
  sleeve: SleeveKey;
  gradedAt: string;
}

/* THE TAKEOVER (Noah, 2026-08-17 — "look = overlay, monitor = explicit
   pin"): a card click mounts the ACTUAL CampaignAnalysis page over the desk
   in a body portal. The desk underneath is untouched — Back (or Esc) drops
   you home exactly as you left it; "Open in Compass" is the door to the
   real page. z-[70] on purpose: the campaign chart's own fullscreen is
   z-[80] and must stack ABOVE this. */
const CampaignTakeover = ({
  target: root,
  revision,
  onClose,
}: {
  target: CampaignTarget;
  revision: number;
  onClose: () => void;
}) => {
  const navigate = useNavigate();

  /* The TRAIL inside the takeover (Noah, 2026-08-19): a driver row pushes
     another contract on the same book; Back pops to the previous one and,
     at the root, closes. Esc always closes. The render site keys this on the
     root contract, so a fresh card click starts a fresh trail. */
  const [trail, setTrail] = useState<CampaignTarget[]>([root]);
  const target = trail[trail.length - 1];
  const retarget = useCallback((strike: number, right: 'C' | 'P') => {
    setTrail(prev => [...prev, { ...prev[prev.length - 1], strike, right }]);
  }, []);
  const contractLabel = (t: CampaignTarget) =>
    `${t.ticker} ${t.strike % 1 === 0 ? t.strike.toFixed(0) : t.strike.toFixed(2)}${t.right}`;

  /* Two-phase close (Noah, 2026-08-17: Back hard-cut while open was smooth):
     flip to a 200ms opacity fade, then a TIMER unmounts. Deliberately not an
     animation-completion wait — the house AnimatePresence-wedge law: a close
     must never depend on an animation finishing. The timeout always fires;
     the fade is cosmetic on top. Opacity only — a transform here would
     become the containing block for the fullscreen layers inside. */
  const [closing, setClosing] = useState(false);
  const close = useCallback(() => {
    setClosing(prev => {
      if (!prev) window.setTimeout(onClose, 200);
      return true;
    });
  }, [onClose]);

  // Rebuilt live on every desk revision — the same road Compass takes.
  const setup = useMemo(() => {
    try {
      Simulator.ensureTicker(target.ticker);
      const cfg = Simulator.TICKERS[target.ticker];
      return makeSetup(target.ticker, cfg.currentPrice, target.strike, target.right, target.scanner, cfg.iv, target.sleeve);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, revision]);
  const spot = Simulator.TICKERS[target.ticker]?.currentPrice ?? 0;

  // Esc closes — unless the campaign chart's OWN fullscreen (z-[80]) is up,
  // in which case that layer owns the keypress and closes first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('[class*="z-[80]"]')) return;
      close();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [close]);

  if (!setup) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[70] bg-canvas flex flex-col animate-soft-in transition-opacity duration-200 ease-out ${
        closing ? 'opacity-0' : ''
      }`}
    >
      {/* Slim identity strip — where you are, and the door to the real page */}
      {/* Slim identity strip — the way back (the trail's previous contract, or
          the desk), where you are, and the door to the real page (its own
          route since 2026-09-11; the Compass board turns the state into it) */}
      <div className="shrink-0 px-4 lg:px-6 py-2 border-b border-borderSubtle flex items-center gap-4">
        <button
          type="button"
          onClick={trail.length > 1 ? () => setTrail(prev => prev.slice(0, -1)) : close}
          className="group inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-textSecondary hover:text-textPrimary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform duration-200 ease-out group-hover:-translate-x-0.5" /> {trail.length > 1 ? contractLabel(trail[trail.length - 2]) : 'The desk'}
        </button>
        {trail.length > 1 && (
          <button type="button" onClick={close} className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-textSecondary hover:text-textPrimary transition-colors">
            <LayoutGrid className="w-3.5 h-3.5" /> The desk
          </button>
        )}
        <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted">Pulse · setup view</span>
        <button
          onClick={() =>
            navigate('/compass', {
              state: {
                monitor: { ticker: target.ticker, strike: target.strike, right: target.right, scanner: target.scanner, sleeve: target.sleeve },
              },
            })
          }
          className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-borderSubtle bg-ink/[0.02] hover:bg-ink/[0.05] font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary transition-colors"
        >
          Open in Compass <ArrowUpRight className="w-3 h-3" />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 lg:px-6 py-4">
        <div className="flex flex-col gap-4 pb-12">
          <CampaignAnalysis setup={setup} revision={revision} spot={spot} scanner={target.scanner} sleeve={target.sleeve} gradedAt={target.gradedAt} onOpenContract={retarget} />
        </div>
      </div>
    </div>,
    document.body
  );
};

/** The list, memoized: it re-renders only when the SWEEP hands it a new
    ranked array — the desk's 1s pulse never reaches it. Cards update in
    place through stable ids, so a refresh rolls instead of popping. */
const CardList = memo(
  ({ ranked, expiryChip, onOpen }: { ranked: Setup[]; expiryChip: string; onOpen: (s: Setup) => void }) => (
    // Auto-fill grid: columns appear as the panel widens, every card
    // stretches to its cell (a bare div wrapper let the card's <button>
    // shrink to content — Noah's staircase screenshot), rows share height.
    // No cap and no pager: the whole ranking is here, the panel scrolls.
    <div className="flex-1 min-h-0 overflow-y-auto p-2 grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-2 content-start">
      {/* Each card fades in on arrival: a sweep that surfaces new contracts
          reads as a soft refresh, not a hard swap — cards that survive the
          sweep keep their DOM and just roll their numbers. */}
      {ranked.map((s, i) => (
        <div key={s.id} className="animate-soft-in flex flex-col min-w-0 [&>button]:flex-1">
          <SetupScanCard
            setup={s}
            rank={i + 1}
            selected={false}
            onSelect={onOpen}
            onAnalysis={onOpen}
            expiryChip={expiryChip}
          />
        </div>
      ))}
    </div>
  )
);
CardList.displayName = 'CardList';

const CompassSetupsWidget = ({ ctx }: { ctx: WorkspaceCtx }) => {
  const [scanner, setScanner] = useState<ScannerKey>('top-setups');
  const [sleeve, setSleeve] = useState<SleeveKey>('weekly');
  // The open campaign takeover — null means the desk is bare.
  const [target, setTarget] = useState<CampaignTarget | null>(null);

  // A lens the new tenor doesn't sell falls back to the ranking — the same
  // guard the Compass page runs.
  const pickSleeve = (next: SleeveKey) => {
    setSleeve(next);
    if (!isScannerEligible(scanner, next)) setScanner('top-setups');
  };

  /* The scan keys on ctx.snapshot — the reference the desk replaces every
     10s — NOT on ctx itself, which is a fresh object every 1s pulse. The
     desk's own default view is reused when the tabs match it. */
  const view = useMemo(() => {
    if (scanner === 'top-setups' && sleeve === 'weekly') return ctx.setups;
    try {
      return buildCompassView(ctx.snapshot, scanner, Simulator.universeQuotes(ctx.snapshot.ticker), sleeve);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.snapshot, ctx.setups, scanner, sleeve]);

  const ranked = useMemo(
    () => (view ? view.groups.flatMap(g => g.setups).sort((a, b) => b.score - a.score) : []),
    [view]
  );

  const expiryChip = useMemo(() => {
    const dte = SLEEVES.find(s => s.key === sleeve)?.dte ?? 5;
    return expiryFor(dte).label;
  }, [sleeve]);

  // A click INSPECTS — the campaign takes the screen over the desk instead
  // of navigating away (the takeover's own button reaches the real page).
  const open = useCallback(
    (setup: Setup) =>
      setTarget({
        ticker: setup.ticker,
        strike: setup.strike,
        right: setup.right,
        scanner,
        sleeve,
        gradedAt: new Date().toLocaleTimeString('en-GB'),
      }),
    [scanner, sleeve]
  );

  const eligibleScanners = SCANNERS.filter(s => isScannerEligible(s.key, sleeve));

  return (
    <div className="h-full min-h-0 flex flex-col">
      {/* Controls in the body — the header is the drag handle. */}
      <div className="shrink-0 px-2 py-1.5 border-b border-borderSubtle/60 flex items-center gap-2 flex-wrap">
        <DropdownSelect label="Expiry" value={sleeve} options={SLEEVES.map(s => ({ value: s.key, label: s.label, hint: `${s.dte} days out` }))} onChange={pickSleeve} title="How far out the contracts run" testId="setups-sleeve" />
        <DropdownSelect label="Scan" value={scanner} options={eligibleScanners.map(s => ({ value: s.key, label: s.label }))} onChange={setScanner} title="Which scan ranks the cards" testId="setups-scan" />
        <span className="ml-auto font-mono text-[9px] uppercase tracking-widest text-textMuted tnum whitespace-nowrap">
          {ranked.length} setup{ranked.length === 1 ? '' : 's'} · {expiryChip}
        </span>
      </div>
      {ranked.length === 0 ? (
        <div className="flex-1 grid place-items-center font-mono text-[11px] text-textMuted uppercase tracking-widest">
          Nothing cleared the bar on this lens
        </div>
      ) : (
        <CardList ranked={ranked} expiryChip={expiryChip} onOpen={open} />
      )}
      {target && (
        <CampaignTakeover
          key={`${target.ticker}-${target.strike}${target.right}`}
          target={target}
          revision={ctx.revision}
          onClose={() => setTarget(null)}
        />
      )}
    </div>
  );
};

export default CompassSetupsWidget;
