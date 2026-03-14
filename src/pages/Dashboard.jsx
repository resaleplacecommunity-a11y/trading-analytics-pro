import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useTradesQuery } from '../components/hooks/useTradesQuery';
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp, DollarSign, Target, Activity, Zap, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { calculateClosedMetrics } from '../components/analytics/analyticsCalculations';
import { getTodayInUserTz, getTodayClosedTrades, getTodayOpenedTrades, getTodayPnl } from '../components/utils/dateUtils';
import StatsCard from '../components/dashboard/StatsCard';
import EquityCurve from '../components/dashboard/EquityCurve';
import AIRecommendations from '../components/ai/AIRecommendations';
import TradingCalendar from '../components/analytics/TradingCalendar';
import RiskViolationBanner from '../components/RiskViolationBanner';
import AgentChatModal from '../components/AgentChatModal';
import { cn } from "@/lib/utils";

const useTranslation = () => {
  const [lang, setLang] = useState(localStorage.getItem('tradingpro_lang') || 'ru');
  useEffect(() => {
    const handleChange = () => setLang(localStorage.getItem('tradingpro_lang') || 'ru');
    window.addEventListener('languagechange', handleChange);
    return () => window.removeEventListener('languagechange', handleChange);
  }, []);
  return { lang, t: (key) => {
    const tr = {
      ru: {
        dashboard: 'Дашборд', balance: 'Баланс', totalPnl: 'Общий PNL',
        openTrades: 'Открытые позиции', activeExposure: 'Активная экспозиция',
        equityCurve: 'Эквити', dailyPnl: 'PNL за 7 дней', riskStatus: 'Статус рисков',
        systemStatus: 'Статус систем', dailyGoal: 'Цель на день', weeklyGoal: 'Цель на неделю',
        monthlyGoal: 'Цель на месяц'
      },
      en: {
        dashboard: 'Dashboard', balance: 'Balance', totalPnl: 'Total PNL',
        openTrades: 'Open Trades', activeExposure: 'Active Exposure',
        equityCurve: 'Equity Curve', dailyPnl: 'Daily PNL (7d)', riskStatus: 'Risk Status',
        systemStatus: 'System Status', dailyGoal: 'Daily Goal', weeklyGoal: 'Weekly Goal',
        monthlyGoal: 'Monthly Goal'
      }
    };
    return tr[lang]?.[key] || key;
  }};
};

