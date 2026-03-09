import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useTradesQuery } from '../components/hooks/useTradesQuery';
import { Button } from "@/components/ui/button";
import { Plus, DollarSign, TrendingUp } from 'lucide-react';
import { calculateClosedMetrics } from '../components/analytics/analyticsCalculations';
import { 
  getTodayInUserTz, 
  getTodayClosedTrades, 
  getTodayOpenedTrades,
  getTodayPnl
} from '../components/utils/dateUtils';

import StatsCard from '../components/dashboard/StatsCard';
import EquityCurve from '../components/dashboard/EquityCurve';
import PnlChart from '../components/dashboard/PnlChart';
import RiskOverviewNew from '../components/dashboard/RiskOverviewNew';
import AIRecommendations from '../components/ai/AIRecommendations';
import AgentChatModal from '../components/AgentChatModal';
import RiskViolationBanner from '../components/RiskViolationBanner';
import TradingCalendar from '../components/analytics/TradingCalendar';
import SessionStatus from '../components/dashboard/SessionStatus';
import RemainingDailyRisk from '../components/dashboard/RemainingDailyRisk';
import GoalProgressPanel from '../components/dashboard/GoalProgressPanel';
import BotExchangeStatus from '../components/dashboard/BotExchangeStatus';
import TodayFocus from '../components/dashboard/TodayFocus';

const SECTION = ({ label, children }) => (
  <div className="space-y-4">
    <div className="flex items-center gap-3">
      <span className="text-[10px] text-[#444] uppercase tracking-[0.15em] font-semibold">{label}</span>
      <div className="flex-1 h-px bg-[#1e1e1e]" />
    </div>
    {children}
  </div>
);

