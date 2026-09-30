/*
  REVIEW · THE JOURNAL'S PROOF — `npx tsx scripts/review-journal-proof.ts` (run with `npm run review:proof`)
  What the journal computes about a closed trade, and how it cuts and orders them, checked off the browser.
  Exits 1 on a miss.
*/
import { accountOf, advance, cancel, newSession, place, type Session } from '../src/data/review/engine';
import { excursionOf, keptOf } from '../src/data/review/excursion';
import { CUT_AT_REST, ENDED, csvOf, cutFromQuery, cutToQuery, entryOf, inCut, instantOf, piecesWords, rowsOf, tagKeysOf, whenWords, wordsOf, type JournalRow } from '../src/data/review/journal';
import { chainAt, expiriesAt, quoteAt } from '../src/data/review/quotes';
import { byHour, byName, bySide, bySize, byWeekday, calendarDayOf, dayTotals, grossOf, monthWeeks, runningOf, rowsIn, runsOf, spanOf } from '../src/data/review/journalFigures';
import { tapeDays } from '../src/data/review/tape';

let misses = 0;
const ok = (what: string, pass: boolean, detail = '') => {
  if (!pass) misses++;
  console.log(`${pass ? 'ok  ' : 'MISS'} ${what}${detail ? ` — ${detail}` : ''}`);
};
const near = (a: number, b: number, eps = 0.011) => Math.abs(a - b) <= eps;
const ny = (t: number) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).format(new Date(t * 1000));

const days = tapeDays();
const day = days[days.length - 40];

/* ---- an option, bought at 10:00 and sold by hand at 11:30, with a target and a stop riding it ---- */
const exp = (expiriesAt('SPY', day).find(e => e.dte >= 5) ?? expiriesAt('SPY', day)[0]).iso;
const { rows: chain, spot } = chainAt('SPY', day, 29, exp, 4);
const strike = chain.reduce((b, r) => (Math.abs(r.strike - spot) < Math.abs(b.strike - spot) ? r : b), chain[0]).strike;
const call = { ticker: 'SPY', strike, right: 'C' as const, expiry: exp };
let s: Session = newSession({ id: 'o', name: 'options proof', ticker: 'SPY', startCash: 25000, startDay: day, now: 0 });
s = advance(s, { day, minute: 29 }, 0);
const ask = quoteAt(call, day, 29).ask;
s = place(s, { contract: call, side: 'buy', qty: 2, kind: 'market', bracket: { target: +(ask * 3).toFixed(2), stop: +(ask * 0.2).toFixed(2) } }, 0);
s = advance(s, { day, minute: 119 }, 0);
const held = accountOf(s).positions[0];
ok('the option is still on at 11:30 (its ways out were far)', !!held && held.qty === 2);
/* out by hand, the way the desk's Close does it: the pair that holds the contracts goes first, then the lot is sold */
for (const o of s.orders.filter(x => x.status === 'working')) s = cancel(s, o.id, 0);
s = place(s, { contract: call, side: 'sell', qty: 2, kind: 'market' }, 0);
const trade = accountOf(s).trades[0];
ok('it closed as one trade', !!trade && trade.qty === 2, trade ? `${trade.pnl.toFixed(2)}` : 'no trade');

const opt = rowsOf([s])[0] as Extract<JournalRow, { paper?: undefined }>;

