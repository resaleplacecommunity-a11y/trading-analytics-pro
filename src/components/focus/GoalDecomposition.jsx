import { AlertTriangle, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function GoalDecomposition({ goal, onAdjust }) {
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

  return (
    <div className="space-y-6">
      {/* Wisdom Quote */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-l-4 border-amber-500/50 rounded-lg p-4">
        <p className="text-[#c0c0c0] italic text-sm">
          "Fast is slow. Slow is smooth. Smooth is fast."
        </p>
        <p className="text-[#666] text-xs mt-1">Быстро — это медленно, но стабильно.</p>
      </div>

      {/* Decomposition Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {periods.map(({ label, profit, percent }) => (
          <div key={label} className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-xl border border-[#2a2a2a]/50 p-4">
            <div className="text-[#666] text-xs uppercase tracking-wider mb-2">{label}</div>
            <div className="text-[#c0c0c0] text-xl font-bold">+${profit.toFixed(0)}</div>
            <div className={cn(
              "text-sm font-medium mt-1",
              percent > 60 ? "text-red-400" : percent > 30 ? "text-amber-400" : "text-emerald-400"
            )}>
              {percent.toFixed(1)}%
            </div>
          </div>
        ))}
      </div>

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
            <div className="bg-[#111]/50 rounded-lg border border-emerald-500/30 p-4">
              <div className="text-emerald-400 font-bold text-sm mb-1">Conservative</div>
              <div className="text-[#c0c0c0] text-lg">10-15%</div>
              <div className="text-[#666] text-xs">per month</div>
            </div>
            <div className="bg-[#111]/50 rounded-lg border border-amber-500/30 p-4">
              <div className="text-amber-400 font-bold text-sm mb-1">Risky</div>
              <div className="text-[#c0c0c0] text-lg">15-30%</div>
              <div className="text-[#666] text-xs">per month</div>
            </div>
            <div className="bg-[#111]/50 rounded-lg border border-red-500/30 p-4">
              <div className="text-red-400 font-bold text-sm mb-1">Aggressive</div>
              <div className="text-[#c0c0c0] text-lg">30-60%</div>
              <div className="text-[#666] text-xs">per month • Experts only</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}