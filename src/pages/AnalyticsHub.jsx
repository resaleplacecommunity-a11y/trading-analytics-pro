import { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { useTradesQuery } from '../components/hooks/useTradesQuery';
import GlobalTimeFilter from '../components/analytics/GlobalTimeFilter';
import { parseTradeDateToUserTz } from '../components/utils/dateUtils';
import CommandKPIs from '../components/analytics/CommandKPIs';
import EquityDrawdownCharts from '../components/analytics/EquityDrawdownCharts';
import TradesDrawer from '../components/analytics/TradesDrawer';
import Distributions from '../components/analytics/DistributionsCollapsible';
import BestWorst from '../components/analytics/BestWorstSimple';
import DisciplinePsychology from '../components/analytics/DisciplineSimple';
import AIInsightsPremium from '../components/analytics/AIInsightsPremium';
import ExitMetrics from '../components/analytics/ExitMetrics';
import BestConditions from '../components/analytics/BestConditions';
import CoinDistributions from '../components/analytics/CoinDistributions';
import TradeDurationAnalysis from '../components/analytics/TradeDurationFull';
import CollapsibleChart from '../components/analytics/CollapsibleChart';
import DirectionTimeframePerf from '../components/analytics/DirectionTimeframePerf';
import {
  calculateClosedMetrics,
  calculateEquityCurve,
  calculateMaxDrawdown,
  calculateOpenMetrics,
  calculateDisciplineScore,
  calculateExitMetrics,
  formatNumber
} from '../components/analytics/analyticsCalculations';
import { Clock, Target, Coins, Sparkles, BarChart2, TrendingUp, Zap, Brain } from 'lucide-react';
import { cn } from "@/lib/utils";

// Section heading component
function Section({ label, icon: Icon, iconColor = "text-[#555]", children }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pt-2">
        <div className="flex items-center gap-2">
          <Icon className={cn("w-4 h-4", iconColor)} />
          <span className="text-xs font-semibold text-[#888] uppercase tracking-[0.12em]">{label}</span>
        </div>
        <div className="flex-1 h-px bg-[#1e1e1e]" />
      </div>
      {children}
    </div>
  );
}

