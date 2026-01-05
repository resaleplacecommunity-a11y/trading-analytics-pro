import { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { cn } from "@/lib/utils";

const formatNumber = (num) => {
  if (num === undefined || num === null || num === '') return '—';
  const n = parseFloat(num);
  if (isNaN(n)) return '—';
  return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
};

export default function TradeDurationAnalysis({ trades }) {
  const analysis = useMemo(() => {
    const closedTrades = trades.filter(t => t.actual_duration_minutes && t.actual_duration_minutes > 0);
    
    if (closedTrades.length === 0) {
      return { avgDuration: 0, buckets: [] };
    }

    // Calculate average
    const totalMinutes = closedTrades.reduce((sum, t) => sum + t.actual_duration_minutes, 0);
    const avgDuration = totalMinutes / closedTrades.length;

    // New buckets: <15m, 15m-1h, 1h-4h, 4h-1d, 1d-3d, >3d
    const bucketDefs = [
      { name: '< 15m', min: 0, max: 15 },
      { name: '15m - 1h', min: 15, max: 60 },
      { name: '1h - 4h', min: 60, max: 240 },
      { name: '4h - 1d', min: 240, max: 1440 },
      { name: '1d - 3d', min: 1440, max: 4320 },
      { name: '> 3d', min: 4320, max: Infinity }
    ];

    const buckets = bucketDefs.map(def => {
      const buckeTrades = closedTrades.filter(t => t.actual_duration_minutes >= def.min && t.actual_duration_minutes < def.max);
      const wins = buckeTrades.filter(t => (t.pnl_usd || 0) > 0).length;
      const totalPnl = buckeTrades.reduce((sum, t) => sum + (t.pnl_usd || 0), 0);
      const avgPnl = buckeTrades.length > 0 ? totalPnl / buckeTrades.length : 0;
      const winrate = buckeTrades.length > 0 ? (wins / buckeTrades.length) * 100 : 0;

      return {
        name: def.name,
        count: buckeTrades.length,
        winrate,
        avgPnl,
        totalPnl
      };
    }).filter(b => b.count > 0);

    return { avgDuration, buckets };
  }, [trades]);

  const formatDuration = (minutes) => {
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = Math.floor(minutes % 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  if (analysis.buckets.length === 0) {
    return null;
  }

  return (
    <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-[#c0c0c0] flex items-center gap-2">
          <Clock className="w-5 h-5 text-cyan-400" />
          Trade Duration Analysis
        </h3>
        <div className="bg-[#111]/50 rounded-lg px-4 py-2">
          <div className="text-xs text-[#666] mb-0.5">Avg Duration</div>
          <div className="text-xl font-bold text-cyan-400">{formatDuration(analysis.avgDuration)}</div>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-3">
        {analysis.buckets.map((bucket) => {
          const isProfit = bucket.avgPnl >= 0;
          const isGoodWR = bucket.winrate >= 50;
          
          return (
            <div 
              key={bucket.name}
              className={cn(
                "relative rounded-xl border-2 p-4 overflow-hidden transition-all hover:scale-[1.02]",
                isProfit 
                  ? "bg-gradient-to-br from-emerald-500/15 via-[#0d0d0d] to-emerald-500/5 border-emerald-500/40 hover:border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                  : "bg-gradient-to-br from-red-500/15 via-[#0d0d0d] to-red-500/5 border-red-500/40 hover:border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.15)]"
              )}
            >
              {/* Subtle pattern */}
              <div className="absolute inset-0 opacity-[0.04]" style={{
                backgroundImage: `linear-gradient(to right, #c0c0c0 1px, transparent 1px), linear-gradient(to bottom, #c0c0c0 1px, transparent 1px)`,
                backgroundSize: '20px 20px'
              }} />

              <div className="relative z-10">
                {/* Header */}
                <div className="text-center mb-3">
                  <div className="text-xs text-[#888] uppercase tracking-wider mb-1">{bucket.name}</div>
                  <div className="text-2xl font-black text-[#c0c0c0]">{bucket.count}</div>
                  <div className="text-[9px] text-[#666]">trades</div>
                </div>

                {/* Stats */}
                <div className="space-y-2">
                  <div className="bg-[#0d0d0d]/50 rounded-lg px-2 py-1.5">
                    <div className="text-[9px] text-[#666] mb-0.5">Winrate</div>
                    <div className={cn(
                      "text-sm font-bold",
                      isGoodWR ? "text-emerald-400" : "text-red-400"
                    )}>
                      {bucket.winrate.toFixed(0)}%
                    </div>
                  </div>
                  
                  <div className="bg-[#0d0d0d]/50 rounded-lg px-2 py-1.5">
                    <div className="text-[9px] text-[#666] mb-0.5">Avg PNL</div>
                    <div className={cn(
                      "text-sm font-bold",
                      isProfit ? "text-emerald-400" : "text-red-400"
                    )}>
                      {isProfit ? '+' : ''}${formatNumber(Math.abs(bucket.avgPnl))}
                    </div>
                  </div>
                  
                  <div className="bg-[#0d0d0d]/50 rounded-lg px-2 py-1.5">
                    <div className="text-[9px] text-[#666] mb-0.5">Total</div>
                    <div className={cn(
                      "text-sm font-bold",
                      bucket.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                      {bucket.totalPnl >= 0 ? '+' : ''}${formatNumber(Math.abs(bucket.totalPnl))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}