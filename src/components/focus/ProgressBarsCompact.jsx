import { TrendingUp, Calendar, Award } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ProgressBarsCompact({ goal, actualPnl }) {
  if (!goal) return null;

  const mode = goal.mode;
  const baseCapital = mode === 'personal' ? goal.current_capital_usd : goal.prop_account_size_usd;
  
  let netTarget;
  if (mode === 'personal') {
    netTarget = goal.target_capital_usd - goal.current_capital_usd;
  } else {
    netTarget = (goal.target_capital_usd + goal.prop_fee_usd) / (goal.profit_split_percent / 100);
  }

  const totalDays = goal.time_horizon_days || 180;
  const profitPerDay = netTarget / totalDays;
  const profitPerWeek = profitPerDay * 7;
  const profitPerMonth = profitPerDay * 30;

  const percentPerDay = (profitPerDay / baseCapital) * 100;
  const percentPerWeek = (profitPerWeek / baseCapital) * 100;
  const percentPerMonth = (profitPerMonth / baseCapital) * 100;

  const progressDay = Math.min((actualPnl.day / profitPerDay) * 100, 200);
  const progressWeek = Math.min((actualPnl.week / profitPerWeek) * 100, 200);
  const progressMonth = Math.min((actualPnl.month / profitPerMonth) * 100, 200);

  const periods = [
    { label: 'Daily', icon: TrendingUp, required: profitPerDay, requiredPct: percentPerDay, actual: actualPnl.day, progress: progressDay, color: 'emerald' },
    { label: 'Weekly', icon: Calendar, required: profitPerWeek, requiredPct: percentPerWeek, actual: actualPnl.week, progress: progressWeek, color: 'blue' },
    { label: 'Monthly', icon: Award, required: profitPerMonth, requiredPct: percentPerMonth, actual: actualPnl.month, progress: progressMonth, color: 'violet' }
  ];

  return (
    <div className="grid grid-cols-1 gap-4">
      {periods.map(({ label, icon: Icon, required, requiredPct, actual, progress, color }) => (
        <div key={label} className="bg-[#111]/50 rounded-xl border border-[#2a2a2a] p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Icon className={cn("w-5 h-5", `text-${color}-400`)} />
              <span className="text-[#c0c0c0] font-bold">{label}</span>
            </div>
            <div className="text-right">
              <div className={cn(
                "text-lg font-bold",
                actual >= required ? "text-emerald-400" : "text-amber-400"
              )}>
                ${actual.toFixed(0)}
              </div>
            </div>
          </div>

          {/* Required Info */}
          <div className="bg-[#0d0d0d] rounded-lg p-3 mb-3">
            <div className="text-[#666] text-xs uppercase tracking-wider mb-1">Target</div>
            <div className="flex items-baseline gap-2">
              <span className="text-[#c0c0c0] text-xl font-bold">${required.toFixed(0)}</span>
              <span className={cn(
                "text-sm font-medium",
                requiredPct > 30 ? "text-red-400" : requiredPct > 15 ? "text-amber-400" : "text-emerald-400"
              )}>
                ({requiredPct.toFixed(1)}%)
              </span>
            </div>
          </div>
          
          <div className="h-3 bg-[#0d0d0d] rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-500",
                progress >= 100 ? `bg-gradient-to-r from-${color}-500 to-${color}-400` : "bg-gradient-to-r from-amber-500 to-amber-400"
              )}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          
          <div className="text-right mt-2">
            <span className={cn(
              "text-xs font-bold",
              progress >= 100 ? "text-emerald-400" : progress >= 50 ? "text-amber-400" : "text-red-400"
            )}>
              {progress.toFixed(0)}% complete
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}