/**
 * Trading Pro - Global Constants
 * Single source of truth for thresholds and limits
 */

// Breakeven threshold: trades with |PNL| <= this value are considered BE
export const BE_THRESHOLD_USD = 0.5;
export const BE_THRESHOLD_PERCENT = 0.01; // 0.01%

// Revenge trading window (minutes)
export const REVENGE_TRADING_WINDOW_MINUTES = 30;

// Risk thresholds
export const DEFAULT_MAX_RISK_PERCENT = 3;
export const DEFAULT_DAILY_MAX_LOSS_PERCENT = 5;
export const DEFAULT_MAX_TRADES_PER_DAY = 5;

// Psychology energy thresholds
export const PSYCHOLOGY_LOW_THRESHOLD = 3;    // 1-3
export const PSYCHOLOGY_HIGH_THRESHOLD = 7;   // 7-10
// 4-6 = Neutral

// Minimum trades for analysis
export const MIN_TRADES_FOR_ANALYSIS = 5;
export const MIN_TRADES_FOR_STRATEGY_CALC = 30;