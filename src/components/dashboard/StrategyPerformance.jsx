export default function StrategyPerformance({ trades }) {
  if (!trades || trades.length === 0) {
    return (
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
        <h3 className="text-[#c0c0c0] text-sm font-medium mb-4">Strategy Performance</h3>
        <p className="text-[#666] text-sm text-center py-8">No trades yet</p>
      </div>
    );
  }

  // Group by strategy
  const strategyStats = trades.reduce((acc, trade) => {
    const strategy = trade.strategy_tag || 'No Strategy';
    if (!acc[strategy]) {
      acc[strategy] = { name: strategy, pnl: 0, count: 0, wins: 0, totalR: 0 };
    }
    acc[strategy].pnl += (trade.pnl_usd || 0);
    acc[strategy].count += 1;
    acc[strategy].totalR += (trade.r_multiple || 0);
    if ((trade.pnl_usd || 0) > 0) acc[strategy].wins += 1;
    return acc;
  }, {});

  // Sort by profitability
  const data = Object.values(strategyStats)
    .map(s => ({
      ...s,
      winrate: s.count > 0 ? ((s.wins / s.count) * 100).toFixed(0) : 0,
      avgR: s.count > 0 ? (s.totalR / s.count).toFixed(2) : 0
    }))
    .sort((a, b) => b.pnl - a.pnl);

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
      <h3 className="text-[#c0c0c0] text-sm font-medium mb-4">Strategy Performance</h3>
      <div className="space-y-3 max-h-80 overflow-y-auto">
        {data.map((strategy, idx) => (
          <div key={idx} className="bg-[#151515] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[#c0c0c0] text-sm font-medium">{strategy.name}</span>
              <span className={`text-sm font-bold ${strategy.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {strategy.pnl >= 0 ? '+' : ''}${strategy.pnl.toFixed(2)}
              </span>
            </div>
            
            <div className="grid grid-cols-3 gap-3 text-xs mb-3">
              <div className="text-center bg-[#1a1a1a] rounded py-2">
                <p className="text-[#666] mb-1">Trades</p>
                <p className="text-[#c0c0c0] font-medium">{strategy.count}</p>
              </div>
              <div className="text-center bg-[#1a1a1a] rounded py-2">
                <p className="text-[#666] mb-1">Winrate</p>
                <p className="text-[#c0c0c0] font-medium">{strategy.winrate}%</p>
              </div>
              <div className="text-center bg-[#1a1a1a] rounded py-2">
                <p className="text-[#666] mb-1">Avg R</p>
                <p className="text-[#c0c0c0] font-medium">{strategy.avgR}R</p>
              </div>
            </div>
            
            {/* Progress bar */}
            <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all ${strategy.pnl >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
                style={{ 
                  width: `${Math.min(100, Math.abs(strategy.pnl) / Math.max(...data.map(d => Math.abs(d.pnl))) * 100)}%` 
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}