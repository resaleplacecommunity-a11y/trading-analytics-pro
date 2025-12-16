import { Target, TrendingDown, Minus, Split, PlusCircle, Hand } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function ExitMetrics({ metrics }) {
  const exitData = [
    {
      icon: TrendingDown,
      label: 'Stop Losses',
      value: metrics.stopLosses,
      color: 'text-red-400',
      bg: 'bg-red-500/10'
    },
    {
      icon: Target,
      label: 'Take Profits',
      value: metrics.takeProfits,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10'
    },
    {
      icon: Hand,
      label: 'Manual Closes',
      value: metrics.manualCloses,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10'
    },
    {
      icon: Minus,
      label: 'Breakeven',
      value: metrics.breakeven,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10'
    },
    {
      icon: Split,
      label: 'Partial Closes',
      value: metrics.tradesWithPartials,
      subtext: metrics.tradesWithPartials > 0 ? `Avg: ${metrics.avgPartialCount.toFixed(1)} partials/trade` : null,
      color: 'text-violet-400',
      bg: 'bg-violet-500/10'
    },
    {
      icon: PlusCircle,
      label: 'Position Adds',
      value: metrics.tradesWithAdds,
      subtext: metrics.tradesWithAdds > 0 ? `Avg: ${metrics.avgAdds.toFixed(1)} adds/trade` : null,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10'
    }
  ];

  return (
    <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-6 mb-6">
      <h3 className="text-lg font-bold text-[#c0c0c0] mb-4">Trade Exit Analysis</h3>
      <div className="grid grid-cols-6 gap-4">
        {exitData.map((item, idx) => (
          <div key={idx} className={cn("rounded-lg p-4 transition-all hover:scale-105", item.bg)}>
            <div className="flex items-center gap-2 mb-2">
              <item.icon className={cn("w-4 h-4", item.color)} />
              <span className="text-xs text-[#888]">{item.label}</span>
            </div>
            <div className={cn("text-2xl font-bold", item.color)}>
              {item.value}
            </div>
            {item.subtext && (
              <div className="text-xs text-[#666] mt-1">{item.subtext}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}