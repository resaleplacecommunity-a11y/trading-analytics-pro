import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { startOfDay, endOfDay, isWithinInterval } from 'date-fns';

/**
 * Unified date utilities for the entire app
 * All date calculations MUST use these functions to ensure consistency
 */

/**
 * Get current date string in user's timezone (YYYY-MM-DD)
 */
export function getTodayInUserTz(userTimezone = 'UTC') {
  const now = new Date();
  const zonedNow = toZonedTime(now, userTimezone);
  return formatInTimeZone(zonedNow, userTimezone, 'yyyy-MM-dd');
}

/**
 * Parse trade date and convert to user's timezone date string (YYYY-MM-DD)
 * Handles various date formats: ISO strings, with/without Z, with spaces
 */
export function parseTradeDateToUserTz(dateStr, userTimezone = 'UTC') {
  if (!dateStr) return null;
  
  try {
    // Explicitly parse date strings. If no time or timezone is present, assume UTC start of day.
    const utcDate = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00Z');
    
    // Check if valid date
    if (isNaN(utcDate.getTime())) {
      console.error('Invalid date:', dateStr);
      return null;
    }
    
    // Convert this UTC date to the user's timezone and format as YYYY-MM-DD
    const zonedDate = toZonedTime(utcDate, userTimezone);
    return formatInTimeZone(zonedDate, userTimezone, 'yyyy-MM-dd');
  } catch (e) {
    console.error('Error parsing date:', dateStr, e);
    return null;
  }
}

/**
 * Check if trade was opened today in user's timezone
 */
export function wasTradeOpenedToday(trade, userTimezone = 'UTC') {
  const today = getTodayInUserTz(userTimezone);
  const tradeDate = trade.date_open || trade.date;
  if (!tradeDate) return false;
  
  const tradeDateInUserTz = parseTradeDateToUserTz(tradeDate, userTimezone);
  return tradeDateInUserTz === today;
}

/**
 * Check if trade was closed today in user's timezone
 */
export function wasTradeClosedToday(trade, userTimezone = 'UTC') {
  const today = getTodayInUserTz(userTimezone);
  if (!trade.close_price || !trade.date_close) return false;
  
  const tradeDateInUserTz = parseTradeDateToUserTz(trade.date_close, userTimezone);
  return tradeDateInUserTz === today;
}

/**
 * Filter trades opened on a specific date in user's timezone
 */
export function filterTradesOpenedOnDate(trades, dateStr, userTimezone = 'UTC') {
  return trades.filter(trade => {
    const tradeDate = trade.date_open || trade.date;
    if (!tradeDate) return false;
    
    const tradeDateInUserTz = parseTradeDateToUserTz(tradeDate, userTimezone);
    return tradeDateInUserTz === dateStr;
  });
}

/**
 * Filter trades closed on a specific date in user's timezone
 */
export function filterTradesClosedOnDate(trades, dateStr, userTimezone = 'UTC') {
  return trades.filter(trade => {
    if (!trade.close_price || !trade.date_close) return false;
    
    const tradeDateInUserTz = parseTradeDateToUserTz(trade.date_close, userTimezone);
    return tradeDateInUserTz === dateStr;
  });
}

/**
 * Get trades opened today in user's timezone
 */
export function getTodayOpenedTrades(trades, userTimezone = 'UTC') {
  const today = getTodayInUserTz(userTimezone);
  return filterTradesOpenedOnDate(trades, today, userTimezone);
}

/**
 * Get trades closed today in user's timezone
 */
export function getTodayClosedTrades(trades, userTimezone = 'UTC') {
  const today = getTodayInUserTz(userTimezone);
  return filterTradesClosedOnDate(trades, today, userTimezone);
}

/**
 * Calculate today's PNL in user's timezone
 * Includes closed trades + partial closes from open trades
 */
export function getTodayPnl(trades, userTimezone = 'UTC') {
  const today = getTodayInUserTz(userTimezone);
  let totalPnl = 0;
  
  // Add PNL from closed trades
  const closedToday = getTodayClosedTrades(trades, userTimezone);
  closedToday.forEach(trade => {
    totalPnl += trade.pnl_usd || 0;
  });
  
  // Add PNL from partial closes that happened today
  const openTrades = trades.filter(t => !t.close_price);
  openTrades.forEach(trade => {
    if (trade.partial_closes) {
      try {
        const partials = JSON.parse(trade.partial_closes);
        partials.forEach(pc => {
          if (pc.timestamp && pc.pnl_usd) {
            const pcDate = parseTradeDateToUserTz(pc.timestamp, userTimezone);
            if (pcDate === today) {
              totalPnl += pc.pnl_usd;
            }
          }
        });
      } catch (e) {
        console.error('Error parsing partial closes:', e);
      }
    }
  });
  
  return totalPnl;
}

/**
 * Format date for display in user's timezone
 */
export function formatDateForDisplay(dateStr, userTimezone = 'UTC', formatStr = 'dd MMM yyyy, HH:mm') {
  if (!dateStr) return '—';
  
  try {
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) return '—';
    
    return formatInTimeZone(dateObj, userTimezone, formatStr);
  } catch (e) {
    console.error('Error formatting date:', dateStr, e);
    return '—';
  }
}

/**
 * Get start and end of day in user's timezone
 */
export function getDayBoundariesInUserTz(dateStr, userTimezone = 'UTC') {
  try {
    // Parse the date string as a date in the user's timezone
    const date = new Date(dateStr + 'T00:00:00');
    const zonedDate = toZonedTime(date, userTimezone);
    
    return {
      start: startOfDay(zonedDate),
      end: endOfDay(zonedDate)
    };
  } catch (e) {
    console.error('Error getting day boundaries:', dateStr, e);
    return null;
  }
}