/*
==================================================
  SLAYER TERMINAL - REVIEW · THE POSITION ON THE CHART
  (components/review/PositionLayer.tsx)

  What a backtest draws OVER the house chart
  (StrikeChart's `layer`): the reader's fills, the
  open position, and the target and the stop that
  ride it. It began inside a small chart of the
  backtest's own; when the desk took the real chart
  (Noah, 2026-09-20: "i cant see my toolbar") it
  became a layer, so the tools and the position are
  on ONE chart.

  THE POSITION IS ON THE CHART ("like how tradingview
  or any other backtesting looks"): a line where the
  name stood when it was entered, a chip on it — the
  contract, what it is up or down, a × that sells it.
  THE TARGET AND THE STOP are dashed lines with chips
  that DRAG, each with a × of its own. What is
  particular to options: a target and a stop are
  prices of the CONTRACT, and this is a chart of the
  NAME — so each is drawn where the name would have to
  stand, RIGHT NOW, for the contract to be worth that.
  The lines drift as the hours pass (decay pushes a
  call's target further up the chart every hour), and
  a drag to a price of the name sets the order to what
  the contract would bid there.

  THEY COME OFF THE POSITION ITSELF ("tradingview and
  others allow you to click this and drag your tp and
  stoploss from it"): press the position's chip and
  pull — a dashed line leaves it and follows the hand.
  WHICH ONE IT IS, the contract decides: where it
  would bid MORE than it does now the line is a
  target, less a stop (so on a put the target is
  pulled DOWN the chart). A press that does not travel
  is just a press.

  WHAT OPTIONS HAVE THAT FUTURES DO NOT (Noah, the same
  day: "do those tps and stop losses increase or
  decrease depending on how close you are to
  expiration?"). A way out set on the CONTRACT'S price
  keeps its dollars and its line DRIFTS — every minute
  of decay the name has to go further for the target,
  and less far for the stop (a same-day stop walks up
  into a name that has not moved). So each chip carries
  A PIN: pinned, the way out waits on THE NAME'S price —
  the line stays where it is and the dollars drift
  instead ("about +$62": what it would make if the name
  got there this minute). Shift while pulling a line off
  the position pins it from the start.

  A LINE THAT HAS LEFT THE PICTURE STILL HAS A CHIP. A
  line further off than the name's expected day is not
  given room on the scale (it would flatten the candles
  to a thread); its chip is held at the plot's edge on
  its own side with an arrow and where the name would
  have to be — and "out of reach" when no price of the
  name gives it at all. The order is still working; the
  chip still drags, pins and closes.

  THE POSITION'S LINE WAS PLAIN INK (Noah, 2026-09-20,
  with a picture of a call: "i dont like how the target
  and the current strike options chain have the same
  green horizontal line coming from them… the border nor
  the horizontal line should be green, maybe white on
  black backgrounds and black on lighter backgrounds like
  the stone") — until his pictures of 2026-09-22 (THE
  CHIPS ARE SOLID, below) gave it back its colour: now
  the position's line is SOLID and green or red by what
  it is up or down, the ways out DASHED, and a target
  and the position are told apart by the stroke and by
  their chips, never by the ink alone.

  THE SERIES IS ASKED FOR EVERY FRAME, NEVER KEPT: a
  chart-style swap replaces it, and every line hung
  on the old one goes with it — the layer notices and
  hangs them again.

  A RIGHT-CLICK IS A TRADE (2026-09-22, the partner's trade
  menu, which Noah liked): a press of the right button on
  the chart opens a card AT THE PRICE UNDER THE POINTER —
  what can be done there, the desk's to say (`menu`): a
  limit or a stop at that price, the market, a target or a
  stop put there on what is open, half of it or all of it
  closed, a reversal, what is working cancelled. The card
  says the price it is for at its head; it goes on Esc, on
  a press anywhere else, on the wheel, and when one of its
  lines is taken.
  THE CHIPS ARE SOLID (Noah, 2026-09-22, with three pictures
  of a futures platform's chart trader: "my stop losses and
  tps should look like this"). A way out's chip is ONE BAR:
  a grip, what it would make or lose there on a block of its
  own colour — green a target, red a stop, the dark words on
  them — then its contracts, then its ✕. The position's chip
  is the same bar: what it is up or down on green or red,
  its contracts on its side's colour (long or a call green,
  short or a put red), its ✕. A stop's switches (trail,
  breakeven) and an option's pin come out beside it when
  the pointer is on it. THE POSITION'S OWN LINE follows its
  chip: solid, green while it is up and red while it is down
  — his picture's, in place of the plain ink of 2026-09-20;
  the ways out stay dashed, so the two never read alike.

  A RESTING ORDER THAT IS NOT A WAY OUT (Noah, 2026-09-22,
  with a picture of a chart trader's "1 · Buy stop · ✕" and
  "1 · Sell limit · ✕": "are buy stops and sell limits
  shown as such right now?" — they were not drawn at all):
  a limit or a stop waiting to open a position or add to
  one (`entries`). Its chip SAYS WHAT IT IS — "Buy stop",
  "Buy limit", "Sell limit", "Sell stop" — in its side's
  colour, on an OUTLINE: a live position and its ways out
  are solid bars, an order that is only waiting is not.
  Its line is dotted in the same colour, the price on the
  axis; the chip drags the order to a new price (the
  engine keeps a stop from being dragged through the
  market) and its × cancels it. An option's (a buy limit
  on a contract) is drawn where the name would have to
  stand for the contract's ASK to come down to it, and
  its chip says the contract and the price.

  ONE CARD, NEVER TWO: the right-click was Noah's for the
  chart's way home ("right click be reserved for a reset
  button display card", 2026-08-30). On a chart that trades,
  the trade card stands in for that card — the right-click
  goes no further — and carries "Reset chart view · Alt+R"
  as its last line, so the way home is still one right-click
  away.
==================================================
*/

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { LineStyle, createSeriesMarkers, type IPriceLine, type ISeriesApi, type ISeriesMarkersPluginApi, type SeriesMarker, type SeriesType, type Time, type UTCTimestamp } from 'lightweight-charts';
import * as Popover from '@radix-ui/react-popover';
import { Equal, Footprints, Pin, X } from 'lucide-react';
import type { ChartLayerApi } from '../gex/StrikeChart';
import { readToken } from '../../theme/theme';
import { barTime } from '../../data/review/tape';
import { contractKey, contractWords, type ContractId } from '../../data/review/quotes';
import type { Fill } from '../../data/review/engine';
import { usdSigned } from './words';

