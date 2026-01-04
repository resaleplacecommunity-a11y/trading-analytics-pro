import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, startOfDay, parseISO } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

export default function EquityCurve({ trades, userTimezone = 'UTC' }) {
  const startingBalance = 100000;
  
  // Get today in user's timezone
  const now = new Date();
  const todayInUserTz = formatInTimeZone(now, userTimezone, 'yyyy-MM-dd');
  const today = startOfDay(parseISO(todayInUserTz));
  const thirtyDaysAgo = subDays(today, 29);
  
  // Build daily equity tracking
  const dailyEquity = {};
  let runningBalance = startingBalance;
  
  // Collect all PNL events (closed trades + partial closes)
  const pnlEvents = [];
  
  // Add closed trades
  trades.filter(t => t.close_price && (t.date_close || t.date_open || t.date)).forEach(t => {
    pnlEvents.push({
      date: new Date(t.date_close || t.date_open || t.date),
      pnl: t.pnl_usd || 0
    });
  });
  
  // Add partial closes from open trades
  trades.filter(t => !t.close_price && t.partial_closes).forEach(t => {
    try {
      const partials = JSON.parse(t.partial_closes);
      partials.forEach(pc => {
        if (pc.timestamp && pc.pnl_usd) {
          pnlEvents.push({
            date: new Date(pc.timestamp),
            pnl: pc.pnl_usd
          });
        }
      });
    } catch {}
  });
  
  // Sort all events chronologically
  pnlEvents.sort((a, b) => a.date - b.date);
  
  // Calculate balance at start of 30-day period
  pnlEvents.forEach(event => {
    const eventDate = startOfDay(event.date);
    if (eventDate < thirtyDaysAgo) {
      runningBalance += event.pnl;
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
  
  // Apply PNL from all events in the 30-day window
  pnlEvents.forEach(event => {
    const eventDate = startOfDay(event.date);
    if (eventDate >= thirtyDaysAgo && eventDate <= today) {
      const dateKey = format(eventDate, 'yyyy-MM-dd');
      runningBalance += event.pnl;
      
      // Update this day and all future days
      Object.keys(dailyEquity).forEach(key => {
        if (new Date(key) >= eventDate) {
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
      const formatWithSpaces = (num) => Math.round(num).toLocaleString('ru-RU').replace(/,/g, ' ');
      return (
        <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3 shadow-xl">
          <p className="text-[#888] text-xs mb-1">{format(new Date(payload[0].payload.date), 'MMM dd, yyyy')}</p>
          <p className="text-[#c0c0c0] text-sm font-bold">${formatWithSpaces(value)}</p>
          <p className={`text-xs ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {pnl >= 0 ? '+' : ''}${formatWithSpaces(pnl)}
          </p>
        </div>
      );
    }
    return null;
  };

  const monthName = format(today, 'MMM');

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