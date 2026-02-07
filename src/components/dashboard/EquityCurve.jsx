import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { parseTradeDateToUserTz, getTodayInUserTz } from '../utils/dateUtils';

export default function EquityCurve({ trades, userTimezone = 'UTC', startingBalance = 100000, currentBalance }) {
  
  const data = useMemo(() => {
    // If currentBalance is provided, calculate BACKWARDS from current balance
    // This ensures the chart always ends at the actual wallet balance
    if (currentBalance) {
      const now = new Date();
      const dayKeys = [];
      for (let i = 29; i >= 0; i--) {
        const date = subDays(now, i);
        const dateKey = formatInTimeZone(date, userTimezone, 'yyyy-MM-dd');
        dayKeys.push(dateKey);
      }
      
      const todayStr = getTodayInUserTz(userTimezone);
      
      // Collect all PNL events by date
      const dailyPnl = {};
      
      trades.filter(t => t.close_price && (t.date_close || t.date_open || t.date)).forEach(t => {
        const dateStr = parseTradeDateToUserTz(t.date_close || t.date_open || t.date, userTimezone);
        if (dateStr && dayKeys.includes(dateStr)) {
          dailyPnl[dateStr] = (dailyPnl[dateStr] || 0) + (t.pnl_usd || 0);
        }
      });
      
      trades.filter(t => !t.close_price && t.partial_closes).forEach(t => {
        try {
          const partials = JSON.parse(t.partial_closes);
          partials.forEach(pc => {
            if (pc.timestamp && pc.pnl_usd) {
              const dateStr = parseTradeDateToUserTz(pc.timestamp, userTimezone);
              if (dateStr && dayKeys.includes(dateStr)) {
                dailyPnl[dateStr] = (dailyPnl[dateStr] || 0) + pc.pnl_usd;
              }
            }
          });
        } catch {}
      });
      
      // Calculate BACKWARDS from today's balance
      const dailyEquity = {};
      let runningEquity = currentBalance;
      
      // Start from today and work backwards
      for (let i = dayKeys.length - 1; i >= 0; i--) {
        const dateKey = dayKeys[i];
        const dayNum = dateKey.split('-')[2];
        
        dailyEquity[dateKey] = {
          date: dateKey,
          equity: runningEquity,
          day: dayNum
        };
        
        // Subtract today's PNL to get yesterday's equity
        const dayPnl = dailyPnl[dateKey] || 0;
        runningEquity -= dayPnl;
      }
      
      return Object.keys(dailyEquity)
        .sort()
        .map(key => dailyEquity[key]);
    }
    
    // FALLBACK: Original forward calculation if no currentBalance provided
    // Get today in user's timezone
    const todayStr = getTodayInUserTz(userTimezone);
    const now = new Date();
    
    // Build array of last 30 days in user timezone
    const dayKeys = [];
    for (let i = 29; i >= 0; i--) {
      const date = subDays(now, i);
      const dateKey = formatInTimeZone(date, userTimezone, 'yyyy-MM-dd');
      dayKeys.push(dateKey);
    }
    
    const thirtyDaysAgoStr = dayKeys[0];
    
    // Build daily equity tracking
    const dailyEquity = {};
    let runningBalance = startingBalance;
    
    // Collect all PNL events (closed trades + partial closes) with timezone-aware dates
    const pnlEvents = [];
    
    // Add closed trades
    trades.filter(t => t.close_price && (t.date_close || t.date_open || t.date)).forEach(t => {
      const dateStr = parseTradeDateToUserTz(t.date_close || t.date_open || t.date, userTimezone);
      if (dateStr) {
        pnlEvents.push({
          dateStr,
          pnl: t.pnl_usd || 0
        });
      }
    });
    
    // Add partial closes from open trades
    trades.filter(t => !t.close_price && t.partial_closes).forEach(t => {
      try {
        const partials = JSON.parse(t.partial_closes);
        partials.forEach(pc => {
          if (pc.timestamp && pc.pnl_usd) {
            const dateStr = parseTradeDateToUserTz(pc.timestamp, userTimezone);
            if (dateStr) {
              pnlEvents.push({
                dateStr,
                pnl: pc.pnl_usd
              });
            }
          }
        });
      } catch {}
    });
    
    // Sort all events chronologically by date string
    pnlEvents.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
    
    // Calculate balance at start of 30-day period (events before window)
    pnlEvents.forEach(event => {
      if (event.dateStr < thirtyDaysAgoStr) {
        runningBalance += event.pnl;
      }
    });
    
    // Initialize all 30 days with starting balance
    dayKeys.forEach(dateKey => {
      const dayNum = dateKey.split('-')[2];
      dailyEquity[dateKey] = {
        date: dateKey,
        equity: runningBalance,
        day: dayNum
      };
    });
    
    // Apply PNL from all events in the 30-day window
    pnlEvents.forEach(event => {
      if (event.dateStr >= thirtyDaysAgoStr && event.dateStr <= todayStr) {
        runningBalance += event.pnl;
        
        // Update this day and all future days
        Object.keys(dailyEquity).forEach(key => {
          if (key >= event.dateStr) {
            dailyEquity[key].equity = runningBalance;
          }
        });
      }
    });
    
    return Object.values(dailyEquity);
  }, [trades, userTimezone, startingBalance, currentBalance]);

  const now = new Date();

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

  const monthName = formatInTimeZone(now, userTimezone, 'MMM');

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