import { useMemo } from 'react';
import { Trophy, Target, TrendingUp, Clock } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function BestConditions({ trades }) {
  const analysis = useMemo(() => {
    const closed = trades.filter(t => t.close_price);
    
    // By Timeframe
    const tfMap = {};
    closed.forEach(t => {
      const tf = t.timeframe || 'unknown';
      if (!tfMap[tf]) tfMap[tf] = { pnl: 0, count: 0, wins: 0 };
      tfMap[tf].pnl += t.pnl_usd || 0;
      tfMap[tf].count++;
      if ((t.pnl_usd || 0) > 0) tfMap[tf].wins++;
    });
    const bestTimeframe = Object.entries(tfMap)
      .map(([name, data]) => ({ name, ...data, winrate: (data.wins / data.count) * 100 }))
      .sort((a, b) => b.pnl - a.pnl)[0];

    // By Direction (Long/Short)
    const dirMap = {};
    closed.forEach(t => {
      const dir = t.direction || 'unknown';
      if (!dirMap[dir]) dirMap[dir] = { pnl: 0, count: 0, wins: 0 };
      dirMap[dir].pnl += t.pnl_usd || 0;
      dirMap[dir].count++;
      if ((t.pnl_usd || 0) > 0) dirMap[dir].wins++;
    });
    const bestDirection = Object.entries(dirMap)
      .map(([name, data]) => ({ name, ...data, winrate: (data.wins / data.count) * 100 }))
      .sort((a, b) => b.pnl - a.pnl)[0];

    // By Strategy
    const stratMap = {};
    closed.forEach(t => {
      const strat = t.strategy_tag || 'unknown';
      if (!stratMap[strat]) stratMap[strat] = { pnl: 0, count: 0, wins: 0 };
      stratMap[strat].pnl += t.pnl_usd || 0;
      stratMap[strat].count++;
      if ((t.pnl_usd || 0) > 0) stratMap[strat].wins++;
    });
    const bestStrategy = Object.entries(stratMap)
      .map(([name, data]) => ({ name, ...data, winrate: (data.wins / data.count) * 100 }))
      .sort((a, b) => b.pnl - a.pnl)[0];

    return { bestTimeframe, bestDirection, bestStrategy };
  }, [trades]);

  const ConditionCard = ({ icon: Icon, label, condition, color }) => (
    <div className="bg-[#111]/50 rounded-lg p-4 hover:bg-[#1a1a1a] transition-all">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={cn("w-4 h-4", color)} />
        <span className="text-xs text-[#666]">{label}</span>
      </div>
      {condition ? (
        <>
          <div className={cn("text-xl font-bold mb-2", color)}>
            {condition.name}
          </div>
          <div className="space-y-1">
            <div className={cn(
              "text-sm",
              condition.pnl >= 0 ? "text-emerald-400" : "text-red-400"
            )}>
              {condition.pnl >= 0 ? '+' : '−'}${Math.abs(Math.round(condition.pnl)).toLocaleString('ru-RU').replace(/,/g, ' ')}
            </div>
            <div className="text-xs text-[#888]">
              {condition.count} trades • {condition.winrate.toFixed(0)}% WR
            </div>
          </div>
        </>
      ) : (
        <div className="text-sm text-[#666]">No data</div>
      )}
    </div>
  );

  return (
    <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-6 mb-6">
      <h3 className="text-lg font-bold text-[#c0c0c0] mb-4 flex items-center gap-2">
        <Trophy className="w-5 h-5 text-amber-400" />
        Best Performing Conditions
      </h3>
      <div className="grid grid-cols-3 gap-4">
        <ConditionCard 
          icon={Clock} 
          label="Best Timeframe" 
          condition={analysis.bestTimeframe}
          color="text-violet-400"
        />
        <ConditionCard 
          icon={TrendingUp} 
          label="Best Direction" 
          condition={analysis.bestDirection}
          color="text-emerald-400"
        />
        <ConditionCard 
          icon={Target} 
          label="Best Strategy" 
          condition={analysis.bestStrategy}
          color="text-blue-400"
        />
      </div>
    </div>
  );
}