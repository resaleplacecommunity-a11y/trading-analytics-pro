import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useTradesQuery } from '../components/hooks/useTradesQuery';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Percent, Target, DollarSign, BarChart3, TrendingUp, TrendingDown, Award, Zap, ArrowRight, Clock } from 'lucide-react';
import { calculateClosedMetrics } from '../components/analytics/analyticsCalculations';
import { cn } from "@/lib/utils";

const useTranslation = () => {
  const [lang, setLang] = useState(localStorage.getItem('tradingpro_lang') || 'ru');
  useEffect(() => {
    const handleChange = () => setLang(localStorage.getItem('tradingpro_lang') || 'ru');
    window.addEventListener('languagechange', handleChange);
    return () => window.removeEventListener('languagechange', handleChange);
  }, []);
  return { lang };
};

function MetricCard({ title, value, sub, icon: Icon, color = 'text-[#c0c0c0]', accent, progress, trend }) {
  return (
    <div className="bg-white/[0.03] backdrop-blur-xl rounded-xl p-5 border border-white/[0.07] shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:border-white/[0.12] transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", accent || 'bg-white/[0.06]')}>
          <Icon className={cn("w-4 h-4", color)} />
        </div>
        {trend !== undefined && (
          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", trend >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10')}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-[#555] text-[10px] font-medium uppercase tracking-wider mb-1">{title}</p>
      <p className={cn("text-2xl font-bold leading-tight", color)}>{value}</p>
      {sub && <p className="text-[#555] text-xs mt-1">{sub}</p>}
      {progress !== undefined && (
        <div className="mt-3 h-1 bg-white/[0.05] rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", progress >= 50 ? 'bg-emerald-500' : 'bg-red-500')}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function Analytics() {
  const { lang } = useTranslation();
  const t = (ru, en) => lang === 'ru' ? ru : en;

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
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
  });

  const activeProfile = profiles.find(p => p.is_active);
  const startingBalance = activeProfile?.starting_balance || 100000;
  const { data: trades = [], isLoading } = useTradesQuery(activeProfile?.id);

  const closedTrades = useMemo(() => trades.filter(t => t.close_price), [trades]);
  const openTrades = useMemo(() => trades.filter(t => !t.close_price), [trades]);
  const metrics = useMemo(() => calculateClosedMetrics(closedTrades, startingBalance), [closedTrades, startingBalance]);

  const fmt = (n) => {
    if (n == null || isNaN(n)) return '—';
    return Math.round(Math.abs(n)).toLocaleString('ru-RU').replace(/,/g, ' ');
  };

  const wins = closedTrades.filter(t => (t.pnl_usd || 0) > 0).length;
  const losses = closedTrades.filter(t => (t.pnl_usd || 0) < 0).length;
  const avgWin = wins > 0 ? closedTrades.filter(t => (t.pnl_usd || 0) > 0).reduce((s, t) => s + (t.pnl_usd || 0), 0) / wins : 0;
  const avgLoss = losses > 0 ? Math.abs(closedTrades.filter(t => (t.pnl_usd || 0) < 0).reduce((s, t) => s + (t.pnl_usd || 0), 0) / losses) : 0;
  const profitFactor = avgLoss > 0 ? (avgWin * wins) / (avgLoss * losses) : 0;

  const avgDuration = closedTrades.length > 0
    ? closedTrades.reduce((s, t) => s + (t.actual_duration_minutes || 0), 0) / closedTrades.length
    : 0;
  const durationStr = avgDuration > 60
    ? `${Math.round(avgDuration / 60)}h`
    : `${Math.round(avgDuration)}m`;

  const pnlSign = metrics.netPnlUsd >= 0 ? '+' : '-';

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#c0c0c0]">{t('Статистика', 'Statistics')}</h1>
          <p className="text-[#555] text-xs mt-0.5">{t('Сводные показатели торговли', 'Trading performance summary')}</p>
        </div>
        <Link
          to={createPageUrl('AnalyticsHub')}
          className="flex items-center gap-1.5 text-xs text-[#555] hover:text-emerald-400 transition-colors border border-[#2a2a2a] hover:border-emerald-500/30 rounded-lg px-3 py-1.5"
        >
          {t('Полная аналитика', 'Full analytics')}
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* PnL hero */}
      <div className="bg-white/[0.03] backdrop-blur-xl rounded-2xl p-6 border border-white/[0.07] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[#555] text-xs font-medium uppercase tracking-wider mb-2">{t('Общий PnL', 'Total PnL')}</p>
            <p className={cn("text-4xl font-bold", metrics.netPnlUsd >= 0 ? 'text-emerald-400' : 'text-red-400')}>
              {pnlSign}${fmt(metrics.netPnlUsd)}
            </p>
            <p className="text-[#555] text-xs mt-1.5">
              {closedTrades.length} {t('закрытых сделок', 'closed trades')} · {openTrades.length} {t('открытых', 'open')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[#555] text-xs mb-1">{t('Профит-фактор', 'Profit factor')}</p>
            <p className={cn("text-2xl font-bold", profitFactor >= 1.5 ? 'text-emerald-400' : profitFactor >= 1 ? 'text-amber-400' : 'text-red-400')}>
              {profitFactor > 0 ? profitFactor.toFixed(2) : '—'}
            </p>
          </div>
        </div>

        {/* Win/Loss bar */}
        {closedTrades.length > 0 && (
          <div className="mt-5">
            <div className="flex justify-between text-[10px] text-[#555] mb-1.5">
              <span>{t(`${wins} побед`, `${wins} wins`)}</span>
              <span>{t(`${losses} потерь`, `${losses} losses`)}</span>
            </div>
            <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden flex">
              <div className="h-full bg-emerald-500 rounded-l-full transition-all" style={{ width: `${metrics.winrate}%` }} />
              <div className="h-full bg-red-500/60 rounded-r-full transition-all" style={{ width: `${100 - metrics.winrate}%` }} />
            </div>
            <div className="flex justify-between text-[10px] mt-1">
              <span className="text-emerald-400 font-medium">{metrics.winrate.toFixed(1)}%</span>
              <span className="text-red-400/70">{(100 - metrics.winrate).toFixed(1)}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title={t('Средний R', 'Avg R')}
          value={metrics.avgR != null ? `${metrics.avgR.toFixed(2)}R` : '—'}
          icon={Target}
          color={metrics.avgR >= 1.5 ? 'text-emerald-400' : metrics.avgR >= 1 ? 'text-amber-400' : 'text-red-400'}
          accent={metrics.avgR >= 1.5 ? 'bg-emerald-500/10' : 'bg-white/[0.06]'}
          sub={t('Целевой: 1.5R+', 'Target: 1.5R+')}
          progress={metrics.avgR ? Math.min(100, (metrics.avgR / 3) * 100) : 0}
        />
        <MetricCard
          title={t('Средний Win', 'Avg Win')}
          value={avgWin > 0 ? `+$${fmt(avgWin)}` : '—'}
          icon={TrendingUp}
          color="text-emerald-400"
          accent="bg-emerald-500/10"
          sub={`${wins} ${t('сделок', 'trades')}`}
        />
        <MetricCard
          title={t('Средний Loss', 'Avg Loss')}
          value={avgLoss > 0 ? `-$${fmt(avgLoss)}` : '—'}
          icon={TrendingDown}
          color="text-red-400"
          accent="bg-red-500/10"
          sub={`${losses} ${t('сделок', 'trades')}`}
        />
        <MetricCard
          title={t('Ср. длительность', 'Avg Duration')}
          value={closedTrades.length > 0 ? durationStr : '—'}
          icon={Clock}
          color="text-[#c0c0c0]"
          sub={t('закрытых', 'closed')}
        />
      </div>

      {/* Best / Worst */}
      {closedTrades.length > 0 && (() => {
        const sorted = [...closedTrades].sort((a, b) => (b.pnl_usd || 0) - (a.pnl_usd || 0));
        const best = sorted[0];
        const worst = sorted[sorted.length - 1];
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-emerald-500/[0.05] backdrop-blur-xl rounded-xl p-4 border border-emerald-500/[0.15]">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] text-[#555] uppercase tracking-wider">{t('Лучшая сделка', 'Best trade')}</span>
              </div>
              <p className="text-emerald-400 text-xl font-bold">+${fmt(best.pnl_usd)}</p>
              <p className="text-[#555] text-xs mt-1">{best.coin} · {best.direction}</p>
            </div>
            <div className="bg-red-500/[0.05] backdrop-blur-xl rounded-xl p-4 border border-red-500/[0.15]">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-red-400" />
                <span className="text-[10px] text-[#555] uppercase tracking-wider">{t('Худшая сделка', 'Worst trade')}</span>
              </div>
              <p className="text-red-400 text-xl font-bold">-${fmt(Math.abs(worst.pnl_usd))}</p>
              <p className="text-[#555] text-xs mt-1">{worst.coin} · {worst.direction}</p>
            </div>
          </div>
        );
      })()}

      {/* Link to full analytics */}
      <Link
        to={createPageUrl('AnalyticsHub')}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-white/[0.07] text-[#555] hover:text-[#c0c0c0] hover:border-white/[0.12] hover:bg-white/[0.02] transition-all text-sm"
      >
        <Zap className="w-4 h-4" />
        {t('Открыть полную аналитику → AI инсайты, распределения, календарь', 'Open full analytics → AI insights, distributions, calendar')}
      </Link>
    </div>
  );
}
