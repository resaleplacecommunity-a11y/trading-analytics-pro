import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Plus, Target, Percent, DollarSign, BarChart3 } from 'lucide-react';

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
import { formatInTimeZone } from 'date-fns-tz';
import { getTradesForActiveProfile } from '../components/utils/profileUtils';

export default function Dashboard() {
  const [showAgentChat, setShowAgentChat] = useState(false);
  const [, forceUpdate] = useState();
  const { t } = useTranslation();

  const { data: trades = [], refetch: refetchTrades } = useQuery({
    queryKey: ['trades'],
    queryFn: () => getTradesForActiveProfile(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const { data: riskSettings } = useQuery({
    queryKey: ['riskSettings'],
    queryFn: async () => {
      const settings = await base44.entities.RiskSettings.list();
      return settings[0] || null;
    },
  });

  const { data: behaviorLogs = [] } = useQuery({
    queryKey: ['behaviorLogs'],
    queryFn: () => base44.entities.BehaviorLog.list('-date', 100),
  });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['userProfiles'],
    queryFn: () => base44.entities.UserProfile.list('-created_date', 10),
  });

  const activeProfile = profiles.find(p => p.is_active);

  // Auto-refresh at midnight in user timezone
  useEffect(() => {
    const userTimezone = user?.preferred_timezone || 'UTC';
    const checkMidnight = () => {
      const now = new Date();
      const currentDay = formatInTimeZone(now, userTimezone, 'yyyy-MM-dd');
      const nextMidnight = new Date(currentDay);
      nextMidnight.setDate(nextMidnight.getDate() + 1);
      nextMidnight.setHours(0, 0, 0, 0);
      
      const msUntilMidnight = nextMidnight.getTime() - now.getTime();
      
      const timer = setTimeout(() => {
        forceUpdate({}); // Force re-render
      }, msUntilMidnight + 1000);
      
      return timer;
    };
    
    const timer = checkMidnight();
    return () => clearTimeout(timer);
  }, [user]);

  // Calculate stats
  const startingBalance = activeProfile?.starting_balance || 100000;
  const now = new Date();
  const userTimezone = user?.preferred_timezone || 'UTC';
  const today = formatInTimeZone(now, userTimezone, 'yyyy-MM-dd');
  
  // Only closed trades for metrics
  const closedTrades = trades.filter(t => t.close_price);
  const openTrades = trades.filter(t => !t.close_price);
  
  const closedPnlUsd = closedTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
  const openRealizedPnlUsd = openTrades.reduce((s, t) => s + (t.realized_pnl_usd || 0), 0);
  const totalPnlUsd = closedPnlUsd + openRealizedPnlUsd;
  const totalPnlPercent = (totalPnlUsd / startingBalance) * 100;
  
  // Today's closed trades - use user timezone
  const todayClosedTrades = closedTrades.filter(t => {
    if (!t.date_close) return false;
    try {
      const tradeCloseDate = new Date(t.date_close);
      const closeDateInUserTz = formatInTimeZone(tradeCloseDate, userTimezone, 'yyyy-MM-dd');
      return closeDateInUserTz === today;
    } catch (e) {
      console.error('Error parsing date:', e);
      return false;
    }
  });
  let todayPnl = todayClosedTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
  
  // Add today's partial closes from open trades
  openTrades.forEach(t => {
    if (t.partial_closes) {
      try {
        const partials = JSON.parse(t.partial_closes);
        partials.forEach(pc => {
          if (pc.timestamp) {
            const pcDate = formatInTimeZone(new Date(pc.timestamp), userTimezone, 'yyyy-MM-dd');
            if (pcDate === today) {
              todayPnl += (pc.pnl_usd || 0);
            }
          }
        });
      } catch {}
    }
  });
  
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

  // Trades opened today (for violations check)
  const todayOpenedTrades = trades.filter(t => {
    const tradeDate = t.date_open || t.date;
    if (!tradeDate) return false;
    try {
      const tradeDateInUserTz = formatInTimeZone(new Date(tradeDate), userTimezone, 'yyyy-MM-dd');
      return tradeDateInUserTz === today;
    } catch {
      return tradeDate.startsWith(today);
    }
  });

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
  
  // Winrate calculation - exclude BE trades (±0.5$ or ±0.01%)
  const epsilon = 0.5;
  const wins = closedTrades.filter((t) => {
    const pnl = t.pnl_usd || 0;
    const pnlPercent = Math.abs((pnl / (t.account_balance_at_entry || startingBalance)) * 100);
    return pnl > epsilon && pnlPercent > 0.01;
  });
  const losses = closedTrades.filter((t) => {
    const pnl = t.pnl_usd || 0;
    const pnlPercent = Math.abs((pnl / (t.account_balance_at_entry || startingBalance)) * 100);
    return pnl < -epsilon && pnlPercent > 0.01;
  });
  const winrate = (wins.length + losses.length) > 0 ? ((wins.length / (wins.length + losses.length)) * 100).toFixed(1) : 0;
  
  const avgR = closedTrades.length > 0 ? 
    closedTrades.reduce((s, t) => s + (t.r_multiple || 0), 0) / closedTrades.length : 0;
  const avgPnlPerTrade = closedTrades.length > 0 ? 
    closedTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0) / closedTrades.length : 0;
  const currentBalance = startingBalance + totalPnlUsd;
  
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
          value={totalPnlUsd >= 0 ? `+$${formatNumber(totalPnlUsd)}` : `-$${formatNumber(Math.abs(totalPnlUsd))}`}
          subtitle={`${totalPnlPercent >= 0 ? '+' : ''}${totalPnlPercent.toFixed(2)}%`}
          icon={DollarSign}
          className={totalPnlUsd < 0 ? "border-red-500/30" : ""}
        />
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard 
          title={t('winrate')}
          value={`${winrate}%`}
          icon={Percent}
          valueColor={parseFloat(winrate) > 50 ? 'text-emerald-400' : parseFloat(winrate) < 50 ? 'text-red-400' : 'text-[#c0c0c0]'}
        />
        <StatsCard 
          title={t('avgR')}
          value={`${avgR.toFixed(2)}R`}
          icon={Target}
          valueColor={avgR > 2 ? 'text-emerald-400' : avgR < 2 ? 'text-red-400' : 'text-[#c0c0c0]'}
        />
        <StatsCard 
          title={t('avgPnl')}
          value={avgPnlPerTrade >= 0 ? `+$${formatNumber(avgPnlPerTrade)}` : `-$${formatNumber(Math.abs(avgPnlPerTrade))}`}
          icon={DollarSign}
          className={avgPnlPerTrade < 0 ? "border-red-500/30" : ""}
        />
        <StatsCard 
          title={t('tradesCount')}
          value={trades.length}
          icon={BarChart3}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EquityCurve trades={trades} />
        <PnlChart trades={trades} />
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