/* ---- while it was held ---- */
const eo = excursionOf(opt);
ok('an option is walked a minute at a time, first fill to last', eo.points.length === trade.heldMin + 1, `${eo.points.length} points for ${trade.heldMin} minutes`);
ok('its times only go forward', eo.points.every((p, i) => i === 0 || p.time > eo.points[i - 1].time));
ok('the walk ends on what the trade made, to the cent', near(eo.points[eo.points.length - 1].pnl, trade.pnl));
ok('the best is never less than what was taken, the worst never more', eo.best.pnl >= trade.pnl - 0.011 && eo.worst.pnl <= trade.pnl + 0.011, `${eo.worst.pnl.toFixed(2)} … ${trade.pnl.toFixed(2)} … ${eo.best.pnl.toFixed(2)}`);
ok('a minute’s worth is the bid it could have been sold into, fees in', (() => { const p = eo.points[30]; const bid = quoteAt(call, day, 29 + 30).bid; return near(p.value, bid) && p.pnl < bid * 100 * 2 - trade.cost + 0.011; })());
ok('the figure reads the desk’s clock: in at the END of its minute', ny(eo.points[0].time) === '10:00' && whenWords(opt, trade.opened).endsWith('10:00'), `${ny(eo.points[0].time)} · ${whenWords(opt, trade.opened)}`);
ok('the ways out that rode it are found, priced on the contract, with what each would have made', eo.target?.of === 'contract' && eo.stop?.of === 'contract' && (eo.target.pnl ?? 0) > 0 && (eo.stop.pnl ?? 0) < 0);
ok('kept is a share of the best, or nothing when it never was up', eo.kept === null ? eo.best.pnl <= 0 : eo.kept <= 1 && eo.kept >= -1);
ok('walked once: the same trade is the same walk', excursionOf(opt) === eo);

const k = keptOf([opt]);
ok('across a cut: what was taken of everything the trades were up at their best', k.share === null ? k.best === 0 : k.share >= 0 && k.share <= 1, k.share == null ? 'never up' : `${Math.round(k.share * 100)}%`);

/* ---- a trade that left in PIECES is walked at its true size ---- */
{
  let sc: Session = advance(newSession({ id: 'sc', name: 'scaled', ticker: 'SPY', startCash: 50000, startDay: day, now: 0 }), { day, minute: 29 }, 0);
  sc = place(sc, { contract: call, side: 'buy', qty: 4, kind: 'market' }, 0);
  sc = place(advance(sc, { day, minute: 59 }, 0), { contract: call, side: 'sell', qty: 3, kind: 'market' }, 0);
  sc = place(advance(sc, { day, minute: 89 }, 0), { contract: call, side: 'sell', qty: 1, kind: 'market' }, 0);
  const row = rowsOf([sc])[0] as Extract<JournalRow, { paper?: undefined }>;
  const ex = excursionOf(row);
  ok('it ended scaled out, and says how each piece left', row.t.how === 'scaled' && ENDED[row.t.how] === 'Scaled out' && piecesWords(row) === 'by hand, by hand');
  ok('the walk carries the size that was still on: four, then one, then none', ex.points[0].held === 4 && ex.points[29].held === 4 && ex.points[30].held === 1 && ex.points[ex.points.length - 1].held === 0, [0, 29, 30, 60].map(i => ex.points[i].held).join(' '));
  ok('…and still ends, to the cent, on what the trade made', near(ex.points[ex.points.length - 1].pnl, row.t.pnl));
  const mid = ex.points[45];
  const took = (row.t.legs[1].price - row.t.avgIn) * 100 * 3;
  ok('a minute between the pieces is worth what was taken plus what is still on', near(mid.pnl, took + (mid.value - row.t.avgIn) * 100 * 1 - row.t.legs.reduce((a, l) => a + (l.side === 'buy' ? l.fee : 0), 0) - row.t.legs[1].fee - row.t.legs[2].fee, 0.02), mid.pnl.toFixed(2));
}

/* ---- newest first, by instant ---- */
{
  /* the same contract, bought at 10:00 and sold at 15:00 — it closed after the 11:30 trade, so it comes first */
  let late: Session = advance(newSession({ id: 'l', name: 'late', ticker: 'SPY', startCash: 25000, startDay: day, now: 0 }), { day, minute: 29 }, 0);
  late = place(late, { contract: call, side: 'buy', qty: 1, kind: 'market' }, 0);
  late = place(advance(late, { day, minute: 329 }, 0), { contract: call, side: 'sell', qty: 1, kind: 'market' }, 0);
  const order = rowsOf([s, late]).map(r => r.s.id);
  ok('newest first: the trade closed at 15:00 sorts over the one closed at 11:30', order[0] === 'l', order.join(' › '));
  const r0 = rowsOf([late])[0];
  ok('…and its instant is the clock its words say', ny(instantOf(r0, r0.t.closed)) === whenWords(r0, r0.t.closed).split(' · ')[1], `${ny(instantOf(r0, r0.t.closed))} · ${whenWords(r0, r0.t.closed)}`);
}

