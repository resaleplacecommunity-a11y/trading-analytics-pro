import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Plus, Target, Percent, DollarSign, BarChart3, Image } from 'lucide-react';

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
import TradeForm from '../components/trades/TradeForm';
import AgentChatModal from '../components/AgentChatModal';

export default function Dashboard() {
  const [showAgentChat, setShowAgentChat] = useState(false);
  const { t } = useTranslation();

  const { data: trades = [], refetch: refetchTrades } = useQuery({
    queryKey: ['trades'],
    queryFn: () => base44.entities.Trade.list('-date', 1000),
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

  // Calculate stats
  const startingBalance = 100000;
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  // Only closed trades for metrics
  const closedTrades = trades.filter(t => t.close_price);
  
  const totalPnlUsd = closedTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
  const totalPnlPercent = (totalPnlUsd / startingBalance) * 100;
  
  // Today's PNL - only trades closed today
  const todayTrades = closedTrades.filter(t => {
    if (!t.date_close) return false;
    const closeDateOnly = t.date_close.split('T')[0];
    return closeDateOnly === today;
  });
  const todayPnl = todayTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
  
  const wins = closedTrades.filter(t => (t.pnl_usd || 0) > 0).length;
  const losses = closedTrades.length - wins;
  const winrate = closedTrades.length > 0 ? (wins / closedTrades.length * 100).toFixed(1) : 0;
  
  const avgR = closedTrades.length > 0 ? 
    closedTrades.reduce((s, t) => s + (t.r_multiple || 0), 0) / closedTrades.length : 0;
  const avgPnlPerTrade = closedTrades.length > 0 ? 
    closedTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0) / closedTrades.length : 0;
  const currentBalance = startingBalance + totalPnlUsd;
  
  const formatNumber = (num) => {
    if (num === undefined || num === null || num === '') return '—';
    const n = parseFloat(num);
    if (isNaN(n)) return '—';
    return Math.round(n).toLocaleString('ru-RU');
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

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <StatsCard 
          title={t('balance')}
          value={`$${formatNumber(currentBalance)}`}
          subtitle={todayPnl !== 0 ? (todayPnl >= 0 ? `Today: +$${formatNumber(Math.abs(todayPnl))}` : `Today: -$${formatNumber(Math.abs(todayPnl))}`) : 'Today: $0'}
          subtitleColor={todayPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}
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