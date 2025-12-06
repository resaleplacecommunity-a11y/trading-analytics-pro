import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, startOfDay, endOfDay, isToday, subDays } from 'date-fns';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Calendar, Sparkles, Loader2 } from 'lucide-react';
import { cn } from "@/lib/utils";

import StatsCard from '../components/dashboard/StatsCard';
import TradeCard from '../components/trades/TradeCard';
import TradeDetailModal from '../components/trades/TradeDetailModal';
import TradeForm from '../components/trades/TradeForm';

export default function DailyAnalytics() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [editingTrade, setEditingTrade] = useState(null);

  const { data: trades = [], refetch } = useQuery({
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

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const dayTrades = trades.filter(t => t.date?.startsWith(dateStr));

  // Calculate daily stats
  const pnlUsd = dayTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
  const pnlPercent = dayTrades.reduce((s, t) => s + (t.pnl_percent || 0), 0);
  const totalR = dayTrades.reduce((s, t) => s + (t.r_multiple || 0), 0);
  const wins = dayTrades.filter(t => (t.pnl_usd || 0) > 0).length;
  const winrate = dayTrades.length > 0 ? (wins / dayTrades.length * 100).toFixed(0) : 0;
  
  const avgEmotion = dayTrades.filter(t => t.emotional_state).length > 0 ?
    dayTrades.filter(t => t.emotional_state).reduce((s, t) => s + t.emotional_state, 0) / 
    dayTrades.filter(t => t.emotional_state).length : 0;

  const ruleCompliant = dayTrades.filter(t => t.rule_compliance).length;
  const ruleComplianceRate = dayTrades.length > 0 ? (ruleCompliant / dayTrades.length * 100).toFixed(0) : 0;

  const bestTrade = dayTrades.length > 0 ? dayTrades.reduce((best, t) => 
    (t.pnl_usd || 0) > (best.pnl_usd || 0) ? t : best, dayTrades[0]) : null;
  const worstTrade = dayTrades.length > 0 ? dayTrades.reduce((worst, t) => 
    (t.pnl_usd || 0) < (worst.pnl_usd || 0) ? t : worst, dayTrades[0]) : null;

  const prevDay = () => setSelectedDate(subDays(selectedDate, 1));
  const nextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    if (next <= new Date()) setSelectedDate(next);
  };

  const analyzeDay = async () => {
    if (dayTrades.length === 0) return;
    setAnalyzing(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this trading day and provide insights in Russian:

Date: ${dateStr}
Trades: ${dayTrades.length}
Total PNL: $${pnlUsd.toFixed(2)} (${pnlPercent.toFixed(2)}%)
Total R: ${totalR.toFixed(2)}
Winrate: ${winrate}%
Rule Compliance: ${ruleComplianceRate}%
Avg Emotional State: ${avgEmotion.toFixed(1)}/10

Best trade: ${bestTrade?.coin} ${bestTrade?.pnl_usd?.toFixed(2)}$
Worst trade: ${worstTrade?.coin} ${worstTrade?.pnl_usd?.toFixed(2)}$

Trades details: ${JSON.stringify(dayTrades.map(t => ({
  coin: t.coin, direction: t.direction, pnl: t.pnl_usd, r: t.r_multiple,
  rules: t.rule_compliance, emotion: t.emotional_state, strategy: t.strategy_tag
})))}

Provide:
1. Day summary (what happened overall)
2. What was done well
3. Mistakes made
4. Recommendations for tomorrow`,
        response_json_schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            positives: { type: "string" },
            mistakes: { type: "string" },
            tomorrow_recommendations: { type: "string" }
          }
        }
      });
      setAiAnalysis(result);
    } catch (err) {
      console.error('Analysis failed:', err);
    }
    setAnalyzing(false);
  };

  const handleEditTrade = (trade) => {
    setEditingTrade(trade);
    setSelectedTrade(null);
  };

  const handleDeleteTrade = async (trade) => {
    if (confirm('Delete this trade?')) {
      await base44.entities.Trade.delete(trade.id);
      refetch();
      setSelectedTrade(null);
    }
  };

  const handleUpdateTrade = async (data) => {
    await base44.entities.Trade.update(editingTrade.id, data);
    refetch();
    setEditingTrade(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#c0c0c0]">Daily Analytics</h1>
          <p className="text-[#666] text-sm">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={prevDay} className="text-[#888]">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" />
            <Input 
              type="date"
              value={dateStr}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className="pl-9 w-40 bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]"
            />
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={nextDay}
            disabled={isToday(selectedDate)}
            className="text-[#888]"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Daily Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatsCard 
          title="Daily PNL" 
          value={`${pnlUsd >= 0 ? '+' : ''}$${pnlUsd.toFixed(2)}`}
        />
        <StatsCard 
          title="Daily R" 
          value={`${totalR >= 0 ? '+' : ''}${totalR.toFixed(2)}R`}
        />
        <StatsCard 
          title="Trades" 
          value={dayTrades.length}
          subtitle={`${wins}W / ${dayTrades.length - wins}L`}
        />
        <StatsCard 
          title="Winrate" 
          value={`${winrate}%`}
        />
        <StatsCard 
          title="Rule Compliance" 
          value={`${ruleComplianceRate}%`}
        />
        <StatsCard 
          title="Avg Emotion" 
          value={`${avgEmotion.toFixed(1)}/10`}
        />
      </div>

      {/* Best/Worst */}
      {dayTrades.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-emerald-500/10 to-[#0d0d0d] rounded-xl p-4 border border-emerald-500/20">
            <h3 className="text-emerald-400 text-sm font-medium mb-2">Best Trade</h3>
            {bestTrade && (
              <div className="flex items-center justify-between">
                <span className="text-[#c0c0c0]">{bestTrade.coin}</span>
                <span className="text-emerald-400 font-bold">+${(bestTrade.pnl_usd || 0).toFixed(2)}</span>
              </div>
            )}
          </div>
          <div className="bg-gradient-to-br from-red-500/10 to-[#0d0d0d] rounded-xl p-4 border border-red-500/20">
            <h3 className="text-red-400 text-sm font-medium mb-2">Worst Trade</h3>
            {worstTrade && (
              <div className="flex items-center justify-between">
                <span className="text-[#c0c0c0]">{worstTrade.coin}</span>
                <span className="text-red-400 font-bold">${(worstTrade.pnl_usd || 0).toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Analysis */}
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h3 className="text-[#c0c0c0] text-sm font-medium">AI Day Analysis</h3>
          </div>
          {!aiAnalysis && (
            <Button 
              size="sm" 
              onClick={analyzeDay}
              disabled={analyzing || dayTrades.length === 0}
              className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
            >
              {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Analyze Day'}
            </Button>
          )}
        </div>

        {aiAnalysis ? (
          <div className="space-y-3">
            <div className="bg-[#151515] rounded-lg p-3">
              <p className="text-[#888] text-xs mb-1">Summary</p>
              <p className="text-[#c0c0c0] text-sm">{aiAnalysis.summary}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-emerald-500/10 rounded-lg p-3">
                <p className="text-emerald-400 text-xs mb-1">What Went Well</p>
                <p className="text-[#c0c0c0] text-sm">{aiAnalysis.positives}</p>
              </div>
              <div className="bg-red-500/10 rounded-lg p-3">
                <p className="text-red-400 text-xs mb-1">Mistakes</p>
                <p className="text-[#c0c0c0] text-sm">{aiAnalysis.mistakes}</p>
              </div>
            </div>
            <div className="bg-blue-500/10 rounded-lg p-3">
              <p className="text-blue-400 text-xs mb-1">Recommendations for Tomorrow</p>
              <p className="text-[#c0c0c0] text-sm">{aiAnalysis.tomorrow_recommendations}</p>
            </div>
          </div>
        ) : (
          <p className="text-[#666] text-sm text-center py-4">
            {dayTrades.length > 0 ? 'Click "Analyze Day" to get AI insights' : 'No trades on this day'}
          </p>
        )}
      </div>

      {/* Day's Trades */}
      <div>
        <h3 className="text-[#c0c0c0] font-medium mb-4">Day's Trades</h3>
        {dayTrades.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {dayTrades.map(trade => (
              <TradeCard key={trade.id} trade={trade} onClick={setSelectedTrade} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-[#1a1a1a] rounded-xl">
            <p className="text-[#666]">No trades on this day</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedTrade && (
        <TradeDetailModal
          trade={selectedTrade}
          onClose={() => setSelectedTrade(null)}
          onEdit={handleEditTrade}
          onDelete={handleDeleteTrade}
        />
      )}

      {editingTrade && (
        <TradeForm
          trade={editingTrade}
          onSubmit={handleUpdateTrade}
          onClose={() => setEditingTrade(null)}
        />
      )}
    </div>
  );
}