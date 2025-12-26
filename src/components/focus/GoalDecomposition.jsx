import { useState, useEffect } from "react";
import { AlertTriangle, TrendingUp, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function GoalDecomposition({ goal, onAdjust, onStrategySelect }) {
  const [isVisible, setIsVisible] = useState(false);
  const [showOnce, setShowOnce] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState(null);

  useEffect(() => {
    // Show only once when goal is set and unrealistic
    if (goal && !showOnce) {
      const mode = goal.mode;
      const baseCapital = mode === 'personal' ? goal.current_capital_usd : goal.prop_account_size_usd;
      let netTarget;
      if (mode === 'personal') {
        netTarget = goal.target_capital_usd - goal.current_capital_usd;
      } else {
        netTarget = (goal.target_capital_usd + goal.prop_fee_usd) / (goal.profit_split_percent / 100);
      }
      const totalDays = goal.time_horizon_days || 180;
      const profitPerMonth = (netTarget / totalDays) * 30;
      const percentPerMonth = (profitPerMonth / baseCapital) * 100;
      
      if (percentPerMonth > 60) {
        setIsVisible(true);
        setShowOnce(true);
      }
    }
  }, [goal, showOnce]);
  if (!goal) return null;

  const mode = goal.mode;
  const baseCapital = mode === 'personal' ? goal.current_capital_usd : goal.prop_account_size_usd;
  
  // Calculate net target
  let netTarget;
  if (mode === 'personal') {
    netTarget = goal.target_capital_usd - goal.current_capital_usd;
  } else {
    // Prop: need to earn enough so that (profit * split) - fee = target
    netTarget = (goal.target_capital_usd + goal.prop_fee_usd) / (goal.profit_split_percent / 100);
  }

  const totalDays = goal.time_horizon_days || 180;
  
  // Decomposition
  const profitPerDay = netTarget / totalDays;
  const profitPerWeek = profitPerDay * 7;
  const profitPerMonth = profitPerDay * 30;
  const profitPerYear = profitPerDay * 365;

  const percentPerDay = (profitPerDay / baseCapital) * 100;
  const percentPerWeek = (profitPerWeek / baseCapital) * 100;
  const percentPerMonth = (profitPerMonth / baseCapital) * 100;
  const percentPerYear = (profitPerYear / baseCapital) * 100;

  const isUnrealistic = percentPerMonth > 60;

  const periods = [
    { label: 'Day', profit: profitPerDay, percent: percentPerDay },
    { label: 'Week', profit: profitPerWeek, percent: percentPerWeek },
    { label: 'Month', profit: profitPerMonth, percent: percentPerMonth },
    { label: 'Year', profit: profitPerYear, percent: percentPerYear }
  ];

  if (!isUnrealistic || !isVisible) return null;

  return (
    <div className="space-y-6">
      {/* Unrealistic Warning */}
      {isUnrealistic && (
        <div className="bg-gradient-to-r from-red-500/20 via-red-500/10 to-transparent border-2 border-red-500/50 rounded-xl p-6">
          <div className="flex items-start gap-4 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
            <div>
              <h4 className="text-red-400 font-bold mb-1">Expectations Extremely High</h4>
              <p className="text-[#888] text-sm">
                Your goal requires {percentPerMonth.toFixed(1)}% per month. We recommend extending the timeline to stay consistent and reduce risk.
              </p>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <Button
              onClick={() => onAdjust(90)}
              size="sm"
              variant="outline"
              className="bg-[#111] border-[#2a2a2a] text-[#888] hover:text-[#c0c0c0]"
            >
              +3 months
            </Button>
            <Button
              onClick={() => onAdjust(180)}
              size="sm"
              variant="outline"
              className="bg-[#111] border-[#2a2a2a] text-[#888] hover:text-[#c0c0c0]"
            >
              +6 months
            </Button>
            <Button
              onClick={() => onAdjust(365)}
              size="sm"
              variant="outline"
              className="bg-[#111] border-[#2a2a2a] text-[#888] hover:text-[#c0c0c0]"
            >
              +12 months
            </Button>
          </div>

          {/* Strategy Profiles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              onClick={() => {
                setSelectedStrategy('conservative');
                onStrategySelect?.('conservative');
              }}
              className="bg-[#111]/50 rounded-lg border border-emerald-500/30 p-4 hover:bg-emerald-500/10 transition-colors text-left"
            >
              <div className="text-emerald-400 font-bold text-sm mb-1">Conservative</div>
              <div className="text-[#c0c0c0] text-lg">10-15%</div>
              <div className="text-[#666] text-xs">per month</div>
            </button>
            <button
              onClick={() => {
                setSelectedStrategy('risky');
                onStrategySelect?.('risky');
              }}
              className="bg-[#111]/50 rounded-lg border border-amber-500/30 p-4 hover:bg-amber-500/10 transition-colors text-left"
            >
              <div className="text-amber-400 font-bold text-sm mb-1">Risky</div>
              <div className="text-[#c0c0c0] text-lg">15-30%</div>
              <div className="text-[#666] text-xs">per month</div>
            </button>
            <button
              onClick={() => {
                setSelectedStrategy('aggressive');
                onStrategySelect?.('aggressive');
              }}
              className="bg-[#111]/50 rounded-lg border border-red-500/30 p-4 hover:bg-red-500/10 transition-colors text-left"
            >
              <div className="text-red-400 font-bold text-sm mb-1">Aggressive</div>
              <div className="text-[#c0c0c0] text-lg">30-60%</div>
              <div className="text-[#666] text-xs">per month • Experts only</div>
            </button>
          </div>
          
          {/* Coming Soon Message */}
          {selectedStrategy && (
            <div className="mt-6 bg-gradient-to-r from-violet-500/20 via-violet-500/10 to-transparent border border-violet-500/30 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <Sparkles className="w-6 h-6 text-violet-400 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="text-violet-400 font-bold mb-2">Personalized Strategy Coming Soon</h4>
                  <p className="text-[#888] text-sm">
                    We're building an AI-powered system that will analyze your trading history and create a fully personalized strategy tailored to your strengths, weaknesses, and goals. Stay tuned!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}