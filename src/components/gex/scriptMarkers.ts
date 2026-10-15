/*
==================================================
  SLAYER TERMINAL - A SCRIPT'S MARKS AS THE CHART'S MARKERS
  (components/gex/scriptMarkers.ts)

  A `plotshape` / `plotchar` the Pine runtime handed
  back (core/pine ShapeOut) as lightweight-charts
  markers: the shape, the size, the ink a bar, and
  where on the bar it stands. Its own module, with
  only the library's TYPES, so the runtime's proof
  (scripts/pine-proof.ts) can read it without a page.
==================================================
*/

import type { SeriesMarker, Time, UTCTimestamp } from 'lightweight-charts';
import type { Bar, ShapeOut } from '../../core/pine';

const shapeOf = (style: string): SeriesMarker<Time>['shape'] => (style === 'triangleup' || style === 'arrowup' || style === 'labelup' ? 'arrowUp' : style === 'triangledown' || style === 'arrowdown' || style === 'labeldown' ? 'arrowDown' : style === 'square' || style === 'diamond' || style === 'flag' ? 'square' : 'circle');
const positionOf = (loc: string): 'aboveBar' | 'belowBar' => (loc === 'belowbar' || loc === 'bottom' ? 'belowBar' : 'aboveBar');
const sizeOf = (size: string): number => (size === 'tiny' ? 0.6 : size === 'small' ? 0.8 : size === 'large' ? 1.5 : size === 'huge' ? 2 : 1);

/*
  LOCATION.ABSOLUTE STANDS AT ITS PRICE (2026-10-15, the audit): the run hands back the price a bar for an absolute
  mark, and the mark was laid "inBar" — on the bar, wherever the bar was, the price thrown away. The library places a
  marker at a price of its own ("atPriceMiddle" with `price`, lightweight-charts 5), on the scale of the series it hangs
  on — the script's own line, or the tape's.
*/
export function markersFor(sh: ShapeOut, bars: Bar[]): SeriesMarker<Time>[] {
  const list: SeriesMarker<Time>[] = [];
  const absolute = sh.location === 'absolute';
  const position = positionOf(sh.location);
  const shape = shapeOf(sh.style);
  const size = sizeOf(sh.size);
  for (let i = 0; i < bars.length; i++) {
    const v = sh.values[i];
    if (Number.isNaN(v)) continue;
    const color = (sh.colors ? sh.colors[i] : null) ?? sh.ink;
    const time = bars[i].time as UTCTimestamp;
    const m: SeriesMarker<Time> = absolute ? { time, position: 'atPriceMiddle', price: v, shape, color, size } : { time, position, shape, color, size };
    if (sh.text) m.text = sh.text;
    list.push(m);
  }
  return list;
}
