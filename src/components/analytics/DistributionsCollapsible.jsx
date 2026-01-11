import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { formatNumber } from './analyticsCalculations';
import { cn } from "@/lib/utils";

export default function DistributionsCollapsible({ trades, onDrillDown }) {
  const [rExpanded, setRExpanded] = useState(false);
  const [pnlExpanded, setPnlExpanded] = useState(false);

  // Calculate R distribution
  const rValues = trades
    .filter(t => t.close_price && t.r_multiple !== null && t.r_multiple !== undefined && !isNaN(t.r_multiple))
    .map(t => t.r_multiple);
  
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
  
  // Create PNL histogram with EXACT % ranges
  const createPnlHistogram = () => {
    const tradesWithPnl = trades.filter(t => 
      t.close_price && 
      t.pnl_usd !== null && 
      t.pnl_usd !== undefined &&
      t.account_balance_at_entry && 
      t.account_balance_at_entry > 0
    );
    
    if (tradesWithPnl.length === 0) return [];
    
    const buckets = [
      { label: '≤ -5%', min: -Infinity, max: -5, trades: [] },
      { label: '-4% to -5%', min: -5, max: -4, trades: [] },
      { label: '-2% to -3%', min: -4, max: -2, trades: [] },
      { label: '-0% to -2%', min: -2, max: 0, trades: [] },
      { label: '0% to +1%', min: 0, max: 1, trades: [] },
      { label: '+1% to +3%', min: 1, max: 3, trades: [] },
      { label: '+4% to +5%', min: 3, max: 5, trades: [] },
      { label: '≥ +6%', min: 5, max: Infinity, trades: [] }
    ];
    
    tradesWithPnl.forEach((trade) => {
      const pnlPercent = (trade.pnl_usd / trade.account_balance_at_entry) * 100;
      
      for (let bucket of buckets) {
        if (pnlPercent > bucket.min && pnlPercent <= bucket.max) {
          bucket.trades.push(trade);
          break;
        }
      }
    });
    
    return buckets
      .map(b => ({
        range: b.label,
        count: b.trades.length,
        trades: b.trades,
        avgPnl: b.trades.reduce((sum, t) => sum + (t.pnl_usd || 0), 0) / (b.trades.length || 1)
      }))
      .filter(b => b.count > 0);
  };
  
  const rHistogram = createRHistogram();
  const pnlHistogram = createPnlHistogram();

  return (
    <>
      {/* R Distribution */}
      <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 mb-6 overflow-hidden">
        <div 
          onClick={() => setRExpanded(!rExpanded)}
          className="flex items-center justify-between p-6 cursor-pointer hover:bg-[#1a1a1a]/50 transition-all"
        >
          <h3 className="text-lg font-bold text-[#c0c0c0] flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-violet-400" />
            R Distribution
          </h3>
          {rExpanded ? <ChevronUp className="w-5 h-5 text-[#888]" /> : <ChevronDown className="w-5 h-5 text-[#888]" />}
        </div>

        {rExpanded && (
          <div className="px-6 pb-6 border-t border-[#2a2a2a]/50">
            {rHistogram.length === 0 ? (
              <div className="text-center py-12 text-[#666]">
                <p className="text-sm">Недостаточно данных</p>
                <p className="text-xs mt-1">Нужны сделки с R multiple</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={rHistogram}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" opacity={0.3} />
                  <XAxis 
                    dataKey="range" 
                    stroke="#666" 
                    tick={{ fill: '#c0c0c0', fontSize: 10 }}
                    angle={-30}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis stroke="#666" tick={{ fill: '#c0c0c0', fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#c0c0c0' }}
                    labelStyle={{ color: '#c0c0c0' }}
                    itemStyle={{ color: '#c0c0c0' }}
                    formatter={(value) => [value, 'Trades']}
                    cursor={{ fill: 'rgba(192, 192, 192, 0.1)' }}
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
        )}
      </div>

      {/* PNL Distribution */}
      <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 mb-6 overflow-hidden">
        <div 
          onClick={() => setPnlExpanded(!pnlExpanded)}
          className="flex items-center justify-between p-6 cursor-pointer hover:bg-[#1a1a1a]/50 transition-all"
        >
          <h3 className="text-lg font-bold text-[#c0c0c0] flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            PNL Distribution
          </h3>
          {pnlExpanded ? <ChevronUp className="w-5 h-5 text-[#888]" /> : <ChevronDown className="w-5 h-5 text-[#888]" />}
        </div>

        {pnlExpanded && (
          <div className="px-6 pb-6 border-t border-[#2a2a2a]/50">
            {pnlHistogram.length === 0 ? (
              <div className="text-center py-12 text-[#666]">
                <p className="text-sm">Недостаточно данных</p>
                <p className="text-xs mt-1">Нужны закрытые сделки</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={pnlHistogram}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" opacity={0.3} />
                  <XAxis 
                    dataKey="range" 
                    stroke="#666" 
                    tick={{ fill: '#c0c0c0', fontSize: 9 }}
                    angle={-30}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis stroke="#666" tick={{ fill: '#c0c0c0', fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#c0c0c0' }}
                    labelStyle={{ color: '#c0c0c0' }}
                    itemStyle={{ color: '#c0c0c0' }}
                    formatter={(value, name, props) => [
                      `${value} trades`,
                      `Avg: ${props.payload.avgPnl >= 0 ? '+' : ''}$${Math.round(Math.abs(props.payload.avgPnl))}`
                    ]}
                    cursor={{ fill: 'rgba(192, 192, 192, 0.1)' }}
                  />
                  <Bar 
                    dataKey="count" 
                    radius={[4, 4, 0, 0]}
                    onClick={(data) => data.trades && data.trades.length > 0 && onDrillDown('PNL Range: ' + data.range, data.trades)}
                    cursor="pointer"
                  >
                    {pnlHistogram.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.avgPnl >= 0 ? '#10b981' : '#ef4444'} opacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </div>
    </>
  );
}