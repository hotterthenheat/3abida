/*
  THE WEIGHER'S DESK (components/layout/footer/parts/weigher.ts) — the chain (strikes down, a contract's figures across,
  the market's line between two strikes with the clock on its tag, one strike opened to its figures), and what a contract
  returns at every price: the curve today, the hockey stick at expiry it closes on as the days run out, the money made
  above the line and lost below it, the spot riding the curve.
*/

import { FONT, bar, box, chip, clamp, clock, keep, prose, rgb, rng, type, walk, type Box, type Frame, type Part, type Pen, type Pill, type Stage } from '../kit';

/* ---- THE CHAIN ---------------------------------------------------------------------------------------------------- */

export const chain = (o: { seed?: number; cols?: string[]; open?: boolean; rh?: number } = {}): Part => {
  let s: Stage | null = null;
  let at: Box = box(0, 0, 0, 0);
  let heads: string[] = [];
  let xs: number[] = [];
  let rows: { y: number; figs: number[]; odds: number; open: boolean }[] = [];
  let divY = 0;
  let rh = 17;
  let t = 0;
  const HEAD = 20;
  return {
    place(b, st) {
      s = st;
      at = b;
      rh = o.rh ?? (st.phone ? 15 : 17);
      heads = o.cols ?? (st.phone || b.x1 - b.x0 < 300 ? ['STRIKE', 'MARK', 'DELTA'] : ['STRIKE', 'MARK', 'DELTA', 'IV', 'ITM ODDS', 'VOL', 'OI']);
      const w = b.x1 - b.x0;
      xs = heads.map((_, i) => (i === 0 ? b.x0 + 4 : b.x0 + w * (0.24 + (0.76 * i) / heads.length) + 20));
      const r = rng(o.seed ?? 202);
      const n = Math.max(3, Math.floor((b.y1 - b.y0 - HEAD) / rh));
      const openAt = o.open === false ? -1 : Math.min(n - 4, Math.floor(n * 0.42) + 1);
      rows = [];
      let y = b.y0 + HEAD;
      for (let i = 0; i < n && y + rh <= b.y1; i++) {
        const open = i === openAt;
        rows.push({ y, figs: heads.map(() => 0.35 + r() * 0.65), odds: clamp(0.9 - i * 0.09 + r() * 0.1, 0.05, 1), open });
        y += open ? rh * 3.2 : rh;
      }
      const d = Math.max(1, Math.floor(rows.length * 0.36));
      divY = rows[d]?.y ?? b.y0 + HEAD;
    },
    still(b) {
      if (!s) return;
      const { c, sharp, ink } = b;
      heads.forEach((h, i) => type(b, h, xs[i], at.y0 + 7, { size: 7, hue: ink.muted, share: 0.4, align: i ? 'right' : 'left' }));
      if (sharp) {
        c.fillStyle = rgb(ink.ink, 0.1);
        c.fillRect(at.x0, at.y0 + 14, at.x1 - at.x0, 1);
      }
      rows.forEach((row, i) => {
        const mid = row.y + rh / 2;
        /* the strike: a chevron, its mark, and its odds of finishing in the money as a bar under it */
        c.fillStyle = rgb(ink.muted, 0.8);
        if (keep(b, 0.4)) {
          c.beginPath();
          if (row.open) {
            c.moveTo(xs[0], mid - 2);
            c.lineTo(xs[0] + 6, mid - 2);
            c.lineTo(xs[0] + 3, mid + 2);
          } else {
            c.moveTo(xs[0] + 1, mid - 3.5);
            c.lineTo(xs[0] + 4.5, mid);
            c.lineTo(xs[0] + 1, mid + 3.5);
          }
          c.closePath();
          c.fill();
        }
        c.fillStyle = rgb(ink.line, sharp ? 0.9 : 0.85);
        if (keep(b, 0.6)) c.fillRect(xs[0] + 12, mid - 3, 22, sharp ? 5 : 6);
        c.fillStyle = rgb(ink.ember, sharp ? 0.8 : 0.85);
        bar(b, xs[0] + 2, row.y + rh - 3, 52 * row.odds, 2, 0.6);
        if (row.open) chip(b, xs[0] + 40, mid, 34, { edge: rgb(ink.muted, 0.6), word: 'WALL', wordInk: rgb(ink.line, 0.8), h: 12 });
        /* its figures across, gone to marks */
        for (let k = 1; k < heads.length; k++) {
          const fw = 10 + 20 * row.figs[k];
          c.fillStyle = rgb(k === 1 ? ink.line : ink.secondary, sharp ? 0.75 : 0.65);
          if (keep(b, k === 1 ? 0.55 : 0.3)) c.fillRect(xs[k] - fw, mid - 2, fw, sharp ? 3 : 4);
        }
        /* the strike opened: its figures by name, two rows of them */
        if (row.open) {
          const words = ['BID', 'MARK', 'HIGH', 'LAST', 'ASK', 'CLOSE', 'LOW', 'IV'];
          const per = s!.phone ? 3 : 4;
          const cw = (at.x1 - at.x0 - 16) / per;
          words.slice(0, per * 2).forEach((wd, k) => {
            const x = at.x0 + 12 + (k % per) * cw;
            const y = row.y + rh + 6 + Math.floor(k / per) * 17;
            type(b, wd, x, y, { size: 6.5, hue: ink.muted, share: 0.3 });
            prose(b, x, y + 7, 22 + ((k * 7) % 12), { hue: ink.line, a: 0.75, h: 3, seed: k + 90, share: 0.45 });
          });
          if (sharp) {
            c.fillStyle = rgb(ink.ink, 0.04);
            c.fillRect(at.x0, row.y, at.x1 - at.x0, rh * 3.2);
          }
        }
        if (sharp && i) {
          c.fillStyle = rgb(ink.ink, 0.05);
          c.fillRect(at.x0, row.y, at.x1 - at.x0, 1);
        }
      });
    },
    tick(f) {
      t = f.t;
    },
    live: () => box(at.x0 - 4, at.y0 + 14, at.x1 + 4, at.y1 + 2),
    /* the market's line between two strikes, its tag the clock; and the marks ticking as the quotes move */
    moving(p: Pen, f: Frame) {
      if (!s) return;
      const { c } = p;
      rows.forEach((row, i) => {
        const mid = row.y + rh / 2;
        const fw = (10 + 20 * row.figs[1]) * (0.82 + 0.18 * Math.sin(t / 650 + i * 1.7));
        c.fillStyle = p.ink(s!.ink.line, 0.9);
        if (i % 2 === 0 || row.open) c.fillRect(xs[1] - fw, mid - 2, fw, 4);
      });
      c.fillStyle = p.ink(s.ink.line, 0.6);
      c.fillRect(at.x0, divY - 1, at.x1 - at.x0, 2);
      if (p.fringe) return;
      const word = clock(f.wall, f.seconds);
      c.font = `600 9px ${FONT}`;
      c.textBaseline = 'middle';
      c.textAlign = 'center';
      const w = c.measureText(word).width + 12;
      const x = (at.x0 + at.x1) / 2;
      c.fillStyle = rgb(s.ink.panel);
      c.fillRect(x - w / 2, divY - 7, w, 14);
      c.strokeStyle = rgb(s.ink.line, 0.9);
      c.lineWidth = 2;
      c.strokeRect(x - w / 2, divY - 7, w, 14);
      c.fillStyle = rgb(s.ink.line);
      c.fillText(word, x, divY + 0.5);
      c.textAlign = 'left';
    },
    sharp(c, f) {
      if (!s) return;
      rows.forEach((row, i) => {
        const mid = row.y + rh / 2;
        const fw = (10 + 20 * row.figs[1]) * (0.82 + 0.18 * Math.sin(t / 650 + i * 1.7));
        c.fillStyle = rgb(s!.ink.line, 0.95);
        if (i % 2 === 0 || row.open) c.fillRect(xs[1] - fw, mid - 1.5, fw, 3);
      });
      c.fillStyle = rgb(s.ink.line, 0.4);
      c.fillRect(at.x0, divY, at.x1 - at.x0, 1);
      const word = clock(f.wall, f.seconds);
      c.font = `500 9.5px ${FONT}`;
      c.textBaseline = 'middle';
      c.textAlign = 'center';
      const w = c.measureText(word).width + 14;
      const x = (at.x0 + at.x1) / 2;
      c.fillStyle = rgb(s.ink.line);
      c.beginPath();
      c.roundRect(x - w / 2, divY - 8, w, 16, 8);
      c.fill();
      c.fillStyle = rgb(s.ink.panel);
      c.fillText(word, x, divY + 0.5);
      c.textAlign = 'left';
    },
    read(c, _f, x, y): Pill[] | null {
      if (!s || x < at.x0 || x > at.x1 || y < at.y0 + HEAD || y > at.y1) return null;
      const row = rows.find(r => y >= r.y && y < r.y + (r.open ? rh * 3.2 : rh));
      if (!row) return null;
      c.fillStyle = rgb(s.ink.ink, 0.07);
      c.fillRect(at.x0 - 4, row.y, at.x1 - at.x0 + 8, rh);
      return null;
    },
  };
};

