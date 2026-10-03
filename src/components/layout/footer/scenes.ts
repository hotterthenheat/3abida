/*
==================================================
  SLAYER TERMINAL - EVERY PAGE'S PICTURE
  (components/layout/footer/scenes.ts)

  What the footer's screen shows on each page (2026-10-03
  — the owner: "each page had its own art work similar to
  that one but thats representive of its page … and then
  the landing page one you go into more depth"), made of
  the parts in parts/*.ts and set in the box the footer
  marks for it ([data-footer-scene]). Every picture opens
  with its address, top left, as the terminal's own
  breadcrumb does; a narrow (phone) picture keeps the one
  or two parts that say the page.
==================================================
*/

import { box, compose, cut, type Box, type SceneMaker, type Stage } from './kit';
import { book, cone } from './parts/book';
import { chart, chips, crumb, ladder, panel } from './parts/chart';
import { cards, rows } from './parts/desk';
import { alertLines, field, orders, replay } from './parts/field';
import { calendar, equity, orderPad, positions, stats } from './parts/practice';
import { account, alertList, doc, gather, invite, room, settingsPart, status, testCard } from './parts/quiet';
import { flowLines, tape } from './parts/tape';
import { chain, payoff } from './parts/weigher';
import { story, strip, wire, worldMap } from './parts/world';
import { landing } from './landing';
import type { SceneName } from './registry';

/** a box inside another, by margins (left, top, right, bottom) */
const inset = (b: Box, l: number, t: number, r = l, btm = t): Box => box(b.x0 + l, b.y0 + t, b.x1 - r, b.y1 - btm);
/** the breadcrumb's place: the picture's top left */
const top = (s: Stage) => box(s.box.x0, s.box.y0, s.box.x1, s.box.y0 + 14);
/** a chart's pane in a box: room on the right for its tag, under it for its axis */
const paneIn = (b: Box, legend = true) => box(b.x0, b.y0 + (legend ? 4 : 0), b.x1 - 66, b.y1 - 26);

/* PULSE — THE DESK: the live chart, the strike pressure ladder, the setups the scan found, the earnings to come — each a
   panel, as the reader's own desk stands */
const pulse: SceneMaker = () => {
  const lc = chart({ legend: 'SPY  1m', levels: 4, wide: true });
  return compose(
    [crumb('terminal  /  pulse'), panel('Live chart'), lc, panel('Strike pressure ladder'), ladder({ seed: 31 }), panel('Compass setups'), cards({ cols: 2, rows: 1, seed: 400 }), panel('Earnings calendar'), rows({ kind: 'earnings' }), chips()],
    s => {
      const b = s.box;
      const w = b.x1 - b.x0;
      if (s.phone)
        return [top(s), null, box(b.x0, b.y0 + 24, b.x0 + w * 0.6, b.y1 - 48), null, cut(b, 0.74, 0.16, 1, 0.78), null, null, null, null, box(b.x0 + 6, b.y1 - 18, b.x1, b.y1)];
      const p1 = cut(b, 0, 0.07, 0.585, 0.66);
      const p2 = cut(b, 0.615, 0.07, 1, 0.66);
      const p3 = cut(b, 0, 0.7, 0.585, 1);
      const p4 = cut(b, 0.615, 0.7, 1, 1);
      return [top(s), p1, inset(p1, 10, 24, 74, 30), p2, inset(p2, 4, 26, 10, 12), p3, inset(p3, 8, 24, 8, 8), p4, inset(p4, 12, 26, 12, 6), null];
    },
  );
};

/* TERRAIN — THE CHART AND ITS STRIKE FIELD: candles, a row of beads at every strike (the walls bright, the supreme in its
   magenta, the flip a grey line), the price's tag between the chart and the ladder, and the ladder with its curve */
const terrain: SceneMaker = () => {
  const ch = chart({ legend: 'SPY  15m', candles: 3, up: 'glacier', down: 'blue', gap: 3.4, kick: 1.5, volTop: 0.86 });
  return compose([crumb('terminal  /  terrain'), ch, field(ch), ladder({ seed: 47, curve: true, warm: true, gap: 6, run: false, share: 0.86 })], s => {
    const b = s.box;
    if (s.phone) return [top(s), paneIn(cut(b, 0, 0.12, 1, 1)), b, null];
    const pane = box(b.x0, b.y0 + 24, b.x0 + (b.x1 - b.x0) * 0.66, b.y1 - 26);
    return [top(s), pane, b, cut(b, 0.79, 0.08, 1, 0.94)];
  });
};

/* TRACE — THE TAPE: prints coming in at the top, each its moment, its name and side, its size and money and lean; and
   beside it the net flow, the calls' money climbing and the puts' falling with the price between */
