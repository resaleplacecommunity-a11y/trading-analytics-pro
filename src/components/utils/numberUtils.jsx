/**
 * Safe number parsing with thousands separators support
 * @param {any} value - Value to parse
 * @returns {number|null} Parsed number or null
 */
export function parseNumberSafe(value) {
  if (value === null || value === undefined) return null;
  
  // Convert to string and remove spaces, non-breaking spaces, commas
  const str = String(value)
    .replace(/\s/g, '')
    .replace(/\u00A0/g, '')
    .replace(/,/g, '');
  
  if (str === '' || str === '-') return null;
  
  const num = Number(str);
  return Number.isFinite(num) ? num : null;
}

/**
 * Format number with spaces as thousand separators
 * @param {number} num - Number to format
 * @returns {string} Formatted string or '—'
 */
export function formatNumber(num) {
  const n = parseNumberSafe(num);
  if (n === null) return '—';
  return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
}

/**
 * Format price with proper precision
 * @param {number} price - Price to format
 * @returns {string} Formatted price or '—'
 */
export function formatPrice(price) {
  const p = parseNumberSafe(price);
  if (p === null) return '—';
  
  if (Math.abs(p) >= 1) {
    const str = p.toPrecision(4);
    const formatted = parseFloat(str).toString();
    return `$${formatted}`;
  }
  
  const str = p.toFixed(20);
  const match = str.match(/\.0*([1-9]\d{0,3})/);
  if (match) {
    const zeros = str.indexOf(match[1]) - str.indexOf('.') - 1;
    const formatted = p.toFixed(zeros + 4).replace(/0+$/, '');
    return `$${formatted}`;
  }
  return `$${p.toFixed(4).replace(/\.?0+$/, '')}`;
}

/**
 * Validate trade required fields
 * @param {Object} data - Trade data
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateTradeData(data) {
  const errors = [];
  
  if (!data.coin || data.coin.trim() === '') {
    errors.push('Symbol is required');
  }
  
  if (!data.direction) {
    errors.push('Direction is required');
  }
  
  const entry = parseNumberSafe(data.entry_price);
  if (entry === null || entry <= 0) {
    errors.push('Entry price must be a positive number');
  }
  
  const size = parseNumberSafe(data.position_size);
  if (size === null || size <= 0) {
    errors.push('Position size must be a positive number');
  }
  
  const stop = parseNumberSafe(data.stop_price);
  if (stop === null || stop <= 0) {
    errors.push('Stop price must be a positive number');
  }
  
  const take = parseNumberSafe(data.take_price);
  if (take === null || take <= 0) {
    errors.push('Take price must be a positive number');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}