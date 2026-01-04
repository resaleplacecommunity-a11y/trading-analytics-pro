import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, addMonths } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { cn } from "@/lib/utils";
import { formatNumber, calculateDailyStats, getExitType } from './analyticsCalculations';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export default function TradingCalendar({ trades, onDayClick, userTimezone = 'Europe/Moscow' }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const dailyStats = useMemo(() => {
    const stats = calculateDailyStats(trades, userTimezone);
    return stats;
  }, [trades, userTimezone]);

  // Calculate month boundaries in user timezone
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get first day of week for padding
  const firstDayOfWeek = monthStart.getDay();
  const paddingDays = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const handleDayClick = (dateStr) => {
    const stats = dailyStats[dateStr];
    if (stats) {
      setSelectedDay({ date: dateStr, stats });
      setSheetOpen(true);
    }
  };

  return (
    <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-[#c0c0c0] flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-violet-400" />
          Trading Calendar
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 hover:bg-[#1a1a1a] rounded transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-[#888]" />
          </button>
          <div className="text-sm font-medium text-[#c0c0c0] min-w-[140px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </div>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 hover:bg-[#1a1a1a] rounded transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-[#888]" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
          <div key={day} className="text-center text-xs text-[#666] font-medium py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2">
        {/* Padding days */}
        {Array(paddingDays).fill(null).map((_, i) => (
          <div key={`pad-${i}`} className="aspect-square" />
        ))}

        {/* Days */}
        {daysInMonth.map(day => {
          // Get the calendar day number from the date object
          const dayNumber = day.getDate();
          const monthNumber = day.getMonth() + 1;
          const yearNumber = day.getFullYear();
          
          // Build date string in user's timezone context
          const dateStr = `${yearNumber}-${String(monthNumber).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
          
          const stats = dailyStats[dateStr];
          const hasData = !!stats;
          const today = new Date();
          const todayStr = formatInTimeZone(today, userTimezone, 'yyyy-MM-dd');
          const isToday = todayStr === dateStr;
          
          // Determine if it's breakeven (almost zero PNL)
          const isBreakeven = hasData && Math.abs(stats.pnlUsd) < 1 && Math.abs(stats.pnlPercent) < 0.05;

          return (
            <div
              key={dateStr}
              onClick={() => hasData && handleDayClick(dateStr)}
              className={cn(
                "aspect-square rounded-lg border transition-all relative",
                hasData 
                  ? "cursor-pointer hover:border-[#c0c0c0]/50 hover:shadow-lg" 
                  : "border-[#1a1a1a]",
                hasData && stats.pnlUsd > 1
                  ? "bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border-emerald-500/30"
                  : hasData && stats.pnlUsd < -1
                  ? "bg-gradient-to-br from-red-500/20 to-red-500/5 border-red-500/30"
                  : hasData && isBreakeven
                  ? "bg-gradient-to-br from-amber-500/20 to-amber-500/5 border-amber-500/30"
                  : "bg-[#111]/30 border-[#222]",
                isToday && "ring-2 ring-violet-400/50"
              )}
            >
              <div className="absolute top-1 left-1 text-xs text-[#888]">
                {format(day, 'd')}
              </div>
              {hasData && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-1">
                  <div className={cn(
                    "text-xs font-bold",
                    isBreakeven ? "text-amber-400" :
                    stats.pnlUsd >= 0 ? "text-emerald-400" : "text-red-400"
                  )}>
                    {isBreakeven ? 'BE' : (stats.pnlUsd >= 0 ? '+' : '') + '$' + formatNumber(Math.abs(stats.pnlUsd))}
                  </div>
                  <div className="text-[10px] text-[#888]">
                    {stats.pnlPercent >= 0 ? '+' : ''}{stats.pnlPercent.toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-[#666] mt-0.5">
                    {stats.count} trades
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Day Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="bg-[#111] border-l border-[#2a2a2a] w-[500px]">
          {selectedDay && (
            <>
              <SheetHeader>
                <SheetTitle className="text-[#c0c0c0]">
                  {format(new Date(selectedDay.date), 'MMMM dd, yyyy')}
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#1a1a1a] rounded-lg p-4">
                    <div className="text-xs text-[#666] mb-1">Total PNL</div>
                    <div className={cn(
                      "text-2xl font-bold",
                      selectedDay.stats.pnlUsd >= 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                      {selectedDay.stats.pnlUsd >= 0 ? '+' : ''}${formatNumber(selectedDay.stats.pnlUsd)}
                    </div>
                    <div className="text-xs text-[#888] mt-1">
                      {selectedDay.stats.pnlPercent >= 0 ? '+' : ''}{selectedDay.stats.pnlPercent.toFixed(2)}%
                    </div>
                  </div>
                  <div className="bg-[#1a1a1a] rounded-lg p-4">
                    <div className="text-xs text-[#666] mb-1">Trades</div>
                    <div className="text-2xl font-bold text-[#c0c0c0]">
                      {selectedDay.stats.count}
                    </div>
                    <div className="text-xs text-[#888] mt-1">
                      {selectedDay.stats.trades.filter(t => (t.pnl_usd || 0) > 0).length}W / {selectedDay.stats.trades.filter(t => (t.pnl_usd || 0) < 0).length}L
                    </div>
                  </div>
                </div>

                {/* Trades List */}
                <div>
                  <div className="text-sm font-medium text-[#888] mb-2">Trades</div>
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {selectedDay.stats.trades.map(trade => {
                      const pnl = trade.pnl_usd || 0;
                      const exitType = getExitType(trade);
                      
                      return (
                        <div 
                          key={trade.id} 
                          className={cn(
                            "rounded-lg p-3 hover:brightness-110 transition-all border",
                            pnl >= 0 
                              ? "bg-emerald-500/20 border-emerald-500/40" 
                              : "bg-red-500/20 border-red-500/40"
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[#c0c0c0] font-medium">{trade.coin}</span>
                              <span className={cn(
                                "text-xs px-2 py-0.5 rounded",
                                trade.direction === 'Long' ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                              )}>
                                {trade.direction}
                              </span>
                            </div>
                            <div className={cn(
                              "font-bold",
                              pnl >= 0 ? "text-emerald-400" : "text-red-400"
                            )}>
                              {pnl >= 0 ? '+' : ''}${formatNumber(Math.abs(pnl))}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-[#666]">Entry:</span>
                              <span className="text-[#888] ml-1">${trade.entry_price?.toFixed(4)}</span>
                            </div>
                            <div>
                              <span className="text-[#666]">Exit:</span>
                              <span className="text-[#888] ml-1">${trade.close_price?.toFixed(4)}</span>
                            </div>
                          </div>
                          {trade.strategy_tag && (
                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-xs text-violet-400">{trade.strategy_tag}</span>
                              <span className="text-xs text-[#666]">•</span>
                              <span className={cn(
                                "text-xs px-1.5 py-0.5 rounded",
                                exitType === 'Stop' && "bg-red-500/30 text-red-300",
                                exitType === 'Take' && "bg-emerald-500/30 text-emerald-300",
                                exitType === 'Manual' && "bg-blue-500/30 text-blue-300",
                                exitType === 'Breakeven' && "bg-amber-500/30 text-amber-300"
                              )}>
                                {exitType}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}