export default function AnalyticsHub() {
  const [timeFilter, setTimeFilter] = useState({ from: null, to: null, coins: [], strategies: [], timezone: 'UTC' });
  const [drawer, setDrawer] = useState({ isOpen: false, title: '', trades: [] });

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

  const activeProfileId = profiles.find(p => p.is_active)?.id;
  const { data: allTrades = [], isLoading } = useTradesQuery(activeProfileId);

  const userTimezone = user?.preferred_timezone || timeFilter.timezone || 'UTC';
  const activeProfile = profiles.find(p => p.is_active) || null;
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
        const tradeDateStr = parseTradeDateToUserTz(dateStr, userTimezone);
        if (!tradeDateStr) return false;
        const fromStr = formatInTimeZone(timeFilter.from, userTimezone, 'yyyy-MM-dd');
        const toStr = formatInTimeZone(timeFilter.to, userTimezone, 'yyyy-MM-dd');
        return tradeDateStr >= fromStr && tradeDateStr <= toStr;
      });
    }
    if (timeFilter.coins?.length > 0) filtered = filtered.filter(t => timeFilter.coins.includes(t.coin));
    if (timeFilter.strategies?.length > 0) filtered = filtered.filter(t => timeFilter.strategies.includes(t.strategy_tag));
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
    return { ...closedMetrics, maxDrawdown, openCount: allOpenTrades.length, ...openMetrics, disciplineScore, equityCurve, exitMetrics };
  }, [filteredTrades, allTrades, currentBalance, startingBalance]);

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
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => ({ day, pnl: dayMap[day] || 0 }));
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
    return Object.entries(hourMap)
      .map(([hour, count]) => ({ hour: `${hour}:00`, count }))
      .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));
  }, [allTrades, userTimezone]);

  const strategyPerf = useMemo(() => {
    const map = {};
    filteredTrades.filter(t => t.strategy_tag).forEach(t => {
      if (!map[t.strategy_tag]) map[t.strategy_tag] = { pnl: 0, trades: 0, wins: 0 };
      map[t.strategy_tag].pnl += t.pnl_usd || 0;
      map[t.strategy_tag].trades += 1;
      if ((t.pnl_usd || 0) > 0) map[t.strategy_tag].wins += 1;
    });
    return Object.entries(map)
      .map(([name, d]) => ({ name, pnl: d.pnl, trades: d.trades, winrate: (d.wins / d.trades) * 100 }))
      .sort((a, b) => b.pnl - a.pnl);
  }, [filteredTrades]);

  const coinPerf = useMemo(() => {
    const map = {};
    filteredTrades.filter(t => t.coin).forEach(t => {
      const coin = t.coin.replace('USDT', '');
      if (!map[coin]) map[coin] = { pnl: 0, trades: 0, wins: 0 };
      map[coin].pnl += t.pnl_usd || 0;
      map[coin].trades += 1;
      if ((t.pnl_usd || 0) > 0) map[coin].wins += 1;
    });
    const all = Object.entries(map).map(([name, d]) => ({
      name, pnl: d.pnl, trades: d.trades, winrate: (d.wins / d.trades) * 100,
    }));
    return {
      best: all.filter(c => c.pnl > 0).sort((a, b) => b.pnl - a.pnl).slice(0, 5),
      worst: all.filter(c => c.pnl < 0).sort((a, b) => a.pnl - b.pnl).slice(0, 5),
    };
  }, [filteredTrades]);

  const handleDrillDown = (title, trades) => setDrawer({ isOpen: true, title, trades });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[#555] text-sm">Loading analytics…</div>
      </div>
    );
  }

  const hasMinimumTrades = () => {
    if (!timeFilter.from || !timeFilter.to) return filteredTrades.length >= 3;
    const filterDuration = (timeFilter.to - timeFilter.from) / (1000 * 60 * 60 * 24);
    if (filterDuration <= 1) return true;
    return filteredTrades.length >= 3;
  };

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 py-4 space-y-8">

        {/* Header */}
        <div className="pb-2 border-b border-[#1a1a1a]">
          <h1 className="text-xl font-bold text-[#c0c0c0]">Analytics Hub</h1>
          <p className="text-[#444] text-xs mt-0.5">Performance review & diagnosis</p>
        </div>

        <GlobalTimeFilter onFilterChange={setTimeFilter} allTrades={allTrades} />

        {!hasMinimumTrades() ? (
          <div className="backdrop-blur-md bg-gradient-to-br from-violet-500/5 via-[#1a1a1a] to-purple-500/5 rounded-2xl border border-violet-500/20 p-12 text-center">
            <Sparkles className="w-12 h-12 mx-auto mb-4 text-violet-400/50" />
            <h3 className="text-lg font-bold text-[#888] mb-1">Insufficient Data</h3>
            <p className="text-sm text-[#555]">Add at least 3 closed trades for this period to see analytics</p>
          </div>
        ) : (
          <>
            {/* === SECTION 1 — KPI SUMMARY === */}
            <CommandKPIs
              metrics={metrics}
              tradesCount={filteredTrades.length}
              onClick={(label) => { if (label === 'Net PNL') handleDrillDown('All Trades', filteredTrades); }}
              showWarning={filteredTrades.length < 10}
            />

            {/* === SECTION 2 — CORE PERFORMANCE === */}
            <Section label="Core Performance" icon={BarChart2} iconColor="text-emerald-400/60">
              <EquityDrawdownCharts equityCurve={metrics.equityCurve} startBalance={startingBalance} />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <CollapsibleChart
                  title="PNL by Day of Week"
                  icon={Clock}
                  iconColor="text-emerald-400"
                  data={pnlByDay}
                  dataKey="pnl"
                  xKey="day"
                  yFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
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

              <div className="grid grid-cols-2 gap-4">
                <Distributions trades={filteredTrades} onDrillDown={handleDrillDown} />
              </div>

              <TradeDurationAnalysis trades={filteredTrades} onDrillDown={handleDrillDown} />
            </Section>

            {/* === SECTION 3 — EDGE / ATTRIBUTION === */}
            <Section label="Edge & Attribution" icon={TrendingUp} iconColor="text-violet-400/60">

              {/* Strategy + Coins */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-5">
                  <h4 className="text-sm font-semibold text-[#c0c0c0] mb-4 flex items-center gap-2">
                    <Target className="w-4 h-4 text-violet-400/70" />
                    Strategy Performance
                  </h4>
                  {strategyPerf.length === 0 ? (
                    <p className="text-xs text-[#555] text-center py-8">No strategy tags found. Tag your trades.</p>
                  ) : (
                    <div className="space-y-2">
                      {strategyPerf.slice(0, 6).map(s => (
                        <div
                          key={s.name}
                          onClick={() => handleDrillDown(`Strategy: ${s.name}`, filteredTrades.filter(t => t.strategy_tag === s.name))}
                          className="flex items-center justify-between p-2.5 bg-[#0d0d0d]/60 rounded-lg hover:bg-[#111] transition-colors cursor-pointer"
                        >
                          <div>
                            <div className="text-sm font-medium text-[#c0c0c0]">{s.name}</div>
                            <div className="text-xs text-[#555] mt-0.5">{s.trades} trades · {s.winrate.toFixed(0)}% WR</div>
                          </div>
                          <div className={cn("text-sm font-bold", s.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                            {s.pnl >= 0 ? '+' : '−'}${formatNumber(Math.abs(s.pnl))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-5">
                  <h4 className="text-sm font-semibold text-[#c0c0c0] mb-4 flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-400/70" />
                    Top / Bottom Coins
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <div className="text-[10px] text-emerald-400/60 uppercase tracking-wider mb-2 font-medium">Best</div>
                      {coinPerf.best.length === 0 ? (
                        <p className="text-xs text-[#555] text-center py-3">No winning coins yet</p>
                      ) : coinPerf.best.slice(0, 3).map(c => (
                        <div key={c.name} onClick={() => handleDrillDown(`Coin: ${c.name}`, filteredTrades.filter(t => t.coin?.replace('USDT', '') === c.name))}
                          className="flex justify-between items-center text-sm p-2 rounded hover:bg-[#111] transition-colors cursor-pointer">
                          <span className="text-[#c0c0c0]">{c.name} <span className="text-[#555] text-xs">{c.trades}T</span></span>
                          <span className="text-emerald-400 font-bold">+${formatNumber(c.pnl)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-[#1a1a1a] pt-3">
                      <div className="text-[10px] text-red-400/60 uppercase tracking-wider mb-2 font-medium">Worst</div>
                      {coinPerf.worst.length === 0 ? (
                        <p className="text-xs text-[#555] text-center py-3">No losing coins</p>
                      ) : coinPerf.worst.slice(0, 3).map(c => (
                        <div key={c.name} onClick={() => handleDrillDown(`Coin: ${c.name}`, filteredTrades.filter(t => t.coin?.replace('USDT', '') === c.name))}
                          className="flex justify-between items-center text-sm p-2 rounded hover:bg-[#111] transition-colors cursor-pointer">
                          <span className="text-[#c0c0c0]">{c.name} <span className="text-[#555] text-xs">{c.trades}T</span></span>
                          <span className="text-red-400 font-bold">−${formatNumber(Math.abs(c.pnl))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <CoinDistributions trades={filteredTrades} onDrillDown={handleDrillDown} />

              <DirectionTimeframePerf trades={filteredTrades} onDrillDown={handleDrillDown} />

              <BestConditions trades={filteredTrades} />
            </Section>

            {/* === SECTION 4 — EXECUTION QUALITY === */}
            <Section label="Execution Quality" icon={Zap} iconColor="text-cyan-400/60">
              <ExitMetrics metrics={metrics.exitMetrics} onDrillDown={handleDrillDown} allTrades={filteredTrades} />
              <BestWorst trades={filteredTrades} />
            </Section>

            {/* === SECTION 5 — DISCIPLINE / AI REVIEW === */}
            <Section label="Discipline & AI Review" icon={Brain} iconColor="text-purple-400/60">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <DisciplinePsychology trades={filteredTrades} disciplineScore={metrics.disciplineScore} />
              </div>
              <AIInsightsPremium trades={filteredTrades} metrics={metrics} />
            </Section>
          </>
        )}
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