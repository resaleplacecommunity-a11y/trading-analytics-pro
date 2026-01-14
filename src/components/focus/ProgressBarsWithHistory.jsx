import { useState } from "react";
import { TrendingUp, Calendar, Award, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatInTimeZone } from 'date-fns-tz';
import { startOfWeek, startOfMonth, addDays, addWeeks, addMonths, endOfWeek, endOfMonth } from 'date-fns';
import { parseTradeDateToUserTz } from '../utils/dateUtils';

const formatNumber = (num) => {
  return Math.abs(num).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

export default function ProgressBarsWithHistory({ goal, trades, userTimezone = 'UTC' }) {
  const [dayOffset, setDayOffset] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  if (!goal) return null;

  const mode = goal.mode;
  const baseCapital = mode === 'personal' ? goal.current_capital_usd : goal.prop_account_size_usd;
  
  let netTarget;
  if (mode === 'personal') {
    netTarget = goal.target_capital_usd - goal.current_capital_usd;
  } else {
    netTarget = (goal.target_capital_usd + goal.prop_fee_usd) / (goal.profit_split_percent / 100);
  }

  // Calculate days elapsed since goal start (not resetting)
  const goalStartDate = goal.start_date ? new Date(goal.start_date) : new Date(goal.created_at || Date.now());
  const now = new Date();
  const daysElapsed = Math.max(1, Math.ceil((now - goalStartDate) / (1000 * 60 * 60 * 24)));
  
  const totalDays = goal.time_horizon_days || 180;
  const profitPerDay = netTarget / totalDays;
  const profitPerWeek = profitPerDay * 7;
  const profitPerMonth = profitPerDay * 30;

  const percentPerDay = (profitPerDay / baseCapital) * 100;
  const percentPerWeek = (profitPerWeek / baseCapital) * 100;
  const percentPerMonth = (profitPerMonth / baseCapital) * 100;

  // Calculate dates
  const targetDay = addDays(now, dayOffset);
  const targetWeekStart = addWeeks(startOfWeek(now, { weekStartsOn: 1 }), weekOffset);
  const targetWeekEnd = endOfWeek(targetWeekStart, { weekStartsOn: 1 });
  
  // Fix: Create date at first of month, then add months
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const targetMonthStart = addMonths(currentMonth, monthOffset);
  const targetMonthEnd = endOfMonth(targetMonthStart);

  // Calculate PNL for periods using timezone-aware date utilities
  const closedTrades = trades?.filter(t => t.close_price) || [];
  const openTrades = trades?.filter(t => !t.close_price) || [];

  // Day: use date string comparison in user timezone
  const dayStr = formatInTimeZone(targetDay, userTimezone, 'yyyy-MM-dd');
  let pnlDay = closedTrades
    .filter(t => {
      const tradeDateStr = parseTradeDateToUserTz(t.date_close, userTimezone);
      return tradeDateStr === dayStr;
    })
    .reduce((sum, t) => sum + (t.pnl_usd || 0), 0);
  
  // Add partial closes from open trades (day)
  openTrades.forEach(t => {
    if (t.partial_closes) {
      try {
        const partials = JSON.parse(t.partial_closes);
        partials.forEach(pc => {
          if (pc.timestamp) {
            const pcDate = parseTradeDateToUserTz(pc.timestamp, userTimezone);
            if (pcDate === dayStr) {
              pnlDay += (pc.pnl_usd || 0);
            }
          }
        });
      } catch {}
    }
  });

  // Week: use date string comparison in user timezone
  const weekStartStr = formatInTimeZone(targetWeekStart, userTimezone, 'yyyy-MM-dd');
  const weekEndStr = formatInTimeZone(targetWeekEnd, userTimezone, 'yyyy-MM-dd');
  
  let pnlWeek = closedTrades
    .filter(t => {
      const tradeDateStr = parseTradeDateToUserTz(t.date_close, userTimezone);
      return tradeDateStr && tradeDateStr >= weekStartStr && tradeDateStr <= weekEndStr;
    })
    .reduce((sum, t) => sum + (t.pnl_usd || 0), 0);
  
  // Add partial closes from open trades (week)
  openTrades.forEach(t => {
    if (t.partial_closes) {
      try {
        const partials = JSON.parse(t.partial_closes);
        partials.forEach(pc => {
          if (pc.timestamp) {
            const pcDate = parseTradeDateToUserTz(pc.timestamp, userTimezone);
            if (pcDate && pcDate >= weekStartStr && pcDate <= weekEndStr) {
              pnlWeek += (pc.pnl_usd || 0);
            }
          }
        });
      } catch {}
    }
  });

  // Month: use date string comparison in user timezone
  const monthStartStr = formatInTimeZone(targetMonthStart, userTimezone, 'yyyy-MM-dd');
  const monthEndStr = formatInTimeZone(targetMonthEnd, userTimezone, 'yyyy-MM-dd');
  
  let pnlMonth = closedTrades
    .filter(t => {
      const tradeDateStr = parseTradeDateToUserTz(t.date_close, userTimezone);
      return tradeDateStr && tradeDateStr >= monthStartStr && tradeDateStr <= monthEndStr;
    })
    .reduce((sum, t) => sum + (t.pnl_usd || 0), 0);
  
  // Add partial closes from open trades (month)
  openTrades.forEach(t => {
    if (t.partial_closes) {
      try {
        const partials = JSON.parse(t.partial_closes);
        partials.forEach(pc => {
          if (pc.timestamp) {
            const pcDate = parseTradeDateToUserTz(pc.timestamp, userTimezone);
            if (pcDate && pcDate >= monthStartStr && pcDate <= monthEndStr) {
              pnlMonth += (pc.pnl_usd || 0);
            }
          }
        });
      } catch {}
    }
  });

  const progressDay = Math.min((pnlDay / profitPerDay) * 100, 200);
  const progressWeek = Math.min((pnlWeek / profitPerWeek) * 100, 200);
  const progressMonth = Math.min((pnlMonth / profitPerMonth) * 100, 200);

  const periods = [
    { 
      label: 'Daily', 
      icon: TrendingUp, 
      required: profitPerDay, 
      requiredPct: percentPerDay, 
      actual: pnlDay, 
      progress: progressDay, 
      color: 'emerald',
      dateStr: formatInTimeZone(targetDay, userTimezone, 'MMM dd, yyyy'),
      offset: dayOffset,
      setOffset: setDayOffset,
      isCurrent: dayOffset === 0
    },
    { 
      label: 'Weekly', 
      icon: Calendar, 
      required: profitPerWeek, 
      requiredPct: percentPerWeek, 
      actual: pnlWeek, 
      progress: progressWeek, 
      color: 'blue',
      dateStr: `${formatInTimeZone(targetWeekStart, userTimezone, 'MMM dd')} - ${formatInTimeZone(targetWeekEnd, userTimezone, 'MMM dd')}`,
      offset: weekOffset,
      setOffset: setWeekOffset,
      isCurrent: weekOffset === 0
    },
    { 
      label: 'Monthly', 
      icon: Award, 
      required: profitPerMonth, 
      requiredPct: percentPerMonth, 
      actual: pnlMonth, 
      progress: progressMonth, 
      color: 'violet',
      dateStr: formatInTimeZone(targetMonthStart, userTimezone, 'MMMM yyyy'),
      offset: monthOffset,
      setOffset: setMonthOffset,
      isCurrent: monthOffset === 0
    }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {periods.map(({ label, icon: Icon, required, requiredPct, actual, progress, color, dateStr, offset, setOffset, isCurrent }) => (
        <div key={label} className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-2xl border-2 border-[#2a2a2a] p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Icon className={cn("w-5 h-5", `text-${color}-400`)} />
              <span className="text-[#c0c0c0] font-bold">{label}</span>
            </div>
            {isCurrent && (
              <span className="px-2 py-1 text-xs bg-violet-500/20 text-violet-400 rounded-full">Current</span>
            )}
          </div>

          {/* Date Navigation */}
          <div className="flex items-center justify-between mb-4 bg-[#111]/50 rounded-lg p-2">
            <Button
              onClick={() => setOffset(offset - 1)}
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-[#888] hover:text-[#c0c0c0]"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-[#888] text-xs font-medium">{dateStr}</span>
            <Button
              onClick={() => setOffset(offset + 1)}
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-[#888] hover:text-[#c0c0c0]"
              disabled={offset >= 0}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Actual */}
          <div className="mb-3">
            <div className="text-[#666] text-xs uppercase tracking-wider mb-1">Earned</div>
            <div className={cn(
              "text-3xl font-bold",
              actual >= 0 ? "text-emerald-400" : "text-red-400"
            )}>
              {actual >= 0 ? '+' : '−'}${formatNumber(Math.abs(actual))}
            </div>
          </div>

          {/* Required Info */}
          <div className="bg-[#0d0d0d] rounded-lg p-3 mb-4">
            <div className="text-[#666] text-xs uppercase tracking-wider mb-1">Target</div>
            <div className="flex items-baseline gap-2">
              <span className="text-[#c0c0c0] text-xl font-bold">${formatNumber(required)}</span>
              <span className="text-emerald-400 text-sm font-medium">
                (+{requiredPct.toFixed(1)}%)
              </span>
            </div>
          </div>
          
          <div className="h-3 bg-[#0d0d0d] rounded-full overflow-hidden mb-2">
            <div
              className={cn(
                "h-full transition-all duration-500",
                progress >= 100 
                  ? `bg-gradient-to-r from-emerald-500 to-emerald-400` 
                  : "bg-gradient-to-r from-amber-500 to-amber-400"
              )}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          
          <div className="text-center">
            <span className={cn(
              "text-sm font-bold",
              progress >= 100 ? "text-emerald-400" : progress >= 50 ? "text-amber-400" : "text-red-400"
            )}>
              {progress.toFixed(0)}% complete
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}