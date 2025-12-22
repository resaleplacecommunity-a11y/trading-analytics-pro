import { Target, Calendar, TrendingUp, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { differenceInDays } from "date-fns";

export default function GoalSummary({ goal, onEdit }) {
  if (!goal) return null;

  const mode = goal.mode;
  const targetAmount = goal.target_capital_usd;
  const totalDays = goal.time_horizon_days;
  
  // Calculate time progress
  const startDate = new Date(goal.created_at);
  const now = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + totalDays);
  
  const daysPassed = Math.max(0, differenceInDays(now, startDate));
  const daysLeft = Math.max(0, differenceInDays(endDate, now));
  const timeProgress = Math.min((daysPassed / totalDays) * 100, 100);

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-violet-500/20 via-violet-500/10 to-[#0d0d0d] backdrop-blur-sm rounded-2xl border-2 border-violet-500/30 p-8">
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
          </div>
          <div>
            <div className="text-[#888] text-xs uppercase tracking-wider mb-2">Time Horizon</div>
            <div className="text-4xl font-bold text-[#c0c0c0]">{totalDays} <span className="text-xl text-[#666]">days</span></div>
          </div>
        </div>

        {/* Time Progress */}
        <div className="bg-[#111]/50 rounded-xl border border-[#2a2a2a] p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-violet-400" />
              <span className="text-[#888] text-sm font-medium">Time Progress</span>
            </div>
            <div className="text-right">
              <span className="text-[#c0c0c0] text-sm font-bold">{daysPassed} days</span>
              <span className="text-[#666] text-xs"> / {totalDays} days</span>
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
      </div>
    </div>
  );
}