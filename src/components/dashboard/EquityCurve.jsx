import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format, subDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { parseTradeDateToUserTz, getTodayInUserTz } from '../utils/dateUtils';

export default function EquityCurve({ trades, userTimezone = 'UTC', startingBalance = 100000, currentBalance }) {
  
  const { data, withdrawal } = useMemo(() => {
    const todayStr = getTodayInUserTz(userTimezone);
    const now = new Date();
    
    const dayKeys = [];
    for (let i = 29; i >= 0; i--) {
      const date = subDays(now, i);
      const dateKey = formatInTimeZone(date, userTimezone, 'yyyy-MM-dd');
      dayKeys.push(dateKey);
    }
    
    const thirtyDaysAgoStr = dayKeys[0];
    const dailyEquity = {};
    const pnlEvents = [];
    
    trades.filter(t => t.close_price && (t.date_close || t.date_open || t.date)).forEach(t => {
      const dateStr = parseTradeDateToUserTz(t.date_close || t.date_open || t.date, userTimezone);
      if (dateStr) pnlEvents.push({ dateStr, pnl: t.pnl_usd || 0 });
    });
    
    trades.filter(t => !t.close_price && t.partial_closes).forEach(t => {
      try {
        const partials = JSON.parse(t.partial_closes);
        partials.forEach(pc => {
          if (pc.timestamp && pc.pnl_usd) {
            const dateStr = parseTradeDateToUserTz(pc.timestamp, userTimezone);
            if (dateStr) pnlEvents.push({ dateStr, pnl: pc.pnl_usd });
          }
        });
      } catch {}
    });
    
    pnlEvents.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
    
    // Forward from startingBalance
    let runningBalance = startingBalance;
    // Apply PnL before window start
    pnlEvents.forEach(event => {
      if (event.dateStr < thirtyDaysAgoStr) runningBalance += event.pnl;
    });
    
    dayKeys.forEach(dateKey => {
      dailyEquity[dateKey] = { date: dateKey, equity: runningBalance, day: dateKey.split('-')[2] };
    });
    
    pnlEvents.forEach(event => {
      if (event.dateStr >= thirtyDaysAgoStr && event.dateStr <= todayStr) {
        runningBalance += event.pnl;
        Object.keys(dailyEquity).forEach(key => {
          if (key >= event.dateStr) dailyEquity[key].equity = runningBalance;
        });
      }
    });

    // Detect withdrawal/deposit: expected = startingBalance + totalPnl, actual = currentBalance
    let withdrawalInfo = null;
    if (currentBalance && currentBalance > 0) {
      const totalPnl = pnlEvents.reduce((s, e) => s + e.pnl, 0);
      const expected = startingBalance + totalPnl;
      const diff = currentBalance - expected; // negative = withdrawal, positive = deposit
      if (Math.abs(diff) > 10) { // threshold $10
        withdrawalInfo = {
          amount: diff,
          date: todayStr,
          equity: dailyEquity[todayStr]?.equity || runningBalance,
        };
      }
    }
    
    return { data: Object.values(dailyEquity), withdrawal: withdrawalInfo };
  }, [trades, userTimezone, startingBalance, currentBalance]);

  const now = new Date();
  const fmt = (num) => Math.round(Math.abs(num)).toLocaleString('ru-RU').replace(/,/g, ' ');

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const value = payload[0].value;
      const pnl = value - startingBalance;
      return (
        <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3 shadow-xl">
          <p className="text-[#888] text-xs mb-1">{format(new Date(payload[0].payload.date), 'MMM dd, yyyy')}</p>
          <p className="text-[#c0c0c0] text-sm font-bold">${fmt(value)}</p>
          <p className={`text-xs ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {pnl >= 0 ? '+' : '-'}${fmt(pnl)}
          </p>
        </div>
      );
    }
    return null;
  };

  const monthName = formatInTimeZone(now, userTimezone, 'MMM');

  return (
    <div className="bg-white/[0.03] backdrop-blur-xl rounded-xl p-5 border border-white/[0.07] shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-[#c0c0c0] text-sm font-medium">Equity Curve</h3>
          {withdrawal && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${withdrawal.amount < 0 ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'}`}>
              {withdrawal.amount < 0 ? '↓ Withdrawal' : '↑ Deposit'} ${fmt(withdrawal.amount)}
            </span>
          )}
        </div>
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
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#666', fontSize: 10 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#666', fontSize: 10 }} tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            {withdrawal && (
              <ReferenceLine
                x={withdrawal.date.split('-')[2]}
                stroke={withdrawal.amount < 0 ? '#f59e0b' : '#10b981'}
                strokeDasharray="3 3"
                label={{ value: withdrawal.amount < 0 ? `−$${fmt(withdrawal.amount)}` : `+$${fmt(withdrawal.amount)}`, fill: withdrawal.amount < 0 ? '#f59e0b' : '#10b981', fontSize: 9, position: 'top' }}
              />
            )}
            <Area type="monotone" dataKey="equity" stroke="#10b981" strokeWidth={2} fill="url(#equityGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
