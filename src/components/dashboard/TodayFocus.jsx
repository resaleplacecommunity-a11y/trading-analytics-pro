import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatInTimeZone } from 'date-fns-tz';
import { startOfWeek } from 'date-fns';
import { BookOpen, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function TodayFocus({ userTimezone = 'UTC' }) {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 30 * 60 * 1000,
  });

  const weekStart = formatInTimeZone(startOfWeek(new Date(), { weekStartsOn: 1 }), userTimezone, 'yyyy-MM-dd');

  const { data: outlook } = useQuery({
    queryKey: ['weeklyOutlookFocus', user?.email, weekStart],
    queryFn: async () => {
      if (!user?.email) return null;
      const items = await base44.entities.WeeklyOutlook.filter({ created_by: user.email, week_start: weekStart }, '-created_date', 1);
      return items[0] || null;
    },
    enabled: !!user?.email,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const setups = (() => { try { return JSON.parse(outlook?.setups_to_trade || '[]'); } catch { return []; } })();
  const noTradeRules = (() => { try { return JSON.parse(outlook?.no_trade_rules || '[]'); } catch { return []; } })();

  const parseItem = (item) => typeof item === 'string' ? item : item?.text || item?.name || '';

  return (
    <div className="bg-[#111]/60 border border-[#2a2a2a]/60 rounded-xl p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-violet-400/70" />
          <span className="text-sm font-semibold text-[#c0c0c0]">Session Plan</span>
        </div>
        {outlook?.overall_trend && (
          <span className={cn(
            "text-[10px] px-2 py-0.5 rounded-full font-medium",
            outlook.overall_trend === 'Bull' ? "bg-emerald-500/15 text-emerald-400" :
            outlook.overall_trend === 'Bear' ? "bg-red-500/15 text-red-400" :
            "bg-amber-500/15 text-amber-400"
          )}>
            {outlook.overall_trend}
          </span>
        )}
      </div>

      {!outlook ? (
        <div className="flex-1 flex flex-col items-center justify-center py-4">
          <p className="text-xs text-[#555]">No weekly plan for this week.</p>
          <p className="text-[10px] text-[#444] mt-1">Create one in Market Outlook →</p>
        </div>
      ) : (
        <div className="flex-1 space-y-3 min-h-0">
          {setups.length > 0 && (
            <div>
              <div className="text-[10px] text-emerald-400/60 uppercase tracking-wider mb-1.5 font-medium">Trade These</div>
              <div className="space-y-1">
                {setups.slice(0, 3).map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-[#888]">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400/50 flex-shrink-0 mt-0.5" />
                    <span className="line-clamp-1">{parseItem(s)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {noTradeRules.length > 0 && (
            <div>
              <div className="text-[10px] text-red-400/60 uppercase tracking-wider mb-1.5 font-medium">Avoid</div>
              <div className="space-y-1">
                {noTradeRules.slice(0, 3).map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-[#888]">
                    <XCircle className="w-3 h-3 text-red-400/50 flex-shrink-0 mt-0.5" />
                    <span className="line-clamp-1">{parseItem(r)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {outlook.expectations_week && (
            <div className="pt-2 border-t border-[#1a1a1a]">
              <p className="text-xs text-[#555] leading-relaxed line-clamp-3">{outlook.expectations_week}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}