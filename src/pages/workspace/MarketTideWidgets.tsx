/*
==================================================
  SLAYER TERMINAL - THE MARKET'S PANELS
  (workspace/MarketTideWidgets.tsx)

  The four readings that answer "what kind of day
  is this" — the indices, the sectors, the breadth,
  the movers. Every other panel on this desk is
  about one name; these are about the tape.
==================================================

  NO METRIC CARDS. Four big numbers in four rounded boxes is the SaaS
  dashboard this terminal is not, and it is also the least informative
  possible use of the space: a number with nothing to compare it to. Each
  panel here puts its figures in a shape that carries a comparison — the
  indices in one row so they are read against each other, the sectors as a
  ranked ladder around a zero line, the breadth as one bar the whole tape
  divides, the movers as two facing columns.
*/

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  buildBreadth,
  buildIndices,
  buildMovers,
  buildSectors,
  tideRead,
  type TideMove,
} from '../../data/marketTide';
import { Name } from '../../components/ui/Name';
import CompanyLogo from '../../components/ui/CompanyLogo';
import RichRead from '../../components/ui/RichRead';
import Term from '../../components/ui/Term';

/* The desk's heavy panels rebuild on a 3s clock and hold still in between —
   the Pulse contract. A market read that re-ranked every tick would make the
   sector ladder unreadable, which is the opposite of what it is for. */
const TIDE_MS = 3000;

function useTideTick(): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setT(x => x + 1), TIDE_MS);
    return () => window.clearInterval(id);
  }, []);
  return t;
}

const pct = (v: number, dp = 2) => `${v >= 0 ? '+' : ''}${v.toFixed(dp)}%`;
const ink = (v: number) => (v > 0 ? 'text-bull' : v < 0 ? 'text-bear' : 'text-textPrimary');

// ---- the indices ------------------------------------------------------------

/** The four and the fear gauge, on one line, so they are read against each
    other rather than one at a time. */