export default function Dashboard() {
  const [showAgentChat, setShowAgentChat] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['userProfiles', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.UserProfile.filter({ created_by: user.email }, '-created_date', 10);
    },
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const activeProfile = profiles.find(p => p.is_active);

  const { data: trades = [], refetch: refetchTrades } = useTradesQuery(activeProfile?.id);

  const { data: riskSettings } = useQuery({
    queryKey: ['riskSettings', user?.email, activeProfile?.id],
    queryFn: async () => {
      if (!user?.email || !activeProfile?.id) return null;
      const settings = await base44.entities.RiskSettings.filter({ 
        created_by: user.email,
        profile_id: activeProfile.id 
      }, '-created_date', 1);
      return settings[0] || null;
    },
    enabled: !!user?.email && !!activeProfile?.id,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: behaviorLogs = [] } = useQuery({
    queryKey: ['behaviorLogs', user?.email, activeProfile?.id],
    queryFn: async () => {
      if (!user?.email || !activeProfile?.id) return [];
      return base44.entities.BehaviorLog.filter({ 
        created_by: user.email,
        profile_id: activeProfile.id 
      }, '-date', 20);
    },
    enabled: !!user?.email && !!activeProfile?.id,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Security check
  useEffect(() => {
    if (activeProfile && user?.email && activeProfile.created_by !== user.email) {
      console.error('SECURITY: Active profile does not belong to current user!');
    }
  }, [activeProfile, user]);

  // --- Derived state ---
  const startingBalance = activeProfile?.starting_balance || 100000;
  const userTimezone = user?.preferred_timezone || 'UTC';

  const closedTrades = trades.filter(t => t.close_price);
  const openTrades = trades.filter(t => !t.close_price);

  const closedMetrics = calculateClosedMetrics(closedTrades, startingBalance);
  const openRealizedPnlUsd = openTrades.reduce((s, t) => s + (t.realized_pnl_usd || 0), 0);
  const currentBalance = startingBalance + closedMetrics.netPnlUsd + openRealizedPnlUsd;

  const todayClosedTrades = getTodayClosedTrades(trades, userTimezone);
  const todayPnl = getTodayPnl(trades, userTimezone);
  const todayOpenedTrades = getTodayOpenedTrades(trades, userTimezone);

  const todayPnlPercent = todayClosedTrades.reduce((s, t) => {
    const pnl = t.pnl_usd || 0;
    if (pnl < 0) {
      const balance = t.account_balance_at_entry || startingBalance;
      return s + ((pnl / balance) * 100);
    }
    return s;
  }, 0);

  const todayR = todayClosedTrades.reduce((s, t) => s + (t.r_multiple || 0), 0);

  const recentClosed = [...closedTrades].sort((a, b) => 
    new Date(b.date_close || b.date) - new Date(a.date_close || a.date)
  ).slice(0, 10);
  const firstWinIdx = recentClosed.findIndex(t => (t.pnl_usd || 0) >= 0);
  const lossStreak = firstWinIdx === -1 ? Math.min(recentClosed.length, riskSettings?.max_consecutive_losses || 3) : firstWinIdx;

  // Open exposure
  const openExposureUsd = openTrades.reduce((s, t) => s + (t.position_size || 0), 0);

  const violations = [];
  if (riskSettings) {
    if (riskSettings.daily_max_loss_percent && todayPnlPercent < -riskSettings.daily_max_loss_percent) {
      violations.push({ rule: 'Daily Loss Limit', value: `${todayPnlPercent.toFixed(2)}%`, limit: `${riskSettings.daily_max_loss_percent}%` });
    }
    if (riskSettings.daily_max_r && todayR < -riskSettings.daily_max_r) {
      violations.push({ rule: 'Daily R Loss', value: `${todayR.toFixed(2)}R`, limit: `${riskSettings.daily_max_r}R` });
    }
    if (riskSettings.max_trades_per_day && todayOpenedTrades.length >= riskSettings.max_trades_per_day) {
      violations.push({ rule: 'Max Trades', value: `${todayOpenedTrades.length}`, limit: `${riskSettings.max_trades_per_day}` });
    }
    if (lossStreak >= (riskSettings.max_consecutive_losses || 3)) {
      violations.push({ rule: 'Loss Streak', value: `${lossStreak} losses`, limit: `${riskSettings.max_consecutive_losses}` });
    }
  }

  const fmtUsd = (n) => {
    if (n == null || isNaN(n)) return '—';
    return Math.round(n).toLocaleString();
  };

  const todayPnlSign = todayPnl >= 0 ? '+' : '-';

  return (
    <div className="space-y-8 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-[#1a1a1a]">
        <div>
          <h1 className="text-xl font-bold text-[#c0c0c0]">Dashboard</h1>
          <p className="text-[#444] text-xs mt-0.5">Live operational state</p>
        </div>
        <Button
          onClick={() => setShowAgentChat(true)}
          className="bg-[#1a1a1a] border border-[#2a2a2a] text-[#c0c0c0] hover:bg-[#222] hover:text-white"
          size="sm"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          AI Assistant
        </Button>
      </div>

      {/* === SECTION 1 — LIVE STATE === */}
      <SECTION label="Live State">

        {/* Risk Violation Banner */}
        <RiskViolationBanner violations={violations} />

        {/* Top 4 operational stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatsCard
            title="Balance"
            value={`$${fmtUsd(currentBalance)}`}
            subtitle={`Started $${fmtUsd(startingBalance)}`}
            subtitleColor="text-[#555]"
            icon={DollarSign}
            className={currentBalance < startingBalance ? "border-red-500/30" : ""}
          />
          <StatsCard
            title="Today PnL"
            value={`${todayPnlSign}$${fmtUsd(Math.abs(todayPnl))}`}
            subtitle={`${todayClosedTrades.length} trades closed`}
            subtitleColor="text-[#555]"
            icon={TrendingUp}
            valueColor={todayPnl > 0 ? 'text-emerald-400' : todayPnl < 0 ? 'text-red-400' : 'text-[#c0c0c0]'}
          />
          <StatsCard
            title="Open Positions"
            value={openTrades.length}
            subtitle={openTrades.length > 0 ? `$${fmtUsd(openExposureUsd)} exposure` : 'No open trades'}
            subtitleColor="text-[#555]"
            icon={TrendingUp}
          />
          <StatsCard
            title="Total PnL"
            value={`${closedMetrics.netPnlUsd >= 0 ? '+' : '-'}$${fmtUsd(Math.abs(closedMetrics.netPnlUsd))}`}
            subtitle={`${(closedMetrics.netPnlPercent || 0) >= 0 ? '+' : ''}${(closedMetrics.netPnlPercent || 0).toFixed(1)}% all-time`}
            subtitleColor={closedMetrics.netPnlUsd >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}
            icon={DollarSign}
            className={closedMetrics.netPnlUsd < 0 ? "border-red-500/30" : ""}
          />
        </div>

        {/* Session Status + Remaining Daily Risk */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <SessionStatus
            violations={violations}
            todayTradeCount={todayOpenedTrades.length}
            maxTrades={riskSettings?.max_trades_per_day || null}
            lossStreak={lossStreak}
            maxLossStreak={riskSettings?.max_consecutive_losses || null}
            openTradeCount={openTrades.length}
            openExposureUsd={openExposureUsd}
          />
          <RemainingDailyRisk
            riskSettings={riskSettings}
            todayLossPercent={todayPnlPercent}
            balance={currentBalance}
          />
        </div>

      </SECTION>

      {/* === SECTION 2 — GOALS === */}
      <SECTION label="Goals">
        <GoalProgressPanel trades={trades} userTimezone={userTimezone} />
      </SECTION>

      {/* === SECTION 3 — SHORT-TERM PERFORMANCE === */}
      <SECTION label="Performance">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <EquityCurve trades={trades} userTimezone={userTimezone} startingBalance={startingBalance} currentBalance={currentBalance} />
          <PnlChart trades={trades} userTimezone={userTimezone} />
        </div>
        <TradingCalendar trades={trades} userTimezone={userTimezone} />
      </SECTION>

      {/* === SECTION 4 — ACTION / GUIDANCE === */}
      <SECTION label="Action & Guidance">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AIRecommendations trades={trades} behaviorLogs={behaviorLogs} />
          <div className="space-y-4">
            <TodayFocus userTimezone={userTimezone} />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RiskOverviewNew trades={trades} riskSettings={riskSettings} behaviorLogs={behaviorLogs} />
          <BotExchangeStatus />
        </div>
      </SECTION>

      {showAgentChat && (
        <AgentChatModal
          onClose={() => setShowAgentChat(false)}
          onTradeCreated={() => { refetchTrades(); setShowAgentChat(false); }}
        />
      )}
    </div>
  );
}