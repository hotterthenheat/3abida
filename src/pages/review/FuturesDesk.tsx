/*
==================================================
  SLAYER TERMINAL - REVIEW › BACKTEST · THE FUTURES DESK
  (pages/review/FuturesDesk.tsx)

  The same desk as an option's — the SHELL is one file
  for both (components/review/DeskShell.tsx: the account
  strip, the house chart and its top row, the measured
  heights, the takeover with its panel, two charts side
  by side, the clock's bar, the keys; every ruling made
  on it is in its head note). This file says what a
  FUTURE is (docs/review-futures-rules.md,
  data/review/futuresEngine.ts):

    no chain            one price. Where the chain was
                        is THE CONTRACT: what a point
                        and a tick are worth, the margin,
                        the day so far by its three
                        sessions, and what a stop of so
                        many points lets you hold
    long and short      the ticket says what a press
                        DOES to the position
    a plain chart layer a way out's price IS its line —
                        nothing drifts, nothing to pin
    a 23-hour day       18:00 to 17:00 New York; jumps to
                        09:30 (the key 9) and to the next
                        day's open; no 16:00 bell; the
                        clock's bar carries the day's own
                        marks, not an hour a mark
==================================================
*/

import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Sunrise, X } from 'lucide-react';
import type { ChartOverlays, ChartTape } from '../../components/gex/StrikeChart';
import { TraceGrid } from '../../components/trace/TraceBox';
import CompanyLogo from '../../components/ui/CompanyLogo';
import type { Column } from '../../components/ui/DataTable';
import DeskShell, { DeskMissing, barDoor, card, head, headWord, smallDoor, type DeskName } from '../../components/review/DeskShell';
import { FutOrderPanel } from '../../components/paper/OrderPanel';
import PnlBadges from '../../components/review/PnlBadges';
import type { ChartBracket, ChartEntry, ChartMark, ChartPosition } from '../../components/review/PositionLayer';
import { dirInk, pct, rWords, usd, usdSigned } from '../../components/review/words';
import { statsOf } from '../../data/review/engine';
import { futAccountOf, futBankedOf, futDayStateOf, futFloorOf, futLadderRoom, futLadderTake, futNamesOf, futRefusal, marginOf, feeOf, type FutAccount, type FutOrder, type FutTrade } from '../../data/review/futuresEngine';
import { FUT_DAY_MIN, FUT_LAST_MIN, FUT_RTH_OPEN_MIN, frontContract, futBarTime, futClockWords, futDayBars, futMomentWords, futPrice, futProduct, onTick } from '../../data/review/futuresTape';
import type { ContractId } from '../../data/review/quotes';
import { amendFutOrder, attachFutBracket, breakevenFutOrder, cancelFutOrder, closeFutPosition, moveFutClock, placeFutOrder, renameSession, trailFutOrder, useFutSession } from '../../data/review/store';
import { dayWords, nextDay, prevDay } from '../../data/review/tape';
import type { Timeframe } from '../../data/timeframe';
import type { Candle } from '../../types/market';
import type { KeyLevels } from '../../types/gex';

/* the intervals a one-minute tape of a 23-hour day can make (a daily candle would be cut by the calendar's midnight, not the
   trading day's); the overlays that read bars — the expected move and the vol pane are an option's */
const FUT_TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '30m', '1h'];
const FUT_OVERLAY_KEYS: (keyof ChartOverlays)[] = ['volume', 'session'];
/** Trading days kept behind the clock's day (1,380 bars each) */
const CONTEXT_DAYS = 5;
type Tab = 'open' | 'orders' | 'closed';
/** The least the contract's card keeps above the ticket */
const CARD_MIN_PX = 300;
/* THE DAY'S MARKS on the clock's bar, as shares of its 1,380 minutes: the evening open, midnight, Europe's morning, the
   stock market's open and close — an hour a mark (the options bar's way) is twenty-three of them */
