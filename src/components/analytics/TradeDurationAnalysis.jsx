import { useMemo } from 'react';
import { Clock, Timer } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// Helper: compute duration from dates as fallback
const getDurationMinutes = (trade, now = new Date()) => {
  // 1. Use actual_duration_minutes if valid
  if (trade.actual_duration_minutes != null && trade.actual_duration_minutes >= 0) {
    return trade.actual_duration_minutes;
  }
  
  // 2. For closed trades: calculate from date_open and date_close (or closed_at)
  const endDate = trade.date_close || trade.closed_at;
  if (trade.date_open && endDate) {
    try {
      const start = new Date(trade.date_open);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
      const durationMin = Math.round((end - start) / 60000);
      return Math.max(0, durationMin); // Clamp negative to 0
    } catch {
      return null;
    }
  }
  
  // 3. For open trades: calculate from date_open to now
  if (!endDate && trade.date_open) {
    try {
      const start = new Date(trade.date_open);
      if (isNaN(start.getTime())) return null;
      const durationMin = Math.round((now - start) / 60000);
      return Math.max(0, durationMin); // Clamp negative to 0
    } catch {
      return null;
    }
  }
  
  // 4. No duration data available
  return null;
};

export default function TradeDurationAnalysis({ trades }) {
  const analysis = useMemo(() => {
    // Only closed trades (date_close != null)
    const closedTrades = trades.filter(t => t.date_close != null);
    
    if (closedTrades.length === 0) {
      return { avgDuration: 0, distribution: [], medianDuration: 0, closedCount: 0, validCount: 0 };
    }

    // Compute durations with fallback
    const now = new Date();
    const tradesWithDuration = closedTrades
      .map(t => ({ trade: t, duration: getDurationMinutes(t, now) }))
      .filter(({ duration }) => duration !== null);

    const durations = tradesWithDuration.map(({ duration }) => duration);

    if (durations.length === 0) {
      return { avgDuration: 0, distribution: [], medianDuration: 0, closedCount: closedTrades.length, validCount: 0 };
    }

    // Calculate average
    const totalMinutes = durations.reduce((sum, d) => sum + d, 0);
    const avgDuration = totalMinutes / durations.length;

    // Calculate median
    const sorted = [...durations].sort((a, b) => a - b);
    const medianDuration = sorted[Math.floor(sorted.length / 2)];

    // Distribution by time buckets (updated to match spec)
    const buckets = {
      '< 15m': { count: 0, pnl: 0 },
      '15m-1h': { count: 0, pnl: 0 },
      '1h-4h': { count: 0, pnl: 0 },
      '4h-1d': { count: 0, pnl: 0 },
      '1d-3d': { count: 0, pnl: 0 },
      '> 3d': { count: 0, pnl: 0 }
    };

    tradesWithDuration.forEach(({ trade, duration }) => {
      let bucket;
      if (duration < 15) bucket = '< 15m';
      else if (duration < 60) bucket = '15m-1h';
      else if (duration < 240) bucket = '1h-4h';
      else if (duration < 1440) bucket = '4h-1d';
      else if (duration < 4320) bucket = '1d-3d';
      else bucket = '> 3d';

      buckets[bucket].count++;
      buckets[bucket].pnl += trade.pnl_usd || 0;
    });

    const distribution = Object.entries(buckets)
      .map(([name, data]) => ({
        name,
        count: data.count,
        pnl: data.pnl,
        avgPnl: data.count > 0 ? data.pnl / data.count : 0
      }));

    return { 
      avgDuration, 
      distribution, 
      medianDuration, 
      closedCount: closedTrades.length, 
      validCount: durations.length 
    };
  }, [trades]);

  const formatDuration = (minutes) => {
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = Math.floor(minutes % 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  // Show "No duration data" if we have closed trades but no valid durations
  if (analysis.closedCount > 0 && analysis.validCount === 0) {
    return (
      <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[#c0c0c0] flex items-center gap-2">
            <Timer className="w-5 h-5 text-cyan-400" />
            Trade Duration Analysis
          </h3>
        </div>
        <div className="text-center py-12">
          <Clock className="w-12 h-12 text-[#666] mx-auto mb-3" />
          <p className="text-[#888] text-sm">
            No duration data available for {analysis.closedCount} closed trades
          </p>
          <p className="text-[#666] text-xs mt-1">
            Trades need date_open and date_close for duration calculation
          </p>
        </div>
      </div>
    );
  }

  // Don't render if no closed trades at all
  if (analysis.closedCount === 0) {
    return null;
  }

  return (
    <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-[#c0c0c0] flex items-center gap-2">
          <Timer className="w-5 h-5 text-cyan-400" />
          Trade Duration Analysis
        </h3>
        <div className="text-xs text-[#666]">
          Closed: {analysis.closedCount} | Valid: {analysis.validCount}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-[#111]/50 rounded-lg p-4">
          <div className="text-xs text-[#666] mb-1">Average Duration</div>
          <div className="text-2xl font-bold text-cyan-400">{formatDuration(analysis.avgDuration)}</div>
        </div>
        <div className="bg-[#111]/50 rounded-lg p-4">
          <div className="text-xs text-[#666] mb-1">Median Duration</div>
          <div className="text-2xl font-bold text-[#c0c0c0]">{formatDuration(analysis.medianDuration)}</div>
        </div>
        <div className="bg-[#111]/50 rounded-lg p-4">
          <div className="text-xs text-[#666] mb-1">Total Analyzed</div>
          <div className="text-2xl font-bold text-[#c0c0c0]">{analysis.validCount}</div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="text-sm text-[#888] mb-3">Distribution by Duration</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={analysis.distribution}>
              <XAxis 
                dataKey="name" 
                stroke="#666" 
                tick={{ fill: '#c0c0c0', fontSize: 10 }}
              />
              <YAxis 
                stroke="#666" 
                tick={{ fill: '#c0c0c0', fontSize: 11 }}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#111', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#c0c0c0' }}
                labelStyle={{ color: '#c0c0c0' }}
                formatter={(value, name) => {
                  if (name === 'count') return [value, 'Trades'];
                  return [`$${Math.round(value).toLocaleString()}`, 'Avg PNL'];
                }}
              />
              <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div>
          <div className="text-sm text-[#888] mb-3">Average PNL by Duration</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={analysis.distribution}>
              <XAxis 
                dataKey="name" 
                stroke="#666" 
                tick={{ fill: '#c0c0c0', fontSize: 10 }}
              />
              <YAxis 
                stroke="#666" 
                tick={{ fill: '#c0c0c0', fontSize: 11 }}
                tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#111', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#c0c0c0' }}
                labelStyle={{ color: '#c0c0c0' }}
                formatter={(value) => [`$${Math.round(value).toLocaleString()}`, 'Avg PNL']}
              />
              <Bar dataKey="avgPnl" radius={[4, 4, 0, 0]}>
                {analysis.distribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.avgPnl >= 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}