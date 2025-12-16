import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, startOfDay, endOfDay } from 'date-fns';
import { calculateClosedMetrics } from './analyticsCalculations';
import { cn } from "@/lib/utils";

export default function PeriodComparison({ trades }) {
  const [period, setPeriod] = useState('week'); // week, month

  const comparison = useMemo(() => {
    const now = new Date();
    let currentStart, currentEnd, previousStart, previousEnd;

    if (period === 'week') {
      currentStart = startOfWeek(now, { weekStartsOn: 1 });
      currentEnd = endOfWeek(now, { weekStartsOn: 1 });
      previousStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      previousEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
    } else {
      currentStart = startOfMonth(now);
      currentEnd = endOfMonth(now);
      previousStart = startOfMonth(subMonths(now, 1));
      previousEnd = endOfMonth(subMonths(now, 1));
    }

    const currentTrades = trades.filter(t => {
      const date = new Date(t.date_close || t.date);
      return date >= currentStart && date <= currentEnd;
    });

    const previousTrades = trades.filter(t => {
      const date = new Date(t.date_close || t.date);
      return date >= previousStart && date <= previousEnd;
    });

    const current = calculateClosedMetrics(currentTrades);
    const previous = calculateClosedMetrics(previousTrades);

    const metrics = [
      { 
        label: 'Net PNL', 
        current: current.netPnlUsd, 
        previous: previous.netPnlUsd,
        format: (v) => `$${Math.abs(v).toLocaleString('ru-RU').replace(/,/g, ' ')}`,
        isPercent: false
      },
      { 
        label: 'Winrate', 
        current: current.winrate, 
        previous: previous.winrate,
        format: (v) => `${v.toFixed(1)}%`,
        isPercent: true
      },
      { 
        label: 'Avg R', 
        current: current.avgR, 
        previous: previous.avgR,
        format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}R`,
        isPercent: false
      },
      { 
        label: 'Trades', 
        current: current.tradesCount, 
        previous: previous.tradesCount,
        format: (v) => v.toString(),
        isPercent: false
      }
    ];

    return { metrics, current, previous };
  }, [trades, period]);

  const MetricCard = ({ label, current, previous, format, isPercent }) => {
    const diff = current - previous;
    const percentChange = previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : 0;
    const isPositive = diff >= 0;

    return (
      <div className="bg-[#111]/50 rounded-lg p-4">
        <div className="text-xs text-[#666] mb-2">{label}</div>
        <div className="flex items-baseline gap-2 mb-2">
          <div className={cn(
            "text-2xl font-bold",
            label === 'Net PNL' ? (current >= 0 ? "text-emerald-400" : "text-red-400") : "text-[#c0c0c0]"
          )}>
            {format(current)}
          </div>
          {previous > 0 && (
            <div className={cn(
              "text-xs flex items-center gap-1",
              isPositive ? "text-emerald-400" : "text-red-400"
            )}>
              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(percentChange).toFixed(0)}%
            </div>
          )}
        </div>
        <div className="text-xs text-[#666]">
          Previous: {format(previous)}
        </div>
      </div>
    );
  };

  return (
    <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-[#c0c0c0] flex items-center gap-2">
          <Calendar className="w-5 h-5 text-violet-400" />
          Period Comparison
        </h3>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-32 bg-[#1a1a1a] border-[#2a2a2a]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
            <SelectItem value="week">Weekly</SelectItem>
            <SelectItem value="month">Monthly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {comparison.metrics.map((m, i) => (
          <MetricCard key={i} {...m} />
        ))}
      </div>
    </div>
  );
}