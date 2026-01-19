import { useMemo } from 'react';
import { parseTradeDateToUserTz } from '../utils/dateUtils';

/**
 * Detect revenge trading: trades opened within 30 minutes after closing a losing trade
 * Definition: delta = trade.date_open - last_loss.date_close
 * If 0 < delta <= 30min → revenge = true
 */
export function detectRevengeTrades(trades, userTimezone = 'UTC') {
  const sorted = [...trades].sort((a, b) => 
    new Date(a.date_open || a.date).getTime() - new Date(b.date_open || b.date).getTime()
  );

  const revengeTrades = [];

  sorted.forEach((trade, idx) => {
    const tradeOpenTime = new Date(trade.date_open || trade.date).getTime();
    
    // Find all CLOSED losses before this trade
    const previousLosses = sorted.slice(0, idx).filter(t => 
      t.close_price && 
      t.date_close && 
      (t.pnl_usd || 0) < -0.5 && // Significant loss (not BE)
      new Date(t.date_close).getTime() < tradeOpenTime
    );

    if (previousLosses.length === 0) return;

    // Get the most recent loss
    const lastLoss = previousLosses.sort((a, b) => 
      new Date(b.date_close).getTime() - new Date(a.date_close).getTime()
    )[0];

    const lastLossCloseTime = new Date(lastLoss.date_close).getTime();
    const deltaMinutes = (tradeOpenTime - lastLossCloseTime) / (1000 * 60);

    // Revenge if opened within 30 minutes after loss close
    if (deltaMinutes > 0 && deltaMinutes <= 30) {
      revengeTrades.push({
        trade,
        lastLoss,
        deltaMinutes: deltaMinutes.toFixed(1),
        pnl: trade.pnl_usd || 0
      });
    }
  });

  return revengeTrades;
}

export default function RevengeTradingDetector({ trades, userTimezone }) {
  const revengeTrades = useMemo(() => 
    detectRevengeTrades(trades, userTimezone), 
    [trades, userTimezone]
  );

  return {
    count: revengeTrades.length,
    trades: revengeTrades,
    avgPnl: revengeTrades.length > 0 
      ? revengeTrades.reduce((s, rt) => s + rt.pnl, 0) / revengeTrades.length 
      : 0,
    totalPnl: revengeTrades.reduce((s, rt) => s + rt.pnl, 0)
  };
}