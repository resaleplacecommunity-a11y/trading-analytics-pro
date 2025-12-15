/**
 * Unified trade calculations - single source of truth
 * All UI must use these functions to ensure consistency
 */

/**
 * Parse entries array from trade
 * @param {Object} trade
 * @returns {Array} [{price, size_usd, timestamp}]
 */
export function parseEntries(trade) {
  try {
    if (trade.entries) return JSON.parse(trade.entries);
  } catch {}
  
  // Fallback for old trades
  if (trade.entry_price && trade.position_size) {
    return [{
      price: trade.entry_price,
      size_usd: trade.position_size,
      timestamp: trade.date_open || trade.date
    }];
  }
  
  return [];
}

/**
 * Parse partial closes from trade
 * @param {Object} trade
 * @returns {Array} [{percent, price, timestamp, pnl_usd}]
 */
export function parsePartials(trade) {
  try {
    if (trade.partials) return JSON.parse(trade.partials);
    if (trade.partial_closes) return JSON.parse(trade.partial_closes);
  } catch {}
  return [];
}

/**
 * Parse stop history from trade
 * @param {Object} trade
 * @returns {Array} [{stop_price, timestamp}]
 */
export function parseStopHistory(trade) {
  try {
    if (trade.stop_history) return JSON.parse(trade.stop_history);
  } catch {}
  
  // Fallback
  if (trade.stop_price_current || trade.stop_price) {
    return [{
      stop_price: trade.stop_price_current || trade.stop_price,
      timestamp: trade.date_open || trade.date
    }];
  }
  
  return [];
}

/**
 * Get direction sign
 * @param {string} direction - "Long" or "Short"
 * @returns {number} +1 for Long, -1 for Short
 */
export function getDirectionSign(direction) {
  return direction === 'Long' ? 1 : -1;
}

/**
 * Calculate weighted average entry price and total quantity
 * @param {Array} entries - [{price, size_usd, timestamp}]
 * @returns {Object} {avgEntry, qtyTotal}
 */
export function calculateAvgEntry(entries) {
  if (!entries || entries.length === 0) return { avgEntry: 0, qtyTotal: 0 };
  
  let totalSizeUsd = 0;
  let totalQty = 0;
  
  entries.forEach(entry => {
    const qty = entry.size_usd / entry.price;
    totalQty += qty;
    totalSizeUsd += entry.size_usd;
  });
  
  const avgEntry = totalQty > 0 ? totalSizeUsd / totalQty : 0;
  
  return { avgEntry, qtyTotal: totalQty };
}

/**
 * Calculate remaining quantity after partial closes
 * @param {number} qtyTotal - Total quantity from entries
 * @param {Array} partials - [{percent, price, timestamp}]
 * @returns {number} Remaining quantity
 */
export function calculateRemainingQty(qtyTotal, partials) {
  if (!partials || partials.length === 0) return qtyTotal;
  
  let remaining = qtyTotal;
  
  partials.forEach(partial => {
    const closedQty = remaining * (partial.percent / 100);
    remaining -= closedQty;
  });
  
  return remaining;
}

/**
 * Calculate risk in USD and percent
 * @param {Object} params
 * @returns {Object} {riskUsd, riskPct}
 */
export function calculateRisk(params) {
  const { avgEntry, qtyRemaining, stopPrice, balanceRef, sign } = params;
  
  if (!stopPrice || stopPrice === 0 || !qtyRemaining) {
    return { riskUsd: 0, riskPct: 0 };
  }
  
  const riskUsd = Math.max(0, sign * (avgEntry - stopPrice) * qtyRemaining);
  const riskPct = balanceRef > 0 ? (riskUsd / balanceRef) * 100 : 0;
  
  return { riskUsd, riskPct };
}

/**
 * Calculate take profit potential in USD and percent
 * @param {Object} params
 * @returns {Object} {takeUsd, takePct}
 */
export function calculateTake(params) {
  const { avgEntry, qtyRemaining, takePrice, balanceRef, sign } = params;
  
  if (!takePrice || takePrice === 0 || !qtyRemaining) {
    return { takeUsd: 0, takePct: 0 };
  }
  
  const takeUsd = Math.max(0, sign * (takePrice - avgEntry) * qtyRemaining);
  const takePct = balanceRef > 0 ? (takeUsd / balanceRef) * 100 : 0;
  
  return { takeUsd, takePct };
}

/**
 * Calculate total realized PNL from partials and final close
 * @param {Object} params
 * @returns {Object} {pnlTotalUsd, pnlTotalPct}
 */
export function calculateTotalPnl(params) {
  const { avgEntry, partials, closePriceFinal, qtyTotal, balanceRef, sign } = params;
  
  let pnlTotalUsd = 0;
  
  // Add partial PNLs
  if (partials && partials.length > 0) {
    partials.forEach(partial => {
      pnlTotalUsd += partial.pnl_usd || 0;
    });
  }
  
  // Add final close PNL
  if (closePriceFinal) {
    // Calculate remaining qty after partials
    const qtyRemaining = calculateRemainingQty(qtyTotal, partials);
    const finalPnl = sign * (closePriceFinal - avgEntry) * qtyRemaining;
    pnlTotalUsd += finalPnl;
  }
  
  const pnlTotalPct = balanceRef > 0 ? (pnlTotalUsd / balanceRef) * 100 : 0;
  
  return { pnlTotalUsd, pnlTotalPct };
}

