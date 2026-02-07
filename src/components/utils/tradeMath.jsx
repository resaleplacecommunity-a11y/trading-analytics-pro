// Unified trade mathematics module
// All trade calculations should use these utilities for consistency

// Parse number safely
export const parseNum = (v, fallback = 0) => {
  if (v === undefined || v === null || v === '') return fallback;
  const n = parseFloat(v);
  return isNaN(n) ? fallback : n;
};

// Safe JSON parse (accepts string/object/array, never crashes)
export const safeJsonParse = (v, fallback = null) => {
  if (!v) return fallback;
  if (typeof v === 'object') return v;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
};

// Calculate PNL in USD
export const pnlUsd = (direction, entry, close, sizeUsd) => {
  const e = parseNum(entry);
  const c = parseNum(close);
  const s = parseNum(sizeUsd);
  
  if (e === 0 || s === 0) return 0;
  
  if (direction === 'Long') {
    return ((c - e) / e) * s;
  } else {
    return ((e - c) / e) * s;
  }
};

// Calculate risk in USD
export const riskUsd = (entry, stop, sizeUsd) => {
  const e = parseNum(entry);
  const st = parseNum(stop);
  const s = parseNum(sizeUsd);
  
  if (e === 0 || s === 0) return 0;
  
  return (Math.abs(e - st) / e) * s;
};

// Calculate RR ratio
export const rrRatio = (entry, take, stop, sizeUsd) => {
  const e = parseNum(entry);
  const t = parseNum(take);
  const st = parseNum(stop);
  const s = parseNum(sizeUsd);
  
  if (e === 0 || s === 0) return 0;
  
  const potential = Math.abs(t - e) / e * s;
  const risk = Math.abs(e - st) / e * s;
  
  if (risk === 0) return 0;
  return potential / risk;
};

// Calculate average entry after adding position (USD notional weighted)
export const avgEntryAfterAddUsdNotional = (oldEntry, oldSizeUsd, addPrice, addSizeUsd) => {
  const oE = parseNum(oldEntry);
  const oS = parseNum(oldSizeUsd);
  const aP = parseNum(addPrice);
  const aS = parseNum(addSizeUsd);
  
  if (oE === 0 || (oS === 0 && aS === 0)) return oE || aP;
  
  const qtyOld = oS / oE;
  const qtyAdd = aS / aP;
  const totalQty = qtyOld + qtyAdd;
  
  if (totalQty === 0) return oE;
  
  return (oS + aS) / totalQty;
};

// Calculate average entry from trade history (adds + partials)
export const avgEntryFromHistory = (trade) => {
  const currentSize = parseNum(trade.position_size);
  const originalEntry = parseNum(trade.original_entry_price) || parseNum(trade.entry_price);
  
  // Parse partial closes
  const partialCloses = safeJsonParse(trade.partial_closes, []);
  const totalClosed = partialCloses.reduce((sum, pc) => sum + parseNum(pc.size_usd), 0);
  
  // Parse adds
  const addsHistory = safeJsonParse(trade.adds_history, []);
  const totalAdds = addsHistory.reduce((sum, add) => sum + parseNum(add.size_usd), 0);
  
  // Calculate initial size
  let initialSize = currentSize + totalClosed - totalAdds;
  if (initialSize < 0) initialSize = 0;
  
  // Calculate total quantity
  let totalQty = originalEntry > 0 ? initialSize / originalEntry : 0;
  addsHistory.forEach(add => {
    const addPrice = parseNum(add.price);
    const addSize = parseNum(add.size_usd);
    if (addPrice > 0) {
      totalQty += addSize / addPrice;
    }
  });
  
  // Calculate total notional
  const totalNotional = initialSize + totalAdds;
  
  // Calculate average entry
  const avgEntry = totalQty > 0 ? totalNotional / totalQty : originalEntry;
  
  return {
    initialSize,
    totalNotional,
    totalQty,
    avgEntry
  };
};

// Get net realized PNL in USD
export const netRealizedPnlUsd = (trade) => {
  const isClosed = !!trade.close_price;
  
  if (isClosed) {
    // For closed trades, use realized_pnl_usd or pnl_usd
    return parseNum(trade.realized_pnl_usd) || parseNum(trade.pnl_usd);
  } else {
    // For open trades, only use realized_pnl_usd (from partial closes)
    return parseNum(trade.realized_pnl_usd);
  }
};