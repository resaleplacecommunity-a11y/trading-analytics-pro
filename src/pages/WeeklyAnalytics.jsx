import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, startOfWeek, endOfWeek, subWeeks, addWeeks, isThisWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Sparkles, Loader2, Calendar } from 'lucide-react';
import { cn } from "@/lib/utils";

const useTranslation = () => {
  const [lang, setLang] = useState(localStorage.getItem('tradingpro_lang') || 'ru');
  useEffect(() => {
    const h = () => setLang(localStorage.getItem('tradingpro_lang') || 'ru');
    window.addEventListener('languagechange', h);
    return () => window.removeEventListener('languagechange', h);
  }, []);
  return { lang, t: (k) => {
    const tr = {
      ru: { weekly: 'Недельная Аналитика', week: 'Неделя', weeklyPnl: 'Недельный PNL', weeklyR: 'Недельный R', trades: 'Сделок', winrate: 'Винрейт', avgProfit: 'Средний Профит', avgLoss: 'Средний Лосс', generateReport: 'Сгенерировать Отчет', analyzing: 'Анализ...', noTradesThisWeek: 'Нет сделок на этой неделе' },
      en: { weekly: 'Weekly Analytics', week: 'Week', weeklyPnl: 'Weekly PNL', weeklyR: 'Weekly R', trades: 'Trades', winrate: 'Winrate', avgProfit: 'Avg Profit', avgLoss: 'Avg Loss', generateReport: 'Generate Report', analyzing: 'Analyzing...', noTradesThisWeek: 'No trades this week' }
    };
    return tr[lang]?.[k] || k;
  }};
};

import StatsCard from '../components/dashboard/StatsCard';
import AdvancedMetrics from '../components/analytics/AdvancedMetrics';
import TimeAnalysis from '../components/analytics/TimeAnalysis';
import CoinPerformance from '../components/dashboard/CoinPerformance';
import StrategyPerformance from '../components/dashboard/StrategyPerformance';
import EmotionTrend from '../components/dashboard/EmotionTrend';

export default function WeeklyAnalytics() {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedDay, setSelectedDay] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const { t } = useTranslation();

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
          <h1 className="text-2xl font-bold text-[#c0c0c0]">{t('weekly')}</h1>
          <p className="text-[#666] text-sm">
            {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={prevWeek} className="text-[#888]">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <span className="text-[#c0c0c0] px-3">{t('week')} {format(weekStart, 'w')}</span>
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
      
      {/* Days of Week */}
      <div className="grid grid-cols-7 gap-2">
        {eachDayOfInterval({ start: weekStart, end: weekEnd }).map(day => {
          const dayTrades = weekTrades.filter(t => {
            const tradeDate = new Date(t.date);
            return isSameDay(tradeDate, day);
          });
          const dayPnl = dayTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
          const isSelected = selectedDay && isSameDay(selectedDay, day);
          
          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelectedDay(isSelected ? null : day)}
              className={cn(
                "p-3 rounded-lg border transition-all",
                isSelected 
                  ? "bg-[#c0c0c0]/20 border-[#c0c0c0]" 
                  : "bg-[#1a1a1a] border-[#2a2a2a] hover:border-[#3a3a3a]"
              )}
            >
              <div className="text-xs text-[#888]">{format(day, 'EEE')}</div>
              <div className="text-lg font-bold text-[#c0c0c0]">{format(day, 'd')}</div>
              {dayTrades.length > 0 && (
                <>
                  <div className={cn(
                    "text-xs font-medium mt-1",
                    dayPnl >= 0 ? "text-emerald-400" : "text-red-400"
                  )}>
                    {dayPnl >= 0 ? '+' : ''}${dayPnl.toFixed(0)}
                  </div>
                  <div className="text-xs text-[#666]">
                    {((dayPnl / 10000) * 100).toFixed(1)}%
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Display either Weekly or Day view */}
      {selectedDay ? (
        <DayView 
          day={selectedDay} 
          trades={weekTrades.filter(t => isSameDay(new Date(t.date), selectedDay))}
          onBack={() => setSelectedDay(null)}
          t={t}
        />
      ) : (
        <>
          {/* Weekly Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <StatsCard 
              title={t('weeklyPnl')}
              value={`${pnlUsd >= 0 ? '+' : ''}$${pnlUsd.toFixed(2)}`}
            />
            <StatsCard 
              title={t('weeklyR')}
              value={`${totalR >= 0 ? '+' : ''}${totalR.toFixed(2)}R`}
            />
            <StatsCard 
              title={t('trades')}
              value={weekTrades.length}
              subtitle={`${wins}W / ${losses}L`}
            />
            <StatsCard 
              title={t('winrate')}
              value={`${winrate}%`}
            />
            <StatsCard 
              title={t('avgProfit')}
              value={`$${avgProfit.toFixed(2)}`}
            />
            <StatsCard 
              title={t('avgLoss')}
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
        </>
      )}
    </div>
  );
}

// Day View Component
function DayView({ day, trades, onBack, t }) {
  const pnlUsd = trades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
  const totalR = trades.reduce((s, t) => s + (t.r_multiple || 0), 0);
  const wins = trades.filter(t => (t.pnl_usd || 0) > 0).length;
  const winrate = trades.length > 0 ? ((wins / trades.length) * 100).toFixed(0) : 0;
  
  const avgEmotion = trades.filter(t => t.emotional_state).length > 0
    ? (trades.filter(t => t.emotional_state).reduce((s, t) => s + t.emotional_state, 0) / 
       trades.filter(t => t.emotional_state).length).toFixed(1)
    : '-';
  
  const ruleCompliance = trades.length > 0
    ? ((trades.filter(t => t.rule_compliance).length / trades.length) * 100).toFixed(0)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onBack} className="text-[#888]">
          <ChevronLeft className="w-5 h-5 mr-1" />
          Назад к неделе
        </Button>
        <div>
          <h2 className="text-xl font-bold text-[#c0c0c0]">{format(day, 'EEEE, MMMM d')}</h2>
          <p className="text-[#666] text-sm">{trades.length} сделок</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatsCard title="PNL" value={`${pnlUsd >= 0 ? '+' : ''}$${pnlUsd.toFixed(2)}`} />
        <StatsCard title="R" value={`${totalR >= 0 ? '+' : ''}${totalR.toFixed(2)}R`} />
        <StatsCard title={t('winrate')} value={`${winrate}%`} />
        <StatsCard title="Эмоции" value={`${avgEmotion}/10`} />
        <StatsCard title="Дисциплина" value={`${ruleCompliance}%`} />
      </div>

      {trades.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {trades.map(trade => (
            <TradeCard key={trade.id} trade={trade} onClick={() => {}} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-[#666]">Нет сделок в этот день</div>
      )}
    </div>
  );
}

import TradeCard from '../components/trades/TradeCard';