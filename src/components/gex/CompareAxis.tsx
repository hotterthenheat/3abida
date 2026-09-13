/*
==================================================
  SLAYER TERMINAL - THE TWO BOOKS ON ONE RULER
  (components/gex/CompareAxis.tsx)

  The second box of Compare (2026-09-08). Two
  names' hedging cannot share a price axis — $487
  against $421 says nothing — so they share a
  RULER: how far each strike is from its own name's
  spot, in the desk's unit (percent, ATRs or
  expected-move units). One column of distances
  down the middle, spot at the centre; the first
  name's capsules grow LEFT from it, the second's
  grow RIGHT, each at the height its distance puts
  it. The Map panel's own grammar — thermal
  capsules, the figure inside, the walls named as
  chips, the flip dashed — so nothing has to be
  learned twice. The drawing itself is CompareRuler
  (one lane, one greek); this box owns the head,
  the controls, the reach sums and the fullscreen.

  THE COMPARISON IS SPOKEN, NOT LEFT TO THE EYE
  (Noah, 2026-09-09): the Reach card sets how far
  the ruler runs in the day's expected moves, the
  Greek card what the capsules measure, and under
  the drawing four rows sum what sits in each band
  of reach for both names with who is heavier and
  which way each leans said in the middle.

  FULLSCREEN, AND ALL FIVE (Noah, 2026-09-09:
  "there should be a full screen option where a
  user can choose to compare any of the greeks or
  ALL of the greeks"): the box takes the whole
  viewport the Map's way, the Greek card gains
  "All", and All lays the five greeks out side by
  side as five lanes on the same ruler, sharing one
  window — a scroll on any moves them all. In
  fullscreen a click on a capsule opens its NODE
  CARD (CompareRuler), one across the box.
==================================================
*/

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Maximize2, Minimize2 } from 'lucide-react';
import { fmtDollars } from '../../data/ahead';
import { GREEK_LABEL, GREEK_WORDS, REACH_OPTIONS, type Compare, type Greek, type Reach } from '../../data/compare';
import CompanyLogo from '../ui/CompanyLogo';
import DropdownMulti from '../ui/DropdownMulti';
import { GREEK_PICK_OPTIONS } from './exposureView';
import type { DistanceUnit } from '../../data/atr';
import DropdownSelect, { type DropdownOption } from '../ui/DropdownSelect';
import { GuideDoor } from '../ui/GuideFocus';
import { HEAT_MODE, heatLaneInks } from './heatmap';
import { ladderExpiryOptions } from './ladderControls';
import type { ExposureExpiry } from '../../types/gex';
import RulerLane, { inView, layout, rulerWords, tickWords, type NodeCard } from './CompareRuler';
import { AXIS_H, AXIS_HEADS_H, AXIS_READ_H } from './compareSkeletons';

/** The thermal ramp's two voices, for the words that name them */
/* THE HEAD'S OTHER CARDS (Noah, 2026-09-10: "is 'the two books on one ruler'
   missing some top buttons … the house color vs thermal color button"): the
   Map's Expiry card and the calendar's Colours card, the same words. */
const EXPIRY_OPTIONS: DropdownOption<ExposureExpiry>[] = ladderExpiryOptions();
const PALETTE_OPTIONS: DropdownOption<'thermal' | 'house'>[] = [
  { value: 'thermal', label: 'Thermal', hint: 'Yellow in the middle, red where hedging amplifies a move, blue where it absorbs one' },
  { value: 'house', label: 'House', hint: 'Gold where hedging amplifies, ice where it absorbs' },
];

interface Props {
  cmp: Compare;
  unit: DistanceUnit;
  reach: Reach;
  onReach: (r: Reach) => void;
  /* THE GREEKS ARE A PICK (Noah, 2026-09-10: "the greek should allow the user
     to choose the amount of greeks they want to compare and not handicap them
     to 1 or 4"): the lanes drawn, in the book's order — one, some, or all
     five — and the pick behind the card (exposureView.ts's rules) */
  greeks: Greek[];
  greekPick: string[];
  onGreekPick: (values: string[]) => void;
  /** Which contracts both books weigh — the Map's Expiry card */
  expiry: ExposureExpiry;
  onExpiry: (e: ExposureExpiry) => void;
  /** The capsules' ramp — the calendar's Colours card */
  palette: 'house' | 'thermal';
  onPalette: (p: 'house' | 'thermal') => void;
  focusA: number | null;
  focusB: number | null;
  onPick: (strike: number, ticker: string) => void;
  onGuide: () => void;
  guideOpen: boolean;
  /** The box moved to the whole viewport (Compare.tsx owns the move) */
  full: boolean;
  onFull: (full: boolean) => void;
}

