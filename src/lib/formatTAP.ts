/**
 * TAP number formatting — space thousands separator (TAP v3.2 standard).
 * @example formatTAP(50024)        → "50 024"
 * @example formatTAP(2847.30, 2)  → "2 847.30"
 * @example formatTAP(-412.8, 2)   → "-412.80"
 */
export function formatTAP(num: number, decimals = 0): string {
  const parts = num.toFixed(decimals).split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0')
  return parts.join('.')
}

/** Format with sign and currency: "+$2 847.30" / "-$412.80" */
export function formatTAPCurrency(num: number, decimals = 2): string {
  const sign = num > 0 ? '+' : num < 0 ? '-' : ''
  return `${sign}$${formatTAP(Math.abs(num), decimals)}`
}

/** Format percentage with sign: "+11.4%" / "-1.6%" / "0.0%" */
export function formatTAPPercent(num: number, decimals = 1): string {
  const sign = num > 0 ? '+' : ''
  return `${sign}${num.toFixed(decimals)}%`
}
