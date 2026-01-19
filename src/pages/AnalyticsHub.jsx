import { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import GlobalTimeFilter from '../components/analytics/GlobalTimeFilter';
import { 
  getTodayInUserTz, 
  getTodayClosedTrades, 
  getTodayOpenedTrades,
  getTodayPnl,
  parseTradeDateToUserTz
} from '../components/utils/dateUtils';
import CommandKPIs from '../components/analytics/CommandKPIs';
import EquityDrawdownCharts from '../components/analytics/EquityDrawdownCharts';
import TradesDrawer from '../components/analytics/TradesDrawer';
import Distributions from '../components/analytics/DistributionsCollapsible';
import BestWorst from '../components/analytics/BestWorstSimple';
import DisciplinePsychology from '../components/analytics/DisciplineSimple';
import AIInsightsPremium from '../components/analytics/AIInsightsPremium';
import TradingCalendar from '../components/analytics/TradingCalendar';
import ExitMetrics from '../components/analytics/ExitMetrics';
import PeriodComparison from '../components/analytics/PeriodComparisonCollapsible';
import BestConditions from '../components/analytics/BestConditions';
import MistakeCost from '../components/analytics/MistakeCost';
import CoinDistributions from '../components/analytics/CoinDistributions';
import TradeDurationAnalysis from '../components/analytics/TradeDurationFull';
import CollapsibleChart from '../components/analytics/CollapsibleChart';
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
import RiskViolationBanner from '../components/RiskViolationBanner';

export default function AnalyticsHub() {
  const [timeFilter, setTimeFilter] = useState({ from: null, to: null, coins: [], strategies: [], timezone: 'UTC' });
  const [drawer, setDrawer] = useState({ isOpen: false, title: '', trades: [] });

  const { data: allTrades = [], isLoading } = useQuery({
    queryKey: ['trades'],
    queryFn: () => getTradesForActiveProfile(),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 30 * 60 * 1000,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['userProfiles', user?.email],
    queryFn: async () => {
      if (!user) return [];
      return base44.entities.UserProfile.filter({ created_by: user.email }, '-created_date', 10);
    },
    enabled: !!user,
    staleTime: 15 * 60 * 1000,
  });

  const userTimezone = user?.preferred_timezone || timeFilter.timezone || 'UTC';

  const activeProfile = profiles.find(p => p.is_active);
  const startingBalance = activeProfile?.starting_balance || 100000;
  const closedPnl = allTrades.filter(t => t.close_price).reduce((s, t) => s + (t.pnl_usd || 0), 0);
  const openRealizedPnl = allTrades.filter(t => !t.close_price).reduce((s, t) => s + (t.realized_pnl_usd || 0), 0);
  const currentBalance = startingBalance + closedPnl + openRealizedPnl;

  const filteredTrades = useMemo(() => {
    let filtered = allTrades.filter(t => t.close_price);
    
    if (timeFilter.from && timeFilter.to) {
      filtered = filtered.filter(t => {
        const dateStr = t.date_close || t.date_open || t.date;
        if (!dateStr) return false;
        // Compare dates in user timezone
        const tradeDateStr = parseTradeDateToUserTz(dateStr, userTimezone);
        if (!tradeDateStr) return false;
        
        const fromStr = formatInTimeZone(timeFilter.from, userTimezone, 'yyyy-MM-dd');
        const toStr = formatInTimeZone(timeFilter.to, userTimezone, 'yyyy-MM-dd');
        return tradeDateStr >= fromStr && tradeDateStr <= toStr;
      });
    }
    
    if (timeFilter.coins && timeFilter.coins.length > 0) {
      filtered = filtered.filter(t => timeFilter.coins.includes(t.coin));
    }
    
    if (timeFilter.strategies && timeFilter.strategies.length > 0) {
      filtered = filtered.filter(t => timeFilter.strategies.includes(t.strategy_tag));
    }
    
    return filtered;
  }, [allTrades, timeFilter, userTimezone]);

  const metrics = useMemo(() => {
    const closedMetrics = calculateClosedMetrics(filteredTrades, startingBalance);
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

  const today = getTodayInUserTz(userTimezone);
  
  // Risk calculations for banner
  const { data: riskSettings } = useQuery({
    queryKey: ['riskSettings'],
    queryFn: async () => {
      const settings = await base44.entities.RiskSettings.list('-created_date', 1);
      return settings[0] || null;
    },
    staleTime: 10 * 60 * 1000,
  });

  const pnlByDay = useMemo(() => {
    const dayMap = {};
    filteredTrades.forEach(t => {
      const dateStr = t.date_close || t.date_open || t.date;
      if (!dateStr) return;
      const dateObj = new Date(dateStr);
      if (isNaN(dateObj.getTime())) return;
      const day = formatInTimeZone(dateObj, userTimezone, 'EEE');
      dayMap[day] = (dayMap[day] || 0) + (t.pnl_usd || 0);
    });
    
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map(day => ({
      day,
      pnl: dayMap[day] || 0
    }));
  }, [filteredTrades, userTimezone]);

  const tradeOpenByHour = useMemo(() => {
    const hourMap = {};
    allTrades.forEach(t => {
      const dateStr = t.date_open || t.date;
      if (!dateStr) return;
      const dateObj = new Date(dateStr);
      if (isNaN(dateObj.getTime())) return;
      const hour = parseInt(formatInTimeZone(dateObj, userTimezone, 'H'));
      hourMap[hour] = (hourMap[hour] || 0) + 1;
    });
    
    return Object.entries(hourMap).map(([hour, count]) => ({
      hour: `${hour}:00`,
      count
    })).sort((a, b) => parseInt(a.hour) - parseInt(b.hour));
  }, [allTrades, userTimezone]);

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

  // Calculate today's stats for risk violations - using unified utilities
  const todayClosedTrades = getTodayClosedTrades(allTrades, userTimezone);
  const todayPnl = getTodayPnl(allTrades, userTimezone);
  
  // Daily loss percent
  const todayPnlPercent = todayClosedTrades.reduce((s, t) => {
    const pnl = t.pnl_usd || 0;
    if (pnl < 0) {
      const balance = t.account_balance_at_entry || startingBalance;
      return s + ((pnl / balance) * 100);
    }
    return s;
  }, 0);
  
  const todayR = todayClosedTrades.reduce((s, t) => s + (t.r_multiple || 0), 0);
  
  // Trades opened today - using unified utilities
  const todayOpenedTrades = getTodayOpenedTrades(allTrades, userTimezone);
  
  // Loss streak
  const recentTrades = [...allTrades].filter(t => t.close_price).sort((a, b) => 
    new Date(b.date_close || b.date) - new Date(a.date_close || a.date)
  ).slice(0, 10);
  const consecutiveLosses = recentTrades.findIndex(t => (t.pnl_usd || 0) >= 0);
  const lossStreak = consecutiveLosses === -1 ? Math.min(recentTrades.length, riskSettings?.max_consecutive_losses || 3) : consecutiveLosses;
  
  // Calculate violations
  const violations = [];
  if (riskSettings) {
    if (riskSettings.daily_max_loss_percent && todayPnlPercent < -riskSettings.daily_max_loss_percent) {
      violations.push({
        rule: 'Daily Loss Limit',
        value: `${todayPnlPercent.toFixed(2)}%`,
        limit: `${riskSettings.daily_max_loss_percent}%`,
      });
    }
    if (riskSettings.daily_max_r && todayR < -riskSettings.daily_max_r) {
      violations.push({
        rule: 'Daily R Loss',
        value: `${todayR.toFixed(2)}R`,
        limit: `${riskSettings.daily_max_r}R`,
      });
    }
    if (riskSettings.max_trades_per_day && todayOpenedTrades.length >= riskSettings.max_trades_per_day) {
      violations.push({
        rule: 'Max Trades',
        value: `${todayOpenedTrades.length}`,
        limit: `${riskSettings.max_trades_per_day}`,
      });
    }
    if (lossStreak >= (riskSettings.max_consecutive_losses || 3)) {
      violations.push({
        rule: 'Loss Streak',
        value: `${lossStreak} losses`,
        limit: `${riskSettings.max_consecutive_losses}`,
      });
    }
  }

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

  const hasMinimumTrades = () => {
    if (!timeFilter.from || !timeFilter.to) return filteredTrades.length >= 3;
    
    const now = new Date();
    const filterDuration = (timeFilter.to - timeFilter.from) / (1000 * 60 * 60 * 24);
    
    // For Today and Yesterday - allow 0 trades
    if (filterDuration <= 1) return true;
    
    // For Week and Month - need 3+ trades
    return filteredTrades.length >= 3;
  };

  if (!hasMinimumTrades()) {
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
            <p className="text-[#888]">Add at least 3 closed trades for this period to see analytics</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 py-4">
        <GlobalTimeFilter 
          onFilterChange={setTimeFilter}
          allTrades={allTrades}
        />
        
        <RiskViolationBanner violations={violations} />

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

        <BestConditions trades={filteredTrades} />

        <TradingCalendar trades={allTrades} userTimezone={userTimezone} />

        <CoinDistributions trades={filteredTrades} onDrillDown={handleDrillDown} />

        {/* R Distribution + PNL Distribution */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <Distributions trades={filteredTrades} onDrillDown={handleDrillDown} />
        </div>

        {/* PNL by Day + Trade Open Times */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <CollapsibleChart
            title="PNL by Day"
            icon={Clock}
            iconColor="text-emerald-400"
            data={pnlByDay}
            dataKey="pnl"
            xKey="day"
            yFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
            tooltipFormatter={(value) => [`$${formatNumber(value)}`, 'PNL']}
          />

          <CollapsibleChart
            title="Trade Open Times"
            icon={Clock}
            iconColor="text-cyan-400"
            data={tradeOpenByHour}
            dataKey="count"
            xKey="hour"
            yFormatter={(v) => v.toString()}
            tooltipFormatter={(value) => [`${value} trades`, 'Opened']}
          />
        </div>



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
                      {strat.pnl >= 0 ? '+' : '−'}${formatNumber(Math.abs(strat.pnl))}
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
                        <span className="text-red-400 font-bold">−${formatNumber(Math.abs(coin.pnl))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>



        <BestWorst trades={filteredTrades} />

        <TradeDurationAnalysis trades={filteredTrades} onDrillDown={handleDrillDown} />

        <div className="grid grid-cols-2 gap-4">
          <DisciplinePsychology trades={filteredTrades} disciplineScore={metrics.disciplineScore} />
        </div>

        <div className="mt-6">
          <AIInsightsPremium trades={filteredTrades} metrics={metrics} />
        </div>
      </div>

      <TradesDrawer 
        isOpen={drawer.isOpen}
        onClose={() => setDrawer({ isOpen: false, title: '', trades: [] })}
        title={drawer.title}
        trades={drawer.trades}
      />
    </>
  );
}