export interface ChartPosition {
  key: string;
  contract: ContractId;
  qty: number;
  /** Where the name stood when it was entered */
  spotIn: number;
  pnl: number;
  r: number;
  /** What was paid, and what it bids now — a line pulled off the chip is a target above the bid, a stop under it */
  avg: number;
  bid: number;
  /** No bid to sell into right now */
  dead: boolean;
  /** The chip's words, where they are not the contract's short name */
  label?: string;
  /** The badge's colour, where it is not a call's green and a put's red */
  tone?: 'bull' | 'bear';
  /** THE LADDER: what a further pull off this chip would do, per kind — the first of its kind, one more level, or nothing
      (three targets and two stops is the ladder; a level of one contract has nothing to give) */
  room?: Record<'target' | 'stop', 'first' | 'more' | null>;
  /** …and how many contracts that pull would speak for — what the preview's dollars are for */
  take?: Record<'target' | 'stop', number>;
}
/** A fill's arrow, already placed by the host (a future's fills are not option fills) */
export interface ChartMark {
  /** The instant of its minute */
  time: number;
  side: 'buy' | 'sell';
  text: string;
  /** Not the reader's doing (a roll): drawn quietly */
  quiet?: boolean;
}
export interface ChartBracket {
  orderId: string;
  kind: 'target' | 'stop';
  /** What it waits on: the contract's price (its dollars hold, its line drifts) or the name's (the line holds) */
  on: 'contract' | 'name';
  contract: ContractId;
  qty: number;
  /** What the order waits for: a price of the contract — or, on the name, a price of the name */
  price: number;
  /** Where its line is on the chart of the name. On the contract: where the name would have to stand, now, for the
      contract to bid that — null when no price in reach gives it. On the name: the level itself. */
  level: number | null;
  /** What it would make or lose against what was paid — on the name, if the name got there THIS minute */
  money: number;
  /** The side of the chart its line lives on: a call's target up, its stop down; a put's the other way */
  edge: 'up' | 'down';
  /** Further off than the name's expected day: given no room on the scale */
  far: boolean;
  /** THE LADDER: which of its kind it is, nearest first — said only where there is more than one ("Target 2") */
  nth?: number;
  /** A STOP's switches: the distance it trails by (null: it does not), and whether the first target's fill will move it to
      what was paid; `canBreakeven`: its ladder has a target for that to mean anything */
  trail?: number | null;
  /** The distance it stands at from the price NOW — what a trailing distance starts as on the chip's card */
  trailNow?: number;
  breakeven?: boolean;
  canBreakeven?: boolean;
}

/** A line of the right-click's card: what it does, in words, and — where it cannot be taken — why */
/** A resting order that is NOT a way out — a limit or a stop waiting to open (or add to) a position (see the head note) */
export interface ChartEntry {
  orderId: string;
  side: 'buy' | 'sell';
  kind: 'limit' | 'stop';
  qty: number;
  /** The price it waits at — the future's own; an option's is the contract's */
  price: number;
  /** Where on this chart: a future's price; an option's, where the name would have to stand NOW for the contract's ask to
      come down to it — null when no price of the name in reach gives it */
  level: number | null;
  /** An option's contract, in short ("480C") — a future's chip needs none */
  label?: string;
  /** Which way its line is when it has none */
  edge: 'up' | 'down';
  /** Further off than the name's expected day: no room on the scale for it — its chip waits at the edge */
  far: boolean;
  /** The order's price for its line dragged to a price of the name: a future's, that price on its tick; an option's, what
      the contract would ask there */
  priceAt: (level: number) => number;
}
export interface ChartMenuItem {
  label: string;
  hint?: string;
  tone?: 'bull' | 'bear';
  /** Why it waits (another tab holds the account…) — the line shows, and does nothing */
  off?: string | null;
  run: () => void;
  testId?: string;
}
export interface ChartMenuSection {
  title?: string;
  items: ChartMenuItem[];
}
/** What the desk offers at a price of the chart: the card's head (the price, the size) and its sections */
export interface ChartMenu {
  head: ReactNode;
  sections: ChartMenuSection[];
}

export interface PositionLayerProps {
  api: ChartLayerApi;
  ticker: string;
  /** Minutes a candle — a fill's arrow lands on the candle that holds its minute */
  minutes: number;
  fills: Fill[];
  /** Fills already placed by the host, instead of `fills` */
  marks?: ChartMark[];
  positions: ChartPosition[];
  brackets: ChartBracket[];
  /** The resting orders that are not ways out (see the head note) */
  entries?: ChartEntry[];
  /** 16:00 has rung: nothing sells at the market until the next open — the position's × waits */
  marketShut?: boolean;
  onClosePosition: (contract: ContractId, qty: number) => void;
  /** A dragged line, let go: the order's new price — of the contract, or of the name when that is what it waits on */
  onAmend: (orderId: string, price: number) => void;
  /** The chip's pin: the same way out, waiting on the other thing */
  onRebase: (orderId: string, to: 'name' | 'contract') => void;
  /** The × on a target's or a stop's chip: that order goes, its pair stays */
  onCancelOrder: (orderId: string) => void;
  /** A line pulled off a position's chip, let go: a target or a stop on it, at the contract's price — or, with Shift
      held, pinned to the name's */
  onAttach: (contract: ContractId, kind: 'target' | 'stop', price: number, on?: 'name') => void;
  /** What the contract would bid with the name at a price, at the clock's minute */
  bidAtSpot: (contract: ContractId, spot: number) => number;
  /** A stop's two switches (the ladder). Trailing: on, by a typed distance — or, with none, by the distance the stop stands at */
  onTrail?: (orderId: string, on: boolean, by?: number) => void;
  onBreakeven?: (orderId: string, on: boolean) => void;
  /** THE RIGHT-CLICK (see the head note): what can be done at a price of the chart — nothing, where it returns null */
  menu?: (price: number) => ChartMenu | null;
}

const short = (c: ContractId, ticker: string) => contractWords(c).replace(`${ticker} `, '');
const SILVER_FILL = 'rgb(var(--silver-fill))';

/** THE TRAIL CARD on a stop's chip (2026-09-21): the distance it keeps can be typed — it starts as what the stop is
    trailing by, or, not yet trailing, the distance it stands at now */
