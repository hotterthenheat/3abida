/*
==================================================
  SLAYER TERMINAL - PAPER · THE LIVE CHART
  (pages/paper/Desk.tsx)

  The live paper account's desk (docs/paper-rules.md) —
  called the LIVE CHART since 2026-09-22, when Noah cut
  the section back to it ("we got too carried away and
  lost focus"): the Evaluation and Journal pages went,
  and the account strip that stood over the chart moved
  into the right column in place of the contract's card
  ("irrelevent for futures papertrading"), so the chart
  starts at the top of the page. The account card keeps its
  own height and the ORDER card (the ticket, named as every
  platform names it: "which SHOULD be called ORDER") fills
  the rest of the column — its press at the column's foot.

  OPTIONS, AND ONLY OPTIONS (2026-09-30: "on the paper
  trading remove all the futures and make it strictly
  Options trading"). The name on the desk is a stock, a
  fund or an index, and the right column is always the
  account and the CHAIN beside it — the futures' Order
  card, their ladder, their reversal and their margin
  went with them. An account that traded a future before
  keeps those trades in its cash and its journal; the
  desk shows only what can still be traded.

  It is BUILT FROM THE BACKTEST DESK'S PARTS, as Noah
  asked of the partner's page ("list all the good
  things… we will turn that into our own type design"):

    the shell        components/review/DeskShell, with no
                     clock of its own and no strip over it —
                     the chart is the live one; the paper
                     account is the card at the head of the
                     right column (components/paper/
                     AccountCard)
    the chain        components/paper/OptionsChain — the
                     Weigher's own chain (2026-09-22), the
                     order inside a strike's dropdown; AS IT
                     STANDS — the flaw Noah named on the
                     partner's desk ("the options charts not
                     showing you the options chain… telling
                     you to buy or sell the current stock
                     price") is not here: an option is
                     traded off its own chain beside the
                     chart
    the chart layer  PositionLayer: the position, its
                     targets and stops on the chart, pulled
                     off the chip, dragged, pinned — the
                     fills as arrows where the chart stood
    the book         open · orders · closed

  THE NAME ON THE DESK is picked at the head of the tape:
  a stock, a fund or an index — the account and its chain
  beside the chart. A practice account and an evaluation
  are offered the same names: both trade options.

  THE DESK READS THE ACCOUNT IN HAND and trades it — or,
  where another tab holds the accounts, reads it and says
  so, with the door to take them here.

  ONE TO FOUR CHARTS (round two): the reader's desks
  (data/paper/desks.ts) — a layout, a name and an interval
  a pane, kept in step or not — on the shell's grid. The
  pane on the desk is the one the chain, the contract's
  card and the ticket speak for; every pane draws its own
  name's positions, ways out and fills.
==================================================
*/

import { useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useMarketData } from '../../context/MarketDataContext';
import type { ChartOverlays } from '../../components/gex/StrikeChart';
import { TraceGrid } from '../../components/trace/TraceBox';
import ContractLabel from '../../components/ui/ContractLabel';
import type { DropdownOption } from '../../components/ui/DropdownSelect';
import type { Column } from '../../components/ui/DataTable';
import DeskShell, { card, smallDoor, type DeskName } from '../../components/review/DeskShell';
import OptionsChain, { ChainOrder, type ChainOrderDesk } from '../../components/paper/OptionsChain';
import type { ChartBracket, ChartEntry, ChartMark, ChartPosition } from '../../components/review/PositionLayer';
import PnlBadges from '../../components/review/PnlBadges';
import { dirInk, rWords, usd, usdSigned } from '../../components/review/words';
import AccountCard from '../../components/paper/AccountCard';
import TickerPicker from '../../components/paper/TickerPicker';
import StartCard from '../../components/paper/StartCard';
import { DeskMenu, LayoutDoors } from '../../components/paper/DeskDoors';
import { currentDesk, quickOf, setActivePane, setPaneName, setPaneTimeframe, setQuick, useDesks } from '../../data/paper/desks';
import PositionBar from '../../components/paper/PositionBar';
import type { TradeMark } from '../../components/gex/StrikeChart';
import { chartMenu, planOfMark, positionLines, type Hands } from './deskHands';
import { buildLevelsFor, spotChangePct } from '../../data/gex';
import { nameGoesUp } from '../../data/review/engine';
import { contractKey, contractWords, type ContractId, type Right } from '../../data/review/quotes';
import { REVIEW_NAMES } from '../../data/review/tape';
import type { Timeframe } from '../../data/timeframe';
import { bankedOf, evalRead, optLadderRoom, optLadderTake, optRefusal, viewOf, type MarkedOpt, type OptOrder, type OptTrade } from '../../data/paper/engine';
import { LIFE, PAPER_INDEXES, candlesOf, isPaperIndex, liveDeskChain, paperIndex, baseIvOf, listedNow, spotOf, spotForAskNow, spotForBidNow, stepOf } from '../../data/paper/feed';
import { dayBeginsAt, nyMomentWords } from '../../data/paper/clock';
import { amendOrder, attachOpt, breakevenOrder, cancelOrder, cancelWorking, closeOpt, endEval, flattenAccount, liveMarket, placeOptOrder, readPaper, rebaseOrder, setInHand, startEvaluation, startPractice, takeHere, trailOrder, usePaper } from '../../data/paper/store';

