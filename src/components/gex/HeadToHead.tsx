/*
==================================================
  SLAYER TERMINAL - HEAD TO HEAD
  (components/gex/HeadToHead.tsx)

  The first box of Compare (2026-09-08): two names
  on the same ten reads, the way a fight card is
  laid out — one name's figures down the left, the
  read down the middle with what the two say
  against each other under it, the other name's
  figures down the right. Every figure is one the
  Board, Ahead or Targets already prints for one
  name; here they are printed for two, side by side,
  the leading figure lit in its own ink.
==================================================
*/

import { type ReactNode } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { fmtDollars } from '../../data/ahead';
import { distanceIn, fmtShared, sharedUnit, GREEK_LABEL, type Compare, type CompareSide, type Greek } from '../../data/compare';
import type { DistanceUnit } from '../../data/atr';
import { CALL_WALL, FLIP, LONG_GAMMA, PUT_WALL, SHORT_GAMMA, SUPREME } from './paletteInk';
import { H2H_COLUMNS, H2H_HEAD_H, H2H_KEYS, H2H_ROW_H } from './compareSkeletons';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
const pct = (v: number) => `${Math.round(v * 100)}%`;
const signedPct = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}%`;

interface Props {
  cmp: Compare;
  unit: DistanceUnit;
  /** The page's greek — the Supreme row follows it, as the Map's supreme does */
  greek: Greek;
  /** The two chips — A follows the frame or holds a name, B holds its own */
  chipA: ReactNode;
  chipB: ReactNode;
  onSwap: () => void;
  updatedAt: string;
  focusA: number | null;
  focusB: number | null;
  onPick: (strike: number, ticker: string) => void;
}

type RowKey = (typeof H2H_KEYS)[number];

interface Row {
  key: RowKey;
  label: string;
  /** What the two say against each other, one clause */
  note: string;
  cell: (s: CompareSide, other: CompareSide, side: 'a' | 'b') => ReactNode;
}

const HeadToHead = ({ cmp, unit, greek, chipA, chipB, onSwap, updatedAt, focusA, focusB, onPick }: Props) => {
  const { a, b } = cmp;
  const U = sharedUnit(unit);
  const dist = (s: CompareSide, price: number) => {
    const d = distanceIn(price - s.spot, s.spot, U, s.scales);
    return d == null ? '—' : fmtShared(d, U);
  };
  const nearer = (pick: (s: CompareSide) => number) => (Math.abs(pick(a)) <= Math.abs(pick(b)) ? a : b);

  /* A strike the reader can keep: the shared strike, lit silver when it is */
  const Strike = ({ s, k, ink }: { s: CompareSide; k: number; ink: string }) => {
    const kept = (s.ticker === a.ticker ? focusA : focusB) === k;
    return (
      <button
        type="button"
        onClick={() => onPick(k, s.ticker)}
        title={kept ? 'Let go of this strike' : 'Keep this strike'}
        className="font-mono text-[12px] font-semibold tnum hover:underline underline-offset-2 decoration-white/30"
        style={{ color: kept ? SILVER : ink }}
        data-h2h-strike={k}
      >
        {fmtStrike(k)}
      </button>
    );
  };
  const Lead = ({ children, ink }: { children: ReactNode; ink?: string }) => (
    <span className="font-mono text-[12px] font-semibold tnum" style={ink ? { color: ink } : undefined}>
      {children}
    </span>
  );
  const Sub = ({ children }: { children: ReactNode }) => <span className="text-[10.5px] text-textSecondary whitespace-nowrap">{children}</span>;

  const both = (test: (s: CompareSide) => boolean, yes: string, split: (t: CompareSide, f: CompareSide) => string, none: string) => {
    const ta = test(a);
    const tb = test(b);
    if (ta && tb) return yes;
    if (!ta && !tb) return none;
    return ta ? split(a, b) : split(b, a);
  };

  const rows: Row[] = [
    {
      key: 'price',
      label: 'Price',
      note: both(s => s.changePct >= 0, 'both up today', (u, d) => `${u.ticker} up, ${d.ticker} down`, 'both down today'),
      cell: s => (
        <>
          <Lead>{s.spot.toFixed(2)}</Lead>
          <span className={`font-mono text-[10.5px] tnum ${s.changePct >= 0 ? 'text-bull' : 'text-bear'}`}>{signedPct(s.changePct)}</span>
        </>
      ),
    },
    {
      key: 'dealers',
      label: 'Dealers right now',
      note: a.regime && b.regime ? (a.regime === b.regime ? 'the same side of the flip' : 'opposite sides of the flip') : 'one of them has no flip',
      cell: s =>
        s.regime ? (
          <>
            <Lead ink={s.regime === 'LONG' ? LONG_GAMMA : SHORT_GAMMA}>{s.regime === 'LONG' ? 'absorb moves' : 'amplify moves'}</Lead>
            <Sub>{s.regime === 'LONG' ? 'above the flip' : 'below the flip'}</Sub>
          </>
        ) : (
          <Lead ink="#a3a3a3">lean one way</Lead>
        ),
    },
    {
      key: 'flip',
      label: 'The flip',
      note: a.flip != null && b.flip != null ? `${nearer(s => s.flipDistPct ?? Infinity).ticker}'s is the nearer` : 'no flip on one of them',
      cell: s =>
        s.flip != null ? (
          <>
            <Lead ink={FLIP}>{fmtStrike(s.flip)}</Lead>
            <Sub>
              {dist(s, s.flip).replace(/^[+−]/, '')} {s.flip > s.spot ? 'overhead' : 'below'}
            </Sub>
          </>
        ) : (
          <Lead ink="#a3a3a3">none</Lead>
        ),
    },
    {
      key: 'move',
      label: cmp.inSession ? 'Expected move to the close' : 'Expected move next session',
      note: `${cmp.wider.ticker} ${cmp.wider.ratio.toFixed(1)}× wider`,
      cell: s => (
        <>
          <Lead>±${s.sigmaLeft.toFixed(2)}</Lead>
          <Sub>±{s.sigmaLeftPct.toFixed(2)}%</Sub>
        </>
      ),
    },
    {
      key: 'callWall',
      label: 'Call wall',
      note: `${nearer(s => s.callWall.distPct).ticker}'s is the nearer`,
      cell: s => (
        <>
          <Strike s={s} k={s.callWall.strike} ink={CALL_WALL} />
          <Sub>
            {dist(s, s.callWall.strike)} · {fmtDollars(s.callWall.weight)}
          </Sub>
        </>
      ),
    },
    {
      key: 'putWall',
      label: 'Put wall',
      note: `${nearer(s => s.putWall.distPct).ticker}'s is the nearer`,
      cell: s => (
        <>
          <Strike s={s} k={s.putWall.strike} ink={PUT_WALL} />
          <Sub>
            {dist(s, s.putWall.strike)} · {fmtDollars(s.putWall.weight)}
          </Sub>
        </>
      ),
    },
    {
      key: 'supreme',
      label: `Supreme · ${GREEK_LABEL[greek]}`,
      note: both(s => s.supreme[greek].strike > s.spot, 'both overhead', (u, d) => `${u.ticker}'s overhead, ${d.ticker}'s below`, 'both below'),
      cell: s => (
        <>
          <Strike s={s} k={s.supreme[greek].strike} ink={SUPREME} />
          <Sub>
            {dist(s, s.supreme[greek].strike)} · {fmtDollars(s.supreme[greek].weight)}
          </Sub>
        </>
      ),
    },
    {
      key: 'watch',
      label: 'Watch first',
      note: a.watch && b.watch ? `${(a.watch.reach >= b.watch.reach ? a : b).ticker}'s is the likelier reached` : 'no agenda on one of them',
      cell: s =>
        s.watch ? (
          <>
            <Strike s={s} k={s.watch.strike} ink={s.watch.role === 'call wall' ? CALL_WALL : s.watch.role === 'put wall' ? PUT_WALL : s.watch.role === 'supreme' ? SUPREME : 'rgb(var(--text-primary))'} />
            <Sub>
              {s.watch.role ?? (s.watch.isShelf ? 'shelf' : s.watch.isWall ? 'thin' : 'trapdoor')} · {pct(s.watch.reach)} reached{s.watch.isShelf ? ` · holds ${pct(s.watch.hold)}` : ''}
            </Sub>
          </>
        ) : (
          <Lead ink="#a3a3a3">—</Lead>
        ),
    },
    {
      key: 'closes',
      label: 'Where it closes',
      note: a.closes && b.closes ? `${(a.closes.odds >= b.closes.odds ? a : b).ticker}'s is the surer` : 'no odds on one of them',
      cell: s =>
        s.closes ? (
          <>
            <Strike s={s} k={s.closes.strike} ink="#ededed" />
            <Sub>{s.closes.odds.toFixed(0)}% of the time</Sub>
          </>
        ) : (
          <Lead ink="#a3a3a3">—</Lead>
        ),
    },
    {
      key: 'bell',
      label: 'Expires today',
      note: a.bellShare != null && b.bellShare != null ? (a.bellShare === b.bellShare ? 'the same share' : `${(a.bellShare > b.bellShare ? a : b).ticker} sheds more`) : 'no calendar on one of them',
      cell: s =>
        s.bellShare != null ? (
          <>
            <Lead>{s.bellShare}%</Lead>
            <Sub>of the hedging</Sub>
          </>
        ) : (
          <Lead ink="#a3a3a3">—</Lead>
        ),
    },
  ];

  const facts = {
    today: `${a.ticker} ${signedPct(a.changePct)} · ${b.ticker} ${signedPct(b.changePct)}`,
    dealers:
      a.regime && b.regime
        ? a.regime === b.regime
          ? `both ${a.regime === 'LONG' ? 'absorb' : 'amplify'}`
          : `${a.ticker} ${a.regime === 'LONG' ? 'absorbs' : 'amplifies'} · ${b.ticker} ${b.regime === 'LONG' ? 'absorbs' : 'amplifies'}`
        : '—',
    wider: `${cmp.wider.ticker} · ${cmp.wider.ratio.toFixed(1)}×`,
  };

  return (
    <section className="relative flex flex-col min-w-0" data-h2h>
      {/* THE HEAD */}
      <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="h-6 flex items-center gap-3 flex-wrap">
            <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">Head to head</h3>
          </div>
          <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap">Two names on the same ten reads · each under its own name · the middle says what they say against each other</p>
        </div>
        <dl className="grid grid-cols-3 gap-x-6">
          <div>
            <dt className="text-[10px] text-textMuted">Today</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-h2h-today>
              {facts.today}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-textMuted">Dealers</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap">{facts.dealers}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-textMuted">Wider expected move</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum whitespace-nowrap" style={{ color: SILVER }}>
              {facts.wider}
            </dd>
          </div>
        </dl>
      </div>

      {/* THE CARD'S HEAD IS THE CONTROLS LINE: each name's chip sits over its own
          column — the first at the head of the left column, the second at the
          head of the right (Noah, 2026-09-09: both pickers on the left while the
          columns sat on opposite sides was a design flaw). */}
      <div className="mx-5 grid items-center gap-x-4 border-b border-borderSubtle/60" style={{ gridTemplateColumns: H2H_COLUMNS, height: H2H_HEAD_H }} data-h2h-controls>
        <span className="min-w-0 flex items-center justify-end" data-h2h-chip="a">
          {chipA}
        </span>
        <span className="flex items-center justify-center gap-2">
          <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted">against</span>
          <button
            type="button"
            onClick={onSwap}
            title="Swap the two names"
            aria-label="Swap the two names"
            className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.06] transition-colors"
            data-h2h-swap
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </button>
        </span>
        <span className="min-w-0 flex items-center gap-3" data-h2h-chip="b">
          {chipB}
          <span className="ml-auto font-mono text-[9px] uppercase tracking-widest text-textMuted whitespace-nowrap" data-h2h-updated>
            updated {updatedAt} · every 10s
          </span>
        </span>
      </div>
      {/* Each row brightens under the pointer — the house wash, the label and the note a step up (Noah, 2026-09-09) */}
      {rows.map((r, i) => (
        <div
          key={r.key}
          className={`group mx-5 grid items-center gap-x-4 rounded transition-colors duration-150 hover:bg-silver/[0.05] ${i > 0 ? 'border-t border-borderSubtle/40' : ''}`}
          style={{ gridTemplateColumns: H2H_COLUMNS, height: H2H_ROW_H }}
          data-h2h-row={r.key}
        >
          <span className="min-w-0 flex items-center justify-end gap-2 whitespace-nowrap overflow-hidden" data-h2h-a>
            {r.cell(a, b, 'a')}
          </span>
          <span className="min-w-0 flex flex-col items-center leading-none">
            <span className="text-[11px] text-textSecondary group-hover:text-textPrimary transition-colors duration-150 whitespace-nowrap">{r.label}</span>
            <span className="mt-[3px] text-[9.5px] text-textMuted group-hover:text-textSecondary transition-colors duration-150 whitespace-nowrap truncate max-w-full" data-h2h-note>
              {r.note}
            </span>
          </span>
          <span className="min-w-0 flex items-center gap-2 whitespace-nowrap overflow-hidden" data-h2h-b>
            {r.cell(b, a, 'b')}
          </span>
        </div>
      ))}

      <p className="px-5 pb-4 pt-2 min-h-[44px] text-[12px] leading-relaxed text-textSecondary" data-h2h-sentence>
        {cmp.sentence}
      </p>
    </section>
  );
};

export default HeadToHead;
