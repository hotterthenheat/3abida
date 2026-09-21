/*
==================================================
  SLAYER TERMINAL - THE BLOTTER (pages/paper/Blotter.tsx)

  Under the chart: the positions, the orders, the
  trades and the log — the house grid (TraceGrid)
  with the tape's rows, one tab at a time. A spread
  is one row that opens to its legs. Every cell is
  the engine's own number marked against the
  newest quote; every action is a call on the
  engine.
==================================================
*/

import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import CardTabs from '../../components/ui/CardTabs';
import { TraceGrid } from '../../components/trace/TraceBox';
import type { Column } from '../../components/ui/DataTable';
import { fmtPrice, tagWord, type Instrument } from '../../core/paper/instruments';
import {
  STATUS_WORDS,
  activityFeed,
  cancelOrder,
  closePosition,
  isLive,
  markPosition,
  modifyOrder,
  placeBracket,
  reversePosition,
  typeWord,
  usePaper,
  type Order,
  type Position,
  type Trade,
} from '../../core/paper/engine';
import { Money, ProvenanceChip, fmtClock, fmtHold, fmtStamp, sideInk } from './paperKit';

type Tab = 'positions' | 'orders' | 'trades' | 'log';

interface PositionRow {
  key: string;
  position: Position;
  leg?: { symbol: string; qty: number; avgPrice: number; mark: number | null };
  isLeg: boolean;
  expandable: boolean;
  expanded: boolean;
}

const chip = 'inline-flex items-center h-6 px-2 rounded border border-borderSubtle font-mono text-[9px] uppercase tracking-wider text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors';
const num = (v: ReactNode) => <span className="font-mono text-[11px] tnum text-textPrimary">{v}</span>;

interface BlotterProps {
  instrument: Instrument;
  onPick: (inst: Instrument) => void;
  selectedOrderId: string | null;
  onSelectOrder: (id: string | null) => void;
}

