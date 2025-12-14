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

  const maxPnl = Math.max(...data.map(d => Math.abs(d.pnl)));
  const formatWithSpaces = (num) => Math.round(num).toLocaleString('ru-RU').replace(/,/g, ' ');

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
      <h3 className="text-[#c0c0c0] text-sm font-medium mb-4">Strategy Performance</h3>
      <div className="space-y-2">
        {data.map((strategy, idx) => (
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
        ))}
      </div>
    </div>
  );
}