/* ---- WHAT IT RETURNS AT EVERY PRICE --------------------------------------------------------------------------------- */

export const payoff = (o: { seed?: number; cycle?: number } = {}): Part => {
  const CYCLE = o.cycle ?? 18000;
  const spotWalk = walk(o.seed ?? 818, { step: 600, gap: 3, kick: 0.7, lean: 0.02 });
  let s: Stage | null = null;
  let at: Box = box(0, 0, 0, 0);
  let pane: Box = box(0, 0, 0, 0);
  let zeroY = 0;
  let lossY = 0;
  let K = 0;
  let t = 0;
  /* time left to expiry: from a week to a day, round again */
  const left = () => 1 - 0.94 * ((t % CYCLE) / CYCLE);
  const slope = () => (zeroY - pane.y0) / ((pane.x1 - K) * 0.62);
  /** the money at a price (y, in px): at expiry the hockey stick; today softened by the time left */
  const atExpiry = (x: number) => Math.min(lossY, lossY - (x - K) * slope());
  const today = (x: number) => {
    const w = 46 * Math.sqrt(left()) + 2;
    const u = (x - K) / w;
    const soft = u > 20 ? u : Math.log1p(Math.exp(u));
    return lossY - soft * w * slope() - (lossY - zeroY) * 0.18 * left();
  };
  const spotX = () => clamp(pane.x0 + (pane.x1 - pane.x0) * (0.5 + 0.38 * (spotWalk.share(t) - 0.5) * 2), pane.x0 + 8, pane.x1 - 8);
  const curve = (c: CanvasRenderingContext2D, ink: (h: string, a?: number) => string, sharp: boolean, fringe: boolean) => {
    if (!s) return;
    /* the money made above the line, the money lost below it */
    if (!fringe) {
      for (const above of [true, false]) {
        c.beginPath();
        c.moveTo(pane.x0, zeroY);
        for (let x = pane.x0; x <= pane.x1; x += 3) {
          const y = today(x);
          c.lineTo(x, above ? Math.min(y, zeroY) : Math.max(y, zeroY));
        }
        c.lineTo(pane.x1, zeroY);
        c.closePath();
        c.fillStyle = ink(above ? s.ink.bull : s.ink.red, sharp ? 0.1 : 0.11);
        c.fill();
      }
    }
    /* the curve itself: green where it makes money, red where it loses */
    c.lineJoin = 'round';
    c.lineWidth = sharp ? 1.8 : 2.8;
    for (const above of [true, false]) {
      c.beginPath();
      let on = false;
      for (let x = pane.x0; x <= pane.x1; x += 3) {
        const y = today(x);
        if (above === y <= zeroY) {
          if (on) c.lineTo(x, y);
          else {
            c.moveTo(x, y);
            on = true;
          }
        } else on = false;
      }
      c.strokeStyle = ink(above ? s.ink.bull : s.ink.red, 0.95);
      c.stroke();
    }
    /* the spot riding it */
    const sx = spotX();
    c.fillStyle = ink(s.ink.line, 0.6);
    for (let y = pane.y0; y < pane.y1; y += sharp ? 5 : 8) c.fillRect(sx, y, sharp ? 1 : 2, sharp ? 2 : 3);
    c.fillStyle = ink(s.ink.line);
    c.beginPath();
    c.arc(sx, today(sx), sharp ? 3.5 : 4, 0, Math.PI * 2);
    c.fill();
  };
  return {
    place(b, st) {
      s = st;
      at = b;
      pane = box(b.x0, b.y0 + 22, b.x1 - (st.phone ? 6 : 30), b.y1 - 26);
      zeroY = pane.y0 + (pane.y1 - pane.y0) * 0.46;
      lossY = pane.y0 + (pane.y1 - pane.y0) * 0.86;
      K = pane.x0 + (pane.x1 - pane.x0) * 0.46;
      spotWalk.place(pane.x0, pane.x1, pane.y0, pane.y1, t);
    },
    still(b) {
      if (!s) return;
      const { c, sharp, ink } = b;
      /* by price, by date: the first picked */
      type(b, 'BY PRICE', at.x0, at.y0 + 7, { size: 7.5, hue: ink.line, share: 0.6 });
      c.fillStyle = rgb(ink.line, 0.9);
      if (keep(b, 0.7)) c.fillRect(at.x0, at.y0 + 13, 38, sharp ? 1 : 2);
      type(b, 'BY DATE', at.x0 + 52, at.y0 + 7, { size: 7.5, hue: ink.muted, share: 0.4 });
      /* nothing made, nothing lost: the line */
      c.fillStyle = rgb(ink.line, sharp ? 0.35 : 0.45);
      if (sharp) c.fillRect(pane.x0, Math.round(zeroY), pane.x1 - pane.x0, 1);
      else for (let x = pane.x0; x < pane.x1; x += 14 + b.r() * 20) c.fillRect(x, zeroY - 1, 8 + b.r() * 22, 2);
      /* the most it can lose: a red line of dashes, its chip */
      c.fillStyle = rgb(ink.red, sharp ? 0.7 : 0.75);
      for (let x = pane.x0; x < pane.x1; x += sharp ? 6 : 9) if (keep(b, 0.6)) c.fillRect(x, Math.round(lossY) + 3, sharp ? 3 : 4, sharp ? 1 : 2);
      chip(b, pane.x1 - 60, lossY + 3, 54, { fill: rgb(ink.red, 0.85), word: 'max loss', wordInk: rgb(ink.panel), h: 12 });
      /* the stick it closes on: at expiry, faint */
      c.strokeStyle = rgb(ink.muted, sharp ? 0.55 : 0.6);
      c.lineWidth = sharp ? 1 : 2;
      c.setLineDash(sharp ? [3, 3] : [4, 6]);
      c.beginPath();
      for (let x = pane.x0; x <= pane.x1; x += 4) c.lineTo(x, atExpiry(x));
      c.stroke();
      c.setLineDash([]);
      /* the prices along the foot, ticks only, the strike marked */
      for (let i = 0; i <= 24; i++) {
        const x = pane.x0 + ((pane.x1 - pane.x0) * i) / 24;
        c.fillStyle = rgb(ink.muted, 0.7);
        if (keep(b, 0.5)) c.fillRect(x, pane.y1 + 6, 1, i % 4 ? 3 : 6);
      }
      c.fillStyle = rgb(ink.warn, sharp ? 0.8 : 0.85);
      if (keep(b, 0.8)) c.fillRect(K - 1, pane.y1 + 4, 2, 9);
      type(b, 'strike', K + 4, pane.y1 + 10, { size: 7, hue: ink.warn, share: 0.5 });
      if (sharp) {
        c.strokeStyle = rgb(ink.ink, 0.08);
        c.lineWidth = 1;
        c.strokeRect(Math.round(pane.x0) + 0.5, Math.round(pane.y0) + 0.5, Math.round(pane.x1 - pane.x0), Math.round(pane.y1 - pane.y0));
      }
    },
    tick(f) {
      t = f.t;
      spotWalk.tick(f.t, f.dt);
    },
    live: () => box(pane.x0 - 6, pane.y0 - 6, pane.x1 + 30, pane.y1 + 22),
    moving(p: Pen, f: Frame) {
      if (!s) return;
      curve(p.c, p.ink, false, p.fringe);
      if (p.fringe) return;
      /* the spot's tag on the foot: the clock */
      const c = p.c;
      const word = clock(f.wall, f.seconds);
      c.font = `600 9px ${FONT}`;
      c.textBaseline = 'middle';
      c.textAlign = 'center';
      const w = c.measureText(word).width + 12;
      const x = clamp(spotX(), pane.x0 + w / 2, pane.x1 - w / 2);
      c.fillStyle = rgb(s.ink.line);
      c.fillRect(x - w / 2, pane.y1 - 1, w, 14);
      c.fillStyle = rgb(s.ink.panel);
      c.fillText(word, x, pane.y1 + 6.5);
      c.textAlign = 'left';
    },
    sharp(c, f) {
      if (!s) return;
      curve(c, (h, a) => rgb(h, a), true, false);
      const word = clock(f.wall, f.seconds);
      c.font = `500 9.5px ${FONT}`;
      c.textBaseline = 'middle';
      c.textAlign = 'center';
      const w = c.measureText(word).width + 14;
      const x = clamp(spotX(), pane.x0 + w / 2, pane.x1 - w / 2);
      c.fillStyle = rgb(s.ink.line);
      c.beginPath();
      c.roundRect(x - w / 2, pane.y1 - 2, w, 16, 3);
      c.fill();
      c.fillStyle = rgb(s.ink.panel);
      c.fillText(word, x, pane.y1 + 6);
      c.textAlign = 'left';
    },
    /* the pointer reads the curve: made or lost there */
    read(c, _f, x, y): Pill[] | null {
      if (!s || x < pane.x0 || x > pane.x1 || y < pane.y0 - 8 || y > pane.y1 + 8) return null;
      const cy = today(x);
      c.strokeStyle = rgb(s.ink.ink, 0.38);
      c.lineWidth = 1;
      c.setLineDash([2, 4]);
      c.beginPath();
      c.moveTo(Math.round(x) + 0.5, pane.y0);
      c.lineTo(Math.round(x) + 0.5, pane.y1);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = rgb(cy <= zeroY ? s.ink.bull : s.ink.red);
      c.beginPath();
      c.arc(x, cy, 3, 0, Math.PI * 2);
      c.fill();
      return [{ x: x + 8, y: cy, text: Math.abs(cy - zeroY) < 3 ? 'breakeven' : cy < zeroY ? 'made' : 'lost', anchor: 'left' }];
    },
    sights: () => [{ x: spotX(), y: today(spotX()) }],
  };
};
