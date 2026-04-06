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
import BestConditions from '../components/analytics/BestConditions';
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
  formatNumber
} from '../components/analytics/analyticsCalculations';
import { Clock, Coins, Target, Sparkles } from 'lucide-react';
import { cn } from "@/lib/utils";
import { useTradesQuery } from '../components/hooks/useTradesQuery';
import RiskViolationBanner from '../components/RiskViolationBanner';

const sectionStyle = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 16,
  backdropFilter: 'blur(8px)',
  padding: '20px',
  marginBottom: '20px',
};

const aiSectionStyle = {
  background: 'rgba(16,185,129,0.04)',
  border: '1px solid rgba(16,185,129,0.2)',
  borderRadius: 16,
  boxShadow: '0 0 40px rgba(16,185,129,0.06)',
  padding: '20px',
  marginBottom: '20px',
};

function SectionHeader({ title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <div style={{ width: 3, height: 18, background: '#10b981', borderRadius: 2 }} />
      <span style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 14 }}>{title}</span>
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

  const { data: riskSettings } = useQuery({
    queryKey: ['riskSettings', user?.email, profiles.find(p => p.is_active)?.id],
    queryFn: async () => {
      if (!user?.email) return null;
      const activeProfile = profiles.find(p => p.is_active);
      if (!activeProfile) return null;
      const settings = await base44.entities.RiskSettings.filter({
        created_by: user.email,
        profile_id: activeProfile.id
      }, '-created_date', 1);
      return settings[0] || null;
    },
    enabled: !!user?.email && profiles.length > 0,
    staleTime: 10 * 60 * 1000,
  });

  const todayClosedTrades = getTodayClosedTrades(allTrades, userTimezone);
  const todayPnl = getTodayPnl(allTrades, userTimezone);

  const todayPnlPercent = todayClosedTrades.reduce((s, t) => {
    const pnl = t.pnl_usd || 0;
    if (pnl < 0) {
      const balance = t.account_balance_at_entry || startingBalance;
      return s + ((pnl / balance) * 100);
    }
    return s;
  }, 0);

  const todayR = todayClosedTrades.reduce((s, t) => s + (t.r_multiple || 0), 0);

  const todayOpenedTrades = getTodayOpenedTrades(allTrades, userTimezone);

  const recentTrades = [...allTrades].filter(t => t.close_price).sort((a, b) =>
    new Date(b.date_close || b.date) - new Date(a.date_close || a.date)
  ).slice(0, 10);
  const consecutiveLosses = recentTrades.findIndex(t => (t.pnl_usd || 0) >= 0);
  const lossStreak = consecutiveLosses === -1 ? Math.min(recentTrades.length, riskSettings?.max_consecutive_losses || 3) : consecutiveLosses;

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
    const closed = [...filteredTrades].sort((a, b) =>
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

    if (filterDuration <= 1) return true;

    return filteredTrades.length >= 3;
  };

  if (!hasMinimumTrades()) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', padding: '24px 16px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
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
      </div>
    );
  }

  return (
    <>
      <div style={{ minHeight: '100vh', background: '#0a0a0a', padding: '24px 16px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 style={{
                fontSize: 28,
                fontWeight: 700,
                margin: 0,
                background: 'linear-gradient(90deg, #ffffff 0%, #10b981 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                Analytics Hub
              </h1>
              <p style={{ color: '#6b7280', fontSize: 13, margin: '4px 0 0 0' }}>Deep performance insights</p>
            </div>
            <GlobalTimeFilter
              onFilterChange={setTimeFilter}
              allTrades={allTrades}
            />
          </div>

          <RiskViolationBanner violations={violations} />

          {/* Command KPIs */}
          <div style={sectionStyle}>
            <SectionHeader title="Key Performance Indicators" />
            <CommandKPIs
              metrics={metrics}
              tradesCount={filteredTrades.length}
              onClick={(label) => {
                if (label === 'Net PNL') handleDrillDown('All Trades', filteredTrades);
              }}
              showWarning={filteredTrades.length < 10}
            />
          </div>

          {/* Equity + Exit Metrics side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            <div style={{ ...sectionStyle, marginBottom: 0 }}>
              <SectionHeader title="Equity & Drawdown" />
              <EquityDrawdownCharts equityCurve={metrics.equityCurve} startBalance={startingBalance} />
            </div>
            <div style={{ ...sectionStyle, marginBottom: 0 }}>
              <SectionHeader title="Exit Metrics" />
              <ExitMetrics metrics={metrics.exitMetrics} onDrillDown={handleDrillDown} allTrades={filteredTrades} />
            </div>
          </div>

          {/* Best Conditions + Coin Distributions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            <div style={{ ...sectionStyle, marginBottom: 0 }}>
              <SectionHeader title="Best Conditions" />
              <BestConditions trades={filteredTrades} />
            </div>
            <div style={{ ...sectionStyle, marginBottom: 0 }}>
              <SectionHeader title="Coin Distributions" />
              <CoinDistributions trades={filteredTrades} onDrillDown={handleDrillDown} />
            </div>
          </div>

          {/* Trading Calendar — full width */}
          <div style={sectionStyle}>
            <SectionHeader title="Trading Calendar" />
            <TradingCalendar trades={allTrades} userTimezone={userTimezone} />
          </div>

          {/* Distributions — full width */}
          <div style={sectionStyle}>
            <SectionHeader title="Distributions" />
            <Distributions trades={filteredTrades} onDrillDown={handleDrillDown} />
          </div>

          {/* PNL by Day + Trade Open Times */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            <div style={{ ...sectionStyle, marginBottom: 0 }}>
              <SectionHeader title="PNL by Day" />
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
            </div>
            <div style={{ ...sectionStyle, marginBottom: 0 }}>
              <SectionHeader title="Trade Open Times" />
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
          </div>

          {/* Strategy Performance + Top/Bottom Coins */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            <div style={{ ...sectionStyle, marginBottom: 0 }}>
              <SectionHeader title="Strategy Performance" />
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

            <div style={{ ...sectionStyle, marginBottom: 0 }}>
              <SectionHeader title="Top / Bottom Coins" />
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

          {/* Best/Worst — full width */}
          <div style={sectionStyle}>
            <SectionHeader title="Best & Worst Trades" />
            <BestWorst trades={filteredTrades} />
          </div>

          {/* Trade Duration — full width */}
          <div style={sectionStyle}>
            <SectionHeader title="Trade Duration Analysis" />
            <TradeDurationAnalysis trades={filteredTrades} onDrillDown={handleDrillDown} />
          </div>

          {/* Discipline & Psychology — full width */}
          <div style={sectionStyle}>
            <SectionHeader title="Discipline & Psychology" />
            <DisciplinePsychology trades={filteredTrades} disciplineScore={metrics.disciplineScore} />
          </div>

          {/* AI Insights — highlighted */}
          <div style={aiSectionStyle}>
            <SectionHeader title="AI Insights" />
            <AIInsightsPremium trades={filteredTrades} metrics={metrics} />
          </div>

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