const trace: SceneMaker = () => {
  const nf = chart({ legend: 'META', seed: 314, band: [0.38, 0.62], volTop: 0.84, ticks: 2 });
  return compose([crumb('terminal  /  trace  /  live tape'), tape(), panel('Net flow', { grip: false }), nf, flowLines(nf)], s => {
    const b = s.box;
    if (s.phone) return [top(s), cut(b, 0, 0.11, 1, 1), null, null, null];
    const p = cut(b, 0.71, 0.07, 1, 0.9);
    const pane = box(p.x0 + 8, p.y0 + 24, p.x1 - 66, p.y1 - 26);
    return [top(s), cut(b, 0, 0.07, 0.67, 1), p, pane, b];
  });
};

/* THE DOSSIER — THE FILE ON A NAME: the world as dots, the stories breaking and reaching; the story's card; the
   earnings to come, day by day */
const dossier: SceneMaker = () =>
  compose([crumb('terminal  /  dossier  /  news'), worldMap(), story(), strip(), wire()], s => {
    const b = s.box;
    if (s.phone) return [top(s), cut(b, 0, 0.08, 1, 0.8), null, cut(b, 0, 0.82, 1, 1), null];
    return [top(s), cut(b, 0, 0.05, 1, 0.62), cut(b, 0.62, 0.64, 1, 1), cut(b, 0, 0.66, 0.58, 0.8), cut(b, 0, 0.84, 0.58, 1)];
  });

/* PINPOINT — THE BOOK: the strikes and the dealers' exposure across them, the walls and the supreme, the flip, the spot
   drifting with the clock on its tag; the range into the close; every wall, how it stands */
const pinpoint: SceneMaker = () =>
  compose(
    [crumb('terminal  /  pinpoint  /  map'), book(), cone(), panel('Every wall', { grip: false }), stats(['shelf above', 'call wall', 'put wall', 'shelf below', 'pin'], { seed: 8 })],
    s => {
      const b = s.box;
      if (s.phone) return [top(s), box(b.x0, b.y0 + 18, b.x1 - 70, b.y1), null, null, null];
      const w = cut(b, 0.79, 0.62, 1, 1);
      return [top(s), box(b.x0, b.y0 + 18, b.x0 + (b.x1 - b.x0) * 0.66, b.y1), cut(b, 0.79, 0.08, 1, 0.56), w, inset(w, 8, 26, 8, 6)];
    },
  );

/* COMPASS — THE BOARD: the contracts that fit the levels, a card each (its tag, its state, a sparkline that walks, the
   line it breaks at); the heaviest contracts beside it */
const compass: SceneMaker = () =>
  compose([crumb('terminal  /  compass'), cards({ cols: 2, rows: 3, phoneRows: 2, seed: 404 }), panel('Heaviest contracts', { grip: false }), rows({ kind: 'heaviest', gap: 26 })], s => {
    const b = s.box;
    if (s.phone) return [top(s), cut(b, 0, 0.11, 1, 1), null, null];
    const h = cut(b, 0.68, 0.07, 1, 1);
    return [top(s), cut(b, 0, 0.07, 0.65, 1), h, inset(h, 10, 30, 10, 8)];
  });

/* THE WEIGHER — THE CHAIN AND WHAT IT RETURNS: strikes and their figures, one opened, the market's line between; the
   contract's money at every price, the curve today closing on the stick at expiry */
const weigher: SceneMaker = () =>
  compose([crumb('terminal  /  weigher'), chain(), payoff()], s => {
    const b = s.box;
    if (s.phone) return [top(s), cut(b, 0, 0.11, 0.44, 1), cut(b, 0.49, 0.06, 1, 1)];
    return [top(s), cut(b, 0, 0.07, 0.48, 1), cut(b, 0.53, 0.06, 1, 1)];
  });

/* PAPER — THE CHART WITH ITS ORDERS: the entry held, the target above, the stop below, each run out to its tag; the
   open money's chip; the positions under it, the chain and the order pad beside it */
const paper: SceneMaker = () => {
  const ch = chart({ legend: 'SPY  1m', candles: 3, up: 'glacier', down: 'blue', band: [0.2, 0.62], gap: 3.4, kick: 1.5, volTop: 0.86 });
  return compose([crumb('terminal  /  practice  /  paper'), ch, orders(ch), positions(), chain({ cols: ['STRIKE', 'BID', 'ASK', 'DELTA'], rh: 16 }), orderPad({ side: 'SELL' })], s => {
    const b = s.box;
    if (s.phone) return [top(s), box(b.x0, b.y0 + 22, b.x1 - 66, b.y1 - 64), b, cut(b, 0, 0.78, 1, 1), null, null];
    const left = cut(b, 0, 0.06, 0.66, 0.74);
    return [top(s), box(left.x0, left.y0 + 16, left.x1 - 66, left.y1), b, cut(b, 0, 0.83, 0.66, 1), cut(b, 0.71, 0.07, 1, 0.66), cut(b, 0.71, 0.72, 1, 1)];
  });
};

/* THE BACKTEST — A PAST DAY REPLAYED: its candles drawn as the head reaches them, the target and the stop, the scrubber
   under it with the replay's own clock; the chain as it stood, the order pad */
