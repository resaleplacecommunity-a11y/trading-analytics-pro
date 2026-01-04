import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { startOfWeek, differenceInDays } from 'date-fns';
import { parseTradeDateToUserTz, getTodayInUserTz } from '../components/utils/dateUtils';
import { Brain, Target } from 'lucide-react';
import WisdomQuote from '../components/focus/WisdomQuote';
import GoalSetup from '../components/focus/GoalSetup';
import GoalSummary from '../components/focus/GoalSummary';
import ProgressBarsWithHistory from '../components/focus/ProgressBarsWithHistory';
import GoalDecomposition from '../components/focus/GoalDecomposition';
import TraderStrategyGeneratorEditable from '../components/focus/TraderStrategyGeneratorEditable';
import StrategyPlaceholder from '../components/focus/StrategyPlaceholder';
import PsychologyProfile from '../components/focus/PsychologyProfile';
import WeeklyReflection from '../components/focus/WeeklyReflection';
import WeeklyScore from '../components/focus/WeeklyScore';
import TriggerLibrary from '../components/focus/TriggerLibrary';
import PsychologyInsights from '../components/focus/PsychologyInsights';
import { toast } from 'sonner';
import { getTradesForActiveProfile, getActiveProfileId, getDataForActiveProfile } from '../components/utils/profileUtils';
import { getTodayPnl } from '../components/utils/dateUtils';