const TrailDoor = ({ b, dp, onTrail }: { b: ChartBracket; dp: number; onTrail: (orderId: string, on: boolean, by?: number) => void }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const field = useRef<HTMLInputElement | null>(null);
  const on = b.trail != null;
  const startAt = b.trail ?? b.trailNow ?? 0;
  useEffect(() => {
    if (open) setDraft(startAt > 0 ? startAt.toFixed(dp) : '');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const by = Number(draft);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          onClick={e => e.stopPropagation()}
          aria-pressed={on}
          title={on ? `Trailing: it keeps ${b.trail!.toFixed(dp)} from the best price since, and never moves back. Press to change the distance, or let it rest` : 'Trail it — keep a distance from the best price, and never move back'}
          aria-label={on ? 'The trailing distance' : 'Trail the stop'}
          className={`hit inline-flex items-center justify-center w-4 h-4 rounded transition-colors ${on ? 'text-silver bg-silver/[0.14]' : 'text-textMuted hover:text-textPrimary hover:bg-ink/[0.08]'} data-[state=open]:text-silver`}
          data-chart-trail={on ? 'on' : 'off'}
        >
          <Footprints className="w-3 h-3" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          onClick={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
          onOpenAutoFocus={e => {
            e.preventDefault();
            field.current?.focus();
            field.current?.select();
          }}
          className="z-[95] w-[250px] rounded-md border border-borderMuted bg-panel p-2.5 shadow-[0_14px_40px_rgba(0,0,0,0.45)] outline-none animate-soft-in"
          data-theme="dark"
          data-chart-trail-card
        >
          <form
            className="flex flex-col gap-2"
            onSubmit={e => {
              e.preventDefault();
              if (!(by > 0)) return;
              onTrail(b.orderId, true, by);
              setOpen(false);
            }}
          >
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-textMuted leading-snug">Trail by — the distance it keeps from the best price since{on ? '' : ' (it starts as where the stop stands now)'}</span>
              <input ref={field} value={draft} onChange={e => setDraft(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" aria-label="Trail by" className="h-8 px-2 rounded-md border border-borderSubtle bg-panel font-mono text-[12px] tnum text-textPrimary outline-none focus:border-silver/60 transition-colors" data-chart-trail-field />
            </label>
            <div className="flex items-center gap-2">
              <button type="submit" disabled={!(by > 0)} className="hit h-7 px-3 rounded-full text-[11px] font-semibold disabled:opacity-35 transition-opacity hover:opacity-90" style={{ background: SILVER_FILL, color: 'rgb(var(--night))' }} data-chart-trail-apply>
                {on ? 'Trail by this' : 'Trail'}
              </button>
              {on && (
                <button type="button" onClick={() => { onTrail(b.orderId, false); setOpen(false); }} className="hit h-7 px-2.5 rounded-md border border-borderSubtle font-mono text-[10px] text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors" data-chart-trail-off>
                  Let it rest
                </button>
              )}
            </div>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
/** How far a press has to travel before it is a pull, in pixels */
const PULL_PX = 6;
/** Whether the chart's box stands on a light tape (the host's `data-chart-ground` stamp) */
const softGround = (from: Element | null): boolean => from?.closest('[data-chart-ground]')?.getAttribute('data-chart-ground') === 'light';
/** A token's ink over the panel at 18% — an axis label's ground on a light tape: the DOM's `.fill-*` color-mix, done by
    hand for the canvas (the library takes one colour string) */
const softTint = (token: string, from: Element | null): string => {
  const cs = getComputedStyle(from ?? document.documentElement);
  const read = (name: string, fallback: number[]) => {
    const p = cs.getPropertyValue(name).trim().split(/\s+/).map(Number);
    return p.length === 3 && p.every(x => Number.isFinite(x)) ? p : fallback;
  };
  const ink = read(token, [0, 0, 0]);
  const panel = read('--panel', [232, 231, 226]);
  return `rgb(${ink.map((c, i) => Math.round(panel[i] + (c - panel[i]) * 0.18)).join(' ')})`;
};
/** The room the scale keeps beyond every line of an open position, as a share of the name's price */
const ROOM_PCT = 0.006;

const PositionLayer = ({ api, ticker, minutes, fills, marks: hostMarks, positions, brackets, entries = [], marketShut = false, onClosePosition, onAmend, onRebase, onCancelOrder, onAttach, bidAtSpot, onTrail, onBreakeven, menu }: PositionLayerProps) => {
  /* the inks are read off an element under the CHART'S OWN token set (index.css re-scopes `data-chart-ink` to the tape's
     ground): pale silver on a dark tape, deep steel on Stone */
  const inkRef = useRef<HTMLSpanElement | null>(null);
  const chipsRef = useRef<HTMLDivElement | null>(null);
  const chipEls = useRef<Map<string, HTMLDivElement>>(new Map());
  const levels = useRef<Map<string, number>>(new Map());
  /** The side a chip with NO line is held on (a way out no price of the name gives) */
  const edges = useRef<Map<string, 'up' | 'down'>>(new Map());
  const linesRef = useRef<Map<string, IPriceLine>>(new Map());
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const seriesRef = useRef<ISeriesApi<SeriesType> | null>(null);
  /** Bumped when the chart hands over a new series: everything hung on the old one is hung again */
  const [seriesN, setSeriesN] = useState(0);
  /** A line under the hand: its chip, and the name's price it is held at */
  const dragRef = useRef<{ id: string; level: number } | null>(null);
  const [drag, setDrag] = useState<{ id: string; price: number; level: number } | null>(null);
  /** A line being pulled off a position's chip: whose, which it has become, and what it would be worth */
  const [pull, setPull] = useState<{ key: string; kind: 'target' | 'stop'; price: number; money: number; level: number; pinned: boolean; room: 'first' | 'more' | null } | null>(null);
  const pullRef = useRef<{ key: string; y0: number; line: IPriceLine | null; kind: 'target' | 'stop'; price: number; level: number; pinned: boolean } | null>(null);

  /* THE CHIPS RIDE THEIR LINES: a line's height on screen changes with every new bar, every zoom, every resize, and the
     library tells nobody — so the chips are placed each frame, by whole pixels (a half pixel blurs the words), and kept
     inside the plot when their line is out of view. The same loop notices a new series. */
  useEffect(() => {
    let raf = 0;
    const place = () => {
      const chart = api.chart();
      const series = api.series();
      if (series !== seriesRef.current) {
        seriesRef.current = series;
        linesRef.current = new Map();
        markersRef.current = null;
        setSeriesN(n => n + 1);
      }
      const wrap = chipsRef.current;
      if (wrap && chart && series) {
        /* the PRICE pane alone: an indicator's pane under it is not somewhere a position's chip can be held */
        const h = chart.paneSize(0).height;
        wrap.style.right = `${chart.priceScale('right').width()}px`;
        wrap.style.height = `${h}px`;
        const seen: { id: string; el: HTMLDivElement; y: number }[] = [];
        for (const [id, el] of chipEls.current) {
          const level = dragRef.current?.id === id ? dragRef.current.level : levels.current.get(id);
          const side = edges.current.get(id);
          let y: number | null = level == null ? null : series.priceToCoordinate(level);
          if (y == null && level == null && side) y = side === 'up' ? -1e6 : 1e6;
          if (y == null) el.style.visibility = 'hidden';
          else {
            /* out of the picture: the chip is held at the edge, and says which way its line is */
            const off = y < 12 ? 'up' : y > h - 12 ? 'down' : '';
            if (el.dataset.off !== off) {
              el.dataset.off = off;
              el.querySelectorAll<HTMLElement>('[data-chip-off]').forEach(n => (n.hidden = !off));
              const arrow = el.querySelector<HTMLElement>('[data-chip-arrow]');
              if (arrow) arrow.textContent = off === 'up' ? '↑' : off === 'down' ? '↓' : '';
            }
            el.style.visibility = 'visible';
            seen.push({ id, el, y: Math.max(12, Math.min(h - 12, y)) });
          }
        }
        /* A LADDER'S LEVELS SIT CLOSE (five of them, a few points apart): chips that would lie on each other are moved
           apart by whole chips, in the order of their lines — a chip stays beside its line where it can, and keeps its
           place in the ladder where it cannot. The one under the hand is never moved: it is where the hand is. */
        const GAP = 24;
        seen.sort((a, b) => a.y - b.y);
        const held = dragRef.current?.id;
        for (let i = 1; i < seen.length; i++) if (seen[i].id !== held && seen[i].y < seen[i - 1].y + GAP) seen[i].y = seen[i - 1].y + GAP;
        /* …and back up from the foot, where pushing down ran them off the pane */
        if (seen.length && seen[seen.length - 1].y > h - 12) {
          seen[seen.length - 1].y = h - 12;
          for (let i = seen.length - 2; i >= 0; i--) if (seen[i].id !== held && seen[i].y > seen[i + 1].y - GAP) seen[i].y = seen[i + 1].y - GAP;
        }
        for (const c of seen) c.el.style.transform = `translateY(${Math.round(c.y - 10)}px)`;
      }
      raf = requestAnimationFrame(place);
    };
    raf = requestAnimationFrame(place);
    return () => {
      cancelAnimationFrame(raf);
      /* ONLY WHILE THE CHART STANDS. On the way out of the page the chart's clean-up runs before this one (a parent's
         before its child's) and takes every line with it; a line taken off a removed chart does not throw here — it asks
         for a redraw that throws a frame later ("Object is disposed"). */
      const series = api.chart() && api.series() === seriesRef.current ? seriesRef.current : null;
      if (series) {
        for (const line of linesRef.current.values()) series.removePriceLine(line);
        markersRef.current?.setMarkers([]);
      }
      linesRef.current = new Map();
      markersRef.current = null;
      seriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- THE RIGHT-CLICK: a card at the price under the pointer ---- */
  const [open, setOpen] = useState<{ x: number; y: number; card: ChartMenu } | null>(null);
  const menuRef = useRef(menu);
  menuRef.current = menu;
  const cardRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const host = api.host();
    if (!host) return;
    const onMenu = (e: MouseEvent) => {
      const build = menuRef.current;
      const series = api.series();
      if (!build || !series) return;
      const box = host.getBoundingClientRect();
      const y = e.clientY - box.top;
      const price = series.coordinateToPrice(y);
      if (price == null || !(price > 0)) return;
      const card = build(price);
      if (!card) return;
      e.preventDefault();
      /* ONE CARD: the chart's reset card (ResetViewControl, on the box around this one) is this card's last line */
      e.stopPropagation();
      setOpen({ x: e.clientX - box.left, y, card });
    };
    host.addEventListener('contextmenu', onMenu);
    return () => host.removeEventListener('contextmenu', onMenu);
  }, [api, seriesN]);
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      if (cardRef.current && e.target instanceof Node && cardRef.current.contains(e.target)) return;
      setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(null);
      }
    };
    window.addEventListener('pointerdown', away, true);
    window.addEventListener('wheel', away, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', away, true);
      window.removeEventListener('wheel', away, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);
  /* kept inside the chart: a card opened near the right or the foot opens back towards the middle */
  const cardPos = (() => {
    if (!open) return null;
    const host = api.host();
    const w = host?.clientWidth ?? 800;
    const h = host?.clientHeight ?? 500;
    const cw = 272;
    const ch = cardRef.current?.offsetHeight ?? 300;
    return { left: Math.max(8, Math.min(open.x + 4, w - cw - 8)), top: Math.max(8, Math.min(open.y + 4, h - ch - 8)) };
  })();

  /* the fills, as arrows on the candle that holds their minute */
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || api.series() !== series) return; // a swapped series: the frame loop hands over the new one, and this runs again
    markersRef.current ??= createSeriesMarkers(series, []);
    const bucket = Math.max(1, minutes) * 60;
    if (hostMarks) {
      markersRef.current.setMarkers(
        hostMarks
          .map(m => ({
            time: (m.time - (m.time % bucket)) as UTCTimestamp,
            position: m.side === 'buy' ? ('belowBar' as const) : ('aboveBar' as const),
            shape: m.side === 'buy' ? ('arrowUp' as const) : ('arrowDown' as const),
            color: readToken(m.quiet ? '--text-muted' : m.side === 'buy' ? '--silver' : '--warn', undefined, inkRef.current ?? undefined),
            text: m.text,
          }))
          .sort((a, b) => (a.time as number) - (b.time as number))
      );
      return;
    }
    const marks: SeriesMarker<Time>[] = fills
      .map(f => ({ f, t: barTime(f.at.day, f.at.minute) }))
      .map(({ f, t }) => ({
        time: (t - (t % bucket)) as UTCTimestamp,
        position: f.side === 'buy' ? ('belowBar' as const) : ('aboveBar' as const),
        shape: f.side === 'buy' ? ('arrowUp' as const) : ('arrowDown' as const),
        color: readToken(f.side === 'buy' ? '--silver' : f.how === 'expired' ? '--text-muted' : '--warn', undefined, inkRef.current ?? undefined),
        text: `${f.side === 'buy' ? 'Bought' : f.how === 'expired' ? 'Expired' : 'Sold'} ${f.qty} · ${short(f.contract, ticker)}`,
      }))
      .sort((a, b) => (a.time as number) - (b.time as number));
    markersRef.current.setMarkers(marks);
  }, [fills, hostMarks, minutes, ticker, seriesN]);

  /* the lines: a position's entry, its strike, and what rides it */
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || api.series() !== series) return; // a swapped series: the frame loop hands over the new one, and this runs again
    const ink = (t: string) => readToken(t, undefined, inkRef.current ?? undefined);
    /* on a light tape a label on the axis is the ink on a tint of it, not a slab — the chips' soft cut (index.css .fill-*) */
    const soft = softGround(inkRef.current);
    const want = new Map<string, { price: number; color: string; token: string; style: LineStyle; title: string; label: boolean }>();
    const line = (price: number, token: string, style: LineStyle, title: string, label: boolean) => ({ price, color: ink(token), token, style, title, label });
    for (const p of positions) {
      /* solid, in the colour of what it is up or down (the head note, 2026-09-22) — the ways out are dashed */
      want.set(`in:${p.key}`, line(p.spotIn, p.pnl >= 0 ? '--bull' : '--bear', LineStyle.Solid, '', true));
      want.set(`k:${p.key}`, line(p.contract.strike, '--text-muted', LineStyle.SparseDotted, p.contract.short != null ? `${p.contract.strike}${p.contract.right} bought` : `${short(p.contract, ticker)} strike`, false));
      /* a spread has two strikes: past the one SOLD it makes nothing more */
      if (p.contract.short != null) want.set(`k2:${p.key}`, line(p.contract.short, '--text-muted', LineStyle.SparseDotted, `${p.contract.short}${p.contract.right} sold — it makes no more past here`, false));
    }
    for (const b of brackets) if (b.level != null) want.set(`o:${b.orderId}`, line(b.level, b.kind === 'target' ? '--bull' : '--bear', LineStyle.Dashed, '', true));
    /* a resting order that is not a way out: dotted, in its side's colour */
    for (const x of entries) if (x.level != null) want.set(`e:${x.orderId}`, line(x.level, x.side === 'buy' ? '--bull' : '--bear', LineStyle.Dotted, '', true));
    levels.current = new Map([...want.entries()].filter(([id]) => !id.startsWith('k:') && !id.startsWith('k2:')).map(([id, w]) => [id, w.price]));
    edges.current = new Map([...brackets.filter(b => b.level == null).map(b => [`o:${b.orderId}`, b.edge] as const), ...entries.filter(x => x.level == null).map(x => [`e:${x.orderId}`, x.edge] as const)]);
    for (const [id, line] of linesRef.current) {
      if (want.has(id)) continue;
      series.removePriceLine(line);
      linesRef.current.delete(id);
    }
    for (const [id, w] of want) {
      if (dragRef.current?.id === id) continue;
      const opts = { price: w.price, color: w.color, lineWidth: 1 as const, lineStyle: w.style, axisLabelVisible: w.label, title: w.title, ...(w.label && soft ? { axisLabelColor: softTint(w.token, inkRef.current), axisLabelTextColor: w.color } : {}) };
      const have = linesRef.current.get(id);
      if (have) have.applyOptions(opts);
      else linesRef.current.set(id, series.createPriceLine(opts));
    }
    /* ROOM ROUND A POSITION. The scale fits the candles, so a position entered at the day's high sat against the plot's
       ceiling: its target was off the chart, and a line pulled off the chip had nowhere to go. With a position open the
       scale takes in every line drawn for it and ROOM_PCT of the name's price beyond — where a contract's target and stop
       usually live. The line under the hand is NOT counted: a scale that moves mid-drag is a target that runs from the
       pointer. */
    /* …and NOT a line further off than the name's expected day: room for it would flatten the candles to a thread. Its
       chip waits at the edge instead (the frame loop). */
    const farOff = new Set([...brackets.filter(b => b.far).map(b => `o:${b.orderId}`), ...entries.filter(x => x.far).map(x => `e:${x.orderId}`)]);
    if (!dragRef.current) api.room([...levels.current.entries()].filter(([id]) => !farOff.has(id)).flatMap(([, v]) => [v * (1 - ROOM_PCT), v * (1 + ROOM_PCT)]));
  }, [positions, brackets, entries, ticker, seriesN]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => api.room([]), []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- dragging a target or a stop ---- */
  const levelAt = (clientY: number): number | null => {
    const host = api.host();
    const series = seriesRef.current;
    if (!host || !series) return null;
    return series.coordinateToPrice(clientY - host.getBoundingClientRect().top);
  };
  const onGripDown = (e: ReactPointerEvent<HTMLButtonElement>, b: ChartBracket) => {
    /* a chip with no line (out of reach) is picked up where the hand is */
    const from = b.level ?? levelAt(e.clientY);
    if (from == null) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
    dragRef.current = { id: `o:${b.orderId}`, level: from };
    setDrag({ id: `o:${b.orderId}`, price: b.price, level: from });
  };
  const onGripMove = (e: ReactPointerEvent<HTMLButtonElement>, b: ChartBracket) => {
    const d = dragRef.current;
    if (!d || d.id !== `o:${b.orderId}`) return;
    const level = levelAt(e.clientY);
    if (level == null || !(level > 0)) return;
    d.level = level;
    linesRef.current.get(d.id)?.applyOptions({ price: level });
    setDrag({ id: d.id, price: bidAtSpot(b.contract, level), level });
  };
  const onGripUp = (b: ChartBracket) => {
    const d = dragRef.current;
    if (!d || d.id !== `o:${b.orderId}`) return;
    dragRef.current = null;
    /* what it waits on decides what a drag sets: a level of the name, or what the contract would bid with the name there */
    const price = b.on === 'name' ? Math.round(d.level * 100) / 100 : bidAtSpot(b.contract, d.level);
    setDrag(null);
    /* back where it was until the order says otherwise: a move that is not taken leaves the line where it stood */
    if (b.level != null) linesRef.current.get(d.id)?.applyOptions({ price: b.level });
    if (price > 0 && Math.abs(price - b.price) >= 0.01) onAmend(b.orderId, price);
  };

  /* ---- dragging a resting order to a new price ---- */
  const onEntryDown = (e: ReactPointerEvent<HTMLElement>, x: ChartEntry) => {
    const from = x.level ?? levelAt(e.clientY);
    if (from == null) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { id: `e:${x.orderId}`, level: from };
    setDrag({ id: `e:${x.orderId}`, price: x.price, level: from });
  };
  const onEntryMove = (e: ReactPointerEvent<HTMLElement>, x: ChartEntry) => {
    const d = dragRef.current;
    if (!d || d.id !== `e:${x.orderId}`) return;
    const level = levelAt(e.clientY);
    if (level == null || !(level > 0)) return;
    d.level = level;
    linesRef.current.get(d.id)?.applyOptions({ price: level });
    setDrag({ id: d.id, price: x.priceAt(level), level });
  };
  const onEntryUp = (x: ChartEntry) => {
    const d = dragRef.current;
    if (!d || d.id !== `e:${x.orderId}`) return;
    dragRef.current = null;
    const price = x.priceAt(d.level);
    setDrag(null);
    /* back where it was until the order says otherwise: a move the engine refuses leaves the line where it stood */
    if (x.level != null) linesRef.current.get(d.id)?.applyOptions({ price: x.level });
    if (price > 0 && Math.abs(price - x.price) >= 0.01) onAmend(x.orderId, price);
  };

  /* ---- pulling a target or a stop off the position's own chip ---- */
  const onChipDown = (e: ReactPointerEvent<HTMLDivElement>, p: ChartPosition) => {
    if ((e.target as HTMLElement).closest('button')) return; // the × is its own press
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    pullRef.current = { key: p.key, y0: e.clientY, line: null, kind: 'target', price: 0, level: 0, pinned: false };
  };
  const onChipMove = (e: ReactPointerEvent<HTMLDivElement>, p: ChartPosition) => {
    const d = pullRef.current;
    const series = seriesRef.current;
    if (!d || d.key !== p.key || !series) return;
    if (!d.line && Math.abs(e.clientY - d.y0) < PULL_PX) return;
    const level = levelAt(e.clientY);
    if (level == null || !(level > 0)) return;
    /* an option: what the contract would bid with the name there — more than now is a target. A future: the level itself,
       and ABOVE where it trades is a long's target and a short's stop */
    const price = bidAtSpot(p.contract, level);
    const kind = price > p.bid ? 'target' : 'stop';
    const token = kind === 'target' ? '--bull' : '--bear';
    const color = readToken(token, undefined, inkRef.current ?? undefined);
    const label = softGround(inkRef.current) ? { axisLabelColor: softTint(token, inkRef.current), axisLabelTextColor: color } : {};
    if (!d.line) d.line = series.createPriceLine({ price: level, color, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '', ...label });
    else d.line.applyOptions({ price: level, color, ...label });
    d.kind = kind;
    d.price = price;
    d.level = level;
    d.pinned = e.shiftKey;
    dragRef.current = { id: `new:${p.key}`, level };
    /* the dollars are for the contracts THIS level would speak for: all of them the first time, a share of them after */
    const n = p.take ? p.take[kind] || p.qty : p.qty;
    setPull({ key: p.key, kind, price, money: (price - p.avg) * 100 * n, level, pinned: e.shiftKey, room: p.room ? p.room[kind] : 'first' });
  };
  const onChipUp = (p: ChartPosition) => {
    const d = pullRef.current;
    if (!d || d.key !== p.key) return;
    pullRef.current = null;
    if (d.line) seriesRef.current?.removePriceLine(d.line);
    if (dragRef.current?.id === `new:${p.key}`) dragRef.current = null;
    setPull(null);
    /* a pull that ends on the bid itself is nothing: neither a target nor a stop would wait there */
    if (d.line && d.price > 0 && Math.abs(d.price - p.bid) >= 0.01) {
      if (d.pinned) onAttach(p.contract, d.kind, Math.round(d.level * 100) / 100, 'name');
      else onAttach(p.contract, d.kind, d.price);
    }
  };

  const dp = 2;
  /* ONE BAR A CHIP (the head note): blocks of solid colour side by side, the dark words on them — index.css's `.fill-*`,
     which goes soft (the ink on a tint) over a light tape (2026-09-26); the words take the block's ink */
  const chipBase = 'group absolute right-2 top-0 h-[20px] inline-flex items-stretch rounded-[3px] font-mono text-[11px] tnum whitespace-nowrap pointer-events-auto select-none shadow-[0_3px_10px_rgba(0,0,0,0.45)]';
  const chip = `${chipBase} ring-1 ring-black/40`;
  /* THE THREE CHIPS READ APART (Noah, 2026-09-26: "these cards need to look unique … having Stp and TP on them and having
     where you entered look different"): a way out says its word — TP · SL, TP2 for a second rung — before its money; THE
     POSITION IS WHERE YOU ARE, so its chip alone wears the silver ring (black on a light tape, index.css), and a future's
     says its side ("1 long") where an option says its contract */
  const chipIn = `${chipBase} ring-[1.5px] ring-silver`;
  const block = 'inline-flex items-center px-1.5';
  const fill = (tone: 'bull' | 'bear') => (tone === 'bull' ? 'fill-bull' : 'fill-bear');
  /** The grip at a bar's left: a darker strip with a line — what the hand takes */
  const grip = <span className="inline-flex items-center justify-center w-2.5 bg-black/15" aria-hidden="true"><span className="w-px h-2.5 bg-black/60" /></span>;
  /* the ✕ and the contracts wear inks the chart's ground re-scopes (index.css): on a light tape the silver turns steel, the
     grey dark, and the dark words on them light — never the fixed silver-fill, which stays pale under the pale words */
  const xCell = 'inline-flex items-center justify-center w-5 bg-textSecondary text-[rgb(var(--night))] border-l border-black/25 hover:bg-bear disabled:opacity-40 transition-colors';
  /** What a way out's switches sit in, beside its bar while the pointer is on it (or one of them has its card open) */
  const tray = 'hidden group-hover:inline-flex group-has-[[data-state=open]]:inline-flex items-center gap-0.5 mr-1 px-1 rounded-[3px] bg-panel border border-borderMuted shadow-[0_3px_10px_rgba(0,0,0,0.35)]';
  const bind = (id: string) => (el: HTMLDivElement | null) => {
    if (el) chipEls.current.set(id, el);
    else chipEls.current.delete(id);
  };
  return (
    <>
      <span ref={inkRef} data-chart-ink className="hidden" aria-hidden="true" />
      {/* THE CHIPS — placed each frame by the loop above; the wrapper ends where the two axes begin */}
      <div ref={chipsRef} className="absolute left-0 top-0 z-[7] overflow-hidden pointer-events-none" style={{ right: 56, height: 0 }} data-review-chips>
        {positions.map(p => {
          const side = p.tone ?? (p.contract.right === 'C' ? 'bull' : 'bear');
          return (
            <div
              key={p.key}
              ref={bind(`in:${p.key}`)}
              onPointerDown={e => onChipDown(e, p)}
              onPointerMove={e => onChipMove(e, p)}
              onPointerUp={() => onChipUp(p)}
              onPointerCancel={() => onChipUp(p)}
              title="Pull up or down to put a target or a stop on it — hold Shift to pin it to the name’s price"
              className={`${chipIn} cursor-ns-resize touch-none ${pull?.key === p.key ? 'ring-2 ring-silver/70' : ''}`}
              style={{ visibility: 'hidden' }}
              data-chart-position={p.key}
            >
              <span className={`inline-flex items-stretch rounded-l-[3px] ${fill(p.pnl >= 0 ? 'bull' : 'bear')}`}>
                {grip}
                <span className={`${block} font-semibold`} data-chip-money>
                  {usdSigned(p.pnl)}
                </span>
              </span>
              {/* its contracts, on its side's colour — a future says its side, an option which contract it is */}
              <span className={`${block} font-bold border-l border-black/25 ${fill(side)}`} data-chip-qty>
                {`${p.qty} × ${p.label ?? short(p.contract, ticker)}`}
              </span>
              <button type="button" onClick={() => onClosePosition(p.contract, p.qty)} disabled={p.dead || marketShut} title={marketShut ? 'The market is shut — open the next day' : p.dead ? 'No bid to sell into right now' : 'Sell all of it at the bid, now'} aria-label={`Close ${contractWords(p.contract)}`} className={`hit ${xCell} rounded-r-[3px]`} data-chart-close>
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
        {/* THE LINE BEING PULLED — one bar in the colour of what it has become, and what it would be worth */}
        {pull && (
          <div ref={bind(`new:${pull.key}`)} className={`${chip} pointer-events-none ring-2 ring-silver/70`} style={{ visibility: 'hidden' }} data-chart-pull={pull.kind} data-pull-room={pull.room ?? 'none'}>
            <span className={`inline-flex items-stretch rounded-[3px] ${fill(pull.kind === 'target' ? 'bull' : 'bear')}`}>
              {grip}
              {/* THE LADDER: a further pull ADDS a level — or cannot, and says so before the hand lets go */}
              <span className={`${block} font-semibold`}>
                {pull.room === 'more' ? (pull.kind === 'target' ? '+ Another target' : '+ Another stop') : pull.kind === 'target' ? 'Target' : 'Stop'}
                {pull.room === 'more' && ` · ${positions.find(q => q.key === pull.key)?.take?.[pull.kind] ?? ''} ×`}
                {' · '}
                {pull.pinned ? `${ticker} ${pull.level.toFixed(2)}` : pull.price.toFixed(dp)}
                {' · '}
                {pull.pinned ? 'about ' : ''}
                {usdSigned(pull.money, 0)}
              </span>
            </span>
            {pull.room === null && <span className="ml-1 inline-flex items-center px-1.5 rounded-[3px] bg-panel text-textMuted text-[10px]">no level has two contracts to give, or the ladder is full</span>}
          </div>
        )}
        {brackets.map(b => {
            const id = `o:${b.orderId}`;
            const held = drag?.id === id;
            const pinned = b.on === 'name';
            const tone = b.kind === 'target' ? 'bull' : 'bear';
            /* what it would make or lose there — while it is under the hand, where the hand has it */
            const money = held ? null : b.money;
            const figure = pinned ? `${ticker} ${(held ? drag!.level : b.price).toFixed(2)}` : (held ? drag!.price : b.price).toFixed(2);
            const handle = {
              onPointerDown: (e: ReactPointerEvent<HTMLElement>) => onGripDown(e as unknown as ReactPointerEvent<HTMLButtonElement>, b),
              onPointerMove: (e: ReactPointerEvent<HTMLElement>) => onGripMove(e as unknown as ReactPointerEvent<HTMLButtonElement>, b),
              onPointerUp: () => onGripUp(b),
              onPointerCancel: () => onGripUp(b),
            };
            return (
              <div key={id} ref={bind(id)} className={`${chip} ${held ? 'ring-2 ring-silver/70' : ''}`} style={{ visibility: 'hidden' }} data-chart-bracket={b.kind} data-far={b.far ? '' : undefined}>
                {/* ITS SWITCHES, beside it while the pointer is on it: which of the ladder it is, the price it waits on, a stop's
                    trail and breakeven, an option's pin */}
                <span className={tray} data-chip-tray>
                  <span className={`px-0.5 text-[10px] font-semibold ${b.kind === 'target' ? 'text-bull' : 'text-bear'}`}>
                    {b.kind === 'target' ? 'Target' : 'Stop'}
                    {b.nth ? ` ${b.nth}` : ''}
                  </span>
                  <span className="px-0.5 text-[10px] text-textPrimary">{figure}</span>
                  {b.kind === 'stop' && onTrail && <TrailDoor b={b} dp={dp} onTrail={onTrail} />}
                  {b.kind === 'stop' && onBreakeven && (
                    <button
                      type="button"
                      onClick={() => onBreakeven(b.orderId, !b.breakeven)}
                      disabled={!b.canBreakeven}
                      aria-pressed={!!b.breakeven}
                      title={!b.canBreakeven ? 'Breakeven needs a target: it is the first target’s fill that moves the stop' : b.breakeven ? 'Breakeven is armed: when the first target fills, the stop moves to what was paid. Press to let it be' : 'Breakeven — when the first target fills, move the stop to what was paid'}
                      aria-label={b.breakeven ? 'Let breakeven go' : 'Arm breakeven'}
                      className={`hit inline-flex items-center justify-center w-4 h-4 rounded transition-colors disabled:opacity-30 ${b.breakeven ? 'text-silver bg-silver/[0.14]' : 'text-textMuted hover:text-textPrimary hover:bg-ink/[0.08]'}`}
                      data-chart-breakeven={b.breakeven ? 'on' : 'off'}
                    >
                      <Equal className="w-3 h-3" />
                    </button>
                  )}
                  {/* the pin is an option's: a future's way out is a price of the thing itself — nothing drifts */}
                  <button
                    type="button"
                    onClick={() => onRebase(b.orderId, pinned ? 'contract' : 'name')}
                    disabled={!pinned && b.level == null}
                    aria-pressed={pinned}
                    title={pinned ? `Pinned to ${ticker}’s price: the line holds, the dollars drift as the contract decays. Press to set it on the contract’s price again` : b.level == null ? `No price of ${ticker} gives this today — nothing to pin it to` : `Pin it to ${ticker}’s price — the line stops drifting as the contract decays; the dollars drift instead`}
                    aria-label={pinned ? `Set the ${b.kind} on the contract’s price` : `Pin the ${b.kind} to ${ticker}’s price`}
                    className={`hit inline-flex items-center justify-center w-4 h-4 rounded transition-colors disabled:opacity-30 ${pinned ? 'text-silver bg-silver/[0.14]' : 'text-textMuted hover:text-textPrimary hover:bg-ink/[0.08]'}`}
                    data-chart-pin={pinned ? 'name' : 'contract'}
                  >
                    <Pin className="w-3 h-3" />
                  </button>
                </span>
                {/* THE BAR: the grip and what it would make or lose there take the hand — drag to move it */}
                <span
                  {...handle}
                  title={pinned ? `Drag to move the ${b.kind} — it waits for ${ticker} at that price` : `Drag to move the ${b.kind} — it is set to what the contract would bid with the name at that price`}
                  aria-label={`Move the ${b.kind}`}
                  className={`inline-flex items-stretch rounded-l-[3px] cursor-ns-resize touch-none ${fill(tone)}`}
                  data-chart-grip={b.kind}
                >
                  {grip}
                  <span className={`${block} font-semibold`} title={pinned ? `What it would make if ${ticker} got there this minute — it changes as the contract decays` : undefined} data-chip-money>
                    <span className="mr-1.5 font-bold" data-chip-word>{`${b.kind === 'target' ? 'TP' : 'SL'}${b.nth ?? ''}`}</span>
                    {money == null ? (pinned ? `about ${drag!.price.toFixed(2)}` : figure) : `${pinned ? '≈' : ''}${usdSigned(money, 2)}`}
                  </span>
                </span>
                <span className={`${block} border-l border-black/25 fill-count`} title={`${b.qty} ${b.qty === 1 ? 'contract' : 'contracts'}`} data-chip-qty>
                  {b.qty}
                </span>
                <button
                  type="button"
                  onClick={() => onCancelOrder(b.orderId)}
                  title={`Take the ${b.kind} off — the position stays${brackets.some(o => o.orderId !== b.orderId && contractKey(o.contract) === contractKey(b.contract)) ? `, and so does its ${b.kind === 'target' ? 'stop' : 'target'}` : ''}`}
                  aria-label={`Take the ${b.kind} off`}
                  className={`hit ${xCell} rounded-r-[3px]`}
                  data-chart-cancel={b.kind}
                >
                  <X className="w-3 h-3" />
                </button>
                {/* OUT OF THE PICTURE (shown by the frame loop): which way the line is, and where the name would have to be */}
                <span hidden className="ml-1 self-center px-1 rounded-[3px] bg-panel text-[10px] text-textMuted" data-chip-off>
                  <span data-chip-arrow aria-hidden="true" />
                  {b.level == null ? ' out of reach' : pinned ? '' : ` ${ticker} ${b.level.toFixed(2)}`}
                </span>
              </div>
            );
          })}
        {/* THE RESTING ORDERS THAT ARE NOT WAYS OUT — "1 · Buy stop · ✕" on an outline in the side's colour (the head note) */}
        {entries.map(x => {
          const id = `e:${x.orderId}`;
          const held = drag?.id === id;
          const buy = x.side === 'buy';
          const what = `${buy ? 'Buy' : 'Sell'} ${x.kind}`;
          const at = held ? drag!.price : x.price;
          const priceWords = at.toFixed(dp);
          return (
            <div
              key={id}
              ref={bind(id)}
              className={`group absolute right-2 top-0 h-[20px] inline-flex items-stretch rounded-[3px] border bg-panel font-mono text-[11px] tnum whitespace-nowrap pointer-events-auto select-none shadow-[0_3px_10px_rgba(0,0,0,0.45)] ${buy ? 'border-bull text-bull' : 'border-bear text-bear'} ${held ? 'ring-2 ring-silver/70' : ''}`}
              style={{ visibility: 'hidden' }}
              data-chart-entry={`${x.side}-${x.kind}`}
            >
              {/* its contracts and what it is take the hand — drag to move it */}
              <span
                onPointerDown={e => onEntryDown(e, x)}
                onPointerMove={e => onEntryMove(e, x)}
                onPointerUp={() => onEntryUp(x)}
                onPointerCancel={() => onEntryUp(x)}
                title={`${buy ? 'Buy' : 'Sell'} ${x.qty} ${x.label ? `${x.label} ` : ''}${x.kind} at ${priceWords} — drag to move it`}
                aria-label={`Move the ${what.toLowerCase()}`}
                className="inline-flex items-stretch cursor-ns-resize touch-none"
                data-chart-entry-grip
              >
                <span className="inline-flex items-center px-1.5 font-bold text-textPrimary border-r border-current" data-chip-qty>
                  {x.qty}
                </span>
                <span className="inline-flex items-center px-1.5 font-semibold" data-chip-what>
                  {what}
                  {/* an option's line is the NAME's price: the chip says which contract, and at what — a future's price is on the axis */}
                  {x.label && <span className="ml-1 text-textPrimary">{x.label} @ {priceWords}</span>}
                  {held && !x.label && <span className="ml-1 text-textPrimary">{priceWords}</span>}
                </span>
              </span>
              <button type="button" onClick={() => onCancelOrder(x.orderId)} title={`Cancel the ${what.toLowerCase()}`} aria-label={`Cancel the ${what.toLowerCase()}`} className={`hit inline-flex items-center justify-center w-5 border-l border-current rounded-r-[2px] transition-colors ${buy ? 'hover:bg-bull' : 'hover:bg-bear'} hover:text-[rgb(var(--night))]`} data-chart-entry-cancel>
                <X className="w-3 h-3" />
              </button>
              {/* OUT OF THE PICTURE (shown by the frame loop): which way the line is */}
              <span hidden className="ml-1 self-center px-1 rounded-[3px] bg-panel text-[10px] text-textMuted" data-chip-off>
                <span data-chip-arrow aria-hidden="true" />
                {x.level == null ? ' out of reach' : x.label ? ` ${ticker} ${x.level.toFixed(2)}` : ''}
              </span>
            </div>
          );
        })}
      </div>
      {/* THE RIGHT-CLICK'S CARD — at the price it was opened on */}
      {open && cardPos && (
        <div ref={cardRef} className="absolute z-[60] w-[272px] rounded-md border border-borderMuted bg-panel p-1.5 shadow-[0_14px_40px_rgba(0,0,0,0.5)] animate-soft-in" style={cardPos} onContextMenu={e => e.preventDefault()} data-chart-menu data-theme="dark">
          <div className="px-2 pt-1 pb-1.5">{open.card.head}</div>
          {[...open.card.sections, { items: [{ label: 'Reset chart view · Alt+R', hint: 'Back to how the chart first opened', run: () => api.reset(), testId: 'reset-view' }] } as ChartMenuSection].map((sec, si) => (
            <div key={si} className={si > 0 ? 'mt-1 pt-1 border-t border-borderSubtle' : ''}>
              {sec.title && <div className="px-2 pt-0.5 pb-1 font-mono text-[10px] uppercase tracking-widest text-textMuted">{sec.title}</div>}
              {sec.items.map(it => (
                <button
                  key={it.label}
                  type="button"
                  disabled={!!it.off}
                  title={it.off ?? it.hint}
                  onClick={() => {
                    setOpen(null);
                    it.run();
                  }}
                  className={`hit w-full flex flex-col items-start px-2 py-1.5 rounded-md text-left transition-colors disabled:opacity-35 disabled:cursor-not-allowed ${it.tone === 'bull' ? 'hover:bg-bull/[0.12] hover:text-bull' : it.tone === 'bear' ? 'hover:bg-bear/[0.12] hover:text-bear' : 'hover:bg-ink/[0.06]'} text-textPrimary`}
                  data-chart-menu-item={it.testId ?? it.label}
                >
                  <span className="text-[12px] leading-snug">{it.label}</span>
                  {it.hint && <span className="text-[10px] leading-snug text-textMuted">{it.hint}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default PositionLayer;
