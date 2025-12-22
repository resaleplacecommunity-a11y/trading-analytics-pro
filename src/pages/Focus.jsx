import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { startOfWeek, differenceInDays } from 'date-fns';
import { Target, Brain } from 'lucide-react';
import GoalSetup from '../components/focus/GoalSetup';
import GoalDecomposition from '../components/focus/GoalDecomposition';
import ProgressBars from '../components/focus/ProgressBars';
import TraderStrategyGenerator from '../components/focus/TraderStrategyGenerator';
import PsychologyProfile from '../components/focus/PsychologyProfile';
import WeeklyReflection from '../components/focus/WeeklyReflection';
import WeeklyScore from '../components/focus/WeeklyScore';
import TriggerLibrary from '../components/focus/TriggerLibrary';
import { toast } from 'sonner';

export default function Focus() {
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const userTimezone = user?.preferred_timezone || 'UTC';

  const { data: goals = [] } = useQuery({
    queryKey: ['focusGoals'],
    queryFn: () => base44.entities.FocusGoal.list('-created_at', 10),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['psychologyProfiles'],
    queryFn: () => base44.entities.PsychologyProfile.list('-created_date', 20),
  });

  const { data: trades = [] } = useQuery({
    queryKey: ['trades'],
    queryFn: () => base44.entities.Trade.list('-date_open', 500),
  });

  const activeGoal = goals.find(g => g.is_active);
  const latestProfile = profiles[0];

  // Get current week reflection
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekStartStr = formatInTimeZone(weekStart, userTimezone, 'yyyy-MM-dd');
  const currentWeekReflection = profiles.find(p => p.week_start === weekStartStr);

  // Calculate actual PNL
  const today = formatInTimeZone(now, userTimezone, 'yyyy-MM-dd');
  const closedTrades = trades.filter(t => t.close_price);

  const pnlToday = closedTrades
    .filter(t => formatInTimeZone(new Date(t.date_close), userTimezone, 'yyyy-MM-dd') === today)
    .reduce((sum, t) => sum + (t.pnl_usd || 0), 0);

  const pnlWeek = closedTrades
    .filter(t => {
      const closeDate = new Date(t.date_close);
      return closeDate >= weekStart && closeDate <= now;
    })
    .reduce((sum, t) => sum + (t.pnl_usd || 0), 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const pnlMonth = closedTrades
    .filter(t => new Date(t.date_close) >= monthStart)
    .reduce((sum, t) => sum + (t.pnl_usd || 0), 0);

  const actualPnl = {
    day: pnlToday,
    week: pnlWeek,
    month: pnlMonth
  };

  const saveGoalMutation = useMutation({
    mutationFn: async (data) => {
      // Calculate time_horizon_days if target_date is set
      if (data.target_date && !data.time_horizon_days) {
        const days = differenceInDays(new Date(data.target_date), new Date());
        data.time_horizon_days = Math.max(1, days);
      }

      // Deactivate other goals
      if (activeGoal?.id) {
        await base44.entities.FocusGoal.update(activeGoal.id, { is_active: false });
      }

      return base44.entities.FocusGoal.create({
        ...data,
        created_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['focusGoals']);
      toast.success('Goal saved successfully');
    },
  });

  const saveProfileMutation = useMutation({
    mutationFn: async (data) => {
      if (latestProfile?.id && !data.week_start) {
        return base44.entities.PsychologyProfile.update(latestProfile.id, data);
      }
      return base44.entities.PsychologyProfile.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['psychologyProfiles']);
      toast.success('Psychology profile saved');
    },
  });

  const saveReflectionMutation = useMutation({
    mutationFn: async (data) => {
      if (currentWeekReflection?.id) {
        return base44.entities.PsychologyProfile.update(currentWeekReflection.id, data);
      }
      return base44.entities.PsychologyProfile.create({
        ...data,
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

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#c0c0c0]">Focus 🎯</h1>
        <p className="text-[#666] text-sm">Goals + Psychology</p>
      </div>

      {/* Goals Section */}
      <div>
        <div className="flex items-center gap-2 mb-6">
          <Target className="w-6 h-6 text-violet-400" />
          <h2 className="text-xl font-bold text-[#c0c0c0]">Goals</h2>
        </div>

        <div className="space-y-6">
          {activeGoal && (
            <>
              <ProgressBars goal={activeGoal} actualPnl={actualPnl} />
              <GoalDecomposition goal={activeGoal} onAdjust={adjustGoal} />
              <TraderStrategyGenerator
                goal={activeGoal}
                trades={trades}
                onAdjust={adjustGoal}
              />
            </>
          )}

          <GoalSetup
            goal={activeGoal}
            onSave={(data) => saveGoalMutation.mutate(data)}
          />
        </div>
      </div>

      {/* Psychology Section */}
      <div>
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
        </div>
      </div>
    </div>
  );
}