/** What each name holds on one side of spot within the ruler's reach, and who is
    heavier there (2026-09-09: the four band rows under the drawing — words first,
    then bars — read as a second ruler under the first, "is it reading the top
    big ruler or the bottom one"; the comparison lives in the head now, two
    facts, and the drawing is taller) */
interface ReachSide {
  neg: number;
  pos: number;
  total: number;
}
const sumSide = (rows: { d: number; value: number }[], R: number, above: boolean): ReachSide => {
  let neg = 0;
  let pos = 0;
  for (const r of rows) {
    if (!(above ? r.d > 0 && r.d <= R : r.d < 0 && r.d >= -R)) continue;
    if (r.value < 0) neg += -r.value;
    else pos += r.value;
  }
  return { neg, pos, total: neg + pos };
};
const heavierWords = (a: ReachSide, b: ReachSide, na: string, nb: string) => {
  if (a.total <= 0 && b.total <= 0) return { lead: 'nothing on either', tail: '' };
  if (a.total <= 0 || b.total <= 0) return { lead: `only ${a.total > 0 ? na : nb}`, tail: fmtDollars(Math.max(a.total, b.total)) };
  const ratio = Math.max(a.total, b.total) / Math.min(a.total, b.total);
  const lead = ratio < 1.15 ? 'about even' : `${a.total >= b.total ? na : nb} ${ratio.toFixed(1)}× heavier`;
  return { lead, tail: `${fmtDollars(a.total)} vs ${fmtDollars(b.total)}` };
};

