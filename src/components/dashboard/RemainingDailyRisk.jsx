import { TrendingDown } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function RemainingDailyRisk({ riskSettings, todayLossPercent = 0, balance = 0 }) {
  const limit = riskSettings?.daily_max_loss_percent ?? null;
  const usedPercent = Math.abs(Math.min(0, todayLossPercent));
  const fillPercent = limit ? Math.min(100, (usedPercent / limit) * 100) : 0;
  const remainingPercent = limit != null ? Math.max(0, limit - usedPercent) : null;
  const remainingUsd = remainingPercent != null ? (remainingPercent / 100) * balance : null;

  const isNear = fillPercent >= 80;
  const isAt = fillPercent >= 100;
  const barColor = isAt ? 'bg-red-500' : isNear ? 'bg-amber-500' : 'bg-emerald-500';
  const textColor = isAt ? 'text-red-400' : isNear ? 'text-amber-400' : 'text-emerald-400';

  return (
    <div className={cn(
      "rounded-xl border p-4",
      isAt ? "bg-red-500/5 border-red-500/30" :
      isNear ? "bg-amber-500/5 border-amber-500/30" :
      "bg-[#111]/60 border-[#2a2a2a]/60"
    )}>
      <div className="flex items-center gap-2 mb-3">
        <TrendingDown className={cn("w-4 h-4", isAt ? "text-red-400" : isNear ? "text-amber-400" : "text-[#888]")} />
        <span className="text-sm font-semibold text-[#c0c0c0]">Daily Risk Budget</span>
      </div>

      {limit == null ? (
        <p className="text-xs text-[#555]">No daily loss limit configured. Set one in Risk Manager.</p>
      ) : (
        <>
          <div className="flex items-end justify-between mb-2">
            <div>
              <span className={cn("text-xl font-bold", textColor)}>{remainingPercent?.toFixed(1)}%</span>
              <span className="text-xs text-[#666] ml-1">remaining</span>
              {remainingUsd != null && (
                <div className="text-xs text-[#555] mt-0.5">≈ ${Math.round(remainingUsd).toLocaleString()}</div>
              )}
            </div>
            <div className="text-right text-xs text-[#555]">
              <div>Used {usedPercent.toFixed(1)}%</div>
              <div>Limit {limit}%</div>
            </div>
          </div>
          <div className="w-full bg-[#1a1a1a] rounded-full h-1.5">
            <div className={cn("h-1.5 rounded-full transition-all", barColor)} style={{ width: `${fillPercent}%` }} />
          </div>
        </>
      )}
    </div>
  );
}