const Blotter = ({ instrument, onPick, selectedOrderId, onSelectOrder }: BlotterProps) => {
  const paper = usePaper();
  const [tab, setTab] = useState<Tab>('positions');
  const [orderFilter, setOrderFilter] = useState<'open' | 'filled' | 'canceled' | 'rejected' | 'all'>('open');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);

  const open = paper.orders.filter(isLive).length;
  const positions = paper.positions.filter(p => p.qty !== 0);

  const posRows = useMemo<PositionRow[]>(() => {
    const out: PositionRow[] = [];
    for (const p of positions) {
      const exp = expanded.has(p.id);
      out.push({ key: p.id, position: p, isLeg: false, expandable: !!p.legs?.length, expanded: exp });
      if (exp && p.legs) {
        const q = paper.quotes[p.id];
        p.legs.forEach((l, i) => out.push({ key: `${p.id}:leg:${i}`, position: p, leg: { ...l, mark: q?.legs?.[i]?.mark ?? null }, isLeg: true, expandable: false, expanded: false }));
      }
    }
    return out;
  }, [positions, expanded, paper.quotes]);

  const posCols = useMemo<Column<PositionRow>[]>(
    () => [
      {
        key: 'symbol',
        header: 'Symbol',
        width: '210px',
        render: r =>
          r.isLeg && r.leg ? (
            <span className="inline-flex items-center gap-2 pl-5 font-mono text-[11px] text-textSecondary">
              <span className={r.leg.qty > 0 ? 'text-bull' : 'text-bear'}>{r.leg.qty > 0 ? 'BUY' : 'SELL'} {Math.abs(r.leg.qty)}</span> {r.leg.symbol}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              {r.expandable ? (
                <button
                  type="button"
                  data-own-click
                  onClick={() => setExpanded(s => { const n = new Set(s); if (n.has(r.position.id)) n.delete(r.position.id); else n.add(r.position.id); return n; })}
                  aria-label={r.expanded ? 'Fold the legs' : 'Show the legs'}
                  className="inline-flex items-center justify-center w-4 h-4 rounded text-textMuted hover:text-textPrimary"
                >
                  {r.expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
              ) : (
                <span className="w-4" />
              )}
              <span className={`font-mono text-[11px] font-semibold ${r.position.instrument.id === instrument.id ? 'text-silver' : 'text-textPrimary'}`}>{tagWord(r.position.instrument)}</span>
            </span>
          ),
      },
      { key: 'side', header: 'Side', width: '70px', render: r => (r.isLeg ? null : <span className={`font-mono text-[10px] font-semibold uppercase ${r.position.qty > 0 ? 'text-bull' : 'text-bear'}`}>{r.position.qty > 0 ? 'Long' : 'Short'}</span>) },
      { key: 'qty', header: 'Qty', width: '64px', align: 'right', render: r => num(r.isLeg && r.leg ? Math.abs(r.leg.qty) : Math.abs(r.position.qty)) },
      { key: 'avg', header: 'Avg entry', width: '104px', align: 'right', render: r => num(r.isLeg && r.leg ? fmtPrice(r.position.instrument, r.leg.avgPrice) : fmtPrice(r.position.instrument, r.position.avgPrice)) },
      { key: 'mark', header: 'Mark', width: '104px', align: 'right', render: r => num(r.isLeg && r.leg ? (r.leg.mark != null ? fmtPrice(r.position.instrument, r.leg.mark) : '—') : fmtPrice(r.position.instrument, markPosition(r.position, paper.quotes[r.position.id]).mark)) },
      { key: 'value', header: 'Market value', width: '110px', align: 'right', render: r => (r.isLeg ? null : num(`$${Math.abs(markPosition(r.position, paper.quotes[r.position.id]).marketValue).toLocaleString('en-US', { maximumFractionDigits: 0 })}`)) },
      { key: 'unreal', header: 'Unrealized', width: '104px', align: 'right', render: r => (r.isLeg ? null : <Money v={markPosition(r.position, paper.quotes[r.position.id]).unrealized} className="text-[11px] font-semibold" />) },
      { key: 'real', header: 'Realized', width: '96px', align: 'right', render: r => (r.isLeg ? null : <Money v={r.position.realized} className="text-[11px]" />) },
      { key: 'pct', header: 'P&L %', width: '76px', align: 'right', render: r => (r.isLeg ? null : num(`${markPosition(r.position, paper.quotes[r.position.id]).pnlPct.toFixed(1)}%`)) },
      { key: 'held', header: 'Holding', width: '84px', align: 'right', render: r => (r.isLeg ? null : num(fmtHold(Date.now() - r.position.openedAt))) },
      {
        key: 'greeks',
        header: 'Δ · Γ · Θ · V · IV',
        width: '190px',
        render: r => {
          if (r.isLeg) return null;
          const g = paper.quotes[r.position.id]?.greeks;
          if (!g) {
            const inst = r.position.instrument;
            if (inst.kind === 'future') return <span className="font-mono text-[10px] tnum text-textSecondary" title="Tick size · tick value · margin held">{inst.tickSize} · ${(inst.tickSize * inst.multiplier).toFixed(2)} · ${(inst.initialMargin * Math.abs(r.position.qty)).toLocaleString('en-US')} margin</span>;
            return null;
          }
          const sign = r.position.qty;
          return <span className="font-mono text-[10px] tnum text-textSecondary">{(g.delta * sign).toFixed(2)} · {(g.gamma * sign).toFixed(3)} · {(g.theta * sign).toFixed(2)} · {(g.vega * sign).toFixed(2)} · {g.iv.toFixed(0)}%</span>;
        },
      },
      {
        key: 'actions',
        header: '',
        /* FOUR BUTTONS NEED FOUR BUTTONS' WORTH: at 230 the last one was cut in
           half by the panel's own edge on every width the desk is read at */
        width: '268px',
        render: r =>
          r.isLeg ? null : (
            <span className="inline-flex items-center gap-1" data-own-click>
              <button type="button" onClick={() => closePosition(r.position.id, 1, 'panel')} className={`${chip} hover:text-bear`}>Close</button>
              <button type="button" onClick={() => closePosition(r.position.id, 0.5, 'panel')} className={chip}>½</button>
              <button type="button" onClick={() => reversePosition(r.position.id, 'panel')} className={chip}>Reverse</button>
              <button type="button" onClick={() => placeBracket(r.position.id, undefined, undefined, 'panel')} className={chip}>Bracket</button>
            </span>
          ),
      },
    ],
    [instrument.id, paper.quotes]
  );

  const orderRows = useMemo(() => {
    const list = [...paper.orders].sort((a, b) => b.createdAt - a.createdAt);
    switch (orderFilter) {
      case 'open':
        return list.filter(isLive);
      case 'filled':
        return list.filter(o => o.status === 'filled');
      case 'canceled':
        return list.filter(o => o.status === 'canceled');
      case 'rejected':
        return list.filter(o => o.status === 'rejected');
      default:
        return list;
    }
  }, [paper.orders, orderFilter]);

  const orderCols = useMemo<Column<Order>[]>(
    () => [
      { key: 'time', header: 'Time', width: '92px', render: o => num(fmtClock(o.createdAt)), sortValue: o => o.createdAt },
      { key: 'symbol', header: 'Symbol', width: '170px', render: o => <span className={`font-mono text-[11px] font-semibold ${o.instrumentId === instrument.id ? 'text-silver' : 'text-textPrimary'}`}>{tagWord(o.instrument)}</span> },
      { key: 'side', header: 'Side', width: '64px', render: o => <span className={`font-mono text-[10px] font-semibold uppercase ${sideInk(o.side)}`}>{o.side}</span> },
      { key: 'qty', header: 'Qty', width: '56px', align: 'right', render: o => num(o.qty) },
      { key: 'filled', header: 'Filled', width: '64px', align: 'right', render: o => num(o.filledQty) },
      { key: 'type', header: 'Type', width: '80px', render: o => <span className="font-mono text-[10px] text-textPrimary">{typeWord(o)}{o.role === 'stop' ? ' · stop' : o.role === 'target' ? ' · target' : o.bracket ? ' · brk' : ''}</span> },
      {
        key: 'price',
        header: 'Limit / stop',
        width: '116px',
        align: 'right',
        render: o => {
          const p = o.type === 'limit' ? o.limitPrice : o.type === 'stop' ? o.stopPrice : null;
          if (p == null) return num('MKT');
          if (isLive(o) && editing?.id === o.id) {
            return (
              <input
                autoFocus
                data-own-click
                value={editing.text}
                onChange={e => setEditing({ id: o.id, text: e.target.value })}
                onKeyDown={e => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    const v = Number(editing.text);
                    if (Number.isFinite(v) && v > 0) modifyOrder(o.id, o.type === 'limit' ? { limitPrice: v } : { stopPrice: v }, 'panel');
                    setEditing(null);
                  }
                  if (e.key === 'Escape') setEditing(null);
                }}
                onBlur={() => setEditing(null)}
                className="w-[92px] h-6 text-right px-1.5 rounded border border-silver/60 bg-inputBg font-mono text-[11px] tnum text-textPrimary outline-none"
              />
            );
          }
          return isLive(o) ? (
            <button type="button" data-own-click onClick={() => setEditing({ id: o.id, text: String(p) })} title="Change the price" className="font-mono text-[11px] tnum text-textPrimary hover:underline underline-offset-2 decoration-textMuted">
              {fmtPrice(o.instrument, p)}
            </button>
          ) : (
            num(fmtPrice(o.instrument, p))
          );
        },
      },
      { key: 'avg', header: 'Avg fill', width: '104px', align: 'right', render: o => num(o.avgFill != null ? fmtPrice(o.instrument, o.avgFill) : '—') },
      {
        key: 'status',
        header: 'Status',
        width: '130px',
        render: o => (
          <span className={`font-mono text-[10px] ${o.status === 'filled' ? 'text-bull' : o.status === 'rejected' ? 'text-bear' : o.status === 'partial' ? 'text-warn' : o.status === 'canceled' ? 'text-textMuted' : 'text-textPrimary'}`} title={o.rejectReason ?? o.events[o.events.length - 1]?.note}>
            {STATUS_WORDS[o.status]}
            {o.status === 'partial' ? ` ${o.filledQty}/${o.qty}` : ''}
          </span>
        ),
      },
      { key: 'prov', header: '', width: '110px', render: o => (o.fills.length ? <ProvenanceChip kind="paper" /> : null) },
      {
        key: 'actions',
        header: '',
        width: '150px',
        render: o =>
          isLive(o) ? (
            <span className="inline-flex items-center gap-1" data-own-click>
              <button type="button" onClick={() => setEditing({ id: o.id, text: String(o.type === 'limit' ? o.limitPrice : o.stopPrice ?? '') })} disabled={o.type === 'market'} className={`${chip}`}>Modify</button>
              <button type="button" onClick={() => cancelOrder(o.id, 'panel')} className={`${chip} hover:text-bear`}>Cancel</button>
            </span>
          ) : null,
      },
    ],
    [instrument.id, editing]
  );

  const tradeRows = useMemo(() => [...paper.trades].sort((a, b) => b.closedAt - a.closedAt), [paper.trades]);
  const tradeCols = useMemo<Column<Trade>[]>(
    () => [
      { key: 'id', header: 'Trade', width: '86px', render: t => num(t.id) },
      { key: 'time', header: 'Closed', width: '118px', render: t => num(fmtStamp(t.closedAt)), sortValue: t => t.closedAt },
      { key: 'symbol', header: 'Symbol', width: '170px', render: t => <span className="font-mono text-[11px] font-semibold text-textPrimary">{tagWord(t.instrument)}</span> },
      { key: 'kind', header: 'Kind', width: '70px', render: t => <span className="font-mono text-[10px] text-textSecondary">{t.kind}</span> },
      { key: 'side', header: 'Side', width: '64px', render: t => <span className={`font-mono text-[10px] font-semibold uppercase ${t.side === 'long' ? 'text-bull' : 'text-bear'}`}>{t.side}</span> },
      { key: 'qty', header: 'Qty', width: '56px', align: 'right', render: t => num(t.qty) },
      { key: 'entry', header: 'Entry', width: '104px', align: 'right', render: t => num(fmtPrice(t.instrument, t.entryAvg)) },
      { key: 'exit', header: 'Exit', width: '104px', align: 'right', render: t => num(fmtPrice(t.instrument, t.exitAvg)) },
      { key: 'fees', header: 'Fees', width: '72px', align: 'right', render: t => num(`$${t.fees.toFixed(2)}`) },
      { key: 'slip', header: 'Slippage', width: '84px', align: 'right', render: t => num(`$${t.slippage.toFixed(2)}`) },
      { key: 'real', header: 'Realized', width: '104px', align: 'right', render: t => <Money v={t.realized} className="text-[11px] font-semibold" />, sortValue: t => t.realized },
      { key: 'ret', header: 'Return', width: '80px', align: 'right', render: t => <span className={`font-mono text-[11px] tnum ${t.returnPct > 0 ? 'text-bull' : t.returnPct < 0 ? 'text-bear' : 'text-textPrimary'}`}>{t.returnPct > 0 ? '+' : ''}{t.returnPct.toFixed(1)}%</span> },
      { key: 'hold', header: 'Holding', width: '84px', align: 'right', render: t => num(fmtHold(t.holdMs)) },
      { key: 'legs', header: 'Legs', render: t => (t.legs ? <span className="font-mono text-[10px] text-textSecondary">{t.legs.map(l => `${l.qty > 0 ? '+' : ''}${l.qty} ${l.symbol.split(' ').slice(1, 2).join('')} ${l.entry.toFixed(2)}→${l.exit.toFixed(2)}`).join(' · ')}</span> : null) },
    ],
    []
  );

  const logRows = useMemo(() => activityFeed(paper, 300).map((r, i) => ({ ...r, key: `${r.orderId}:${r.at}:${i}` })), [paper]);
  const logCols = useMemo<Column<(typeof logRows)[number]>[]>(
    () => [
      { key: 'time', header: 'Time', width: '92px', render: r => num(fmtClock(r.at)) },
      { key: 'symbol', header: 'Symbol', width: '170px', render: r => <span className="font-mono text-[11px] font-semibold text-textPrimary">{r.symbol}</span> },
      { key: 'kind', header: 'Event', width: '110px', render: r => <span className={`font-mono text-[10px] uppercase tracking-wider ${r.kind === 'fill' || r.kind === 'filled' ? 'text-bull' : r.kind === 'rejected' ? 'text-bear' : r.kind === 'canceled' ? 'text-textMuted' : 'text-textSecondary'}`}>{r.kind}</span> },
      { key: 'note', header: 'What happened', render: r => <span className="font-mono text-[10px] text-textSecondary">{r.note}</span> },
    ],
    []
  );

  const tabs = [
    { value: 'positions', label: `Positions${positions.length ? ` ${positions.length}` : ''}` },
    { value: 'orders', label: `Orders${open ? ` ${open}` : ''}` },
    { value: 'trades', label: `Trades${paper.trades.length ? ` ${paper.trades.length}` : ''}` },
    { value: 'log', label: 'Log' },
  ] as const;

  return (
    <div className="h-full flex flex-col overflow-hidden rounded-md border border-borderSubtle bg-panel" data-blotter={tab}>
      <div className="shrink-0 flex items-center gap-3 px-2.5 min-h-8 border-b border-borderSubtle/70">
        <CardTabs ariaLabel="The blotter" options={tabs} value={tab} onChange={setTab} />
        {tab === 'orders' && (
          <span className="ml-auto inline-flex items-center gap-1">
            {(['open', 'filled', 'canceled', 'rejected', 'all'] as const).map(f => (
              <button key={f} type="button" onClick={() => setOrderFilter(f)} className={`h-6 px-2 rounded font-mono text-[9px] uppercase tracking-wider transition-colors ${orderFilter === f ? 'bg-ink/[0.08] text-textPrimary' : 'text-textMuted hover:text-textPrimary'}`}>
                {f}
              </button>
            ))}
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0">
        {tab === 'positions' && (
          <TraceGrid<PositionRow> rows={posRows} columns={posCols} rowKey={r => r.key} height="100%" onRowClick={r => onPick(r.position.instrument)} selectedKey={instrument.id} animate={false} emptyText="No paper positions" emptyBody="Trade the chart and what you are holding shows here." testId="paper-positions" />
        )}
        {tab === 'orders' && (
          <TraceGrid<Order> rows={orderRows} columns={orderCols} rowKey={o => o.id} height="100%" onRowClick={o => { onSelectOrder(isLive(o) ? o.id : null); if (o.instrumentId !== instrument.id) onPick(o.instrument); }} selectedKey={selectedOrderId} animate={false} emptyText={orderFilter === 'open' ? 'No working orders' : 'Nothing here yet'} emptyBody={orderFilter === 'open' ? 'An order you place rests here until it fills or you pull it.' : 'Orders land here as you place them.'} testId="paper-orders" />
        )}
        {tab === 'trades' && <TraceGrid<Trade> rows={tradeRows} columns={tradeCols} rowKey={t => t.id} height="100%" animate={false} emptyText="No completed trades" emptyBody="A position you close is written here with what it did." testId="paper-trades" />}
        {tab === 'log' && <TraceGrid rows={logRows} columns={logCols} rowKey={r => r.key} height="100%" animate={false} emptyText="Nothing has happened yet" emptyBody="Every fill, pull and guard the desk applies is logged here." testId="paper-log" />}
      </div>
    </div>
  );
};

export default Blotter;
