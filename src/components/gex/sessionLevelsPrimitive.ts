import type { ISeriesPrimitive, SeriesAttachedParameter, Time, IChartApi, ISeriesApi } from 'lightweight-charts';
import type { SessionLevelKey, SessionLevels } from '../../data/sessionLevels';

/*
==================================================
  SLAYER TERMINAL - SESSION LEVELS LAYER — T-6
  (components/gex/sessionLevelsPrimitive.ts)
==================================================

  WHY A PRIMITIVE RATHER THAN SEVEN `createPriceLine`s.

  The first cut used price lines, and it drew correctly — seven rules across
  the tape at the right prices with four distinct dash patterns — and it was
  UNLABELLED, which made it unreadable. A price line's `title` is rendered as
  part of its AXIS LABEL, so the only way to name one is `axisLabelVisible:
  true`, which puts seven tags down the price scale.

  That is exactly what the house rule forbids: nothing is named on the price
  axis. And the rule is right here for its own reasons — seven tags would
  bury a scale that already carries the live price card and the key levels'
  chips, and they would collide with each other the moment two levels sat
  within a label's height, which on a quiet day is most of them.

  So the rules and their tags are drawn together, on the field, by this. Which
  also buys the thing price lines could not express at all: a range that is
  still FORMING reads differently from one that has settled.

  ONE INK, FOUR DASH PATTERNS. The dealer palette is spoken for — gold is
  put-dominant, steel call-dominant, magenta the supreme, gray the flip, lime the
  user's own marks, white spot — and red and green are price direction. A
  session level is none of those, so it takes none of those colours. The dash
  says which level it is; the pairs share a pattern because a high and its low
  are one fact with two edges.
*/

/* Platinum steel at low alpha — present, never competing with the tape. */
const INK = '226,234,244';
const LINE_ALPHA = 0.38;
/* The RULES stay quiet furniture, but their NAMES are meant to be read —
   0.62 made them wallpaper (Noah, 2026-08-28: "just a tad bit too muted in
   wording"). Bright silver for settled tags; a forming tag stays a step
   quieter because it is also wearing the word. */
const TAG_ALPHA = 0.92;
const FORMING_TAG_ALPHA = 0.62;
/* A forming range is quieter than a settled one, and says so in words too. */
const FORMING_ALPHA = 0.22;

/* In CSS px, scaled to the bitmap at draw time. Dash then gap. */
const DASH: Record<SessionLevelKey, number[]> = {
  prevClose: [6, 4],
  prevHigh: [12, 5],
  prevLow: [12, 5],
  orHigh: [2, 3],
  orLow: [2, 3],
  ibHigh: [1, 6],
  ibLow: [1, 6],
};

/* Base tag size, and the step up the prev-day extremes wear (Noah,
   2026-08-28: "pdl and pdh should be a slightly bigger font") — yesterday's
   high and low are the two levels the whole session is traded against. */
const TAG_PX = 10;
const TAG_PX_MAJOR = 11.5;
const MAJOR: Set<SessionLevelKey> = new Set(['prevHigh', 'prevLow']);
const TAG_FONT = `${TAG_PX}px ui-monospace, SFMono-Regular, Menlo, monospace`;
const TAG_PAD_X = 4;
const TAG_PAD_Y = 2;

interface BitmapScope {
  context: CanvasRenderingContext2D;
  horizontalPixelRatio: number;
  verticalPixelRatio: number;
  mediaSize: { width: number; height: number };
}
interface DrawTarget {
  useBitmapCoordinateSpace(cb: (scope: BitmapScope) => void): void;
}

/** What the layer draws, in the order it draws them. */
export interface SessionLine {
  key: SessionLevelKey;
  /** The shorthand on the field — PDH, OR15, IBL. */
  tag: string;
  price: number;
  /** A range whose window has not closed yet: quieter, and marked. */
  forming: boolean;
}

