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
      // Priority 1: explicitly set starting_balance from profile (most reliable)
      if (startingBalance && startingBalance !== 100000) return Number(startingBalance);
      // Priority 2: balance at the EARLIEST trade (sort by date, take minimum balance)
      const closedWithBalance = (trades || [])
        .filter(t => t.close_price && t.account_balance_at_entry > 0)
        .sort((a, b) => new Date(a.date_open || a.date || 0) - new Date(b.date_open || b.date || 0));
      if (closedWithBalance.length > 0) return parseFloat(closedWithBalance[0].account_balance_at_entry);
      return Number(currentBalance) || 100000;
    } catch { return 100000; }
  }, [trades, startingBalance, currentBalance]);

  const { data, withdrawalInfo, totalTradePnl } = useMemo(() => {
    try {
      const todayStr = getTodayInUserTz(userTimezone);
      const now = new Date();
      const dayKeys = [];
      for (let i = 29; i >= 0; i--) {
        const dateKey = formatInTimeZone(subDays(now, i), userTimezone, 'yyyy-MM-dd');
        dayKeys.push(dateKey);
      }
      const thirtyDaysAgoStr = dayKeys[0];

      // Collect PnL events from CLOSED trades only
      // Partial closes from open positions are NOT included — they are part of realized_pnl_usd
      // which is already reflected in currentBalance from exchange
      const pnlEvents = [];
      (trades || []).forEach(t => {
        if (t.close_price && (t.date_close || t.date_open || t.date)) {
          const ds = parseTradeDateToUserTz(t.date_close || t.date_open || t.date, userTimezone);
          if (ds) pnlEvents.push({ dateStr: ds, pnl: parseFloat(t.pnl_usd || 0) || 0 });
        }
        // NOTE: partial closes from open trades are intentionally excluded here
        // They would cause false "withdrawal" detection since currentBalance from exchange
        // does NOT include unrealized PnL of still-open positions
      });
      pnlEvents.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

      // Total trade PnL (for display)
      const totalTradePnl = pnlEvents.reduce((s, e) => s + e.pnl, 0);

      // Build curve: start from effectiveStartingBalance, add trade PnL day by day
      let running = effectiveStartingBalance;
      pnlEvents.forEach(e => { if (e.dateStr < thirtyDaysAgoStr) running += e.pnl; });

      const dailyTradePnl = {}; // trade PnL per day for tooltip
      const dailyEquity = {};
      dayKeys.forEach(dk => {
        dailyEquity[dk] = { date: dk, equity: running, tradePnl: 0, day: dk.split('-')[2] };
        dailyTradePnl[dk] = 0;
      });

      pnlEvents.forEach(e => {
        if (e.dateStr >= thirtyDaysAgoStr && e.dateStr <= todayStr) {
          running += e.pnl;
          dailyTradePnl[e.dateStr] = (dailyTradePnl[e.dateStr] || 0) + e.pnl;
          Object.keys(dailyEquity).forEach(k => {
            if (k >= e.dateStr) {
              dailyEquity[k].equity = running;
              dailyEquity[k].runningPnl = (dailyEquity[k].runningPnl || 0);
            }
          });
        }
      });

      // Calculate running PnL per day for tooltip
      let cumPnl = 0;
      dayKeys.forEach(dk => {
        cumPnl += (dailyTradePnl[dk] || 0);
        dailyEquity[dk].cumulativeTradePnl = cumPnl;
      });

      // Withdrawal/deposit detection — compares trade-projected balance vs exchange balance
      // Only triggers if: 1) startingBalance was explicitly set (reliable baseline)
      //                   2) no open trades (open unrealized PnL won't distort comparison)
      //                   3) difference > 5% of starting balance (large enough to be a real transfer)
      let withdrawalInfo = null;
      const hasOpenTrades = (trades || []).some(t => !t.close_price);
      const hasReliableStartingBalance = startingBalance && startingBalance !== 100000;
      if (currentBalance && currentBalance > 0 && hasReliableStartingBalance && !hasOpenTrades) {
        const diff = currentBalance - (effectiveStartingBalance + totalTradePnl);
        const threshold = Math.max(100, effectiveStartingBalance * 0.05); // min $100 or 5%
        if (Math.abs(diff) > threshold) {
          withdrawalInfo = { amount: diff, date: todayStr, day: todayStr.split('-')[2] };
        }
      }

      return {
        data: dayKeys.map(k => dailyEquity[k]).filter(Boolean),
        withdrawalInfo,
        totalTradePnl,
      };
    } catch {
      return { data: [], withdrawalInfo: null, totalTradePnl: 0 };
    }
  }, [trades, userTimezone, effectiveStartingBalance, currentBalance]);

  const CustomTooltip = ({ active, payload }) => {
    try {
      if (!active || !payload || !payload.length) return null;
      const item = payload[0].payload;
      if (!item) return null;
      const value = item.equity || 0;
      // Show only trade PnL (cumulative), NOT including withdrawals
      const tradePnl = item.cumulativeTradePnl || 0;
      const isWithdrawalDay = withdrawalInfo && item.date === withdrawalInfo.date;
      return (
        <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3 shadow-xl min-w-[140px]">
          <p className="text-[#888] text-xs mb-1">{item.date || ''}</p>
          <p className="text-[#c0c0c0] text-sm font-bold">${fmt(value)}</p>
          <p className={`text-xs ${tradePnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {tradePnl >= 0 ? '+' : '-'}${fmt(tradePnl)} PnL
          </p>
          {isWithdrawalDay && (
            <p className={`text-[10px] mt-1 pt-1 border-t border-white/[0.06] ${withdrawalInfo.amount < 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {withdrawalInfo.amount < 0
                ? `↓ -$${fmt(withdrawalInfo.amount)} withdrawn`
                : `↑ +$${fmt(withdrawalInfo.amount)} deposited`}
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
            {withdrawalInfo && (
              <ReferenceLine
                x={withdrawalInfo.day}
                stroke={withdrawalInfo.amount < 0 ? '#f59e0b' : '#10b981'}
                strokeDasharray="4 2"
                strokeWidth={1.5}
              />
            )}
            <Area type="monotone" dataKey="equity" stroke="#10b981" strokeWidth={2} fill="url(#equityGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
