export const formatCurrency = (value) => {
  if (!isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

export const formatPercent = (value, decimals = 1) => {
  if (!isFinite(value)) return '—';
  return value.toFixed(decimals);
};