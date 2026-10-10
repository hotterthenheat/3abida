/* THE DOSSIER'S NEWS AND EARNINGS (2026-10-02 — the owner: "make sure the videos really show the features of every page",
   and "make them move fast"). NEWS, "the wire, on a map": a city's pin read on the line under the map, the wire cut to its
   negative stories off the Lean menu and back, one kind of story pulled up by the pills at the map's foot, a pin pressed —
   the world glides to its city and its story opens beside the map — a double-click closer still, and Fit to the whole
   world again (a phone reads the story under the map, whole). EARNINGS, "the
   calendar, and a page for each name": next week on the board, only the reports priced rich, the week as a list, a name's
   own page opened — today's price replayed against its last eight prints, a bar read — and the calendar again.

   HOW THE NEWS FILM COMES HOME. A story opened by hand (a pin, a row, the tape) flies the map; the story the page opens on
   is the wire's newest, picked for the reader, and does not. So the film never presses its way back to that story: it
   picks a kind the story is not (Macro, or Earnings when the story is a Macro one), works the map there, and then presses
   the story's own kind — the story in hand is not of that kind, so the page opens that kind's newest, which is the story
   it opened on — and All. Fit glides the world home. */
export default ({ on, at, off }) => {
  /* the story the page opened on is of this kind (its row's third column) — and the film works the map in another */
  const kind = c => c.memo.kind;
  const other = c => (c.memo.kind === 'Macro' ? 'Earnings' : 'Macro');
  const pill = words => c => on(`[data-news-kind="${typeof words === 'function' ? words(c) : words}"]`, 0)(c);
  /* A CITY'S PIN, not the open story's, standing clear of the kinds' pills (where they cover the map's lower half a press
     there lands on a pill): the biggest first — the city with the most stories, or the freshest */
  const pin = (rank = 0) => async ({ frame, size }) => {
    const all = await frame
      .locator('[data-news-pin]:not([data-open])')
      .evaluateAll(els => {
        const map = document.querySelector('[data-news-map]')?.getBoundingClientRect();
        const kinds = document.querySelector('[data-news-kinds]')?.getBoundingClientRect();
        if (!map) return [];
        /* (the pills stand over the map's foot only where they are inside it: a phone's stand above the map since
           2026-10-10, and their top as the floor left no pin to press) */
        const floor = Math.min(map.bottom, kinds && kinds.top > map.top ? kinds.top : map.bottom) - 4;
        return els
          .map(e => e.getBoundingClientRect())
          .filter(r => r.width > 2 && r.left > map.left + 6 && r.right < map.right - 6 && r.top > map.top + 6 && r.bottom < floor)
          .map(r => [r.x, r.y, r.width, r.height]);
      })
      .catch(() => []);
    const shown = all.filter(([, y, , h]) => y > (size.form === 'phone' ? 48 : 2) && y + h < size.h - 14).sort((a, b) => b[2] - a[2]);
    if (!shown.length) return null;
    const [x, y, w, h] = shown[Math.min(rank, shown.length - 1)];
    return [x + w / 2, y + h / 2];
  };
  /* A ROUTE'S FADE, KEPT TO THE FILM'S TIME (as the Filings and Stocks act does it): the Dossier's shell cross-fades a page
     out and the next in on the browser's own animation clock, started at the page's held time, and by the time the act
     opens a name the page's clock has run far ahead of the browser's — the fade waited out the difference in real time,
     and the name's page stood blank to the film's end (measured 2026-10-10, desk and phone: the replay's bars and the
     calendar's door found nothing). A fade that has not begun is played to its end, as the old page leaves and the new
     one comes in */
  const fadeOn = {
    remember: 'fade',
    of: async ({ frame, page }) => {
      await page.waitForTimeout(40);
      return frame.locator('body').evaluate(() => {
        let k = 0;
        for (const a of document.getAnimations())
          if (a.effect?.getComputedTiming?.().iterations !== Infinity && a.playState === 'running' && Number(a.currentTime) < 0) {
            a.finish();
            k++;
          }
        return k;
      }).catch(() => 0);
    },
  };
  const fadesOn = [fadeOn, { hold: 0.05 }, fadeOn, { hold: 0.05 }, fadeOn];
  /* back to the calendar by the name page's own door: the calendar opens as it always does (this week, every report,
     the board), which is where the film began */
  const CALENDAR = '[data-name-back] a';

  return {
    DESK: {
      '/dossier/news': [
        /* the pointer on a city: its stories, read on the line under the map */
        { to: pin(0), dur: 0.45 }, { hold: 0.35 },
        /* the wire cut to the stories that read negative: the green pins go, the land re-warms — and every story again */
        { pick: 'news-lean', option: 'Negative', dur: 0.5 }, { hold: 0.8 },
        { unpick: 'news-lean' }, { hold: 0.3 },
        /* one kind of story pulled up by the pills at the map's foot: the pins, the heat and the story in hand follow */
        { press: pill(other), dur: 0.5 }, { hold: 0.8 },
        /* a pin pressed: the world glides to its city, and its story opens beside the map */
        { press: pin(0), dur: 0.45 }, { hold: 0.9 },
        /* closer still: a double-click on the land beside the city zooms the map in on it (Fit takes it home) */
        { to: off(on('[data-news-pin][data-open]', 0), 34, 26), dur: 0.35 }, { double: true }, { hold: 0.8 },
        { press: on('[data-news-map-fit]', 0), dur: 0.45 }, { hold: 0.5 },
        /* the story it opened on, by its own kind (see above), and every kind again */
        { press: pill(kind), dur: 0.45 }, { hold: 0.6 },
        { press: pill('all'), dur: 0.4 }, { hold: 0.5 },
      ],
      '/dossier/earnings': [
        /* today's reports on the board */
        { to: on('[data-earnings-card]', 0), dur: 0.45 }, { to: on('[data-earnings-card]', 2), dur: 0.35 },
        /* next week: the board fills, a name a card, before the open or after the close */
        { pick: 'earnings-week', option: 'Next week', dur: 0.5 }, { hold: 0.8 },
        { to: on('[data-earnings-card]', 1), dur: 0.4 }, { to: on('[data-earnings-card]', 5), dur: 0.35 },
        /* only the reports whose options charge more than the name usually moves */
        { pick: 'earnings-show', option: 'Priced rich', dur: 0.5 }, { hold: 0.7 },
        /* the week as a list of days, every name a door */
        { pick: 'earnings-layout', option: 'List', dur: 0.5 }, { hold: 0.7 },
        /* a name's own page: today's price for the move, replayed against its last eight prints — a bar read */
        { press: on('[data-earnings-door]', 0, 0.4), dur: 0.5 }, ...fadesOn, { hold: 0.9 },
        { to: on('[data-replay-bar]', 2, 0.5, 0.45), dur: 0.45 }, { to: on('[data-replay-bar]', 5, 0.5, 0.45), dur: 0.4 }, { hold: 0.3 },
        { press: on(CALENDAR, 0, 0.5), dur: 0.55 }, ...fadesOn, { hold: 0.6 },
      ],
    },
    PHONE: {
      '/dossier/news': [
        /* down until the map and the story in hand stand on the screen together (420 since the kinds' pills stand over
           the map, 2026-10-10: at 300 the story's "Read the whole story" stood under the screen's foot) */
        { scroll: 420, dur: 0.9 }, { hold: 0.2 },
        { press: pill(other), dur: 0.5 }, { hold: 0.8 },
        { press: pin(0), dur: 0.45 }, { hold: 0.8 },
        /* the story read whole (a new story opens folded again) */
        { press: on('[data-news-body-door]', 0, 0.4), dur: 0.45 }, { hold: 0.7 },
        { press: on('[data-news-map-fit]', 0), dur: 0.45 }, { hold: 0.4 },
        { press: pill(kind), dur: 0.45 }, { hold: 0.6 },
        { press: pill('all'), dur: 0.4 }, { hold: 0.4 },
        { scroll: -420, dur: 0.9 }, { hold: 0.3 },
      ],
      '/dossier/earnings': [
        /* the week as a list of days — a phone's board scrolls sideways */
        { pick: 'earnings-layout', option: 'List', dur: 0.6 }, { hold: 0.5 },
        { scroll: 330, dur: 1.0 }, { hold: 0.3 },
        /* a name's own page opens at its head; down to today's price replayed, a bar read */
        { press: on('[data-earnings-door]', 2, 0.4), dur: 0.5 }, ...fadesOn, { hold: 0.8 },
        { scroll: 360, dur: 0.9 }, { hold: 0.2 },
        { to: on('[data-replay-bar]', 2, 0.5, 0.45), dur: 0.4 }, { to: on('[data-replay-bar]', 5, 0.5, 0.45), dur: 0.35 }, { hold: 0.3 },
        { to: at(0.5, 0.2), dur: 0.35 },
        { scroll: -360, dur: 0.8 }, { hold: 0.2 },
        { press: on(CALENDAR, 0, 0.5), dur: 0.5 }, ...fadesOn, { hold: 0.6 },
      ],
    },
    REMEMBER: {
      /* THE NAME PAGE'S CODE, FETCHED BEFORE THE ACT NEEDS IT. A page's code travels on its first visit, and the press on a
         name showed what fills that wait: the page's skeleton, a frame of it between the calendar and the page (measured).
         So before the first beat, between two frames and with nothing filmed, a name's page is asked for by its card and
         the calendar taken back at once. A Dossier page changes on a fade (out, then in) that runs on the page's own clock,
         which the film holds: the clock is let run a quarter of a second for each — the calendar out, the name's page out,
         the calendar in. The calendar is still (nothing on it moves in those three quarters of a second), and it comes back
         as it opens (this week, every report, the board): the frames either side of this are the same picture (42.8 dB).
         The page change the act makes itself still shows its fade: one dark frame at four times the page's speed. */
      '/dossier/earnings': [
        {
          remember: 'warm',
          of: async ({ frame, page }) => {
            const card = frame.locator('[data-earnings-card]').first();
            if (!(await card.count())) return null;
            const clock = page.context().clock;
            await card.evaluate(e => e.click());
            await clock.runFor(250);
            await page.waitForTimeout(1500);
            await frame.locator('body').evaluate(() => history.back());
            await page.waitForTimeout(200);
            await clock.runFor(250);
            await page.waitForTimeout(200);
            await clock.runFor(250);
            await page.waitForTimeout(300);
            return frame.locator('body').evaluate(() => location.pathname);
          },
        },
      ],
      '/dossier/news': [{ remember: 'kind', of: async ({ frame }) => frame.locator('[data-news-row][data-open] > span:nth-child(3)').first().textContent({ timeout: 1500 }).then(t => t?.trim() || null).catch(() => null) }],
    },
  };
};
