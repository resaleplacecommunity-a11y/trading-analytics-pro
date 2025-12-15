import { subDays, startOfMonth, startOfYear, startOfDay } from 'date-fns';

/**
 * Apply global filters to trades array
 * @param {Array} trades - All trades
 * @param {Object} filters - Filter configuration
 * @returns {Array} Filtered trades
 */
export function applyFilters(trades, filters) {
  if (!trades || trades.length === 0) return [];

  // Calculate date range
  const today = startOfDay(new Date());
  let rangeStart = today;
  
  if (filters.dateRange === 'today') rangeStart = today;
  else if (filters.dateRange === 'week') rangeStart = subDays(today, 7);
  else if (filters.dateRange === 'month') rangeStart = subDays(today, 30);
  else if (filters.dateRange === 'mtd') rangeStart = startOfMonth(today);
  else if (filters.dateRange === 'ytd') rangeStart = startOfYear(today);
  else if (filters.dateRange === 'custom' && filters.dateFrom) rangeStart = startOfDay(filters.dateFrom);

  const rangeEnd = filters.dateRange === 'custom' && filters.dateTo 
    ? startOfDay(filters.dateTo) 
    : today;

  return trades.filter(trade => {
    // Date filter
    const tradeDate = startOfDay(new Date(trade.date_close || trade.date_open || trade.date));
    if (tradeDate < rangeStart || tradeDate > rangeEnd) return false;

    // Status filter
    const isClosed = !!(trade.close_price_final || trade.close_price);
    if (filters.status === 'closed' && !isClosed) return false;
    if (filters.status === 'open' && isClosed) return false;

    // Symbol filter
    if (filters.symbols.length > 0) {
      const symbol = trade.coin?.replace('USDT', '');
      if (!filters.symbols.includes(symbol)) return false;
    }

    // Strategy filter
    if (filters.strategies.length > 0) {
      if (!filters.strategies.includes(trade.strategy_tag)) return false;
    }

    // Timeframe filter
    if (filters.timeframes.length > 0) {
      if (!filters.timeframes.includes(trade.timeframe)) return false;
    }

    // Direction filter
    if (filters.direction !== 'all' && trade.direction !== filters.direction) return false;

    // Market filter
    if (filters.market !== 'all' && trade.market_context !== filters.market) return false;

    return true;
  });
}

/**
 * Calculate canonical metrics from filtered trades
 * @param {Array} trades - Filtered trades
 * @returns {Object} Calculated metrics
 */
export function calculateMetrics(trades) {
  const closedTrades = trades.filter(t => t.close_price_final || t.close_price);
  const openTrades = trades.filter(t => !(t.close_price_final || t.close_price));

  const wins = closedTrades.filter(t => (t.pnl_total_usd || t.pnl_usd || 0) > 0);
  const losses = closedTrades.filter(t => (t.pnl_total_usd || t.pnl_usd || 0) < 0);
  const breakevens = closedTrades.filter(t => (t.pnl_total_usd || t.pnl_usd || 0) === 0);

  const totalPnlUsd = closedTrades.reduce((s, t) => s + (t.pnl_total_usd || t.pnl_usd || 0), 0);
  const totalPnlPct = (totalPnlUsd / 100000) * 100;

  const grossProfit = wins.reduce((s, t) => s + (t.pnl_total_usd || t.pnl_usd || 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.pnl_total_usd || t.pnl_usd || 0), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;

  const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
  const expectancy = closedTrades.length > 0 ? totalPnlUsd / closedTrades.length : 0;

  const winrate = closedTrades.length > 0 ? (wins.length / closedTrades.length * 100) : 0;

  const avgR = closedTrades.length > 0 
    ? closedTrades.reduce((s, t) => s + (t.r_multiple || 0), 0) / closedTrades.length 
    : 0;

  return {
    closedTrades,
    openTrades,
    wins,
    losses,
    breakevens,
    totalPnlUsd,
    totalPnlPct,
    grossProfit,
    grossLoss,
    profitFactor,
    avgWin,
    avgLoss,
    expectancy,
    winrate,
    avgR
  };
}