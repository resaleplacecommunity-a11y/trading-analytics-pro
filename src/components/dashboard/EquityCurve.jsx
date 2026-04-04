import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { subDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { parseTradeDateToUserTz, getTodayInUserTz } from '../utils/dateUtils';

export default function EquityCurve({ trades, userTimezone = 'UTC', startingBalance = 100000, currentBalance }) {

  const fmt = (num) => {
    try { return Math.round(Math.abs(num || 0)).toLocaleString('ru-RU').replace(/,/g, ' '); }
    catch { return '0'; }
  };

  const effectiveStartingBalance = useMemo(() => {
    try {
      if (startingBalance && startingBalance !== 100000) return Number(startingBalance);
      const bs = (trades || []).map(t => parseFloat(t.account_balance_at_entry || 0)).filter(b => b > 0);
      if (bs.length > 0) return Math.max(...bs);
      return Number(currentBalance) || 100000;
    } catch { return 100000; }
  }, [trades, startingBalance, currentBalance]);

  const { data, withdrawalDays } = useMemo(() => {
    try {
      const todayStr = getTodayInUserTz(userTimezone);
      const now = new Date();
      const dayKeys = [];
      for (let i = 29; i >= 0; i--) {
        const dateKey = formatInTimeZone(subDays(now, i), userTimezone, 'yyyy-MM-dd');
        dayKeys.push(dateKey);
      }
      const thirtyDaysAgoStr = dayKeys[0];

      // Collect PnL events
      const pnlEvents = [];
      (trades || []).forEach(t => {
        if (t.close_price && (t.date_close || t.date_open || t.date)) {
          const ds = parseTradeDateToUserTz(t.date_close || t.date_open || t.date, userTimezone);
          if (ds) pnlEvents.push({ dateStr: ds, pnl: parseFloat(t.pnl_usd || 0) || 0 });
        }
        if (!t.close_price && t.partial_closes) {
          try {
            JSON.parse(t.partial_closes).forEach(pc => {
              if (pc.timestamp && pc.pnl_usd) {
                const ds = parseTradeDateToUserTz(pc.timestamp, userTimezone);
                if (ds) pnlEvents.push({ dateStr: ds, pnl: parseFloat(pc.pnl_usd || 0) || 0 });
              }
            });
          } catch {}
        }
      });
      pnlEvents.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

      // Running balance from starting balance
      let running = effectiveStartingBalance;
      pnlEvents.forEach(e => { if (e.dateStr < thirtyDaysAgoStr) running += e.pnl; });

      const dailyEquity = {};
      dayKeys.forEach(dk => {
        dailyEquity[dk] = { date: dk, equity: running, day: dk.split('-')[2], withdrawal: null };
      });

      pnlEvents.forEach(e => {
        if (e.dateStr >= thirtyDaysAgoStr && e.dateStr <= todayStr) {
          running += e.pnl;
          Object.keys(dailyEquity).forEach(k => { if (k >= e.dateStr) dailyEquity[k].equity = running; });
        }
      });

      // Anchor last point to currentBalance — difference = withdrawal/deposit
      const withdrawalDays = [];
      if (currentBalance && currentBalance > 0) {
        const projected = running; // what we expect from trades
        const diff = currentBalance - projected;
        const threshold = Math.max(50, effectiveStartingBalance * 0.02);
        if (Math.abs(diff) > threshold) {
          // Apply the diff to today
          dailyEquity[todayStr] = { ...dailyEquity[todayStr], equity: currentBalance };
          withdrawalDays.push({ date: todayStr, day: todayStr.split('-')[2], amount: diff });
        }
      }

      return { data: dayKeys.map(k => dailyEquity[k]).filter(Boolean), withdrawalDays };
    } catch {
      return { data: [], withdrawalDays: [] };
    }
  }, [trades, userTimezone, effectiveStartingBalance, currentBalance]);

  const CustomTooltip = ({ active, payload }) => {
    try {
      if (!active || !payload || !payload.length) return null;
      const item = payload[0].payload;
      if (!item) return null;
      const value = item.equity || 0;
      const pnl = value - effectiveStartingBalance;
      const wdEntry = withdrawalDays.find(w => w.date === item.date);
      return (
        <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3 shadow-xl min-w-[140px]">
          <p className="text-[#888] text-xs mb-1">{item.date || ''}</p>
          <p className="text-[#c0c0c0] text-sm font-bold">${fmt(value)}</p>
          <p className={`text-xs ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {pnl >= 0 ? '+' : '-'}${fmt(pnl)}
          </p>
          {wdEntry && (
            <p className={`text-[10px] mt-1 pt-1 border-t border-white/[0.06] ${wdEntry.amount < 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {wdEntry.amount < 0 ? `↓ -$${fmt(wdEntry.amount)} withdrawn` : `↑ +$${fmt(wdEntry.amount)} deposited`}
            </p>
          )}
        </div>
      );
    } catch { return null; }
  };

  const monthName = (() => { try { return formatInTimeZone(new Date(), userTimezone, 'MMM'); } catch { return ''; } })();

  return (
    <div className="bg-white/[0.03] backdrop-blur-xl rounded-xl p-5 border border-white/[0.07] shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
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
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#666', fontSize: 10 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#666', fontSize: 10 }} tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            {withdrawalDays.map(w => (
              <ReferenceLine
                key={w.date}
                x={w.day}
                stroke={w.amount < 0 ? '#f59e0b' : '#10b981'}
                strokeDasharray="4 2"
                strokeWidth={1.5}
              />
            ))}
            <Area type="monotone" dataKey="equity" stroke="#10b981" strokeWidth={2} fill="url(#equityGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
