import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Filter, X } from 'lucide-react';
import { format, subDays, startOfMonth, startOfYear } from 'date-fns';
import { cn } from "@/lib/utils";

export default function AnalyticsFilters({ filters, setFilters, allTrades }) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Get unique values
  const symbols = [...new Set(allTrades.map(t => t.coin?.replace('USDT', '')).filter(Boolean))];
  const strategies = [...new Set(allTrades.map(t => t.strategy_tag).filter(Boolean))];
  const timeframes = ['scalp', 'day', 'swing', 'mid_term', 'long_term', 'spot'];

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const toggleArrayFilter = (key, value) => {
    setFilters(prev => {
      const arr = prev[key] || [];
      const newArr = arr.includes(value) 
        ? arr.filter(v => v !== value)
        : [...arr, value];
      return { ...prev, [key]: newArr };
    });
  };

  // Quick date range presets
  const applyPreset = (preset) => {
    const today = new Date();
    let from = null;
    
    if (preset === 'today') from = today;
    else if (preset === 'week') from = subDays(today, 7);
    else if (preset === 'month') from = subDays(today, 30);
    else if (preset === 'mtd') from = startOfMonth(today);
    else if (preset === 'ytd') from = startOfYear(today);
    
    setFilters(prev => ({ 
      ...prev, 
      dateRange: preset,
      dateFrom: from,
      dateTo: today
    }));
  };

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-[#2a2a2a] rounded-xl p-4 space-y-3">
      {/* Primary Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {/* Date Range */}
        <Select value={filters.dateRange} onValueChange={applyPreset}>
          <SelectTrigger className="bg-[#0d0d0d] border-[#2a2a2a] text-white h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-[#333]">
            <SelectItem value="today" className="text-white text-xs">Today</SelectItem>
            <SelectItem value="week" className="text-white text-xs">7 Days</SelectItem>
            <SelectItem value="month" className="text-white text-xs">30 Days</SelectItem>
            <SelectItem value="mtd" className="text-white text-xs">Month to Date</SelectItem>
            <SelectItem value="ytd" className="text-white text-xs">Year to Date</SelectItem>
            <SelectItem value="custom" className="text-white text-xs">Custom</SelectItem>
          </SelectContent>
        </Select>

        {filters.dateRange === 'custom' && (
          <>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="bg-[#0d0d0d] border-[#2a2a2a] text-white justify-start h-9 text-xs">
                  <CalendarIcon className="mr-2 h-3 w-3" />
                  {filters.dateFrom ? format(filters.dateFrom, 'MMM dd') : 'From'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-[#1a1a1a] border-[#333]">
                <Calendar mode="single" selected={filters.dateFrom} onSelect={(date) => updateFilter('dateFrom', date)} />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="bg-[#0d0d0d] border-[#2a2a2a] text-white justify-start h-9 text-xs">
                  <CalendarIcon className="mr-2 h-3 w-3" />
                  {filters.dateTo ? format(filters.dateTo, 'MMM dd') : 'To'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-[#1a1a1a] border-[#333]">
                <Calendar mode="single" selected={filters.dateTo} onSelect={(date) => updateFilter('dateTo', date)} />
              </PopoverContent>
            </Popover>
          </>
        )}

        {/* Status */}
        <Select value={filters.status} onValueChange={(val) => updateFilter('status', val)}>
          <SelectTrigger className="bg-[#0d0d0d] border-[#2a2a2a] text-white h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-[#333]">
            <SelectItem value="closed" className="text-white text-xs">Closed</SelectItem>
            <SelectItem value="open" className="text-white text-xs">Open</SelectItem>
            <SelectItem value="all" className="text-white text-xs">Both</SelectItem>
          </SelectContent>
        </Select>

        {/* Direction */}
        <Select value={filters.direction} onValueChange={(val) => updateFilter('direction', val)}>
          <SelectTrigger className="bg-[#0d0d0d] border-[#2a2a2a] text-white h-9 text-xs">
            <SelectValue placeholder="All Directions" />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-[#333]">
            <SelectItem value="all" className="text-white text-xs">All Sides</SelectItem>
            <SelectItem value="Long" className="text-white text-xs">Long Only</SelectItem>
            <SelectItem value="Short" className="text-white text-xs">Short Only</SelectItem>
          </SelectContent>
        </Select>

        {/* Advanced Filters Toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="bg-[#0d0d0d] border-[#2a2a2a] text-white h-9 text-xs"
        >
          <Filter className="w-3 h-3 mr-2" />
          {showAdvanced ? 'Hide' : 'More'}
        </Button>
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-[#2a2a2a]">
          {/* Symbols */}
          <div>
            <p className="text-[10px] text-[#666] uppercase tracking-wide mb-2">Symbols</p>
            <div className="flex flex-wrap gap-1">
              {symbols.slice(0, 8).map(symbol => (
                <Badge
                  key={symbol}
                  variant="outline"
                  className={cn(
                    "cursor-pointer transition-colors text-xs",
                    filters.symbols.includes(symbol)
                      ? "bg-[#c0c0c0] text-black border-[#c0c0c0]"
                      : "bg-[#0d0d0d] text-[#888] border-[#2a2a2a] hover:bg-[#1a1a1a]"
                  )}
                  onClick={() => toggleArrayFilter('symbols', symbol)}
                >
                  {symbol}
                </Badge>
              ))}
            </div>
          </div>

          {/* Strategies */}
          <div>
            <p className="text-[10px] text-[#666] uppercase tracking-wide mb-2">Strategies</p>
            <div className="flex flex-wrap gap-1">
              {strategies.slice(0, 6).map(strategy => (
                <Badge
                  key={strategy}
                  variant="outline"
                  className={cn(
                    "cursor-pointer transition-colors text-xs",
                    filters.strategies.includes(strategy)
                      ? "bg-[#c0c0c0] text-black border-[#c0c0c0]"
                      : "bg-[#0d0d0d] text-[#888] border-[#2a2a2a] hover:bg-[#1a1a1a]"
                  )}
                  onClick={() => toggleArrayFilter('strategies', strategy)}
                >
                  {strategy}
                </Badge>
              ))}
            </div>
          </div>

          {/* Timeframes */}
          <div>
            <p className="text-[10px] text-[#666] uppercase tracking-wide mb-2">Timeframes</p>
            <div className="flex flex-wrap gap-1">
              {timeframes.map(tf => (
                <Badge
                  key={tf}
                  variant="outline"
                  className={cn(
                    "cursor-pointer transition-colors text-xs",
                    filters.timeframes.includes(tf)
                      ? "bg-[#c0c0c0] text-black border-[#c0c0c0]"
                      : "bg-[#0d0d0d] text-[#888] border-[#2a2a2a] hover:bg-[#1a1a1a]"
                  )}
                  onClick={() => toggleArrayFilter('timeframes', tf)}
                >
                  {tf}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}