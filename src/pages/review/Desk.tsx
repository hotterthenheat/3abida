/*
==================================================
  SLAYER TERMINAL - REVIEW › BACKTEST · THE OPTIONS DESK
  (pages/review/Desk.tsx)

  One session, replayed. The grammar is the one Noah
  liked elsewhere (a replayed chart, an order ticket,
  orders / open / closed) — built for OPTIONS, which
  is the part nobody else does:

    the account         what it is worth, as the clock stands
    the tape            the name's candles up to the clock,
                        the replay bar floating at its foot
    the chain           AS IT STOOD that minute — the
                        expiries listed that day, bid and
                        ask, delta, the decay a day
    the ticket          buy to open / sell to close, market ·
                        limit · stop, a target and a stop
                        that ride the buy, size by risk
    positions · orders · closed trades

  THE SHELL IS NOT HERE (2026-09-20, Noah: "lift it into
  one place"). The account strip, the tape with the house
  chart and its top row, the measured heights, the book's
  frame, the takeover with its panel, two charts side by
  side, the clock's bar and the keys are
  components/review/DeskShell.tsx — one shell for this
  desk and Paper's, with every ruling made on it in ITS
  head note. This file says what an OPTIONS desk
  is: its names and their tapes, what is drawn over them,
  the chain, the ticket, the bell, and the book's rows.

  WHAT NOAH ASKED OF THE FIRST CUT (2026-09-20):
    · "the current open position should be within the
      chart like how tradingview… looks" — the entry,
      the target and the stop are lines ON the tape
      with chips that close and drag (PositionLayer);
    · "each strike has its own dropdown", the Weigher's
      — a strike opens onto its Stats and its Greeks as
      they stood (ContractDrill), and its ticket;
    · the full screen "with the options chain being a
      side panel" — the shell's takeover; the chain and
      the ticket are its panel.

  THE TICKET NEVER LEAVES (Noah, 2026-09-20, with two
  pictures of the panel: "when i use the dropdown the
  ticket is gone because the length of the options
  chain gets longer"). The chain grew by its open
  strike's 300px and pushed the ticket off the screen —
  the one thing the strike was opened FOR. So THE CHAIN
  IS A WINDOW: its head and its column names stay, its
  rows scroll inside, a strike's drop-down opens INSIDE
  the window and is scrolled into view, and the ticket
  sits under it where it always was. On the page the
  window is as tall as the tape beside it; in the
  takeover it takes whatever the ticket leaves. Being a
  window it can hold more strikes (twelve a side), and
  it is laddered off THE DAY'S OPEN, not the last
  price — rows that re-centre every time the name
  crosses a strike slide out from under the pointer.
  It is never shorter than CHAIN_MIN_PX, however tall the
  ticket, and never taller than every strike it holds.

  WHAT THE TAPE KEEPS: the intervals a one-minute tape can
  make (1m to 1D), and the overlays that read BARS —
  volume, the session's levels, the expected move (priced
  off the day's own vol, for the minutes the CLOCK has
  left), realised against implied. What needs the book is
  left out: a replayed tape has none yet.

  THE BELL IS SAID ("there should be some sort of alert
  telling the user that the options day is over because
  unlike futures they have a closing window") —
  components/review/BellNotice: a line over the tape for
  the last fifteen minutes, a card at 16:00 with what the
  bell did to the book and the door to the next day. With
  the clock on the bell the market is SHUT: the engine
  refuses a market order in words, the × on a position
  and the book's Close wait.

  TWO NAMES ON ONE DESK ("2 [tickers]… that display at
  the bottom"). A session may hold two names on one clock
  and one account. THE BOOK LISTS BOTH, so a row of the
  other name is a door to it with that contract in hand;
  there is only ever ONE chain — the name's on the desk,
  which says whose it is in the silver the chart on the
  desk wears. The bell, the account and the report are
  the session's, not a name's.

  THE READER'S OWN RULES, AS HARD BLOCKS (his word). They
  were chosen when the session began; the account strip
  says them, where each stands ("1 of 2 open"), and — in
  the warn ink — that the day is over when its stop has
  been reached. The ticket refuses a buy that breaks one,
  in the engine's words; nothing here stops a way out.
==================================================
*/

