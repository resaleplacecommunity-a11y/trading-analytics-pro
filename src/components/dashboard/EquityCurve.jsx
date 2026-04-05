import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { subDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { parseTradeDateToUserTz, getTodayInUserTz } from '../utils/dateUtils';

/**
 * EquityCurve — строго от закрытых сделок
 * 
 * Логика:
 * - Кривая = startingBalance + накопленный PnL закрытых сделок
 * - Последняя точка (сегодня) = currentBalance с биржи
 * - Если есть разрыв между расчётным и реальным → вывод/пополнение (в tooltip)
 * - Unrealized PnL НЕ включается
 */
export default function EquityCurve({ trades, userTimezone = 'UTC', startingBalance = 100000, currentBalance }) {

  const fmt = (n) => {
    try { return Math.round(Math.abs(n || 0)).toLocaleString('ru-RU').replace(/,/g, ' '); }
    catch { return '0'; }
  };

  const { data, transfer, effStart } = useMemo(() => {
    try {
      const todayStr = getTodayInUserTz(userTimezone);
      const now = new Date();

      // 30 дней
      const dayKeys = [];
      for (let i = 29; i >= 0; i--) {
        dayKeys.push(formatInTimeZone(subDays(now, i), userTimezone, 'yyyy-MM-dd'));
      }
      const windowStart = dayKeys[0];

      // Только закрытые сделки
      const closed = (trades || []).filter(t => t.close_price);

      // Стартовый баланс: prop → самая ранняя закрытая → currentBalance
      let effStart = 100000;
      if (startingBalance && startingBalance !== 100000) {
        effStart = Number(startingBalance);
      } else {
        const sorted = [...closed]
          .filter(t => parseFloat(t.account_balance_at_entry || 0) > 0)
          .sort((a, b) => new Date(a.date_open || a.date || 0) - new Date(b.date_open || b.date || 0));
        effStart = sorted.length > 0
          ? parseFloat(sorted[0].account_balance_at_entry)
          : (Number(currentBalance) || 100000);
      }

      // PnL события по дням
      const pnlByDay = {};
      closed.forEach(t => {
        const ds = parseTradeDateToUserTz(t.date_close || t.date_open || t.date, userTimezone);
        if (!ds) return;
        pnlByDay[ds] = (pnlByDay[ds] || 0) + (parseFloat(t.pnl_usd || 0) || 0);
      });

      // Накопленный PnL до начала окна
      let preWindowPnl = 0;
      Object.entries(pnlByDay).forEach(([ds, pnl]) => {
        if (ds < windowStart) preWindowPnl += pnl;
      });

      // Строим кривую вперёд
      let running = effStart + preWindowPnl;
      let cumPnl = preWindowPnl; // PnL накопленный с начала вообще
      const rows = [];

      dayKeys.forEach((dk, idx) => {
        const dayPnl = pnlByDay[dk] || 0;
        running += dayPnl;
        cumPnl += dayPnl;

        // Последняя точка = currentBalance (если есть)
        const isToday = dk === todayStr;
        const equity = isToday && currentBalance > 0 ? Number(currentBalance) : running;

        rows.push({ date: dk, day: dk.split('-')[2], equity, cumPnl });
      });

      // Вывод/пополнение: разница между расчётным и реальным балансом сегодня
      let transfer = null;
      if (currentBalance > 0 && effStart !== 100000) {
        const totalClosedPnl = Object.values(pnlByDay).reduce((s, v) => s + v, 0);
        const projected = effStart + totalClosedPnl;
        const diff = currentBalance - projected;
        const threshold = Math.max(50, effStart * 0.02);
        if (Math.abs(diff) > threshold) {
          transfer = { amount: diff };
        }
      }

      return { data: rows, transfer, effStart };
    } catch (e) {
      console.error('EquityCurve error:', e);
      return { data: [], transfer: null, effStart: startingBalance || 100000 };
    }
  }, [trades, userTimezone, startingBalance, currentBalance]);

  const CustomTooltip = ({ active, payload }) => {
    try {
      if (!active || !payload?.length) return null;
      const { date, equity, cumPnl } = payload[0].payload || {};
      const isToday = date === getTodayInUserTz(userTimezone);
      return (
        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-3 shadow-2xl min-w-[150px]">
          <p className="text-[#555] text-[10px] mb-2">{date}</p>
          <p className="text-[#c0c0c0] text-sm font-bold">${fmt(equity)}</p>
          <p className={`text-xs mt-0.5 ${(cumPnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {(cumPnl || 0) >= 0 ? '+' : '-'}${fmt(cumPnl)} PnL
          </p>
          {isToday && transfer && (
            <p className={`text-[10px] mt-2 pt-2 border-t border-white/[0.06] ${transfer.amount < 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {transfer.amount < 0 ? `↓ Вывод ~$${fmt(transfer.amount)}` : `↑ Пополнение ~$${fmt(transfer.amount)}`}
            </p>
          )}
        </div>
      );
    } catch { return null; }
  };

  const monthName = (() => { try { return formatInTimeZone(new Date(), userTimezone, 'MMM yyyy'); } catch { return ''; } })();

  return (
    <div className="bg-white/[0.03] backdrop-blur-xl rounded-xl p-5 border border-white/[0.07] shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[#c0c0c0] text-sm font-medium">Equity Curve</h3>
          <p className="text-[#555] text-[10px]">Start: ${fmt(effStart)}</p>
        </div>
        <span className="text-[#555] text-xs">{monthName}</span>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#444', fontSize: 10 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#444', fontSize: 10 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} width={45} />
            <Tooltip content={<CustomTooltip />} />
            {transfer && (() => {
              const todayDay = getTodayInUserTz(userTimezone).split('-')[2];
              return (
                <ReferenceLine
                  x={todayDay}
                  stroke={transfer.amount < 0 ? '#f59e0b' : '#10b981'}
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  label={{
                    value: transfer.amount < 0 ? `↓ -$${fmt(transfer.amount)}` : `↑ +$${fmt(transfer.amount)}`,
                    fill: transfer.amount < 0 ? '#f59e0b' : '#10b981',
                    fontSize: 9,
                    position: 'insideTopRight',
                    dy: -4,
                  }}
                />
              );
            })()}
            <Area type="monotone" dataKey="equity" stroke="#10b981" strokeWidth={2} fill="url(#eqGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
