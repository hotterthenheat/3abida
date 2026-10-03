/* PRACTICE'S ACTS (2026-10-02 — the owner: "make sure the videos really show the features of every page", and "make them
   move fast"). PAPER: a target pulled up off the position's own chip and a stop down, the desk put on four charts — one
   name at four intervals, the position and its ways out on each — and back to one, the door to a new account read (the
   practice sizes, and a prop firm's evaluation with its plans side by side), another strike of the chain opened on its
   order to buy and the held one again, and the target and the stop taken off by their own ×. BACKTEST: the replay sped up
   and played — the day runs on under the position, its target and stop drifting as the contract decays — paused, another
   strike of the chain opened as it stood that minute and the open one again, the book's closed trades, and the clock pulled
   back along its bar and stepped on to the minute the film began on. THE JOURNAL: the month's best day opened under the
   calendar, down to its trades, one opened on its own page — the name while it was on, the shape of it — the next one
   walked to, back to the journal, the calendar read for one account and for all, and the day it opened on. */
export default ({ on, off }) => {
  /* the book's three tabs: Positions · Orders · Trades */
  const BOOK_TABS = '[role="group"][aria-label="Positions, orders and trades"] button';
  /* THE PAPER CHAIN (the Weigher's grid): a strike's row is `s<strike>`, the drop-down open under one `d<strike>` */
  const CHAIN_ROW = '[data-paper-chain-grid] .ag-row';
  /* the strike whose drop-down is open — the one the stage bought, its position in it */
  const heldNow = async ({ frame }) =>
    frame.locator('[data-paper-chain-grid] [row-id^="d"]:not([row-id="divider"])').first().getAttribute('row-id', { timeout: 1500 }).then(id => id?.slice(1) ?? null).catch(() => null);
  /* A STRIKE IS PRESSED ON ITS STRIKE. The chain's prices are drawn afresh at every tick of the feed, and a press whose
     button went down on a price and came up on its redrawn one was no click at all (measured: two presses in sixteen did
     nothing — one film ended on another strike's drop-down); the strike's own cell at the row's left does not change */
  const STRIKE_X = 0.06;
  /* …and only a row the chain's own window shows: one it has scrolled away still has a box on the screen, under whatever
     stands over it there, and is reported as found nothing rather than pressed through something else */
  const chainRow = id => async ({ frame, size }) =>
    frame
      .locator(`${CHAIN_ROW}[row-id="${id}"]`)
      .first()
      .evaluate((el, fx) => {
        const r = el.getBoundingClientRect();
        const w = (el.closest('.ag-grid-viewport, .ag-body-viewport') ?? el).getBoundingClientRect();
        return r.top < w.top - 1 || r.bottom > w.bottom + 1 ? null : [r.x + r.width * fx, r.y + r.height / 2];
      }, STRIKE_X)
      .then(p => (p && p[1] > (size.form === 'phone' ? 48 : 2) && p[1] < size.h - 14 ? p : null))
      .catch(() => null);
  /* the strike k rows above the open one, as the chain draws them (the market's line between is not a strike) */
  const strikeAbove = k => async c => {
    const held = c.memo.held ?? (await heldNow(c));
    if (!held) return null;
    const ids = await c.frame.locator(`${CHAIN_ROW}[row-id^="s"]`).evaluateAll(els => [...new Map(els.map(e => [e.getAttribute('row-id'), +e.getAttribute('row-index')])).entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id)).catch(() => []);
    const at = ids.indexOf(`s${held}`);
    return at - k >= 0 ? chainRow(ids[at - k])(c) : null;
  };
  /* THE CHART'S CHIPS MOVE UNDER THE HAND. They are placed every frame where their price stands on the live scale, and the
     scale re-fits as the name moves: in a light take the target's chip rose 11px while the pointer glided to its ×, the
     press landed under it, and the film ended with the target still on (measured). So the hand is aimed again at the
     moment it arrives — the pointer drawn where the glide ended, a hair from it — and a × is pressed down and let go in
     that same moment: with a frame between, the chip can move between the two and the press is no click. */
  const at0 = (sel, fx, fy) => async ({ frame }) =>
    frame.locator(sel).first().evaluate((el, [fx, fy]) => {
      const r = el.getBoundingClientRect();
      return r.width > 2 && r.height > 2 ? [r.x + r.width * fx, r.y + r.height * fy] : null;
    }, [fx, fy]).catch(() => null);
  const aimNow = (sel, fx = 0.5, fy = 0.5) => ({
    remember: 'aimed',
    of: async c => {
      const p = await at0(sel, fx, fy)(c);
      if (p) await c.page.mouse.move(p[0], p[1]);
      return p;
    },
  });
  const clickNow = sel => ({
    remember: 'clicked',
    of: async c => {
      const p = await at0(sel, 0.5, 0.5)(c);
      if (!p) return null;
      await c.page.mouse.move(p[0], p[1]);
      await c.page.mouse.down();
      await c.page.mouse.up();
      return p;
    },
  });
  const CHIP = '[data-chart-position]';
  /* a way out pulled off the position's chip, by `dy` points: up for a call's target, down for its stop */
  const pull = (dy, fx = 0.3, dur = 0.6) => [aimNow(CHIP, fx, 0.5), { drag: off(on(CHIP, 0, fx, 0.5), 0, dy), dur }];
  /* a way out taken off by its own × */
  const takeOff = (kind, dur) => [{ to: on(`[data-chart-cancel="${kind}"]`, 0), dur }, clickNow(`[data-chart-cancel="${kind}"]`)];
  /* THE REPLAY BAR'S FIRST MINUTE, a little past its left end: a drag there asks for the day's open, and the clock stops at
     the floor (the last order or fill) wherever that is. (Not a share of the bar: 2% of it is 09:38, and the phone's stage
     buys at 09:31 — measured, a phone take that came back to 09:38, seven minutes on from where it began) */
  const TRACK_START = off(on('[data-replay-track]', 0, 0, 0.5), -10, 0);
  /* a day of the calendar that has trades — the n-th of the month's, in its order */
  const tradedDay = (n, fx = 0.5, fy = 0.5) => on('[data-journal-day][data-trades]:not([data-trades="0"])', n, fx, fy);
  /* THE TRADE PAGE'S CODE, FETCHED BEFORE ITS ROW IS PRESSED. The page is loaded on first use (App.tsx, lazy), and the
     dev server takes its time on the browser's clock, not the film's: the first take showed the section's skeleton for a
     frame between the journal and the trade (measured). So it is asked for at the act's start, at the address the app
     itself asks for it by (read off the app's own module, which the server has rewritten) — the press then finds it in. */
  const warmTrade = {
    remember: 'warm',
    of: async ({ frame }) =>
      frame.locator('body').evaluate(async () => {
        const app = performance.getEntriesByType('resource').map(e => e.name).find(n => /\/src\/App\.tsx(\?|$)/.test(n));
        const said = app ? await fetch(app).then(r => r.text()).catch(() => '') : '';
        const url = said.match(/import\("([^"]*\/pages\/practice\/JournalTrade\.tsx[^"]*)"\)/)?.[1] ?? '/src/pages/practice/JournalTrade.tsx';
        await import(url);
        return url;
      }).catch(() => null),
  };
  /* A CHANGE OF PAGE, PLAYED THROUGH BETWEEN TWO FRAMES. The section's fade (PracticeLayout: the old page out, then the
     new one in) and the journal's soft swap (JournalHome: what a change touches fades out, then in) run half on the page's
     clock (the lift, the swap's wait) and half on the browser's (the opacity): between two of the film's frames the old
     page had gone and the new one was not yet in, and the take blinked black for a frame at each (measured: three blinks
     in one take — to a trade, back, and a change of account). So, right after such a press, the page's clock is run on a
     little at a time and each fade the browser is still holding is played to its end, until the page asked for stands
     whole: the next frame is the new page, a cut. `want` is 'trade' (a trade's own page) or 'home' (the journal, drawn
     from what its address now says — the soft swap caught up) */
  const through = want => ({
    remember: 'through',
    of: async ({ frame, page }) => {
      for (let k = 0; k < 24; k++) {
        const whole = await frame.locator('body').evaluate((_, want) => {
          for (const a of document.getAnimations()) if (a.playState === 'running' && a.effect?.getComputedTiming?.().iterations !== Infinity) a.finish();
          /* the section's wrapper: one of it, at full strength and at rest (its lift is on the page's clock) */
          const wraps = [...document.querySelectorAll('main div[class*="min-h-[calc(100vh-174px)]"]')];
          const lift = Math.abs(Number((wraps[0]?.style.transform.match(/-?[\d.]+/) ?? [0])[0]));
          if (wraps.length !== 1 || Number(getComputedStyle(wraps[0]).opacity) < 0.99 || lift > 0.5) return false;
          if (want === 'trade') return !!wraps[0].querySelector('[data-journal-trade]:not([data-journal-trade="missing"])');
          const home = wraps[0].querySelector('[data-journal-home]');
          if (!home || document.querySelector('[data-swap-out]')) return false;
          /* the journal draws from a snapshot that catches up with its address as the swap lands (JournalHome's `drawn`) */
          const q = new URLSearchParams(location.search);
          const period = ['today', 'week', 'month', 'year', 'all'].includes(q.get('period') ?? '') ? q.get('period') : 'month';
          const day = /^\d{4}-\d{2}-\d{2}$/.test(q.get('day') ?? '') ? q.get('day') : '';
          return home.getAttribute('data-journal-drawn') === `${q.get('book') === 'backtest' ? 'backtest' : 'paper'}|${period}|${q.get('session') ?? ''}|${day}`;
        }, want).catch(() => false);
        if (whole) return k;
        await page.context().clock.runFor(40);
        await page.waitForTimeout(25);
      }
      return null;
    },
  });
  /* …AND THE PRESS THAT CHANGES THE PAGE, MADE WITH IT. A press beat takes a frame of its own between its click and the
     next beat (the pointer's dip), and that frame was the blink: measured in a take with the play-through after each press,
     still four frames at a third of the page's brightness. So where a press puts a new page up — a trade, the journal again,
     another account — the pointer glides there by a beat of its own, and the click is made here, the change played through
     before the next frame is taken. */
  const clickThrough = want => ({
    remember: 'click',
    of: async c => {
      await c.page.mouse.down();
      await c.page.mouse.up();
      return through(want).of(c);
    },
  });
  /* the account card's lines: every account first, then each account */
  const ACCOUNT_LINE = '[data-dropdown-card="journal-account"] [role="menuitemradio"]';
  return {
    DESK: {
      '/practice/paper': [
        { to: on('[data-chart-ground]', 0, 0.35, 0.55), dur: 0.4 }, { to: on('[data-chart-ground]', 0, 0.62, 0.42), dur: 0.5 },
        /* a target pulled up off the position's own chip, and a stop down: each a dashed line with its chip, what it would
           make or lose there (the chip's left, its grip and its money — its × at the right is a sale) */
        { to: on(CHIP, 0, 0.3, 0.5), dur: 0.4 }, { hold: 0.1 }, ...pull(-66), { hold: 0.35 },
        { to: on(CHIP, 0, 0.3, 0.5), dur: 0.35 }, { hold: 0.1 }, ...pull(58), { hold: 0.4 },
        /* four charts: the name at four intervals, the position and its ways out drawn on each; then one again (a layout
           that shrinks keeps its first pane) */
        { press: on('[data-paper-layout="4"]', 0), dur: 0.5 }, { hold: 0.8 },
        { to: on('[data-desk-pane="3"]', 0, 0.3, 0.55), dur: 0.45 }, { to: on('[data-desk-pane="3"]', 0, 0.62, 0.45), dur: 0.45 },
        { press: on('[data-paper-layout="1"]', 0), dur: 0.5 }, { hold: 0.4 },
        /* a new account: the practice sizes, and a prop firm's evaluation — its plans side by side, what each asks to pass —
           read and put away by the same door (nothing is started) */
        { press: on('[data-paper-new]', 0), dur: 0.5 }, { hold: 0.5 },
        { to: on('[data-paper-new-card] [data-paper-size]', 2, 0.5, 0.5), dur: 0.35 },
        { to: off(on('[data-paper-new-card] [data-paper-plan-start]', 1, 0.5, 0.5), -150, 0), dur: 0.4 }, { hold: 0.35 },
        { press: on('[data-paper-new]', 0), dur: 0.4 }, { hold: 0.25 },
        /* the chain: a strike two above the one held opened — its stats, its greeks, and the order inside its drop-down to
           buy it — and the held one opened again. (Not the chain's side: a side switched centres the chain on the market's
           line, a few points off where the stage's own press left it — measured, the calls came back 12px down; a strike
           opened above the held one asks the chain for no scroll, and neither does the held one, opened again) */
        { press: strikeAbove(2), dur: 0.5 }, { hold: 0.9 },
        { press: c => chainRow(`s${c.memo.held}`)(c), dur: 0.45 }, { hold: 0.4 },
        /* the target and the stop taken off by their own × — the position stays, as it began */
        ...takeOff('target', 0.5), { hold: 0.25 },
        ...takeOff('stop', 0.4), { hold: 0.3 },
      ],
      '/practice/backtest': [
        { to: on('[data-chart-ground]', 0, 0.4, 0.5), dur: 0.4 }, { to: on('[data-chart-ground]', 0, 0.7, 0.42), dur: 0.45 },
        /* the replay ten times as fast, and played: the day runs on under the position — its candles, what it is up or down,
           the target and the stop drifting as the contract decays, the chain as it stood each minute. (Not for longer: forty
           minutes on, the day falls through the stop — measured, the stop fills near 13:25 — and a fill moves the clock's
           floor past the minute the film began on) */
        { pick: 'replay-pace', option: '10×', dur: 0.45 }, { hold: 0.15 },
        { press: on('[data-replay-play]', 0), dur: 0.4 }, { hold: 0.9 },
        { press: on('[data-replay-play]', 0), dur: 0.2 }, { hold: 0.3 },
        /* THE CHAIN AS IT STOOD: a strike two above the open one opened onto its stats and its greeks at that minute, and the
           open one again — neither asks the chain's window to scroll (measured) */
        { press: c => on(`[data-chain-row="${c.memo.above}"]`, 0, 0.12)(c), dur: 0.5 }, { hold: 0.8 },
        { press: c => on(`[data-chain-row="${c.memo.open}"]`, 0, 0.12)(c), dur: 0.4 }, { hold: 0.3 },
        /* the book's closed trades — the morning's two round trips, what each made or lost — and its positions again.
           (Not the chain's side: a side switched centres the chain's window on the market's line, and the window the
           stage left — its last strike brought into view — is not where that puts it: the film came back on another
           scroll of the chain) */
        { press: on(BOOK_TABS, 2), dur: 0.5 }, { hold: 0.7 },
        { press: on(BOOK_TABS, 0), dur: 0.4 }, { hold: 0.2 },
        /* THE CLOCK ONLY MOVES FORWARD: pulled back along its bar it stops at the last order (the minute the stage set the
           target and the stop), and is stepped on from there, a minute at a time, to the minute the film began on — the
           stage's three steps, taken again */
        { to: on('[data-replay-handle]', 0), dur: 0.45 },
        { drag: TRACK_START, dur: 0.6 }, { hold: 0.3 },
        { press: on('[data-replay-step="on"]', 0), dur: 0.4 }, { hold: 0.2 }, { press: true }, { hold: 0.2 }, { press: true }, { hold: 0.3 },
        { unpick: 'replay-pace' }, { hold: 0.3 },
      ],
      '/practice/journal': [
        warmTrade,
        /* the calendar: the month's best day opened under it — its trades, the account each was on, how the day went */
        { to: tradedDay(12), dur: 0.45 }, { to: tradedDay(16), dur: 0.4 },
        { press: tradedDay(16), dur: 0.15 }, through('home'), { hold: 0.6 },
        { scroll: 300, dur: 0.6 }, { hold: 0.2 },
        { to: on('[data-journal-day-curve]', 0, 0.55, 0.6), dur: 0.45 }, { hold: 0.3 },
        /* a trade's row opens the trade: the name while it was on, with where it went in and out, and the shape of it */
        { to: on('[data-journal-day-trades] .ag-row', 0, 0.3), dur: 0.45 }, clickThrough('trade'), { hold: 0.9 },
        { to: on('[data-journal-shape]', 0, 0.2, 0.55), dur: 0.45 }, { hold: 0.2 },
        /* the next trade back, walked to by its own door */
        { press: on('[data-journal-older]', 0), dur: 0.5 }, through('trade'), { hold: 0.8 },
        /* back to the journal: the day still open */
        { to: on('[data-journal-back]', 0), dur: 0.5 }, clickThrough('home'), { hold: 0.5 },
        /* one account's trades: the calendar, the figures and the year's line read for the sample's practice account, and
           every account again (a change of account closes the day) */
        { press: on('[data-dropdown="journal-account"]', 0), dur: 0.5 }, { hold: 0.3 },
        { to: on(ACCOUNT_LINE, 1, 0.3), dur: 0.35 }, clickThrough('home'), { hold: 0.8 },
        { press: on('[data-dropdown="journal-account"]', 0), dur: 0.45 }, { hold: 0.3 },
        { to: on(ACCOUNT_LINE, 0, 0.3), dur: 0.35 }, clickThrough('home'), { hold: 0.3 },
        /* the day the page opened on, opened again */
        { press: c => on(`[data-journal-day="${c.memo.day}"]`, 0)(c), dur: 0.5 }, through('home'), { hold: 0.6 },
      ],
    },
    PHONE: {
      '/practice/paper': [
        { to: on('[data-chart-ground]', 0, 0.35, 0.5), dur: 0.4 }, { to: on('[data-chart-ground]', 0, 0.6, 0.42), dur: 0.5 },
        /* a target pulled up off the position's own chip */
        { to: on(CHIP, 0, 0.25, 0.5), dur: 0.4 }, { hold: 0.1 }, ...pull(-60, 0.25), { hold: 0.4 },
        /* four charts, the name at four intervals — the target on each — and back to one */
        { press: on('[data-paper-layout="4"]', 0), dur: 0.5 }, { hold: 0.8 },
        { press: on('[data-paper-layout="1"]', 0), dur: 0.45 }, { hold: 0.3 },
        /* the target taken off by its own × (before the account is read: while an order works, the card's head grows a
           Cancel all, and on a phone that pushes its New door off the screen) */
        ...takeOff('target', 0.45), { hold: 0.3 },
        /* down to the account: the door to a new one — the practice sizes, and a prop firm's evaluation with its plans —
           read and put away by the same door. (Not the chain's strikes, as on the desk: on a phone the chain is a window
           of its own, scrolled by the stage's press to the held strike's drop-down, and the rows above it stand outside
           the window — measured, the presses landed on the account card over them) */
        { scroll: 560, dur: 0.9 }, { hold: 0.2 },
        { press: on('[data-paper-new]', 0), dur: 0.45 }, { hold: 0.5 },
        { to: on('[data-paper-new-card] [data-paper-size]', 1, 0.5, 0.5), dur: 0.35 },
        { to: on('[data-paper-new-card] [data-paper-plans-narrow] > *', 1, 0.45, 0.45), dur: 0.4 }, { hold: 0.35 },
        { press: on('[data-paper-new]', 0), dur: 0.4 }, { hold: 0.25 },
        { scroll: -560, dur: 0.9 }, { hold: 0.3 },
      ],
      /* the replay bar stands under the chart on a phone: down to it, the day played ten times as fast and paused, and
         pulled back along the bar — on a phone the stage bought at the minute it stopped on, so the floor is where it began
         (and it sets no stop, so nothing on the way can fill) */
      '/practice/backtest': [
        { scroll: 400, dur: 0.8 }, { hold: 0.2 },
        { pick: 'replay-pace', option: '10×', dur: 0.45 }, { hold: 0.2 },
        { press: on('[data-replay-play]', 0), dur: 0.4 }, { hold: 1.2 },
        { press: on('[data-replay-play]', 0), dur: 0.2 }, { hold: 0.3 },
        { to: on('[data-replay-handle]', 0), dur: 0.4 },
        { drag: TRACK_START, dur: 0.6 }, { hold: 0.4 },
        { unpick: 'replay-pace' }, { hold: 0.2 },
        { scroll: -400, dur: 0.8 }, { hold: 0.3 },
      ],
      '/practice/journal': [
        /* one account's trades: the head's figures and the calendar read for the sample's practice account */
        { press: on('[data-dropdown="journal-account"]', 0), dur: 0.5 }, { hold: 0.3 },
        { to: on(ACCOUNT_LINE, 1, 0.3), dur: 0.35 }, clickThrough('home'), { hold: 0.7 },
        { scroll: 380, dur: 0.8 }, { hold: 0.2 },
        { press: tradedDay(3), dur: 0.5 }, through('home'), { hold: 0.5 },
        /* the day opens under the year's figures: down to its trades, then shut again */
        { scrollTo: 'button[aria-label="Close the day"]', at: 0.2, dur: 1.0 }, { hold: 0.7 },
        { press: on('button[aria-label="Close the day"]', 0), dur: 0.45 }, through('home'), { hold: 0.3 },
        { scroll: -4000, dur: 1.0 }, { hold: 0.2 },
        { press: on('[data-dropdown="journal-account"]', 0), dur: 0.45 }, { hold: 0.3 },
        { to: on(ACCOUNT_LINE, 0, 0.3), dur: 0.35 }, clickThrough('home'), { hold: 0.4 },
      ],
    },
    /* the Journal's still is a day opened (landing-stage.mjs): the film keeps which, to end on it */
    REMEMBER: {
      '/practice/journal': [{ remember: 'day', of: async ({ frame }) => frame.locator('[data-journal-day][data-on]').first().getAttribute('data-journal-day', { timeout: 1500 }).catch(() => null) }],
      /* Paper's still has the strike bought open in the chain: the film keeps which, to open it again */
      '/practice/paper': [{ remember: 'held', of: heldNow }],
      /* the Backtest's still has a strike open in the chain (the ticket on it): the film keeps which, and the strike two
         rows above it, as the window draws them */
      '/practice/backtest': [
        { remember: 'open', of: async ({ frame }) => frame.locator('[data-chain-row][aria-expanded="true"]').first().getAttribute('data-chain-row', { timeout: 1500 }).catch(() => null) },
        {
          remember: 'above',
          of: async ({ frame, memo }) =>
            frame.locator('[data-chain-row]').evaluateAll((els, open) => {
              const ks = els.map(e => e.getAttribute('data-chain-row'));
              const at = ks.indexOf(open);
              return at >= 2 ? ks[at - 2] : null;
            }, memo.open).catch(() => null),
        },
      ],
    },
  };
};
