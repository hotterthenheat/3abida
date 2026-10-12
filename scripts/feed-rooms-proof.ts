/*
  Acceptance test for the browser's side of the feed (2026-10-12) — pure rules, no browser, no vendor:
  1. The rail's price follows the page's room (data/feed/rooms.ts pageSource): the vendor's on a page whose room reads
     the feed, the house's on a page whose room reads its own book or no room's, nothing while a wired room waits
  2. Compass's board files on a name's real listed dates when it has them (data/compassStandIn.ts listingsFor), an AM
     root's last trading day the session before; the schedule without them
*/
import { pageSource, roomOfPath } from '../src/data/feed/rooms';
import type { FeedStatus } from '../src/data/feed/status';
import { boardDay, listingsFor } from '../src/data/compassStandIn';

let pass = 0, fail = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (ok) pass++;
  else fail++;
};

/* the rail's price follows the page's room (data/feed/rooms.ts pageSource) */
{
  const st = (uw: string, massive: string) => ({ uw: { state: uw, key: true, status: 200, at: 1 }, massive: { state: massive, key: true, status: 200, at: 1 } }) as unknown as FeedStatus;
  const up = st('ok', 'ok');
  check('a Trace page reads the feed when UW is up', pageSource('/trace/live-tape', up) === 'feed');
  check('a Dossier page reads the feed when both are up', pageSource('/dossier/stocks/AAPL', up) === 'feed');
  check('the Dossier reads its own book when Massive is down', pageSource('/dossier/news', st('ok', 'no-key')) === 'stand-in');
  check('an unwired room reads its own book', ['/pulse', '/terrain', '/pinpoint/map', '/compass', '/weigher', '/out/pulse/x'].every(p => pageSource(p, up) === 'stand-in'));
  check('a page no room holds reads the house', ['/practice/paper', '/settings/sources', '/glossary', '/community', '/alerts'].every(p => roomOfPath(p) === null && pageSource(p, up) === 'stand-in'));
  check("a wired room waits while the first probe is out", pageSource('/trace', st('unknown', 'unknown')) === 'pending' && pageSource('/pulse', st('unknown', 'unknown')) === 'stand-in');
  check('/tracer is not Trace', roomOfPath('/tracer') === null);
}

/* the board's real calendar (data/compassStandIn.ts listingsFor with the feed's dates) */
{
  const day = boardDay(new Date(2026, 9, 12, 12).getTime());
  const list = listingsFor('SPX', day, [
    { iso: '2026-10-12', am: false },
    { iso: '2026-10-16', am: false },
    { iso: '2026-10-16', am: true },
    { iso: '2026-11-20', am: true },
  ]);
  const am = list.find(l => l.am && l.expires.getDate() === 16);
  check("an AM date's last trading day is the session before", !!am && am.last.getDate() === 15);
  check('the real list stands in place of the schedule', list.length === 4 && list[0].series === 'daily' && list.some(l => !l.am && l.series === 'monthly'));
  check('no list: the schedule', listingsFor('SPX', day, null).length > 4);
}


console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