export const IndicesWidget = ({ pickTicker }: { pickTicker?: (t: string) => void }) => {
  const tick = useTideTick();
  const rows = useMemo(() => buildIndices(), [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 grid grid-cols-5 divide-x divide-borderSubtle/60">
        {rows.map(r => {
          /* VIX READS THE OTHER WAY ROUND. Insurance getting more expensive
             is not good news, and painting a rising VIX green would be the
             one place on this desk where the colour lies. */
          const good = r.inverse ? -r.changePct : r.changePct;
          const clickable = !r.inverse && !!pickTicker;
          return (
            <button
              key={r.ticker}
              type="button"
              disabled={!clickable}
              onClick={clickable ? () => pickTicker!(r.ticker) : undefined}
              title={r.what}
              /* ONE LINE, NOT THREE. A strip is a one-row tile — 100px less
                 its head — and a stacked name/price/change is 48px of content
                 in 54px of room, so the change clipped off the bottom at the
                 tile's own default height. The figures read across instead,
                 which is also how a real index strip is read. */
              className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3 py-1.5 text-left transition-colors ${clickable ? 'hover:bg-ink/[0.04]' : ''}`}
              data-tide-index={r.ticker}
            >
              <span className="flex items-center gap-1.5 shrink-0">
                {!r.inverse && <CompanyLogo ticker={r.ticker} size={14} />}
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-textPrimary">{r.label}</span>
              </span>
              <span className="font-mono text-[15px] font-bold tnum text-textPrimary leading-none">
                {r.inverse ? r.last.toFixed(2) : `$${r.last.toFixed(2)}`}
              </span>
              <span className={`font-mono text-[11px] font-semibold tnum ${ink(good)}`}>{pct(r.changePct)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ---- the sectors ------------------------------------------------------------

/** Eleven sectors around a zero line, ranked. The bar is the move; the count
    beside it says whether the sector moved TOGETHER, which is the part an
    average hides. */
export const SectorsWidget = () => {
  const tick = useTideTick();
  const rows = useMemo(() => buildSectors(), [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const max = Math.max(0.35, ...rows.map(r => Math.abs(r.changePct)));
  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="shrink-0 grid grid-cols-[minmax(0,1fr)_56px_128px_62px] items-center gap-x-2 px-2.5 h-6 border-b border-borderSubtle bg-chip select-none font-mono text-[9px] uppercase tracking-widest text-textSecondary">
        <span>Sector</span>
        <span className="text-right">Move</span>
        <span className="text-center">Against flat</span>
        <span className="text-right">
          <Term k="Advancers">Up</Term>
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {rows.map(r => (
          <div
            key={r.sector}
            className="grid grid-cols-[minmax(0,1fr)_56px_128px_62px] items-center gap-x-2 px-2.5 h-7 border-b border-borderSubtle/40 last:border-0"
            title={`${r.sector} — ${r.up} of ${r.total} up · widest ${r.leader.ticker} ${pct(r.leader.changePct)}, ${r.laggard.ticker} ${pct(r.laggard.changePct)}`}
            data-tide-sector={r.sector}
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: r.color }} aria-hidden />
              <span className="truncate text-[11px] text-textPrimary">{r.sector}</span>
            </span>
            <span className={`text-right font-mono text-[11px] font-semibold tnum ${ink(r.changePct)}`}>{pct(r.changePct)}</span>
            {/* The zero line is the centre, so a glance reads the ROTATION —
                which end of the market is being bought — and not eleven
                unrelated bar lengths. */}
            <span className="relative h-[7px] rounded-sm bg-ink/[0.06]">
              <span className="absolute inset-y-0 left-1/2 w-px bg-ink/25" aria-hidden />
              <span
                className={`absolute inset-y-0 rounded-sm ${r.changePct >= 0 ? 'bg-bull/80' : 'bg-bear/80'}`}
                style={
                  r.changePct >= 0
                    ? { left: '50%', width: `${(Math.abs(r.changePct) / max) * 50}%` }
                    : { right: '50%', width: `${(Math.abs(r.changePct) / max) * 50}%` }
                }
                aria-hidden
              />
            </span>
            <span className="text-right font-mono text-[10px] tnum text-textPrimary">
              {r.up}
              <span className="text-textSecondary">/{r.total}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---- the breadth ------------------------------------------------------------

/** One bar the whole tape divides, and the sentence the three readings make
    together. Breadth is the fact an index hides: the S&P can close green on
    four names while three hundred fall. */
export const BreadthWidget = () => {
  const tick = useTideTick();
  const { indices, breadth, sectors } = useMemo(
    () => ({ indices: buildIndices(), breadth: buildBreadth(), sectors: buildSectors() }),
    [tick] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const moved = Math.max(1, breadth.up + breadth.down);
  return (
    <div className="h-full min-h-0 flex flex-col gap-2 p-3">
      <div className="shrink-0 flex items-baseline gap-2">
        <span className="font-mono text-[18px] font-bold tnum text-textPrimary leading-none">{breadth.upPct.toFixed(0)}%</span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-textSecondary">of the tape advancing</span>
        <span className="ml-auto font-mono text-[11px] font-semibold uppercase tracking-wider text-textPrimary">{breadth.tilt}</span>
      </div>

      <div className="shrink-0 flex h-3 rounded-sm overflow-hidden bg-ink/[0.06]" data-tide-breadth>
        <span className="h-full bg-bull/85" style={{ width: `${(breadth.up / moved) * 100}%` }} aria-hidden />
        <span className="h-full bg-bear/85" style={{ width: `${(breadth.down / moved) * 100}%` }} aria-hidden />
      </div>
      <div className="shrink-0 flex items-baseline justify-between font-mono text-[10px] tnum">
        <span className="text-bull">{breadth.up} up</span>
        <span className="text-textSecondary">
          {breadth.flat} flat · {breadth.ratio.toFixed(2)}
          <span className="text-textMuted"> A/D</span>
        </span>
        <span className="text-bear">{breadth.down} down</span>
      </div>

      {/* THE SHAPE OF THE DAY, not just its sign. "55 up against 44 down" is
          the same sentence whether the tape is a narrow grind or a violent
          split, and those are not the same day to trade. Each column is how
          many names landed in that band. */}
      <div className="shrink-0">
        <span className="block mb-1 font-mono text-[9px] uppercase tracking-widest text-textSecondary">
          Where the day landed
        </span>
        <div className="flex items-end gap-[3px] h-[54px]" data-tide-spread>
          {breadth.spread.map(b => (
            <span
              key={b.label}
              className="flex-1 flex flex-col justify-end items-center gap-[3px]"
              title={`${b.n} name${b.n === 1 ? '' : 's'} ${b.label === 'flat' ? 'within a tenth of flat' : `moved ${b.label}`}`}
            >
              <span className="font-mono text-[9px] tnum text-textPrimary leading-none">{b.n || ''}</span>
              <span
                className={`w-full rounded-sm ${b.tone === 'bull' ? 'bg-bull/80' : b.tone === 'bear' ? 'bg-bear/80' : 'bg-ink/25'}`}
                style={{ height: `${Math.max(b.n ? 3 : 1, (b.n / Math.max(1, ...breadth.spread.map(x => x.n))) * 36)}px` }}
                aria-hidden
              />
            </span>
          ))}
        </div>
        <div className="flex items-baseline justify-between font-mono text-[9px] tnum text-textSecondary">
          <span>−3%</span>
          <span>flat</span>
          <span>+3%</span>
        </div>
      </div>

      {/* The two extremes named, because a column of eleven is a count and a
          reader still wants to know WHO. */}
      <div className="shrink-0 flex items-baseline justify-between gap-2 font-mono text-[10px] tnum">
        <span className="truncate">
          <Name t={breadth.best.ticker} size={11} /> <span className="text-bull">{pct(breadth.best.changePct, 1)}</span>
        </span>
        <span className="text-textSecondary shrink-0">widest each way</span>
        <span className="truncate text-right">
          <Name t={breadth.worst.ticker} size={11} /> <span className="text-bear">{pct(breadth.worst.changePct, 1)}</span>
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto text-[11px] leading-snug text-textSecondary">
        <RichRead text={tideRead(indices, breadth, sectors)} />
      </div>
    </div>
  );
};

// ---- the movers -------------------------------------------------------------

const MoverRow = ({ m, onPick }: { m: TideMove; onPick: (t: string) => void }) => (
  <button
    type="button"
    onClick={() => onPick(m.ticker)}
    title={`${m.ticker} at $${m.last.toFixed(2)}, ${pct(m.changePct, 2)} — click to put it on the desk`}
    /* THE NAME GETS THE ROOM. A three-column row in a quarter-width tile gave
       the ticker whatever the price and the change left over, which was
       nothing: every row read as a logo and two numbers. The price moves to
       the title; the move is the column this panel exists for. */
    className="w-full flex items-center gap-2 px-2 h-[26px] text-left border-b border-borderSubtle/40 last:border-0 hover:bg-ink/[0.04] transition-colors"
    data-tide-mover={m.ticker}
  >
    <span className="min-w-0 flex-1 truncate">
      <Name t={m.ticker} size={13} />
    </span>
    <span className={`shrink-0 font-mono text-[11px] font-semibold tnum ${ink(m.changePct)}`}>{pct(m.changePct, 1)}</span>
  </button>
);

/** The widest movers each way, facing each other — a ranking only means
    something against the other end of it. */
export const MoversWidget = ({ pickTicker }: { pickTicker?: (t: string) => void }) => {
  const tick = useTideTick();
  const navigate = useNavigate();
  const { gainers, losers } = useMemo(() => buildMovers(9), [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (t: string) => (pickTicker ? pickTicker(t) : navigate('/weigher', { state: { weigh: { ticker: t } } }));
  return (
    <div className="h-full min-h-0 grid grid-cols-2 divide-x divide-borderSubtle/60">
      {[
        { label: 'Leading', rows: gainers },
        { label: 'Lagging', rows: losers },
      ].map(col => (
        <div key={col.label} className="min-h-0 flex flex-col">
          <span className="shrink-0 px-2 h-6 flex items-center border-b border-borderSubtle bg-chip font-mono text-[9px] uppercase tracking-widest text-textSecondary">
            {col.label}
          </span>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {col.rows.map(m => (
              <MoverRow key={m.ticker} m={m} onPick={pick} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
