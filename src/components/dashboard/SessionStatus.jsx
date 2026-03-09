import { Shield, ShieldOff, AlertTriangle } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function SessionStatus({ violations = [], todayTradeCount = 0, maxTrades = null, lossStreak = 0, maxLossStreak = null, openTradeCount = 0, openExposureUsd = 0 }) {
  const isBlocked = violations.length > 0;

  const tiles = [
    {
      label: 'Trades Today',
      value: maxTrades ? `${todayTradeCount} / ${maxTrades}` : String(todayTradeCount),
      warn: maxTrades > 0 && todayTradeCount >= maxTrades,
    },
    {
      label: 'Loss Streak',
      value: maxLossStreak ? `${lossStreak} / ${maxLossStreak}` : String(lossStreak),
      warn: maxLossStreak > 0 && lossStreak >= maxLossStreak,
    },
    {
      label: 'Open Positions',
      value: String(openTradeCount),
      warn: false,
    },
    {
      label: 'Exposure',
      value: openExposureUsd > 0 ? `$${Math.round(openExposureUsd).toLocaleString()}` : '—',
      warn: false,
    },
  ];

  return (
    <div className={cn(
      "rounded-xl border p-4",
      isBlocked ? "bg-red-500/5 border-red-500/30" : "bg-[#111]/60 border-[#2a2a2a]/60"
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isBlocked
            ? <ShieldOff className="w-4 h-4 text-red-400" />
            : <Shield className="w-4 h-4 text-emerald-400" />
          }
          <span className="text-sm font-semibold text-[#c0c0c0]">Session Status</span>
        </div>
        <span className={cn(
          "text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full uppercase",
          isBlocked ? "bg-red-500/20 text-red-400" : "bg-emerald-500/15 text-emerald-400"
        )}>
          {isBlocked ? 'Blocked' : 'Trading OK'}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {tiles.map(tile => (
          <div key={tile.label} className={cn(
            "rounded-lg px-3 py-2.5 text-center",
            tile.warn ? "bg-red-500/10 border border-red-500/20" : "bg-[#0d0d0d]/60"
          )}>
            <div className={cn("text-sm font-bold", tile.warn ? "text-red-400" : "text-[#c0c0c0]")}>
              {tile.value}
            </div>
            <div className="text-[10px] text-[#555] mt-0.5">{tile.label}</div>
          </div>
        ))}
      </div>

      {violations.length > 0 && (
        <div className="mt-3 space-y-1 pt-3 border-t border-red-500/20">
          {violations.map((v, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-red-400/80">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              <span>{v.rule}: {v.value} (limit {v.limit})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}