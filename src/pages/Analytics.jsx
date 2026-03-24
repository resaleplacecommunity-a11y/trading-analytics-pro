/**
 * Analytics.jsx
 * Stats overview page — stats cards moved here from Dashboard.
 * Full analytics remain in AnalyticsHub.jsx.
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useTradesQuery } from '../components/hooks/useTradesQuery';
import { Percent, Target, DollarSign, BarChart3 } from 'lucide-react';
import { calculateClosedMetrics } from '../components/analytics/analyticsCalculations';
import StatsCard from '../components/dashboard/StatsCard';

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
        ru: {
          winrate: 'Винрейт', avgR: 'Средний R', avgPnl: 'Средний PNL', tradesCount: 'Сделок',
          statsOverview: 'Статистика', statsDesc: 'Сводные показатели по всем сделкам',
        },
        en: {
          winrate: 'Winrate', avgR: 'Avg R', avgPnl: 'Avg PNL', tradesCount: 'Trades',
          statsOverview: 'Statistics', statsDesc: 'Summary metrics across all trades',
        },
      };
      return tr[lang]?.[key] || key;
    },
  };
};

export default function Analytics() {
  const { t } = useTranslation();

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

  const { data: trades = [] } = useTradesQuery(activeProfile?.id);
  const closedTrades = trades.filter(t => t.close_price);
  const closedMetrics = calculateClosedMetrics(closedTrades, startingBalance);

  const formatNumber = (num) => {
    if (num === undefined || num === null || num === '') return '—';
    const n = parseFloat(num);
    if (isNaN(n)) return '—';
    return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#c0c0c0]">{t('statsOverview')}</h1>
        <p className="text-[#666] text-sm">{t('statsDesc')}</p>
      </div>

      {/* ── Stats Cards (moved from Dashboard) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Winrate StatsCard */}
        <StatsCard
          title={t('winrate')}
          value={`${closedMetrics.winrate.toFixed(1)}%`}
          icon={Percent}
          valueColor={
            closedMetrics.winrate > 50
              ? 'text-emerald-400'
              : closedMetrics.winrate < 50
              ? 'text-red-400'
              : 'text-[#c0c0c0]'
          }
          subtitle={`${closedMetrics.tradesCount} closed trades`}
        />

        {/* Avg R StatsCard */}
        <StatsCard
          title={t('avgR')}
          value={closedMetrics.avgR != null ? `${closedMetrics.avgR.toFixed(2)}R` : '—'}
          icon={Target}
          valueColor={
            closedMetrics.avgR > 2
              ? 'text-emerald-400'
              : closedMetrics.avgR < 2
              ? 'text-red-400'
              : 'text-[#c0c0c0]'
          }
        />

        {/* Avg PnL StatsCard */}
        <StatsCard
          title={t('avgPnl')}
          value={
            closedMetrics.tradesCount > 0
              ? closedMetrics.netPnlUsd / closedMetrics.tradesCount >= 0
                ? `+$${formatNumber(closedMetrics.netPnlUsd / closedMetrics.tradesCount)}`
                : `-$${formatNumber(Math.abs(closedMetrics.netPnlUsd / closedMetrics.tradesCount))}`
              : '—'
          }
          icon={DollarSign}
          className={
            closedMetrics.tradesCount > 0 &&
            closedMetrics.netPnlUsd / closedMetrics.tradesCount < 0
              ? 'border-red-500/30'
              : ''
          }
        />

        {/* Trades count StatsCard */}
        <StatsCard
          title={t('tradesCount')}
          value={trades.length}
          icon={BarChart3}
          subtitle={`${closedTrades.length} closed · ${trades.length - closedTrades.length} open`}
        />
      </div>

      {/* Detailed trade statistics placeholder — link to full AnalyticsHub */}
      <div className="bg-white/[0.03] backdrop-blur-xl rounded-xl p-5 border border-white/[0.07] shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
        <p className="text-xs text-[#555] uppercase tracking-wider mb-3">Detailed Analytics</p>
        <p className="text-sm text-[#666]">
          Full analytics, equity curve, distributions, and AI insights are available in the{' '}
          <span className="text-[#c0c0c0] font-medium">Analytics Hub</span> section.
        </p>
      </div>
    </div>
  );
}
