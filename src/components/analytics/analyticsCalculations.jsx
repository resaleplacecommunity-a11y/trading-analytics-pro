// Unified calculation engine for Analytics Hub
// All metrics must use these functions to ensure consistency
import { formatInTimeZone } from 'date-fns-tz';

export const formatNumber = (num) => {
  if (num === undefined || num === null || num === '' || isNaN(num)) return '—';
  const n = parseFloat(num);
  if (isNaN(n)) return '—';
  return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
};

export const formatDecimal = (num, decimals = 2) => {
  if (num === undefined || num === null || num === '' || isNaN(num)) return '—';
  const n = parseFloat(num);
  if (isNaN(n)) return '—';
  return n.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

export const formatPercent = (num, decimals = 1) => {
  if (num === undefined || num === null || num === '' || isNaN(num)) return '—';
  const n = parseFloat(num);
  if (isNaN(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(decimals)}%`;
};

export const formatPrice = (price) => {
  if (price === undefined || price === null || price === '' || isNaN(price)) return '—';
  const p = parseFloat(price);
  if (isNaN(p)) return '—';
  
  if (Math.abs(p) >= 1) {
    const str = p.toPrecision(4);
    return `$${parseFloat(str)}`;
  }
  
  const str = p.toFixed(20);
  const match = str.match(/\.0*([1-9]\d{0,3})/);
  if (match) {
    const zeros = str.indexOf(match[1]) - str.indexOf('.') - 1;
    return `$${p.toFixed(zeros + 4).replace(/0+$/, '')}`;
  }
  return `$${p.toFixed(4).replace(/\.?0+$/, '')}`;
};

// Calculate PNL for a trade
export const calculateTradePNL = (trade) => {
  if (!trade.close_price || !trade.entry_price || !trade.position_size) return 0;
  
  const qty = trade.position_size / trade.entry_price;
  const isLong = trade.direction === 'Long';
  const priceMove = isLong ? (trade.close_price - trade.entry_price) : (trade.entry_price - trade.close_price);
  
  return priceMove * qty;
};

// Calculate current risk for open trade
export const calculateCurrentRisk = (trade, currentBalance) => {
  if (!trade.entry_price || !trade.stop_price || !trade.position_size) return 0;
  
  const stopDistance = Math.abs(trade.entry_price - trade.stop_price);
  if (stopDistance < 0.0001) return 0; // Stop at BE
  
  const riskUsd = (stopDistance / trade.entry_price) * trade.position_size;
  const balance = trade.account_balance_at_entry || currentBalance || 100000;
  const riskPercent = (riskUsd / balance) * 100;
  
  return { riskUsd, riskPercent };
};

// Calculate potential profit for open trade
export const calculatePotentialProfit = (trade, currentBalance) => {
  if (!trade.entry_price || !trade.take_price || !trade.position_size) return 0;
  
  const takeDistance = Math.abs(trade.take_price - trade.entry_price);
  const potentialUsd = (takeDistance / trade.entry_price) * trade.position_size;
  const balance = trade.account_balance_at_entry || currentBalance || 100000;
  const potentialPercent = (potentialUsd / balance) * 100;
  
  return { potentialUsd, potentialPercent };
};

// Calculate R Multiple
export const calculateRMultiple = (trade) => {
  if (!trade.close_price) return null;
  
  const pnlUsd = trade.pnl_usd || calculateTradePNL(trade);
  const originalRisk = trade.original_risk_usd || trade.max_risk_usd || trade.risk_usd;
  
  if (!originalRisk || originalRisk === 0) {
    if (pnlUsd === 0) return 0;
    return null; // Show "—"
  }
  
  return pnlUsd / originalRisk;
};

// Aggregate metrics for closed trades
export const calculateClosedMetrics = (trades) => {
  const closed = trades.filter(t => t.close_price);
  
  if (closed.length === 0) {
    return {
      netPnlUsd: 0,
      netPnlPercent: 0,
      winrate: 0,
      avgR: 0,
      profitFactor: '—',
      expectancy: 0,
      tradesCount: 0,
      wins: 0,
      losses: 0,
      breakevens: 0,
      grossProfit: 0,
      grossLoss: 0
    };
  }
  
  const pnls = closed.map(t => t.pnl_usd || calculateTradePNL(t));
  const netPnlUsd = pnls.reduce((sum, p) => sum + p, 0);
  
  // Net PNL as % of starting balance
  const startingBalance = closed[0]?.account_balance_at_entry || 100000;
  const netPnlPercent = (netPnlUsd / startingBalance) * 100;
  
  // BE threshold: ±0.5$ or ±0.01%
  const epsilon = 0.5;
  const wins = pnls.filter((p, idx) => {
    const pnlPercent = Math.abs((p / (closed[idx].account_balance_at_entry || startingBalance)) * 100);
    return p > epsilon && pnlPercent > 0.01;
  });
  const losses = pnls.filter((p, idx) => {
    const pnlPercent = Math.abs((p / (closed[idx].account_balance_at_entry || startingBalance)) * 100);
    return p < -epsilon && pnlPercent > 0.01;
  });
  const breakevens = closed.filter((t, idx) => {
    const p = pnls[idx];
    const pnlPercent = Math.abs((p / (t.account_balance_at_entry || startingBalance)) * 100);
    return Math.abs(p) <= epsilon || pnlPercent <= 0.01;
  });
  
  // Winrate excludes BE
  const winrate = (wins.length + losses.length) > 0 ? (wins.length / (wins.length + losses.length)) * 100 : 0;
  const lossrate = (wins.length + losses.length) > 0 ? (losses.length / (wins.length + losses.length)) * 100 : 0;
  
  const avgWin = wins.length > 0 ? wins.reduce((s, w) => s + w, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, l) => s + l, 0) / losses.length) : 0;
  
  const expectancy = (winrate / 100 * avgWin) - (lossrate / 100 * avgLoss);
  
  const grossProfit = wins.reduce((s, w) => s + w, 0);
  const grossLoss = Math.abs(losses.reduce((s, l) => s + l, 0));
  
  let profitFactor;
  if (grossLoss === 0 && grossProfit > 0) profitFactor = 'N/A';
  else if (grossProfit === 0 && grossLoss > 0) profitFactor = 0;
  else if (grossLoss === 0 && grossProfit === 0) profitFactor = 'N/A';
  else profitFactor = grossProfit / grossLoss;
  
  // Average R
  const rMultiples = closed.map(t => calculateRMultiple(t)).filter(r => r !== null);
  const avgR = rMultiples.length > 0 ? rMultiples.reduce((s, r) => s + r, 0) / rMultiples.length : 0;
  
  return {
    netPnlUsd,
    netPnlPercent,
    winrate,
    avgR,
    profitFactor,
    expectancy,
    tradesCount: closed.length,
    wins: wins.length,
    losses: losses.length,
    breakevens: breakevens.length,
    grossProfit,
    grossLoss
  };
};

// Calculate equity curve
export const calculateEquityCurve = (trades, startBalance = 100000) => {
  // Collect all PNL events (closed trades + partial closes)
  const pnlEvents = [];
  
  // Add closed trades
  trades.filter(t => t.close_price).forEach(t => {
    pnlEvents.push({
      date: new Date(t.date_close || t.date),
      pnl: t.pnl_usd || calculateTradePNL(t),
      type: 'close'
    });
  });
  
  // Add partial closes from open trades
  trades.filter(t => !t.close_price && t.partial_closes).forEach(t => {
    try {
      const partials = JSON.parse(t.partial_closes);
      partials.forEach(pc => {
        if (pc.timestamp && pc.pnl_usd) {
          pnlEvents.push({
            date: new Date(pc.timestamp),
            pnl: pc.pnl_usd,
            type: 'partial'
          });
        }
      });
    } catch {}
  });
  
  // Sort all events chronologically
  pnlEvents.sort((a, b) => a.date - b.date);
  
  const points = [{ date: 'Start', equity: startBalance, balance: startBalance }];
  let balance = startBalance;
  
  pnlEvents.forEach(event => {
    balance += event.pnl;
    points.push({
      date: event.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      equity: balance,
      balance: balance,
      pnl: event.pnl
    });
  });
  
  return points;
};

// Calculate max drawdown from peak (правильный вариант)
export const calculateMaxDrawdown = (equityCurve, startBalance = 100000) => {
  let maxDrawdown = 0;
  let maxDrawdownUsd = 0;
  let peak = startBalance;
  
  equityCurve.forEach(point => {
    if (point.equity > peak) {
      peak = point.equity;
    }
    
    const drawdown = ((point.equity - peak) / peak) * 100;
    const drawdownUsd = point.equity - peak;
    
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownUsd = drawdownUsd;
    }
  });
  
  return {
    percent: Math.abs(maxDrawdown),
    usd: Math.abs(maxDrawdownUsd)
  };
};

// Aggregate open trades metrics
export const calculateOpenMetrics = (trades, currentBalance) => {
  const open = trades.filter(t => !t.close_price);
  
  let totalRiskUsd = 0;
  let totalPotentialUsd = 0;
  
  open.forEach(trade => {
    const { riskUsd } = calculateCurrentRisk(trade, currentBalance);
    const { potentialUsd } = calculatePotentialProfit(trade, currentBalance);
    totalRiskUsd += riskUsd;
    totalPotentialUsd += potentialUsd;
  });
  
  const totalRiskPercent = currentBalance > 0 ? (totalRiskUsd / currentBalance) * 100 : 0;
  const totalPotentialPercent = currentBalance > 0 ? (totalPotentialUsd / currentBalance) * 100 : 0;
  
  let totalRR;
  if (totalRiskUsd === 0 || totalRiskUsd < 0.01) {
    totalRR = 'NO_RISK'; // Special flag
  } else {
    totalRR = totalPotentialUsd / totalRiskUsd;
  }
  
  return {
    openCount: open.length,
    totalRiskUsd,
    totalRiskPercent,
    totalPotentialUsd,
    totalPotentialPercent,
    totalRR
  };
};

// Discipline score (0-100) - синхронизовано с логикой красной иконки
export const calculateDisciplineScore = (trades) => {
  if (trades.length === 0) return 0;
  
  const openTrades = trades.filter(t => !t.close_price);
  const closedTrades = trades.filter(t => t.close_price);
  
  let completeCount = 0;
  
  // Check open trades
  openTrades.forEach(t => {
    const hasStrategy = !!t.strategy_tag;
    const hasTimeframe = !!t.timeframe;
    const hasConfidence = t.confidence_level && t.confidence_level > 0;
    const hasReason = t.entry_reason && t.entry_reason.trim().length > 0;
    const hasStop = !!t.stop_price;
    const hasTake = !!t.take_price;
    
    if (hasStrategy && hasTimeframe && hasConfidence && hasReason && hasStop && hasTake) {
      completeCount++;
    }
  });
  
  // Check closed trades
  closedTrades.forEach(t => {
    const hasAnalysis = t.trade_analysis && t.trade_analysis.trim().length > 0;
    const hasViolations = t.violation_tags && t.violation_tags.trim().length > 0;
    
    if (hasAnalysis && hasViolations) {
      completeCount++;
    }
  });
  
  const disciplineIndex = trades.length > 0 ? Math.round((completeCount / trades.length) * 100) : 0;
  
  return disciplineIndex;
};

// Calculate trade exit metrics
export const calculateExitMetrics = (trades) => {
  const closed = trades.filter(t => t.close_price);
  if (closed.length === 0) return {
    stopLosses: 0,
    takeProfits: 0,
    breakeven: 0,
    manualCloses: 0,
    partialCloses: 0,
    avgPartialCount: 0,
    tradesWithPartials: 0,
    avgAdds: 0,
    tradesWithAdds: 0,
    total: 0
  };

  let stopLosses = 0;
  let takeProfits = 0;
  let breakeven = 0;
  let manualCloses = 0;
  let partialCloses = 0;
  let totalPartials = 0;
  let tradesWithPartials = 0;
  let totalAdds = 0;
  let tradesWithAdds = 0;

  closed.forEach(t => {
    const pnl = t.pnl_usd || 0;
    const entry = t.entry_price || 0;
    const close = t.close_price || 0;
    const stop = t.stop_price || 0;
    const take = t.take_price || 0;
    const balance = t.account_balance_at_entry || 100000;
    const pnlPercent = Math.abs((pnl / balance) * 100);

    // Check exit type
    const priceThreshold = entry * 0.001; // 0.1% threshold
    const hitStop = Math.abs(close - stop) < priceThreshold;
    const hitTake = Math.abs(close - take) < priceThreshold;

    // BE: ±0.5$ or ±0.01%
    if (Math.abs(pnl) <= 0.5 || pnlPercent <= 0.01) {
      breakeven++;
    } else if (hitStop) {
      stopLosses++;
    } else if (hitTake) {
      takeProfits++;
    } else {
      manualCloses++;
    }

    // Partial closes
    if (t.partial_closes) {
      try {
        const partials = JSON.parse(t.partial_closes);
        if (Array.isArray(partials) && partials.length > 0) {
          tradesWithPartials++;
          totalPartials += partials.length;
        }
      } catch (e) {}
    }

    // Adds
    if (t.adds_history) {
      try {
        const adds = JSON.parse(t.adds_history);
        if (Array.isArray(adds) && adds.length > 0) {
          tradesWithAdds++;
          totalAdds += adds.length;
        }
      } catch (e) {}
    }
  });

  return {
    stopLosses,
    takeProfits,
    breakeven,
    manualCloses,
    partialCloses: tradesWithPartials,
    avgPartialCount: tradesWithPartials > 0 ? totalPartials / tradesWithPartials : 0,
    tradesWithPartials,
    avgAdds: tradesWithAdds > 0 ? totalAdds / tradesWithAdds : 0,
    tradesWithAdds,
    total: closed.length
  };
}

// Get exit type for a trade
export const getExitType = (trade) => {
  if (!trade.close_price) return 'Open';
  
  const pnl = trade.pnl_usd || 0;
  const balance = trade.account_balance_at_entry || 100000;
  const pnlPercent = Math.abs((pnl / balance) * 100);
  const entry = trade.entry_price || 0;
  const close = trade.close_price || 0;
  const stop = trade.stop_price || 0;
  const take = trade.take_price || 0;
  
  // BE threshold: ±0.5$ or ±0.01%
  if (Math.abs(pnl) <= 0.5 || pnlPercent <= 0.01) {
    return 'Breakeven';
  }
  
  const priceThreshold = entry * 0.001;
  const hitStop = Math.abs(close - stop) < priceThreshold;
  const hitTake = Math.abs(close - take) < priceThreshold;
  
  if (hitStop) return 'Stop';
  if (hitTake) return 'Take';
  return 'Manual';
}

// Calculate daily stats for calendar
export const calculateDailyStats = (trades, userTimezone = 'UTC') => {
  const dailyMap = {};
  
  // Add closed trades
  trades.filter(t => t.close_price).forEach(t => {
    const dateStr = t.date_close || t.date_open || t.date;
    if (!dateStr) return;
    
    // Parse date and convert to user timezone
    let date;
    try {
      // Handle different formats: with/without Z, with space instead of T
      const normalized = dateStr.replace(' ', 'T');
      const withZ = normalized.endsWith('Z') ? normalized : normalized + 'Z';
      date = formatInTimeZone(withZ, userTimezone, 'yyyy-MM-dd');
    } catch (e) {
      console.error('Error parsing date for calendar:', dateStr, e);
      return;
    }
    
    if (!dailyMap[date]) {
      dailyMap[date] = { pnlUsd: 0, pnlPercent: 0, count: 0, trades: [] };
    }
    const pnl = t.pnl_usd || 0;
    const balance = t.account_balance_at_entry || 100000;
    dailyMap[date].pnlUsd += pnl;
    dailyMap[date].pnlPercent += (pnl / balance) * 100;
    dailyMap[date].count++;
    dailyMap[date].trades.push(t);
  });
  
  // Add partial closes from open trades
  trades.filter(t => !t.close_price && t.partial_closes).forEach(t => {
    try {
      const partials = JSON.parse(t.partial_closes);
      partials.forEach(pc => {
        if (pc.timestamp && pc.pnl_usd) {
          let date;
          try {
            const normalized = pc.timestamp.replace(' ', 'T');
            const withZ = normalized.endsWith('Z') ? normalized : normalized + 'Z';
            date = formatInTimeZone(withZ, userTimezone, 'yyyy-MM-dd');
          } catch (e) {
            console.error('Error parsing partial close timestamp:', pc.timestamp, e);
            return;
          }
          
          if (!dailyMap[date]) {
            dailyMap[date] = { pnlUsd: 0, pnlPercent: 0, count: 0, trades: [] };
          }
          const balance = t.account_balance_at_entry || 100000;
          dailyMap[date].pnlUsd += pc.pnl_usd;
          dailyMap[date].pnlPercent += (pc.pnl_usd / balance) * 100;
          // Add trade to list if not already there (for calendar display)
          if (!dailyMap[date].trades.find(tr => tr.id === t.id)) {
            dailyMap[date].trades.push(t);
          }
        }
      });
    } catch (e) {
      console.error('Error processing partial closes:', e);
    }
  });

  return dailyMap;
};