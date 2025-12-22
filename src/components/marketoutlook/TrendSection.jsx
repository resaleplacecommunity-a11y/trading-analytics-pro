import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export default function TrendSection({ data, onChange }) {
  const trends = [
    { value: 'Bull', icon: TrendingUp, color: 'emerald' },
    { value: 'Range', icon: Minus, color: 'amber' },
    { value: 'Bear', icon: TrendingDown, color: 'red' }
  ];

  const timeframes = ['1D', '4H', '1H'];

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-xl border border-[#2a2a2a]/50 p-6">
      <h3 className="text-lg font-bold text-[#c0c0c0] mb-6">Overall Trend</h3>

      <div className="space-y-4">
        <div>
          <div className="text-xs text-[#888] uppercase tracking-wider mb-3">Bias</div>
          <div className="grid grid-cols-3 gap-3">
            {trends.map(({ value, icon: Icon, color }) => (
              <button
                key={value}
                onClick={() => onChange({ overall_trend: value })}
                className={cn(
                  "p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2",
                  data?.overall_trend === value
                    ? `bg-${color}-500/20 border-${color}-500/50`
                    : "bg-[#111]/50 border-[#2a2a2a] hover:border-[#c0c0c0]/30"
                )}
              >
                <Icon className={cn(
                  "w-5 h-5",
                  data?.overall_trend === value ? `text-${color}-400` : "text-[#666]"
                )} />
                <span className={cn(
                  "text-sm font-medium",
                  data?.overall_trend === value ? `text-${color}-400` : "text-[#888]"
                )}>
                  {value}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs text-[#888] uppercase tracking-wider mb-3">Timeframe</div>
          <div className="flex gap-2">
            {timeframes.map(tf => (
              <button
                key={tf}
                onClick={() => onChange({ trend_timeframe: tf })}
                className={cn(
                  "px-4 py-2 rounded-lg font-medium text-sm transition-all",
                  data?.trend_timeframe === tf
                    ? "bg-violet-500/20 text-violet-400 border-2 border-violet-500/50"
                    : "bg-[#111] text-[#888] border border-[#2a2a2a] hover:border-[#c0c0c0]/30"
                )}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}