/**
 * The lines a `SessionLevels` reading draws.
 *
 * The opening range wears the MINUTES it was cut over, and then its own edge:
 * `OR15 H` and `OR15 L`. The minutes because the choice is per pane and
 * invisible otherwise, so two panes side by side at 5 and 30 would draw four
 * identical-looking rules; the edge because `OR15` twice on one chart says
 * which range but not which side of it, and a reader should not have to work
 * that out from which label sits higher. The other five already carry their
 * edge in the shorthand (PDH, PDL, IBH, IBL).
 */
export function sessionLines(s: SessionLevels): SessionLine[] {
  /* PLAIN WORDS, not floor shorthand (Noah, 2026-08-28: "i dont understand
     what these mean so im assuming nor do the users"). PDH/OR15/IBH are what
     a prop desk scribbles; this desk writes the fact out. "1st hour" IS the
     initial balance — the jargon adds nothing the clock doesn't say. */
  const WORDS: Record<SessionLevelKey, string> = {
    prevHigh: "Prev day high",
    prevLow: "Prev day low",
    prevClose: "Prev close",
    orHigh: `First ${s.orMinutes}m high`,
    orLow: `First ${s.orMinutes}m low`,
    ibHigh: '1st hour high',
    ibLow: '1st hour low',
  };
  return s.levels.map(l => ({
    key: l.key,
    tag: WORDS[l.key] ?? l.tag,
    price: l.price,
    forming:
      l.key === 'orHigh' || l.key === 'orLow'
        ? !s.orComplete
        : l.key === 'ibHigh' || l.key === 'ibLow'
          ? !s.ibComplete
          : false,
  }));
}

class SessionLevelsRenderer {
  constructor(private source: SessionLevelsPrimitive) {}

