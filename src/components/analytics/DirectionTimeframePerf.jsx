import { ArrowUpCircle, ArrowDownCircle, Clock } from 'lucide-react';
import { cn } from "@/lib/utils";

function buildPerf(trades, groupBy) {
  const map = {};
  trades.forEach(t => {
    const key = t[groupBy] || 'Unknown';
    if (!map[key]) map[key] = { pnl: 0, count: 0, wins: 0, rSum: 0, rCount: 0 };
    map[key].pnl += t.pnl_usd || 0;
    map[key].count += 1;
    if ((t.pnl_usd || 0) > 0) map[key].wins += 1;
    if (t.r_multiple != null) { map[key].rSum += t.r_multiple; map[key].rCount += 1; }
  });
  return Object.entries(map)
    .map(([name, d]) => ({
      name,
      pnl: d.pnl,
      count: d.count,
      winrate: d.count > 0 ? (d.wins / d.count) * 100 : 0,
      avgR: d.rCount > 0 ? d.rSum / d.rCount : null,
    }))
    .sort((a, b) => b.pnl - a.pnl);
}

function PerfRow({ row, onDrillDown, trades, groupKey }) {
  return (
    <div
      className="flex items-center justify-between p-2.5 rounded-lg bg-[#0d0d0d]/60 hover:bg-[#111] transition-colors cursor-pointer"
      onClick={() => onDrillDown && onDrillDown(row.name, trades.filter(t => (t[groupKey] || 'Unknown') === row.name))}
    >
      <div>
        <div className="text-sm font-medium text-[#c0c0c0]">{row.name}</div>
        <div className="text-xs text-[#555] mt-0.5">
          {row.count} trades · {row.winrate.toFixed(0)}% WR
          {row.avgR != null ? ` · ${row.avgR.toFixed(2)}R avg` : ''}
        </div>
      </div>
      <div className={cn("text-sm font-bold", row.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
        {row.pnl >= 0 ? '+' : '−'}${Math.round(Math.abs(row.pnl)).toLocaleString()}
      </div>
    </div>
  );
}

export default function DirectionTimeframePerf({ trades = [], onDrillDown }) {
  const directionPerf = buildPerf(trades, 'direction');
  const timeframePerf = buildPerf(trades, 'timeframe');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-5">
        <h4 className="text-sm font-semibold text-[#c0c0c0] mb-4 flex items-center gap-2">
          <ArrowUpCircle className="w-4 h-4 text-emerald-400/70" />
          Long vs Short
        </h4>
        {directionPerf.length === 0 ? (
          <p className="text-xs text-[#555] text-center py-6">No direction data</p>
        ) : (
          <div className="space-y-2">
            {directionPerf.map(r => (
              <PerfRow key={r.name} row={r} trades={trades} groupKey="direction" onDrillDown={onDrillDown} />
            ))}
          </div>
        )}
      </div>

      <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-5">
        <h4 className="text-sm font-semibold text-[#c0c0c0] mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-cyan-400/70" />
          Timeframe Performance
        </h4>
        {timeframePerf.length === 0 ? (
          <p className="text-xs text-[#555] text-center py-6">No timeframe data tagged</p>
        ) : (
          <div className="space-y-2">
            {timeframePerf.map(r => (
              <PerfRow key={r.name} row={r} trades={trades} groupKey="timeframe" onDrillDown={onDrillDown} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}