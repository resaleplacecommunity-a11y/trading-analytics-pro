import { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import GlobalTimeFilter from '../components/analytics/GlobalTimeFilter';
import CommandKPIs from '../components/analytics/CommandKPIs';
import EquityDrawdownCharts from '../components/analytics/EquityDrawdownCharts';
import DrillDownModal from '../components/analytics/DrillDownModal';
import {
  calculateClosedMetrics,
  calculateEquityCurve,
  calculateMaxDrawdown,
  calculateOpenMetrics,
  calculateDisciplineScore,
  formatNumber,
  formatPercent
} from '../components/analytics/analyticsCalculations';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Clock, TrendingUp, TrendingDown, Coins, Target, Shield, Brain, Sparkles } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function AnalyticsHub() {
  const [timeFilter, setTimeFilter] = useState({ from: null, to: null });
  const [activeDataset, setActiveDataset] = useState('closed');
  const [drillDown, setDrillDown] = useState({ isOpen: false, title: '', trades: [], metric: '' });

  const { data: allTrades = [], isLoading } = useQuery({
    queryKey: ['trades'],
    queryFn: () => base44.entities.Trade.list('-date', 1000)
  });

  // Calculate current balance
  const totalPnl = allTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
  const currentBalance = 100000 + totalPnl;

  // Filter trades by time range
  const filteredTrades = useMemo(() => {
    let filtered = allTrades;
    
    if (timeFilter.from && timeFilter.to) {
      filtered = filtered.filter(t => {
        const tradeDate = new Date(t.date_close || t.date_open || t.date);
        return tradeDate >= timeFilter.from && tradeDate <= timeFilter.to;
      });
    }
    
    // Filter by dataset
    if (activeDataset === 'closed') {
      filtered = filtered.filter(t => t.close_price);
    } else if (activeDataset === 'open') {
      filtered = filtered.filter(t => !t.close_price);
    }
    
    return filtered;
  }, [allTrades, timeFilter, activeDataset]);

  // Calculate all metrics
  const metrics = useMemo(() => {
    const closed = filteredTrades.filter(t => t.close_price);
    const open = filteredTrades.filter(t => !t.close_price);
    
    const closedMetrics = calculateClosedMetrics(closed);
    const equityCurve = calculateEquityCurve(closed, 100000);
    const maxDrawdown = calculateMaxDrawdown(equityCurve);
    const openMetrics = calculateOpenMetrics(open, currentBalance);
    const disciplineScore = calculateDisciplineScore(filteredTrades);
    
    return {
      ...closedMetrics,
      maxDrawdown,
      openCount: open.length,
      ...openMetrics,
      disciplineScore,
      equityCurve
    };
  }, [filteredTrades, currentBalance]);

  // PNL by Day
  const pnlByDay = useMemo(() => {
    const dayMap = {};
    filteredTrades.filter(t => t.close_price).forEach(t => {
      const day = new Date(t.date_close || t.date).toLocaleDateString('en-US', { weekday: 'short' });
      dayMap[day] = (dayMap[day] || 0) + (t.pnl_usd || 0);
    });
    
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map(day => ({
      day,
      pnl: dayMap[day] || 0
    }));
  }, [filteredTrades]);

  // PNL by Hour
  const pnlByHour = useMemo(() => {
    const hourMap = {};
    filteredTrades.filter(t => t.close_price).forEach(t => {
      const hour = new Date(t.date_close || t.date).getHours();
      hourMap[hour] = (hourMap[hour] || 0) + (t.pnl_usd || 0);
    });
    
    return Object.entries(hourMap).map(([hour, pnl]) => ({
      hour: `${hour}:00`,
      pnl
    })).sort((a, b) => parseInt(a.hour) - parseInt(b.hour));
  }, [filteredTrades]);

  // Strategy Performance
  const strategyPerf = useMemo(() => {
    const stratMap = {};
    filteredTrades.filter(t => t.close_price && t.strategy_tag).forEach(t => {
      const strat = t.strategy_tag;
      if (!stratMap[strat]) {
        stratMap[strat] = { pnl: 0, trades: 0, wins: 0 };
      }
      stratMap[strat].pnl += t.pnl_usd || 0;
      stratMap[strat].trades += 1;
      if ((t.pnl_usd || 0) > 0) stratMap[strat].wins += 1;
    });
    
    return Object.entries(stratMap).map(([name, data]) => ({
      name,
      pnl: data.pnl,
      trades: data.trades,
      winrate: (data.wins / data.trades) * 100
    })).sort((a, b) => b.pnl - a.pnl);
  }, [filteredTrades]);

  // Coin Performance
  const coinPerf = useMemo(() => {
    const coinMap = {};
    filteredTrades.filter(t => t.close_price && t.coin).forEach(t => {
      const coin = t.coin.replace('USDT', '');
      if (!coinMap[coin]) {
        coinMap[coin] = { pnl: 0, trades: 0, wins: 0 };
      }
      coinMap[coin].pnl += t.pnl_usd || 0;
      coinMap[coin].trades += 1;
      if ((t.pnl_usd || 0) > 0) coinMap[coin].wins += 1;
    });
    
    const all = Object.entries(coinMap).map(([name, data]) => ({
      name,
      pnl: data.pnl,
      trades: data.trades,
      winrate: (data.wins / data.trades) * 100
    }));
    
    return {
      best: all.filter(c => c.pnl > 0).sort((a, b) => b.pnl - a.pnl).slice(0, 5),
      worst: all.filter(c => c.pnl < 0).sort((a, b) => a.pnl - b.pnl).slice(0, 5)
    };
  }, [filteredTrades]);

  const handleDrillDown = (title, trades, metric) => {
    setDrillDown({ isOpen: true, title, trades, metric });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[#888]">Loading analytics...</div>
      </div>
    );
  }

  if (filteredTrades.length < 3) {
    return (
      <div>
        <GlobalTimeFilter 
          onFilterChange={setTimeFilter}
          activeDataset={activeDataset}
          onDatasetChange={setActiveDataset}
        />
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="backdrop-blur-md bg-gradient-to-br from-violet-500/10 via-[#1a1a1a] to-purple-500/10 rounded-2xl border border-violet-500/30 p-12 text-center">
            <Sparkles className="w-16 h-16 mx-auto mb-4 text-violet-400" />
            <h3 className="text-2xl font-bold text-[#c0c0c0] mb-2">Insufficient Data</h3>
            <p className="text-[#888]">Add at least 3 closed trades to see premium analytics</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#0d0d0d] to-[#0a0a0a]" />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(to right, #c0c0c0 1px, transparent 1px), linear-gradient(to bottom, #c0c0c0 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }} />
        <div className="absolute top-[20%] right-[10%] w-[600px] h-[600px] bg-gradient-radial from-violet-500/8 via-transparent to-transparent blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[10%] left-[15%] w-[500px] h-[500px] bg-gradient-radial from-emerald-500/6 via-transparent to-transparent blur-3xl animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
      </div>

      <GlobalTimeFilter 
        onFilterChange={setTimeFilter}
        activeDataset={activeDataset}
        onDatasetChange={setActiveDataset}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        <CommandKPIs metrics={metrics} onClick={(label) => {
          if (label === 'Net PNL') handleDrillDown('All Trades', filteredTrades.filter(t => t.close_price), 'pnl');
        }} />

        <EquityDrawdownCharts equityCurve={metrics.equityCurve} startBalance={100000} />

        {/* Performance Breakdowns Grid */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* PNL by Day */}
          <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-6">
            <h3 className="text-lg font-bold text-[#c0c0c0] mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-400" />
              PNL by Day
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pnlByDay}>
                <XAxis dataKey="day" stroke="#666" tick={{ fill: '#888', fontSize: 11 }} />
                <YAxis stroke="#666" tick={{ fill: '#888', fontSize: 11 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111', border: '1px solid #2a2a2a', borderRadius: '8px' }}
                  labelStyle={{ color: '#888' }}
                  formatter={(value) => [`$${formatNumber(value)}`, 'PNL']}
                />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {pnlByDay.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* PNL by Hour */}
          <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-6">
            <h3 className="text-lg font-bold text-[#c0c0c0] mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-400" />
              PNL by Hour
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pnlByHour}>
                <XAxis dataKey="hour" stroke="#666" tick={{ fill: '#888', fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                <YAxis stroke="#666" tick={{ fill: '#888', fontSize: 11 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111', border: '1px solid #2a2a2a', borderRadius: '8px' }}
                  labelStyle={{ color: '#888' }}
                  formatter={(value) => [`$${formatNumber(value)}`, 'PNL']}
                />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {pnlByHour.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Strategy & Coin Performance */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Strategy Performance */}
          <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-6">
            <h3 className="text-lg font-bold text-[#c0c0c0] mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-violet-400" />
              Strategy Performance
            </h3>
            {strategyPerf.length === 0 ? (
              <div className="text-center py-8 text-[#666]">No strategy data</div>
            ) : (
              <div className="space-y-3">
                {strategyPerf.slice(0, 5).map((strat) => (
                  <div 
                    key={strat.name}
                    onClick={() => handleDrillDown(`Strategy: ${strat.name}`, filteredTrades.filter(t => t.strategy_tag === strat.name && t.close_price), 'strategy')}
                    className="flex items-center justify-between p-3 bg-[#111]/50 rounded-lg hover:bg-[#1a1a1a] transition-all cursor-pointer border border-transparent hover:border-[#c0c0c0]/20"
                  >
                    <div>
                      <div className="font-medium text-[#c0c0c0]">{strat.name}</div>
                      <div className="text-xs text-[#666]">{strat.trades} trades • {strat.winrate.toFixed(0)}% WR</div>
                    </div>
                    <div className={cn(
                      "text-lg font-bold",
                      strat.pnl >= 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                      {strat.pnl >= 0 ? '+' : ''}${formatNumber(Math.abs(strat.pnl))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Coin Performance */}
          <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-6">
            <h3 className="text-lg font-bold text-[#c0c0c0] mb-4 flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-400" />
              Top/Bottom Coins
            </h3>
            <div className="space-y-4">
              <div>
                <div className="text-xs text-emerald-400 mb-2 font-medium">BEST</div>
                {coinPerf.best.length === 0 ? (
                  <div className="text-xs text-[#666]">No profitable coins</div>
                ) : (
                  <div className="space-y-2">
                    {coinPerf.best.slice(0, 3).map((coin) => (
                      <div key={coin.name} className="flex justify-between items-center text-sm">
                        <span className="text-[#c0c0c0]">{coin.name}</span>
                        <span className="text-emerald-400 font-bold">+${formatNumber(coin.pnl)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs text-red-400 mb-2 font-medium">WORST</div>
                {coinPerf.worst.length === 0 ? (
                  <div className="text-xs text-[#666]">No losing coins</div>
                ) : (
                  <div className="space-y-2">
                    {coinPerf.worst.slice(0, 3).map((coin) => (
                      <div key={coin.name} className="flex justify-between items-center text-sm">
                        <span className="text-[#c0c0c0]">{coin.name}</span>
                        <span className="text-red-400 font-bold">-${formatNumber(Math.abs(coin.pnl))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Open Trades Risk Summary */}
        {metrics.openCount > 0 && (
          <div className="backdrop-blur-md bg-gradient-to-br from-red-500/10 via-[#1a1a1a] to-emerald-500/10 rounded-xl border border-[#c0c0c0]/20 p-6 mb-6">
            <h3 className="text-lg font-bold text-[#c0c0c0] mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-400" />
              Open Positions Exposure
            </h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-[#111]/50 rounded-lg p-4">
                <div className="text-xs text-[#666] mb-1">Total Risk</div>
                <div className="text-xl font-bold text-red-400">${formatNumber(metrics.totalRiskUsd)}</div>
                <div className="text-xs text-red-400/70">{metrics.totalRiskPercent.toFixed(1)}%</div>
              </div>
              <div className="bg-[#111]/50 rounded-lg p-4">
                <div className="text-xs text-[#666] mb-1">Potential Profit</div>
                <div className="text-xl font-bold text-emerald-400">${formatNumber(metrics.totalPotentialUsd)}</div>
                <div className="text-xs text-emerald-400/70">{metrics.totalPotentialPercent.toFixed(1)}%</div>
              </div>
              <div className="bg-[#111]/50 rounded-lg p-4">
                <div className="text-xs text-[#666] mb-1">Total RR</div>
                {metrics.totalRR === 'NO_RISK' ? (
                  <div className="text-sm font-bold text-violet-400 uppercase tracking-wide">NO RISK BRO ONLY PROFIT</div>
                ) : (
                  <div className="text-xl font-bold text-[#c0c0c0]">1:{Math.round(metrics.totalRR)}</div>
                )}
              </div>
              <div className="bg-[#111]/50 rounded-lg p-4">
                <div className="text-xs text-[#666] mb-1">Open Trades</div>
                <div className="text-xl font-bold text-amber-400">{metrics.openCount}</div>
              </div>
            </div>
          </div>
        )}

        {/* Discipline Score */}
        <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-6">
          <h3 className="text-lg font-bold text-[#c0c0c0] mb-4 flex items-center gap-2">
            <Brain className="w-5 h-5 text-violet-400" />
            Discipline & Psychology
          </h3>
          <div className="flex items-center gap-6">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="56" stroke="#2a2a2a" strokeWidth="8" fill="none" />
                <circle 
                  cx="64" 
                  cy="64" 
                  r="56" 
                  stroke={metrics.disciplineScore >= 70 ? "#10b981" : metrics.disciplineScore >= 50 ? "#f59e0b" : "#ef4444"}
                  strokeWidth="8" 
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 56}`}
                  strokeDashoffset={`${2 * Math.PI * 56 * (1 - metrics.disciplineScore / 100)}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className={cn(
                    "text-3xl font-bold",
                    metrics.disciplineScore >= 70 ? "text-emerald-400" : metrics.disciplineScore >= 50 ? "text-amber-400" : "text-red-400"
                  )}>
                    {metrics.disciplineScore}
                  </div>
                  <div className="text-xs text-[#666]">/100</div>
                </div>
              </div>
            </div>
            <div className="flex-1">
              <div className="space-y-2 text-sm text-[#888]">
                <p>• Journal entries with detailed analysis</p>
                <p>• Consistent risk management per trade</p>
                <p>• Rule compliance and plan adherence</p>
                <p>• Emotional awareness and control</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DrillDownModal 
        isOpen={drillDown.isOpen}
        onClose={() => setDrillDown({ isOpen: false, title: '', trades: [], metric: '' })}
        title={drillDown.title}
        trades={drillDown.trades}
        metric={drillDown.metric}
      />
    </div>
  );
}