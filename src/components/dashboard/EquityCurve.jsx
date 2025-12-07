import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

export default function EquityCurve({ trades }) {
  const startingBalance = 100000;
  
  // Get last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // Filter and sort trades from last 30 days
  const recentTrades = trades
    .filter(t => new Date(t.date) >= thirtyDaysAgo && t.status === 'closed' && t.close_price)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Build daily equity data
  const dailyData = {};
  let cumulative = startingBalance;
  
  // Initialize all days in range with starting balance
  for (let d = new Date(thirtyDaysAgo); d <= new Date(); d.setDate(d.getDate() + 1)) {
    const dateKey = format(d, 'yyyy-MM-dd');
    dailyData[dateKey] = { date: dateKey, equity: cumulative };
  }
  
  // Add PNL from trades
  recentTrades.forEach(trade => {
    const dateKey = format(new Date(trade.date), 'yyyy-MM-dd');
    cumulative += (trade.pnl_usd || 0);
    dailyData[dateKey].equity = cumulative;
    
    // Update all subsequent days
    for (let d = new Date(dateKey); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const futureKey = format(d, 'yyyy-MM-dd');
      if (dailyData[futureKey]) {
        dailyData[futureKey].equity = cumulative;
      }
    }
  });
  
  const data = Object.values(dailyData).sort((a, b) => new Date(a.date) - new Date(b.date));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3 shadow-xl">
          <p className="text-[#888] text-xs">{format(new Date(payload[0].payload.date), 'MMM dd, yyyy')}</p>
          <p className={`text-sm font-bold ${payload[0].value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            ${payload[0].value.toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
      <h3 className="text-[#c0c0c0] text-sm font-medium mb-4">Equity Curve</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
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
            <Area 
              type="monotone" 
              dataKey="equity" 
              stroke="#10b981" 
              strokeWidth={2}
              fill="url(#equityGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}