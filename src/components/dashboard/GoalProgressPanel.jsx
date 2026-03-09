import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatInTimeZone } from 'date-fns-tz';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
import { Target, Calendar, TrendingUp } from 'lucide-react';
import { cn } from "@/lib/utils";

function GoalCard({ label, icon: IconComponent, iconColor, actual, target }) {
  const Icon = IconComponent;
  const sign = actual >= 0 ? '+' : '-';
  const formatted = `${sign}$${Math.round(Math.abs(actual)).toLocaleString()}`;
  const progress = target > 0 ? Math.min(100, Math.max(0, (actual / target) * 100)) : null;
  const color = actual > 0 ? 'text-emerald-400' : actual < 0 ? 'text-red-400' : 'text-[#c0c0c0]';
  const barColor = progress == null ? '' :
    progress >= 100 ? 'bg-emerald-400' :
    progress >= 60 ? 'bg-emerald-500/70' :
    progress >= 0 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="bg-[#0d0d0d]/80 border border-[#1e1e1e] rounded-xl p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className={cn("w-3.5 h-3.5", iconColor)} />
        <span className="text-[10px] text-[#555] uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className={cn("text-lg font-bold", color)}>{formatted}</div>
      {target != null && target > 0 ? (
        <>
          <div className="text-[10px] text-[#444] mt-0.5">Target +${Math.round(target).toLocaleString()}</div>
          <div className="w-full bg-[#1a1a1a] rounded-full h-1 mt-2">
            <div className={cn("h-1 rounded-full transition-all", barColor)} style={{ width: `${progress}%` }} />
          </div>
          <div className="text-[10px] text-[#444] mt-1">{progress?.toFixed(0)}% of goal</div>
        </>
      ) : (
        <div className="text-[10px] text-[#3a3a3a] mt-1">No target set</div>
      )}
    </div>
  );
}

export default function GoalProgressPanel({ trades = [], userTimezone = 'UTC' }) {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 30 * 60 * 1000,
  });

  const { data: focusGoal } = useQuery({
    queryKey: ['focusGoal', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const goals = await base44.entities.FocusGoal.filter({ created_by: user.email, is_active: true }, '-created_date', 1);
      return goals[0] || null;
    },
    enabled: !!user?.email,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const now = new Date();
  const todayStr = formatInTimeZone(now, userTimezone, 'yyyy-MM-dd');
  const weekStart = formatInTimeZone(startOfWeek(now, { weekStartsOn: 1 }), userTimezone, 'yyyy-MM-dd');
  const weekEnd = formatInTimeZone(endOfWeek(now, { weekStartsOn: 1 }), userTimezone, 'yyyy-MM-dd');
  const monthStart = formatInTimeZone(startOfMonth(now), userTimezone, 'yyyy-MM-dd');
  const monthEnd = formatInTimeZone(endOfMonth(now), userTimezone, 'yyyy-MM-dd');

  const closedTrades = trades.filter(t => t.close_price && t.date_close);

  const getPnlForRange = (from, to) =>
    closedTrades.reduce((sum, t) => {
      try {
        const d = formatInTimeZone(new Date(t.date_close), userTimezone, 'yyyy-MM-dd');
        return d >= from && d <= to ? sum + (t.pnl_usd || 0) : sum;
      } catch { return sum; }
    }, 0);

  const todayPnl = getPnlForRange(todayStr, todayStr);
  const weekPnl = getPnlForRange(weekStart, weekEnd);
  const monthPnl = getPnlForRange(monthStart, monthEnd);

  let dailyTarget = null, weeklyTarget = null, monthlyTarget = null;
  if (focusGoal) {
    const startingCap = focusGoal.starting_capital_usd || focusGoal.prop_account_size_usd || 0;
    const targetCap = focusGoal.target_capital_usd || 0;
    const totalProfit = targetCap - startingCap;
    let totalDays = focusGoal.time_horizon_days || null;
    if (!totalDays && focusGoal.target_date && focusGoal.start_date) {
      totalDays = differenceInDays(new Date(focusGoal.target_date), new Date(focusGoal.start_date));
    }
    if (totalDays > 0 && totalProfit > 0) {
      dailyTarget = totalProfit / totalDays;
      weeklyTarget = dailyTarget * 5;
      monthlyTarget = dailyTarget * 22;
    }
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      <GoalCard label="Today" icon={Calendar} iconColor="text-cyan-400/70" actual={todayPnl} target={dailyTarget} />
      <GoalCard label="This Week" icon={TrendingUp} iconColor="text-violet-400/70" actual={weekPnl} target={weeklyTarget} />
      <GoalCard label="This Month" icon={Target} iconColor="text-emerald-400/70" actual={monthPnl} target={monthlyTarget} />
    </div>
  );
}