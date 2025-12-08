import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';

export default function EquityCurve({ trades }) {
  const startingBalance = 100000;
  const today = startOfDay(new Date());
  const thirtyDaysAgo = subDays(today, 29);
  
  // Build daily equity tracking
  const dailyEquity = {};
  let runningBalance = startingBalance;
  
  // Sort all trades chronologically
  const allTradesSorted = [...trades]
    .filter(t => t.status === 'closed' && t.close_price && t.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Calculate balance at start of 30-day period
  allTradesSorted.forEach(trade => {
    const tradeDate = startOfDay(new Date(trade.date));
    if (tradeDate < thirtyDaysAgo) {
      runningBalance += (trade.pnl_usd || 0);
    }
  });
  
  // Initialize all 30 days with starting balance
  for (let i = 0; i < 30; i++) {
    const date = subDays(today, 29 - i);
    const dateKey = format(date, 'yyyy-MM-dd');
    dailyEquity[dateKey] = {
      date: dateKey,
      equity: runningBalance,
      day: format(date, 'dd')
    };
  }
  
  // Apply PNL from trades in the 30-day window
  allTradesSorted.forEach(trade => {
    const tradeDate = startOfDay(new Date(trade.date));
    if (tradeDate >= thirtyDaysAgo && tradeDate <= today) {
      const dateKey = format(tradeDate, 'yyyy-MM-dd');
      runningBalance += (trade.pnl_usd || 0);
      
      // Update this day and all future days
      Object.keys(dailyEquity).forEach(key => {
        if (new Date(key) >= tradeDate) {
          dailyEquity[key].equity = runningBalance;
        }
      });
    }
  });
  
  const data = Object.values(dailyEquity);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const value = payload[0].value;
      const pnl = value - startingBalance;
      return (
        <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3 shadow-xl">
          <p className="text-[#888] text-xs mb-1">{format(new Date(payload[0].payload.date), 'MMM dd, yyyy')}</p>
          <p className="text-[#c0c0c0] text-sm font-bold">${value.toFixed(2)}</p>
          <p className={`text-xs ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  const monthName = format(thirtyDaysAgo, 'MMM');

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[#c0c0c0] text-sm font-medium">Equity Curve</h3>
        <span className="text-[#666] text-xs">Last 30 Days • {monthName}</span>
      </div>
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
              dataKey="day" 
              axisLine={false} 
              tickLine={false}
              tick={{ fill: '#666', fontSize: 10 }}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false}
              tick={{ fill: '#666', fontSize: 10 }}
              tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
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