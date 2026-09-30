/*
==================================================
  SLAYER TERMINAL - HEAD TO HEAD
  (components/gex/HeadToHead.tsx)

  The first box of Compare (2026-09-08): two names
  on the same ten reads. Every figure is one the
  Board, Ahead or Targets already prints for one
  name; here they are printed for two, side by side.

  ONE TABLE (2026-09-29, the partner: "hard to read
  and not visually appealing", Noah: "hes not
  wrong"). The first cut was laid out like a fight
  card — the read's name in the MIDDLE, one name's
  figures right-aligned down the left, the other's
  left-aligned down the right, a tiny verdict under
  every label. Every row began at the centre, the
  two figures it meant to compare stood a quarter
  of the screen apart, and six inks fought down the
  columns. Now the house's own table:

    THE READ     down the left, in three groups —
                 today · the levels · the close
    THE NAMES    two ADJACENT columns, each under its
                 own chip, so the figures touch and
                 the eye compares neighbours
    THE LEAD     the side the verdict names is bold;
                 the figures wear ONE ink — only a
                 direction word or a change is inked
    THE VERDICT  the last column, in words: whose is
                 the nearer, who is wider, who sheds
                 more

  Strikes are still doors to the shared focus, the
  sentence still closes the box.
==================================================
*/

import { type ReactNode } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { fmtDollars } from '../../data/ahead';
import { distanceIn, fmtShared, sharedUnit, GREEK_LABEL, type Compare, type CompareSide, type Greek } from '../../data/compare';
import type { DistanceUnit } from '../../data/atr';
import { LONG_GAMMA, SHORT_GAMMA } from './paletteInk';
import { H2H_CAP_H, H2H_COLUMNS, H2H_COLUMNS_NARROW, H2H_GROUPS, H2H_HEAD_H, H2H_ROW_H, type H2HKey } from './compareSkeletons';
import { useIsBelowLg } from '../ui/useMediaQuery';

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

type Side = 'a' | 'b';

interface Row {
  key: H2HKey;
  label: string;
  /** What the two say against each other, one clause — the verdict column */
  note: string;
  /** The side the verdict names — printed in weight; null when neither leads */
  lead: Side | null;
  cell: (s: CompareSide, bold: boolean) => ReactNode;
}