const backtest: SceneMaker = () =>
  compose([crumb('terminal  /  practice  /  backtest'), replay(), panel('The chain · as it stood', { grip: false }), chain({ cols: ['STRIKE', 'BID', 'ASK', 'DELTA'], rh: 16 }), orderPad()], s => {
    const b = s.box;
    if (s.phone) return [top(s), cut(b, 0, 0.12, 1, 1), null, null, null];
    const c = cut(b, 0.73, 0.06, 1, 0.66);
    return [top(s), cut(b, 0, 0.1, 0.69, 1), c, inset(c, 8, 26, 8, 6), cut(b, 0.73, 0.72, 1, 1)];
  });

/* THE JOURNAL — EVERY TRADE ON ITS DAY: the month, each day washed in what it made or lost, the week's sum beside it,
   today's cursor; the year's money walking, and its words */
const journal: SceneMaker = () =>
  compose([crumb('terminal  /  practice  /  journal'), calendar(), equity({ title: 'THIS YEAR' }), stats(['WON · LOST', 'BEST DAY', 'WORST DAY', 'LONGEST RUN', 'HELD ON AVERAGE'], { seed: 12 })], s => {
    const b = s.box;
    if (s.phone) return [top(s), cut(b, 0, 0.1, 1, 1), null, null];
    return [top(s), cut(b, 0, 0.07, 0.7, 1), cut(b, 0.75, 0.1, 1, 0.44), cut(b, 0.75, 0.52, 1, 0.98)];
  });

/* THE ALERTS — A LINE THAT SOUNDS: the chart and its alerts' lines, a bell at the end of each; the price crosses one and
   it sounds; every alert listed beside it */
const alerts: SceneMaker = () => {
  const ch = chart({ legend: 'SPY  1m', band: [0.16, 0.74], volTop: 0.86 });
  return compose([crumb('terminal  /  alerts'), ch, alertLines(ch), alertList()], s => {
    const b = s.box;
    if (s.phone) return [top(s), box(b.x0, b.y0 + 22, b.x1 - 66, b.y1 - 26), b, null];
    return [top(s), box(b.x0, b.y0 + 24, b.x0 + (b.x1 - b.x0) * 0.6, b.y1 - 30), b, cut(b, 0.74, 0.06, 1, 1)];
  });
};

/* SETTINGS — HOW THE TERMINAL LOOKS: the two grounds, the one in use ringed; the switches, a slider, the candles' inks */
const settings: SceneMaker = () => compose([crumb('terminal  /  settings'), settingsPart()], s => [top(s), cut(s.box, 0, 0.07, 1, 1)]);

/* THE ROOM — ONE CHART, OTHER READERS: their pointers resting on the line, each with its letters */
const community: SceneMaker = () => {
  const ch = chart({ legend: 'SPY  5m', band: [0.2, 0.7], volTop: 0.86 });
  return compose([crumb('terminal  /  community'), ch, room(() => ch.pane(), (x, t) => ch.yAt(x, t))], s => {
    const b = s.box;
    if (s.phone) return [top(s), box(b.x0, b.y0 + 24, b.x1 - 66, b.y1 - 28), b];
    return [top(s), box(b.x0, b.y0 + 30, b.x0 + (b.x1 - b.x0) * 0.82, b.y1 - 34), b];
  });
};

/* THE PAGES OUTSIDE: quiet pictures, each its page's own — they open with the house's prompt */
const statusScene: SceneMaker = () => compose([crumb('slayer:~ $ status'), status()], s => [top(s), cut(s.box, 0, 0.08, 1, 0.94)]);
const about: SceneMaker = () => compose([crumb('slayer:~ $ about'), gather()], s => [top(s), cut(s.box, 0, 0.07, 1, 1)]);
const legal: SceneMaker = () => compose([crumb('slayer:~ $ legal'), doc()], s => [top(s), cut(s.box, 0, 0.06, s.phone ? 1 : 0.82, 1)]);
const accountScene: SceneMaker = () => compose([crumb('slayer:~ $ account'), account()], s => [top(s), cut(s.box, 0.06, 0.06, 0.94, 1)]);
const inviteScene: SceneMaker = () => compose([crumb('slayer:~ $ invite'), invite()], s => [top(s), cut(s.box, 0.02, 0.12, 0.98, 0.9)]);
const maintenance: SceneMaker = () => compose([crumb('slayer:~ $ maintenance'), testCard()], s => [top(s), cut(s.box, 0, 0.07, 1, 0.96)]);

export const SCENES: Record<SceneName, SceneMaker> = {
  landing,
  pulse,
  terrain,
  trace,
  dossier,
  pinpoint,
  compass,
  weigher,
  paper,
  backtest,
  journal,
  alerts,
  settings,
  room: community,
  status: statusScene,
  about,
  legal,
  account: accountScene,
  invite: inviteScene,
  maintenance,
};
