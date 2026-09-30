/*
==================================================
  SLAYER TERMINAL - WHAT'S BEING BUILT, THE ROWS
  (components/gex/BuildingLedger.tsx)

  Box 1 of the Building page. REDRAWN AS ONE BAR
  PER STRIKE (2026-09-13; Noah with his partner's
  two screenshots — the right half of the old grid
  the one part of the page his partner liked, and
  another site's "loaded strikes" cards "more
  understandable": "redesign this section without
  the heatmap and ladder display. something new but
  very easily understandable visually and word wise
  as well" → a sketch, "build it"). The capsules
  that coloured every strike by a ramp and the
  two-lane bar that split today's change four ways
  are gone. Per row —

    the STRIKE      its role tag in the role's ink,
                    YOU OWN when you hold contracts
                    there, and under it how far from
                    spot in the shell's ruler
    THE WALL NOW    one bar, the hedging sitting
                    there against the biggest wall
                    shown: the part that arrived
                    today lit green, the part that
                    left red hatching past the bar's
                    end, the figure at the end with
                    "was $X" naming the open's size;
                    under it, which way the strike
                    leans and what dealers do there
    CHANGE          the wall's size change, signed,
    CALLS · PUTS    and the contracts behind it —
                    where the partner likes them
    THE DAY         the wall's size through the
                    session as a thin line
    WHAT'S          the verdict as a toned chip
    HAPPENING       (building green · draining red ·
                    changed sides and new today
                    silver · steady quiet) with the
                    side and when in the day

  THE STEADY STRIKES FOLD AWAY: a run of two or
  more steady strikes is one line ("8 steady
  strikes above · 508 – 501 · show"), so the movers
  are the page; Show · Every strike opens them all.
  The spot rule cuts the list where price is; no
  fold crosses it. ONE FIXED READ LINE above the
  grid speaks the hovered row (verdict first — the
  words are data/building.ts's); a click keeps the
  row as the terminal's strike, and every other row
  softens behind it. ONE FACT ONE INK: green and
  red are the change's direction alone; the role
  lives in its tag.
==================================================
*/

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import DropdownSelect, { type DropdownOption } from '../ui/DropdownSelect';
import GuideFocus, { GuideDoor } from '../ui/GuideFocus';
import SpotRule from '../ui/SpotRule';
import Term from '../ui/Term';
import { BuildingGuide } from './BuildingGuide';
import { LEDGER_COLUMNS, LEDGER_FOLD_H, LEDGER_ROW_H } from './buildingSkeletons';
import { BULL, CALL_WALL, PUT_WALL, SUPREME, alpha } from './paletteInk';
import { fmtDollars, fmtStrike, type AheadClock } from '../../data/ahead';
import { sideWords, type BuildRow, type Building } from '../../data/building';
import { STRIKE_WINDOWS, type StrikeWindow } from '../../data/exposure';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const ROLE_INK: Record<string, string> = { 'call wall': CALL_WALL, 'put wall': PUT_WALL, supreme: SUPREME };
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
/* THE HATCH — what left a strike today: red stripes on a 6px period along the
   135° line, tiled every 8.485px across (6 ÷ sin 45°, so the tiles meet without
   a seam) and DRIFTING slowly out of the bar (`.hatch-drift` in index.css —
   Noah, 2026-09-13: "make this red section have a slow moving animation") */
const HATCH = `repeating-linear-gradient(135deg, ${alpha(PUT_WALL, 0.6)} 0 3px, transparent 3px 6px)`;
const HATCH_TILE = '8.485px 100%';

export type BuildOrder = 'strike' | 'built' | 'drained';
export type BuildShow = 'moved' | 'all';
export const ORDER_OPTIONS: DropdownOption<BuildOrder>[] = [
  { value: 'strike', label: 'By strike', hint: 'Highest first, spot marked between' },
  { value: 'built', label: 'Most built first', hint: 'The strikes gaining the most hedging today' },
  { value: 'drained', label: 'Most drained first', hint: 'The strikes losing the most hedging today' },
];
export const WINDOW_OPTIONS: DropdownOption<StrikeWindow>[] = STRIKE_WINDOWS.map(w => ({ value: w, label: `±${w}`, hint: w === 30 ? 'Every strike' : `${w} strikes each side of spot` }));
export const SHOW_OPTIONS: DropdownOption<BuildShow>[] = [
  { value: 'moved', label: 'What moved', hint: 'The strikes that built, drained or changed sides · the steady ones fold into one line' },
  { value: 'all', label: 'Every strike', hint: 'The whole window, steady strikes and all' },
];

