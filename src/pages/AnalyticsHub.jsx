import { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import GlobalTimeFilter from '../components/analytics/GlobalTimeFilter';
import CommandKPIs from '../components/analytics/CommandKPIs';
import EquityDrawdownCharts from '../components/analytics/EquityDrawdownCharts';
import TradesDrawer from '../components/analytics/TradesDrawer';
import Distributions from '../components/analytics/Distributions';
import BestWorst from '../components/analytics/BestWorst';
import DisciplinePsychology from '../components/analytics/DisciplinePsychology';
import AIInsights from '../components/analytics/AIInsights';
import TradingCalendar from '../components/analytics/TradingCalendar';
import ExitMetrics from '../components/analytics/ExitMetrics';
import PeriodComparison from '../components/analytics/PeriodComparison';
import TiltDetector from '../components/analytics/TiltDetector';
import BestConditions from '../components/analytics/BestConditions';
import MistakeCost from '../components/analytics/MistakeCost';
import CoinDistributions from '../components/analytics/CoinDistributions';
import AIHealthCheck from '../components/analytics/AIHealthCheck';
import TradeDurationAnalysis from '../components/analytics/TradeDurationAnalysis';
import {
  calculateClosedMetrics,
  calculateEquityCurve,
  calculateMaxDrawdown,
  calculateOpenMetrics,
  calculateDisciplineScore,
  calculateExitMetrics,
  formatNumber,
  formatPercent
} from '../components/analytics/analyticsCalculations';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, ReferenceLine } from 'recharts';
import { Clock, TrendingUp, TrendingDown, Coins, Target, Shield, Brain, Sparkles, AlertTriangle } from 'lucide-react';
import { cn } from "@/lib/utils";
import { getTradesForActiveProfile } from '../components/utils/profileUtils';

