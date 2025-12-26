import { TrendingUp, Target, Calendar, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function WeeklyHeader({ currentWeek, weeklyOutlooks, weekLabel, isCurrentWeek }) {
  const completedWeeks = weeklyOutlooks.filter(w => w.status === 'completed').length;
  const totalWeeks = weeklyOutlooks.length;
  const completionRate = totalWeeks > 0 ? (completedWeeks / totalWeeks) * 100 : 0;

  const trend = currentWeek?.overall_trend || 'Range';
  const trendColors = {
    Bull: { bg: 'from-emerald-500/20 via-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', icon: TrendingUp },
    Bear: { bg: 'from-red-500/20 via-red-500/10', border: 'border-red-500/30', text: 'text-red-400', icon: TrendingUp },
    Range: { bg: 'from-amber-500/20 via-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', icon: Target }
  };

  const { bg, border, text, icon: Icon } = trendColors[trend];

  return (
    <div className={cn("relative overflow-hidden bg-gradient-to-br", bg, "to-[#0d0d0d] backdrop-blur-sm rounded-2xl border-2", border, "p-8")}>
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-radial from-white/5 to-transparent blur-3xl" />
      
      <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Week Status */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Calendar className={cn("w-5 h-5", text)} />
            <span className="text-[#888] text-sm font-medium uppercase tracking-wider">Current Week</span>
          </div>
          <div className="text-2xl font-bold text-[#c0c0c0] mb-2">{weekLabel}</div>
          {isCurrentWeek && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-violet-500/20 text-violet-400 rounded-full text-xs font-medium">
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
              Active
            </span>
          )}
          {currentWeek?.status === 'completed' && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-medium">
              <CheckCircle className="w-3 h-3" />
              Completed
            </span>
          )}
        </div>

        {/* Market Bias */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Icon className={cn("w-5 h-5", text)} />
            <span className="text-[#888] text-sm font-medium uppercase tracking-wider">Market Bias</span>
          </div>
          <div className={cn("text-3xl font-bold", text)}>{trend}</div>
          <div className="text-[#666] text-sm mt-1">{currentWeek?.trend_timeframe || '1D'} timeframe</div>
        </div>

        {/* Completion Stats */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-cyan-400" />
            <span className="text-[#888] text-sm font-medium uppercase tracking-wider">Completion Rate</span>
          </div>
          <div className="text-3xl font-bold text-[#c0c0c0] mb-2">{completionRate.toFixed(0)}%</div>
          <div className="h-2 bg-[#0d0d0d] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-500"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}