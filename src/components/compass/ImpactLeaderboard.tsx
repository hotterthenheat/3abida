import { useId, useMemo, useState, type ReactNode } from 'react';
import { LayoutGroup, motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import Term from '../ui/Term';
import AnimatedNumber from '../ui/AnimatedNumber';
import ContractLabel from '../ui/ContractLabel';
import { fmtUsd } from '../../data/gex';
import type { ImpactMetric, ImpactRow } from '../../types/compass';
import { Name } from '../ui/Name';

interface ImpactLeaderboardProps {
  /** Whose book this is — the selected card's name */
  ticker: string;
  /** Why this book — e.g. "#3 GOOGL 162.50P selected" — the subtitle says so */
  note?: string;
  rows: ImpactRow[];
  /** Opens the contract's own analysis page — the same door the setup cards use. */
  onOpen: (row: ImpactRow) => void;
}

/* The four reasons a contract carries weight (Mo, 2026-08-19). The column
   HEADERS are the ranking control — click one and the rail re-ranks by it —
   so the same four words never appear twice (a tab strip above a header row
   would have said them both times). Distance ranks NEAREST first. */
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

const FACTS: {
  key: ImpactMetric;
  label: ReactNode;
  /** The figure itself — rolled by AnimatedNumber, formatted each frame */
  raw: (r: ImpactRow) => number;
  format: (v: number) => string;
  /** Sign-tinted where the sign IS the information (exposure). */
  tone?: (r: ImpactRow) => string;
}[] = [
  { key: 'gamma', label: <Term k="Gamma share">Gamma</Term>, raw: r => r.gamma, format: v => `${v.toFixed(1)}%` },
  { key: 'voloi', label: <Term k="V/OI">Vol/OI</Term>, raw: r => r.volOi, format: v => `${v.toFixed(2)}×` },
  {
    key: 'distance',
    label: <Term k="From spot">From spot</Term>,
    raw: r => r.distPct,
    // At the money reads 0.0%, never "-0.0%" — a rolled value sits near zero often
    format: v => {
      const d = Math.abs(v) < 0.05 ? 0 : v;
      return `${d > 0 ? '+' : ''}${d.toFixed(1)}%`;
    },
    /* Above the market green, below it red — the sign IS the information */
    tone: r => (Math.abs(r.distPct) < 0.05 ? 'text-textPrimary' : r.distPct > 0 ? 'text-bull' : 'text-bear'),
  },
  {
    key: 'exposure',
    label: <Term k="Exposure">Exposure</Term>,
    raw: r => r.exposureUsd,
    format: fmtUsd,
    // Sim side-coding: negative = dealers absorb (bull), positive = amplify (bear)
    tone: r => (r.exposureUsd < 0 ? 'text-bull' : 'text-bear'),
  },
];

const magnitude = (r: ImpactRow, metric: ImpactMetric): number => {
  switch (metric) {
    case 'gamma':
      return r.gamma;
    case 'voloi':
      return r.volOi;
    case 'distance':
      return Math.abs(r.distPct);
    case 'exposure':
      return Math.abs(r.exposureUsd);
  }
};

/* A RAIL beside the board (Noah, 2026-08-17: "a side section next to the
   setups"). It is ONE name's book — the SELECTED card's — and says so; it
   never claims to drive a 16-name board (Noah, 2026-08-19). "Driving the
   setup" lives on the analysis page (SetupDrivers), where there is one
   setup for it to be true of.
   Each row is the contract, then the four facts under aligned headers; the
   ranked column reads bright and carries the magnitude bar, normalized to
   the leader. COLOR = INFORMATION: the side letter speaks the market's
   language (C bull, P bear), the bar is side-tinted, and exposure wears its
   sign. The whole row is the door to the contract's analysis. */
const ImpactLeaderboard = ({ ticker, note, rows, onOpen }: ImpactLeaderboardProps) => {
  const [metric, setMetric] = useState<ImpactMetric>('gamma');
  const scope = useId();

  const ranked = useMemo(() => {
    const sorted = [...rows].sort((a, b) =>
      metric === 'distance' ? magnitude(a, metric) - magnitude(b, metric) : magnitude(b, metric) - magnitude(a, metric)
    );
    return sorted.map((r, i) => ({ ...r, rank: i + 1 }));
  }, [rows, metric]);

  // Bar length: share of the leader — or, for distance, how much NEARER than
  // the farthest row (the leader is the closest strike, so it fills).
  const extremes = useMemo(() => {
    const mags = ranked.map(r => magnitude(r, metric));
    return { max: Math.max(1e-9, ...mags) };
  }, [ranked, metric]);
  const barPct = (r: ImpactRow) => {
    const m = magnitude(r, metric);
    const share = metric === 'distance' ? 1 - m / extremes.max : m / extremes.max;
    return Math.max(6, share * 100);
  };

  const open = (r: ImpactRow) => onOpen(r);

  return (
    /* THE RAIL'S BOX in the house grammar (the walk, 2026-09-11): the 15px
       title over one line, then the window. It ADOPTS the board's height
       (the wrapper is absolute-inset in Compass): the rows scroll inside,
       and the bottom edge lands on the board's line. */
    <div className="relative border border-borderSubtle rounded-md overflow-hidden bg-panel flex flex-col w-full flex-1 min-h-0" data-compass-rail={ticker}>
      <div className="px-5 pt-4 pb-3">
        <div className="h-6 flex items-center gap-3">
          <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">Heaviest contracts</h3>
        </div>
        <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">
          on <Name t={ticker} size={11} />
          {note ? ` · ${note}` : ''} · a column head ranks by it · a row opens the contract
        </p>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto border-t border-borderSubtle">
        {/* Column headers = ranking control. Child tier (Noah, 2026-08-17):
            in-panel controls wear the underline glide, one tier quieter than
            a parent pill. Same grid as the rows beneath, so the numbers sit
            under their names — and it lives INSIDE the scroller, sticky, so
            the scrollbar narrows header and rows alike (outside it, the
            columns drifted by the scrollbar's width). */}
        <LayoutGroup id={scope}>
          <div
            role="group"
            aria-label="Rank by"
            className="sticky top-0 z-10 grid grid-cols-4 gap-2 px-3 pt-2 pb-1.5 border-b border-borderSubtle bg-panel"
          >
            {FACTS.map(f => {
              const active = f.key === metric;
              return (
                <button
                  key={f.key}
                  aria-pressed={active}
                  onClick={() => setMetric(f.key)}
                  className="relative pb-1 text-left font-mono text-[9px] uppercase tracking-widest transition-colors"
                >
                  <span className={active ? 'text-textPrimary' : 'text-textMuted hover:text-textSecondary'}>{f.label}</span>
                  {active && (
                    <motion.span
                      layoutId="impact-rank-line"
                      className="absolute left-0 right-0 bottom-0 h-px bg-textPrimary"
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </LayoutGroup>

        {/* Rows are keyed by RANK SLOT, not contract (Noah, 2026-08-19: the
            rail must "transition smoothly esp the slider and numbers from
            one ticker to another"). A keyed-by-contract list remounted every
            row on a ticker change and everything snapped; a slot persists
            across the swap, so each figure ROLLS to its new value, the bar
            glides to its new length, and only the name cross-fades —
            the persist-DOM doctrine the campaign card already follows. */}
        {ranked.map(r => {
          const isCall = r.right === 'C';
          return (
            <div
              key={`slot-${r.rank}`}
              role="button"
              tabIndex={0}
              onClick={() => open(r)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  open(r);
                }
              }}
              title={`Open ${r.contract} ${r.expiry} — full analysis`}
              className="group px-3 py-2 border-b border-borderSubtle/50 last:border-0 cursor-pointer transition-colors hover:bg-ink/[0.02] focus-visible:bg-ink/[0.03] focus-visible:outline-none"
            >
              {/* Identity line — rank, contract, expiry, and the door */}
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-6 shrink-0 font-mono text-[10px] text-textSecondary tnum">#{r.rank}</span>
                {/* The name is the one thing that can't roll — it soft-fades
                    in on change (keyed), the way the campaign title does.
                    THE WHOLE CONTRACT IN ITS SIDE'S INK (Noah, 2026-09-12):
                    the board card's pill, not a coloured letter on a white
                    name — one rule, components/ui/ContractLabel. */}
                <span key={r.contract} className="min-w-0 animate-soft-in">
                  <ContractLabel contract={r.contract} right={r.right} logo={r.contract.split(' ')[0]} size="sm" />
                </span>
                <span className="font-mono text-[9px] text-textSecondary tnum">{r.expiry}</span>
                <ArrowUpRight
                  aria-hidden="true"
                  className="ml-auto w-3 h-3 shrink-0 text-textSecondary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                />
              </div>

              {/* The four facts, under their headers; the ranked one bright with its bar */}
              <div className="mt-1 grid grid-cols-4 gap-2">
                {FACTS.map(f => {
                  const active = f.key === metric;
                  /* THE INFO IS GREEN, WHITE OR RED — NEVER GREY (Noah, 2026-09-12:
                     "the info should be green white or red not the grey because
                     its hard to see"). A signed fact wears its sign; a magnitude
                     wears white; the ranked one is bold on top of that. */
                  const tone = f.tone?.(r) ?? 'text-textPrimary';
                  return (
                    <span key={f.key} className="min-w-0 flex flex-col gap-1">
                      {/* Figures ROLL between values; the exposure ink eases
                          between its sign colors rather than snapping. */}
                      <span className={`font-mono text-[11px] tnum truncate transition-colors duration-500 ${tone} ${active ? 'font-semibold' : ''}`}>
                        <AnimatedNumber value={f.raw(r)} format={f.format} />
                      </span>
                      {active && (
                        <span className="relative w-full h-[2px] rounded-full bg-ink/[0.07] overflow-hidden">
                          {/* Compositor transform, never width — the live-meter
                              rule. Full-width track scaled from the left. */}
                          <span
                            className={`block h-full w-full rounded-full origin-left transition-[transform,background-color] duration-700 ${isCall ? 'bg-bull/80' : 'bg-bear/75'}`}
                            style={{ transform: `scaleX(${barPct(r) / 100})`, transitionTimingFunction: EASE }}
                          />
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ImpactLeaderboard;
