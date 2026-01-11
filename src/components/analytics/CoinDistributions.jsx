import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16', '#f97316'];

export default function CoinDistributions({ trades, onDrillDown }) {
  const coinData = useMemo(() => {
    const coinMap = {};
    
    trades.filter(t => t.close_price && t.coin).forEach(t => {
      const coin = t.coin.replace('USDT', '');
      if (!coinMap[coin]) {
        coinMap[coin] = { profits: [], losses: [], totalPnl: 0 };
      }
      const pnl = t.pnl_usd || 0;
      coinMap[coin].totalPnl += pnl;
      if (pnl > 0) {
        coinMap[coin].profits.push(pnl);
      } else if (pnl < 0) {
        coinMap[coin].losses.push(Math.abs(pnl));
      }
    });

    const profitData = Object.entries(coinMap)
      .map(([coin, data]) => ({
        name: coin,
        value: data.profits.reduce((s, v) => s + v, 0),
        count: data.profits.length,
        totalPnl: data.totalPnl
      }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const lossData = Object.entries(coinMap)
      .map(([coin, data]) => ({
        name: coin,
        value: data.losses.reduce((s, v) => s + v, 0),
        count: data.losses.length,
        totalPnl: data.totalPnl
      }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    return { profitData, lossData };
  }, [trades]);

  const CustomTooltip = ({ active, payload, isProfit }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#0a0a0a] border-2 border-[#2a2a2a] rounded-xl p-4 shadow-2xl backdrop-blur-sm">
          <p className="text-base text-[#c0c0c0] font-bold mb-2">{payload[0].name}</p>
          <div className="space-y-1.5">
            <div className="flex justify-between gap-4">
              <span className="text-xs text-[#888]">{isProfit ? 'Total Profit:' : 'Total Loss:'}</span>
              <span className={cn("text-sm font-bold", isProfit ? "text-emerald-400" : "text-red-400")}>
                ${payload[0].value.toLocaleString('ru-RU').replace(/,/g, ' ')}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-xs text-[#888]">Trades:</span>
              <span className="text-sm font-medium text-[#c0c0c0]">{data.count}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-xs text-[#888]">Net PNL:</span>
              <span className={cn("text-sm font-bold", data.totalPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                {data.totalPnl >= 0 ? '+' : ''}${Math.abs(data.totalPnl).toLocaleString('ru-RU').replace(/,/g, ' ')}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-xs text-[#888]">Share:</span>
              <span className="text-sm font-medium text-violet-400">
                {((payload[0].value / data.total) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Add total to each item for percentage calculation
  const profitWithTotal = coinData.profitData.map(item => ({
    ...item,
    total: coinData.profitData.reduce((s, d) => s + d.value, 0)
  }));

  const lossWithTotal = coinData.lossData.map(item => ({
    ...item,
    total: coinData.lossData.reduce((s, d) => s + d.value, 0)
  }));

  return (
    <div className="grid grid-cols-2 gap-6 mb-6">
      {/* Profit Distribution */}
      <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-6">
        <h3 className="text-lg font-bold text-[#c0c0c0] mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          Profit Distribution by Coin
        </h3>
        {coinData.profitData.length === 0 ? (
          <div className="text-center py-12 text-[#666]">
            <div className="text-4xl mb-2">📊</div>
            <p className="text-sm">No profit data</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={profitWithTotal}
                cx="50%"
                cy="50%"
                labelLine={{
                  stroke: '#666',
                  strokeWidth: 1
                }}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={90}
                innerRadius={50}
                fill="#8884d8"
                dataKey="value"
                onClick={(data) => data && onDrillDown && onDrillDown(`Coin: ${data.name}`, trades.filter(t => t.coin?.replace('USDT', '') === data.name))}
                cursor="pointer"
              >
                {profitWithTotal.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]} 
                    opacity={0.95}
                    stroke="#0a0a0a"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip content={(props) => <CustomTooltip {...props} isProfit={true} />} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Loss Distribution */}
      <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-6">
        <h3 className="text-lg font-bold text-[#c0c0c0] mb-4 flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-red-400" />
          Loss Distribution by Coin
        </h3>
        {coinData.lossData.length === 0 ? (
          <div className="text-center py-12 text-[#666]">
            <div className="text-4xl mb-2">✨</div>
            <p className="text-sm">No loss data</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={lossWithTotal}
                cx="50%"
                cy="50%"
                labelLine={{
                  stroke: '#666',
                  strokeWidth: 1
                }}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={90}
                innerRadius={50}
                fill="#8884d8"
                dataKey="value"
                onClick={(data) => data && onDrillDown && onDrillDown(`Coin: ${data.name}`, trades.filter(t => t.coin?.replace('USDT', '') === data.name))}
                cursor="pointer"
              >
                {lossWithTotal.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]} 
                    opacity={0.95}
                    stroke="#0a0a0a"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip content={(props) => <CustomTooltip {...props} isProfit={false} />} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}