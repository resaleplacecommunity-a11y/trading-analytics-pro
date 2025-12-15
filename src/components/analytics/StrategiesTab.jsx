import { Trophy, AlertTriangle, TrendingUp } from 'lucide-react';
import { cn } from "@/lib/utils";
import { applyFilters } from './filterUtils';

const formatNumber = (num) => {
  if (num === undefined || num === null || num === '') return '—';
  const n = parseFloat(num);
  if (isNaN(n)) return '—';
  return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
};

export default function StrategiesTab({ trades, filters }) {
  const filtered = applyFilters(trades, filters);
  const closedTrades = filtered.filter(t => t.close_price_final || t.close_price);

  // Group by strategy
  const strategyStats = {};
  
  closedTrades.forEach(t => {
    const strategy = t.strategy_tag || 'No Strategy';
    if (!strategyStats[strategy]) {
      strategyStats[strategy] = {
        name: strategy,
        trades: 0,
        wins: 0,
        pnl: 0,
        totalR: 0,
        grossProfit: 0,
        grossLoss: 0,
        maxDD: 0
      };
    }
    
    const pnl = t.pnl_total_usd || t.pnl_usd || 0;
    strategyStats[strategy].trades++;
    strategyStats[strategy].pnl += pnl;
    strategyStats[strategy].totalR += t.r_multiple || 0;
    
    if (pnl > 0) {
      strategyStats[strategy].wins++;
      strategyStats[strategy].grossProfit += pnl;
    } else {
      strategyStats[strategy].grossLoss += Math.abs(pnl);
    }
  });

  // Calculate derived metrics and edge score
  const strategies = Object.values(strategyStats).map(s => {
    const winrate = s.trades > 0 ? (s.wins / s.trades * 100) : 0;
    const avgR = s.trades > 0 ? s.totalR / s.trades : 0;
    const pf = s.grossLoss > 0 ? s.grossProfit / s.grossLoss : 0;
    
    // Edge score = avgR * sqrt(n) with penalty for low sample size
    const samplePenalty = s.trades < 20 ? 0.5 : s.trades < 50 ? 0.8 : 1;
    const edgeScore = avgR * Math.sqrt(s.trades) * samplePenalty;
    
    return {
      ...s,
      winrate,
      avgR,
      pf,
      edgeScore
    };
  }).sort((a, b) => b.pnl - a.pnl);

  return (
    <div className="space-y-4 mt-4">
      {/* Strategy Leaderboard */}
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
        <h3 className="text-[#c0c0c0] text-sm font-medium mb-4">Strategy Leaderboard</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                <th className="text-left text-[10px] text-[#666] uppercase tracking-wide py-2 px-3">Strategy</th>
                <th className="text-center text-[10px] text-[#666] uppercase tracking-wide py-2 px-3">Trades</th>
                <th className="text-center text-[10px] text-[#666] uppercase tracking-wide py-2 px-3">WR</th>
                <th className="text-right text-[10px] text-[#666] uppercase tracking-wide py-2 px-3">Net PNL</th>
                <th className="text-center text-[10px] text-[#666] uppercase tracking-wide py-2 px-3">Avg R</th>
                <th className="text-center text-[10px] text-[#666] uppercase tracking-wide py-2 px-3">PF</th>
                <th className="text-center text-[10px] text-[#666] uppercase tracking-wide py-2 px-3">Edge</th>
              </tr>
            </thead>
            <tbody>
              {strategies.map((s, i) => (
                <tr key={i} className="border-b border-[#1a1a1a] hover:bg-[#151515]">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      {i === 0 && <Trophy className="w-4 h-4 text-yellow-400" />}
                      <span className="text-sm text-[#c0c0c0]">{s.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="text-sm text-[#888]">{s.trades}</span>
                    {s.trades < 20 && (
                      <AlertTriangle className="w-3 h-3 text-amber-400 inline ml-1" title="Low sample size" />
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={cn(
                      "text-sm font-bold",
                      s.winrate >= 50 ? "text-emerald-400" : "text-red-400"
                    )}>
                      {s.winrate.toFixed(0)}%
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className={cn(
                      "text-sm font-bold",
                      s.pnl >= 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                      {s.pnl >= 0 ? '+' : ''}${formatNumber(s.pnl)}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={cn(
                      "text-sm font-bold",
                      s.avgR >= 2 ? "text-emerald-400" : s.avgR >= 1 ? "text-yellow-400" : "text-red-400"
                    )}>
                      {s.avgR.toFixed(2)}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={cn(
                      "text-sm font-bold",
                      s.pf >= 2 ? "text-emerald-400" : s.pf >= 1 ? "text-yellow-400" : "text-red-400"
                    )}>
                      {s.pf > 0 ? s.pf.toFixed(2) : '∞'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={cn(
                      "text-sm font-bold",
                      s.edgeScore > 5 ? "text-emerald-400" : s.edgeScore > 2 ? "text-yellow-400" : "text-red-400"
                    )}>
                      {s.edgeScore.toFixed(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confidence Scatter */}
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
        <h3 className="text-[#c0c0c0] text-sm font-medium mb-4">Performance by Confidence Level</h3>
        {confidenceData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <XAxis 
                  dataKey="confidence" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#666', fontSize: 10 }}
                  domain={[0, 10]}
                />
                <YAxis 
                  dataKey="r" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#666', fontSize: 10 }}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload?.[0]) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3">
                          <p className="text-xs text-[#888]">Conf: {d.confidence}/10</p>
                          <p className="text-sm text-[#c0c0c0] font-bold">{d.r.toFixed(2)}R</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter data={confidenceData}>
                  {confidenceData.map((entry, index) => (
                    <Cell key={index} fill={entry.r >= 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-[#666] text-sm text-center py-12">No confidence data available</p>
        )}
      </div>
    </div>
  );
}