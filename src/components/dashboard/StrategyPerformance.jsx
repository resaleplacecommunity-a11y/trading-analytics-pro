import { Target } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function StrategyPerformance({ trades }) {
  if (!trades || trades.length === 0) {
    return (
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
        <h3 className="text-[#c0c0c0] text-sm font-medium mb-4">Strategy Performance</h3>
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 mx-auto mb-4 flex items-center justify-center">
            <Target className="w-8 h-8 text-violet-400/60" />
          </div>
          <p className="text-[#888] text-sm mb-1">No trades yet</p>
          <p className="text-[#666] text-xs">Start trading to see analytics</p>
        </div>
      </div>
    );
  }

  // Group by strategy
  const startingBalance = 100000;
  const epsilon = 0.5;
  
  const strategyStats = trades.reduce((acc, trade) => {
    const strategy = trade.strategy_tag || 'No Strategy';
    const pnl = trade.pnl_usd || 0;
    const pnlPercent = Math.abs((pnl / (trade.account_balance_at_entry || startingBalance)) * 100);
    
    if (!acc[strategy]) {
      acc[strategy] = { name: strategy, pnl: 0, count: 0, wins: 0, totalR: 0, rCount: 0 };
    }
    
    acc[strategy].pnl += pnl;
    
    // Only count non-BE trades for winrate
    if (Math.abs(pnl) > epsilon && pnlPercent > 0.01) {
      acc[strategy].count += 1;
      if (pnl > epsilon) acc[strategy].wins += 1;
    }
    
    // Only count trades with valid R (original_risk_usd > 0)
    if (trade.original_risk_usd && trade.original_risk_usd > 0 && trade.r_multiple != null) {
      acc[strategy].totalR += trade.r_multiple;
      acc[strategy].rCount += 1;
    }
    
    return acc;
  }, {});

  // Sort by profitability
  const data = Object.values(strategyStats)
    .map(s => ({
      ...s,
      winrate: s.count > 0 ? ((s.wins / s.count) * 100).toFixed(0) : 0,
      avgR: s.rCount > 0 ? (s.totalR / s.rCount).toFixed(2) : '—'
    }))
    .sort((a, b) => b.pnl - a.pnl);

  const maxPnl = Math.max(...data.map(d => Math.abs(d.pnl)));
  const formatWithSpaces = (num) => Math.round(num).toLocaleString('ru-RU').replace(/,/g, ' ');

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
      <h3 className="text-[#c0c0c0] text-sm font-medium mb-4">Strategy Performance</h3>
      <div className="space-y-2">
        {data.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 mx-auto mb-3 flex items-center justify-center">
              <Target className="w-6 h-6 text-violet-400/60" />
            </div>
            <p className="text-[#888] text-sm mb-1">No strategy data</p>
            <p className="text-[#666] text-xs">Tag trades with strategies</p>
          </div>
        ) : (
          data.map((strategy, idx) => (
          <div 
            key={idx} 
            className="relative h-16 bg-[#151515] rounded-lg overflow-hidden transition-all duration-200 hover:shadow-lg"
          >
            {/* Background bar */}
            <div 
              className={`absolute inset-0 ${strategy.pnl >= 0 ? 'bg-emerald-400/10' : 'bg-red-400/10'}`}
              style={{ 
                width: `${Math.min(100, (Math.abs(strategy.pnl) / maxPnl) * 100)}%` 
              }}
            />
            
            {/* Content */}
            <div className="relative h-full px-4 flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <span className="text-[#c0c0c0] text-sm font-medium truncate">{strategy.name}</span>
                <span className={`text-sm font-bold whitespace-nowrap ${strategy.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {strategy.pnl >= 0 ? `+$${formatWithSpaces(strategy.pnl)}` : `-$${formatWithSpaces(Math.abs(strategy.pnl))}`}
                </span>
              </div>
              
              <div className="flex items-center gap-6 text-xs">
                <div className="text-center">
                  <span className="text-[#666]">Trades: </span>
                  <span className="text-[#c0c0c0] font-medium">{strategy.count}</span>
                </div>
                <div className="text-center">
                  <span className="text-[#666]">WR: </span>
                  <span className="text-[#c0c0c0] font-medium">{strategy.winrate}%</span>
                </div>
                <div className="text-center">
                  <span className="text-[#666]">Avg R: </span>
                  <span className="text-[#c0c0c0] font-medium">{strategy.avgR}</span>
                </div>
              </div>
            </div>
          </div>
          ))
        )}
      </div>
    </div>
  );
}