const HeadToHead = ({ cmp, unit, greek, chipA, chipB, onSwap, updatedAt, focusA, focusB, onPick }: Props) => {
  const { a, b } = cmp;
  const U = sharedUnit(unit);
  const dist = (s: CompareSide, price: number) => {
    const d = distanceIn(price - s.spot, s.spot, U, s.scales);
    return d == null ? '—' : fmtShared(d, U);
  };
  const sideOf = (s: CompareSide): Side => (s.ticker === a.ticker ? 'a' : 'b');
  const nearer = (pick: (s: CompareSide) => number) => (Math.abs(pick(a)) <= Math.abs(pick(b)) ? a : b);
  const more = (pick: (s: CompareSide) => number) => (pick(a) >= pick(b) ? a : b);

  /* THE FIGURE — one ink for both names; the lead in weight (a kept strike wears the silver) */
  const Lead = ({ children, bold, ink }: { children: ReactNode; bold: boolean; ink?: string }) => (
    <span className={`font-mono text-[12px] tnum ${bold ? 'font-bold' : 'font-normal'}`} style={ink ? { color: ink } : undefined}>
      {children}
    </span>
  );
  const Sub = ({ children }: { children: ReactNode }) => <span className="text-[10.5px] text-textSecondary whitespace-nowrap">{children}</span>;
  /* A strike the reader can keep: the shared strike, lit silver when it is */
  const Strike = ({ s, k, bold }: { s: CompareSide; k: number; bold: boolean }) => {
    const kept = (s.ticker === a.ticker ? focusA : focusB) === k;
    return (
      <button
        type="button"
        onClick={() => onPick(k, s.ticker)}
        title={kept ? 'Let go of this strike' : 'Keep this strike'}
        className={`font-mono text-[12px] tnum hover:underline underline-offset-2 decoration-ink/30 ${bold ? 'font-bold' : 'font-normal'} ${kept ? '' : 'text-textPrimary'}`}
        style={kept ? { color: SILVER } : undefined}
        data-h2h-strike={k}
        data-kept={kept || undefined}
      >
        {fmtStrike(k)}
      </button>
    );
  };

  const both = (test: (s: CompareSide) => boolean, yes: string, split: (t: CompareSide, f: CompareSide) => string, none: string) => {
    const ta = test(a);
    const tb = test(b);
    if (ta && tb) return yes;
    if (!ta && !tb) return none;
    return ta ? split(a, b) : split(b, a);
  };

  const rows: Record<H2HKey, Row> = {
    price: {
      key: 'price',
      label: 'Price',
      note: both(s => s.changePct >= 0, 'both up today', (u, d) => `${u.ticker} up, ${d.ticker} down`, 'both down today'),
      lead: a.changePct === b.changePct ? null : sideOf(more(s => s.changePct)),
      cell: (s, bold) => (
        <>
          <Lead bold={bold}>{s.spot.toFixed(2)}</Lead>
          <span className={`font-mono text-[10.5px] tnum ${s.changePct >= 0 ? 'text-bull' : 'text-bear'}`}>{signedPct(s.changePct)}</span>
        </>
      ),
    },
    dealers: {
      key: 'dealers',
      label: 'Dealers right now',
      note: a.regime && b.regime ? (a.regime === b.regime ? 'the same side of the flip' : 'opposite sides of the flip') : 'one of them has no flip',
      lead: null,
      cell: (s, bold) =>
        s.regime ? (
          <>
            <Lead bold={bold} ink={s.regime === 'LONG' ? LONG_GAMMA : SHORT_GAMMA}>
              {s.regime === 'LONG' ? 'absorb moves' : 'amplify moves'}
            </Lead>
            <Sub>{s.regime === 'LONG' ? 'above the flip' : 'below the flip'}</Sub>
          </>
        ) : (
          <span className="font-mono text-[12px] text-textMuted">lean one way</span>
        ),
    },
    flip: {
      key: 'flip',
      label: 'The flip',
      note: a.flip != null && b.flip != null ? `${nearer(s => s.flipDistPct ?? Infinity).ticker}'s is the nearer` : 'no flip on one of them',
      lead: a.flip != null && b.flip != null ? sideOf(nearer(s => s.flipDistPct ?? Infinity)) : null,
      cell: (s, bold) =>
        s.flip != null ? (
          <>
            <Strike s={s} k={s.flip} bold={bold} />
            <Sub>
              {dist(s, s.flip).replace(/^[+−]/, '')} {s.flip > s.spot ? 'overhead' : 'below'}
            </Sub>
          </>
        ) : (
          <span className="font-mono text-[12px] text-textMuted">none</span>
        ),
    },
    callWall: {
      key: 'callWall',
      label: 'Call wall',
      note: `${nearer(s => s.callWall.distPct).ticker}'s is the nearer`,
      lead: sideOf(nearer(s => s.callWall.distPct)),
      cell: (s, bold) => (
        <>
          <Strike s={s} k={s.callWall.strike} bold={bold} />
          <Sub>
            {dist(s, s.callWall.strike)} · {fmtDollars(s.callWall.weight)}
          </Sub>
        </>
      ),
    },
    putWall: {
      key: 'putWall',
      label: 'Put wall',
      note: `${nearer(s => s.putWall.distPct).ticker}'s is the nearer`,
      lead: sideOf(nearer(s => s.putWall.distPct)),
      cell: (s, bold) => (
        <>
          <Strike s={s} k={s.putWall.strike} bold={bold} />
          <Sub>
            {dist(s, s.putWall.strike)} · {fmtDollars(s.putWall.weight)}
          </Sub>
        </>
      ),
    },
    supreme: {
      key: 'supreme',
      label: `Supreme · ${GREEK_LABEL[greek]}`,
      note: `${both(s => s.supreme[greek].strike > s.spot, 'both overhead', (u, d) => `${u.ticker}'s overhead, ${d.ticker}'s below`, 'both below')} · ${more(s => s.supreme[greek].weight).ticker}'s the heavier`,
      lead: sideOf(more(s => s.supreme[greek].weight)),
      cell: (s, bold) => (
        <>
          <Strike s={s} k={s.supreme[greek].strike} bold={bold} />
          <Sub>
            {dist(s, s.supreme[greek].strike)} · {fmtDollars(s.supreme[greek].weight)}
          </Sub>
        </>
      ),
    },
    watch: {
      key: 'watch',
      label: 'Watch first',
      note: a.watch && b.watch ? `${(a.watch.reach >= b.watch.reach ? a : b).ticker}'s is the likelier reached` : 'no agenda on one of them',
      lead: a.watch && b.watch ? (a.watch.reach >= b.watch.reach ? 'a' : 'b') : null,
      cell: (s, bold) =>
        s.watch ? (
          <>
            <Strike s={s} k={s.watch.strike} bold={bold} />
            <Sub>
              {s.watch.role ?? (s.watch.isShelf ? 'shelf' : s.watch.isWall ? 'thin' : 'trapdoor')} · {pct(s.watch.reach)} reached{s.watch.isShelf ? ` · holds ${pct(s.watch.hold)}` : ''}
            </Sub>
          </>
        ) : (
          <span className="font-mono text-[12px] text-textMuted">—</span>
        ),
    },
    move: {
      key: 'move',
      label: cmp.inSession ? 'Expected move to the close' : 'Expected move next session',
      note: `${cmp.wider.ticker}'s is ${cmp.wider.ratio.toFixed(1)}× wider`,
      lead: cmp.wider.ticker === a.ticker ? 'a' : 'b',
      cell: (s, bold) => (
        <>
          <Lead bold={bold}>±${s.sigmaLeft.toFixed(2)}</Lead>
          <Sub>±{s.sigmaLeftPct.toFixed(2)}%</Sub>
        </>
      ),
    },
    closes: {
      key: 'closes',
      label: 'Likeliest close',
      note: a.closes && b.closes ? `${(a.closes.odds >= b.closes.odds ? a : b).ticker}'s is the surer` : 'no odds on one of them',
      lead: a.closes && b.closes ? (a.closes.odds >= b.closes.odds ? 'a' : 'b') : null,
      cell: (s, bold) =>
        s.closes ? (
          <>
            <Strike s={s} k={s.closes.strike} bold={bold} />
            <Sub>{s.closes.odds.toFixed(0)}% of the time</Sub>
          </>
        ) : (
          <span className="font-mono text-[12px] text-textMuted">—</span>
        ),
    },
    bell: {
      key: 'bell',
      label: 'Expires at the bell',
      note: a.bellShare != null && b.bellShare != null ? (a.bellShare === b.bellShare ? 'the same share' : `${(a.bellShare > b.bellShare ? a : b).ticker} sheds more`) : 'no calendar on one of them',
      lead: a.bellShare != null && b.bellShare != null && a.bellShare !== b.bellShare ? (a.bellShare > b.bellShare ? 'a' : 'b') : null,
      cell: (s, bold) =>
        s.bellShare != null ? (
          <>
            <Lead bold={bold}>{s.bellShare}%</Lead>
            <Sub>of the hedging</Sub>
          </>
        ) : (
          <span className="font-mono text-[12px] text-textMuted">—</span>
        ),
    },
  };

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

  /* THE TABLE ON A PHONE (the phone pass, 2026-09-13): the verdict column steps out and the read's column narrows, so the
     two names keep the room their figures need at 390 */
  const narrow = useIsBelowLg();
  const columns = narrow ? H2H_COLUMNS_NARROW : H2H_COLUMNS;

  return (
    <section className="relative flex flex-col min-w-0" data-h2h>
      {/* THE HEAD */}
      <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="h-6 flex items-center gap-3 flex-wrap">
            <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">Head to head</h3>
          </div>
          <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">Ten reads side by side · the bold figure leads · the last column says what the two say against each other</p>
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-2">
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

      {/* THE TABLE'S HEAD ROW: the swap at the read's column, each name's chip over ITS OWN column (Noah, 2026-09-09: both
          pickers on the left while the columns sat elsewhere was a design flaw), the clock at the far right */}
      <div className="mx-5 grid items-center gap-x-4 border-b border-borderSubtle/60" style={{ gridTemplateColumns: columns, height: H2H_HEAD_H }} data-h2h-controls>
        <span className="min-w-0 flex items-center gap-2">
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
          <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted whitespace-nowrap">the read</span>
        </span>
        <span className="min-w-0 flex items-center" data-h2h-chip="a">
          {chipA}
        </span>
        <span className="min-w-0 flex items-center" data-h2h-chip="b">
          {chipB}
        </span>
        {!narrow && (
          <span className="min-w-0 flex items-center justify-between gap-3">
            <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted whitespace-nowrap">against each other</span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted whitespace-nowrap" data-h2h-updated>
              updated {updatedAt} · every 10s
            </span>
          </span>
        )}
      </div>

      {/* THE GROUPS — a quiet caption, then its rows; each row brightens under the pointer (the house wash) */}
      {H2H_GROUPS.map((g, gi) => (
        <div key={g.caption} className="contents" data-h2h-group={g.caption}>
          <div className={`mx-5 flex items-end pb-1 ${gi > 0 ? 'border-t border-borderSubtle/40' : ''}`} style={{ height: H2H_CAP_H }}>
            <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-textMuted">{g.caption}</span>
          </div>
          {g.keys.map((k, i) => {
            const r = rows[k];
            return (
              <div
                key={r.key}
                className={`group mx-5 grid items-center gap-x-4 rounded transition-colors duration-150 hover:bg-silver/[0.05] ${i > 0 ? 'border-t border-borderSubtle/40' : ''}`}
                style={{ gridTemplateColumns: columns, height: H2H_ROW_H }}
                data-h2h-row={r.key}
                data-h2h-lead={r.lead ?? undefined}
              >
                <span className="min-w-0 text-[11px] text-textSecondary group-hover:text-textPrimary transition-colors duration-150 whitespace-nowrap truncate">{r.label}</span>
                <span className="min-w-0 flex items-center gap-2 whitespace-nowrap overflow-hidden" data-h2h-a>
                  {r.cell(a, r.lead === 'a')}
                </span>
                <span className="min-w-0 flex items-center gap-2 whitespace-nowrap overflow-hidden" data-h2h-b>
                  {r.cell(b, r.lead === 'b')}
                </span>
                {!narrow && (
                  <span className="min-w-0 text-[11px] text-textSecondary whitespace-nowrap truncate" data-h2h-note>
                    {r.note}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}

      <p className="px-5 pb-4 pt-2 min-h-[44px] text-[12px] leading-relaxed text-textSecondary" data-h2h-sentence>
        {cmp.sentence}
      </p>
    </section>
  );
};

export default HeadToHead;