const DAY_MARKS = [
  { u: 0, label: '18:00' },
  { u: 360 / 1380, label: '00:00' },
  { u: 720 / 1380, label: '06:00' },
  { u: 930 / 1380, label: '09:30' },
  { u: 1080 / 1380, label: '12:00' },
  { u: 1320 / 1380, label: '16:00' },
];
/** A future on the chart layer's terms: the layer's callbacks carry a contract, and a future is named by its product */
const pseudo = (symbol: string, long: boolean): ContractId => ({ ticker: symbol, strike: 0, right: long ? 'C' : 'P', expiry: '' });
const ENDED: Record<FutTrade['how'], string> = { closed: 'Closed by you', target: 'Target hit', stopped: 'Stopped out', rolled: 'Closed at the roll', scaled: 'Scaled out' };

const FuturesDesk = () => {
  const { id } = useParams();
  const session = useFutSession(id);
  const [tab, setTab] = useState<Tab>('open');
  /** The desk's one size — the Order card's (the paper desk's grammar) */
  const [q, setQ] = useState(1);
  /** The takeover is up — the shell's, held here because the contract's card reads it */
  const [full, setFull] = useState(false);
  const cursor = session?.cursor ?? null;
  const names = useMemo(() => (session ? futNamesOf(session) : ['ES']), [session?.ticker, session?.tickers]); // eslint-disable-line react-hooks/exhaustive-deps
  const [activeName, setActiveName] = useState('');
  const symbol = names.includes(activeName) ? activeName : names[0];
  const account = useMemo<FutAccount | null>(() => (session ? futAccountOf(session) : null), [session]);

  /* THE TAPE EACH CHART DRAWS: the trading days behind the clock's, whole, then today up to the clock — never a bar past it */
  const contextBy = useMemo<Record<string, Candle[]>>(() => {
    if (!cursor) return {};
    const days: string[] = [];
    for (let d = prevDay(cursor.day); d && days.length < CONTEXT_DAYS; d = prevDay(d)) days.push(d);
    days.reverse();
    return Object.fromEntries(names.map(n => [n, days.flatMap(d => futDayBars(n, d))]));
  }, [names, cursor?.day]); // eslint-disable-line react-hooks/exhaustive-deps
  const tapeBy = useMemo<Record<string, ChartTape>>(
    () =>
      cursor
        ? Object.fromEntries(
            names.map(n => {
              const p = futProduct(n);
              return [n, { bars: [...(contextBy[n] ?? []), ...futDayBars(n, cursor.day).slice(0, cursor.minute + 1)], iv: p.vol, key: `review:fut:${n}`, clock: 'ny' as const, precision: { decimals: p.decimals, tick: p.tick } }];
            })
          )
        : {},
    [contextBy, names, cursor?.day, cursor?.minute] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const marksBy = useMemo<Record<string, ChartMark[]>>(
    () =>
      Object.fromEntries(
        names.map(n => [
          n,
          (session?.fills ?? [])
            .filter(f => f.symbol === n)
            .map(f => ({ time: futBarTime(f.at.day, f.at.minute), side: f.side, quiet: f.how === 'roll', text: `${f.how === 'roll' ? 'Rolled out' : f.side === 'buy' ? 'Bought' : 'Sold'} ${f.qty} · ${futPrice(futProduct(n), f.price)}` })),
        ])
      ),
    [session?.fills, names] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const positionsBy = useMemo<Record<string, ChartPosition[]>>(
    () => Object.fromEntries(names.map(n => [n, account ? account.positions.filter(p => p.symbol === n).map(p => ({ key: p.key, contract: pseudo(p.symbol, p.long), qty: p.qty, spotIn: p.avg, pnl: p.pnl, r: p.r ?? 0, avg: p.avg, bid: p.last, dead: false, label: `${p.contract} · ${p.long ? 'long' : 'short'}`, tone: p.long ? ('bull' as const) : ('bear' as const), long: p.long, last: p.last, room: session ? futLadderRoom(session, p.symbol) : undefined, take: session ? futLadderTake(session, p.symbol) : undefined })) : []])),
    [account, names] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const bracketsBy = useMemo<Record<string, ChartBracket[]>>(() => {
    const out: Record<string, ChartBracket[]> = Object.fromEntries(names.map(n => [n, [] as ChartBracket[]]));
    if (!session || !account) return out;
    for (const o of session.orders) {
      if (o.status !== 'working' || !o.exit || o.price == null || o.kind === 'market') continue;
      const pos = account.positions.find(p => p.symbol === o.symbol);
      const list = out[o.symbol];
      if (!pos || !list) continue;
      const prod = futProduct(o.symbol);
      /* a future's way out is a price of the thing itself: its line IS its price, and its dollars are exact */
      const reach = pos.last * (prod.vol / Math.sqrt(252));
      list.push({ orderId: o.id, kind: o.kind === 'stop' ? 'stop' : 'target', on: 'contract', contract: pseudo(o.symbol, pos.long), qty: o.qty, price: o.price, level: o.price, money: (o.price - pos.avg) * (pos.long ? 1 : -1) * prod.pointValue * o.qty, edge: o.price > pos.last ? 'up' : 'down', far: Math.abs(o.price - pos.last) > reach, trail: o.kind === 'stop' ? (o.trail ?? null) : undefined, trailNow: o.kind === 'stop' ? Math.abs(pos.last - o.price) : undefined, breakeven: !!o.breakeven, canBreakeven: !!o.oco && session.orders.some(x => x.status === 'working' && x.oco === o.oco && x.kind === 'limit') });
    }
    const KEY = (b: ChartBracket) => b.contract.ticker;
    /* THE LADDER: where a position has more than one level of a kind, each says which it is — the nearest first */
    for (const list of Object.values(out)) {
      const groups = new Map<string, ChartBracket[]>();
      for (const b of list) groups.set(`${KEY(b)}|${b.kind}`, [...(groups.get(`${KEY(b)}|${b.kind}`) ?? []), b]);
      /* by how far each stands, a contract — a far level of one contract is not nearer than a near level of two */
      for (const g of groups.values()) if (g.length > 1) [...g].sort((x, y) => Math.abs(x.money) / x.qty - Math.abs(y.money) / y.qty).forEach((b, i) => (b.nth = i + 1));
    }
    return out;
  }, [session, account, names]);

  /* THE RESTING ORDERS THAT ARE NOT WAYS OUT — a limit or a stop waiting to open (or add to) a position, said as such on the
     chart ("1 · Buy stop · ✕", PositionLayer), at its price */
  const entriesBy = useMemo<Record<string, ChartEntry[]>>(() => {
    const out: Record<string, ChartEntry[]> = Object.fromEntries(names.map(n => [n, [] as ChartEntry[]]));
    if (!session) return out;
    const { day, minute } = session.cursor;
    for (const o of session.orders) {
      if (o.status !== 'working' || o.exit || o.price == null || o.kind === 'market') continue;
      const list = out[o.symbol];
      if (!list) continue;
      const prod = futProduct(o.symbol);
      const last = futDayBars(o.symbol, day)[minute]?.close ?? prod.px;
      const reach = last * (prod.vol / Math.sqrt(252));
      list.push({ orderId: o.id, side: o.side, kind: o.kind === 'stop' ? 'stop' : 'limit', qty: o.qty, price: o.price, level: o.price, edge: o.price > last ? 'up' : 'down', far: Math.abs(o.price - last) > reach, priceAt: at => onTick(prod, at) });
    }
    return out;
  }, [session, names]);

  /* ---- the book's columns ---- */
  const openCols = useMemo<Column<FutAccount['positions'][number]>[]>(
    () => [
      { key: 'contract', header: 'Contract', render: p => <span className="inline-flex items-center gap-2 font-semibold text-textPrimary"><CompanyLogo ticker={p.symbol} size={14} />{p.contract}</span> },
      { key: 'side', header: 'Side', render: p => <span className={`font-semibold ${p.long ? 'text-bull' : 'text-bear'}`}>{p.long ? 'Long' : 'Short'}</span> },
      { key: 'qty', header: 'Held', align: 'right', render: p => <span className="text-textPrimary">{p.qty}</span> },
      { key: 'avg', header: 'In at', align: 'right', render: p => <span className="text-textSecondary">{futPrice(futProduct(p.symbol), p.avg)}</span> },
      { key: 'last', header: 'Last', align: 'right', render: p => <span className="text-textPrimary">{futPrice(futProduct(p.symbol), p.last)}</span> },
      { key: 'margin', header: 'Margin held', align: 'right', render: p => <span className="text-textSecondary">{usd(marginOf(p.symbol) * p.qty, 0)}</span> },
      { key: 'pnl', header: 'Up or down', align: 'right', render: p => <span className={`font-semibold ${dirInk(p.pnl)}`}>{usdSigned(p.pnl)} {p.r != null && <span className="text-[10px] font-normal opacity-80">{rWords(p.r)}</span>}</span> },
      {
        key: 'close',
        header: '',
        align: 'right',
        render: p => (
          <button type="button" onClick={e => { e.stopPropagation(); if (id) closeFutPosition(id, p.symbol); }} disabled={(session?.cursor.minute ?? 0) >= FUT_LAST_MIN} title={(session?.cursor.minute ?? 0) >= FUT_LAST_MIN ? 'The market is shut until 18:00 — open the next day' : 'Flat, now: at the market, a tick against you'} className={smallDoor} data-position-close={p.key}>
            Close
          </button>
        ),
      },
    ],
    [id, session]
  );
  const orderCols = useMemo<Column<FutOrder>[]>(
    () => [
      { key: 'contract', header: 'Contract', render: o => <span className="inline-flex items-center gap-2 font-semibold text-textPrimary"><CompanyLogo ticker={o.symbol} size={14} />{o.contract}</span> },
      { key: 'what', header: 'Order', render: o => <span className="text-textPrimary">{o.side === 'buy' ? 'Buy' : 'Sell'} {o.qty} · {o.kind === 'market' ? 'market' : `${o.kind} ${futPrice(futProduct(o.symbol), o.price ?? 0)}`}{o.exit ? <span className="text-textMuted"> · a way out</span> : null}{o.trail != null ? <span className="text-textMuted"> · trails by {futPrice(futProduct(o.symbol), o.trail)}</span> : null}{o.breakeven ? <span className="text-textMuted"> · to where you got in after the first target</span> : null}{o.moved ? <span className="text-textMuted"> · moved to where you got in</span> : null}</span> },
      { key: 'placed', header: 'Placed', render: o => <span className="text-textSecondary">{futMomentWords(o.placed.day, o.placed.minute)}</span> },
      { key: 'status', header: 'Stands', render: o => (o.status === 'working' ? <span className="text-silver font-semibold">Working · {o.tif === 'day' ? 'today only' : 'until cancelled'}</span> : o.status === 'filled' ? <span className="text-textPrimary">Filled at {futPrice(futProduct(o.symbol), o.fillPrice ?? 0)}</span> : <span className="text-textMuted">{o.status === 'refused' ? 'Refused' : 'Cancelled'} — {o.why}</span>) },
      {
        key: 'cancel',
        header: '',
        align: 'right',
        render: o =>
          o.status === 'working' ? (
            <button type="button" onClick={() => id && cancelFutOrder(id, o.id)} title="Cancel this order" aria-label="Cancel this order" className="inline-flex items-center justify-center w-6 h-6 rounded text-textMuted hover:text-bear hover:bg-ink/[0.06] transition-colors align-middle" data-order-cancel={o.id}>
              <X className="w-3 h-3" />
            </button>
          ) : null,
      },
    ],
    [id]
  );
  const closedCols = useMemo<Column<FutTrade>[]>(
    () => [
      { key: 'contract', header: 'Contract', render: t => <span className="inline-flex items-center gap-2 font-semibold text-textPrimary"><CompanyLogo ticker={t.symbol} size={14} />{t.contract}</span> },
      { key: 'side', header: 'Side', render: t => <span className={`font-semibold ${t.long ? 'text-bull' : 'text-bear'}`}>{t.long ? 'Long' : 'Short'}</span> },
      { key: 'qty', header: 'Size', align: 'right', render: t => <span className="text-textPrimary">{t.qty}</span> },
      { key: 'in', header: 'In', render: t => <span className="text-textSecondary">{futMomentWords(t.opened.day, t.opened.minute)} · {futPrice(futProduct(t.symbol), t.avgIn)}</span> },
      { key: 'out', header: 'Out', render: t => <span className="text-textSecondary">{futMomentWords(t.closed.day, t.closed.minute)} · {futPrice(futProduct(t.symbol), t.avgOut)}</span> },
      { key: 'how', header: 'Ended', render: t => <span className="text-textSecondary">{ENDED[t.how]}</span> },
      { key: 'pnl', header: 'Made or lost', align: 'right', render: t => <span className={`font-semibold ${dirInk(t.pnl)}`}>{usdSigned(t.pnl)} <span className="text-[10px] font-normal opacity-80">{t.r != null ? rWords(t.r) : 'no stop · no R'}</span></span> },
    ],
    []
  );

  if (!session || !cursor || !account) return <DeskMissing />;

  const prod = futProduct(symbol);
  const bars = futDayBars(symbol, cursor.day);
  const last = bars[cursor.minute]?.close ?? prod.px;
  const dayOpen = bars[0]?.open ?? last;
  const dayPct = ((last - dayOpen) / dayOpen) * 100;
  const stats = statsOf(account.trades);
  const floor = futFloorOf(session);
  const tomorrow = nextDay(cursor.day);
  const working = session.orders.filter(o => o.status === 'working');
  const orders = [...working, ...session.orders.filter(o => o.status !== 'working').reverse()].slice(0, 40);
  const switchTo = (to: string) => to !== symbol && setActiveName(to);
  const levelsOf = (n: string): KeyLevels => ({ spot: futDayBars(n, cursor.day)[cursor.minute]?.close ?? futProduct(n).px, callWall: NaN, putWall: NaN, flip: NaN, supreme: NaN });

  /* the reader's own rules, and where each stands */
  const rules = session.rules;
  const dayState = rules?.dailyLossPct ? futDayStateOf(session) : null;
  const rulesLine =
    rules && (rules.maxOpen || rules.maxRiskPct || rules.dailyLossPct) ? (
      <span className="inline-flex items-center gap-x-2 gap-y-0.5 flex-wrap" data-review-rules>
        {rules.maxOpen ? <span className={account.positions.length >= rules.maxOpen ? 'text-warn' : 'text-textPrimary'}>{account.positions.length} of {rules.maxOpen} open</span> : null}
        {rules.maxRiskPct ? <span className="text-textPrimary" title="The most one trade may risk, entry to stop — an order has to carry a stop">{rules.maxRiskPct * 100}% at risk a trade · {usd(account.equity * rules.maxRiskPct, 0)}</span> : null}
        {rules.dailyLossPct && dayState ? <span className={dayState.stopped ? 'text-warn font-semibold' : 'text-textPrimary'} data-review-day-stop={dayState.stopped ? 'reached' : 'standing'}>{dayState.stopped ? `the day is over · ${(dayState.pct * 100).toFixed(1)}%` : `day ${dayState.pct >= 0 ? '+' : ''}${(dayState.pct * 100).toFixed(1)}% · stops at −${rules.dailyLossPct * 100}%`}</span> : null}
      </span>
    ) : null;

  /* THE NAMES, AS THE SHELL READS THEM: each with its tape, and what is drawn over it */
  const deskNames: DeskName[] = names.map(n => {
    const p = futProduct(n);
    const b = futDayBars(n, cursor.day);
    const px = b[cursor.minute]?.close ?? p.px;
    const open = b[0]?.open ?? px;
    return {
      symbol: n,
      title: p.name,
      label: frontContract(n, cursor.day),
      priceWords: futPrice(p, px),
      dayPct: ((px - open) / open) * 100,
      held: account.positions.some(q => q.symbol === n) ? 1 : 0,
      tape: tapeBy[n],
      levels: levelsOf(n),
      layer: {
        fills: [],
        marks: marksBy[n] ?? [],
        plain: { pointValue: p.pointValue, decimals: p.decimals },
        positions: positionsBy[n] ?? [],
        brackets: bracketsBy[n] ?? [],
        entries: entriesBy[n] ?? [],
        marketShut: cursor.minute >= FUT_LAST_MIN,
        onClosePosition: c => closeFutPosition(session.id, c.ticker),
        onAmend: (oid, px2) => amendFutOrder(session.id, oid, px2),
        onRebase: () => undefined,
        onCancelOrder: oid => cancelFutOrder(session.id, oid),
        onAttach: (c, kind, px2) => attachFutBracket(session.id, c.ticker, kind, px2),
        onTrail: (oid, on, by) => trailFutOrder(session.id, oid, on, by),
        onBreakeven: (oid, on) => breakevenFutOrder(session.id, oid, on),
        bidAtSpot: (_c, at) => at,
      },
      /* RP&L · UP&L: what the future has banked on the clock's trading day, and what is open on it */
      corner: (
        <PnlBadges
          name={frontContract(n, cursor.day)}
          realized={futBankedOf(session, n) - futBankedOf(session, n, cursor.day)}
          unrealized={account.positions.filter(q => q.symbol === n).reduce((x, q) => x + q.pnl, 0)}
          dayWord={`on the trading day of ${dayWords(cursor.day)}, the clock’s`}
        />
      ),
    };
  });

  /* ---- THE CONTRACT — where an option has its chain, a future has what it IS ---- */
  const upTo = bars.slice(0, cursor.minute + 1);
  const rangeOf = (from: number, to: number) => {
    const part = upTo.slice(from, to);
    if (!part.length) return null;
    const hi = Math.max(...part.map(x => x.high));
    const lo = Math.min(...part.map(x => x.low));
    return { hi, lo, pts: hi - lo, done: cursor.minute + 1 >= to };
  };
  const whole = rangeOf(0, FUT_DAY_MIN);
  const sessions: [string, ReturnType<typeof rangeOf>][] = [
    ['Overnight · 18:00 to 09:30', rangeOf(0, FUT_RTH_OPEN_MIN)],
    ['The day session · 09:30 to 16:00', rangeOf(FUT_RTH_OPEN_MIN, 1320)],
    ['The last hour · 16:00 to 17:00', rangeOf(1320, FUT_DAY_MIN)],
  ];
  const yesterday = prevDay(cursor.day);
  const settle = yesterday ? futDayBars(symbol, yesterday)[FUT_LAST_MIN]?.close : undefined;
  const riskShare = rules?.maxRiskPct || 0.01;
  const fact = 'flex flex-col gap-0.5 min-w-0';
  const factLabel = 'font-mono text-[9px] uppercase tracking-widest text-textMuted';
  const factValue = 'font-mono text-[12px] tnum text-textPrimary';
  const contractCard = (
    <div className={`${card} flex flex-col min-w-0 ${full ? 'flex-1 min-h-0' : 'lg:flex-1 lg:min-h-0'}`} data-review-contract={symbol}>
      <div className={head}>
        <span className={headWord}>The contract</span>
        <span className="inline-flex items-center gap-1.5 h-5 px-1.5 rounded border border-silver/70 bg-silver/[0.12] font-mono text-[10px] tnum" data-review-chain-name={symbol}>
          <span className="font-bold text-silver">{frontContract(symbol, cursor.day)}</span>
          <span className="text-textPrimary">{futPrice(prod, last)}</span>
        </span>
        <span className="ml-auto font-mono text-[9px] uppercase tracking-widest text-textMuted">as it stood · {futClockWords(cursor.minute)}</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 flex flex-col gap-3.5">
        <p className="text-[11px] leading-snug text-textSecondary">{prod.name} — the front month on this day. One price, no bid and ask: a market order fills a tick against you.</p>
        <div className="grid grid-cols-3 gap-x-4 gap-y-3">
          <div className={fact}><span className={factLabel}>A point</span><span className={factValue}>{usd(prod.pointValue, 0)}</span></div>
          <div className={fact}><span className={factLabel}>A tick · {prod.tick}</span><span className={factValue}>{usd(prod.tick * prod.pointValue)}</span></div>
          <div className={fact}><span className={factLabel}>Margin a contract</span><span className={factValue}>{usd(marginOf(symbol), 0)}</span></div>
          <div className={fact}><span className={factLabel}>Fee, each way</span><span className={factValue}>{usd(feeOf(session, symbol))}</span></div>
          <div className={fact}><span className={factLabel}>Since 18:00</span><span className={`${factValue} ${dayPct >= 0 ? 'text-bull' : 'text-bear'}`}>{dayPct >= 0 ? '+' : ''}{futPrice(prod, last - dayOpen)} · {dayPct.toFixed(2)}%</span></div>
          <div className={fact}><span className={factLabel}>Yesterday’s close</span><span className={factValue}>{settle != null ? futPrice(prod, settle) : '—'}</span></div>
        </div>
        <div>
          <div className={`${factLabel} mb-1.5`}>The day so far, by its sessions</div>
          <div className="flex flex-col">
            {sessions.map(([label, r]) => (
              <div key={label} className="flex items-baseline gap-3 py-1.5 border-t border-borderSubtle/60 font-mono text-[11px] tnum">
                <span className={r ? 'text-textSecondary' : 'text-textMuted'}>{label}</span>
                {r ? (
                  <span className="ml-auto text-textPrimary">
                    {futPrice(prod, r.lo)} – {futPrice(prod, r.hi)} <span className="text-textMuted">· {futPrice(prod, r.pts)} pts · {usd(r.pts * prod.pointValue, 0)}{r.done ? '' : ' · going'}</span>
                  </span>
                ) : (
                  <span className="ml-auto text-textMuted">not yet</span>
                )}
              </div>
            ))}
            {whole && (
              <div className="flex items-baseline gap-3 py-1.5 border-t border-borderSubtle/60 font-mono text-[11px] tnum">
                <span className="text-textSecondary font-semibold">The whole day</span>
                <span className="ml-auto text-textPrimary">
                  {futPrice(prod, whole.lo)} – {futPrice(prod, whole.hi)} <span className="text-textMuted">· {futPrice(prod, whole.pts)} pts a contract is {usd(whole.pts * prod.pointValue, 0)}</span>
                </span>
              </div>
            )}
          </div>
        </div>
        <div>
          <div className={`${factLabel} mb-1.5`}>
            What a stop lets you hold · {riskShare * 100}% of the account is {usd(account.equity * riskShare, 0)}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[8, 16, 32, 64].map(t => {
              const pts = t * prod.tick;
              const each = pts * prod.pointValue;
              return (
                <div key={t} className="rounded-md border border-borderSubtle px-2 py-1.5 font-mono text-[10px] tnum">
                  <div className="text-textMuted">{futPrice(prod, pts)} pts away</div>
                  <div className="text-[12px] text-textPrimary font-semibold">{Math.floor((account.equity * riskShare) / each)} <span className="font-normal text-textMuted text-[10px]">· {usd(each, 0)} each</span></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  /* THE ORDER IS THE PAPER DESK'S (components/paper/OrderPanel FutOrderPanel — 2026-09-26, Noah: "make the contract orders
     look the same on the backtesting section for both options and futures"): the type pills, the size row, Buy · Sell,
     the rest, the brackets as distances, the foot — fed the replayed minute's price and this session's refusals. A market
     order here fills a tick against you (futuresEngine), so the brackets are measured from that fill. */
  const posHere = account.positions.find(p => p.symbol === symbol) ?? null;
  const workingHere = working.filter(o => o.symbol === symbol);
  const ticketCard = (
    <div className={`${card} min-w-0 shrink-0 flex flex-col`} data-review-ticket-card>
      <div className={head}>
        <span className={headWord}>Order</span>
      </div>
      <FutOrderPanel
        desk={{
          product: prod,
          last,
          contract: frontContract(symbol, cursor.day),
          fee: feeOf(session, symbol),
          margin: marginOf(symbol),
          position: posHere ? { long: posHere.long, qty: posHere.qty, avg: posHere.avg, pnl: posHere.pnl } : null,
          refuse: d => futRefusal(session, d),
          slip: prod.tick,
          locked: null,
          anyOpen: account.positions.length > 0,
          anyWorking: working.length > 0,
          working: workingHere.length,
          equity: account.equity,
          version: `${cursor.day}|${cursor.minute}|${session.fills.length}|${session.orders.length}`,
        }}
        symbol={symbol}
        q={q}
        onQ={setQ}
        bracketsKey="slayer_review_brackets_v1"
        onPlace={d => {
          placeFutOrder(session.id, d);
          setTab(d.kind === 'market' ? 'open' : 'orders');
        }}
        onClose={() => {
          closeFutPosition(session.id, symbol);
          setTab('closed');
        }}
        onCancelOrders={() => workingHere.forEach(o => cancelFutOrder(session.id, o.id))}
        onFlattenAll={() => {
          for (const p of account.positions) closeFutPosition(session.id, p.symbol);
          for (const o of working) cancelFutOrder(session.id, o.id);
          setTab('closed');
        }}
        onCancelAll={() => working.forEach(o => cancelFutOrder(session.id, o.id))}
      />
    </div>
  );

  return (
    <DeskShell
      session={session}
      kind="futures"
      onRename={name => renameSession(session.id, name)}
      subline={`${names.map(n => futProduct(n).name).join(' and ')} · long or short, on margin · 18:00 to 17:00 New York`}
      facts={[
        { label: 'Worth now', testId: 'equity', node: usd(account.equity) },
        { label: 'Free, after margin', testId: 'free', node: usd(account.free) },
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
      account={{ equity: account.equity, openPnl: account.openPnl, third: { label: 'free', value: usd(account.free) } }}
      names={deskNames}
      active={symbol}
      onSwitch={switchTo}
      switchLabel="The product on the desk"
      heldAs="dot"
      prefsKey="slayer_review_fut_chart"
      paneIds={['review:fut:main', 'review:fut:second']}
      timeframes={FUT_TIMEFRAMES}
      overlayKeys={FUT_OVERLAY_KEYS}
      clock={{
        day: cursor.day,
        minute: cursor.minute,
        lastMin: FUT_LAST_MIN,
        dayMin: FUT_DAY_MIN,
        floorDay: floor.day,
        tomorrow,
        words: futMomentWords(cursor.day, cursor.minute),
        wordsAt: futClockWords,
        marks: DAY_MARKS,
        move: to => moveFutClock(session.id, to),
      }}
      goToTitle="Jump the clock to 18:00, the open of a later trading day — every day between is run"
      nextDayTitle="Run to 17:00 and open the next trading day at 18:00 (N)"
      /* the jump most day traders want: the stock market's open */
      doors={({ seek, headW }) => (
        <button type="button" onClick={() => seek(FUT_RTH_OPEN_MIN)} disabled={cursor.minute >= FUT_RTH_OPEN_MIN} title="Run to 09:30 — the stock market’s open (9)" className={barDoor} data-review-open>
          <Sunrise className="w-3 h-3" />
          {headW >= 1300 && '09:30'}
        </button>
      )}
      keys={{ '9': ({ seek }) => cursor.minute < FUT_RTH_OPEN_MIN && seek(FUT_RTH_OPEN_MIN) }}
      full={full}
      onFull={setFull}
      side={
        <>
          {contractCard}
          {ticketCard}
        </>
      }
      sideMinPx={CARD_MIN_PX}
      panelWord="order"
      panelTitle="The contract and the order"
      tab={tab}
      onTab={setTab}
      counts={{ open: account.positions.length, working: working.length, closed: account.trades.length }}
      book={
        tab === 'open' ? (
          <TraceGrid key="open" rows={account.positions} columns={openCols} rowKey={p => p.key} onRowClick={p => switchTo(p.symbol)} selectedKey={symbol} autoHeight animate={false} widths={{ side: 80, qty: 70, close: 84 }} emptyText="Nothing open — go long or short from the order at the right" testId="review-open" />
        ) : tab === 'orders' ? (
          <TraceGrid key="orders" rows={orders} columns={orderCols} rowKey={o => o.id} onRowClick={o => switchTo(o.symbol)} autoHeight animate={false} widths={{ cancel: 56 }} flexes={{ status: 2, what: 1.4 }} emptyText="No orders yet" testId="review-orders" />
        ) : (
          <TraceGrid key="closed" rows={[...account.trades].reverse()} columns={closedCols} rowKey={t => t.id} autoHeight animate={false} widths={{ side: 80, qty: 70 }} flexes={{ in: 1.4, out: 1.4 }} emptyText="No closed trades yet" testId="review-closed" />
        )
      }
    />
  );
};

export default FuturesDesk;