/* THE CHART'S SETTINGS ON THIS DESK. A name's live chart has its book: the walls, the trails, the vol pane. An index's is
   its fund's candles turned into its level — no book of its own, so the overlays that read one are not offered, and a
   minute a bar round the clock has no daily candle. */
const NAME_TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '30m', '1h', '1D'];
const INDEX_TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '30m', '1h'];
const NAME_OVERLAYS: (keyof ChartOverlays)[] = ['volume', 'levels', 'trails', 'session', 'cone', 'volDrift'];
const INDEX_OVERLAYS: (keyof ChartOverlays)[] = ['volume', 'session'];
/** Strikes each side of the chain's centre, the least the chain keeps under the account card, and the column's width
    (2026-09-22: "build it with the wider column") */
const CHAIN_EACH = 20;
const CHAIN_MIN_PX = 380;
const SIDE_CHAIN_PX = 560;
/** The account card at the head of the right column: what the column keeps for it above the chain and the ticket */
const ACCOUNT_PX = 264;
type Tab = 'open' | 'orders' | 'closed';

/* ---- the desk's own choices, kept for the reader: the name on it and the side of the chain ---- */
const DESK_KEY = 'slayer_paper_desk_v1';
interface DeskPrefs {
  name?: string;
  right?: Right;
}
const readDesk = (): DeskPrefs => {
  try {
    return (JSON.parse(localStorage.getItem(DESK_KEY) ?? 'null') as DeskPrefs | null) ?? {};
  } catch {
    return {};
  }
};
const writeDesk = (patch: DeskPrefs) => {
  try {
    localStorage.setItem(DESK_KEY, JSON.stringify({ ...readDesk(), ...patch }));
  } catch {
    /* a private window: the desk forgets on the next visit */
  }
};

const OPT_ENDED: Record<OptTrade['how'], string> = { sold: 'Sold by you', target: 'Target hit', stopped: 'Stopped out', expired: 'Held to the bell', scaled: 'Scaled out', rule: 'Closed by the rules', page: 'Closed with the page' };

type OpenRow = { key: string; p: MarkedOpt };
type OrderRow = { key: string; o: OptOrder };
type ClosedRow = { key: string; t: OptTrade; at: number };

const titleOf = (ticker: string): string => paperIndex(ticker)?.name ?? REVIEW_NAMES.find(n => n.ticker === ticker)?.name ?? ticker;

