import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format } from 'date-fns';

export default function PnlChart({ trades, period = 'daily' }) {
  // Group trades by date
  const groupedData = trades.reduce((acc, trade) => {
    const dateKey = format(new Date(trade.date), 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = { date: dateKey, pnl: 0, count: 0 };
    }
    acc[dateKey].pnl += (trade.pnl_usd || 0);
    acc[dateKey].count += 1;
    return acc;
  }, {});

  const data = Object.values(groupedData).sort((a, b) => new Date(a.date) - new Date(b.date));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3 shadow-xl">
          <p className="text-[#888] text-xs mb-1">{format(new Date(d.date), 'MMM dd, yyyy')}</p>
          <p className={`text-sm font-bold ${d.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {d.pnl >= 0 ? '+' : ''}${d.pnl.toFixed(2)}
          </p>
          <p className="text-[#666] text-xs mt-1">{d.count} trades</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
      <h3 className="text-[#c0c0c0] text-sm font-medium mb-4">Daily PNL</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false}
              tick={{ fill: '#666', fontSize: 10 }}
              tickFormatter={(date) => format(new Date(date), 'MM/dd')}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false}
              tick={{ fill: '#666', fontSize: 10 }}
              tickFormatter={(val) => `$${val}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}