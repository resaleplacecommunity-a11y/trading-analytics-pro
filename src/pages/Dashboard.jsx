import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useTradesQuery } from '../components/hooks/useTradesQuery';
import { Button } from '@/components/ui/button';
import { Plus, DollarSign, Activity, Zap, TrendingUp } from 'lucide-react';
import { calculateClosedMetrics } from '../components/analytics/analyticsCalculations';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import EquityCurve from '../components/dashboard/EquityCurve';
import AgentChatModal from '../components/AgentChatModal';
import RiskViolationBanner from '../components/RiskViolationBanner';
import { cn } from '@/lib/utils';
import {
  getTodayInUserTz,
  getTodayClosedTrades,
  getTodayOpenedTrades,
  getTodayPnl,
} from '../components/utils/dateUtils';

// ── Translation ──────────────────────────────────────────────
const useTranslation = () => {
  const [lang, setLang] = useState(localStorage.getItem('tradingpro_lang') || 'ru');
  useEffect(() => {
    const handleChange = () => setLang(localStorage.getItem('tradingpro_lang') || 'ru');
    window.addEventListener('languagechange', handleChange);
    return () => window.removeEventListener('languagechange', handleChange);
  }, []);
  return {
    lang,
    t: (key) => {
      const tr = {
        ru: { dashboard: 'Дашборд', analyticsOverview: 'Обзор Торговли', newTrade: 'Новая Сделка' },
        en: { dashboard: 'Dashboard', analyticsOverview: 'Trading Overview', newTrade: 'New Trade' },
      };
      return tr[lang]?.[key] || key;
    },
  };
};

// ── Helpers ───────────────────────────────────────────────────
const fmt = (num) => {
  if (num === undefined || num === null || num === '') return '—';
  const n = parseFloat(num);
  if (isNaN(n)) return '—';
  return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
};