const PaperDesk = () => {
  const { accounts, inHand, holding, elsewhere } = usePaper();
  const account = accounts.find(a => a.id === inHand) ?? null;
  /* the desk moves with the feed: a render a tick (the live chart's revision, the book's marks, the chain's quotes) */
  const { marketData } = useMarketData();
  const revRef = useRef(0);
  const revision = useMemo(() => ++revRef.current, [marketData]);
  const [tab, setTab] = useState<Tab>('open');
  const [full, setFull] = useState(false);
  const saved = useMemo(readDesk, []);
  const desks = useDesks();
  const desk = currentDesk(desks);
  const [right, setRightRaw] = useState<Right>(saved.right ?? 'C');
  const [expiry, setExpiry] = useState<string | null>(null);
  const [picked, setPicked] = useState<ContractId | null>(null);
  const [drillOpen, setDrillOpen] = useState(true);
  const centreRef = useRef<{ key: string; at: number } | null>(null);
  /** A drawn long or short, being placed: whose, and at what size */
  const [markOrder, setMarkOrder] = useState<{ name: string; mark: TradeMark; qty: number } | null>(null);

  /* an index's candles are a minute each from its fund's, round the clock: no daily candle */
  const panes = desk.panes.map(p => ({ name: p.name, timeframe: isPaperIndex(p.name) && p.timeframe === '1D' ? ('1h' as Timeframe) : p.timeframe }));
  const active = Math.min(desk.active, panes.length - 1);
  const name = panes[active].name;
  const setName = (n: string, contract: ContractId | null = null) => {
    if (n !== name) {
      setPaneName(active, n);
      setExpiry(null);
    }
    setPicked(contract);
    if (contract) {
      setRightRaw(contract.right);
      setExpiry(contract.expiry);
      setDrillOpen(true);
    }
  };
  const setRight = (r: Right) => {
    setRightRaw(r);
    writeDesk({ right: r });
  };

  if (!account) {
    return (
      <div className="flex flex-col gap-2.5">
        {!holding && elsewhere && <HeldElsewhere />}
        <StartCard canStart={holding} onPractice={size => startPractice(size)} onEvaluation={plan => startEvaluation(plan)} />
      </div>
    );
  }

  /* ---- THE MARKET AS IT STANDS, and the account against it ---- */
  const m = liveMarket();
  const v = viewOf(account, m);
  const ev = evalRead(account, v, m.now);
  const lock = !holding ? 'The accounts are open in another tab — take them here to trade' : null;

  /* ---- THE NAME, and its chain ---- */
  const spot = spotOf(name);
  const expiries = listedNow(name, m.now);
  const exp = expiry && expiries.some(e => e.iso === expiry) ? expiry : ((expiries.find(e => e.dte >= 5) ?? expiries[0])?.iso ?? null);
  const expiryOptions: DropdownOption<string>[] = expiries.map(e => ({ value: e.iso, label: `${e.label} · ${e.dte}d`, hint: e.dte === 0 ? 'Expires at today’s 16:00' : `${e.kind === 'monthly' ? 'The monthly' : e.kind === 'daily' ? 'A daily' : 'A weekly'}` }));
  /* the chain is laddered off a price that stays put, and only re-centred once the name has run most of the ladder away */
  const ck = `${name}|${exp}`;
  if (exp) {
    const step = stepOf(name);
    if (!centreRef.current || centreRef.current.key !== ck || Math.abs(spot - centreRef.current.at) > step * (CHAIN_EACH - 4)) centreRef.current = { key: ck, at: spot };
  }
  /* THE CHAIN AS THE WEIGHER DRAWS IT, on the Live Chart's own quotes (feed.ts liveDeskChain) */
  const chain = exp ? liveDeskChain(name, exp, m.now, CHAIN_EACH, centreRef.current?.at) : null;
  /* the strike whose dropdown is open: the picked contract's, while it is on the chain's side and expiry */
  const openStrike = drillOpen && picked && picked.ticker === name && picked.expiry === exp && picked.right === right ? picked.strike : null;
  const pickStrike = (strike: number, clicks = 1) => {
    if (!exp) return;
    /* one press opens a strike's dropdown and a second on it folds it; a double press only ever opens */
    if (openStrike === strike && clicks === 1) return setDrillOpen(false);
    setPicked({ ticker: name, strike, right, expiry: exp });
    setDrillOpen(true);
  };

  /* ---- WHAT THE DESK'S HANDS DO OFF A CHART (pages/paper/deskHands.tsx): the menu, the bar, a drawn long or short ---- */
  const hands: Hands = {
    account,
    m,
    v,
    q: quickOf(desks),
    lock,
    picked,
    /* the chain's expiry on the name it shows; on another pane's name, the one the chain would open on */
    expiryOf: n => (n === name && exp ? exp : ((listedNow(n, m.now).find(e => e.dte >= 5) ?? listedNow(n, m.now)[0])?.iso ?? null)),
    strikeNear: (n, px) => Math.round(px / stepOf(n)) * stepOf(n),
    spotOf,
  };

  /* ---- WHAT IS DRAWN OVER A CHART — a name's positions, its ways out, this page load's fills: once a name, for every pane
     that shows it ---- */
  const built = new Map<string, DeskName>();
  const deskNameOf = (name: string): DeskName => {
  const hit = built.get(name);
  if (hit) return hit;
  const spot = spotOf(name);
  const positions: ChartPosition[] = v.opt.filter(p => p.contract.ticker === name).map(p => ({ key: p.key, contract: p.contract, qty: p.qty, spotIn: p.spotIn, pnl: p.pnl, r: p.r, avg: p.avg, bid: p.quote.bid, dead: p.quote.dead, room: optLadderRoom(account, m, p.contract), take: optLadderTake(account, m, p.contract) }));
  const brackets: ChartBracket[] = [];
  for (const o of account.opt.orders) {
    if (o.status !== 'working' || o.side !== 'sell' || o.price == null || o.kind === 'market' || o.contract.ticker !== name) continue;
    const pos = v.opt.find(p => p.key === contractKey(o.contract));
    if (!pos) continue;
    /* WHAT IT WAITS ON: the contract's price (its line is where the name would have to stand NOW) or the name's (the line holds) */
    const onName = o.on === 'name';
    const level = onName ? o.price : spotForBidNow(o.contract, m.now, o.price);
    const sellsAt = onName ? m.optQuoteAt(o.contract, o.price).bid : o.price;
    const here = pos.quote.spot;
    const reach = here * (baseIvOf(name) / Math.sqrt(252));
    brackets.push({ orderId: o.id, kind: o.kind === 'stop' ? 'stop' : 'target', on: onName ? 'name' : 'contract', contract: o.contract, qty: o.qty, price: o.price, level, money: (sellsAt - pos.avg) * 100 * o.qty, edge: nameGoesUp(o.kind, o.contract.right) ? 'up' : 'down', far: level == null || Math.abs(level - here) > reach, trail: o.kind === 'stop' ? (o.trail ?? null) : undefined, trailNow: o.kind === 'stop' ? Math.max(0.01, onName ? Math.abs(here - o.price) : pos.quote.bid - o.price) : undefined, breakeven: !!o.breakeven, canBreakeven: !!o.oco && account.opt.orders.some(x => x.status === 'working' && x.oco === o.oco && x.kind === 'limit') });
  }
  /* THE RESTING ORDERS THAT ARE NOT WAYS OUT — a limit waiting to open (or add to) a position, said as such on the chart
     ("1 · Buy limit · ✕", PositionLayer): an option's buy where the name would have to stand for the contract's ask to come
     down to it */
  const entries: ChartEntry[] = [];
  {
    const reach = spot * (baseIvOf(name) / Math.sqrt(252));
    for (const o of account.opt.orders) {
      if (o.status !== 'working' || o.side !== 'buy' || o.price == null || o.kind === 'market' || o.contract.ticker !== name) continue;
      const level = spotForAskNow(o.contract, m.now, o.price);
      const c = o.contract;
      entries.push({ orderId: o.id, side: 'buy', kind: o.kind === 'stop' ? 'stop' : 'limit', qty: o.qty, price: o.price, level, label: contractWords(c).replace(`${name} `, ''), edge: (o.kind === 'stop') === (c.right === 'C') ? 'up' : 'down', far: level == null || Math.abs(level - spot) > reach, priceAt: at => Math.max(0.01, Math.round(m.optQuoteAt(c, at).ask * 100) / 100) });
    }
  }
  /* THE LADDER: where a position has more than one level of a kind, each says which it is — the nearest first */
  {
    const groups = new Map<string, ChartBracket[]>();
    for (const b of brackets) groups.set(`${contractKey(b.contract)}|${b.kind}`, [...(groups.get(`${contractKey(b.contract)}|${b.kind}`) ?? []), b]);
    for (const g of groups.values()) if (g.length > 1) [...g].sort((x, y) => Math.abs(x.money) / x.qty - Math.abs(y.money) / y.qty).forEach((b, i) => (b.nth = i + 1));
  }
  /* the fills of THIS page load, as arrows where the chart stood (an earlier load's market is not this one) */
  const marks: ChartMark[] = account.opt.fills.filter(f => f.contract.ticker === name && f.life === LIFE).map(f => ({ time: f.bar, side: f.side, quiet: f.how === 'expired' || f.how === 'rule' || f.how === 'page', text: `${f.side === 'buy' ? 'Bought' : f.how === 'expired' ? 'Expired' : 'Sold'} ${f.qty} · ${contractWords(f.contract).replace(`${name} `, '')}` }));
  const made: DeskName = {
    symbol: name,
    title: titleOf(name),
    label: name,
    priceWords: spot.toFixed(2),
    dayPct: spotChangePct(paperIndex(name)?.fund ?? name),
    held: positions.length,
    /* an index's chart is its own candles (made from its fund's) — an index is never asked of the simulator by its own name,
       and has no book of its own to draw walls from */
    tape: isPaperIndex(name) ? { bars: candlesOf(name), iv: baseIvOf(name), key: `paper:idx:${name}`, precision: { decimals: 2, tick: 0.01 } } : undefined,
    levels: isPaperIndex(name) ? { spot, callWall: NaN, putWall: NaN, flip: NaN, supreme: NaN } : buildLevelsFor(name),
    layer: {
      fills: [],
      marks,
      positions,
      brackets,
      entries,
      marketShut: !holding || account.status !== 'open',
      onClosePosition: c => closeOpt(account.id, c, v.opt.find(p => p.key === contractKey(c))?.qty ?? 0),
      onAmend: (oid, px) => amendOrder(account.id, oid, px),
      onRebase: (oid, to) => rebaseOrder(account.id, oid, to),
      onCancelOrder: oid => cancelOrder(account.id, oid),
      onAttach: (c, kind, px, onWhat) => attachOpt(account.id, c, kind, px, onWhat),
      onTrail: (oid, on, by) => trailOrder(account.id, oid, on, by),
      onBreakeven: (oid, on) => breakevenOrder(account.id, oid, on),
      bidAtSpot: (c, at) => m.optQuoteAt(c, at).bid,
      menu: chartMenu(hands, name),
    },
    onTradeMark: mark => setMarkOrder({ name, mark, qty: quickOf(desks) }),
    /* RP&L · UP&L: what the name has banked this trading day (since the last 16:00 bell), and what is open on it */
    corner: (
      <PnlBadges
        name={name}
        realized={bankedOf(account, name) - bankedOf(account, name, dayBeginsAt(account.day))}
        unrealized={positions.reduce((x, p) => x + p.pnl, 0)}
        dayWord="today (since the 16:00 bell, New York)"
      />
    ),
  };
  built.set(name, made);
  return made;
  };
  const deskName = deskNameOf(name);

  /* ---- THE CARDS AT THE RIGHT ---- */
  /* held: the contract itself, or the bought leg of a spread; sold: the other leg of one (open, or on the ticket) */
  const legOf = (p: ContractId) => p.ticker === name && p.expiry === exp && p.right === right;
  const accountCard = (
    <AccountCard
      account={account}
      accounts={accounts}
      view={v}
      ev={ev}
      now={m.now}
      onPick={setInHand}
      onPractice={holding ? size => startPractice(size) : null}
      onEvaluation={holding ? plan => startEvaluation(plan) : null}
      onEndEvaluation={holding ? id => endEval(id) : null}
      onFlatten={holding ? () => flattenAccount(account.id) : null}
      onCancelAll={holding ? () => cancelWorking(account.id) : null}
    />
  );
  const version = `${account.touchedAt}|${account.opt.fills.length}|${revision}|${holding}`;
  /* THE ORDER INSIDE A STRIKE'S DROPDOWN (components/paper/OptionsChain): what it asks of the desk */
  const chainDesk: ChainOrderDesk = {
    refuse: d => optRefusalLive(account.id, d),
    locked: lock ?? (account.status !== 'open' ? 'This account is closed' : null),
    quoteWith: (c, at) => m.optQuoteAt(c, at),
    spotForBid: (c, bid) => spotForBidNow(c, m.now, bid),
    fee: account.sandbox ? 0 : account.fee,
    free: v.free,
    equity: v.equity,
    version,
    q: quickOf(desks),
    onQ: setQuick,
    heldAt: strike => {
      const p = v.opt.find(x => legOf(x.contract) && x.contract.strike === strike);
      return p ? { contract: p.contract, qty: p.qty, avg: p.avg, pnl: p.pnl, decayDay: Math.abs(p.quote.theta) * 100 * p.qty } : null;
    },
    strikes: chain?.rows.map(r => r.strike) ?? [],
    onPlace: d => {
      placeOptOrder(account.id, d);
      setTab(d.kind === 'market' ? (d.side === 'buy' ? 'open' : 'closed') : 'orders');
    },
    onClose: (c, q) => {
      closeOpt(account.id, c, q);
      setTab('closed');
    },
  };
  const heldStrikes = new Set(v.opt.filter(p => legOf(p.contract)).map(p => p.contract.strike));
  const sideCard = (
    <>
      {accountCard}
      <OptionsChain
        ticker={name}
        chain={chain}
        right={right}
        onRight={setRight}
        expiry={exp}
        expiryOptions={expiryOptions}
        onExpiry={setExpiry}
        sel={openStrike}
        onSelect={pickStrike}
        held={heldStrikes}
        full={full}
        /* keyed by whether the strike is held: a buy that fills turns the dropdown to the position with a fresh price box */
        order={c => (exp && chain ? <ChainOrder key={`${name}|${exp}|${c.strike}|${c.right}|${heldStrikes.has(c.strike) ? 'held' : 'new'}`} c={c} ticker={name} expiry={exp} spot={chain.spot} desk={chainDesk} /> : null)}
      />
    </>
  );
  /* ---- THE BOOK ---- */
  const openRows: OpenRow[] = v.opt.map(p => ({ key: p.key, p }));
  const working = account.opt.orders.filter(o => o.status === 'working').length;
  const orderRows: OrderRow[] = account.opt.orders
    .map(o => ({ key: o.id, o }))
    .sort((x, y) => (x.o.status === 'working' ? 0 : 1) - (y.o.status === 'working' ? 0 : 1) || y.o.placed.at - x.o.placed.at)
    .slice(0, 60);
  const closedRows: ClosedRow[] = v.optTrades.map(t => ({ key: t.id, t, at: t.closed.at })).sort((x, y) => y.at - x.at);
  const openCols: Column<OpenRow>[] = [
    { key: 'contract', header: 'Contract', render: r => <ContractLabel contract={contractWords(r.p.contract)} right={r.p.contract.right} logo={r.p.contract.ticker} size="sm" /> },
    { key: 'qty', header: 'Held', align: 'right', render: r => <span className="text-textPrimary">{r.p.qty}</span> },
    { key: 'avg', header: 'In at', align: 'right', render: r => <span className="text-textSecondary">{r.p.avg.toFixed(2)}</span> },
    { key: 'now', header: 'Now', align: 'right', render: r => <span className="text-textPrimary">{`${r.p.quote.bid.toFixed(2)} · ${r.p.quote.ask.toFixed(2)}`}</span> },
    { key: 'carry', header: 'Holding it', align: 'right', render: r => <span className="text-textSecondary" title="What the contract loses a day, all else equal">{`${usd(Math.abs(r.p.quote.theta) * 100 * r.p.qty)} a day`}</span> },
    { key: 'pnl', header: 'Up or down', align: 'right', render: r => <span className={`font-semibold ${dirInk(r.p.pnl)}`}>{usdSigned(r.p.pnl)} {r.p.r != null && <span className="text-[10px] font-normal opacity-80">{rWords(r.p.r)}</span>}</span> },
    {
      key: 'close',
      header: '',
      align: 'right',
      render: r => (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            closeOpt(account.id, r.p.contract, r.p.qty);
          }}
          disabled={!!lock || r.p.quote.dead}
          title={lock ?? (r.p.quote.dead ? 'No bid to sell into right now' : 'Sell all of it at the bid, now')}
          className={smallDoor}
          data-position-close={r.key}
        >
          Close
        </button>
      ),
    },
  ];
  const orderWords = (r: OrderRow): string => {
    const o = r.o;
    const how = o.kind === 'market' ? 'market' : o.on === 'name' ? `${o.kind === 'limit' ? 'when' : 'if'} ${o.contract.ticker} ${o.kind === 'limit' ? 'reaches' : nameGoesUp(o.kind, o.contract.right) ? 'rises to' : 'falls to'} ${o.price?.toFixed(2)}` : o.kind === 'limit' ? `limit ${o.price?.toFixed(2)}` : `stop ${o.price?.toFixed(2)}`;
    return `${o.side === 'buy' ? 'Buy' : 'Sell'} ${o.qty} · ${how}${o.oco ? ' · rides the buy' : ''}${o.trail != null ? ` · trails by ${o.trail.toFixed(2)}` : ''}${o.breakeven ? ' · to what you paid after the first target' : ''}${o.moved ? ' · moved to what you paid' : ''}`;
  };
  const orderCols: Column<OrderRow>[] = [
    { key: 'contract', header: 'Contract', render: r => <ContractLabel contract={contractWords(r.o.contract)} right={r.o.contract.right} logo={r.o.contract.ticker} size="sm" /> },
    { key: 'what', header: 'Order', render: r => <span className="text-textPrimary">{orderWords(r)}</span> },
    { key: 'placed', header: 'Placed', render: r => <span className="text-textSecondary">{nyMomentWords(r.o.placed.at)}</span> },
    {
      key: 'status',
      header: 'Stands',
      render: r =>
        r.o.status === 'working' ? (
          <span className="text-silver font-semibold">Working · {r.o.tif === 'day' ? 'today only' : 'until cancelled'}</span>
        ) : r.o.status === 'filled' ? (
          <span className="text-textPrimary">Filled at {r.o.fillPrice?.toFixed(2)}</span>
        ) : (
          <span className="text-textMuted">
            {r.o.status === 'refused' ? 'Refused' : 'Cancelled'} — {r.o.why}
          </span>
        ),
    },
    {
      key: 'cancel',
      header: '',
      align: 'right',
      render: r =>
        r.o.status === 'working' ? (
          <button type="button" onClick={e => { e.stopPropagation(); cancelOrder(account.id, r.o.id); }} disabled={!!lock} title={lock ?? 'Cancel this order'} aria-label="Cancel this order" className="inline-flex items-center justify-center w-6 h-6 rounded text-textMuted hover:text-bear hover:bg-ink/[0.06] disabled:opacity-30 transition-colors align-middle" data-order-cancel={r.o.id}>
            <X className="w-3 h-3" />
          </button>
        ) : null,
    },
  ];
  const closedCols: Column<ClosedRow>[] = [
    { key: 'contract', header: 'Contract', render: r => <ContractLabel contract={contractWords(r.t.contract)} right={r.t.contract.right} logo={r.t.contract.ticker} size="sm" /> },
    { key: 'qty', header: 'Size', align: 'right', render: r => <span className="text-textPrimary">{r.t.qty}</span> },
    { key: 'in', header: 'In', render: r => <span className="text-textSecondary">{nyMomentWords(r.t.opened.at)} · {r.t.avgIn.toFixed(2)}</span> },
    { key: 'out', header: 'Out', render: r => <span className="text-textSecondary">{nyMomentWords(r.t.closed.at)} · {r.t.avgOut.toFixed(2)}</span> },
    { key: 'how', header: 'Ended', render: r => <span className="text-textSecondary" title={r.t.note}>{OPT_ENDED[r.t.how]}</span> },
    { key: 'pnl', header: 'Made or lost', align: 'right', render: r => <span className={`font-semibold ${dirInk(r.t.pnl)}`}>{usdSigned(r.t.pnl)} <span className="text-[10px] font-normal opacity-80">{r.t.r != null ? rWords(r.t.r) : 'no stop · no R'}</span></span> },
  ];

  /* ---- THE HEAD'S PICKER: what is on the chart — the partner's grouped list, with one search over all of it
     (components/paper/TickerPicker) ---- */
  const picker = (
    <span className="inline-flex items-center gap-2 font-mono text-[12px] tnum" data-paper-picker={name}>
      <TickerPicker value={name} onChange={n => setName(n)} indexPrice={s => spotOf(s)} indexes={PAPER_INDEXES} />
      <span className="text-textPrimary">{deskName.priceWords}</span>
      <span className={`text-[11px] font-semibold ${deskName.dayPct >= 0 ? 'text-bull' : 'text-bear'}`}>
        {deskName.dayPct >= 0 ? '▲ +' : '▼ '}
        {deskName.dayPct.toFixed(2)}%
      </span>
    </span>
  );

  return (
    <div className="flex flex-col gap-2.5">
      {!holding && elsewhere && <HeldElsewhere />}
      <DeskShell
        session={{ id: account.id, name: account.name }}
        kind="paper"
        /* no strip over the chart: the account is the right column's first card */
        strip={false}
        picker={picker}
        foot="Simulated live prices — practice, not advice. What is open is closed when the page closes: the simulated market is a new one on every load."
        revision={revision}
        account={{ equity: v.equity, openPnl: v.openPnl, third: ev ? { label: 'room', value: usd(Math.max(0, ev.room), 0) } : { label: 'free', value: usd(v.free, 0) } }}
        names={[deskName]}
        grid={{
          layout: desk.layout,
          panes: panes.map((p, i) => ({ key: `${desk.id}:${i}`, name: deskNameOf(p.name), timeframe: p.timeframe, foot: <PositionBar lines={positionLines(hands, p.name)} /> })),
          active,
          onActive: setActivePane,
          onTimeframe: setPaneTimeframe,
          crosshair: desk.sync.crosshair,
        }}
        doors={({ compact }) => (
          <>
            <LayoutDoors compact={compact} />
            <DeskMenu compact={compact} />
          </>
        )}
        notice={() => (markOrder ? <MarkCard plan={planOfMark(hands, markOrder.name, markOrder.mark, markOrder.qty)} qty={markOrder.qty} onQty={qty => setMarkOrder({ ...markOrder, qty })} onCancel={() => setMarkOrder(null)} /> : null)}
        active={name}
        onSwitch={() => undefined}
        switchLabel="The name on the desk"
        prefsKey="slayer_paper_chart"
        paneIds={['paper:main', 'paper:second']}
        timeframes={isPaperIndex(name) ? INDEX_TIMEFRAMES : NAME_TIMEFRAMES}
        overlayKeys={isPaperIndex(name) ? INDEX_OVERLAYS : NAME_OVERLAYS}
        full={full}
        onFull={setFull}
        /* the full screen fills the screen, edge to edge */
        fullBleed
        side={sideCard}
        sideMinPx={ACCOUNT_PX + 10 + CHAIN_MIN_PX}
        sideWidth={SIDE_CHAIN_PX}
        panelWord="chain"
        panelTitle="The account and the chain — its orders are inside a strike’s dropdown"
        tab={tab}
        onTab={setTab}
        counts={{ open: openRows.length, working, closed: closedRows.length }}
        book={
          tab === 'open' ? (
            <TraceGrid key="open" rows={openRows} columns={openCols} rowKey={r => r.key} onRowClick={r => setName(r.p.contract.ticker, r.p.contract)} autoHeight animate={false} widths={{ qty: 70, avg: 90, close: 84, now: 130, carry: 130 }} emptyText={account.status === 'open' ? 'Nothing open — place an order at the right, or off the chart' : 'This account is closed'} testId="paper-open" />
          ) : tab === 'orders' ? (
            <TraceGrid key="orders" rows={orderRows} columns={orderCols} rowKey={r => r.key} onRowClick={r => setName(r.o.contract.ticker, r.o.contract)} autoHeight animate={false} widths={{ cancel: 56 }} flexes={{ status: 2, what: 1.4 }} emptyText="No orders yet" testId="paper-orders" />
          ) : (
            <TraceGrid key="closed" rows={closedRows} columns={closedCols} rowKey={r => r.key} autoHeight animate={false} widths={{ qty: 70 }} flexes={{ in: 1.4, out: 1.4 }} emptyText="No closed trades yet" testId="paper-closed" />
          )
        }
      />
    </div>
  );
};

