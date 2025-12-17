import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { formatNumber } from './analyticsCalculations';
import { cn } from "@/lib/utils";

export default function Distributions({ trades, onDrillDown }) {
  // Calculate R distribution
  const rValues = trades
    .filter(t => t.close_price && t.r_multiple !== null && t.r_multiple !== undefined && !isNaN(t.r_multiple))
    .map(t => t.r_multiple);
  
  // Calculate PNL distribution
  const pnlValues = trades
    .filter(t => t.close_price && t.pnl_usd !== null && t.pnl_usd !== undefined)
    .map(t => t.pnl_usd);
  
  // Create R histogram with clear buckets
  const createRHistogram = () => {
    if (rValues.length === 0) return [];
    
    const buckets = [
      { label: '≤ -2R', range: [-Infinity, -2], trades: [] },
      { label: '-2 to -1R', range: [-2, -1], trades: [] },
      { label: '-1 to 0R', range: [-1, 0], trades: [] },
      { label: '0 to 1R', range: [0, 1], trades: [] },
      { label: '1 to 2R', range: [1, 2], trades: [] },
      { label: '≥ 2R', range: [2, Infinity], trades: [] }
    ];
    
    trades.forEach((trade, idx) => {
      const r = rValues[idx];
      if (r === null || r === undefined) return;
      
      for (let bucket of buckets) {
        if (r >= bucket.range[0] && r < bucket.range[1]) {
          bucket.trades.push(trade);
          break;
        }
      }
    });
    
    return buckets.map(b => ({
      range: b.label,
      count: b.trades.length,
      trades: b.trades
    }));
  };
  
  // Create PNL histogram with round numbers based on balance
  const createPnlHistogram = () => {
    if (pnlValues.length === 0) return [];
    
    // Get balance from first trade or default
    const balance = trades[0]?.account_balance_at_entry || 100000;
    
    // Determine step size based on balance (roughly 0.5-1% increments)
    let step;
    if (balance >= 500000) step = 5000;
    else if (balance >= 100000) step = 1000;
    else if (balance >= 50000) step = 500;
    else if (balance >= 10000) step = 100;
    else step = 50;
    
    // Find min/max and round to step
    const sorted = [...pnlValues].sort((a, b) => a - b);
    const rawMin = sorted[0];
    const rawMax = sorted[sorted.length - 1];
    
    const min = Math.floor(rawMin / step) * step;
    const max = Math.ceil(rawMax / step) * step;
    
    // Create buckets
    const buckets = [];
    let current = min;
    
    while (current < max) {
      const next = current + step;
      buckets.push({
        range: `$${current.toLocaleString()} to $${next.toLocaleString()}`,
        min: current,
        max: next,
        trades: [],
        count: 0
      });
      current = next;
    }
    
    // Fill buckets
    trades.forEach((trade, idx) => {
      const pnl = pnlValues[idx];
      if (pnl === null || pnl === undefined) return;
      
      for (let bucket of buckets) {
        if (pnl >= bucket.min && (pnl < bucket.max || bucket === buckets[buckets.length - 1])) {
          bucket.trades.push(trade);
          bucket.count++;
          break;
        }
      }
    });
    
    return buckets.filter(b => b.count > 0); // Only show buckets with trades
  };
  
  const rHistogram = createRHistogram();
  const pnlHistogram = createPnlHistogram();

  return (
    <div className="grid grid-cols-2 gap-6 mb-6">
      {/* R Distribution */}
      <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-6">
        <h3 className="text-lg font-bold text-[#c0c0c0] flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-violet-400" />
          R Distribution
        </h3>
        
        {rHistogram.length === 0 ? (
          <div className="text-center py-12 text-[#666]">
            <p className="text-sm">Недостаточно данных</p>
            <p className="text-xs mt-1">Нужны сделки с R multiple</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={rHistogram}>
              <XAxis 
                dataKey="range" 
                stroke="#666" 
                tick={{ fill: '#888', fontSize: 10 }}
                angle={-30}
                textAnchor="end"
                height={70}
              />
              <YAxis stroke="#666" tick={{ fill: '#888', fontSize: 11 }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#111', border: '1px solid #2a2a2a', borderRadius: '8px' }}
                labelStyle={{ color: '#888' }}
                formatter={(value) => [value, 'Trades']}
              />
              <Bar 
                dataKey="count" 
                radius={[4, 4, 0, 0]}
                onClick={(data) => data.trades && data.trades.length > 0 && onDrillDown('R Range: ' + data.range, data.trades)}
                cursor="pointer"
              >
                {rHistogram.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill="#8b5cf6" opacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* PNL Distribution */}
      <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[#c0c0c0] flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            PNL Distribution
          </h3>
        </div>
        
        {pnlHistogram.length === 0 ? (
          <div className="text-center py-12 text-[#666]">
            <p className="text-sm">Недостаточно данных</p>
            <p className="text-xs mt-1">Нужны закрытые сделки</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={pnlHistogram}>
              <XAxis 
                dataKey="range" 
                stroke="#666" 
                tick={{ fill: '#888', fontSize: 9 }}
                angle={-30}
                textAnchor="end"
                height={70}
              />
              <YAxis stroke="#666" tick={{ fill: '#888', fontSize: 11 }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#111', border: '1px solid #2a2a2a', borderRadius: '8px' }}
                labelStyle={{ color: '#888' }}
                formatter={(value) => [value, 'Trades']}
              />
              <Bar 
                dataKey="count" 
                radius={[4, 4, 0, 0]}
                onClick={(data) => data.trades && data.trades.length > 0 && onDrillDown('PNL Range: ' + data.range, data.trades)}
                cursor="pointer"
              >
                {pnlHistogram.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.min >= 0 ? '#10b981' : '#ef4444'} opacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}