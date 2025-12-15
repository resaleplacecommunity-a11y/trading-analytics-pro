import { AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';
import { cn } from "@/lib/utils";
import { applyFilters } from './filterUtils';

const formatNumber = (num) => {
  if (num === undefined || num === null || num === '') return '—';
  const n = parseFloat(num);
  if (isNaN(n)) return '—';
  return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
};

export default function BehaviorDisciplineTab({ trades, filters, behaviorLogs }) {
  const filtered = applyFilters(trades, filters);
  const closedTrades = filtered.filter(t => t.close_price_final || t.close_price);

  // Auto-detect behavior events
  const behaviorEvents = [];

  closedTrades.forEach(trade => {
    // Over-risk detection
    const riskPct = trade.max_risk_pct || 0;
    if (riskPct > 3) {
      behaviorEvents.push({
        type: 'OVER_RISK',
        trade_id: trade.id,
        severity: riskPct > 5 ? 'high' : 'medium',
        description: `Risked ${riskPct.toFixed(1)}% on ${trade.coin?.replace('USDT', '')}`,
        timestamp: trade.date_open
      });
    }

    // Early exit detection
    if (trade.take_price && (trade.close_price_final || trade.close_price)) {
      const closePrice = trade.close_price_final || trade.close_price;
      const entryPrice = trade.entry_price;
      const takePrice = trade.take_price;
      const pnl = trade.pnl_total_usd || trade.pnl_usd || 0;
      
      let exitedEarly = false;
      if (trade.direction === 'Long') {
        exitedEarly = closePrice < takePrice && pnl > 0;
      } else {
        exitedEarly = closePrice > takePrice && pnl > 0;
      }
      
      if (exitedEarly) {
        behaviorEvents.push({
          type: 'CLOSE_EARLY',
          trade_id: trade.id,
          severity: 'medium',
          description: `Closed ${trade.coin?.replace('USDT', '')} before reaching TP`,
          timestamp: trade.date_close
        });
      }
    }

    // Widen SL detection
    try {
      const stopHistory = trade.stop_history ? JSON.parse(trade.stop_history) : [];
      if (stopHistory.length > 1) {
        for (let i = 1; i < stopHistory.length; i++) {
          const prev = stopHistory[i - 1].stop_price;
          const curr = stopHistory[i].stop_price;
          
          let widened = false;
          if (trade.direction === 'Long' && curr < prev) widened = true;
          if (trade.direction === 'Short' && curr > prev) widened = true;
          
          if (widened) {
            behaviorEvents.push({
              type: 'WIDEN_SL',
              trade_id: trade.id,
              severity: 'high',
              description: `Widened stop on ${trade.coin?.replace('USDT', '')}`,
              timestamp: stopHistory[i].timestamp
            });
          }
        }
      }
    } catch {}
  });

  // Count by type
  const eventCounts = {};
  behaviorEvents.forEach(e => {
    eventCounts[e.type] = (eventCounts[e.type] || 0) + 1;
  });

  // Top 5 issues
  const topIssues = Object.entries(eventCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Calculate discipline score (0-100)
  let disciplineScore = 100;

  // Penalties
  const overRiskCount = eventCounts['OVER_RISK'] || 0;
  const earlyExitCount = eventCounts['CLOSE_EARLY'] || 0;
  const widenSLCount = eventCounts['WIDEN_SL'] || 0;

  disciplineScore -= overRiskCount * 3;
  disciplineScore -= earlyExitCount * 2;
  disciplineScore -= widenSLCount * 5;

  disciplineScore = Math.max(0, Math.min(100, disciplineScore));

  // Rules compliance
  const totalRules = closedTrades.length * 3; // Assume 3 rules per trade
  const brokenRules = overRiskCount + earlyExitCount + widenSLCount;
  const ruleCompliancePct = totalRules > 0 ? ((totalRules - brokenRules) / totalRules * 100) : 100;

  return (
    <div className="space-y-4 mt-4">
      {/* Discipline Score */}
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-6 border border-[#2a2a2a]">
        <h3 className="text-[#c0c0c0] text-sm font-medium mb-4">Discipline Score</h3>
        <div className="flex items-center gap-6">
          <div className="flex-shrink-0">
            <div className={cn(
              "w-32 h-32 rounded-full flex items-center justify-center text-5xl font-black border-4",
              disciplineScore >= 80 ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" :
              disciplineScore >= 60 ? "bg-yellow-500/20 border-yellow-500 text-yellow-400" :
              "bg-red-500/20 border-red-500 text-red-400"
            )}>
              {disciplineScore}
            </div>
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#888]">Risk Compliance</span>
              <span className="text-sm font-bold text-[#c0c0c0]">
                {((closedTrades.length - overRiskCount) / Math.max(1, closedTrades.length) * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#888]">Plan Adherence</span>
              <span className="text-sm font-bold text-[#c0c0c0]">
                {((closedTrades.length - earlyExitCount) / Math.max(1, closedTrades.length) * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#888]">SL Integrity</span>
              <span className="text-sm font-bold text-[#c0c0c0]">
                {((closedTrades.length - widenSLCount) / Math.max(1, closedTrades.length) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Top 5 Issues */}
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
        <h3 className="text-[#c0c0c0] text-sm font-medium mb-4">Top Recurring Issues</h3>
        {topIssues.length > 0 ? (
          <div className="space-y-2">
            {topIssues.map(([type, count], i) => {
              const labels = {
                'OVER_RISK': 'Over-risking',
                'CLOSE_EARLY': 'Early exits',
                'WIDEN_SL': 'Widening stop loss',
                'REVENGE_TRADE': 'Revenge trading',
                'OVERTRADING': 'Overtrading'
              };
              
              return (
                <div key={type} className="bg-[#151515] rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-[#666]">#{i + 1}</span>
                    <span className="text-sm text-[#c0c0c0]">{labels[type] || type}</span>
                  </div>
                  <span className="text-lg font-bold text-red-400">{count}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle className="w-5 h-5" />
            <p className="text-sm">No discipline issues detected</p>
          </div>
        )}
      </div>
    </div>
  );
}