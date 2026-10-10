/*
==================================================
  SLAYER TERMINAL - THE SESSION'S PHASES
  (components/terrain/sessionPhasesPrimitive.ts)

  Very quiet bands behind a Terrain pane's candles (the
  ideas report, 2026-10-09: the Trader's Clock lived on
  the Map alone): pre-market, the open's first thirty
  minutes, lunch, power hour and after hours, each the
  bars whose New York minute falls in it (core/nyTime —
  whatever zone the machine is in). A phase with no
  bars on the tape (the cash session's tape has none
  before 09:30 or after 16:00) draws nothing; a feed
  that carries the extended hours shades them as they
  come.

  Inks are tokens, resolved by the host and handed in;
  one band per run of bars, a small word over it when
  the band is wide enough. Painted only when the view
  moved; never animated.
==================================================
*/

import type { IChartApiBase, IPanePrimitive, IPanePrimitivePaneView, IPrimitivePaneRenderer, ISeriesApi, PaneAttachedParameter, SeriesType, Time } from 'lightweight-charts';
import type { CanvasRenderingTarget2D } from 'fancy-canvas';
import { nyMinutes } from '../../core/nyTime';
import { FONT_SANS } from '../../theme/fonts';

export type Phase = 'pre' | 'open' | 'lunch' | 'power' | 'after';
export const PHASE_WORDS: Record<Phase, string> = { pre: 'pre-market', open: 'the open', lunch: 'lunch', power: 'power hour', after: 'after hours' };
/** New York minutes: pre-market from 04:00, the open's first 30, lunch 12:00–13:00, power hour 15:00–16:00, after hours to 20:00 */
export function phaseAt(min: number): Phase | null {
  if (min >= 240 && min < 570) return 'pre';
  if (min >= 570 && min < 600) return 'open';
  if (min >= 720 && min < 780) return 'lunch';
  if (min >= 900 && min < 960) return 'power';
  if (min >= 960 && min < 1200) return 'after';
  return null;
}

export interface PhaseInks {
  /** the band's wash for each phase, an rgba string */
  band: Record<Phase, string>;
  /** the word over a band */
  word: string;
}

class PhasesRenderer implements IPrimitivePaneRenderer {
  constructor(private src: SessionPhasesPrimitive) {}
  draw(target: CanvasRenderingTarget2D): void {
    this.src.paint(target);
  }
}
class PhasesView implements IPanePrimitivePaneView {
  private r: PhasesRenderer;
  constructor(src: SessionPhasesPrimitive) {
    this.r = new PhasesRenderer(src);
  }
  zOrder(): 'bottom' {
    return 'bottom';
  }
  renderer(): IPrimitivePaneRenderer {
    return this.r;
  }
}

export class SessionPhasesPrimitive implements IPanePrimitive<Time> {
  private chart: IChartApiBase<Time> | null = null;
  private requestUpdate: (() => void) | null = null;
  private readonly views: PhasesView[];
  getSeries: () => ISeriesApi<SeriesType> | null = () => null;
  enabled = false;
  inks: PhaseInks | null = null;
  /* each bar's phase, kept by bar time — a minute's phase never changes */
  private phaseOf = new Map<number, Phase | null>();

  constructor() {
    this.views = [new PhasesView(this)];
  }
  attached({ chart, requestUpdate }: PaneAttachedParameter<Time>): void {
    this.chart = chart;
    this.requestUpdate = requestUpdate;
  }
  detached(): void {
    this.chart = null;
    this.requestUpdate = null;
  }
  paneViews(): readonly IPanePrimitivePaneView[] {
    return this.views;
  }
  set(patch: { enabled?: boolean; inks?: PhaseInks | null }): void {
    if (patch.enabled !== undefined) this.enabled = patch.enabled;
    if (patch.inks !== undefined) this.inks = patch.inks;
    this.requestUpdate?.();
  }

  private phase(t: number): Phase | null {
    let p = this.phaseOf.get(t);
    if (p === undefined) {
      p = phaseAt(nyMinutes(t * 1000));
      if (this.phaseOf.size > 50_000) this.phaseOf.clear();
      this.phaseOf.set(t, p);
    }
    return p;
  }

  paint(target: CanvasRenderingTarget2D): void {
    if (!this.enabled || !this.chart || !this.inks) return;
    const series = this.getSeries();
    if (!series) return;
    const data = series.data() as readonly { time: Time }[];
    if (data.length < 2) return;
    const step = Number(data[1].time) - Number(data[0].time);
    /* a bar an hour long or more has no phases inside it to shade */
    if (!(step > 0 && step < 3600)) return;
    const ts = this.chart.timeScale();
    const range = ts.getVisibleLogicalRange();
    if (!range) return;
    const from = Math.max(0, Math.floor(range.from) - 1);
    const to = Math.min(data.length - 1, Math.ceil(range.to) + 1);
    const half = ts.options().barSpacing / 2;
    const inks = this.inks;
    target.useBitmapCoordinateSpace(({ context: ctx, bitmapSize, horizontalPixelRatio: hr, verticalPixelRatio: vr }) => {
      let runPhase: Phase | null = null;
      let runL = 0;
      let runR = 0;
      const flush = () => {
        if (!runPhase) return;
        const l = Math.round(runL * hr);
        const w = Math.max(1, Math.round(runR * hr) - l);
        ctx.fillStyle = inks.band[runPhase];
        ctx.fillRect(l, 0, w, bitmapSize.height);
        if (runR - runL >= 64) {
          ctx.font = `${Math.round(10 * vr)}px ${FONT_SANS}`;
          ctx.fillStyle = inks.word;
          ctx.textBaseline = 'bottom';
          ctx.fillText(PHASE_WORDS[runPhase], l + Math.round(5 * hr), bitmapSize.height - Math.round(6 * vr));
        }
      };
      for (let i = from; i <= to; i++) {
        const x = ts.timeToCoordinate(data[i].time);
        if (x == null) continue;
        const p = this.phase(Number(data[i].time));
        if (p !== runPhase || (runPhase && x - half > runR + 1)) {
          flush();
          runPhase = p;
          runL = x - half;
        }
        runR = x + half;
      }
      flush();
    });
  }
}