const signed = (v: number) => `${v >= 0 ? '+' : '−'}${fmtDollars(v)}`;
const contracts = (n: number) => (n === 0 ? '0' : `${n > 0 ? '+' : '−'}${Math.abs(n).toLocaleString('en-US')}`);

/* THE VERDICT AS A CHIP — the report's three tones, plus silver for a change
   of kind rather than size (changed sides, new today) */
type Tone = 'good' | 'bad' | 'silver' | 'quiet';
const TONE: Record<Tone, string> = {
  good: 'bg-bull/10 text-bull border-bull/20',
  bad: 'bg-bear/10 text-bear border-bear/20',
  silver: 'bg-silver/[0.12] text-silver border-silver/30',
  quiet: 'bg-ink/[0.05] text-textSecondary border-borderSubtle',
};
/* the chip's words are short — the read line carries the full "mostly through the middle of the day" */
const whenShort = (w: BuildRow['when']) => (w === 'early' ? 'mostly early' : w === 'middle' ? 'mostly midday' : w === 'late' ? 'mostly late' : '');
const verdictOf = (r: BuildRow): { chip: string; tone: Tone; words: string } => {
  const dominant = Math.abs(r.callAdded) >= Math.abs(r.putAdded) ? 'calls' : 'puts';
  const when = whenShort(r.when);
  switch (r.verdict) {
    case 'building':
      return { chip: 'Building', tone: 'good', words: [dominant, when].filter(Boolean).join(' · ') };
    case 'draining':
      return { chip: 'Draining', tone: 'bad', words: [dominant, when].filter(Boolean).join(' · ') };
    case 'switched':
      return { chip: 'Changed sides', tone: 'silver', words: `now ${r.now < 0 ? 'calls' : 'puts'}` };
    case 'new':
      return { chip: 'New today', tone: 'silver', words: dominant };
    default:
      return { chip: 'Steady', tone: 'quiet', words: '' };
  }
};

/** The wall's size through the day — a thin line, the last point marked. On a
    row that moved, the stretch holding the day's biggest rise is tinted green
    and the one holding its biggest drop red — the same 1px line, only its
    colour shifts (Noah, 2026-09-07: "just a slight color change will do");
    a steady row stays one quiet line. */
const Shape = ({ shape, live, verdict }: { shape: number[]; live: boolean; verdict: BuildRow['verdict'] }) => {
  const W = 96;
  const H = 18;
  if (shape.length < 2) return <svg width={W} height={H} />;
  const X = (i: number) => (i / (shape.length - 1)) * (W - 4) + 2;
  const Y = (v: number) => H - 2 - v * (H - 5);
  const pt = (i: number) => `${X(i).toFixed(1)},${Y(shape[i]).toFixed(1)}`;
  const pts = shape.map((_, i) => pt(i));
  const lastX = X(shape.length - 1);
  const lastY = Y(shape[shape.length - 1]);
  let up: number | null = null;
  let down: number | null = null;
  if (verdict !== 'steady') {
    const range = Math.max(...shape) - Math.min(...shape);
    let bestUp = 0;
    let bestDown = 0;
    for (let i = 1; i < shape.length; i++) {
      const d = shape[i] - shape[i - 1];
      if (d > bestUp) {
        bestUp = d;
        up = i;
      }
      if (d < bestDown) {
        bestDown = d;
        down = i;
      }
    }
    if (bestUp < 0.2 * range) up = null;
    if (-bestDown < 0.2 * range) down = null;
  }
  const run = (i: number, sign: 1 | -1): [number, number] => {
    let a = i - 1;
    let b = i;
    while (a > 0 && Math.sign(shape[a] - shape[a - 1]) === sign) a--;
    while (b < shape.length - 1 && Math.sign(shape[b + 1] - shape[b]) === sign) b++;
    return [a, b];
  };
  const tint = (i: number, sign: 1 | -1, ink: string, key: string) => {
    const [a, b] = run(i, sign);
    const seg = Array.from({ length: b - a + 1 }, (_, k) => pt(a + k));
    return <polyline key={key} points={seg.join(' ')} fill="none" stroke={ink} strokeOpacity={0.85} strokeWidth={1} strokeLinejoin="round" strokeLinecap="round" data-shape-mark={key} />;
  };
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden data-build-shape>
      <polyline points={`${pts[0].split(',')[0]},${H - 1} ${pts.join(' ')} ${lastX.toFixed(1)},${H - 1}`} fill="rgb(var(--ink))" fillOpacity={0.04} stroke="none" />
      <polyline points={pts.join(' ')} fill="none" stroke={verdict === 'steady' ? 'rgb(var(--text-muted))' : 'rgb(var(--text-secondary))'} strokeWidth={1} strokeLinejoin="round" />
      {up != null && tint(up, 1, BULL, 'rise')}
      {down != null && tint(down, -1, PUT_WALL, 'drop')}
      <circle cx={lastX} cy={lastY} r={1.8} fill={live ? 'rgb(var(--text-primary))' : 'rgb(var(--text-secondary))'} />
    </svg>
  );
};