export default function AnalyticsHub() {
  const [timeFilter, setTimeFilter] = useState({ from: null, to: null, coins: [], strategies: [], timezone: 'UTC' });
  const [drawer, setDrawer] = useState({ isOpen: false, title: '', trades: [] });

  const { data: allTrades = [], isLoading } = useQuery({
    queryKey: ['trades'],
    queryFn: () => getTradesForActiveProfile(),
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['userProfiles'],
    queryFn: () => base44.entities.UserProfile.list('-created_date', 10),
  });

  const activeProfile = profiles.find(p => p.is_active);
  const startingBalance = activeProfile?.starting_balance || 100000;
  const closedPnl = allTrades.filter(t => t.close_price).reduce((s, t) => s + (t.pnl_usd || 0), 0);
  const openRealizedPnl = allTrades.filter(t => !t.close_price).reduce((s, t) => s + (t.realized_pnl_usd || 0), 0);
  const currentBalance = startingBalance + closedPnl + openRealizedPnl;

  const filteredTrades = useMemo(() => {
    let filtered = allTrades.filter(t => t.close_price);
    
    if (timeFilter.from && timeFilter.to) {
      filtered = filtered.filter(t => {
        const tradeDate = new Date(t.date_close || t.date_open || t.date);
        return tradeDate >= timeFilter.from && tradeDate <= timeFilter.to;
      });
    }
    
    if (timeFilter.coins && timeFilter.coins.length > 0) {
      filtered = filtered.filter(t => timeFilter.coins.includes(t.coin));
    }
    
    if (timeFilter.strategies && timeFilter.strategies.length > 0) {
      filtered = filtered.filter(t => timeFilter.strategies.includes(t.strategy_tag));
    }
    
    return filtered;
  }, [allTrades, timeFilter]);

  const metrics = useMemo(() => {
    const closedMetrics = calculateClosedMetrics(filteredTrades);
    const equityCurve = calculateEquityCurve(filteredTrades, startingBalance);
    const maxDrawdown = calculateMaxDrawdown(equityCurve, startingBalance);
    const disciplineScore = calculateDisciplineScore(filteredTrades);
    const exitMetrics = calculateExitMetrics(filteredTrades);
    
    const allOpenTrades = allTrades.filter(t => !t.close_price);
    const openMetrics = calculateOpenMetrics(allOpenTrades, currentBalance);
    
    return {
      ...closedMetrics,
      maxDrawdown,
      openCount: allOpenTrades.length,
      ...openMetrics,
      disciplineScore,
      equityCurve,
      exitMetrics
    };
  }, [filteredTrades, allTrades, currentBalance, startingBalance]);

  const pnlByDay = useMemo(() => {
    const dayMap = {};
    filteredTrades.forEach(t => {
      const day = new Date(t.date_close || t.date).toLocaleDateString('en-US', { weekday: 'short' });
      dayMap[day] = (dayMap[day] || 0) + (t.pnl_usd || 0);
    });
    
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map(day => ({
      day,
      pnl: dayMap[day] || 0
    }));
  }, [filteredTrades]);

  const pnlByHour = useMemo(() => {
    const hourMap = {};
    filteredTrades.forEach(t => {
      const hour = new Date(t.date_close || t.date).getHours();
      hourMap[hour] = (hourMap[hour] || 0) + (t.pnl_usd || 0);
    });
    
    return Object.entries(hourMap).map(([hour, pnl]) => ({
      hour: `${hour}:00`,
      pnl
    })).sort((a, b) => parseInt(a.hour) - parseInt(b.hour));
  }, [filteredTrades]);

  const strategyPerf = useMemo(() => {
    const stratMap = {};
    filteredTrades.filter(t => t.strategy_tag).forEach(t => {
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

  const coinPerf = useMemo(() => {
    const coinMap = {};
    filteredTrades.filter(t => t.coin).forEach(t => {
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

  const handleDrillDown = (title, trades) => {
    setDrawer({ isOpen: true, title, trades });
  };
  
  const sparklines = useMemo(() => {
    const closed = filteredTrades.sort((a, b) => 
      new Date(a.date_close || a.date) - new Date(b.date_close || b.date)
    );
    
    if (closed.length < 7) return null;
    
    const points = 7;
    const step = Math.floor(closed.length / points);
    
    const netPnl = [];
    const winrate = [];
    
    for (let i = 0; i < points; i++) {
      const endIdx = (i + 1) * step;
      const subset = closed.slice(0, endIdx);
      const pnl = subset.reduce((s, t) => s + (t.pnl_usd || 0), 0);
      const wins = subset.filter(t => (t.pnl_usd || 0) > 0).length;
      const wr = subset.length > 0 ? (wins / subset.length) * 100 : 0;
      
      netPnl.push({ value: pnl });
      winrate.push({ value: wr });
    }
    
    return { netPnl, winrate };
  }, [filteredTrades]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[#888]">Loading analytics...</div>
      </div>
    );
  }

  if (filteredTrades.length < 3) {
    return (
      <div className="max-w-7xl mx-auto px-4">
        <GlobalTimeFilter 
          onFilterChange={setTimeFilter}
          allTrades={allTrades}
        />
        <div className="mt-4">
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
    <div className="min-h-screen relative bg-[#0a0a0a]">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#0d120d] to-[#0a0f0a]" />
        
        <div className="absolute inset-0 top-0 h-[30%] opacity-[0.1]" style={{
          backgroundImage: `linear-gradient(to right, rgba(220,220,220,0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(220,220,220,0.5) 1px, transparent 1px)`,
          backgroundSize: '80px 80px'
        }} />
        
        <div className="absolute inset-0 top-[30%] h-[40%] opacity-[0.13]" style={{
          backgroundImage: `linear-gradient(to right, rgba(100,180,140,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(100,180,140,0.6) 1px, transparent 1px)`,
          backgroundSize: '80px 80px'
        }} />
        
        <div className="absolute inset-0 top-[70%] h-[30%] opacity-[0.16]" style={{
          backgroundImage: `linear-gradient(to right, rgba(16,185,129,0.8) 1px, transparent 1px), linear-gradient(to bottom, rgba(16,185,129,0.8) 1px, transparent 1px)`,
          backgroundSize: '80px 80px'
        }} />

        <div className="absolute inset-0 opacity-[0.15]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='150' height='150' viewBox='0 0 150 150' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='12' cy='18' r='1.5' fill='white'/%3E%3Ccircle cx='68' cy='9' r='1' fill='white'/%3E%3Ccircle cx='112' cy='35' r='1.3' fill='white'/%3E%3Ccircle cx='27' cy='62' r='0.9' fill='white'/%3E%3Ccircle cx='130' cy='73' r='1.6' fill='white'/%3E%3Ccircle cx='45' cy='107' r='1.1' fill='white'/%3E%3C/svg%3E")`,
          backgroundSize: '150px 150px'
        }} />

        <div className="absolute top-[10%] right-[20%] w-[800px] h-[800px] bg-gradient-radial from-white/6 via-[#c0c0c0]/3 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
        <div className="absolute bottom-0 left-0 right-0 h-[60vh] bg-gradient-to-t from-emerald-500/18 via-emerald-500/8 to-transparent blur-2xl" />
        <div className="absolute bottom-[5%] left-[10%] w-[900px] h-[900px] bg-gradient-radial from-emerald-400/20 via-emerald-500/10 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '7s', animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-4">
        <GlobalTimeFilter 
          onFilterChange={setTimeFilter}
          allTrades={allTrades}
        />

        <CommandKPIs 
          metrics={metrics} 
          tradesCount={filteredTrades.length}
          onClick={(label) => {
            if (label === 'Net PNL') handleDrillDown('All Trades', filteredTrades);
          }}
          showWarning={filteredTrades.length < 10}
        />

        <EquityDrawdownCharts equityCurve={metrics.equityCurve} startBalance={startingBalance} />

        <ExitMetrics metrics={metrics.exitMetrics} onDrillDown={handleDrillDown} allTrades={filteredTrades} />

        <AIHealthCheck metrics={metrics} trades={filteredTrades} />

        <PeriodComparison trades={filteredTrades} />

        <BestConditions trades={filteredTrades} />

        <MistakeCost trades={filteredTrades} />

        <TradingCalendar trades={filteredTrades} userTimezone={timeFilter.timezone || 'UTC'} />

        <CoinDistributions trades={filteredTrades} onDrillDown={handleDrillDown} />

        <Distributions trades={filteredTrades} onDrillDown={handleDrillDown} />

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-6">
            <h3 className="text-lg font-bold text-[#c0c0c0] mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-400" />
              PNL by Day
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={pnlByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" opacity={0.3} />
                <XAxis dataKey="day" stroke="#666" tick={{ fill: '#c0c0c0', fontSize: 11 }} />
                <YAxis stroke="#666" tick={{ fill: '#c0c0c0', fontSize: 11 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#c0c0c0' }}
                  labelStyle={{ color: '#c0c0c0' }}
                  itemStyle={{ color: '#c0c0c0' }}
                  formatter={(value) => [`$${formatNumber(value)}`, 'PNL']}
                  cursor={{ fill: 'rgba(192, 192, 192, 0.1)' }}
                />
                <ReferenceLine y={0} stroke="#c0c0c0" strokeDasharray="3 3" opacity={0.5} />
                <Bar 
                  dataKey="pnl" 
                  radius={[4, 4, 0, 0]}
                >
                  {pnlByDay.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-6">
            <h3 className="text-lg font-bold text-[#c0c0c0] mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-400" />
              PNL by Hour
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={pnlByHour}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" opacity={0.3} />
                <XAxis dataKey="hour" stroke="#666" tick={{ fill: '#c0c0c0', fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                <YAxis stroke="#666" tick={{ fill: '#c0c0c0', fontSize: 11 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#c0c0c0' }}
                  labelStyle={{ color: '#c0c0c0' }}
                  itemStyle={{ color: '#c0c0c0' }}
                  formatter={(value) => [`$${formatNumber(value)}`, 'PNL']}
                  cursor={{ fill: 'rgba(192, 192, 192, 0.1)' }}
                />
                <ReferenceLine y={0} stroke="#c0c0c0" strokeDasharray="3 3" opacity={0.5} />
                <Bar 
                  dataKey="pnl" 
                  radius={[4, 4, 0, 0]}
                >
                  {pnlByHour.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <TradeDurationAnalysis trades={filteredTrades} />

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-6">
            <h3 className="text-lg font-bold text-[#c0c0c0] mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-violet-400" />
              Strategy Performance
            </h3>
            {strategyPerf.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 mx-auto mb-3 flex items-center justify-center">
                  <Target className="w-6 h-6 text-violet-400/60" />
                </div>
                <p className="text-[#888] text-sm mb-1">No strategy data</p>
                <p className="text-[#666] text-xs">Tag trades with strategies</p>
              </div>
            ) : (
              <div className="space-y-3">
                {strategyPerf.slice(0, 5).map((strat) => (
                <div 
                key={strat.name}
                onClick={() => handleDrillDown(`Strategy: ${strat.name}`, filteredTrades.filter(t => t.strategy_tag === strat.name))}
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

          <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-6">
            <h3 className="text-lg font-bold text-[#c0c0c0] mb-4 flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-400" />
              Top/Bottom Coins
            </h3>
            <div className="space-y-4">
              <div>
                <div className="text-xs text-emerald-400 mb-2 font-medium">BEST</div>
                {coinPerf.best.length === 0 ? (
                  <div className="text-center py-4">
                    <div className="text-2xl mb-1">🏆</div>
                    <div className="text-xs text-[#666]">No winners yet</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {coinPerf.best.slice(0, 3).map((coin) => (
                     <div 
                       key={coin.name}
                       onClick={() => handleDrillDown(`Coin: ${coin.name}`, filteredTrades.filter(t => t.coin?.replace('USDT', '') === coin.name))}
                       className="flex justify-between items-center text-sm p-2 rounded hover:bg-[#1a1a1a] transition-colors cursor-pointer"
                     >
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
                  <div className="text-center py-4">
                    <div className="text-2xl mb-1">✨</div>
                    <div className="text-xs text-[#666]">No losers yet</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {coinPerf.worst.slice(0, 3).map((coin) => (
                      <div 
                        key={coin.name}
                        onClick={() => handleDrillDown(`Coin: ${coin.name}`, filteredTrades.filter(t => t.coin?.replace('USDT', '') === coin.name))}
                        className="flex justify-between items-center text-sm p-2 rounded hover:bg-[#1a1a1a] transition-colors cursor-pointer"
                      >
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

        <BestWorst trades={filteredTrades} onDrillDown={handleDrillDown} />

        <DisciplinePsychology trades={filteredTrades} disciplineScore={metrics.disciplineScore} />

        <div className="mt-6">
          <AIInsights trades={filteredTrades} metrics={metrics} />
        </div>
      </div>

      <TradesDrawer 
        isOpen={drawer.isOpen}
        onClose={() => setDrawer({ isOpen: false, title: '', trades: [] })}
        title={drawer.title}
        trades={drawer.trades}
      />
    </div>
  );
}