export default function Focus() {
  const queryClient = useQueryClient();
  const [editingGoal, setEditingGoal] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const userTimezone = user?.preferred_timezone || 'UTC';

  const { data: goals = [] } = useQuery({
    queryKey: ['focusGoals'],
    queryFn: () => getDataForActiveProfile('FocusGoal', '-created_at', 10),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['psychologyProfiles'],
    queryFn: () => getDataForActiveProfile('PsychologyProfile', '-created_date', 20),
  });

  const { data: trades = [] } = useQuery({
    queryKey: ['trades'],
    queryFn: () => getTradesForActiveProfile(),
  });

  const activeGoal = goals.find(g => g.is_active);
  const latestProfile = profiles[0];

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekStartStr = formatInTimeZone(weekStart, userTimezone, 'yyyy-MM-dd');
  const currentWeekReflection = profiles.find(p => p.week_start === weekStartStr);

  const closedTrades = trades.filter(t => t.close_price);
  const openTrades = trades.filter(t => !t.close_price);

  // Use unified utility for today's PNL
  const pnlToday = getTodayPnl(trades, userTimezone);

  // Calculate week PNL using timezone-aware utilities
  const today = getTodayInUserTz(userTimezone);
  
  let pnlWeek = 0;
  closedTrades.forEach(t => {
    if (t.date_close) {
      const closeDateStr = parseTradeDateToUserTz(t.date_close, userTimezone);
      if (closeDateStr >= weekStartStr && closeDateStr <= today) {
        pnlWeek += (t.pnl_usd || 0);
      }
    }
  });
  
  // Add partial closes from open trades (this week)
  openTrades.forEach(t => {
    if (t.partial_closes) {
      try {
        const partials = JSON.parse(t.partial_closes);
        partials.forEach(pc => {
          if (pc.timestamp) {
            const pcDateStr = parseTradeDateToUserTz(pc.timestamp, userTimezone);
            if (pcDateStr >= weekStartStr && pcDateStr <= today) {
              pnlWeek += (pc.pnl_usd || 0);
            }
          }
        });
      } catch {}
    }
  });

  // Calculate month PNL using timezone-aware utilities
  const monthStartStr = formatInTimeZone(new Date(now.getFullYear(), now.getMonth(), 1), userTimezone, 'yyyy-MM-dd');
  
  let pnlMonth = 0;
  closedTrades.forEach(t => {
    if (t.date_close) {
      const closeDateStr = parseTradeDateToUserTz(t.date_close, userTimezone);
      if (closeDateStr >= monthStartStr) {
        pnlMonth += (t.pnl_usd || 0);
      }
    }
  });
  
  // Add partial closes from open trades (this month)
  openTrades.forEach(t => {
    if (t.partial_closes) {
      try {
        const partials = JSON.parse(t.partial_closes);
        partials.forEach(pc => {
          if (pc.timestamp) {
            const pcDateStr = parseTradeDateToUserTz(pc.timestamp, userTimezone);
            if (pcDateStr >= monthStartStr) {
              pnlMonth += (pc.pnl_usd || 0);
            }
          }
        });
      } catch {}
    }
  });

  const actualPnl = {
    day: pnlToday,
    week: pnlWeek,
    month: pnlMonth
  };

  const saveGoalMutation = useMutation({
    mutationFn: async (data) => {
      const profileId = await getActiveProfileId();
      
      if (data.target_date && !data.time_horizon_days) {
        const days = differenceInDays(new Date(data.target_date), new Date());
        data.time_horizon_days = Math.max(1, days);
      }

      if (activeGoal?.id && !editingGoal) {
        await base44.entities.FocusGoal.update(activeGoal.id, { is_active: false });
      }

      if (editingGoal && activeGoal?.id) {
        return base44.entities.FocusGoal.update(activeGoal.id, {
          ...data,
          profile_id: profileId,
          is_active: true
        });
      }

      // For new goals, save starting capital and start date
      const startingCapital = data.mode === 'personal' 
        ? (data.current_capital_usd || 0) 
        : (data.prop_account_size_usd || 0);

      return base44.entities.FocusGoal.create({
        ...data,
        profile_id: profileId,
        is_active: true,
        created_at: new Date().toISOString(),
        start_date: formatInTimeZone(new Date(), userTimezone, 'yyyy-MM-dd'),
        starting_capital_usd: startingCapital
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['focusGoals']);
      setEditingGoal(false);
      toast.success('Goal saved successfully');
    },
  });

  const saveProfileMutation = useMutation({
    mutationFn: async (data) => {
      const profileId = await getActiveProfileId();
      if (latestProfile?.id && !data.week_start) {
        return base44.entities.PsychologyProfile.update(latestProfile.id, { ...data, profile_id: profileId });
      }
      return base44.entities.PsychologyProfile.create({ ...data, profile_id: profileId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['psychologyProfiles']);
      toast.success('Psychology profile saved');
    },
  });

  const saveReflectionMutation = useMutation({
    mutationFn: async (data) => {
      const profileId = await getActiveProfileId();
      if (currentWeekReflection?.id) {
        return base44.entities.PsychologyProfile.update(currentWeekReflection.id, { ...data, profile_id: profileId });
      }
      return base44.entities.PsychologyProfile.create({
        ...data,
        profile_id: profileId,
        week_start: weekStartStr
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['psychologyProfiles']);
      toast.success('Weekly reflection saved');
    },
  });

  const adjustGoal = (additionalDays) => {
    if (!activeGoal) return;
    const newDays = (activeGoal.time_horizon_days || 180) + additionalDays;
    saveGoalMutation.mutate({
      ...activeGoal,
      time_horizon_days: newDays,
      is_active: true
    });
  };

  const handleStrategySelect = (strategy) => {
    if (!activeGoal) return;
    
    const strategyParams = {
      conservative: { trades_per_day: 2, winrate: 50, rr_ratio: 3, risk_per_trade: 1.5 },
      risky: { trades_per_day: 3, winrate: 55, rr_ratio: 2.5, risk_per_trade: 2 },
      aggressive: { trades_per_day: 5, winrate: 60, rr_ratio: 2, risk_per_trade: 3 }
    };

    saveGoalMutation.mutate({
      ...activeGoal,
      ...strategyParams[strategy],
      is_active: true
    });
  };

  const handleStrategyUpdate = (newStrategy) => {
    if (!activeGoal) return;
    saveGoalMutation.mutate({
      ...activeGoal,
      trades_per_day: newStrategy.tradesPerDay,
      winrate: newStrategy.winrate,
      rr_ratio: newStrategy.rrRatio,
      risk_per_trade: newStrategy.riskPerTrade,
      is_active: true
    });
  };

  let totalEarned = closedTrades.reduce((sum, t) => sum + (t.pnl_usd || 0), 0);
  
  // Add realized PNL from open trades (partial closes)
  openTrades.forEach(t => {
    if (t.realized_pnl_usd) {
      totalEarned += t.realized_pnl_usd;
    }
  });

  useEffect(() => {
    if (activeGoal && !editingGoal && Math.abs(totalEarned - (activeGoal.earned || 0)) > 1) {
      const timeoutId = setTimeout(() => {
        saveGoalMutation.mutate({
          ...activeGoal,
          earned: totalEarned,
          is_active: true
        });
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [totalEarned]);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
            <Target className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-[#c0c0c0]">Focus</h1>
            <p className="text-[#666] text-sm">Goals & Psychology</p>
          </div>
        </div>
        <WisdomQuote />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {activeGoal && !editingGoal ? (
            <GoalSummary goal={activeGoal} totalEarned={totalEarned} onEdit={() => setEditingGoal(true)} />
          ) : (
            <GoalSetup
              goal={editingGoal ? activeGoal : null}
              onSave={(data) => saveGoalMutation.mutate(data)}
            />
          )}
        </div>

        <div>
          {activeGoal && !editingGoal ? (
            <TraderStrategyGeneratorEditable
              goal={activeGoal}
              trades={trades}
              onStrategyUpdate={handleStrategyUpdate}
            />
          ) : (
            <StrategyPlaceholder />
          )}
        </div>
      </div>

      {activeGoal && !editingGoal && (
        <GoalDecomposition 
          goal={activeGoal} 
          onAdjust={adjustGoal}
          onStrategySelect={handleStrategySelect}
        />
      )}

      {activeGoal && !editingGoal && (
        <ProgressBarsWithHistory 
          goal={activeGoal} 
          trades={trades}
          userTimezone={userTimezone}
        />
      )}

      <div className="pt-8 border-t-2 border-[#1a1a1a]">
        <div className="flex items-center gap-2 mb-6">
          <Brain className="w-6 h-6 text-cyan-400" />
          <h2 className="text-xl font-bold text-[#c0c0c0]">Psychology</h2>
        </div>

        <div className="space-y-6">
          <PsychologyProfile
            profile={latestProfile}
            onSave={(data) => saveProfileMutation.mutate(data)}
          />

          <TriggerLibrary
            profile={latestProfile}
            onSave={(data) => saveProfileMutation.mutate(data)}
            trades={trades}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <WeeklyReflection
              reflection={currentWeekReflection}
              onSave={(data) => saveReflectionMutation.mutate(data)}
              psychologyProfile={latestProfile?.psychology_issues}
            />

            <WeeklyScore
              reflection={currentWeekReflection}
              onUpdate={(data) => saveReflectionMutation.mutate(data)}
            />
          </div>

          <PsychologyInsights
            trades={trades}
            profiles={profiles}
          />
        </div>
      </div>
    </div>
  );
}