  draw(target: DrawTarget): void {
    const src = this.source;
    const series = src.series;
    if (!series || src.lines.length === 0) return;

    target.useBitmapCoordinateSpace(scope => {
      const ctx = scope.context;
      const hr = scope.horizontalPixelRatio;
      const vr = scope.verticalPixelRatio;
      const w = scope.mediaSize.width * hr;
      const h = scope.mediaSize.height * vr;

      /*
        Placed tag boxes, so two levels a few cents apart do not print their
        names on top of each other: a colliding tag is pushed down a lane.

        NO LEADER LINES ANY MORE (Noah, 2026-08-28: "their prices should be
        disclosed next to them then removing the line would be awesome").
        The leader existed because a displaced NAME a point from its rule
        asserted the wrong level — but a tag that carries its own PRICE
        identifies its level by number wherever it sits, so the slant had
        nothing left to fix. The push is still capped: past three lanes the
        tag is dropped and the rule keeps its dash as its identity.
      */
      const taken: { top: number; bottom: number }[] = [];
      const MAX_PUSH = 3;

      ctx.save();
      ctx.textBaseline = 'middle';

      for (const line of src.lines) {
        const fontPx = MAJOR.has(line.key) ? TAG_PX_MAJOR : TAG_PX;
        ctx.font = `600 ${fontPx * vr}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        const tagH = (fontPx + 4) * vr;
        const yc = series.priceToCoordinate(line.price);
        if (yc === null) continue;
        const y = Math.round(yc * vr) + 0.5;
        if (y < 0 || y > h) continue;

        const alpha = line.forming ? FORMING_ALPHA : LINE_ALPHA;
        ctx.strokeStyle = `rgba(${INK},${alpha})`;
        ctx.lineWidth = Math.max(1, Math.round(vr));
        ctx.setLineDash(DASH[line.key].map(d => d * hr));
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        ctx.setLineDash([]);

        /* The tag speaks in the house's two voices: the NAME in silver and
           the PRICE bright beside it — the label whispers, the value never
           does. A forming range still says so, after the number. */
        const name = `${line.tag} `;
        const priceTxt = line.price.toFixed(2);
        const formingTxt = line.forming ? ' · forming' : '';
        const nameW = ctx.measureText(name).width;
        const priceW = ctx.measureText(priceTxt).width;
        const formingW = formingTxt ? ctx.measureText(formingTxt).width : 0;
        const textW = nameW + priceW + formingW;
        const boxW = textW + TAG_PAD_X * 2 * hr;
        const boxH = tagH + TAG_PAD_Y * 2 * vr;

        const wanted = y - boxH / 2;
        let top = wanted;
        let lanes = 0;
        while (lanes < MAX_PUSH && taken.some(t => top < t.bottom && top + boxH > t.top)) {
          top += boxH + 2 * vr;
          lanes++;
        }
        /* Still colliding after the cap, or off the plot: no tag. */
        if (taken.some(t => top < t.bottom && top + boxH > t.top)) continue;
        if (top + boxH > h || top < 0) continue;
        taken.push({ top, bottom: top + boxH });

        /* CENTRED on the rule (Noah, 2026-08-28: "they should be at the
           middle of the line and not the far left") — the middle of the
           plot is where the eye crosses a horizontal rule, and the left
           edge put every name over the oldest, least-read bars. */
        const x = Math.max(2 * hr, (w - boxW) / 2);
        /* A wash behind the text, so a tag over a candle is still readable
           without painting a solid block on the tape. */
        ctx.fillStyle = 'rgba(10,10,10,0.66)';
        ctx.fillRect(x, top, boxW, boxH);
        const nameAlpha = line.forming ? FORMING_TAG_ALPHA : TAG_ALPHA;
        const cy = top + boxH / 2;
        ctx.fillStyle = `rgba(${INK},${nameAlpha})`;
        ctx.fillText(name, x + TAG_PAD_X * hr, cy);
        ctx.fillStyle = `rgba(237,237,237,${line.forming ? 0.75 : 0.98})`;
        ctx.fillText(priceTxt, x + TAG_PAD_X * hr + nameW, cy);
        if (formingTxt) {
          ctx.fillStyle = `rgba(${INK},${FORMING_TAG_ALPHA})`;
          ctx.fillText(formingTxt, x + TAG_PAD_X * hr + nameW + priceW, cy);
        }
      }
      ctx.restore();
    });
  }
}

class SessionLevelsPaneView {
  private _renderer: SessionLevelsRenderer;
  constructor(source: SessionLevelsPrimitive) {
    this._renderer = new SessionLevelsRenderer(source);
  }
  /* BOTTOM, unlike the drawings layer. These are the day's furniture and the
     tape is the subject — candles read over them, not under them. */
  zOrder(): 'bottom' {
    return 'bottom';
  }
  renderer(): SessionLevelsRenderer {
    return this._renderer;
  }
}

export class SessionLevelsPrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null;
  series: ISeriesApi<'Candlestick'> | null = null;
  requestUpdate?: () => void;
  lines: SessionLine[] = [];
  private _paneViews: SessionLevelsPaneView[];

  constructor() {
    this._paneViews = [new SessionLevelsPaneView(this)];
  }

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart;
    this.series = param.series as ISeriesApi<'Candlestick'>;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.chart = null;
    this.series = null;
    this.requestUpdate = undefined;
  }

  updateAllViews(): void {}

  paneViews(): SessionLevelsPaneView[] {
    return this._paneViews;
  }

  /**
   * Replace what is drawn.
   *
   * Compared before it repaints: the host recomputes on every simulator tick
   * and these prices move only while the opening range and the initial
   * balance are still forming. Asking for a frame that draws the same seven
   * rules is a frame spent for nothing, on a desk that can be running four
   * charts.
   */
  setLines(next: SessionLine[]): void {
    const same =
      next.length === this.lines.length &&
      next.every((l, i) => {
        const p = this.lines[i];
        return p.key === l.key && p.price === l.price && p.tag === l.tag && p.forming === l.forming;
      });
    this.lines = next;
    if (!same) this.requestUpdate?.();
  }
}

/** Exported for the proof: the constants a test would otherwise re-type. */
export const SESSION_LAYER = { INK, LINE_ALPHA, TAG_ALPHA, FORMING_ALPHA, DASH, TAG_FONT } as const;