/* the refusals, asked against the account as the store holds it now (the ticket asks on every change) */
function optRefusalLive(id: string, d: Parameters<typeof optRefusal>[2]): string | null {
  const a = readPaper().accounts.find(x => x.id === id);
  return a ? optRefusal(a, liveMarket(), d) : 'No account';
}

/** A DRAWN LONG OR SHORT, BEING PLACED: what order it is, what it risks, at what size — placed, or put away */
const MarkCard = ({ plan, qty, onQty, onCancel }: { plan: ReturnType<typeof planOfMark>; qty: number; onQty: (n: number) => void; onCancel: () => void }) => (
  /* under the drawing's own bar (StrikeChart's mark bar sits at the chart's top while the mark is selected) */
  <div className="mt-11 pointer-events-auto w-[min(560px,calc(100%-24px))] rounded-lg border border-borderMuted bg-panel/95 backdrop-blur-md p-3 shadow-[0_14px_40px_rgba(0,0,0,0.45)] animate-soft-in" data-theme="dark" data-paper-mark-card>
    <p className="text-[12px] leading-snug text-textPrimary">{plan.words}</p>
    {plan.money && <p className="mt-1 font-mono text-[10px] tnum text-textMuted">{plan.money}</p>}
    {plan.refused && <p className="mt-1 text-[11px] text-warn">{plan.refused}</p>}
    <div className="mt-2.5 flex items-center gap-2">
      <label className="inline-flex items-center gap-1.5 font-mono text-[10px] text-textMuted">
        Contracts
        <input value={qty} onChange={e => onQty(Math.max(1, Math.min(999, Number(e.target.value.replace(/[^0-9]/g, '')) || 1)))} inputMode="numeric" className="h-7 w-14 px-2 rounded-md border border-borderSubtle bg-panel font-mono text-[12px] tnum text-textPrimary outline-none focus:border-silver/60" data-paper-mark-qty />
      </label>
      <button
        type="button"
        disabled={!!plan.refused}
        onClick={() => {
          plan.place(qty);
          onCancel();
        }}
        className="ml-auto h-8 px-4 rounded-full text-[12px] font-semibold disabled:opacity-35 transition-opacity hover:opacity-90"
        style={{ background: 'rgb(var(--silver-fill))', color: '#0a0a0a' }}
        data-paper-mark-place
      >
        Place it
      </button>
      <button type="button" onClick={onCancel} className="h-8 px-3 rounded-md border border-borderSubtle font-mono text-[10px] text-textSecondary hover:text-textPrimary transition-colors">
        Not now
      </button>
    </div>
  </div>
);

/** ANOTHER TAB HOLDS THE ACCOUNTS (docs/paper-rules.md, "One tab at a time"): this one reads them, and can take them */
const HeldElsewhere = () => (
  <div className={`${card} px-5 py-3 flex items-center gap-4 flex-wrap border-warn/40`} data-paper-elsewhere>
    <div className="min-w-0 flex-1">
      <p className="text-[12px] font-medium text-textPrimary">Your paper accounts are open in another tab.</p>
      <p className="mt-0.5 text-[11px] text-textMuted">This tab only reads them. Taking them here closes whatever is open there, at the last price that tab saw — its simulated market is not this one.</p>
    </div>
    <button type="button" onClick={takeHere} className="h-8 px-4 rounded-full text-[12px] font-semibold transition-opacity hover:opacity-90" style={{ background: 'rgb(var(--silver-fill))', color: '#0a0a0a' }} data-paper-take-here>
      Take them here
    </button>
  </div>
);

export default PaperDesk;
