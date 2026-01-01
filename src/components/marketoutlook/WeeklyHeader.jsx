import { TrendingUp, Target, Calendar, CheckCircle, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function WeeklyHeader({ currentWeek, weeklyOutlooks, weekLabel, isCurrentWeek, onUpdateWeek }) {
  // Calculate completion based on filled fields (>20% required for complete)
  const calculateCurrentWeekCompletion = () => {
    if (!currentWeek) return 0;
    const fields = [
      'btc_analysis', 'overall_trend', 'news_events', 'expectations_week', 
      'expectations_month', 'key_levels', 'setups_to_trade', 'risk_plan'
    ];
    const filledFields = fields.filter(field => currentWeek[field] && currentWeek[field].length > 0).length;
    return (filledFields / fields.length) * 100;
  };

  const currentWeekCompletion = calculateCurrentWeekCompletion();
  const isCurrentWeekComplete = currentWeekCompletion > 20;
  
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
          <div className="flex items-center gap-2">
            {isCurrentWeek && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-violet-500/20 text-violet-400 rounded-full text-xs font-medium">
                <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
                Active
              </span>
            )}
            {isCurrentWeekComplete ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-medium">
                <CheckCircle className="w-3 h-3" />
                Complete
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium">
                {currentWeekCompletion.toFixed(0)}% filled
              </span>
            )}
          </div>
        </div>

        {/* Market Bias - Interactive */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Icon className={cn("w-5 h-5", text)} />
            <span className="text-[#888] text-sm font-medium uppercase tracking-wider">Market Bias</span>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <Select 
              value={trend} 
              onValueChange={(value) => onUpdateWeek({ overall_trend: value })}
            >
              <SelectTrigger className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] w-32 h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Bull">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span>Bull</span>
                  </div>
                </SelectItem>
                <SelectItem value="Bear">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-red-400" />
                    <span>Bear</span>
                  </div>
                </SelectItem>
                <SelectItem value="Range">
                  <div className="flex items-center gap-2">
                    <Minus className="w-4 h-4 text-amber-400" />
                    <span>Range</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <Select 
              value={currentWeek?.trend_timeframe || '1D'} 
              onValueChange={(value) => onUpdateWeek({ trend_timeframe: value })}
            >
              <SelectTrigger className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] w-24 h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1H">1 Hour</SelectItem>
                <SelectItem value="4H">4 Hours</SelectItem>
                <SelectItem value="1D">1 Day</SelectItem>
                <SelectItem value="1W">1 Week</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Completion Rate - All Weeks */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-cyan-400" />
            <span className="text-[#888] text-sm font-medium uppercase tracking-wider">Completion Rate</span>
          </div>
          <div className="text-lg text-[#888] mb-1">
            All weeks: <span className="text-[#c0c0c0] font-bold">{completionRate.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-[#0d0d0d] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-500"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <div className="text-xs text-[#666] mt-1">
            {completedWeeks} / {totalWeeks} weeks completed
          </div>
        </div>
      </div>
    </div>
  );
}