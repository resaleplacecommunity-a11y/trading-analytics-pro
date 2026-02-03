import { Target, Calendar, TrendingUp, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format, startOfDay, differenceInDays } from "date-fns";
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getTodayInUserTz } from '../utils/dateUtils';

export default function GoalSummary({ goal, totalEarned, onEdit }) {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });
  
  const userTimezone = user?.preferred_timezone || 'UTC';
  
  if (!goal) return null;

  const earned = totalEarned !== undefined ? totalEarned : (goal.earned || 0);
  const mode = goal.mode;
  const targetAmount = goal.target_capital_usd;
  const totalDays = goal.time_horizon_days;
  
  // Calculate time progress: always use start_date if available, otherwise fall back to created_at
  const startDateStr = goal.start_date 
    ? goal.start_date 
    : (goal.created_at ? goal.created_at.split('T')[0] : getTodayInUserTz(userTimezone));
  
  const startDate = startOfDay(new Date(startDateStr + 'T00:00:00'));
  const todayStr = getTodayInUserTz(userTimezone);
  const today = startOfDay(new Date(todayStr + 'T00:00:00'));
  
  // Calculate days passed since goal start date
  const daysPassed = Math.max(0, differenceInDays(today, startDate));
  const daysLeft = Math.max(0, totalDays - daysPassed);
  const timeProgress = Math.min(Math.max((daysPassed / totalDays) * 100, 0), 100);

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-violet-500/20 via-violet-500/10 to-[#0d0d0d] backdrop-blur-sm rounded-2xl border-2 border-violet-500/30 p-8 h-full flex flex-col">
      <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl" />
      
      <div className="relative">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <Target className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-[#c0c0c0]">Active Goal</h3>
              <p className="text-[#888] text-sm uppercase tracking-wider">{mode === 'personal' ? 'Personal Capital' : 'Prop Firm'}</p>
              {goal.start_date && (
                <p className="text-[#666] text-xs mt-1">
                  Started {format(new Date(goal.start_date), 'MMM dd, yyyy')}
                  {goal.starting_capital_usd > 0 && (
                    <span className="text-[#555]"> • ${goal.starting_capital_usd.toLocaleString()}</span>
                  )}
                </p>
              )}
            </div>
          </div>
          <Button
            onClick={onEdit}
            variant="outline"
            size="sm"
            className="bg-[#111]/50 border-[#2a2a2a] text-[#888] hover:text-[#c0c0c0]"
          >
            <Edit2 className="w-4 h-4 mr-2" />
            Edit
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <div className="text-[#888] text-xs uppercase tracking-wider mb-2">Target Amount</div>
            <div className="text-4xl font-bold text-violet-400">${targetAmount.toLocaleString()}</div>
            <div className="text-emerald-400 text-sm font-medium mt-1">
              +{(((goal.target_capital_usd - (goal.current_capital_usd || goal.prop_account_size_usd)) / (goal.current_capital_usd || goal.prop_account_size_usd)) * 100).toFixed(0)}% growth
            </div>
          </div>
          <div>
            <div className="text-[#888] text-xs uppercase tracking-wider mb-2">Time Horizon</div>
            <div className="text-4xl font-bold text-[#c0c0c0]">{totalDays} <span className="text-xl text-[#666]">days</span></div>
          </div>
        </div>

        {/* Time Progress */}
        <div className="bg-[#111]/50 rounded-xl border border-[#2a2a2a] p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-violet-400" />
              <span className="text-[#888] text-sm font-medium">Time Progress</span>
            </div>
            <div className="text-right">
              <span className="text-[#c0c0c0] text-sm font-bold">Day {daysPassed + 1}</span>
              <span className="text-[#666] text-xs"> of {totalDays}</span>
            </div>
          </div>
          
          <div className="h-2 bg-[#0d0d0d] rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-violet-400 transition-all duration-500"
              style={{ width: `${Math.min(timeProgress, 100)}%` }}
            />
          </div>
          
          <div className="flex justify-between text-xs">
            <span className="text-violet-400 font-medium">{timeProgress.toFixed(0)}% elapsed</span>
            <span className="text-[#888]">{daysLeft} days left</span>
          </div>
        </div>

        {/* Money Progress */}
        <div className="bg-[#111]/50 rounded-xl border border-[#2a2a2a] p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-[#888] text-sm font-medium">Capital Progress</span>
            </div>
            <div className="text-right">
              <span className="text-emerald-400 text-sm font-bold">${earned.toFixed(0)}</span>
              <span className="text-[#666] text-xs"> / ${targetAmount.toLocaleString()}</span>
            </div>
          </div>
          
          <div className="h-2 bg-[#0d0d0d] rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${Math.min((earned / targetAmount) * 100, 100)}%` }}
            />
          </div>
          
          <div className="flex justify-between text-xs">
            <span className="text-emerald-400 font-medium">{((earned / targetAmount) * 100).toFixed(1)}% earned</span>
            <span className="text-[#888]">${(targetAmount - earned).toFixed(0)} to go</span>
          </div>
        </div>
      </div>
    </div>
  );
}