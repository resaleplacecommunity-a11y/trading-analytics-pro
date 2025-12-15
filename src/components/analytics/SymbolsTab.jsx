import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { cn } from "@/lib/utils";
import { applyFilters } from './filterUtils';

const formatNumber = (num) => {
  if (num === undefined || num === null || num === '') return '—';
  const n = parseFloat(num);
  if (isNaN(n)) return '—';
  return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
};

export default function SymbolsTab({ trades, filters }) {
  const filtered = applyFilters(trades, filters);
  const closedTrades = filtered.filter(t => t.close_price_final || t.close_price);

  // Group by symbol
  const symbolStats = {};
  
  closedTrades.forEach(t => {
    const symbol = t.coin?.replace('USDT', '') || 'Unknown';
    if (!symbolStats[symbol]) {
      symbolStats[symbol] = {
        symbol,
        trades: 0,
        wins: 0,
        pnl: 0,
        totalR: 0,
        grossProfit: 0,
        grossLoss: 0
      };
    }
    
    const pnl = t.pnl_total_usd || t.pnl_usd || 0;
    symbolStats[symbol].trades++;
    symbolStats[symbol].pnl += pnl;
    symbolStats[symbol].totalR += t.r_multiple || 0;
    
    if (pnl > 0) {
      symbolStats[symbol].wins++;
      symbolStats[symbol].grossProfit += pnl;
    } else {
      symbolStats[symbol].grossLoss += Math.abs(pnl);
    }
  });

  // Calculate metrics and classify
  const symbols = Object.values(symbolStats).map(s => {
    const winrate = s.trades > 0 ? (s.wins / s.trades * 100) : 0;
    const avgR = s.trades > 0 ? s.totalR / s.trades : 0;
    const expectancy = s.trades > 0 ? s.pnl / s.trades : 0;
    
    // Variance (simplified - using range of Rs)
    const variance = 0; // Placeholder
    
    // Classification
    let classification = 'neutral';
    if (expectancy < 0 || avgR < 0) classification = 'avoid';
    else if (avgR >= 2 && winrate >= 50) classification = 'elite';
    else if (avgR >= 1) classification = 'profitable';
    
    return {
      ...s,
      winrate,
      avgR,
      expectancy,
      classification
    };
  }).sort((a, b) => b.pnl - a.pnl);

  const avoidList = symbols.filter(s => s.classification === 'avoid');
  const eliteList = symbols.filter(s => s.classification === 'elite');

  return (
    <div className="space-y-4 mt-4">
      {/* Elite Symbols */}
      {eliteList.length > 0 && (
        <div className="bg-gradient-to-br from-emerald-500/10 to-[#0d0d0d] rounded-xl p-5 border border-emerald-500/30">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h3 className="text-emerald-400 text-sm font-medium">Elite Symbols (Focus Here)</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {eliteList.map(s => (
              <div key={s.symbol} className="bg-[#151515] rounded-lg p-3 border border-emerald-500/20">
                <p className="text-lg font-bold text-[#c0c0c0] mb-2">{s.symbol}</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#666]">Trades</span>
                    <span className="text-[#c0c0c0]">{s.trades}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#666]">WR</span>
                    <span className="text-emerald-400 font-bold">{s.winrate.toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#666]">Avg R</span>
                    <span className="text-emerald-400 font-bold">{s.avgR.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#666]">Net</span>
                    <span className="text-emerald-400 font-bold">+${formatNumber(s.pnl)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Symbols Table */}
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
        <h3 className="text-[#c0c0c0] text-sm font-medium mb-4">All Symbols Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                <th className="text-left text-[10px] text-[#666] uppercase tracking-wide py-2 px-3">Symbol</th>
                <th className="text-center text-[10px] text-[#666] uppercase tracking-wide py-2 px-3">Trades</th>
                <th className="text-center text-[10px] text-[#666] uppercase tracking-wide py-2 px-3">WR</th>
                <th className="text-right text-[10px] text-[#666] uppercase tracking-wide py-2 px-3">Net PNL</th>
                <th className="text-center text-[10px] text-[#666] uppercase tracking-wide py-2 px-3">Avg R</th>
                <th className="text-center text-[10px] text-[#666] uppercase tracking-wide py-2 px-3">Edge</th>
                <th className="text-center text-[10px] text-[#666] uppercase tracking-wide py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {symbols.map((s, i) => (
                <tr key={i} className="border-b border-[#1a1a1a] hover:bg-[#151515]">
                  <td className="py-3 px-3 text-sm text-[#c0c0c0] font-medium">{s.symbol}</td>
                  <td className="py-3 px-3 text-center text-sm text-[#888]">{s.trades}</td>
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
                    <span className="text-sm text-[#c0c0c0]">{s.edgeScore.toFixed(1)}</span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    {s.classification === 'elite' && (
                      <span className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-400">Elite</span>
                    )}
                    {s.classification === 'profitable' && (
                      <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400">Good</span>
                    )}
                    {s.classification === 'avoid' && (
                      <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400">Avoid</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Avoid List */}
      {avoidList.length > 0 && (
        <div className="bg-gradient-to-br from-red-500/10 to-[#0d0d0d] rounded-xl p-5 border border-red-500/30">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <h3 className="text-red-400 text-sm font-medium">Avoid List (Negative Expectancy)</h3>
          </div>
          <div className="space-y-2">
            {avoidList.map(s => (
              <div key={s.symbol} className="bg-[#151515] rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#c0c0c0] font-medium">{s.symbol}</p>
                  <p className="text-xs text-[#666]">
                    {s.trades} trades • WR: {s.winrate.toFixed(0)}% • Avg R: {s.avgR.toFixed(2)}
                  </p>
                </div>
                <span className="text-lg font-bold text-red-400">
                  -${formatNumber(Math.abs(s.pnl))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}