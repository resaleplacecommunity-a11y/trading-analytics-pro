import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp, Target, Percent, DollarSign, Activity, BarChart3 } from 'lucide-react';

import StatsCard from '../components/dashboard/StatsCard';
import EquityCurve from '../components/dashboard/EquityCurve';
import PnlChart from '../components/dashboard/PnlChart';
import CoinPerformance from '../components/dashboard/CoinPerformance';
import StrategyPerformance from '../components/dashboard/StrategyPerformance';
import EmotionTrend from '../components/dashboard/EmotionTrend';
import RiskOverview from '../components/dashboard/RiskOverview';
import AIRecommendations from '../components/ai/AIRecommendations';
import TradeForm from '../components/trades/TradeForm';

export default function Dashboard() {
  const [showTradeForm, setShowTradeForm] = useState(false);

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
  const totalPnl = trades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
  const wins = trades.filter(t => (t.pnl_usd || 0) > 0).length;
  const winrate = trades.length > 0 ? (wins / trades.length * 100).toFixed(1) : 0;
  const avgR = trades.length > 0 ? 
    trades.reduce((s, t) => s + (t.r_multiple || 0), 0) / trades.length : 0;
  
  // Profit Factor
  const totalWins = trades.filter(t => (t.pnl_usd || 0) > 0).reduce((s, t) => s + t.pnl_usd, 0);
  const totalLosses = Math.abs(trades.filter(t => (t.pnl_usd || 0) < 0).reduce((s, t) => s + t.pnl_usd, 0));
  const pf = totalLosses > 0 ? (totalWins / totalLosses).toFixed(2) : totalWins > 0 ? '∞' : '0';

  // Max Drawdown
  let peak = 0;
  let maxDD = 0;
  let running = 0;
  [...trades].sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(t => {
    running += (t.pnl_usd || 0);
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > maxDD) maxDD = dd;
  });

  const handleSaveTrade = async (tradeData) => {
    await base44.entities.Trade.create(tradeData);
    refetchTrades();
    setShowTradeForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#c0c0c0]">Dashboard</h1>
          <p className="text-[#666] text-sm">Trading Analytics Overview</p>
        </div>
        <Button 
          onClick={() => setShowTradeForm(true)}
          className="bg-[#c0c0c0] text-black hover:bg-[#a0a0a0]"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Trade
        </Button>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatsCard 
          title="Total PNL" 
          value={`${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`}
          icon={DollarSign}
        />
        <StatsCard 
          title="Winrate" 
          value={`${winrate}%`}
          subtitle={`${wins}W / ${trades.length - wins}L`}
          icon={Percent}
        />
        <StatsCard 
          title="Avg R" 
          value={`${avgR.toFixed(2)}R`}
          icon={Target}
        />
        <StatsCard 
          title="Profit Factor" 
          value={pf}
          icon={TrendingUp}
        />
        <StatsCard 
          title="Max DD" 
          value={`$${maxDD.toFixed(2)}`}
          icon={Activity}
        />
        <StatsCard 
          title="Trades" 
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

      {/* Trade Form Modal */}
      {showTradeForm && (
        <TradeForm 
          onSubmit={handleSaveTrade}
          onClose={() => setShowTradeForm(false)}
        />
      )}
    </div>
  );
}