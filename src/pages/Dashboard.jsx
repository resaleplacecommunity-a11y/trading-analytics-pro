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
import EmotionTrend from '../components/dashboard/EmotionTrend';
import RiskOverview from '../components/dashboard/RiskOverview';
import AIRecommendations from '../components/ai/AIRecommendations';
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
  const totalPnlUsd = trades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
  const totalPnlPercent = trades.reduce((s, t) => s + (t.pnl_percent || 0), 0);
  const wins = trades.filter(t => (t.pnl_usd || 0) > 0).length;
  const winrate = trades.length > 0 ? (wins / trades.length * 100).toFixed(1) : 0;
  const avgR = trades.length > 0 ? 
    trades.reduce((s, t) => s + (t.r_multiple || 0), 0) / trades.length : 0;
  const avgPnlPerTrade = trades.length > 0 ? totalPnlUsd / trades.length : 0;
  
  // Balance (starting balance + total PNL)
  const startingBalance = 100000; // можно сделать настраиваемым
  const currentBalance = startingBalance + totalPnlUsd;

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
          {t('newTrade')}
        </Button>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <StatsCard 
          title={t('balance')}
          value={`$${currentBalance.toFixed(2)}`}
          icon={DollarSign}
          className={currentBalance < startingBalance ? "border-red-500/30" : ""}
        />
        <StatsCard 
          title={t('totalPnl')}
          value={`${totalPnlUsd >= 0 ? '+' : ''}$${totalPnlUsd.toFixed(2)}`}
          subtitle={`${totalPnlPercent >= 0 ? '+' : ''}${totalPnlPercent.toFixed(2)}%`}
          icon={DollarSign}
          className={totalPnlUsd < 0 ? "border-red-500/30" : ""}
        />
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard 
          title={t('winrate')}
          value={`${winrate}%`}
          subtitle={`${wins}W / ${trades.length - wins}L`}
          icon={Percent}
          className={parseFloat(winrate) < 50 ? "border-red-500/30" : ""}
        />
        <StatsCard 
          title={t('avgR')}
          value={`${avgR.toFixed(2)}R`}
          icon={Target}
          className={avgR < 1 ? "border-red-500/30" : ""}
        />
        <StatsCard 
          title={t('avgPnl')}
          value={`${avgPnlPerTrade >= 0 ? '+' : ''}$${avgPnlPerTrade.toFixed(2)}`}
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

      {/* AI & Risk Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AIRecommendations trades={trades} behaviorLogs={behaviorLogs} />
        <RiskOverview trades={trades} riskSettings={riskSettings} behaviorLogs={behaviorLogs} />
      </div>

      {/* Performance Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StrategyPerformance trades={trades} />
        <EmotionTrend trades={trades} />
      </div>

      {/* Coins */}
      <CoinPerformance trades={trades} />

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