import { useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { NAV_INK } from '../../components/layout/nav';
import { Fact } from '../../components/trace/TraceBox';
import { usePaper } from '../../core/paper/engine';
import { bookRisk, type LegRisk } from '../../core/paper/risk';
import { fmtMoney } from '../../core/paper/instruments';
import { Money, PaperPill, T } from './paperKit';
import CompanyLogo from '../../components/ui/CompanyLogo';

/*
==================================================
  SLAYER TERMINAL - RISK (pages/paper/Risk.tsx)

  What the open book is exposed to, and what it
  becomes if the market moves.
==================================================

  THE DESK SAYS WHAT IT MADE, THE JOURNAL SAYS WHAT IT DID, and neither
  answers the question a trader asks before the open: if this gaps 5%, what
  happens to me. That is this page, and it reads the same engine — nothing
  here is a second book.

  FOUR QUESTIONS, IN THE ORDER A RISK REVIEW ASKS THEM:

    WHAT AM I HOLDING   every open lot with its own delta dollars, gamma
                        dollars, vega and theta — position risk, per line
    WHERE IS IT         by underlying, with the concentration that matters:
                        one name at 80% of gross is the whole risk report
    WHEN DOES IT GO     the expiry ladder. A book flat on delta can still be
                        a cliff if all of it expires Friday
    WHAT IF             the grid: the book repriced at seven moves and three
                        vol shocks, not walked out on a Taylor series

  DELTA DOLLARS ARE NOT SUMMED BLIND ACROSS NAMES in the header. Adding an
  SPX delta dollar to an NVDA delta dollar without a beta produces a number
  with no referent, so the header prints GROSS (|Δ$| summed — what is at
  risk) and NET beside it, and the per-name table is where the signed
  numbers live. A beta-weighted total would be a better single number and
  the terminal does not have betas it measured, so it does not print one.
==================================================
*/

const pct = (v: number): string => `${(v * 100).toFixed(0)}%`;
const signedPct = (v: number): string => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(0)}%`;

/** Heat for a scenario cell — bull green through to bear red, by size. */
function heat(pnl: number, worst: number): CSSProperties {
  if (worst <= 0 || pnl === 0) return {};
  const a = Math.min(0.5, (Math.abs(pnl) / worst) * 0.5);
  return { background: pnl > 0 ? `rgb(var(--bull) / ${a})` : `rgb(var(--bear) / ${a})` };
}

const Col = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <span className={`${T.label} text-textMuted ${className}`}>{children}</span>
);

const Risk = () => {
  const state = usePaper();
  const [tab, setTab] = useState<'legs' | 'names'>('legs');
  const risk = useMemo(() => bookRisk(state), [state]);
  const { totals, concentration, byUnderlying, byExpiry, grid, moves, vols, legs } = risk;

  const worst = useMemo(
    () => grid.reduce((a, row) => Math.max(a, ...row.map(c => Math.abs(c.pnl))), 0),
    [grid]
  );

  const empty = legs.length === 0;

  return (
    <div className="relative flex-1 min-h-0 flex flex-col" data-paper-risk>
      <header className="shrink-0 flex items-start gap-6 flex-wrap pb-3 border-b border-borderSubtle" data-shell>
        <div className="min-w-0 flex-1">
          <div className="h-6 flex items-center gap-2.5" data-shell-page>
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-borderSubtle text-textSecondary shrink-0" aria-hidden="true" style={{ '--ink': NAV_INK.paper } as CSSProperties}>
              <ShieldAlert className="w-3.5 h-3.5" />
            </span>
            <h1 className="text-[15px] font-semibold leading-tight text-textPrimary">Risk</h1>
            <PaperPill />
            <Link to="/paper" className="ml-1 font-mono text-[9px] uppercase tracking-widest text-textMuted hover:text-textPrimary transition-colors" data-risk-back>
              ← The desk
            </Link>
          </div>
          <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">What the open book is exposed to — by name, by expiry, and repriced across the moves that would hurt.</p>
        </div>
        <dl className="grid grid-flow-col auto-cols-max gap-x-6" data-shell-facts data-risk-facts>
          <Fact label="Open P&L" testId="risk-open"><Money v={totals.unrealized} /></Fact>
          <Fact label="Gross exposure" testId="risk-gross">{fmtMoney(totals.grossExposure, false)}</Fact>
          <Fact label="Net delta $" testId="risk-net"><Money v={totals.netDeltaDollars} /></Fact>
          <Fact label="Vega / pt" testId="risk-vega"><Money v={totals.vega} /></Fact>
          <Fact label="Theta / day" testId="risk-theta"><Money v={totals.theta} /></Fact>
        </dl>
      </header>

      {empty ? (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 py-16" data-risk-empty>
          <ShieldAlert className="w-7 h-7 text-textMuted" aria-hidden="true" />
          <p className={`${T.value} text-textPrimary`}>The book is flat</p>
          <p className={`${T.sub} text-textMuted max-w-sm text-center`}>
            Nothing is open, so there is nothing to be exposed to. Take a position on the desk and this page fills in.
          </p>
          <Link to="/paper" className="mt-1 px-3 h-7 inline-flex items-center rounded-md border border-borderSubtle text-[11px] font-semibold text-textPrimary hover:border-borderMuted transition-colors">
            Open the desk
          </Link>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4 pt-3 pb-8">

          {/* ── WHAT IF — the grid leads, because it is the question ────── */}
          <section className="flex flex-col gap-2" data-risk-grid>
            <div className="flex items-baseline gap-2.5">
              <h2 className="text-[11px] font-semibold text-textPrimary">If the market moves</h2>
              <span className={`${T.note} text-textMuted`}>every leg repriced through Black-Scholes at the shocked spot and vol — not walked out on delta and gamma</span>
            </div>
            <div className="border border-borderSubtle rounded-md overflow-hidden">
              <div className="grid" style={{ gridTemplateColumns: `88px repeat(${moves.length}, minmax(0, 1fr))` }}>
                <div className="px-2.5 py-1.5 border-b border-borderSubtle bg-inset">
                  <Col>Vol \ Move</Col>
                </div>
                {moves.map(m => (
                  <div key={m} className="px-2.5 py-1.5 border-b border-l border-borderSubtle bg-inset text-right">
                    <Col>{signedPct(m)}</Col>
                  </div>
                ))}
                {grid.map((row, i) => (
                  <Row key={vols[i]} vol={vols[i]} row={row} worst={worst} last={i === grid.length - 1} />
                ))}
              </div>
            </div>
          </section>

          {/* ── WHERE IS IT + WHEN DOES IT GO ──────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            <section className="flex flex-col gap-2 min-w-0" data-risk-names>
              <div className="flex items-baseline gap-2.5">
                <h2 className="text-[11px] font-semibold text-textPrimary">Where the risk sits</h2>
                <span className={`${T.note} text-textMuted`}>
                  {concentration.names === 1
                    ? 'one name — the book is the name'
                    : `${concentration.top} is ${pct(concentration.topShare)} of gross`}
                </span>
              </div>
              <div className="border border-borderSubtle rounded-md overflow-hidden">
                <div className="grid px-2.5 py-1.5 border-b border-borderSubtle bg-inset" style={{ gridTemplateColumns: '1.4fr 0.9fr 1fr 0.9fr 0.9fr' }}>
                  <Col>Name</Col><Col className="text-right">Share</Col><Col className="text-right">Delta $</Col><Col className="text-right">Vega</Col><Col className="text-right">Theta</Col>
                </div>
                {byUnderlying.map(r => (
                  <div key={r.underlying} className="grid items-center px-2.5 py-1.5 border-b border-borderSubtle/50 last:border-0 hover:bg-ink/[0.02] transition-colors" style={{ gridTemplateColumns: '1.4fr 0.9fr 1fr 0.9fr 0.9fr' }}>
                    <span className="flex items-center gap-1.5 min-w-0">
                      <CompanyLogo ticker={r.underlying} size={14} />
                      <span className="text-[11px] font-semibold text-textPrimary truncate">{r.underlying}</span>
                      <span className={`${T.note} text-textMuted shrink-0`}>{r.legs}</span>
                    </span>
                    <span className="flex items-center justify-end gap-1.5">
                      <span className="hidden sm:block h-1 w-10 rounded-full bg-ink/[0.08] overflow-hidden" aria-hidden="true">
                        <span className="block h-1 rounded-full bg-textSecondary" style={{ width: `${Math.round(r.share * 100)}%` }} />
                      </span>
                      <span className="text-[11px] tnum text-textSecondary">{pct(r.share)}</span>
                    </span>
                    <span className="text-[11px] tnum text-right"><Money v={r.deltaDollars} /></span>
                    <span className="text-[11px] tnum text-right"><Money v={r.vega} /></span>
                    <span className="text-[11px] tnum text-right"><Money v={r.theta} /></span>
                  </div>
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-2 min-w-0" data-risk-expiry>
              <div className="flex items-baseline gap-2.5">
                <h2 className="text-[11px] font-semibold text-textPrimary">When it goes</h2>
                <span className={`${T.note} text-textMuted`}>a book flat on delta is still a cliff if it all expires on one date</span>
              </div>
              <div className="border border-borderSubtle rounded-md overflow-hidden">
                <div className="grid px-2.5 py-1.5 border-b border-borderSubtle bg-inset" style={{ gridTemplateColumns: '1.2fr 0.6fr 1fr 0.9fr 0.9fr' }}>
                  <Col>Expiry</Col><Col className="text-right">DTE</Col><Col className="text-right">Delta $</Col><Col className="text-right">Vega</Col><Col className="text-right">Theta</Col>
                </div>
                {byExpiry.map(r => (
                  <div key={r.expiry ?? 'none'} className="grid items-center px-2.5 py-1.5 border-b border-borderSubtle/50 last:border-0 hover:bg-ink/[0.02] transition-colors" style={{ gridTemplateColumns: '1.2fr 0.6fr 1fr 0.9fr 0.9fr' }}>
                    <span className="text-[11px] font-semibold text-textPrimary truncate">{r.label}</span>
                    <span className="text-[11px] tnum text-right text-textSecondary">{r.dte == null ? '—' : r.dte}</span>
                    <span className="text-[11px] tnum text-right"><Money v={r.deltaDollars} /></span>
                    <span className="text-[11px] tnum text-right"><Money v={r.vega} /></span>
                    <span className="text-[11px] tnum text-right"><Money v={r.theta} /></span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* ── WHAT AM I HOLDING ──────────────────────────────────────── */}
          <section className="flex flex-col gap-2" data-risk-legs>
            <div className="flex items-baseline gap-2.5">
              <h2 className="text-[11px] font-semibold text-textPrimary">Every open lot</h2>
              <span className={`${T.note} text-textMuted`}>gamma $ is the delta dollars a 1% move adds · vega per vol point · theta per session</span>
            </div>
            <div className="border border-borderSubtle rounded-md overflow-x-auto">
              <div className="min-w-[860px]">
                <div className="grid px-2.5 py-1.5 border-b border-borderSubtle bg-inset" style={{ gridTemplateColumns: '2fr 0.6fr 0.8fr 1fr 1fr 1fr 0.9fr 0.9fr 0.7fr' }}>
                  <Col>Position</Col><Col className="text-right">Qty</Col><Col className="text-right">Mark</Col><Col className="text-right">Value</Col>
                  <Col className="text-right">Open P&L</Col><Col className="text-right">Delta $</Col><Col className="text-right">Gamma $</Col><Col className="text-right">Vega</Col><Col className="text-right">IV</Col>
                </div>
                {legs.map(l => <LegRow key={l.id} l={l} />)}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

const Row = ({ vol, row, worst, last }: { vol: number; row: { move: number; pnl: number }[]; worst: number; last: boolean }) => (
  <>
    <div className={`px-2.5 py-2 bg-inset ${last ? '' : 'border-b border-borderSubtle/50'}`}>
      <span className="text-[11px] tnum text-textSecondary">{vol === 0 ? 'vol flat' : `${vol > 0 ? '+' : ''}${vol} pts`}</span>
    </div>
    {row.map(c => (
      <div
        key={c.move}
        className={`px-2.5 py-2 border-l border-borderSubtle/50 text-right ${last ? '' : 'border-b border-borderSubtle/50'}`}
        style={heat(c.pnl, worst)}
        title={`${signedPct(c.move)} underlying, ${vol >= 0 ? '+' : ''}${vol} vol points`}
      >
        <span className="text-[11px] tnum font-semibold"><Money v={c.pnl} /></span>
      </div>
    ))}
  </>
);

const LegRow = ({ l }: { l: LegRisk }) => (
  <div className="grid items-center px-2.5 py-1.5 border-b border-borderSubtle/50 last:border-0 hover:bg-ink/[0.02] transition-colors" style={{ gridTemplateColumns: '2fr 0.6fr 0.8fr 1fr 1fr 1fr 0.9fr 0.9fr 0.7fr' }}>
    <span className="flex items-center gap-1.5 min-w-0">
      <CompanyLogo ticker={l.underlying} size={14} />
      <span className="text-[11px] font-semibold text-textPrimary truncate" title={l.symbol}>{l.symbol}</span>
    </span>
    <span className={`text-[11px] tnum text-right font-semibold ${l.qty > 0 ? 'text-bull' : 'text-bear'}`}>{l.qty > 0 ? `+${l.qty}` : l.qty}</span>
    <span className="text-[11px] tnum text-right text-textSecondary">{l.mark.toFixed(2)}</span>
    <span className="text-[11px] tnum text-right text-textSecondary">{fmtMoney(l.marketValue, false)}</span>
    <span className="text-[11px] tnum text-right"><Money v={l.unrealized} /></span>
    <span className="text-[11px] tnum text-right"><Money v={l.deltaDollars} /></span>
    <span className="text-[11px] tnum text-right"><Money v={l.gammaDollars} /></span>
    <span className="text-[11px] tnum text-right"><Money v={l.vega} /></span>
    <span className="text-[11px] tnum text-right text-textSecondary">{l.iv == null ? '—' : `${l.iv.toFixed(1)}`}</span>
  </div>
);

export default Risk;
