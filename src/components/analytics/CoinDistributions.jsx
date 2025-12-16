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
        coinMap[coin] = { profits: [], losses: [] };
      }
      const pnl = t.pnl_usd || 0;
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
        count: data.profits.length
      }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const lossData = Object.entries(coinMap)
      .map(([coin, data]) => ({
        name: coin,
        value: data.losses.reduce((s, v) => s + v, 0),
        count: data.losses.length
      }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    return { profitData, lossData };
  }, [trades]);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-3 shadow-xl">
          <p className="text-sm text-[#c0c0c0] font-medium">{payload[0].name}</p>
          <p className="text-xs text-emerald-400">
            ${payload[0].value.toLocaleString('ru-RU').replace(/,/g, ' ')}
          </p>
          <p className="text-xs text-[#666]">
            {payload[0].payload.count} trades • {((payload[0].value / payload[0].payload.total) * 100).toFixed(1)}%
          </p>
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
          <div className="text-center py-12 text-[#666]">No profit data</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={profitWithTotal}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                onClick={(data) => data && onDrillDown && onDrillDown(`Coin: ${data.name}`, trades.filter(t => t.coin?.replace('USDT', '') === data.name))}
                cursor="pointer"
              >
                {profitWithTotal.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} opacity={0.9} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
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
          <div className="text-center py-12 text-[#666]">No loss data</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={lossWithTotal}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                onClick={(data) => data && onDrillDown && onDrillDown(`Coin: ${data.name}`, trades.filter(t => t.coin?.replace('USDT', '') === data.name))}
                cursor="pointer"
              >
                {lossWithTotal.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} opacity={0.9} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}