/** THE WALL NOW — one bar against the biggest wall shown: what stood at the
    open and stands now in quiet silver, what arrived today green past it, what
    left today red hatching past the bar's end; the figure ALWAYS beside the
    drawn end — the column keeps 168px past the longest bar for it (a first
    cut moved it inside a bar at the edge, and Noah asked whether that was
    meant: one place for the number is clearer).
    ON PAPER THE TRACK IS NOT DRAWN (Noah, 2026-09-19, the light sweep: "i like
    the idea of the numbers hugging the green section of the capsule but it looks
    unorganized when some of them are bleeding through the capsules and others
    are on the outside"). On the dark terminal the track is a whisper (6% of
    white) and a figure over it reads as floating; on paper the same wash is a
    solid grey capsule, so a figure was over it, half over its end, or past it,
    row by row. There the bar stands alone and every figure hugs its bar on clean
    paper — one state. The bars' lengths still say which wall is the biggest;
    the key drops its "track" entry there. Paper-only (index.css `paper-clear`,
    `paper-hide`): the dark terminal is what it was. */
const Wall = ({ row, max }: { row: BuildRow; max: number }) => {
  const now = Math.abs(row.now);
  const open = Math.abs(row.open);
  const moved = row.verdict !== 'steady';
  const grew = now >= open;
  const base = moved ? Math.min(now, open) : now;
  const pct = (v: number) => Math.min(100, (v / max) * 100);
  const end = moved && !grew ? pct(open) : pct(now);
  const transition = `width 520ms ${EASE}, left 520ms ${EASE}`;
  return (
    <div className="relative h-[12px] rounded-full bg-ink/[0.06] paper-clear" data-build-wall data-wall-now={Math.round(now)} data-wall-open={Math.round(open)}>
      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct(base).toFixed(2)}%`, background: SILVER, opacity: 0.32, transition }} data-wall-base />
      {moved && grew && now > base && <span className="absolute inset-y-0 rounded-r-full" style={{ left: `${pct(base).toFixed(2)}%`, width: `${(pct(now) - pct(base)).toFixed(2)}%`, background: BULL, transition }} data-wall-added />}
      {moved && !grew && open > now && (
        <span className="absolute inset-y-0 rounded-r-full hatch-drift" style={{ left: `${pct(now).toFixed(2)}%`, width: `${(pct(open) - pct(now)).toFixed(2)}%`, background: HATCH, backgroundSize: HATCH_TILE, transition }} data-wall-gone />
      )}
      {/* the figure sits past the drawn end, the hatch included — the amount, its unit (Noah, 2026-09-13: "$123M… of what?"), the open's */}
      <span className="absolute -top-px font-mono text-[10px] font-semibold tnum whitespace-nowrap leading-[14px] text-textPrimary" style={{ left: `calc(${end.toFixed(2)}% + 8px)`, transition }} data-wall-figure>
        {fmtDollars(now)}
        <span className="font-sans font-normal text-[9px] text-textMuted"> net gamma</span>
        {moved && <span className="font-normal text-textMuted"> · was {fmtDollars(open)}</span>}
      </span>
    </div>
  );
};

interface Props {
  data: Building;
  ticker: string;
  clock: AheadClock;
  order: BuildOrder;
  onOrder: (o: BuildOrder) => void;
  window: StrikeWindow;
  onWindow: (w: StrikeWindow) => void;
  show: BuildShow;
  onShow: (s: BuildShow) => void;
  /** How far a strike sits from spot, in the shell's ruler — "1.30%" */
  distanceOf: (strike: number) => string;
  /** "14:35:10" — when the numbers were last read */
  updatedAt: string;
  yours?: Set<number>;
  focus?: number | null;
  onPick?: (price: number) => void;
  /** Let the pinned strike go — a click anywhere outside its row */
  onClear?: () => void;
  scope?: ReactNode;
}

type Item = { kind: 'row'; row: BuildRow } | { kind: 'spot' } | { kind: 'fold'; key: string; rows: BuildRow[]; side: 'above' | 'below' | 'between' };

const BuildingLedger = ({ data, ticker, clock, order, onOrder, window, onWindow, show, onShow, distanceOf, updatedAt, yours, focus, onPick, onClear, scope }: Props) => {
  const [guideOpen, setGuideOpen] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  /** The folds the reader opened — forgotten when the list is re-cut */
  const [opened, setOpened] = useState<Set<string>>(() => new Set());
  const { rows, maxAbs, spotAfter, spot } = data;
  const cut = `${order}-${window}-${show}`;
  useEffect(() => setOpened(new Set()), [cut]);

  const shown = order === 'strike' ? rows : [...rows].sort((a, b) => (order === 'built' ? b.sizeChange - a.sizeChange : a.sizeChange - b.sizeChange));
  /* THE ITEMS — the rows in order, the spot rule where price is, the steady runs folded */
  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    let run: BuildRow[] = [];
    const flush = () => {
      if (!run.length) return;
      const key = `${run[0].strike}-${run[run.length - 1].strike}`;
      if (show === 'moved' && run.length >= 2 && !opened.has(key)) out.push({ kind: 'fold', key, rows: run, side: 'between' });
      else for (const r of run) out.push({ kind: 'row', row: r });
      run = [];
    };
    const spotAt = order === 'strike' ? spotAfter : -1;
    shown.forEach((r, i) => {
      if (i === spotAt) {
        flush();
        out.push({ kind: 'spot' });
      }
      if (r.verdict === 'steady') run.push(r);
      else {
        flush();
        out.push({ kind: 'row', row: r });
      }
    });
    flush();
    if (order === 'strike' && (spotAfter < 0 || spotAfter >= shown.length)) out.push({ kind: 'spot' });
    /* a fold at the top or against the spot rule from above is "above" spot, at the
       foot or under the rule "below", one with movers on both sides "between" */
    for (let i = 0; i < out.length; i++) {
      const it = out[i];
      if (it.kind !== 'fold') continue;
      const prev: Item['kind'] | 'edge' = i > 0 ? out[i - 1].kind : 'edge';
      const next: Item['kind'] | 'edge' = i + 1 < out.length ? out[i + 1].kind : 'edge';
      it.side = order !== 'strike' ? 'between' : prev === 'edge' || next === 'spot' ? 'above' : prev === 'spot' || next === 'edge' ? 'below' : 'between';
    }
    return out;
  }, [shown, show, opened, order, spotAfter]);

  const readRow = (focus != null && rows.find(r => Math.abs(r.strike - focus) < 1e-9)) || (hover != null && rows.find(r => r.strike === hover)) || data.fastestUp || data.fastestDown || rows[0] || null;
  const pinned = focus != null && readRow != null && Math.abs(readRow.strike - focus) < 1e-9;
  /* FOCUS AND BLUR (Noah, 2026-09-07): a pinned row stays sharp, every other row softens behind it */
  const anyKept = focus != null && rows.some(r => Math.abs(r.strike - focus) < 1e-9);
  /* …and a click anywhere outside a row lets it go (Noah: "exitable on click
     anywhere outside of that row"). Another row's click moves the pin instead;
     the controls, the shell's focus chip and the guide are not "outside". */
  useEffect(() => {
    if (!anyKept || !onClear) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (t?.closest('[data-build-row],[data-build-fold],[data-dropdown],[data-dropdown-card],[role="menu"],[data-focus-chip],[data-guide-door],button,a,input,select,textarea')) return;
      onClear();
    };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [anyKept, onClear]);

  const movers = rows.filter(r => r.verdict !== 'steady').length;
  const soft = 'blur-[2px] opacity-30';
  const crisp = 'blur-0 opacity-100';

  return (
    <section className="relative flex flex-col min-w-0" data-build-band>
      <GuideFocus open={guideOpen} onClose={() => setGuideOpen(false)} title="How to read what's being built" testId="build-guide" viewport>
        <BuildingGuide data={data} clock={clock} />
      </GuideFocus>

      {/* THE HEAD */}
      <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">What's being built</h3>
            {scope}
            <GuideDoor open={guideOpen} onClick={() => setGuideOpen(v => !v)} title="What the bar, the chip and the line mean" testId="build-guide" />
          </div>
          <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">
            {clock.inSession ? "Today's trading" : 'The last session'}, strike by strike · the hedging added or taken off since the open, so a wall shows up before it is the wall · the steady strikes fold away
          </p>
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-2">
          <div>
            <dt className="text-[10px] text-textMuted">{clock.inSession ? 'Built today' : 'Built last session'}</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-build-built>
              +{fmtDollars(data.built)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-textMuted">{clock.inSession ? 'Drained today' : 'Drained last session'}</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-build-drained>
              −{fmtDollars(data.drained)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-textMuted">Growing fastest</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum whitespace-nowrap" style={{ color: SILVER }} data-build-up>
              {data.fastestUp ? `${fmtStrike(data.fastestUp.strike)} · ${signed(data.fastestUp.sizeChange)}` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-textMuted">Fading fastest</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-build-down>
              {data.fastestDown ? `${fmtStrike(data.fastestDown.strike)} · ${signed(data.fastestDown.sizeChange)}` : '—'}
            </dd>
          </div>
        </dl>
      </div>

      {/* THE ONE LINE OF CONTROLS */}
      <div className="px-5 pb-2 flex items-center gap-2 flex-wrap" data-build-controls>
        <DropdownSelect label="Show" value={show} options={SHOW_OPTIONS} onChange={onShow} title="The movers alone, or every strike" testId="build-show" />
        <DropdownSelect label="Order" value={order} options={ORDER_OPTIONS} onChange={onOrder} title="How the strikes are listed" testId="build-order" />
        <DropdownSelect label="Strikes" value={window} options={WINDOW_OPTIONS} onChange={onWindow} title="How many strikes each side of spot" testId="build-window" />
        {/* THE KEY — three capsules saying what the bars' colours mean (Noah, 2026-09-13: "the three different
            colored capsules up top") — on this line, where a 1440 screen still has room for it */}
        <span className="ml-3 inline-flex items-center gap-3 font-mono text-[9px] text-textMuted whitespace-nowrap max-lg:flex-wrap max-lg:gap-y-1" data-build-key>
          {/* the track first — the faint full length every bar sits on (Noah, 2026-09-13: "what is the second gray?") */}
          <span className="inline-flex items-center gap-1.5 paper-hide">
            <span className="w-4 h-[6px] rounded-full shrink-0 bg-ink/[0.06] ring-1 ring-inset ring-ink/[0.12]" data-key-swatch="track" /> the track · the biggest wall shown
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 h-[6px] rounded-full shrink-0" style={{ background: SILVER, opacity: 0.32 }} data-key-swatch="base" /> there at the open
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 h-[6px] rounded-full shrink-0" style={{ background: BULL }} data-key-swatch="added" /> arrived {clock.inSession ? 'today' : 'last session'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 h-[6px] rounded-full shrink-0 hatch-drift" style={{ background: HATCH, backgroundSize: HATCH_TILE }} data-key-swatch="gone" /> left {clock.inSession ? 'today' : 'last session'}
          </span>
        </span>
        <span className="ml-auto font-mono text-[9px] uppercase tracking-widest text-textMuted whitespace-nowrap" data-build-updated>
          {movers} of {rows.length} moved · {updatedAt}
        </span>
      </div>

      {/* THE READ LINE — one fixed line, the verdict first */}
      <div className="mx-5 px-3 py-2 border-y border-borderSubtle/60 font-mono text-[11px] leading-snug select-none min-h-[34px] flex items-center" data-build-read>
        {readRow ? (
          <span className={pinned ? 'text-textPrimary' : 'text-textSecondary'}>
            <span className="font-bold text-[12px] text-textPrimary tnum">{fmtStrike(readRow.strike)}</span>
            <span className="text-textMuted"> · </span>
            {readRow.words}
          </span>
        ) : (
          <span className="text-textMuted">nothing to read yet</span>
        )}
      </div>

      {/* THE GRID */}
      <div className="px-5 pt-2 pb-2 overflow-x-auto" data-build-rows={items.filter(i => i.kind === 'row').length} onPointerLeave={() => setHover(null)}>
        {/* The column template is the skeleton's own (buildingSkeletons.tsx), so the two cannot drift */}
        <div key={cut} className="grid min-w-[1060px] items-center gap-x-[14px] animate-fade-in" style={{ gridTemplateColumns: LEDGER_COLUMNS }}>
          <div className="h-[20px] px-2 font-mono text-[9px] uppercase tracking-widest text-textMuted">Strike</div>
          {/* the head names the measure — net gamma, in dollars (Noah, 2026-09-13: "what does that number even mean?… can we get
              the 'net gamma' in there somewhere so it doesn't have to be a mystery") — and the full definition on hover */}
          <div className="h-[20px] px-2 font-mono text-[9px] uppercase tracking-widest text-textMuted whitespace-nowrap flex items-center gap-2 min-w-0" data-build-measure>
            <Term k="The wall now">The wall now</Term>
            <span className="normal-case tracking-normal text-textMuted/70">· net gamma at the strike, in dollars</span>
          </div>
          <div className="h-[20px] px-2 font-mono text-[9px] uppercase tracking-widest text-textMuted text-right">Change</div>
          <div className="h-[20px] px-2 font-mono text-[9px] uppercase tracking-widest text-textMuted text-right">Calls</div>
          <div className="h-[20px] px-2 font-mono text-[9px] uppercase tracking-widest text-textMuted text-right">Puts</div>
          <div className="h-[20px] px-2 font-mono text-[9px] uppercase tracking-widest text-textMuted">The day</div>
          <div className="h-[20px] px-2 font-mono text-[9px] uppercase tracking-widest text-textMuted">What's happening</div>

          {items.map((it, idx) => {
            if (it.kind === 'spot')
              return (
                <div key={`spot-${idx}`} className="col-span-7 px-2 h-[22px] flex items-center" data-build-spot>
                  <SpotRule ticker={ticker} price={spot} />
                </div>
              );
            if (it.kind === 'fold') {
              const hi = Math.max(...it.rows.map(r => r.strike));
              const lo = Math.min(...it.rows.map(r => r.strike));
              const where = order === 'strike' ? ` ${it.side}` : '';
              return (
                <button
                  key={`fold-${it.key}`}
                  type="button"
                  onClick={() => setOpened(prev => new Set(prev).add(it.key))}
                  className={`col-span-7 flex items-center gap-3 px-2 rounded text-left font-mono text-[10px] tracking-wide text-textMuted hover:text-textSecondary transition-[filter,opacity] duration-[420ms] ${anyKept ? soft : crisp}`}
                  style={{ height: LEDGER_FOLD_H }}
                  data-build-fold={it.key}
                  data-fold-count={it.rows.length}
                >
                  <span className="whitespace-nowrap">
                    {it.rows.length} steady strikes{where} · {fmtStrike(hi)} – {fmtStrike(lo)}
                  </span>
                  <span className="flex-1 h-px bg-ink/[0.07]" />
                  <span className="text-textSecondary">show</span>
                </button>
              );
            }
            const r = it.row;
            const ink = r.role ? ROLE_INK[r.role] : undefined;
            const kept = focus != null && Math.abs(focus - r.strike) < 1e-9;
            const hovered = hover === r.strike;
            const wash = kept || hovered ? 'bg-silver/[0.05]' : '';
            const dim = anyKept && !kept;
            const v = verdictOf(r);
            const above = r.strike > spot;
            const at = Math.abs(r.strike - spot) < 1e-9;
            const distance = distanceOf(r.strike).replace(/^[+−]/, '');
            return (
              <div
                key={`r-${r.strike}`}
                className={`grid grid-cols-subgrid col-span-7 items-center rounded cursor-pointer transition-[filter,opacity] duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${wash} ${dim ? soft : crisp}`}
                style={{ height: LEDGER_ROW_H, boxShadow: kept ? `inset 2px 0 0 0 ${SILVER}` : undefined }}
                data-build-row={r.strike}
                data-verdict={r.verdict}
                data-soft={dim ? '' : undefined}
                onPointerEnter={() => setHover(r.strike)}
                onClick={() => onPick?.(r.strike)}
              >
                {/* THE STRIKE, its tag, and how far from spot */}
                <div className="px-2 min-w-0">
                  <div className={`flex items-baseline gap-2 font-mono text-[14px] font-semibold tnum whitespace-nowrap ${kept ? 'text-silver' : 'text-textPrimary'}`}>
                    {fmtStrike(r.strike)}
                    {r.role && (
                      <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: ink }} data-build-role={r.role}>
                        {r.role}
                      </span>
                    )}
                    {yours?.has(r.strike) && (
                      <span className="text-[8px] font-bold uppercase tracking-wider text-warn" data-yours>
                        you own
                      </span>
                    )}
                  </div>
                  <div className="mt-[3px] font-mono text-[10px] tnum text-textMuted whitespace-nowrap" data-build-distance>
                    {at ? 'at spot' : `${distance} ${above ? 'above' : 'below'} spot`}
                  </div>
                </div>
                {/* THE WALL NOW, and the lean under it */}
                <div className="px-2 pr-[168px] min-w-0">
                  <Wall row={r} max={maxAbs} />
                  <div className="mt-[6px] text-[10px] text-textMuted whitespace-nowrap truncate" data-build-lean>
                    {r.verdict === 'switched' ? `${r.now < 0 ? 'call-heavy' : 'put-heavy'} now · was ${r.open < 0 ? 'call-heavy' : 'put-heavy'} at the open` : sideWords(r.now).replace(', so ', ' · ')}
                  </div>
                </div>
                <div className={`px-2 text-right font-mono text-[12px] tnum ${r.verdict === 'steady' ? 'text-textMuted' : 'text-textPrimary font-semibold'}`} data-build-change>
                  {signed(r.sizeChange)}
                </div>
                <div className="px-2 text-right font-mono text-[10px] tnum text-textSecondary">{contracts(r.dCall)}</div>
                <div className="px-2 text-right font-mono text-[10px] tnum text-textSecondary">{contracts(r.dPut)}</div>
                <div className="px-2">
                  <Shape shape={r.shape} live={clock.inSession} verdict={r.verdict} />
                </div>
                <div className="px-2 flex items-center gap-2 min-w-0" data-build-word={r.verdict}>
                  <span className={`inline-flex items-center h-[18px] px-2 rounded border font-mono text-[9px] font-bold uppercase tracking-wider whitespace-nowrap ${TONE[v.tone]}`} data-build-chip={v.tone}>
                    {v.chip}
                  </span>
                  <span className="text-[10.5px] text-textSecondary whitespace-nowrap truncate">{v.words}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="px-5 pb-4 pt-2 text-[12px] leading-relaxed text-textSecondary" data-build-sentence>
        {data.sentence}
      </p>
    </section>
  );
};

export default BuildingLedger;
