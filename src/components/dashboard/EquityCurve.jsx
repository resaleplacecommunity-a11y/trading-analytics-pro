import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { subDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { parseTradeDateToUserTz, getTodayInUserTz } from '../utils/dateUtils';

export default function EquityCurve({ trades, userTimezone = 'UTC', startingBalance = 100000, currentBalance }) {

  const fmt = (num) => {
    try { return Math.round(Math.abs(num || 0)).toLocaleString('ru-RU').replace(/,/g, ' '); }
    catch { return '0'; }
  };

  // Starting balance: explicit > earliest closed trade balance > fallback
  const effectiveStartingBalance = useMemo(() => {
    try {
      if (startingBalance && startingBalance !== 100000) return Number(startingBalance);
      const earliest = [...(trades || [])]
        .filter(t => t.close_price && parseFloat(t.account_balance_at_entry || 0) > 0)
        .sort((a, b) => new Date(a.date_open || a.date || 0) - new Date(b.date_open || b.date || 0));
      if (earliest.length > 0) return parseFloat(earliest[0].account_balance_at_entry);
      return Number(currentBalance) || 100000;
    } catch { return 100000; }
  }, [trades, startingBalance, currentBalance]);

  const { data, transferInfo } = useMemo(() => {
    try {
      const todayStr = getTodayInUserTz(userTimezone);
      const now = new Date();
      const dayKeys = [];
      for (let i = 29; i >= 0; i--) {
        dayKeys.push(formatInTimeZone(subDays(now, i), userTimezone, 'yyyy-MM-dd'));
      }
      const thirtyDaysAgoStr = dayKeys[0];

      // Step 1: Collect PnL events from CLOSED trades only (no open, no partial closes)
      const pnlEvents = [];
      (trades || []).forEach(t => {
        if (!t.close_price) return; // open trades excluded entirely
        const ds = parseTradeDateToUserTz(t.date_close || t.date_open || t.date, userTimezone);
        if (ds) pnlEvents.push({ dateStr: ds, pnl: parseFloat(t.pnl_usd || 0) || 0 });
      });
      pnlEvents.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

      // Step 2: Build equity curve forward from startingBalance
      let running = effectiveStartingBalance;
      pnlEvents.forEach(e => { if (e.dateStr < thirtyDaysAgoStr) running += e.pnl; });

      const dailyPnl = {};
      const dailyEquity = {};
      dayKeys.forEach(dk => {
        dailyEquity[dk] = { date: dk, equity: running, cumPnl: running - effectiveStartingBalance, day: dk.split('-')[2] };
        dailyPnl[dk] = 0;
      });

      pnlEvents.forEach(e => {
        if (e.dateStr >= thirtyDaysAgoStr && e.dateStr <= todayStr) {
          running += e.pnl;
          dailyPnl[e.dateStr] = (dailyPnl[e.dateStr] || 0) + e.pnl;
          dayKeys.forEach(k => {
            if (k >= e.dateStr) {
              dailyEquity[k].equity = running;
              dailyEquity[k].cumPnl = running - effectiveStartingBalance;
            }
          });
        }
      });

      // Step 3: Detect transfer (withdrawal/deposit)
      // Formula: transfer = currentBalance - (startingBalance + totalClosedPnl)
      // This is reliable because: closed PnL is deterministic, no unrealized noise
      let transferInfo = null;
      const totalClosedPnl = pnlEvents.reduce((s, e) => s + e.pnl, 0);
      const projectedBalance = effectiveStartingBalance + totalClosedPnl;
      if (currentBalance && currentBalance > 0 && effectiveStartingBalance !== currentBalance) {
        const diff = currentBalance - projectedBalance;
        const threshold = Math.max(50, effectiveStartingBalance * 0.02); // >2% or >$50
        if (Math.abs(diff) > threshold) {
          transferInfo = { amount: diff, date: todayStr };
        }
      }

      return { data: dayKeys.map(k => dailyEquity[k]).filter(Boolean), transferInfo };
    } catch {
      return { data: [], transferInfo: null };
    }
  }, [trades, userTimezone, effectiveStartingBalance, currentBalance]);

  const CustomTooltip = ({ active, payload }) => {
    try {
      if (!active || !payload?.length) return null;
      const item = payload[0].payload;
      const value = item?.equity || 0;
      const cumPnl = item?.cumPnl || 0;
      const isToday = item?.date === getTodayInUserTz(userTimezone);
      return (
        <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3 shadow-xl min-w-[140px]">
          <p className="text-[#888] text-xs mb-1">{item?.date || ''}</p>
          <p className="text-[#c0c0c0] text-sm font-bold">${fmt(value)}</p>
          <p className={`text-xs ${cumPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {cumPnl >= 0 ? '+' : '-'}${fmt(cumPnl)} PnL
          </p>
          {isToday && transferInfo && (
            <p className={`text-[10px] mt-1 pt-1 border-t border-white/[0.06] ${transferInfo.amount < 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {transferInfo.amount < 0
                ? `↓ -$${fmt(transferInfo.amount)} withdrawn`
                : `↑ +$${fmt(transferInfo.amount)} deposited`}
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
            <Area type="monotone" dataKey="equity" stroke="#10b981" strokeWidth={2} fill="url(#equityGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