const formatRelative = (dateStr) => {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

// ── Tiny Card Wrapper ─────────────────────────────────────────
const Card = ({ className, children }) => (
  <div
    className={cn(
      'bg-white/[0.03] backdrop-blur-xl rounded-xl border border-white/[0.07] shadow-[0_8px_32px_rgba(0,0,0,0.35)]',
      className
    )}
  >
    {children}
  </div>
);

const Label = ({ children }) => (
  <p className="text-xs text-[#555] uppercase tracking-wider font-medium">{children}</p>
);

// ── Goal Progress Bar ─────────────────────────────────────────
const GoalBar = ({ label, progress, goal }) => {
  const pct = goal > 0 ? Math.min(100, (progress / goal) * 100) : 0;
  const color =
    pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-[#666] uppercase tracking-wider">{label}</span>
        <span className="text-xs text-[#888]">
          ${fmt(progress)} / ${fmt(goal)}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

// ── Risk Item Row ─────────────────────────────────────────────
const RiskRow = ({ label, value, current, limit, status }) => {
  const dot =
    status === 'danger'
      ? 'bg-red-500'
      : status === 'warning'
      ? 'bg-amber-400'
      : 'bg-emerald-500';
  const barColor =
    status === 'danger'
      ? 'bg-red-500'
      : status === 'warning'
      ? 'bg-amber-400'
      : 'bg-emerald-500';
  const pct = limit > 0 ? Math.min(100, (current / limit) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className={cn('w-2 h-2 rounded-full shrink-0', dot)} />
      <span className="text-xs text-[#888] w-24 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-[#666] w-20 text-right shrink-0">
        {value} / {limit}
      </span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [showAgentChat, setShowAgentChat] = useState(false);
  const { t } = useTranslation();
  const now = new Date();

  // ── Data fetching ──────────────────────────────────────────
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    cacheTime: 0,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['userProfiles', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.UserProfile.filter({ created_by: user.email }, '-created_date', 10);
    },
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    cacheTime: 0,
  });

  const activeProfile = profiles.find((p) => p.is_active);

  const { data: trades = [], refetch: refetchTrades } = useTradesQuery(activeProfile?.id);

  const { data: riskSettings } = useQuery({
    queryKey: ['riskSettings', user?.email, activeProfile?.id],
    queryFn: async () => {
      if (!user?.email || !activeProfile?.id) return null;
      const settings = await base44.entities.RiskSettings.filter(
        { created_by: user.email, profile_id: activeProfile.id },
        '-created_date',
        1
      );
      return settings[0] || null;
    },
    enabled: !!user?.email && !!activeProfile?.id,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    cacheTime: 0,
  });

  const { data: activeConnection = null, isLoading: isConnectionLoading } = useQuery({
    queryKey: ['activeExchangeConn', activeProfile?.id],
    queryFn: async () => {
      if (!activeProfile?.id) return null;
      const res = await base44.functions.invoke('exchangeConnectionsApi', {
        method: 'GET',
        path: '/connections',
        profile_id: activeProfile.id,
      });
      const list = res?.data?.connections || [];
      return list.find((c) => c.is_active) || null;
    },
    enabled: !!activeProfile?.id,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // ── Security check ─────────────────────────────────────────
  useEffect(() => {
    if (activeProfile && user?.email && activeProfile.created_by !== user.email) {
      console.error('SECURITY WARNING: Active profile does not belong to current user!');
    }
  }, [activeProfile, user]);

  // ── Calculations ───────────────────────────────────────────
  const startingBalance = activeProfile?.starting_balance || 100000;
  const userTimezone = user?.preferred_timezone || 'UTC';

  const closedTrades = trades.filter((t) => t.close_price);
  const openTrades = trades.filter((t) => !t.close_price);

  const closedMetrics = calculateClosedMetrics(closedTrades, startingBalance);
  const openRealizedPnlUsd = openTrades.reduce((s, t) => s + (t.realized_pnl_usd || 0), 0);

  const todayClosedTrades = getTodayClosedTrades(trades, userTimezone);
  const todayPnl = getTodayPnl(trades, userTimezone);
  const todayOpenedTrades = getTodayOpenedTrades(trades, userTimezone);

  const todayPnlPercent = todayClosedTrades.reduce((s, t) => {
    const pnl = t.pnl_usd || 0;
    if (pnl < 0) {
      const balance = t.account_balance_at_entry || startingBalance;
      return s + ((pnl / balance) * 100);
    }
    return s;
  }, 0);

  const todayR = todayClosedTrades.reduce((s, t) => s + (t.r_multiple || 0), 0);

  // Balance
  const computedBalance = startingBalance + closedMetrics.netPnlUsd + openRealizedPnlUsd;
  const currentBalance = activeConnection?.current_balance ?? computedBalance;
  const unrealizedPnl = openTrades.reduce((s, t) => s + (parseFloat(t.pnl_usd) || 0), 0);
  const equity = currentBalance + unrealizedPnl;

  // Open trades exposure
  const totalExposure = openTrades.reduce((s, t) => s + (t.position_size || 0), 0);
  const longCount = openTrades.filter((t) => t.direction === 'Long').length;
  const shortCount = openTrades.filter((t) => t.direction === 'Short').length;

  // Open risk %
  const totalOpenRiskPercent =
    currentBalance > 0 ? (Math.abs(unrealizedPnl) / currentBalance) * 100 : 0;

  // ── Streak ─────────────────────────────────────────────────
  const closedSorted = [...closedTrades].sort(
    (a, b) =>
      new Date(b.date_close || b.date) - new Date(a.date_close || a.date)
  );
  let streak = 0;
  let streakType = null;
  for (const t of closedSorted) {
    const win = (t.pnl_usd || 0) > 0;
    if (streakType === null) {
      streakType = win ? 'win' : 'loss';
      streak = 1;
    } else if ((win && streakType === 'win') || (!win && streakType === 'loss')) {
      streak++;
    } else {
      break;
    }
  }

  // Best streak this month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthTrades = closedSorted.filter(
    (t) => new Date(t.date_close || t.date) >= monthStart
  );
  let bestStreakMonth = 0;
  let curBest = 0;
  let prevWin = null;
  for (const t of [...monthTrades].reverse()) {
    const win = (t.pnl_usd || 0) > 0;
    if (prevWin === null || win === prevWin) {
      curBest++;
    } else {
      curBest = 1;
    }
    prevWin = win;
    if (win && curBest > bestStreakMonth) bestStreakMonth = curBest;
  }

  // ── Daily PnL last 7 days ──────────────────────────────────
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  const dailyPnlData = last7Days.map((date) => {
    const dayTrades = closedTrades.filter(
      (t) => (t.date_close || t.date || '').slice(0, 10) === date
    );
    const pnl = dayTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
    return { date: date.slice(5), pnl, color: pnl >= 0 ? '#10b981' : '#ef4444' };
  });

  // ── Goals ──────────────────────────────────────────────────
  const dailyGoal = activeProfile?.daily_goal_usd || riskSettings?.daily_goal_usd || 500;
  const weeklyGoal = activeProfile?.weekly_goal_usd || riskSettings?.weekly_goal_usd || 2500;
  const monthlyGoal = activeProfile?.monthly_goal_usd || riskSettings?.monthly_goal_usd || 10000;

  const dailyProgress = todayClosedTrades.reduce(
    (s, t) => s + Math.max(0, t.pnl_usd || 0),
    0
  );
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weeklyProgress = closedTrades
    .filter((t) => new Date(t.date_close || t.date) >= weekStart)
    .reduce((s, t) => s + Math.max(0, t.pnl_usd || 0), 0);
  const monthlyProgress = closedTrades
    .filter((t) => new Date(t.date_close || t.date) >= monthStart)
    .reduce((s, t) => s + Math.max(0, t.pnl_usd || 0), 0);

  // ── Calendar ───────────────────────────────────────────────
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayTrades = closedTrades.filter(
      (t) => (t.date_close || t.date || '').slice(0, 10) === dateStr
    );
    const pnl = dayTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
    const dotColor =
      dayTrades.length === 0
        ? null
        : pnl > 0
        ? 'bg-emerald-500'
        : pnl < 0
        ? 'bg-red-500'
        : 'bg-amber-400';
    return { day: d, dotColor, isToday: d === now.getDate() };
  });
  const monthName = now.toLocaleString('en', { month: 'long', year: 'numeric' });

  // ── Risk items ─────────────────────────────────────────────
  const riskItems = [
    {
      label: 'Daily Loss',
      value: `${Math.abs(todayPnlPercent).toFixed(1)}%`,
      limit: riskSettings?.daily_max_loss_percent || 5,
      current: Math.abs(todayPnlPercent),
      status:
        Math.abs(todayPnlPercent) > (riskSettings?.daily_max_loss_percent || 5)
          ? 'danger'
          : Math.abs(todayPnlPercent) > (riskSettings?.daily_max_loss_percent || 5) * 0.7
          ? 'warning'
          : 'ok',
    },
    {
      label: 'Open Risk',
      value: `${totalOpenRiskPercent.toFixed(1)}%`,
      limit: riskSettings?.max_risk_per_trade_percent || 2,
      current: totalOpenRiskPercent,
      status:
        totalOpenRiskPercent > 10
          ? 'danger'
          : totalOpenRiskPercent > 5
          ? 'warning'
          : 'ok',
    },
    {
      label: 'Trades Today',
      value: todayClosedTrades.length,
      limit: riskSettings?.max_trades_per_day || 5,
      current: todayClosedTrades.length,
      status:
        todayClosedTrades.length >= (riskSettings?.max_trades_per_day || 5)
          ? 'danger'
          : 'ok',
    },
  ];

  // ── Violations (for banner) ────────────────────────────────
  const recentClosed = [...closedTrades]
    .sort((a, b) => new Date(b.date_close || b.date) - new Date(a.date_close || a.date))
    .slice(0, 10);
  const consecutiveLosses = recentClosed.findIndex((t) => (t.pnl_usd || 0) >= 0);
  const lossStreak =
    consecutiveLosses === -1
      ? Math.min(recentClosed.length, riskSettings?.max_consecutive_losses || 3)
      : consecutiveLosses;

  const violations = [];
  if (riskSettings) {
    if (riskSettings.daily_max_loss_percent && todayPnlPercent < -riskSettings.daily_max_loss_percent) {
      violations.push({ rule: 'Daily Loss Limit', value: `${todayPnlPercent.toFixed(2)}%`, limit: `${riskSettings.daily_max_loss_percent}%` });
    }
    if (riskSettings.daily_max_r && todayR < -riskSettings.daily_max_r) {
      violations.push({ rule: 'Daily R Loss', value: `${todayR.toFixed(2)}R`, limit: `${riskSettings.daily_max_r}R` });
    }
    if (riskSettings.max_trades_per_day && todayOpenedTrades.length >= riskSettings.max_trades_per_day) {
      violations.push({ rule: 'Max Trades', value: `${todayOpenedTrades.length}`, limit: `${riskSettings.max_trades_per_day}` });
    }
    if (lossStreak >= (riskSettings.max_consecutive_losses || 3)) {
      violations.push({ rule: 'Loss Streak', value: `${lossStreak} losses`, limit: `${riskSettings.max_consecutive_losses}` });
    }
  }

  // ── AI placeholder recs ────────────────────────────────────
  const placeholderRecs = [
    { icon: '🎯', text: 'Connect exchange to get personalized insights', type: 'info' },
    { icon: '📊', text: 'Add more trades to unlock pattern analysis', type: 'info' },
    { icon: '⚡', text: 'AI recommendations will appear here after sync', type: 'info' },
  ];

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#c0c0c0]">{t('dashboard')}</h1>
          <p className="text-[#666] text-sm">{t('analyticsOverview')}</p>
        </div>
        <Button
          onClick={() => setShowAgentChat(true)}
          className="bg-[#c0c0c0] text-black hover:bg-[#a0a0a0]"
        >
          <Plus className="w-4 h-4 mr-2" />
          AI Ассистент
        </Button>
      </div>

      <RiskViolationBanner violations={violations} />

      {/* ══════════════════════════════════════════════════════
          ROW 1 — Balance · Total PnL · Open Trades · Streak
      ══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* 1. BALANCE */}
        <Card className={cn('p-5', currentBalance < 0 ? 'border-red-500/40' : '')}>
          <div className="flex items-center justify-between mb-2">
            {activeConnection ? (
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                Balance · {activeConnection.exchange?.toUpperCase() || 'Exchange'} Live
              </span>
            ) : (
              <Label>Balance</Label>
            )}
            <DollarSign className="w-4 h-4 text-[#333]" />
          </div>
          {isConnectionLoading ? (
            <div className="flex items-center gap-2 mt-1">
              <div className="h-7 w-28 rounded-md bg-white/[0.06] animate-pulse" />
            </div>
          ) : (
            <div className={cn('text-2xl font-bold', currentBalance < 0 ? 'text-red-400' : 'text-[#c0c0c0]')}>
              ${fmt(activeConnection?.current_balance ?? 0)}
            </div>
          )}
          <div className="text-xs text-[#555] mt-1">
            Equity: {isConnectionLoading ? <span className="inline-block w-16 h-3 rounded bg-white/[0.05] animate-pulse align-middle" /> : <span className="text-[#888]">${fmt(equity)}</span>}
          </div>
        </Card>

        {/* 2. TOTAL PNL */}
        <Card className={cn('p-5', closedMetrics.netPnlUsd < 0 ? 'border-red-500/20' : '')}>
          <div className="flex items-center justify-between mb-2">
            <Label>Total PnL</Label>
            <TrendingUp className="w-4 h-4 text-[#333]" />
          </div>
          <div className="flex items-end justify-between">
            <div>
              <div className={cn('text-2xl font-bold', closedMetrics.netPnlUsd >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {closedMetrics.netPnlUsd >= 0 ? '+' : '-'}${fmt(Math.abs(closedMetrics.netPnlUsd))}
              </div>
              <div className={cn('text-sm mt-1', (closedMetrics.netPnlPercent || 0) >= 0 ? 'text-emerald-500/70' : 'text-red-500/70')}>
                {(closedMetrics.netPnlPercent || 0) >= 0 ? '+' : ''}{(closedMetrics.netPnlPercent || 0).toFixed(1)}%
              </div>
            </div>
            {isConnectionLoading ? (
              <div className="text-right">
                <div className="h-2.5 w-8 rounded bg-white/[0.05] animate-pulse mb-2 ml-auto" />
                <div className="h-6 w-20 rounded bg-white/[0.06] animate-pulse" />
              </div>
            ) : unrealizedPnl !== 0 && (
              <div className="text-right">
                <div className="text-[10px] text-[#555] uppercase tracking-wider mb-0.5">uPnL</div>
                <div className={cn('text-xl font-bold', unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {unrealizedPnl >= 0 ? '+' : '-'}${fmt(Math.abs(unrealizedPnl))}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* 3. OPEN TRADES / ACTIVE EXPOSURE */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <Label>Open Trades</Label>
            <Activity className="w-4 h-4 text-[#333]" />
          </div>
          <div className="text-2xl font-bold text-[#c0c0c0]">{openTrades.length}</div>
          <div className="text-xs text-[#555] mt-1">
            Exposure: {isConnectionLoading ? <span className="inline-block w-14 h-3 rounded bg-white/[0.05] animate-pulse align-middle" /> : <span className="text-[#888]">${fmt(totalExposure)}</span>}
          </div>
          <div className="text-xs text-[#555]">
            {isConnectionLoading ? (
              <span className="inline-block w-20 h-3 rounded bg-white/[0.05] animate-pulse align-middle" />
            ) : (
              <>
                {unrealizedPnl !== 0 && (
                  <span className={unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {unrealizedPnl >= 0 ? '+' : ''}${fmt(unrealizedPnl)} uPnL&nbsp;·&nbsp;
                  </span>
                )}
                <span className="text-[#888]">{longCount}L / {shortCount}S</span>
              </>
            )}
          </div>
        </Card>

        {/* 4. STREAK */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <Label>Streak</Label>
            <Zap className="w-4 h-4 text-[#333]" />
          </div>
          {streak > 0 ? (
            <>
              <div className={cn('text-2xl font-bold', streakType === 'win' ? 'text-emerald-400' : 'text-red-400')}>
                {streakType === 'win' ? '🔥' : '❄️'} {streak} {streakType === 'win' ? 'Win' : 'Loss'} Streak
              </div>
              <div className="text-xs text-[#555] mt-1">
                Best this month: <span className="text-[#888]">{bestStreakMonth} wins</span>
              </div>
            </>
          ) : (
            <div className="text-2xl font-bold text-[#555]">—</div>
          )}
        </Card>
      </div>

      {/* ══════════════════════════════════════════════════════
          ROW 2 — Equity Curve (2/3) | Daily PnL 7d (1/3)
      ══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <EquityCurve
            trades={trades}
            userTimezone={userTimezone}
            startingBalance={startingBalance}
            currentBalance={currentBalance}
          />
        </div>

        {/* Daily PnL Bar Chart */}
        <Card className="p-5 flex flex-col">
          <div className="mb-3">
            <Label>Daily PnL · 7 Days</Label>
          </div>
          <div className="flex-1" style={{ minHeight: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyPnlData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#555', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#555', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                />
                <Tooltip
                  contentStyle={{ background: '#111', border: '1px solid #222', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#888' }}
                  formatter={(v) => [`$${fmt(v)}`, 'PnL']}
                />
                <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                  {dailyPnlData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* ══════════════════════════════════════════════════════
          ROW 3 — Risk Status | AI Recommendations
      ══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Risk Status */}
        <Card className="p-5">
          <div className="mb-4">
            <Label>Risk Status</Label>
          </div>
          <div className="space-y-3">
            {riskItems.map((item) => (
              <RiskRow key={item.label} {...item} />
            ))}
          </div>
        </Card>

        {/* AI Recommendations */}
        <Card className="p-5 relative overflow-hidden">
          {/* IN DEVELOPMENT badge */}
          <div className="absolute top-3 right-3 text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded px-2 py-0.5 uppercase tracking-wider font-semibold">
            In Development
          </div>
          <div className="mb-4">
            <Label>AI Recommendations</Label>
          </div>
          <div className="space-y-2">
            {placeholderRecs.map((rec, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border-l-2 border-cyan-500/30"
              >
                <span className="text-lg leading-none">{rec.icon}</span>
                <span className="text-sm text-[#888]">{rec.text}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ══════════════════════════════════════════════════════
          ROW 4 — Trading Calendar | Goals
      ══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Trading Calendar */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <Label>Trading Calendar</Label>
            <span className="text-xs text-[#666]">{monthName}</span>
          </div>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <div key={d} className="text-center text-[10px] text-[#444]">
                {d}
              </div>
            ))}
          </div>
          {/* Offset empty cells */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`e-${i}`} />
            ))}
            {calendarDays.map(({ day, dotColor, isToday }) => (
              <div
                key={day}
                className={cn(
                  'flex flex-col items-center justify-center rounded-md py-1',
                  isToday ? 'bg-white/[0.06] ring-1 ring-white/10' : ''
                )}
              >
                <span
                  className={cn(
                    'text-xs',
                    isToday ? 'text-[#c0c0c0] font-bold' : 'text-[#555]'
                  )}
                >
                  {day}
                </span>
                {dotColor && (
                  <span className={cn('w-1.5 h-1.5 rounded-full mt-0.5', dotColor)} />
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Goals */}
        <Card className="p-5">
          <div className="mb-4">
            <Label>Goals</Label>
          </div>
          <div className="space-y-4">
            <GoalBar label="Daily" progress={dailyProgress} goal={dailyGoal} />
            <GoalBar label="Weekly" progress={weeklyProgress} goal={weeklyGoal} />
            <GoalBar label="Monthly" progress={monthlyProgress} goal={monthlyGoal} />
          </div>
        </Card>
      </div>

      {/* ══════════════════════════════════════════════════════
          ROW 5 — Bot / Exchange Status
      ══════════════════════════════════════════════════════ */}
      <Card className="p-5">
        <div className="mb-4">
          <Label>System Status</Label>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: 'Exchange',
              value: activeConnection
                ? `${activeConnection.exchange} ✓`
                : 'Not connected',
              ok: !!activeConnection,
            },
            {
              label: 'Last Sync',
              value: activeConnection?.last_sync_at
                ? formatRelative(activeConnection.last_sync_at)
                : '—',
              ok: !!activeConnection?.last_sync_at,
            },
            {
              label: 'Sync Status',
              value: activeConnection?.last_status || '—',
              ok: activeConnection?.last_status === 'ok',
            },
            {
              label: 'Relay',
              value: 'Connected',
              ok: true,
            },
          ].map(({ label, value, ok }) => (
            <div key={label} className="flex items-center gap-3">
              <span
                className={cn(
                  'w-2 h-2 rounded-full shrink-0',
                  ok ? 'bg-emerald-500' : 'bg-red-500'
                )}
              />
              <div>
                <div className="text-[10px] text-[#444] uppercase tracking-wider">{label}</div>
                <div className="text-sm text-[#888]">{value}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Agent Chat Modal */}
      {showAgentChat && (
        <AgentChatModal
          onClose={() => setShowAgentChat(false)}
          onTradeCreated={() => {
            refetchTrades();
            setShowAgentChat(false);
          }}
        />
      )}
    </div>
  );
}
