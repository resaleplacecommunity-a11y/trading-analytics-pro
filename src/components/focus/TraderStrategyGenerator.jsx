import { useEffect, useState } from "react";
import { AlertTriangle, TrendingUp, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function TraderStrategyGenerator({ goal, trades, onAdjust }) {
  const [analysis, setAnalysis] = useState(null);

  useEffect(() => {
    if (!goal || !trades) return;

    const closedTrades = trades.filter(t => t.close_price);
    const last30 = closedTrades.slice(0, 30);

    if (last30.length >= 30) {
      // Calculate actual metrics
      const totalDays = Math.max(1, Math.ceil((new Date() - new Date(last30[last30.length - 1].date_open)) / (1000 * 60 * 60 * 24)));
      const tradesPerDay = last30.length / totalDays;
      const wins = last30.filter(t => (t.pnl_usd || 0) > 0).length;
      const winrate = (wins / last30.length) * 100;
      const avgR = last30.reduce((sum, t) => sum + (t.r_multiple || 0), 0) / last30.length;
      const avgRisk = last30.reduce((sum, t) => sum + (t.risk_percent || 2), 0) / last30.length;
      const avgPnlPerTrade = last30.reduce((sum, t) => sum + (t.pnl_usd || 0), 0) / last30.length;
      const avgRR = last30.reduce((sum, t) => sum + (t.rr_ratio || 2), 0) / last30.length;

      setAnalysis({
        hasData: true,
        tradesPerDay: tradesPerDay.toFixed(1),
        winrate: winrate.toFixed(1),
        avgR: avgR.toFixed(2),
        avgRisk: avgRisk.toFixed(2),
        avgPnlPerTrade: avgPnlPerTrade.toFixed(0),
        avgRR: avgRR.toFixed(1)
      });
    } else {
      // Default recommendations
      const mode = goal.mode;
      setAnalysis({
        hasData: false,
        tradesPerDay: 3,
        winrate: 50,
        avgR: 1.5,
        avgRisk: mode === 'prop' ? 0.5 : 2,
        avgRR: 3
      });
    }
  }, [goal, trades]);

  if (!analysis || !goal) return null;

  const mode = goal.mode;
  const baseCapital = mode === 'personal' ? goal.current_capital_usd : goal.prop_account_size_usd;
  
  let netTarget;
  if (mode === 'personal') {
    netTarget = goal.target_capital_usd - goal.current_capital_usd;
  } else {
    netTarget = (goal.target_capital_usd + goal.prop_fee_usd) / (goal.profit_split_percent / 100);
  }

  const totalDays = goal.time_horizon_days || 180;
  const tradingDays = totalDays * 0.75;
  
  // Required metrics
  const requiredProfitPerDay = netTarget / tradingDays;
  const requiredProfitPerTrade = requiredProfitPerDay / analysis.tradesPerDay;
  const requiredRPerTrade = requiredProfitPerTrade / (baseCapital * (analysis.avgRisk / 100));
  const requiredRPerWeek = requiredRPerTrade * analysis.tradesPerDay * 7;
  const requiredRPerMonth = requiredRPerWeek * 4;

  // Check if realistic
  const unrealistic = 
    analysis.winrate > 70 ||
    analysis.tradesPerDay > 10 ||
    analysis.avgRisk > 3 ||
    requiredRPerTrade > 5;

  return (
    <div className="bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-[#0d0d0d] backdrop-blur-sm rounded-2xl border-2 border-blue-500/30 p-6">
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp className="w-5 h-5 text-blue-400" />
        <h3 className="text-lg font-bold text-[#c0c0c0]">Recommended Strategy</h3>
      </div>
      <p className="text-[#888] text-xs mb-6">Calculated to achieve your goal</p>

      {!analysis.hasData && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
          <p className="text-amber-400 text-sm font-medium">
            Less than 30 trades available. Showing default recommended plan.
          </p>
        </div>
      )}

      {/* Current/Recommended Metrics */}
      <div className="flex gap-3 mb-6 overflow-x-auto">
        <div className="bg-[#111]/50 rounded-lg border border-[#2a2a2a] p-3 min-w-[100px]">
          <div className="text-[#666] text-xs uppercase tracking-wider mb-1">Trades/Day</div>
          <div className="text-[#c0c0c0] text-lg font-bold">{analysis.tradesPerDay}</div>
        </div>
        <div className="bg-[#111]/50 rounded-lg border border-[#2a2a2a] p-3 min-w-[100px]">
          <div className="text-[#666] text-xs uppercase tracking-wider mb-1">Winrate</div>
          <div className="text-[#c0c0c0] text-lg font-bold">{analysis.winrate}%</div>
        </div>
        <div className="bg-[#111]/50 rounded-lg border border-[#2a2a2a] p-3 min-w-[100px]">
          <div className="text-[#666] text-xs uppercase tracking-wider mb-1">RR Ratio</div>
          <div className="text-[#c0c0c0] text-lg font-bold">1:{analysis.avgRR}</div>
        </div>
        <div className="bg-[#111]/50 rounded-lg border border-[#2a2a2a] p-3 min-w-[100px]">
          <div className="text-[#666] text-xs uppercase tracking-wider mb-1">Risk/Trade</div>
          <div className="text-[#c0c0c0] text-lg font-bold">{analysis.avgRisk}%</div>
        </div>
        {analysis.hasData && (
          <>
            <div className="bg-[#111]/50 rounded-lg border border-[#2a2a2a] p-3 min-w-[100px]">
              <div className="text-[#666] text-xs uppercase tracking-wider mb-1">Avg R</div>
              <div className="text-[#c0c0c0] text-lg font-bold">{analysis.avgR}R</div>
            </div>
            <div className="bg-[#111]/50 rounded-lg border border-[#2a2a2a] p-3 min-w-[100px]">
              <div className="text-[#666] text-xs uppercase tracking-wider mb-1">Avg PNL</div>
              <div className="text-[#c0c0c0] text-lg font-bold">${analysis.avgPnlPerTrade}</div>
            </div>
          </>
        )}
      </div>



      {/* Unrealistic Warning */}
      {unrealistic && (
        <div className="bg-gradient-to-r from-red-500/20 via-red-500/10 to-transparent border-2 border-red-500/50 rounded-xl p-6 mb-6">
          <div className="flex items-start gap-4 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
            <div>
              <h4 className="text-red-400 font-bold mb-1">Plan is Unlikely and Risky</h4>
              <p className="text-[#888] text-sm">
                We recommend adjusting your parameters (winrate, RR, risk per trade, trades per day, timeline).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-[#111]/50 rounded-lg border border-emerald-500/30 p-4">
              <div className="text-emerald-400 font-bold text-sm mb-1">Conservative</div>
              <div className="text-[#888] text-xs">WR: 50% • RR: 1:3 • Risk: 1.5%</div>
            </div>
            <div className="bg-[#111]/50 rounded-lg border border-amber-500/30 p-4">
              <div className="text-amber-400 font-bold text-sm mb-1">Risky</div>
              <div className="text-[#888] text-xs">WR: 55% • RR: 1:2.5 • Risk: 2%</div>
            </div>
            <div className="bg-[#111]/50 rounded-lg border border-red-500/30 p-4">
              <div className="text-red-400 font-bold text-sm mb-1">Aggressive</div>
              <div className="text-[#888] text-xs">WR: 60% • RR: 1:2 • Risk: 3%</div>
            </div>
          </div>
        </div>
      )}

      {analysis.hasData && !unrealistic && (
        <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <p className="text-emerald-400 text-sm font-medium">
            Your current trading parameters are realistic for this goal. Stay disciplined!
          </p>
        </div>
      )}
    </div>
  );
}