/* ---- the entry, the tags, the cut ---- */
const tagged: Session = { ...s, journal: { [trade.id]: { setup: 'Bounce off a wall', mistakes: ['Chased it', 'Too big'], plan: 'no', why: 'The name held the put wall, twice.', again: 'Wait for the "second" touch' } } };
const legacy: Session = { ...s, id: 'legacy', notes: { [trade.id]: 'an old note' } };
const rt = rowsOf([tagged])[0];
ok('the first journal’s one note reads as the first answer', entryOf(rowsOf([legacy])[0]).why === 'an old note');
ok('…until that answer is written, even to nothing', entryOf(rowsOf([{ ...legacy, journal: { [trade.id]: { why: '' } } }])[0]).why === '');
ok('an entry’s tags are keys a cut can ask for', tagKeysOf(entryOf(rt)).join('|') === 'setup:Bounce off a wall|mistake:Chased it|mistake:Too big|plan:no');
ok('a cut by tag, by words, by result and by way', inCut(rt, { ...CUT_AT_REST, tags: ['mistake:Too big'] }) && !inCut(rt, { ...CUT_AT_REST, tags: ['none'] }) && inCut(rt, { ...CUT_AT_REST, find: 'PUT WALL' }) && !inCut(rt, { ...CUT_AT_REST, find: 'nowhere' }) && inCut(rt, { ...CUT_AT_REST, way: 'up' }) && !inCut(rt, { ...CUT_AT_REST, way: 'down' }) && inCut(rt, { ...CUT_AT_REST, notes: 'written' }) && !inCut(opt, { ...CUT_AT_REST, notes: 'written' }));
ok('a cut by name', inCut(opt, { ...CUT_AT_REST, name: 'SPY' }) && !inCut(opt, { ...CUT_AT_REST, name: 'QQQ' }));
const cut = { ...CUT_AT_REST, session: 'o', result: 'lost' as const, tags: ['setup:Bounce off a wall', 'plan:no'], find: 'put wall' };
ok('the cut rides an address and comes back the same', JSON.stringify(cutFromQuery(cutToQuery(cut))) === JSON.stringify(cut) && cutToQuery(CUT_AT_REST) === '', cutToQuery(cut));
ok('an address that is not ours is the cut at rest', JSON.stringify(cutFromQuery('?result=sideways&kind=bonds')) === JSON.stringify(CUT_AT_REST));

/* ---- the file ---- */
const csv = csvOf([rt, opt], r => ({ best: excursionOf(r).best.pnl, worst: excursionOf(r).worst.pnl }));
const lines = csv.split('\r\n');
ok('the file is a head and a line a trade', lines.length === 3 && lines[0].startsWith('Closed (New York),'));
ok('words with a comma or a quote in them stay one cell', lines[1].includes('"The name held the put wall, twice."') && lines[1].includes('"Wait for the ""second"" touch"') && wordsOf(entryOf(rt)).includes('twice'));

