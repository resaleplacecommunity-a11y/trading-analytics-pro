import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Plus, Target, Percent, DollarSign, BarChart3 } from 'lucide-react';
import { calculateClosedMetrics } from '../components/analytics/analyticsCalculations';

// Translation hook
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
        dashboard: 'Дашборд', analyticsOverview: 'Обзор Торговли', newTrade: 'Новая Сделка',
        addByPhoto: 'По Фото', balance: 'Баланс', totalPnl: 'Общий PNL', winrate: 'Винрейт',
        avgR: 'Средний R', avgPnl: 'Средний PNL', tradesCount: 'Сделок'
      },
      en: {
        dashboard: 'Dashboard', analyticsOverview: 'Analytics Overview', newTrade: 'New Trade',
        addByPhoto: 'By Photo', balance: 'Balance', totalPnl: 'Total PNL', winrate: 'Winrate',
        avgR: 'Avg R', avgPnl: 'Avg PNL', tradesCount: 'Trades'
      }
    };
    return tr[lang]?.[key] || key;
  }};
};

import StatsCard from '../components/dashboard/StatsCard';
import EquityCurve from '../components/dashboard/EquityCurve';
import PnlChart from '../components/dashboard/PnlChart';
import CoinPerformance from '../components/dashboard/CoinPerformance';
import StrategyPerformance from '../components/dashboard/StrategyPerformance';
import RiskOverviewNew from '../components/dashboard/RiskOverviewNew';
import AIRecommendations from '../components/ai/AIRecommendations';
import BestWorstTrade from '../components/dashboard/BestWorstTrade';
import DisciplinePsychology from '../components/dashboard/DisciplinePsychology';
import MissedOpportunities from '../components/dashboard/MissedOpportunities';
import AgentChatModal from '../components/AgentChatModal';
import RiskViolationBanner from '../components/RiskViolationBanner';
import { getTradesForActiveProfile } from '../components/utils/profileUtils';
import { 
  getTodayInUserTz, 
  getTodayClosedTrades, 
  getTodayOpenedTrades,
  getTodayPnl
} from '../components/utils/dateUtils';
import { format } from 'date-fns';