/**
 * Calculate R-multiple (uses max_risk_usd)
 * @param {number} pnlTotalUsd
 * @param {number} maxRiskUsd
 * @returns {number} R-multiple
 */
export function calculateRMultiple(pnlTotalUsd, maxRiskUsd) {
  if (!maxRiskUsd || maxRiskUsd === 0) return 0;
  return pnlTotalUsd / maxRiskUsd;
}

/**
 * Format RR display for open trades
 * @param {number} riskUsd
 * @param {number} takeUsd
 * @param {number} takePct
 * @returns {string} Display string like "1:3" or "0:2%"
 */
export function formatRRDisplay(riskUsd, takeUsd, takePct) {
  if (riskUsd > 0 && takeUsd > 0) {
    const ratio = Math.round(takeUsd / riskUsd);
    return `1:${ratio}`;
  }
  
  if (riskUsd === 0 && takePct > 0) {
    return `0:${takePct.toFixed(0)}%`;
  }
  
  if (takeUsd === 0 && riskUsd > 0) {
    return '1:0';
  }
  
  return '0:0';
}

/**
 * Get RR color class
 * @param {number} riskUsd
 * @param {number} takeUsd
 * @returns {string} Tailwind color class
 */
export function getRRColorClass(riskUsd, takeUsd) {
  if (riskUsd === 0) return 'text-emerald-400';
  if (takeUsd === 0) return 'text-red-400';
  
  const ratio = takeUsd / riskUsd;
  return ratio >= 2 ? 'text-emerald-400' : 'text-red-400';
}

/**
 * Process full trade data with all calculations
 * @param {Object} trade - Raw trade object
 * @param {number} currentBalance - Current account balance (for open trades display)
 * @returns {Object} Processed trade with all calculated fields
 */
export function processTradeCalculations(trade, currentBalance) {
  const entries = parseEntries(trade);
  const partials = parsePartials(trade);
  const stopHistory = parseStopHistory(trade);
  const sign = getDirectionSign(trade.direction);
  
  const { avgEntry, qtyTotal } = calculateAvgEntry(entries);
  const qtyRemaining = calculateRemainingQty(qtyTotal, partials);
  
  const balanceRef = trade.balance_entry || currentBalance;
  const stopPrice = trade.stop_price_current || trade.stop_price || 0;
  const takePrice = trade.take_price || 0;
  
  // Calculate current risk/take (for open trades)
  const { riskUsd, riskPct } = calculateRisk({
    avgEntry,
    qtyRemaining,
    stopPrice,
    balanceRef,
    sign
  });
  
  const { takeUsd, takePct } = calculateTake({
    avgEntry,
    qtyRemaining,
    takePrice,
    balanceRef,
    sign
  });
  
  // Calculate total PNL (for closed trades)
  const { pnlTotalUsd, pnlTotalPct } = calculateTotalPnl({
    avgEntry,
    partials,
    closePriceFinal: trade.close_price_final || trade.close_price,
    qtyTotal,
    balanceRef,
    sign
  });
  
  // R-multiple
  const maxRiskUsd = trade.max_risk_usd || riskUsd;
  const rMultiple = calculateRMultiple(pnlTotalUsd, maxRiskUsd);
  
  // RR display
  const rrDisplay = formatRRDisplay(riskUsd, takeUsd, takePct);
  const rrColorClass = getRRColorClass(riskUsd, takeUsd);
  
  return {
    ...trade,
    // Parsed arrays
    entries,
    partials,
    stopHistory,
    // Calculated values
    avgEntry,
    qtyTotal,
    qtyRemaining,
    sign,
    // Risk/Take (current)
    riskUsd,
    riskPct,
    takeUsd,
    takePct,
    // PNL (total realized)
    pnlTotalUsd,
    pnlTotalPct,
    // R-multiple
    maxRiskUsd,
    rMultiple,
    // Display helpers
    rrDisplay,
    rrColorClass,
    // Status helpers
    isOpen: trade.status === 'OPEN' || !trade.close_price_final,
    isClosed: trade.status === 'CLOSED' || !!trade.close_price_final
  };
}

/**
 * Calculate aggregate stats for open trades
 * @param {Array} openTrades - Array of processed open trades
 * @param {number} currentBalance
 * @returns {Object} Aggregate statistics
 */
export function calculateOpenTradesStats(openTrades, currentBalance) {
  let totalRiskUsd = 0;
  let totalTakeUsd = 0;
  
  openTrades.forEach(trade => {
    totalRiskUsd += trade.riskUsd || 0;
    totalTakeUsd += trade.takeUsd || 0;
  });
  
  const totalRiskPct = currentBalance > 0 ? (totalRiskUsd / currentBalance) * 100 : 0;
  const totalTakePct = currentBalance > 0 ? (totalTakeUsd / currentBalance) * 100 : 0;
  
  let totalRRDisplay = '—';
  if (openTrades.length > 0) {
    if (totalRiskUsd === 0) {
      totalRRDisplay = 'NO RISK BRO ONLY PROFIT';
    } else if (totalRiskUsd > 0) {
      totalRRDisplay = `1:${Math.round(totalTakeUsd / totalRiskUsd)}`;
    }
  }
  
  return {
    totalRiskUsd,
    totalRiskPct,
    totalTakeUsd,
    totalTakePct,
    totalRRDisplay
  };
}