/* ---- THE FRONT PAGE'S FIGURES (journalFigures.ts, 2026-09-25): the period, the month, the days, the running total, the cuts ---- */
{
  const at = (d: string, hhmm: string) => new Date(`${d}T${hhmm}:00-04:00`).getTime();
  let n = 0;
  /* a closed paper option — only what the figures read of it: a call is a way up, a put a way down */
  const paper = (acct: string, d: string, hhmm: string, pnl: number, up = true, ticker = 'SPY'): JournalRow =>
    ({ key: `${acct}:${++n}`, s: { id: acct, name: acct }, t: { id: `t${n}`, contract: { ticker, strike: 500, right: up ? 'C' : 'P', expiry: d }, pnl, r: null, qty: 1, heldMin: 10, opened: { at: at(d, hhmm) - 600_000, day: d }, closed: { at: at(d, hhmm), day: d }, how: 'sold', legs: [] }, paper: true }) as unknown as JournalRow;
  const rows = [
    paper('a', '2026-09-21', '09:45', 120),
    paper('a', '2026-09-21', '10:05', -80, false),
    paper('b', '2026-09-22', '11:15', 300, true, 'QQQ'),
    paper('a', '2026-09-23', '14:30', -500),
    paper('a', '2026-09-23', '14:30', 40, false, 'QQQ'),
    paper('b', '2026-08-31', '13:00', 60),
  ];
  const wed = '2026-09-23';
  ok('a week is Sunday to Saturday of today’s; a month and a year are theirs; all time is every day', JSON.stringify(spanOf('week', wed)) === JSON.stringify({ from: '2026-09-20', to: '2026-09-26' }) && spanOf('month', wed)!.from === '2026-09-01' && spanOf('year', wed)!.to === '2026-12-31' && spanOf('all', wed) === null && spanOf('today', wed)!.from === wed);
  ok('the period takes in its days, and the account its own', rowsIn(rows, spanOf('month', wed)).length === 5 && rowsIn(rows, spanOf('week', wed), 'b').length === 1 && rowsIn(rows, null).length === 6);
  const weeks = monthWeeks('2026-09');
  ok('September 2026 lays out Sunday to Saturday: Tuesday the 1st, five weeks, the last ending on Wednesday the 30th', weeks.length === 5 && weeks[0][1] === null && weeks[0][2] === '2026-09-01' && weeks[4][3] === '2026-09-30' && weeks[4][4] === null && weeks.every(w => w.length === 7));
  ok('a day is the CALENDAR day it closed on, New York’s — a trade closed after Friday’s bell is Friday’s, not Monday’s', calendarDayOf(paper('a', '2026-09-25', '21:03', 10)) === '2026-09-25' && runsOf(rows).wins === 2 && runsOf(rows).losses === 1 && grossOf(rows).made === 520 && grossOf(rows).lost === -580);
  const totals = dayTotals(rows);
  ok('a day is what closed on it: its total, how many, how many won', totals.get('2026-09-21')?.net === 40 && totals.get('2026-09-21')?.n === 2 && totals.get('2026-09-21')?.wins === 1 && totals.get('2026-09-23')?.net === -460);
  const run = runningOf(rowsIn(rows, spanOf('month', wed)));
  ok('the running total starts from nothing, adds each trade in the order they closed, and ends on the period’s total', run[0].value === 0 && run.length === 6 && run[run.length - 1].value === -120 && run.every((p, i) => i === 0 || p.time > run[i - 1].time));
  ok('…how far under its best it stood is never above nothing, and nothing at a new best', run.every(p => p.drop <= 0) && run.find(p => p.value === 340)?.drop === 0 && run[run.length - 1].drop === -460);
  const size = bySize(rows);
  ok('the sizes: every trade in one lane, cut at a round step', size.lanes.reduce((x, l) => x + l.n, 0) === rows.length && [1, 2, 5].includes(size.step / 10 ** Math.floor(Math.log10(size.step))) && size.lanes.find(l => l.key === 'lost-big')?.n === 1, `step ${size.step}`);
  const wk = byWeekday(rows);
  ok('the weekdays: always five, adding up to the whole', wk.length === 5 && wk.reduce((x, l) => x + l.n, 0) === rows.length && wk.find(l => l.label === 'Wed')?.net === -460);
  const side = bySide(rows);
  ok('the way it needed: calls up, puts down, adding up', side[0].n + side[1].n === rows.length && side[1].n === 2 && side[1].net === -40);
  const hrs = byHour(rows);
  ok('the hours: New York’s, in the order of the day, from when it was OPENED (the 10:05 close was opened at 09:55)', hrs.map(l => l.label).join(',') === '09:00,11:00,12:00,14:00' && hrs[0].n === 2 && hrs.reduce((x, l) => x + l.n, 0) === rows.length, hrs.map(l => l.label).join(','));
  ok('the names: the most traded first', byName(rows)[0].label === 'SPY' && byName(rows)[0].n === 4);
}

console.log(misses ? `\n${misses} MISSED` : '\nall rules hold');
process.exit(misses ? 1 : 0);
