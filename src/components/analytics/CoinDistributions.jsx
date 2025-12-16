import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Coins, TrendingUp, TrendingDown } from 'lucide-react';

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
        coin,
        value: data.profits.reduce((s, v) => s + v, 0),
        count: data.profits.length
      }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const lossData = Object.entries(coinMap)
      .map(([coin, data]) => ({
        coin,
        value: data.losses.reduce((s, v) => s + v, 0),
        count: data.losses.length
      }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    return { profitData, lossData };
  }, [trades]);

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
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={coinData.profitData}>
              <XAxis 
                dataKey="coin" 
                stroke="#666" 
                tick={{ fill: '#888', fontSize: 11 }}
              />
              <YAxis 
                stroke="#666" 
                tick={{ fill: '#888', fontSize: 11 }}
                tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#111', border: '1px solid #2a2a2a', borderRadius: '8px' }}
                labelStyle={{ color: '#888' }}
                formatter={(value, name, props) => [
                  `$${value.toLocaleString('ru-RU').replace(/,/g, ' ')} (${props.payload.count} trades)`,
                  'Profit'
                ]}
              />
              <Bar 
                dataKey="value" 
                radius={[4, 4, 0, 0]}
                onClick={(data) => data && onDrillDown && onDrillDown(`Coin: ${data.coin}`, trades.filter(t => t.coin?.replace('USDT', '') === data.coin))}
                cursor="pointer"
              >
                {coinData.profitData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill="#10b981" opacity={0.8} />
                ))}
              </Bar>
            </BarChart>
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
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={coinData.lossData}>
              <XAxis 
                dataKey="coin" 
                stroke="#666" 
                tick={{ fill: '#888', fontSize: 11 }}
              />
              <YAxis 
                stroke="#666" 
                tick={{ fill: '#888', fontSize: 11 }}
                tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#111', border: '1px solid #2a2a2a', borderRadius: '8px' }}
                labelStyle={{ color: '#888' }}
                formatter={(value, name, props) => [
                  `$${value.toLocaleString('ru-RU').replace(/,/g, ' ')} (${props.payload.count} trades)`,
                  'Loss'
                ]}
              />
              <Bar 
                dataKey="value" 
                radius={[4, 4, 0, 0]}
                onClick={(data) => data && onDrillDown && onDrillDown(`Coin: ${data.coin}`, trades.filter(t => t.coin?.replace('USDT', '') === data.coin))}
                cursor="pointer"
              >
                {coinData.lossData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill="#ef4444" opacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}