const CompareAxis = ({ cmp, unit, reach, onReach, greeks, greekPick, onGreekPick, expiry, onExpiry, palette, onPalette, focusA, focusB, onPick, onGuide, guideOpen, full, onFull }: Props) => {
  /* several lanes side by side, or the one drawing */
  const all = greeks.length > 1;
  /* the sub line's two inks follow the capsules' ramp */
  const { pos: WARM, neg: COOL } = heatLaneInks(palette === 'house' ? HEAT_MODE : 'thermal-yellow', 0.72);
  const greek: Greek = greeks[0] ?? 'gex';
  const greekKey = greeks.join(',');
  const words = GREEK_WORDS[greek];
  /* The ruler is the same whatever the greek — the strikes are the same — so one layout serves the head */
  const lay = useMemo(() => layout(cmp, unit, reach, greek), [cmp, unit, reach, greek]);
  const limit = Math.max(0, lay.maxD - lay.R);
  const scrollable = lay.maxD > lay.R;
  /* THE WINDOW'S TARGET along the ruler (0 = spot), one for every lane on the box */
  const [want, setWant] = useState(0);
  useEffect(() => setWant(0), [cmp.a.ticker, cmp.b.ticker, reach]);
  const target = Math.max(-limit, Math.min(limit, want));
  const view = inView(lay, target);
  const scale = view.scale(greek);

  /* THE NODE CARD (fullscreen): one open across the box, whichever lane it is
     on; a new pair of names, another greek or leaving fullscreen closes it,
     and Esc closes it before Esc leaves fullscreen. A CLICK ANYWHERE closes it
     too (Noah, 2026-09-09: "not exit only when i click the focused node") —
     the document hears it in the capture phase, before the lane's own click,
     which then opens the next card if that click landed on another capsule.
     Clicks inside the drawing are the lane's to judge, so a pull along the
     ruler keeps the card and the capsule itself can let go. */
  const [card, setCard] = useState<NodeCard | null>(null);
  useEffect(() => setCard(null), [cmp.a.ticker, cmp.b.ticker, greekKey, full]);
  useEffect(() => {
    if (!card) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setCard(null);
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (t?.closest('[data-node-card],[data-axis-canvas]')) return;
      setCard(null);
    };
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('click', onClick, true);
    };
  }, [card]);
  /* All on the page too (Noah, 2026-09-09: "non full screen on the rulers 'all' greek
     selection should be possible as well… making the rulers smaller") — the lanes
     picked stand in the single drawing's height; fullscreen gives them the screen */
  const greekGroups = useMemo(() => [{ title: 'What the capsules measure', options: GREEK_PICK_OPTIONS }], []);

  /* WHAT SITS WITHIN REACH — each name's hedging above spot and below it, as far
     as the ruler runs, and who is heavier on each side: two facts in the head */
  const reachFacts = useMemo(() => {
    const aUp = sumSide(lay.a.rows, lay.R, true);
    const bUp = sumSide(lay.b.rows, lay.R, true);
    const aDn = sumSide(lay.a.rows, lay.R, false);
    const bDn = sumSide(lay.b.rows, lay.R, false);
    return { up: heavierWords(aUp, bUp, cmp.a.ticker, cmp.b.ticker), down: heavierWords(aDn, bDn, cmp.a.ticker, cmp.b.ticker) };
  }, [lay, cmp.a.ticker, cmp.b.ticker]);

  const off = `${cmp.a.ticker} ${view.off.a} · ${cmp.b.ticker} ${view.off.b}`;
  const laneProps = { cmp, unit, reach, want, onWant: setWant, focusA, focusB, onPick, card, onCard: full ? setCard : undefined, palette };

  return (
    <section className={`relative flex flex-col min-w-0 ${full ? 'h-full min-h-0' : ''}`} data-compare-axis data-ruler={lay.U} data-reach={reach} data-greeks={greekKey} data-offset={target.toFixed(3)} data-scrollable={scrollable || undefined} data-full={full || undefined}>
      {/* THE HEAD */}
      <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap shrink-0">
        <div className="min-w-0 flex-1">
          <div className="h-6 flex items-center gap-3 flex-wrap">
            {full && (
              <button type="button" onClick={() => onFull(false)} className="inline-flex items-center gap-1.5 h-6 px-2 rounded-md border border-borderSubtle hover:border-borderMuted font-mono text-[10px] text-textSecondary hover:text-textPrimary transition-colors" title="Back to the page (Esc)" data-axis-back>
                <ArrowLeft className="w-3 h-3" /> Back
              </button>
            )}
            <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">The two books on one ruler</h3>
            <GuideDoor open={guideOpen} onClick={onGuide} title="What the two sides and the ruler mean" testId="compare-guide" />
          </div>
          <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">
            {all ? (
              <>Each strike at its distance from its own spot · {cmp.a.ticker} grows left, {cmp.b.ticker} right · one lane per greek, one window for all {greeks.length} · dashed is each flip</>
            ) : (
              <>
                Each strike at its distance from its own spot · {cmp.a.ticker} grows left, {cmp.b.ticker} right · longer is more {GREEK_LABEL[greek]} · <span style={{ color: COOL }}>{palette === 'house' ? 'ice' : 'blue'}</span> {words.neg}, <span style={{ color: WARM }}>{palette === 'house' ? 'gold' : 'orange'}</span> {words.pos} · dashed is each flip
              </>
            )}
          </p>
        </div>
        <dl className="grid grid-cols-5 gap-x-6">
          <div>
            <dt className="text-[10px] text-textMuted">Ruler</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" title={unit === '$' ? 'Dollars do not compare across names, so the ruler reads percent here' : undefined}>
              {lay.U === '%' ? (unit === '$' ? 'percent, not dollars' : 'percent') : lay.U === 'ATR' ? 'ATRs' : 'expected moves'}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-textMuted">Shown</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-axis-shown>
              {Math.abs(target) < 1e-6 ? `±${tickWords(lay.R, lay.U).replace(/^[+−]/, '')}` : `${tickWords(target - lay.R, lay.U)} to ${tickWords(target + lay.R, lay.U)}`}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-textMuted">Off the ruler</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textSecondary whitespace-nowrap" data-axis-off>
              {off}
            </dd>
          </div>
          {/* WHO IS HEAVIER within reach, above spot and below it — the comparison the four rows used to say */}
          <div title={reachFacts.up.tail ? `${GREEK_LABEL[greek]} above spot within reach · ${cmp.a.ticker} vs ${cmp.b.ticker} · ${reachFacts.up.tail}` : undefined}>
            <dt className="text-[10px] text-textMuted whitespace-nowrap">Overhead, in reach</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-axis-reach-up>
              {reachFacts.up.lead}
            </dd>
          </div>
          <div title={reachFacts.down.tail ? `${GREEK_LABEL[greek]} below spot within reach · ${cmp.a.ticker} vs ${cmp.b.ticker} · ${reachFacts.down.tail}` : undefined}>
            <dt className="text-[10px] text-textMuted whitespace-nowrap">Below, in reach</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-axis-reach-down>
              {reachFacts.down.lead}
            </dd>
          </div>
        </dl>
        {/* THE FULLSCREEN DOOR at the head's far right — where the calendar's and
            the chart's sit (Noah, 2026-09-10: beside the title it "seems like
            its on the wrong place") */}
        <div className="shrink-0 h-6 flex items-center">
          <button
            type="button"
            onClick={() => onFull(!full)}
            aria-pressed={full}
            title={full ? 'Leave fullscreen (Esc)' : 'Fullscreen'}
            className="inline-flex items-center justify-center w-6 h-6 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.05] transition-colors"
            data-axis-full
          >
            {full ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* THE ONE LINE OF CONTROLS */}
      <div className="px-5 pb-2 flex items-center gap-2 flex-wrap shrink-0" data-axis-controls>
        <DropdownSelect label="Expiry" value={expiry} options={EXPIRY_OPTIONS} onChange={onExpiry} title="Which contracts both books weigh" testId="compare-expiry" />
        <DropdownSelect label="Reach" value={reach} options={REACH_OPTIONS} onChange={onReach} title="How far the ruler runs, in the day's expected moves" testId="reach" />
        <DropdownMulti label="Greek" values={greekPick} groups={greekGroups} onChange={onGreekPick} emptyWord="All" title="One, some, or all five — a lane each, on one ruler" testId="compare-greek" align="start" />
        <DropdownSelect label="Colours" value={palette} options={PALETTE_OPTIONS} onChange={onPalette} title="What the colours mean" testId="compare-colours" />
        <span className="ml-auto font-mono text-[9px] uppercase tracking-widest text-textMuted whitespace-nowrap">{rulerWords(lay.U)}</span>
      </div>

      {all ? (
        /* ALL FIVE — one lane per greek on the same ruler, the same window; on the page
           the five stand in the single drawing's height (heads + drawing + read), so the
           box does not move when the card flips between one greek and all */
        <div
          className={`min-h-0 px-3 pb-3 grid gap-2 ${full ? 'flex-1' : 'shrink-0'}`}
          style={{ gridTemplateColumns: `repeat(${greeks.length}, minmax(0, 1fr))`, height: full ? undefined : AXIS_HEADS_H + AXIS_H + AXIS_READ_H + 12 /* the pb-3 */ }}
          data-axis-all
        >
          {greeks.map(g => (
            <div key={g} data-theme="dark" className="min-w-0 min-h-0 flex flex-col border border-borderSubtle/60 rounded-md overflow-hidden bg-panel" data-axis-lane-box={g}>
              <RulerLane {...laneProps} greek={g} compact />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* THE LANE HEADS */}
          <div className="px-5 flex items-center justify-between font-mono text-[10px] tnum shrink-0" style={{ height: AXIS_HEADS_H }} data-axis-heads>
            <span className="text-textSecondary inline-flex items-center gap-1.5">
              <CompanyLogo ticker={cmp.a.ticker} size={13} />
              <span className="font-bold text-textPrimary">{cmp.a.ticker}</span> · {cmp.a.spot.toFixed(2)} · <span className="text-textSecondary">scaled to {fmtDollars(scale.a)} {GREEK_LABEL[greek]}</span>
            </span>
            <span className="text-[9px] uppercase tracking-widest text-textMuted">longest capsule = each name's heaviest {GREEK_LABEL[greek]} strike shown</span>
            <span className="text-textSecondary inline-flex items-center gap-1.5">
              <span className="text-textSecondary">scaled to {fmtDollars(scale.b)} {GREEK_LABEL[greek]}</span> · {cmp.b.spot.toFixed(2)} · <span className="font-bold text-textPrimary">{cmp.b.ticker}</span>
              <CompanyLogo ticker={cmp.b.ticker} size={13} />
            </span>
          </div>

          {/* THE DRAWING — a fixed height on the page, the rest of the screen in fullscreen */}
          {/* A DARK ISLAND on either theme — the capsules wear the heat ramp, cut for a
              dark ground (Noah, 2026-09-12: "these ladders need gray or black as the background") */}
          <div data-theme="dark" className={`bg-panel ${full ? 'flex-1 min-h-0 flex flex-col' : 'shrink-0 rounded-md'}`} data-ruler-island>
            <RulerLane {...laneProps} greek={greek} height={full ? undefined : AXIS_H} />
          </div>

          {!full && <div className="h-3 shrink-0" aria-hidden />}
        </>
      )}
    </section>
  );
};

export default CompareAxis;
