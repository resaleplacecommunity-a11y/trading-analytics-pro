import { useMemo } from 'react';
import { Clock, Timer, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { cn } from "@/lib/utils";

// Helper: compute duration from dates as fallback
const computeDuration = (trade) => {
  // For closed trades: use actual_duration_minutes if exists, else compute from dates
  if (trade.close_price && trade.date_close && trade.date_open) {
    if (trade.actual_duration_minutes && trade.actual_duration_minutes > 0) {
      return trade.actual_duration_minutes;
    }
    const open = new Date(trade.date_open || trade.date);
    const close = new Date(trade.date_close);
    return Math.max(0, (close - open) / 60000); // milliseconds to minutes
  }
  // For open trades: compute from now
  if (!trade.close_price && trade.date_open) {
    const open = new Date(trade.date_open || trade.date);
    return Math.max(0, (Date.now() - open) / 60000);
  }
  return null;
};

export default function TradeDurationAnalysis({ trades }) {
  const analysis = useMemo(() => {
    const closedTrades = trades.filter(t => t.close_price);
    
    if (closedTrades.length === 0) {
      return { avgDuration: 0, distribution: [], medianDuration: 0 };
    }

    // Compute durations with fallback
    const durations = closedTrades.map(t => computeDuration(t)).filter(d => d !== null && d > 0);

    if (durations.length === 0) {
      return { avgDuration: 0, distribution: [], medianDuration: 0 };
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

    closedTrades.forEach(t => {
      const minutes = computeDuration(t);
      if (!minutes || minutes <= 0) return;

      const hours = minutes / 60;
      const days = minutes / 1440;

      let bucket;
      if (minutes < 15) bucket = '< 15m';
      else if (hours < 1) bucket = '15m-1h';
      else if (hours < 4) bucket = '1h-4h';
      else if (hours < 24) bucket = '4h-1d';
      else if (days < 3) bucket = '1d-3d';
      else bucket = '> 3d';

      buckets[bucket].count++;
      buckets[bucket].pnl += t.pnl_usd || 0;
    });

    const distribution = Object.entries(buckets)
      .map(([name, data]) => ({
        name,
        count: data.count,
        pnl: data.pnl,
        avgPnl: data.count > 0 ? data.pnl / data.count : 0
      }))
      .filter(d => d.count > 0);

    return { avgDuration, distribution, medianDuration };
  }, [trades]);

  const formatDuration = (minutes) => {
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = Math.floor(minutes % 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  if (analysis.distribution.length === 0) {
    return null;
  }

  return (
    <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-6">
      <h3 className="text-lg font-bold text-[#c0c0c0] mb-4 flex items-center gap-2">
        <Timer className="w-5 h-5 text-cyan-400" />
        Trade Duration Analysis
      </h3>

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
          <div className="text-2xl font-bold text-[#c0c0c0]">{trades.filter(t => t.close_price).length}</div>
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