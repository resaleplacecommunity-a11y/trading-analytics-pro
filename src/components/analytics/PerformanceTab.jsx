import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Target } from 'lucide-react';
import StatsCard from '../dashboard/StatsCard';
import { applyFilters } from './filterUtils';

const formatNumber = (num) => {
  if (num === undefined || num === null || num === '') return '—';
  const n = parseFloat(num);
  if (isNaN(n)) return '—';
  return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
};

export default function PerformanceTab({ trades, filters }) {
  const filtered = applyFilters(trades, filters);
  const closedTrades = filtered.filter(t => t.close_price_final || t.close_price);

  const wins = closedTrades.filter(t => (t.pnl_total_usd || t.pnl_usd || 0) > 0);
  const losses = closedTrades.filter(t => (t.pnl_total_usd || t.pnl_usd || 0) < 0);
  const breakevens = closedTrades.filter(t => (t.pnl_total_usd || t.pnl_usd || 0) === 0);

  const grossProfit = wins.reduce((s, t) => s + (t.pnl_total_usd || t.pnl_usd || 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.pnl_total_usd || t.pnl_usd || 0), 0));
  
  const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
  const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : 0;

  const totalPnl = closedTrades.reduce((s, t) => s + (t.pnl_total_usd || t.pnl_usd || 0), 0);
  const expectancy = closedTrades.length > 0 ? totalPnl / closedTrades.length : 0;

  const winrate = closedTrades.length > 0 ? (wins.length / closedTrades.length * 100) : 0;
  const breakEvenRate = closedTrades.length > 0 ? (breakevens.length / closedTrades.length * 100) : 0;

  // Largest win/loss
  const largestWin = wins.length > 0 
    ? Math.max(...wins.map(t => t.pnl_total_usd || t.pnl_usd || 0)) 
    : 0;
  const largestLoss = losses.length > 0 
    ? Math.min(...losses.map(t => t.pnl_total_usd || t.pnl_usd || 0)) 
    : 0;

  // R-Multiple distribution
  const rBuckets = { '<-3': 0, '-3 to -2': 0, '-2 to -1': 0, '-1 to 0': 0, '0 to 1': 0, '1 to 2': 0, '2 to 3': 0, '>3': 0 };
  closedTrades.forEach(t => {
    const r = t.r_multiple || 0;
    if (r < -3) rBuckets['<-3']++;
    else if (r < -2) rBuckets['-3 to -2']++;
    else if (r < -1) rBuckets['-2 to -1']++;
    else if (r < 0) rBuckets['-1 to 0']++;
    else if (r < 1) rBuckets['0 to 1']++;
    else if (r < 2) rBuckets['1 to 2']++;
    else if (r < 3) rBuckets['2 to 3']++;
    else rBuckets['>3']++;
  });

  const rDistribution = Object.entries(rBuckets).map(([bucket, count]) => ({ bucket, count }));

  // PNL distribution (bins)
  const pnlBuckets = { '<-1000': 0, '-1000 to -500': 0, '-500 to 0': 0, '0 to 500': 0, '500 to 1000': 0, '>1000': 0 };
  closedTrades.forEach(t => {
    const pnl = t.pnl_total_usd || t.pnl_usd || 0;
    if (pnl < -1000) pnlBuckets['<-1000']++;
    else if (pnl < -500) pnlBuckets['-1000 to -500']++;
    else if (pnl < 0) pnlBuckets['-500 to 0']++;
    else if (pnl < 500) pnlBuckets['0 to 500']++;
    else if (pnl < 1000) pnlBuckets['500 to 1000']++;
    else pnlBuckets['>1000']++;
  });

  const pnlDistribution = Object.entries(pnlBuckets).map(([bucket, count]) => ({ bucket, count }));

  // Streaks
  let currentStreak = 0;
  let streakType = null;
  let maxWinStreak = 0;
  let maxLossStreak = 0;

  const sortedClosed = [...closedTrades].sort((a, b) => 
    new Date(a.date_close || a.date_open) - new Date(b.date_close || b.date_open)
  );

  sortedClosed.forEach(t => {
    const isWin = (t.pnl_total_usd || t.pnl_usd || 0) > 0;
    if (isWin) {
      if (streakType === 'win') {
        currentStreak++;
      } else {
        streakType = 'win';
        currentStreak = 1;
      }
      maxWinStreak = Math.max(maxWinStreak, currentStreak);
    } else {
      if (streakType === 'loss') {
        currentStreak++;
      } else {
        streakType = 'loss';
        currentStreak = 1;
      }
      maxLossStreak = Math.max(maxLossStreak, currentStreak);
    }
  });

  // Early exit rate
  const earlyExits = closedTrades.filter(t => {
    if (!t.take_price) return false;
    const closePrice = t.close_price_final || t.close_price;
    const entryPrice = t.entry_price;
    const takePrice = t.take_price;
    
    if (t.direction === 'Long') {
      return closePrice < takePrice && closePrice > entryPrice;
    } else {
      return closePrice > takePrice && closePrice < entryPrice;
    }
  }).length;

  const earlyExitRate = closedTrades.length > 0 ? (earlyExits / closedTrades.length * 100) : 0;

  // Partial close usage
  const tradesWithPartials = closedTrades.filter(t => {
    try {
      const partials = t.partials || t.partial_closes;
      if (!partials) return false;
      const parsed = JSON.parse(partials);
      return parsed.length > 0;
    } catch {
      return false;
    }
  }).length;

  const partialCloseRate = closedTrades.length > 0 ? (tradesWithPartials / closedTrades.length * 100) : 0;

  return (
    <div className="space-y-4 mt-4">
      {/* Quality Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatsCard 
          title="Avg Win"
          value={avgWin > 0 ? `+$${formatNumber(avgWin)}` : '—'}
          icon={TrendingUp}
          valueColor="text-emerald-400"
        />
        <StatsCard 
          title="Avg Loss"
          value={avgLoss > 0 ? `-$${formatNumber(avgLoss)}` : '—'}
          icon={TrendingDown}
          valueColor="text-red-400"
        />
        <StatsCard 
          title="Payoff Ratio"
          value={payoffRatio > 0 ? payoffRatio.toFixed(2) : '—'}
          icon={Target}
          valueColor={payoffRatio >= 2 ? 'text-emerald-400' : payoffRatio >= 1 ? 'text-yellow-400' : 'text-red-400'}
        />
        <StatsCard 
          title="Expectancy"
          value={expectancy !== 0 ? `$${formatNumber(expectancy)}` : '—'}
          subtitle="Per Trade"
          valueColor={expectancy > 0 ? 'text-emerald-400' : 'text-red-400'}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatsCard 
          title="Largest Win"
          value={largestWin > 0 ? `+$${formatNumber(largestWin)}` : '—'}
          valueColor="text-emerald-400"
        />
        <StatsCard 
          title="Largest Loss"
          value={largestLoss < 0 ? `-$${formatNumber(Math.abs(largestLoss))}` : '—'}
          valueColor="text-red-400"
        />
        <StatsCard 
          title="BE Rate"
          value={`${breakEvenRate.toFixed(1)}%`}
          subtitle={`${breakevens.length} trades`}
        />
        <StatsCard 
          title="Win Streak"
          value={maxWinStreak}
          subtitle={`Loss: ${maxLossStreak}`}
        />
      </div>

      {/* Execution Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-4 border border-[#2a2a2a]">
          <p className="text-xs text-[#888] mb-2">Early Exit Rate</p>
          <p className="text-2xl font-bold text-amber-400">{earlyExitRate.toFixed(1)}%</p>
          <p className="text-[10px] text-[#666] mt-1">{earlyExits} trades closed before TP</p>
        </div>
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-4 border border-[#2a2a2a]">
          <p className="text-xs text-[#888] mb-2">Partial Close Usage</p>
          <p className="text-2xl font-bold text-blue-400">{partialCloseRate.toFixed(1)}%</p>
          <p className="text-[10px] text-[#666] mt-1">{tradesWithPartials} trades with partials</p>
        </div>
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-4 border border-[#2a2a2a]">
          <p className="text-xs text-[#888] mb-2">Avg Trade Duration</p>
          <p className="text-2xl font-bold text-[#c0c0c0]">
            {closedTrades.length > 0 
              ? (() => {
                  const avgMinutes = closedTrades.reduce((s, t) => s + (t.actual_duration_minutes || 0), 0) / closedTrades.length;
                  const hours = Math.floor(avgMinutes / 60);
                  const mins = Math.floor(avgMinutes % 60);
                  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
                })()
              : '—'
            }
          </p>
        </div>
      </div>

      {/* Distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* R-Multiple Distribution */}
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
          <h3 className="text-[#c0c0c0] text-sm font-medium mb-4">R-Multiple Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rDistribution}>
                <XAxis 
                  dataKey="bucket" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fill: '#666', fontSize: 9 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fill: '#666', fontSize: 10 }}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload?.[0]) {
                      return (
                        <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3">
                          <p className="text-[#c0c0c0] text-sm font-bold">{payload[0].payload.bucket}R</p>
                          <p className="text-[#888] text-xs">{payload[0].value} trades</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {rDistribution.map((entry, index) => {
                    let fill = '#888';
                    if (entry.bucket.includes('<-') || entry.bucket.startsWith('-')) fill = '#ef4444';
                    else if (entry.bucket === '0 to 1') fill = '#f59e0b';
                    else if (parseFloat(entry.bucket.split(' ')[0]) >= 1) fill = '#10b981';
                    
                    return <Cell key={index} fill={fill} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* PNL Distribution */}
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
          <h3 className="text-[#c0c0c0] text-sm font-medium mb-4">PNL Distribution ($)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pnlDistribution}>
                <XAxis 
                  dataKey="bucket" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fill: '#666', fontSize: 9 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fill: '#666', fontSize: 10 }}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload?.[0]) {
                      return (
                        <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3">
                          <p className="text-[#c0c0c0] text-sm font-bold">${payload[0].payload.bucket}</p>
                          <p className="text-[#888] text-xs">{payload[0].value} trades</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {pnlDistribution.map((entry, index) => {
                    let fill = '#888';
                    if (entry.bucket.includes('<-') || entry.bucket.startsWith('-')) fill = '#ef4444';
                    else if (entry.bucket.startsWith('0')) fill = '#888';
                    else fill = '#10b981';
                    
                    return <Cell key={index} fill={fill} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}