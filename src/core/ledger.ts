/*
==================================================
  SLAYER TERMINAL - TRADE LEDGER (ledger.ts)
  Self-Auditing Trade Journal & Performance Statistics
==================================================
*/

import type { ExecuteResult, LedgerStats, TradePlan, TradeRecord, TradeStatus } from '../types/market';

const Ledger = (() => {
  let activeTrades: TradeRecord[] = [];
  let closedTrades: TradeRecord[] = [];

  function loadFromStorage(): void {
    try {
      const storedClosed = localStorage.getItem('slayer_closed_trades');
      if (storedClosed) {
        closedTrades = JSON.parse(storedClosed) as TradeRecord[];
      } else {
        closedTrades = [
          {
            id: 'TRD-101',
            ticker: 'SPY',
            direction: 'BULLISH',
            entryPrice: 498.50,
            stopLoss: 495.00,
            target: 502.50,
            exitPrice: 502.50,
            status: 'WIN',
            pnl: 400.00,
            accuracy: 98.5,
            time: '2026-06-29 10:14:02'
          },
          {
            id: 'TRD-102',
            ticker: 'QQQ',
            direction: 'BEARISH',
            entryPrice: 442.10,
            stopLoss: 445.00,
            target: 438.00,
            exitPrice: 445.00,
            status: 'LOSS',
            pnl: -290.00,
            accuracy: 45.2,
            time: '2026-06-29 13:45:10'
          },
          {
            id: 'TRD-103',
            ticker: 'NVDA',
            direction: 'BULLISH',
            entryPrice: 118.20,
            stopLoss: 115.00,
            target: 124.00,
            exitPrice: 124.00,
            status: 'WIN',
            pnl: 580.00,
            accuracy: 99.1,
            time: '2026-06-30 09:30:15'
          }
        ];
        saveToStorage();
      }
    } catch (e) {
      console.error("Failed to load trade ledger", e);
    }
  }

  function saveToStorage(): void {
    try {
      localStorage.setItem('slayer_closed_trades', JSON.stringify(closedTrades));
    } catch (e) {
      console.error("Failed to save trade ledger", e);
    }
  }

  function executePlan(plan: TradePlan): ExecuteResult {
    if (activeTrades.some(t => t.ticker === plan.ticker)) {
      return { success: false, message: `Trade already active for ${plan.ticker}` };
    }

    const trade: TradeRecord = {
      id: 'TRD-' + Math.floor(Math.random() * 9000 + 1000),
      ticker: plan.ticker,
      direction: plan.direction,
      entryPrice: plan.entry,
      stopLoss: plan.stopLoss,
      target: plan.target1,
      status: 'OPEN',
      pnl: 0,
      accuracy: 100.0,
      time: new Date().toISOString().replace('T', ' ').substring(0, 19)
    };

    activeTrades.push(trade);
    return { success: true, trade };
  }

  function updateOpenTrades(ticker: string, currentPrice: number): boolean {
    let updated = false;

    activeTrades = activeTrades.filter(trade => {
      if (trade.ticker !== ticker) return true;

      const pnlFactor = trade.direction === 'BULLISH' ? 1 : -1;
      trade.pnl = (currentPrice - trade.entryPrice) * pnlFactor * 100;

      // Check exit triggers
      let exitMatched = false;
      let status: TradeStatus = 'OPEN';
      let exitPrice = currentPrice;

      if (trade.direction === 'BULLISH') {
        if (currentPrice >= trade.target) {
          exitMatched = true;
          status = 'WIN';
          exitPrice = trade.target;
        } else if (currentPrice <= trade.stopLoss) {
          exitMatched = true;
          status = 'LOSS';
          exitPrice = trade.stopLoss;
        }
      } else {
        if (currentPrice <= trade.target) {
          exitMatched = true;
          status = 'WIN';
          exitPrice = trade.target;
        } else if (currentPrice >= trade.stopLoss) {
          exitMatched = true;
          status = 'LOSS';
          exitPrice = trade.stopLoss;
        }
      }

      if (exitMatched) {
        trade.status = status;
        trade.exitPrice = exitPrice;
        trade.pnl = (exitPrice - trade.entryPrice) * pnlFactor * 100;

        const priceSpan = Math.abs(trade.target - trade.entryPrice);
        trade.accuracy = priceSpan > 0 ? Math.min(100, Math.max(0, Math.round((1 - Math.abs(exitPrice - trade.target) / priceSpan) * 100))) : 100;

        trade.time = new Date().toISOString().replace('T', ' ').substring(0, 19);
        closedTrades.unshift(trade);
        saveToStorage();
        updated = true;
        return false; // Remove from active
      }

      return true;
    });

    return updated;
  }

  function getStats(): LedgerStats {
    const total = closedTrades.length;
    if (total === 0) return { winRate: 0, profitFactor: 0, avgAccuracy: 0, totalPnL: 0, count: 0 };

    const wins = closedTrades.filter(t => t.status === 'WIN');
    const winRate = (wins.length / total) * 100;

    const grossGains = wins.reduce((sum, t) => sum + t.pnl, 0);
    const grossLosses = Math.abs(closedTrades.filter(t => t.status === 'LOSS').reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = grossLosses === 0 ? grossGains : grossGains / grossLosses;

    const avgAccuracy = closedTrades.reduce((sum, t) => sum + t.accuracy, 0) / total;
    const totalPnL = closedTrades.reduce((sum, t) => sum + t.pnl, 0);

    return {
      winRate: Math.round(winRate),
      profitFactor: Number(profitFactor.toFixed(2)),
      avgAccuracy: Math.round(avgAccuracy),
      totalPnL: Number(totalPnL.toFixed(2)),
      count: total
    };
  }

  function clearHistory(): void {
    closedTrades = [];
    activeTrades = [];
    saveToStorage();
  }

  return {
    loadFromStorage,
    getActiveTrades: (): TradeRecord[] => activeTrades,
    getClosedTrades: (): TradeRecord[] => closedTrades,
    executePlan,
    updateOpenTrades,
    getStats,
    clearHistory
  };
})();

export default Ledger;
