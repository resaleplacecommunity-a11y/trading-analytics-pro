import { Target, TrendingDown, Minus, Split, PlusCircle, Hand } from 'lucide-react';
import { cn } from "@/lib/utils";
import { getExitType } from './analyticsCalculations';

export default function ExitMetrics({ metrics, onDrillDown, allTrades }) {
  const total = metrics.total || 1;
  
  const exitData = [
    {
      icon: TrendingDown,
      label: 'Stop Losses',
      value: metrics.stopLosses,
      percent: ((metrics.stopLosses / total) * 100).toFixed(0),
      color: 'text-red-400',
      bg: 'bg-red-500/10'
    },
    {
      icon: Target,
      label: 'Take Profits',
      value: metrics.takeProfits,
      percent: ((metrics.takeProfits / total) * 100).toFixed(0),
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10'
    },
    {
      icon: Hand,
      label: 'Manual Closes',
      value: metrics.manualCloses,
      percent: ((metrics.manualCloses / total) * 100).toFixed(0),
      color: 'text-blue-400',
      bg: 'bg-blue-500/10'
    },
    {
      icon: Minus,
      label: 'Breakeven',
      value: metrics.breakeven,
      percent: ((metrics.breakeven / total) * 100).toFixed(0),
      color: 'text-amber-400',
      bg: 'bg-amber-500/10'
    },
    {
      icon: Split,
      label: 'With Partials',
      value: metrics.tradesWithPartials,
      percent: ((metrics.tradesWithPartials / total) * 100).toFixed(0),
      color: 'text-violet-400',
      bg: 'bg-violet-500/10'
    },
    {
      icon: PlusCircle,
      label: 'With Adds',
      value: metrics.tradesWithAdds,
      percent: ((metrics.tradesWithAdds / total) * 100).toFixed(0),
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10'
    }
  ];

  return (
    <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-6 mb-6">
      <h3 className="text-lg font-bold text-[#c0c0c0] mb-4">Trade Exit Analysis</h3>
      <div className="grid grid-cols-6 gap-4">
        {exitData.map((item, idx) => (
          <div 
            key={idx} 
            className={cn("rounded-lg p-4 transition-all hover:scale-105 cursor-pointer", item.bg)}
            onClick={() => {
              let filteredTrades = [];
              if (item.label === 'Stop Losses') {
                filteredTrades = allTrades.filter(t => t.close_price && getExitType(t) === 'Stop');
              } else if (item.label === 'Take Profits') {
                filteredTrades = allTrades.filter(t => t.close_price && getExitType(t) === 'Take');
              } else if (item.label === 'Manual Closes') {
                filteredTrades = allTrades.filter(t => t.close_price && getExitType(t) === 'Manual');
              } else if (item.label === 'Breakeven') {
                filteredTrades = allTrades.filter(t => t.close_price && getExitType(t) === 'Breakeven');
              } else if (item.label === 'With Partials') {
                filteredTrades = allTrades.filter(t => {
                  if (!t.partial_closes) return false;
                  try {
                    const partials = JSON.parse(t.partial_closes);
                    return Array.isArray(partials) && partials.length > 0;
                  } catch { return false; }
                });
              } else if (item.label === 'With Adds') {
                filteredTrades = allTrades.filter(t => {
                  if (!t.adds_history) return false;
                  try {
                    const adds = JSON.parse(t.adds_history);
                    return Array.isArray(adds) && adds.length > 0;
                  } catch { return false; }
                });
              }
              if (filteredTrades.length > 0) {
                onDrillDown(item.label, filteredTrades);
              }
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <item.icon className={cn("w-4 h-4", item.color)} />
              <span className="text-xs text-[#888]">{item.label}</span>
            </div>
            <div className={cn("text-2xl font-bold", item.color)}>
              {item.value}
            </div>
            <div className="text-xs text-[#666] mt-1">
              {item.percent}% of trades
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}