import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { X } from 'lucide-react';
import type { ChartOverlays, ChartTape } from '../../components/gex/StrikeChart';
import { TraceGrid } from '../../components/trace/TraceBox';
import ContractLabel from '../../components/ui/ContractLabel';
import type { DropdownOption } from '../../components/ui/DropdownSelect';
import type { Column } from '../../components/ui/DataTable';
import ChainCard, { CHAIN_MIN_PX } from '../../components/review/ChainCard';
import DeskShell, { DeskMissing, card, head, headWord, smallDoor, type DeskName } from '../../components/review/DeskShell';
import { ChainOrder } from '../../components/paper/OptionsChain';
import { BellCard, ClosingLine, type BellFacts } from '../../components/review/BellNotice';
import type { ChartBracket, ChartEntry, ChartPosition } from '../../components/review/PositionLayer';
import { dirInk, momentWords, pct, rWords, usd, usdSigned } from '../../components/review/words';
import { accountOf, bankedOf, dayStateOf, floorOf, ladderRoom, ladderTake, nameGoesUp, namesOf, refusal, statsOf, type Account, type Order, type Trade } from '../../data/review/engine';
import PnlBadges from '../../components/review/PnlBadges';
import { chainAt, contractDay, contractKey, contractWords, dteAt, expiriesAt, longLeg, quoteAt, quoteWith, spotForAsk, spotForBid, type ContractId, type Right } from '../../data/review/quotes';
import { amendOrder, attachBracket, breakevenOrder, cancelOrder, closePosition, moveClock, placeOrder, readSessions, rebaseOrder, renameSession, trailOrder, useSession } from '../../data/review/store';
import { DAY_MIN, LAST_MIN, baseIvAt, clockWords, dayBars, dayWords, nextDay, prevDay, reviewName } from '../../data/review/tape';
import type { Timeframe } from '../../data/timeframe';
import type { Candle } from '../../types/market';
import type { KeyLevels } from '../../types/gex';

/* THE CHART'S SETTINGS ON THIS DESK. The intervals a one-minute tape can make (no 15s: there are no seconds to fold; no
   weekly: the sessions kept behind the clock are too few weeks). The overlays that read BARS — the rest need the book, and a
   replayed tape has none yet, so their switches are not offered. */
const REVIEW_TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '30m', '1h', '1D'];
const REVIEW_OVERLAY_KEYS: (keyof ChartOverlays)[] = ['volume', 'session', 'cone', 'volDrift'];
/** Sessions kept behind the clock's day — what the daily candles, a 50-bar average and yesterday's levels are made from */
const CONTEXT_DAYS = 20;
type Tab = 'open' | 'orders' | 'closed';
/** Strikes each side of the ladder's centre — the chain is a window, so it can hold more than it shows */
const CHAIN_EACH = 12;
/** The last minutes of a session the desk counts down */
const CLOSING_MIN = 15;

