import { TrendingUp, Calendar, Award } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ProgressBars({ goal, actualPnl }) {
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

  const progressDay = Math.min((actualPnl.day / profitPerDay) * 100, 200);
  const progressWeek = Math.min((actualPnl.week / profitPerWeek) * 100, 200);
  const progressMonth = Math.min((actualPnl.month / profitPerMonth) * 100, 200);

  const periods = [
    { label: 'Daily', icon: TrendingUp, required: profitPerDay, actual: actualPnl.day, progress: progressDay },
    { label: 'Weekly', icon: Calendar, required: profitPerWeek, actual: actualPnl.week, progress: progressWeek },
    { label: 'Monthly', icon: Award, required: profitPerMonth, actual: actualPnl.month, progress: progressMonth }
  ];

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-xl border border-[#2a2a2a]/50 p-6">
      <h3 className="text-lg font-bold text-[#c0c0c0] mb-6">Progress Tracking</h3>
      
      <div className="space-y-6">
        {periods.map(({ label, icon: Icon, required, actual, progress }) => (
          <div key={label}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-violet-400" />
                <span className="text-[#888] text-sm font-medium">{label} Progress</span>
              </div>
              <div className="text-right">
                <span className={cn(
                  "text-sm font-bold",
                  actual >= required ? "text-emerald-400" : "text-amber-400"
                )}>
                  ${actual.toFixed(0)}
                </span>
                <span className="text-[#666] text-xs"> / ${required.toFixed(0)}</span>
              </div>
            </div>
            
            <div className="h-2 bg-[#111] rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-500",
                  progress >= 100 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" : "bg-gradient-to-r from-amber-500 to-amber-400"
                )}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            
            <div className="text-right mt-1">
              <span className={cn(
                "text-xs font-medium",
                progress >= 100 ? "text-emerald-400" : progress >= 50 ? "text-amber-400" : "text-red-400"
              )}>
                {progress.toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}