export default function Dashboard() {
  const [showAgentChat, setShowAgentChat] = useState(false);
  const { t, lang } = useTranslation();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 30 * 60 * 1000,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['userProfiles', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.UserProfile.filter({ created_by: user.email }, '-created_date', 10);
    },
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000,
  });

  const activeProfile = profiles.find(p => p.is_active);
  const { data: trades = [], refetch: refetchTrades } = useTradesQuery(activeProfile?.id);

  const { data: riskSettings } = useQuery({
    queryKey: ['riskSettings', user?.email, activeProfile?.id],
    queryFn: async () => {
      if (!user?.email || !activeProfile?.id) return null;
      const settings = await base44.entities.RiskSettings.filter({ 
        created_by: user.email,
        profile_id: activeProfile.id 
      }, '-created_date', 1);
      return settings[0] || null;
    },
    enabled: !!user?.email && !!activeProfile?.id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: activeConnection = null } = useQuery({
    queryKey: ['activeExchangeConn', activeProfile?.id],
    queryFn: async () => {
      if (!activeProfile?.id) return null;
      const res = await base44.functions.invoke('exchangeConnectionsApi', { profile_id: activeProfile.id });
      const list = res?.data?.connections || [];
      return list.find(c => c.is_active) || null;
    },
    enabled: !!activeProfile?.id,
    staleTime: 30_000,
  });

  const { data: behaviorLogs = [] } = useQuery({
    queryKey: ['behaviorLogs', user?.email, activeProfile?.id],
    queryFn: async () => {
      if (!user?.email || !activeProfile?.id) return [];
      return base44.entities.BehaviorLog.filter({ 
        created_by: user.email,
        profile_id: activeProfile.id 
      }, '-date', 20);
    },
    enabled: !!user?.email && !!activeProfile?.id,
    staleTime: 5 * 60 * 1000,
  });

  const startingBalance = activeProfile?.starting_balance || 0;
  const userTimezone = user?.preferred_timezone || 'UTC';
  
  const closedTrades = trades.filter(t => t.close_price);
  const openTrades = trades.filter(t => !t.close_price);
  
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

  const recentTrades = [...trades].filter(t => t.close_price).sort((a, b) => 
    new Date(b.date_close || b.date) - new Date(a.date_close || a.date)
  ).slice(0, 10);
  const consecutiveLosses = recentTrades.findIndex(t => (t.pnl_usd || 0) >= 0);
  const lossStreak = consecutiveLosses === -1 ? Math.min(recentTrades.length, riskSettings?.max_consecutive_losses || 3) : consecutiveLosses;

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
  
  const computedBalance = startingBalance + closedMetrics.netPnlUsd + openRealizedPnlUsd;
  const currentBalance = activeConnection?.current_balance ?? (startingBalance > 0 ? computedBalance : 0);
  const currentEquity = currentBalance + openTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
  const activeExposure = openTrades.reduce((s, t) => s + (t.position_size || 0), 0);
  
  const formatNumber = (num) => {
    if (num === undefined || num === null || num === '') return '—';
    const n = parseFloat(num);
    if (isNaN(n)) return '—';
    return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
  };

  // Daily PNL last 7 days
  const last7DaysPnl = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().slice(0, 10);
    const dayTrades = closedTrades.filter(t => {
      const closeDate = (t.date_close || t.date || '').slice(0, 10);
      return closeDate === dayStr;
    });
    const pnl = dayTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
    last7DaysPnl.push({ day: d.toLocaleDateString('en', { weekday: 'short' }), pnl });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#c0c0c0]">{t('dashboard')}</h1>
          <p className="text-[#666] text-sm">Real-time overview</p>
        </div>
        <Button onClick={() => setShowAgentChat(true)} className="bg-[#c0c0c0] text-black hover:bg-[#a0a0a0]">
          <Plus className="w-4 h-4 mr-2" />
          AI Ассистент
        </Button>
      </div>

      <RiskViolationBanner violations={violations} />

      {/* Balance + Total PNL */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-medium text-[#888]">{t('balance')}</h3>
            </div>
          </div>
          <div className="text-3xl font-bold text-[#c0c0c0] mb-1">${formatNumber(currentBalance)}</div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#666]">Equity:</span>
            <span className="text-cyan-400 font-medium">${formatNumber(currentEquity)}</span>
          </div>
          {activeConnection?.current_balance != null && (
            <div className="mt-2 text-[10px] text-cyan-400/80 flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              {lang === 'ru' ? 'С биржи (live)' : 'From exchange (live)'}
            </div>
          )}
        </div>

        <StatsCard 
          title={t('totalPnl')}
          value={closedMetrics.netPnlUsd >= 0 ? `+$${formatNumber(closedMetrics.netPnlUsd)}` : `-$${formatNumber(Math.abs(closedMetrics.netPnlUsd))}`}
          subtitle={`${(closedMetrics.netPnlPercent || 0) >= 0 ? '+' : ''}${(closedMetrics.netPnlPercent || 0).toFixed(1)}%`}
          icon={TrendingUp}
          className={closedMetrics.netPnlUsd < 0 ? "border-red-500/30" : ""}
        />
      </div>

      {/* Open Trades / Active Exposure */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatsCard 
          title={t('openTrades')}
          value={openTrades.length}
          subtitle={openTrades.length > 0 ? `Total unrealized: ${openTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0) >= 0 ? '+' : ''}$${formatNumber(Math.abs(openTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0)))}` : 'No open positions'}
          icon={Activity}
          valueColor={openTrades.length > 0 ? "text-cyan-400" : "text-[#666]"}
        />
        <StatsCard 
          title={t('activeExposure')}
          value={`$${formatNumber(activeExposure)}`}
          subtitle={currentBalance > 0 ? `${((activeExposure / currentBalance) * 100).toFixed(1)}% of balance` : '—'}
          icon={Target}
          valueColor="text-amber-400"
        />
      </div>

      {/* Equity Curve (краткий обзор) */}
      <EquityCurve trades={trades} userTimezone={userTimezone} startingBalance={startingBalance} compact />

      {/* Daily PNL Last 7 Days */}
      <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl p-5">
        <h3 className="text-sm font-medium text-[#888] mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-violet-400" />
          {t('dailyPnl')}
        </h3>
        <div className="flex items-end justify-between gap-2 h-24">
          {last7DaysPnl.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="flex-1 w-full flex items-end">
                <div 
                  className={cn("w-full rounded-t transition-all", d.pnl >= 0 ? "bg-emerald-500/30" : "bg-red-500/30")}
                  style={{ height: `${Math.min(100, Math.abs(d.pnl) / 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-[#666]">{d.day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Status */}
      <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl p-5">
        <h3 className="text-sm font-medium text-[#888] mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          {t('riskStatus')}
        </h3>
        {violations.length === 0 ? (
          <div className="flex items-center gap-2 text-emerald-400 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            {lang === 'ru' ? 'Все риски в норме' : 'All risks within limits'}
          </div>
        ) : (
          <div className="space-y-2">
            {violations.map((v, i) => (
              <div key={i} className="flex items-center justify-between text-sm p-2 bg-red-500/10 border border-red-500/30 rounded">
                <span className="text-[#c0c0c0]">{v.rule}</span>
                <span className="text-red-400">{v.value} / {v.limit}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Recommendations */}
      <AIRecommendations trades={trades} behaviorLogs={behaviorLogs} />

      {/* Trading Calendar */}
      <TradingCalendar trades={trades} userTimezone={userTimezone} compact />

      {/* System Status */}
      <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl p-5">
        <h3 className="text-sm font-medium text-[#888] mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-cyan-400" />
          {t('systemStatus')}
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#888]">Exchange Connection</span>
            {activeConnection ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">{activeConnection.name}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-[#666]" />
                <span className="text-[#666]">Not connected</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#888]">Sync Status</span>
            {activeConnection?.last_status === 'ok' ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">Synced</span>
              </div>
            ) : activeConnection?.last_status === 'syncing' ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-cyan-400">Syncing...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-[#666]" />
                <span className="text-[#666]">—</span>
              </div>
            )}
          </div>
        </div>
      </div>

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