export default function Dashboard() {
  const [showAgentChat, setShowAgentChat] = useState(false);
  const { t } = useTranslation();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const currentUser = await base44.auth.me();
      console.log('Dashboard: Current user loaded:', currentUser?.email);
      return currentUser;
    },
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    cacheTime: 0,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['userProfiles', user?.email],
    queryFn: async () => {
      if (!user?.email) {
        console.log('Dashboard: No user email, skipping profiles');
        return [];
      }
      console.log('Dashboard: Loading profiles for:', user.email);
      const userProfiles = await base44.entities.UserProfile.filter({ created_by: user.email }, '-created_date', 10);
      console.log('Dashboard: Loaded profiles:', userProfiles.map(p => ({id: p.id, name: p.profile_name, active: p.is_active, owner: p.created_by})));
      return userProfiles;
    },
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    cacheTime: 0,
  });

  const { data: trades = [], refetch: refetchTrades } = useQuery({
    queryKey: ['trades', user?.email, profiles.find(p => p.is_active)?.id],
    queryFn: async () => {
      if (!user?.email) {
        console.log('Dashboard: No user email, skipping trades');
        return [];
      }
      const userProfiles = await base44.entities.UserProfile.filter({ created_by: user.email }, '-created_date', 10);
      const activeProfile = userProfiles.find(p => p.is_active);
      if (!activeProfile) {
        console.log('Dashboard: No active profile found for user:', user.email);
        return [];
      }
      console.log('Dashboard: Loading trades for profile:', activeProfile.id, 'owner:', user.email);
      
      // Fetch ALL trades in batches (no 1000 limit)
      let allTrades = [];
      let skip = 0;
      const batchSize = 1000;
      
      while (true) {
        const batch = await base44.entities.Trade.filter({ 
          created_by: user.email,
          profile_id: activeProfile.id 
        }, '-date_open', batchSize, skip);
        
        if (batch.length === 0) break;
        allTrades = allTrades.concat(batch);
        skip += batch.length;
        
        if (batch.length < batchSize) break;
      }
      
      console.log('Dashboard: Loaded', allTrades.length, 'trades (all batches)');
      // Client-side security filter
      return allTrades.filter(t => t.created_by === user.email && t.profile_id === activeProfile.id);
    },
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    cacheTime: 0,
  });

  const { data: riskSettings } = useQuery({
    queryKey: ['riskSettings', user?.email, profiles.find(p => p.is_active)?.id],
    queryFn: async () => {
      if (!user?.email) return null;
      const userProfiles = await base44.entities.UserProfile.filter({ created_by: user.email }, '-created_date', 10);
      const activeProfile = userProfiles.find(p => p.is_active);
      if (!activeProfile) return null;
      const settings = await base44.entities.RiskSettings.filter({ 
        created_by: user.email,
        profile_id: activeProfile.id 
      }, '-created_date', 1);
      return settings[0] || null;
    },
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    cacheTime: 0,
  });

  const { data: behaviorLogs = [] } = useQuery({
    queryKey: ['behaviorLogs', user?.email, profiles.find(p => p.is_active)?.id],
    queryFn: async () => {
      if (!user?.email) return [];
      const userProfiles = await base44.entities.UserProfile.filter({ created_by: user.email }, '-created_date', 10);
      const activeProfile = userProfiles.find(p => p.is_active);
      if (!activeProfile) return [];
      return base44.entities.BehaviorLog.filter({ 
        created_by: user.email,
        profile_id: activeProfile.id 
      }, '-date', 20);
    },
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    cacheTime: 0,
  });

  const activeProfile = profiles.find(p => p.is_active);
  
  // Security check: ensure active profile belongs to current user
  useEffect(() => {
    if (activeProfile && user?.email && activeProfile.created_by !== user.email) {
      console.error('SECURITY WARNING: Active profile does not belong to current user!', {
        profile: activeProfile.id,
        profileOwner: activeProfile.created_by,
        currentUser: user.email
      });
    }
  }, [activeProfile, user]);



  // Calculate stats
  const startingBalance = activeProfile?.starting_balance || 100000;
  const userTimezone = user?.preferred_timezone || 'UTC';
  const today = getTodayInUserTz(userTimezone);
  
  // Only closed trades for metrics
  const closedTrades = trades.filter(t => t.close_price);
  const openTrades = trades.filter(t => !t.close_price);
  
  // Use centralized calculation
  const closedMetrics = calculateClosedMetrics(closedTrades, startingBalance);
  const openRealizedPnlUsd = openTrades.reduce((s, t) => s + (t.realized_pnl_usd || 0), 0);
  
  // Today's closed trades and PNL - using unified date utilities
  const todayClosedTrades = getTodayClosedTrades(trades, userTimezone);
  const todayPnl = getTodayPnl(trades, userTimezone);
  
  // Daily loss = sum of all negative PNL today (in percent)
  const todayPnlPercent = todayClosedTrades.reduce((s, t) => {
    const pnl = t.pnl_usd || 0;
    if (pnl < 0) {
      const balance = t.account_balance_at_entry || startingBalance;
      return s + ((pnl / balance) * 100);
    }
    return s;
  }, 0);
  
  const todayR = todayClosedTrades.reduce((s, t) => s + (t.r_multiple || 0), 0);

  // Trades opened today (for violations check) - using unified utilities
  const todayOpenedTrades = getTodayOpenedTrades(trades, userTimezone);

  const recentTrades = [...trades].filter(t => t.close_price).sort((a, b) => 
    new Date(b.date_close || b.date) - new Date(a.date_close || a.date)
  ).slice(0, 10);
  const consecutiveLosses = recentTrades.findIndex(t => (t.pnl_usd || 0) >= 0);
  const lossStreak = consecutiveLosses === -1 ? Math.min(recentTrades.length, riskSettings?.max_consecutive_losses || 3) : consecutiveLosses;

  const violations = [];
  if (riskSettings) {
    if (riskSettings.daily_max_loss_percent && todayPnlPercent < -riskSettings.daily_max_loss_percent) {
      violations.push({
        rule: 'Daily Loss Limit',
        value: `${todayPnlPercent.toFixed(2)}%`,
        limit: `${riskSettings.daily_max_loss_percent}%`,
      });
    }
    if (riskSettings.daily_max_r && todayR < -riskSettings.daily_max_r) {
      violations.push({
        rule: 'Daily R Loss',
        value: `${todayR.toFixed(2)}R`,
        limit: `${riskSettings.daily_max_r}R`,
      });
    }
    if (riskSettings.max_trades_per_day && todayOpenedTrades.length >= riskSettings.max_trades_per_day) {
      violations.push({
        rule: 'Max Trades',
        value: `${todayOpenedTrades.length}`,
        limit: `${riskSettings.max_trades_per_day}`,
      });
    }
    if (lossStreak >= (riskSettings.max_consecutive_losses || 3)) {
      violations.push({
        rule: 'Loss Streak',
        value: `${lossStreak} losses`,
        limit: `${riskSettings.max_consecutive_losses}`,
      });
    }
  }
  
  const currentBalance = startingBalance + closedMetrics.netPnlUsd + openRealizedPnlUsd;
  
  const formatNumber = (num) => {
    if (num === undefined || num === null || num === '') return '—';
    const n = parseFloat(num);
    if (isNaN(n)) return '—';
    return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
  };


  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* Risk Violation Banner */}
      <RiskViolationBanner violations={violations} />

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <StatsCard 
          title={t('balance')}
          value={`$${formatNumber(currentBalance)}`}
          subtitle={todayPnl !== 0 ? (todayPnl > 0 ? `Today: +$${formatNumber(Math.abs(todayPnl))}` : `Today: -$${formatNumber(Math.abs(todayPnl))}`) : 'Today: $0'}
          subtitleColor={todayPnl > 0 ? 'text-emerald-400' : todayPnl < 0 ? 'text-red-400' : 'text-[#666]'}
          icon={DollarSign}
          className={currentBalance < startingBalance ? "border-red-500/30" : ""}
        />
        <StatsCard 
          title={t('totalPnl')}
          value={closedMetrics.netPnlUsd >= 0 ? `+$${formatNumber(closedMetrics.netPnlUsd)}` : `-$${formatNumber(Math.abs(closedMetrics.netPnlUsd))}`}
          subtitle={`${closedMetrics.netPnlPercent >= 0 ? '+' : ''}${closedMetrics.netPnlPercent.toFixed(1)}%`}
          icon={DollarSign}
          className={closedMetrics.netPnlUsd < 0 ? "border-red-500/30" : ""}
        />
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard 
          title={t('winrate')}
          value={`${closedMetrics.winrate.toFixed(1)}%`}
          icon={Percent}
          valueColor={closedMetrics.winrate > 50 ? 'text-emerald-400' : closedMetrics.winrate < 50 ? 'text-red-400' : 'text-[#c0c0c0]'}
        />
        <StatsCard 
          title={t('avgR')}
          value={`${closedMetrics.avgR.toFixed(2)}R`}
          icon={Target}
          valueColor={closedMetrics.avgR > 2 ? 'text-emerald-400' : closedMetrics.avgR < 2 ? 'text-red-400' : 'text-[#c0c0c0]'}
        />
        <StatsCard 
          title={t('avgPnl')}
          value={closedMetrics.tradesCount > 0 ? 
            (closedMetrics.netPnlUsd / closedMetrics.tradesCount) >= 0 ? 
              `+$${formatNumber(closedMetrics.netPnlUsd / closedMetrics.tradesCount)}` : 
              `-$${formatNumber(Math.abs(closedMetrics.netPnlUsd / closedMetrics.tradesCount))}` : 
            '—'}
          icon={DollarSign}
          className={(closedMetrics.tradesCount > 0 && (closedMetrics.netPnlUsd / closedMetrics.tradesCount) < 0) ? "border-red-500/30" : ""}
        />
        <StatsCard 
          title={t('tradesCount')}
          value={trades.length}
          icon={BarChart3}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EquityCurve trades={trades} userTimezone={userTimezone} startingBalance={startingBalance} />
        <PnlChart trades={trades} userTimezone={userTimezone} />
      </div>

      {/* AI & Risk Row - AI expands with col-span-2, Risk stays in place */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AIRecommendations trades={trades} behaviorLogs={behaviorLogs} />
        <div className="lg:col-start-2 lg:row-start-1">
          <RiskOverviewNew trades={trades} riskSettings={riskSettings} behaviorLogs={behaviorLogs} />
        </div>
      </div>

      {/* Discipline & Psychology + Missed Opportunities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DisciplinePsychology trades={closedTrades} />
        <MissedOpportunities trades={closedTrades} />
      </div>

      {/* Performance Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StrategyPerformance trades={closedTrades} />
        <BestWorstTrade trades={closedTrades} />
      </div>

      {/* Coins */}
      <CoinPerformance trades={closedTrades} />

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