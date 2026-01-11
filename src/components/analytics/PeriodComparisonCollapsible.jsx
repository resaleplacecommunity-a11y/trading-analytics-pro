import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, startOfDay, endOfDay, eachDayOfInterval, format } from 'date-fns';
import { calculateClosedMetrics } from './analyticsCalculations';
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function PeriodComparisonCollapsible({ trades }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [period, setPeriod] = useState('week');
  const [metric, setMetric] = useState('pnl');

  const comparison = useMemo(() => {
    const now = new Date();
    let currentStart, currentEnd, previousStart, previousEnd, periodLabel;

    if (period === 'today') {
      currentStart = startOfDay(now);
      currentEnd = endOfDay(now);
      previousStart = startOfDay(new Date(now.getTime() - 86400000));
      previousEnd = endOfDay(new Date(now.getTime() - 86400000));
      periodLabel = ['Today', 'Yesterday'];
    } else if (period === 'week') {
      currentStart = startOfWeek(now, { weekStartsOn: 1 });
      currentEnd = endOfWeek(now, { weekStartsOn: 1 });
      previousStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      previousEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      periodLabel = ['This Week', 'Last Week'];
    } else {
      currentStart = startOfMonth(now);
      currentEnd = endOfMonth(now);
      previousStart = startOfMonth(subMonths(now, 1));
      previousEnd = endOfMonth(subMonths(now, 1));
      periodLabel = ['This Month', 'Last Month'];
    }

    const currentTrades = trades.filter(t => {
      if (!t.date_close) return false;
      const date = new Date(t.date_close);
      return date >= currentStart && date <= currentEnd;
    });

    const previousTrades = trades.filter(t => {
      if (!t.date_close) return false;
      const date = new Date(t.date_close);
      return date >= previousStart && date <= previousEnd;
    });

    const current = calculateClosedMetrics(currentTrades);
    const previous = calculateClosedMetrics(previousTrades);

    let currentDays, previousDays;

    if (period === 'today') {
      const hours = Array.from({ length: 24 }, (_, i) => i);
      currentDays = hours.map(h => new Date(currentStart.getTime() + h * 3600000));
      previousDays = hours.map(h => new Date(previousStart.getTime() + h * 3600000));
    } else {
      currentDays = eachDayOfInterval({ start: currentStart, end: Math.min(currentEnd, now) });
      previousDays = eachDayOfInterval({ start: previousStart, end: previousEnd });
    }

    const chartData = currentDays.map((day, idx) => {
      const dayLabel = period === 'today' ? format(day, 'HH:mm') : format(day, 'MMM dd');

      const currentUpToDay = currentTrades.filter(t => {
        if (!t.date_close) return false;
        const tradeDate = new Date(t.date_close);
        return tradeDate >= currentStart && tradeDate <= day;
      });

      const prevDay = previousDays[idx];
      const prevUpToDay = prevDay ? previousTrades.filter(t => {
        if (!t.date_close) return false;
        const tradeDate = new Date(t.date_close);
        return tradeDate >= previousStart && tradeDate <= prevDay;
      }) : [];

      const currentMetrics = calculateClosedMetrics(currentUpToDay);
      const prevMetrics = calculateClosedMetrics(prevUpToDay);

      return {
        day: dayLabel,
        current: metric === 'pnl' ? currentMetrics.netPnlUsd :
                 metric === 'winrate' ? currentMetrics.winrate :
                 metric === 'avgR' ? currentMetrics.avgR :
                 currentMetrics.tradesCount,
        previous: metric === 'pnl' ? prevMetrics.netPnlUsd :
                  metric === 'winrate' ? prevMetrics.winrate :
                  metric === 'avgR' ? prevMetrics.avgR :
                  prevMetrics.tradesCount
      };
    });

    const summaryMetrics = [
      { 
        label: 'Net PNL', 
        current: current.netPnlUsd, 
        previous: previous.netPnlUsd,
        format: (v) => {
          const rounded = Math.round(v);
          return `${rounded >= 0 ? '+' : ''}$${Math.abs(rounded).toLocaleString('ru-RU').replace(/,/g, ' ')}`;
        }
      },
      { 
        label: 'Winrate', 
        current: current.winrate, 
        previous: previous.winrate,
        format: (v) => `${v.toFixed(1)}%`,
      },
      { 
        label: 'Avg R', 
        current: current.avgR, 
        previous: previous.avgR,
        format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}R`
      },
      { 
        label: 'Trades', 
        current: current.tradesCount, 
        previous: previous.tradesCount,
        format: (v) => v.toString()
      }
    ];

    return { summaryMetrics, current, previous, chartData, periodLabel };
  }, [trades, period, metric]);

  const MetricCard = ({ label, current, previous, format }) => {
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
    <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 mb-6 overflow-hidden">
      {/* Header Bar */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between p-6 cursor-pointer hover:bg-[#1a1a1a]/50 transition-all"
      >
        <h3 className="text-lg font-bold text-[#c0c0c0] flex items-center gap-2">
          <Calendar className="w-5 h-5 text-violet-400" />
          Period Comparison
        </h3>
        {isExpanded ? <ChevronUp className="w-5 h-5 text-[#888]" /> : <ChevronDown className="w-5 h-5 text-[#888]" />}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-6 pb-6 border-t border-[#2a2a2a]/50">
          <div className="flex justify-end gap-2 mb-4 mt-4">
            <Select value={metric} onValueChange={setMetric}>
              <SelectTrigger className="w-32 bg-[#1a1a1a] border-[#2a2a2a] text-[#c0c0c0]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
                <SelectItem value="pnl" className="text-[#c0c0c0]">PNL</SelectItem>
                <SelectItem value="winrate" className="text-[#c0c0c0]">Winrate</SelectItem>
                <SelectItem value="avgR" className="text-[#c0c0c0]">Avg R</SelectItem>
                <SelectItem value="trades" className="text-[#c0c0c0]">Trades</SelectItem>
              </SelectContent>
            </Select>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-32 bg-[#1a1a1a] border-[#2a2a2a] text-[#c0c0c0]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
                <SelectItem value="today" className="text-[#c0c0c0]">Daily</SelectItem>
                <SelectItem value="week" className="text-[#c0c0c0]">Weekly</SelectItem>
                <SelectItem value="month" className="text-[#c0c0c0]">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mb-6">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={comparison.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" opacity={0.3} />
                <XAxis 
                  dataKey="day" 
                  stroke="#666" 
                  tick={{ fill: '#c0c0c0', fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  stroke="#666" 
                  tick={{ fill: '#c0c0c0', fontSize: 11 }}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#c0c0c0' }}
                  labelStyle={{ color: '#c0c0c0' }}
                  itemStyle={{ color: '#c0c0c0' }}
                  cursor={{ fill: 'rgba(192, 192, 192, 0.05)' }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="current" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name={comparison.periodLabel[0]}
                />
                <Line 
                  type="monotone" 
                  dataKey="previous" 
                  stroke="#666" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3 }}
                  name={comparison.periodLabel[1]}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-4 gap-4">
            {comparison.summaryMetrics.map((m, i) => (
              <MetricCard key={i} {...m} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}