const Desk = () => {
  const { id } = useParams();
  const session = useSession(id);
  /** The closing line and the bell's card, put away — for that day only */
  const [closingSeen, setClosingSeen] = useState('');
  const [bellSeen, setBellSeen] = useState('');
  const [right, setRight] = useState<Right>('C');
  const [expiry, setExpiry] = useState<string | null>(null);
  const [picked, setPicked] = useState<ContractId | null>(null);
  const [tab, setTab] = useState<Tab>('open');
  /** The picked strike's drop-down: open on a pick, folded by a second press on the same row */
  const [drillOpen, setDrillOpen] = useState(true);
  /** The desk's one size — the Order card's (the paper desk's grammar) */
  const [q, setQ] = useState(1);
  /** What the last press on the ticket did, said in the ticket (the audit's PR-9) */
  const [said, setSaid] = useState<string | null>(null);
  /** The takeover is up — the shell's, held here because the chain's window reads it */
  const [full, setFull] = useState(false);
  const cursor = session?.cursor ?? null;
  /* THE NAME ON THE DESK: one of the session's (two at most); the other keeps running on the same clock */
  const names = useMemo(() => (session ? namesOf(session) : ['SPY']), [session?.ticker, session?.tickers]); // eslint-disable-line react-hooks/exhaustive-deps
  const [activeName, setActiveName] = useState('');
  const ticker = names.includes(activeName) ? activeName : names[0];
  /** To a name — with a contract in hand when the door was a row of the book */
  const switchTo = (to: string, contract: ContractId | null = null) => {
    if (to === ticker && !contract) return; // already on the desk: the contract in hand stays in hand
    if (to !== ticker) {
      setActiveName(to);
      setExpiry(null);
    }
    setPicked(contract);
    if (contract) {
      setRight(contract.right);
      setExpiry(contract.expiry);
      setDrillOpen(true);
    }
  };
  const account = useMemo<Account | null>(() => (session ? accountOf(session) : null), [session]);

  /* the expiries listed today; the one in hand gives way to the next once it has passed */
  const expiries = useMemo(() => (cursor ? expiriesAt(ticker, cursor.day) : []), [ticker, cursor?.day]); // eslint-disable-line react-hooks/exhaustive-deps
  const exp = expiry && expiries.some(e => e.iso === expiry) ? expiry : (expiries.find(e => e.dte >= 5) ?? expiries[0])?.iso ?? null;
  const expiryOptions = useMemo<DropdownOption<string>[]>(() => expiries.map(e => ({ value: e.iso, label: `${e.label} · ${e.dte}d`, hint: e.dte === 0 ? 'Expires at today’s bell' : `${e.kind === 'monthly' ? 'The monthly' : e.kind === 'daily' ? 'A daily' : 'A weekly'} · ${dayWords(e.iso, true)}` })), [expiries]);
  /* laddered off the day's open (it stays put); only a name that has run most of the ladder away re-centres it */
  const chain = useMemo(() => {
    if (!cursor || !exp) return null;
    const open = dayBars(ticker, cursor.day)[0]?.open;
    const now = dayBars(ticker, cursor.day)[cursor.minute]?.close;
    const step = reviewName(ticker).step;
    const centre = open != null && now != null && Math.abs(now - open) <= step * (CHAIN_EACH - 4) ? open : undefined;
    return chainAt(ticker, cursor.day, cursor.minute, exp, CHAIN_EACH, centre);
  }, [ticker, cursor?.day, cursor?.minute, exp]); // eslint-disable-line react-hooks/exhaustive-deps
  /* THE TAPE EACH CHART DRAWS: the sessions behind the clock's day, whole, then today up to the clock — never a bar past it.
     By name: one chart on the page, two side by side in the takeover. */
  const contextBy = useMemo<Record<string, Candle[]>>(() => {
    if (!cursor) return {};
    const days: string[] = [];
    for (let d = prevDay(cursor.day); d && days.length < CONTEXT_DAYS; d = prevDay(d)) days.push(d);
    days.reverse();
    return Object.fromEntries(names.map(n => [n, days.flatMap(d => dayBars(n, d))]));
  }, [names, cursor?.day]); // eslint-disable-line react-hooks/exhaustive-deps
  const tapeBy = useMemo<Record<string, ChartTape>>(() => (cursor ? Object.fromEntries(names.map(n => [n, { bars: [...(contextBy[n] ?? []), ...dayBars(n, cursor.day).slice(0, cursor.minute + 1)], iv: baseIvAt(n, cursor.day), key: `review:${n}`, clock: 'ny' as const }])) : {}), [contextBy, names, cursor?.day, cursor?.minute]); // eslint-disable-line react-hooks/exhaustive-deps
  const fillsBy = useMemo(() => Object.fromEntries(names.map(n => [n, session ? session.fills.filter(f => f.contract.ticker === n) : []])), [session?.fills, names]); // eslint-disable-line react-hooks/exhaustive-deps
  const pickedQuote = useMemo(() => (cursor && picked ? quoteAt(picked, cursor.day, cursor.minute) : null), [picked, cursor?.day, cursor?.minute]); // eslint-disable-line react-hooks/exhaustive-deps
  /* a strike's drop-down is that strike's — the bought leg of a spread, not the pair */
  const pickedDay = useMemo(() => (cursor && picked && drillOpen ? contractDay(longLeg(picked), cursor.day, cursor.minute) : null), [picked, drillOpen, cursor?.day, cursor?.minute]); // eslint-disable-line react-hooks/exhaustive-deps
  /* THE POSITION ON THE CHART: where it was entered, and — for what rides it — where the name would have to stand, at this
     minute, for the contract to bid the order's price */
  const positionsBy = useMemo<Record<string, ChartPosition[]>>(() => Object.fromEntries(names.map(n => [n, account ? account.positions.filter(p => p.contract.ticker === n).map(p => ({ key: p.key, contract: p.contract, qty: p.qty, spotIn: p.spotIn, pnl: p.pnl, r: p.r, avg: p.avg, bid: p.quote.bid, dead: p.quote.dead, room: session ? ladderRoom(session, p.contract) : undefined, take: session ? ladderTake(session, p.contract) : undefined })) : []])), [account, names]); // eslint-disable-line react-hooks/exhaustive-deps
  const bracketsBy = useMemo<Record<string, ChartBracket[]>>(() => {
    const out: Record<string, ChartBracket[]> = Object.fromEntries(names.map(n => [n, [] as ChartBracket[]]));
    if (!session || !account) return out;
    const { day, minute } = session.cursor;
    for (const o of session.orders) {
      if (o.status !== 'working' || o.side !== 'sell' || o.price == null || o.kind === 'market') continue;
      const list = out[o.contract.ticker];
      const pos = account.positions.find(p => p.key === contractKey(o.contract));
      if (!list || !pos) continue;
      /* WHAT IT WAITS ON. The contract's price: its dollars hold, and its line is wherever the name would have to stand
         THIS minute. The name's price: its line holds, and its dollars are what the contract would bid there THIS minute. */
      const onName = o.on === 'name';
      const level = onName ? o.price : spotForBid(o.contract, day, minute, o.price);
      const sellsAt = onName ? quoteWith(o.contract, day, minute, o.price).bid : o.price;
      /* further off than the name's expected day (its vol that day, one sigma): no room on the scale for it */
      const here = pos.quote.spot;
      const reach = here * (baseIvAt(o.contract.ticker, day) / Math.sqrt(252));
      list.push({ orderId: o.id, kind: o.kind === 'stop' ? 'stop' : 'target', on: onName ? 'name' : 'contract', contract: o.contract, qty: o.qty, price: o.price, level, money: (sellsAt - pos.avg) * 100 * o.qty, edge: nameGoesUp(o.kind, o.contract.right) ? 'up' : 'down', far: level == null || Math.abs(level - here) > reach, trail: o.kind === 'stop' ? (o.trail ?? null) : undefined, trailNow: o.kind === 'stop' ? Math.max(0.01, onName ? Math.abs(here - o.price) : pos.quote.bid - o.price) : undefined, breakeven: !!o.breakeven, canBreakeven: !!o.oco && session.orders.some(x => x.status === 'working' && x.oco === o.oco && x.kind === 'limit') });
    }
    const KEY = (b: ChartBracket) => contractKey(b.contract);
    /* THE LADDER: where a position has more than one level of a kind, each says which it is — the nearest first */
    for (const list of Object.values(out)) {
      const groups = new Map<string, ChartBracket[]>();
      for (const b of list) groups.set(`${KEY(b)}|${b.kind}`, [...(groups.get(`${KEY(b)}|${b.kind}`) ?? []), b]);
      /* by how far each stands, a contract — a far level of one contract is not nearer than a near level of two */
      for (const g of groups.values()) if (g.length > 1) [...g].sort((x, y) => Math.abs(x.money) / x.qty - Math.abs(y.money) / y.qty).forEach((b, i) => (b.nth = i + 1));
    }
    return out;
  }, [session, account, names]);

  /* THE RESTING ORDERS THAT ARE NOT WAYS OUT — a buy waiting at a price, said as such on the chart ("1 · Buy limit · 480C
     @ 1.20", PositionLayer): where the name would have to stand, this minute, for the contract's ask to come down to it */
  const entriesBy = useMemo<Record<string, ChartEntry[]>>(() => {
    const out: Record<string, ChartEntry[]> = Object.fromEntries(names.map(n => [n, [] as ChartEntry[]]));
    if (!session) return out;
    const { day, minute } = session.cursor;
    for (const o of session.orders) {
      if (o.status !== 'working' || o.side !== 'buy' || o.price == null || o.kind === 'market') continue;
      const list = out[o.contract.ticker];
      if (!list) continue;
      const c = o.contract;
      const here = dayBars(c.ticker, day)[minute]?.close ?? reviewName(c.ticker).px;
      const level = spotForAsk(c, day, minute, o.price);
      const reach = here * (baseIvAt(c.ticker, day) / Math.sqrt(252));
      list.push({ orderId: o.id, side: 'buy', kind: o.kind === 'stop' ? 'stop' : 'limit', qty: o.qty, price: o.price, level, label: contractWords(c).replace(`${c.ticker} `, ''), edge: (o.kind === 'stop') === (c.right === 'C') ? 'up' : 'down', far: level == null || Math.abs(level - here) > reach, priceAt: at => Math.max(0.01, Math.round(quoteWith(c, day, minute, at).ask * 100) / 100) });
    }
    return out;
  }, [session, names]);

  /* ---- the blotter's columns ---- */
  const openCols = useMemo<Column<Account['positions'][number]>[]>(
    () => [
      { key: 'contract', header: 'Contract', render: p => <ContractLabel contract={contractWords(p.contract)} right={p.contract.right} logo={p.contract.ticker} size="sm" /> },
      { key: 'qty', header: 'Held', align: 'right', render: p => <span className="text-textPrimary">{p.qty}</span> },
      { key: 'exp', header: 'Expires', render: p => <span className="text-textSecondary">{dayWords(p.contract.expiry)} · {session ? dteAt(session.cursor.day, p.contract.expiry) : 0}d</span> },
      { key: 'avg', header: 'Paid', align: 'right', render: p => <span className="text-textSecondary">{p.avg.toFixed(2)}</span> },
      { key: 'mark', header: 'Bid · ask', align: 'right', render: p => <span className="text-textPrimary">{p.quote.bid.toFixed(2)} · {p.quote.ask.toFixed(2)}</span> },
      { key: 'theta', header: 'Decay a day', align: 'right', render: p => <span className="text-textSecondary">{usd(Math.abs(p.quote.theta) * 100 * p.qty)}</span> },
      { key: 'pnl', header: 'P&L', align: 'right', render: p => <span className={`font-semibold ${dirInk(p.pnl)}`}>{usdSigned(p.pnl)} <span className="text-[10px] font-normal text-textSecondary">{rWords(p.r)}</span></span> },
      {
        key: 'close',
        header: '',
        align: 'right',
        render: p => (
          <button type="button" onClick={() => id && closePosition(id, p.contract, p.qty)} disabled={p.quote.dead || (session?.cursor.minute ?? 0) >= LAST_MIN} title={(session?.cursor.minute ?? 0) >= LAST_MIN ? 'The market is shut — open the next day' : p.quote.dead ? 'No bid to sell into right now' : 'Sell all of it at the bid, now'} className={smallDoor} data-position-close={p.key}>
            Close
          </button>
        ),
      },
    ],
    [id, session]
  );
  const orderCols = useMemo<Column<Order>[]>(
    () => [
      { key: 'contract', header: 'Contract', render: o => <ContractLabel contract={contractWords(o.contract)} right={o.contract.right} logo={o.contract.ticker} size="sm" /> },
      { key: 'what', header: 'Order', render: o => <span className="text-textPrimary">{o.side === 'buy' ? 'Buy' : 'Sell'} {o.qty} · {o.kind === 'market' ? 'market' : o.on === 'name' ? `${o.kind === 'limit' ? 'when' : 'if'} ${o.contract.ticker} ${o.kind === 'limit' ? 'reaches' : nameGoesUp(o.kind, o.contract.right) ? 'rises to' : 'falls to'} ${o.price?.toFixed(2)}` : o.kind === 'limit' ? `limit ${o.price?.toFixed(2)}` : `stop ${o.price?.toFixed(2)}`}{o.oco ? <span className="text-textMuted"> · rides the buy</span> : null}{o.trail != null ? <span className="text-textMuted"> · trails by {o.trail.toFixed(2)}</span> : null}{o.breakeven ? <span className="text-textMuted"> · to what you paid after the first target</span> : null}{o.moved ? <span className="text-textMuted"> · moved to what you paid</span> : null}</span> },
      { key: 'placed', header: 'Placed', render: o => <span className="text-textSecondary">{momentWords(o.placed)}</span> },
      {
        key: 'status',
        header: 'Stands',
        render: o =>
          o.status === 'working' ? <span className="text-silver font-semibold">Working · {o.tif === 'day' ? 'today only' : 'until cancelled'}</span> : o.status === 'filled' ? <span className="text-textPrimary">Filled at {o.fillPrice?.toFixed(2)}</span> : <span className="text-textMuted">{o.status === 'refused' ? `Refused — ${o.why}` : o.why === 'cancelled by you' ? 'Cancelled by you' : `Cancelled — ${o.why}`}</span>,
      },
      {
        key: 'cancel',
        header: '',
        align: 'right',
        render: o =>
          o.status === 'working' ? (
            <button type="button" onClick={() => id && cancelOrder(id, o.id)} title="Cancel this order" aria-label="Cancel this order" className="inline-flex items-center justify-center w-6 h-6 rounded text-textMuted hover:text-bear hover:bg-ink/[0.06] transition-colors" data-order-cancel={o.id}>
              <X className="w-3 h-3" />
            </button>
          ) : null,
      },
    ],
    [id]
  );
  const closedCols = useMemo<Column<Trade>[]>(
    () => [
      { key: 'contract', header: 'Contract', render: t => <ContractLabel contract={contractWords(t.contract)} right={t.contract.right} logo={t.contract.ticker} size="sm" /> },
      { key: 'qty', header: 'Size', align: 'right', render: t => <span className="text-textPrimary">{t.qty}</span> },
      { key: 'in', header: 'In', render: t => <span className="text-textSecondary">{momentWords(t.opened)} · {t.avgIn.toFixed(2)}</span> },
      { key: 'out', header: 'Out', render: t => <span className="text-textSecondary">{momentWords(t.closed)} · {t.avgOut.toFixed(2)}</span> },
      { key: 'how', header: 'Ended', render: t => <span className="text-textSecondary">{t.how === 'scaled' ? 'Scaled out' : t.how === 'sold' ? 'Sold by you' : t.how === 'target' ? 'Target hit' : t.how === 'stopped' ? 'Stopped out' : 'Held to the bell'}</span> },
      { key: 'pnl', header: 'P&L', align: 'right', render: t => <span className={`font-semibold ${dirInk(t.pnl)}`}>{usdSigned(t.pnl)} <span className="text-[10px] font-normal text-textSecondary">{rWords(t.r)}</span></span> },
    ],
    []
  );

  if (!session || !cursor || !account) return <DeskMissing />;

  const spotOf = (n: string) => dayBars(n, cursor.day)[cursor.minute]?.close ?? reviewName(n).px;
  const spot = spotOf(ticker);
  const stats = statsOf(account.trades);
  const floor = floorOf(session);
  const tomorrow = nextDay(cursor.day);
  const working = session.orders.filter(o => o.status === 'working');
  const orders = [...working, ...session.orders.filter(o => o.status !== 'working').reverse()].slice(0, 40);
  /* THE READER'S OWN RULES, and where each stands */
  const rules = session.rules;
  const dayState = rules?.dailyLossPct ? dayStateOf(session) : null;
  const rulesLine =
    rules && (rules.maxOpen || rules.maxRiskPct || rules.dailyLossPct) ? (
      <span className="inline-flex items-center gap-x-2 gap-y-0.5 flex-wrap" data-review-rules>
        {rules.maxOpen ? (
          <span className={account.positions.length >= rules.maxOpen ? 'text-warn' : 'text-textPrimary'} title="Positions open at once — a buy that would open another is refused">
            {account.positions.length} of {rules.maxOpen} open
          </span>
        ) : null}
        {rules.maxRiskPct ? (
          <span className="text-textPrimary" title="The most one trade may cost, as a share of what the account is worth">
            {rules.maxRiskPct * 100}% a trade · {usd(account.equity * rules.maxRiskPct, 0)}
          </span>
        ) : null}
        {rules.dailyLossPct && dayState ? (
          <span className={dayState.stopped ? 'text-warn font-semibold' : 'text-textPrimary'} title="Measured from what the account was worth at the open — no new positions once it is reached, until the next open" data-review-day-stop={dayState.stopped ? 'reached' : 'standing'}>
            {dayState.stopped ? `the day is over · ${(dayState.pct * 100).toFixed(1)}%` : `day ${dayState.pct >= 0 ? '+' : ''}${(dayState.pct * 100).toFixed(1)}% · stops at −${rules.dailyLossPct * 100}%`}
          </span>
        ) : null}
      </span>
    ) : null;
  /* THE BELL: the last fifteen minutes are counted down, and 16:00 is said (components/review/BellNotice) */
  const atBell = cursor.minute >= LAST_MIN;
  const minutesLeft = LAST_MIN - cursor.minute;
  const expiringToday = account.positions.filter(p => p.contract.expiry === cursor.day).map(p => contractWords(p.contract));
  const rungNow = (m?: { day: string; minute: number }) => !!m && m.day === cursor.day && m.minute >= LAST_MIN;
  const bellFacts: BellFacts | null = atBell
    ? {
        dayWords: dayWords(cursor.day, true).split(',').slice(0, 2).join(','),
        dayOrders: session.orders.filter(o => o.status === 'cancelled' && o.why === 'the day ended' && rungNow(o.done)).length,
        settled: session.fills.filter(f => f.how === 'expired' && rungNow(f.at)).map(f => ({ contract: contractWords(f.contract), price: f.price, pnl: account.trades.find(t => t.how === 'expired' && rungNow(t.closed) && contractKey(t.contract) === contractKey(f.contract))?.pnl ?? null })),
        carried: account.positions.length,
        working: working.length,
      }
    : null;
  const bidAtSpot = (c: ContractId, at: number) => quoteWith(c, cursor.day, cursor.minute, at).bid;
  const pickRow = (c: ContractId) => {
    const same = picked != null && contractKey(longLeg(picked)) === contractKey(c);
    setDrillOpen(same ? !drillOpen : true);
    setPicked(c);
    setSaid(null);
  };
  /* the chart keeps the walls on screen when it has them; a replayed tape has no book, so only where the name stands */
  const levelsOf = (n: string): KeyLevels => ({ spot: spotOf(n), callWall: NaN, putWall: NaN, flip: NaN, supreme: NaN });
  /* THE NAMES, AS THE SHELL READS THEM: each with its tape, and what is drawn over it */
  const deskNames: DeskName[] = names.map(n => {
    const px = spotOf(n);
    const open = dayBars(n, cursor.day)[0]?.open ?? px;
    return {
      symbol: n,
      title: reviewName(n).name,
      label: n,
      priceWords: px.toFixed(2),
      dayPct: ((px - open) / open) * 100,
      held: account.positions.filter(q => q.contract.ticker === n).length,
      tape: tapeBy[n],
      levels: levelsOf(n),
      layer: {
        fills: fillsBy[n] ?? [],
        positions: positionsBy[n] ?? [],
        brackets: bracketsBy[n] ?? [],
        entries: entriesBy[n] ?? [],
        marketShut: atBell,
        onClosePosition: (c, q) => closePosition(session.id, c, q),
        onAmend: (oid, px2) => amendOrder(session.id, oid, px2),
        onRebase: (oid, to) => rebaseOrder(session.id, oid, to),
        onCancelOrder: oid => cancelOrder(session.id, oid),
        onAttach: (c, kind, px2, onWhat) => attachBracket(session.id, c, kind, px2, onWhat),
        onTrail: (oid, on, by) => trailOrder(session.id, oid, on, by),
        onBreakeven: (oid, on) => breakevenOrder(session.id, oid, on),
        bidAtSpot,
      },
      /* RP&L · UP&L: what the name has banked on the clock's day, and what is open on it */
      corner: (
        <PnlBadges
          name={n}
          realized={bankedOf(session, n) - bankedOf(session, n, cursor.day)}
          unrealized={account.positions.filter(q => q.contract.ticker === n).reduce((x, q) => x + q.pnl, 0)}
          dayWord={`on ${dayWords(cursor.day)}, the clock’s day`}
        />
      ),
    };
  });

  /* ---- THE CHAIN, AS IT STOOD — a strike opens onto its stats and its greeks (components/review/ChainCard) ---- */
  /* held: the contract itself, or the bought leg of a spread; sold: the other leg of one (open, or on the ticket) */
  const legOf = (p: ContractId) => p.ticker === ticker && p.expiry === exp && p.right === right;
  const chainCard = (
    <ChainCard
      ticker={ticker}
      title={reviewName(ticker).name}
      spot={chain?.spot ?? spot}
      showName={names.length > 1}
      stamp={`as it stood · ${clockWords(cursor.minute)}`}
      right={right}
      onRight={setRight}
      expiry={exp}
      expiryOptions={expiryOptions}
      onExpiry={setExpiry}
      expiryTitle="The expiries listed on this day"
      rows={chain?.rows ?? []}
      picked={picked}
      drillOpen={drillOpen}
      onPick={pickRow}
      drill={pickedDay}
      held={k => account.positions.some(p => legOf(p.contract) && p.contract.strike === k)}
      sold={k => account.positions.some(p => legOf(p.contract) && p.contract.short === k) || (picked != null && legOf(picked) && picked.short === k)}
      full={full}
      centreKey={`${exp}|${right}|${cursor.day}|${session.id}`}
    />
  );

  /* ---- THE TICKET ---- */
  const ticketCard = (
    <div className={`${card} min-w-0 shrink-0`} data-review-ticket-card>
      <div className={head}>
        <span className={headWord}>Order</span>
        {picked && (
          <button type="button" onClick={() => setPicked(null)} className="ml-auto font-mono text-[10px] text-textMuted hover:text-textPrimary transition-colors">
            Clear
          </button>
        )}
      </div>
      {/* THE ORDER IS THE PAPER DESK'S (components/paper/OptionsChain ChainOrder — 2026-09-26, Noah: "make the contract
          orders look the same on the backtesting section"): the same size row, the two
          buttons, the limit box, the spread, the brackets — fed the replayed minute's quotes and this session's refusals */}
      {picked && pickedQuote ? (
        <div className="px-4 pb-3" data-review-ticket={contractWords(picked)}>
          <ChainOrder
            /* a fill makes it a new order: what was just bought is now something to sell */
            key={`${contractKey(longLeg(picked))}|${session.fills.length}`}
            c={{ strike: picked.strike, right: picked.right }}
            ticker={picked.ticker}
            expiry={picked.expiry}
            spot={pickedQuote.spot}
            word={false}
            desk={{
              refuse: d => refusal(session, d),
              locked: null,
              quoteWith: (c, at) => quoteWith(c, cursor.day, cursor.minute, at),
              spotForBid: (c, bid) => spotForBid(c, cursor.day, cursor.minute, bid),
              fee: session.fee,
              free: account.cash,
              equity: account.equity,
              version: `${cursor.day}|${cursor.minute}|${session.fills.length}|${session.orders.length}`,
              q,
              onQ: setQ,
              heldAt: strike => {
                const p = account.positions.find(x => x.contract.ticker === picked.ticker && x.contract.expiry === picked.expiry && x.contract.right === picked.right && x.contract.strike === strike);
                return p ? { contract: p.contract, qty: p.qty, avg: p.avg, pnl: p.pnl, decayDay: Math.abs(quoteAt(p.contract, cursor.day, cursor.minute).theta) * 100 * p.qty } : null;
              },
              strikes: picked.ticker === ticker && picked.expiry === exp ? (chain?.rows.map(r => r.strike) ?? []) : [],
              onShort: k => setPicked(k ? { ...longLeg(picked), short: k } : longLeg(picked)),
              onPlace: d => {
                placeOrder(session.id, d);
                const o = readSessions().find(x => x.id === session.id)?.orders.slice(-1)[0];
                const what = o ? `${o.qty} × ${contractWords(o.contract)}` : '';
                setSaid(!o ? null : o.status === 'refused' ? `Refused — ${o.why}` : o.status === 'filled' ? `${o.side === 'buy' ? 'Bought' : 'Sold'} ${what} at ${o.fillPrice?.toFixed(2)}` : `Working — ${o.side} ${what} at ${o.price?.toFixed(2)} or better`);
                setTab(d.kind === 'market' ? (d.side === 'buy' ? 'open' : 'closed') : 'orders');
              },
              said,
              onClose: (c, n) => {
                closePosition(session.id, c, n);
                setTab('closed');
              },
            }}
          />
        </div>
      ) : (
        <div className="h-full min-h-[180px] flex items-center justify-center px-6 text-center font-mono text-[10px] uppercase tracking-widest text-textMuted" data-review-ticket="empty">
          Pick a contract in the chain — its order opens here
        </div>
      )}
    </div>
  );

  return (
    <DeskShell
      session={session}
      onRename={name => renameSession(session.id, name)}
      subline={`${names.map(n => reviewName(n).name).join(' and ')} · long calls and puts, paid in cash · ${session.fee ? `${usd(session.fee)} a contract each way` : 'no fee'}`}
      facts={[
        { label: 'Worth now', testId: 'equity', node: usd(account.equity) },
        { label: 'Cash', testId: 'cash', node: usd(account.cash) },
        { label: 'Open, up or down', testId: 'open-pnl', node: <span className={dirInk(account.openPnl)}>{usdSigned(account.openPnl)}</span> },
        { label: 'Closed, made or lost', testId: 'realized', node: <span className={dirInk(stats.net)}>{usdSigned(stats.net)}</span> },
        ...(rulesLine ? [{ label: 'Your rules', testId: 'rules', node: <span className="text-[12px] font-medium">{rulesLine}</span> }] : []),
        {
          label: 'Closed trades',
          testId: 'trades',
          node: (
            <>
              {stats.n} {stats.n > 0 && <span className="text-textMuted">· {pct(stats.winRate)} won</span>}
            </>
          ),
        },
      ]}
      account={{ equity: account.equity, openPnl: account.openPnl, third: { label: 'cash', value: usd(account.cash) } }}
      names={deskNames}
      active={ticker}
      onSwitch={n => switchTo(n)}
      switchLabel="The name on the desk"
      prefsKey="slayer_review_chart"
      paneIds={['review:main', 'review:second']}
      timeframes={REVIEW_TIMEFRAMES}
      overlayKeys={REVIEW_OVERLAY_KEYS}
      clock={{
        day: cursor.day,
        minute: cursor.minute,
        lastMin: LAST_MIN,
        dayMin: DAY_MIN,
        floorDay: floor.day,
        tomorrow,
        words: `${dayWords(cursor.day)} · ${clockWords(cursor.minute)}`,
        wordsAt: clockWords,
        move: to => moveClock(session.id, to),
      }}
      goToTitle="Jump the clock to the open of a later day — every day between is run"
      nextDayTitle="Ring today’s bell and open the next session"
      /* THE BELL — the last fifteen minutes as a line, 16:00 as a card; both can be put away for the day */
      notice={({ seek }) =>
        bellFacts ? (
          bellSeen !== cursor.day ? (
            <BellCard facts={bellFacts} onNextDay={tomorrow ? () => seek(0, tomorrow) : null} onDismiss={() => setBellSeen(cursor.day)} />
          ) : null
        ) : minutesLeft <= CLOSING_MIN && closingSeen !== cursor.day ? (
          <ClosingLine minutesLeft={minutesLeft} expiring={expiringToday} onDismiss={() => setClosingSeen(cursor.day)} />
        ) : null
      }
      full={full}
      onFull={setFull}
      side={
        <>
          {chainCard}
          {ticketCard}
        </>
      }
      sideMinPx={CHAIN_MIN_PX}
      panelWord="chain"
      panelTitle="The chain and the order"
      tab={tab}
      onTab={setTab}
      counts={{ open: account.positions.length, working: working.length, closed: account.trades.length }}
      book={
        tab === 'open' ? (
          <TraceGrid key="open" rows={account.positions} columns={openCols} rowKey={p => p.key} onRowClick={p => switchTo(p.contract.ticker, p.contract)} selectedKey={picked ? contractKey(picked) : null} autoHeight animate={false} noun="positions" widths={{ qty: 70, avg: 80, close: 84, mark: 130, theta: 120 }} emptyText="Nothing open — pick a contract in the chain" testId="review-open" />
        ) : tab === 'orders' ? (
          <TraceGrid key="orders" rows={orders} columns={orderCols} rowKey={o => o.id} onRowClick={o => switchTo(o.contract.ticker, o.contract.expiry >= cursor.day ? o.contract : null)} autoHeight animate={false} noun="orders" widths={{ cancel: 56 }} flexes={{ status: 2, what: 1.4 }} emptyText="No orders yet" testId="review-orders" />
        ) : (
          <TraceGrid key="closed" rows={[...account.trades].reverse()} columns={closedCols} rowKey={t => t.id} autoHeight animate={false} noun="trades" widths={{ qty: 70 }} flexes={{ in: 1.4, out: 1.4 }} emptyText="No closed trades yet" testId="review-closed" />
        )
      }
    />
  );
};

export default Desk;
