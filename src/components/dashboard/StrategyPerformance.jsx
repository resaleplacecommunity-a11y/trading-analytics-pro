import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function StrategyPerformance({ trades }) {
  // Group by strategy
  const strategyStats = trades.reduce((acc, trade) => {
    const strategy = trade.strategy_tag || 'No Tag';
    if (!acc[strategy]) {
      acc[strategy] = { strategy, pnl: 0, trades: 0, wins: 0, totalR: 0 };
    }
    acc[strategy].pnl += (trade.pnl_usd || 0);
    acc[strategy].trades += 1;
    acc[strategy].totalR += (trade.r_multiple || 0);
    if ((trade.pnl_usd || 0) > 0) acc[strategy].wins += 1;
    return acc;
  }, {});

  const data = Object.values(strategyStats)
    .map(s => ({
      ...s,
      winrate: s.trades > 0 ? (s.wins / s.trades * 100).toFixed(1) : 0,
      avgR: s.trades > 0 ? (s.totalR / s.trades).toFixed(2) : 0
    }))
    .sort((a, b) => b.pnl - a.pnl);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3 shadow-xl">
          <p className="text-[#c0c0c0] text-sm font-medium mb-2">{d.strategy}</p>
          <p className={`text-sm font-bold ${d.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            ${d.pnl.toFixed(2)}
          </p>
          <div className="text-[#888] text-xs mt-2 space-y-1">
            <p>Trades: {d.trades}</p>
            <p>Winrate: {d.winrate}%</p>
            <p>Avg R: {d.avgR}</p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
      <h3 className="text-[#c0c0c0] text-sm font-medium mb-4">Strategy Performance</h3>
      <div className="h-64">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical">
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#666', fontSize: 10 }} />
              <YAxis 
                type="category" 
                dataKey="strategy" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#888', fontSize: 11 }}
                width={100}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                {data.map((entry, index) => (
                  <Cell key={index} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-[#666]">
            No strategy data yet
          </div>
        )}
      </div>
    </div>
  );
}