import { useState, useEffect } from "react";
import { Brain, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Zap, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { detectRevengeTrades } from '../analytics/RevengeTradingDetector';

export default function PsychologyInsights({ trades, profiles, userTimezone = 'UTC' }) {
  const [insights, setInsights] = useState(null);

  useEffect(() => {
    if (!trades || trades.length === 0) return;

    const closedTrades = trades.filter(t => t.close_price);
    const last30 = closedTrades.slice(0, 30);

    if (last30.length < 5) return;

    // Analyze emotional state correlation with PNL (ONLY trades with emotional_state set)
    const highEmotionTrades = last30.filter(t => t.emotional_state && t.emotional_state >= 7);
    const lowEmotionTrades = last30.filter(t => t.emotional_state && t.emotional_state <= 3);
    const normalEmotionTrades = last30.filter(t => t.emotional_state && t.emotional_state > 3 && t.emotional_state < 7);

    const avgPnlHigh = highEmotionTrades.length > 0 
      ? highEmotionTrades.reduce((sum, t) => sum + (t.pnl_usd || 0), 0) / highEmotionTrades.length 
      : null;
    const avgPnlLow = lowEmotionTrades.length > 0 
      ? lowEmotionTrades.reduce((sum, t) => sum + (t.pnl_usd || 0), 0) / lowEmotionTrades.length 
      : null;
    const avgPnlNormal = normalEmotionTrades.length > 0 
      ? normalEmotionTrades.reduce((sum, t) => sum + (t.pnl_usd || 0), 0) / normalEmotionTrades.length 
      : null;

    // Analyze winning/losing streaks (using BE threshold: |pnl| > $0.5)
    const streaks = [];
    let currentStreak = { type: null, count: 0 };
    
    last30.forEach(trade => {
      const pnl = trade.pnl_usd || 0;
      const isWin = pnl > 0.5;
      const isLoss = pnl < -0.5;
      
      if (Math.abs(pnl) <= 0.5) return; // Skip BE trades
      
      if (currentStreak.type === null) {
        currentStreak = { type: isWin ? 'win' : 'loss', count: 1 };
      } else if ((currentStreak.type === 'win') === isWin) {
        currentStreak.count++;
      } else {
        streaks.push({ ...currentStreak });
        currentStreak = { type: isWin ? 'win' : 'loss', count: 1 };
      }
    });
    if (currentStreak.count > 0) streaks.push(currentStreak);

    const longestWinStreak = Math.max(...streaks.filter(s => s.type === 'win').map(s => s.count), 0);
    const longestLossStreak = Math.max(...streaks.filter(s => s.type === 'loss').map(s => s.count), 0);

    // Use centralized revenge trading detector
    const revengeTrades = detectRevengeTrades(trades, userTimezone);
    const revengeTradesCount = revengeTrades.length;
    const avgRevengePnl = revengeTrades.length > 0 
      ? revengeTrades.reduce((s, rt) => s + rt.pnl, 0) / revengeTrades.length 
      : 0;

    // Best emotional state (only if we have data)
    let bestState = 'unknown';
    const validStates = [
      { state: 'high', avg: avgPnlHigh },
      { state: 'normal', avg: avgPnlNormal },
      { state: 'low', avg: avgPnlLow }
    ].filter(s => s.avg !== null);

    if (validStates.length > 0) {
      bestState = validStates.sort((a, b) => b.avg - a.avg)[0].state;
    }

    setInsights({
      bestState,
      avgPnlHigh,
      avgPnlLow,
      avgPnlNormal,
      highCount: highEmotionTrades.length,
      lowCount: lowEmotionTrades.length,
      normalCount: normalEmotionTrades.length,
      longestWinStreak,
      longestLossStreak,
      revengeTradesCount,
      avgRevengePnl
    });
  }, [trades, userTimezone]);

  if (!insights) {
    return (
      <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-xl border border-[#2a2a2a]/50 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-bold text-[#c0c0c0]">Psychology Insights</h3>
        </div>
        <p className="text-[#666] text-sm">Not enough data yet. Keep trading to see insights.</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-cyan-500/20 via-cyan-500/10 to-[#0d0d0d] backdrop-blur-sm rounded-xl border-2 border-cyan-500/30 p-6">
      <div className="flex items-center gap-2 mb-6">
        <Brain className="w-5 h-5 text-cyan-400" />
        <h3 className="text-lg font-bold text-[#c0c0c0]">Psychology Insights</h3>
        <span className="ml-auto text-xs text-[#666]">Based on last 30 trades</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Emotional State Analysis */}
        <div className="bg-[#111]/50 rounded-xl border border-[#2a2a2a] p-4">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-bold text-[#c0c0c0]">Emotional State Impact</h4>
          </div>
          
          <div className="space-y-3">
            {insights.avgPnlHigh !== null && (
              <div className={cn(
                "p-3 rounded-lg border-2",
                insights.bestState === 'high' ? "border-emerald-500/50 bg-emerald-500/10" : "border-[#2a2a2a]"
              )}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[#888] text-xs">High Energy (7-10)</span>
                  {insights.bestState === 'high' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                </div>
                <div className={cn(
                  "text-xl font-bold",
                  insights.avgPnlHigh >= 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  {insights.avgPnlHigh >= 0 ? '+' : ''}${insights.avgPnlHigh.toFixed(0)}
                </div>
                <div className="text-[#666] text-xs">avg ({insights.highCount} trades)</div>
              </div>
            )}

            {insights.avgPnlNormal !== null && (
              <div className={cn(
                "p-3 rounded-lg border-2",
                insights.bestState === 'normal' ? "border-emerald-500/50 bg-emerald-500/10" : "border-[#2a2a2a]"
              )}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[#888] text-xs">Neutral (4-6)</span>
                  {insights.bestState === 'normal' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                </div>
                <div className={cn(
                  "text-xl font-bold",
                  insights.avgPnlNormal >= 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  {insights.avgPnlNormal >= 0 ? '+' : ''}${insights.avgPnlNormal.toFixed(0)}
                </div>
                <div className="text-[#666] text-xs">avg ({insights.normalCount} trades)</div>
              </div>
            )}

            {insights.avgPnlLow !== null && (
              <div className={cn(
                "p-3 rounded-lg border-2",
                insights.bestState === 'low' ? "border-emerald-500/50 bg-emerald-500/10" : "border-[#2a2a2a]"
              )}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[#888] text-xs">Low Energy (1-3)</span>
                  {insights.bestState === 'low' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                </div>
                <div className={cn(
                  "text-xl font-bold",
                  insights.avgPnlLow >= 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  {insights.avgPnlLow >= 0 ? '+' : ''}${insights.avgPnlLow.toFixed(0)}
                </div>
                <div className="text-[#666] text-xs">avg ({insights.lowCount} trades)</div>
              </div>
            )}

            {insights.avgPnlHigh === null && insights.avgPnlNormal === null && insights.avgPnlLow === null && (
              <div className="p-3 bg-[#111]/50 border border-[#2a2a2a] rounded-lg text-center">
                <div className="text-[#666] text-xs">No emotional state data available</div>
              </div>
            )}
          </div>

          {insights.bestState !== 'unknown' && (
            <div className="mt-4 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
              <p className="text-cyan-400 text-xs font-medium">
                {insights.bestState === 'high' && "You perform best when energized!"}
                {insights.bestState === 'normal' && "You perform best when calm and neutral."}
                {insights.bestState === 'low' && "You perform best when relaxed."}
              </p>
            </div>
          )}
        </div>

        {/* Streaks & Behavior */}
        <div className="space-y-4">
          {/* Streaks */}
          <div className="bg-[#111]/50 rounded-xl border border-[#2a2a2a] p-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h4 className="text-sm font-bold text-[#c0c0c0]">Streaks</h4>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <div className="text-3xl font-bold text-emerald-400 mb-1">{insights.longestWinStreak}</div>
                <div className="text-[#666] text-xs">Longest Win Streak</div>
              </div>
              <div className="text-center p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="text-3xl font-bold text-red-400 mb-1">{insights.longestLossStreak}</div>
                <div className="text-[#666] text-xs">Longest Loss Streak</div>
              </div>
            </div>
          </div>

          {/* Revenge Trading */}
          <div className="bg-[#111]/50 rounded-xl border border-[#2a2a2a] p-4">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h4 className="text-sm font-bold text-[#c0c0c0]">Revenge Trading</h4>
            </div>
            
            <div className="text-center mb-3">
              <div className="text-3xl font-bold text-[#c0c0c0] mb-1">{insights.revengeTradesCount}</div>
              <div className="text-[#666] text-xs">Trades within 30min after loss</div>
            </div>

            {insights.revengeTradesCount > 0 && (
              <div className={cn(
                "p-3 rounded-lg border",
                insights.avgRevengePnl < 0 
                  ? "bg-red-500/10 border-red-500/30" 
                  : "bg-emerald-500/10 border-emerald-500/30"
              )}>
                <div className="text-center">
                  <div className={cn(
                    "text-xl font-bold",
                    insights.avgRevengePnl >= 0 ? "text-emerald-400" : "text-red-400"
                  )}>
                    {insights.avgRevengePnl >= 0 ? '+' : ''}${insights.avgRevengePnl.toFixed(0)}
                  </div>
                  <div className="text-[#666] text-xs">avg PNL per revenge trade</div>
                </div>
              </div>
            )}

            {insights.revengeTradesCount === 0 && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <p className="text-emerald-400 text-xs font-medium text-center">
                  Great discipline! No revenge trading detected.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}