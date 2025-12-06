import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, startOfWeek, endOfWeek, subWeeks, addWeeks, isThisWeek } from 'date-fns';
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Sparkles, Loader2 } from 'lucide-react';

import StatsCard from '../components/dashboard/StatsCard';
import AdvancedMetrics from '../components/analytics/AdvancedMetrics';
import TimeAnalysis from '../components/analytics/TimeAnalysis';
import CoinPerformance from '../components/dashboard/CoinPerformance';
import StrategyPerformance from '../components/dashboard/StrategyPerformance';
import EmotionTrend from '../components/dashboard/EmotionTrend';

export default function WeeklyAnalytics() {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  const { data: trades = [] } = useQuery({
    queryKey: ['trades'],
    queryFn: () => base44.entities.Trade.list('-date', 1000),
  });

  const { data: behaviorLogs = [] } = useQuery({
    queryKey: ['behaviorLogs'],
    queryFn: () => base44.entities.BehaviorLog.list('-date', 500),
  });

  // Filter trades for this week
  const weekTrades = trades.filter(t => {
    const d = new Date(t.date);
    return d >= weekStart && d <= weekEnd;
  });

  // Calculate weekly stats
  const pnlUsd = weekTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
  const pnlPercent = weekTrades.reduce((s, t) => s + (t.pnl_percent || 0), 0);
  const totalR = weekTrades.reduce((s, t) => s + (t.r_multiple || 0), 0);
  const wins = weekTrades.filter(t => (t.pnl_usd || 0) > 0).length;
  const losses = weekTrades.length - wins;
  const winrate = weekTrades.length > 0 ? (wins / weekTrades.length * 100).toFixed(1) : 0;

  const avgStopPercent = weekTrades.length > 0 ? 
    weekTrades.reduce((s, t) => s + (t.stop_percent || 0), 0) / weekTrades.length : 0;
  const avgStopUsd = weekTrades.length > 0 ? 
    weekTrades.reduce((s, t) => s + (t.stop_usd || 0), 0) / weekTrades.length : 0;

  const winningTrades = weekTrades.filter(t => (t.pnl_usd || 0) > 0);
  const losingTrades = weekTrades.filter(t => (t.pnl_usd || 0) < 0);
  
  const avgProfit = winningTrades.length > 0 ?
    winningTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0) / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ?
    Math.abs(losingTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0) / losingTrades.length) : 0;

  const avgR = weekTrades.length > 0 ? totalR / weekTrades.length : 0;
  
  const ruleCompliant = weekTrades.filter(t => t.rule_compliance).length;
  const planCompliance = weekTrades.length > 0 ? (ruleCompliant / weekTrades.length * 100).toFixed(0) : 0;

  // Behavior trends
  const weekBehaviors = behaviorLogs.filter(l => {
    const d = new Date(l.date);
    return d >= weekStart && d <= weekEnd;
  });

  const prevWeek = () => setWeekStart(subWeeks(weekStart, 1));
  const nextWeek = () => {
    const next = addWeeks(weekStart, 1);
    if (next <= new Date()) setWeekStart(next);
  };

  const analyzeWeek = async () => {
    if (weekTrades.length === 0) return;
    setAnalyzing(true);
    try {
      // Group by coin
      const coinStats = weekTrades.reduce((acc, t) => {
        acc[t.coin] = (acc[t.coin] || 0) + (t.pnl_usd || 0);
        return acc;
      }, {});
      const sortedCoins = Object.entries(coinStats).sort((a, b) => b[1] - a[1]);

      // Behavior triggers
      const triggers = weekBehaviors.reduce((acc, l) => {
        acc[l.trigger_name] = (acc[l.trigger_name] || 0) + (l.trigger_count || 1);
        return acc;
      }, {});

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this trading week and provide a comprehensive report in Russian:

Week: ${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}
Total trades: ${weekTrades.length}
Total PNL: $${pnlUsd.toFixed(2)} (${pnlPercent.toFixed(2)}%)
Total R: ${totalR.toFixed(2)}
Winrate: ${winrate}%
Avg Win: $${avgProfit.toFixed(2)}
Avg Loss: $${avgLoss.toFixed(2)}
Avg R: ${avgR.toFixed(2)}
Plan Compliance: ${planCompliance}%
Best coins: ${sortedCoins.slice(0, 3).map(([c, p]) => c + ': $' + p.toFixed(2)).join(', ')}
Worst coins: ${sortedCoins.slice(-3).reverse().map(([c, p]) => c + ': $' + p.toFixed(2)).join(', ')}
Behavioral triggers: ${JSON.stringify(triggers)}

Provide comprehensive analysis:
1. Weekly summary (overall performance assessment)
2. Key strengths shown this week
3. Main weaknesses/areas to improve
4. Behavioral patterns noticed
5. Specific action items for next week`,
        response_json_schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            strengths: { type: "string" },
            weaknesses: { type: "string" },
            patterns: { type: "string" },
            action_items: { type: "string" }
          }
        }
      });
      setAiAnalysis(result);
    } catch (err) {
      console.error('Analysis failed:', err);
    }
    setAnalyzing(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#c0c0c0]">Weekly Analytics</h1>
          <p className="text-[#666] text-sm">
            {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={prevWeek} className="text-[#888]">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <span className="text-[#c0c0c0] px-3">Week {format(weekStart, 'w')}</span>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={nextWeek}
            disabled={isThisWeek(weekStart, { weekStartsOn: 1 })}
            className="text-[#888]"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Weekly Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatsCard 
          title="Weekly PNL" 
          value={`${pnlUsd >= 0 ? '+' : ''}$${pnlUsd.toFixed(2)}`}
        />
        <StatsCard 
          title="Weekly R" 
          value={`${totalR >= 0 ? '+' : ''}${totalR.toFixed(2)}R`}
        />
        <StatsCard 
          title="Trades" 
          value={weekTrades.length}
          subtitle={`${wins}W / ${losses}L`}
        />
        <StatsCard 
          title="Winrate" 
          value={`${winrate}%`}
        />
        <StatsCard 
          title="Avg Profit" 
          value={`$${avgProfit.toFixed(2)}`}
        />
        <StatsCard 
          title="Avg Loss" 
          value={`$${avgLoss.toFixed(2)}`}
        />
      </div>

      {/* Advanced Metrics */}
      <AdvancedMetrics trades={weekTrades} />

      {/* AI Analysis */}
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h3 className="text-[#c0c0c0] text-sm font-medium">AI Weekly Report</h3>
          </div>
          {!aiAnalysis && (
            <Button 
              size="sm" 
              onClick={analyzeWeek}
              disabled={analyzing || weekTrades.length === 0}
              className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
            >
              {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generate Report'}
            </Button>
          )}
        </div>

        {aiAnalysis ? (
          <div className="space-y-3">
            <div className="bg-[#151515] rounded-lg p-4">
              <p className="text-[#888] text-xs mb-2">Weekly Summary</p>
              <p className="text-[#c0c0c0] text-sm">{aiAnalysis.summary}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-emerald-500/10 rounded-lg p-4">
                <p className="text-emerald-400 text-xs mb-2">Strengths</p>
                <p className="text-[#c0c0c0] text-sm">{aiAnalysis.strengths}</p>
              </div>
              <div className="bg-red-500/10 rounded-lg p-4">
                <p className="text-red-400 text-xs mb-2">Weaknesses</p>
                <p className="text-[#c0c0c0] text-sm">{aiAnalysis.weaknesses}</p>
              </div>
            </div>
            <div className="bg-purple-500/10 rounded-lg p-4">
              <p className="text-purple-400 text-xs mb-2">Behavioral Patterns</p>
              <p className="text-[#c0c0c0] text-sm">{aiAnalysis.patterns}</p>
            </div>
            <div className="bg-blue-500/10 rounded-lg p-4">
              <p className="text-blue-400 text-xs mb-2">Action Items for Next Week</p>
              <p className="text-[#c0c0c0] text-sm">{aiAnalysis.action_items}</p>
            </div>
          </div>
        ) : (
          <p className="text-[#666] text-sm text-center py-4">
            {weekTrades.length > 0 ? 'Click "Generate Report" for AI analysis' : 'No trades this week'}
          </p>
        )}
      </div>

      {/* Time Analysis */}
      <TimeAnalysis trades={weekTrades} />

      {/* Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StrategyPerformance trades={weekTrades} />
        <EmotionTrend trades={weekTrades} />
      </div>

      {/* Coins */}
      <CoinPerformance trades={weekTrades} />
    </div>
  );
}