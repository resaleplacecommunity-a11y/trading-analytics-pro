import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from "@/lib/utils";

export default function TradeTableFilters({ 
  filters, 
  setFilters, 
  coins, 
  strategies, 
  timeframes 
}) {
  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="bg-[#151515] rounded-lg p-2 border border-[#2a2a2a] flex items-center gap-2 flex-wrap">
      {/* Direction */}
      <div className="flex gap-1 bg-[#0d0d0d] rounded p-0.5">
        <Button
          size="sm"
          variant={filters.direction === 'all' ? 'default' : 'ghost'}
          onClick={() => updateFilter('direction', 'all')}
          className={cn(
            "h-6 px-2 text-xs",
            filters.direction === 'all' 
              ? "bg-[#c0c0c0] text-black" 
              : "text-[#888] hover:text-[#c0c0c0]"
          )}
        >
          All
        </Button>
        <Button
          size="sm"
          variant={filters.direction === 'Long' ? 'default' : 'ghost'}
          onClick={() => updateFilter('direction', 'Long')}
          className={cn(
            "h-6 px-2 text-xs",
            filters.direction === 'Long' 
              ? "bg-emerald-500 text-white" 
              : "text-[#888] hover:text-[#c0c0c0]"
          )}
        >
          L
        </Button>
        <Button
          size="sm"
          variant={filters.direction === 'Short' ? 'default' : 'ghost'}
          onClick={() => updateFilter('direction', 'Short')}
          className={cn(
            "h-6 px-2 text-xs",
            filters.direction === 'Short' 
              ? "bg-red-500 text-white" 
              : "text-[#888] hover:text-[#c0c0c0]"
          )}
        >
          S
        </Button>
      </div>

      {/* Coin */}
      <Select value={filters.coin} onValueChange={(v) => updateFilter('coin', v)}>
        <SelectTrigger className="w-[100px] h-6 bg-[#0d0d0d] border-0 text-[#c0c0c0] text-xs">
          <SelectValue placeholder="Coin" />
        </SelectTrigger>
        <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
          <SelectItem value="all" className="text-[#c0c0c0] text-xs">All Coins</SelectItem>
          {coins.map(coin => (
            <SelectItem key={coin} value={coin} className="text-[#c0c0c0] text-xs">{coin}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Strategy */}
      <Select value={filters.strategy} onValueChange={(v) => updateFilter('strategy', v)}>
        <SelectTrigger className="w-[110px] h-6 bg-[#0d0d0d] border-0 text-[#c0c0c0] text-xs">
          <SelectValue placeholder="Strategy" />
        </SelectTrigger>
        <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
          <SelectItem value="all" className="text-[#c0c0c0] text-xs">All Strategies</SelectItem>
          {strategies.map(s => (
            <SelectItem key={s} value={s} className="text-[#c0c0c0] text-xs">{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Timeframe */}
      <Select value={filters.timeframe} onValueChange={(v) => updateFilter('timeframe', v)}>
        <SelectTrigger className="w-[100px] h-6 bg-[#0d0d0d] border-0 text-[#c0c0c0] text-xs">
          <SelectValue placeholder="Timeframe" />
        </SelectTrigger>
        <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
          <SelectItem value="all" className="text-[#c0c0c0] text-xs">All TF</SelectItem>
          {timeframes.map(tf => (
            <SelectItem key={tf} value={tf} className="text-[#c0c0c0] text-xs">
              {tf.charAt(0).toUpperCase() + tf.slice(1)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Result */}
      <Select value={filters.result} onValueChange={(v) => updateFilter('result', v)}>
        <SelectTrigger className="w-[90px] h-6 bg-[#0d0d0d] border-0 text-[#c0c0c0] text-xs">
          <SelectValue placeholder="Result" />
        </SelectTrigger>
        <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
          <SelectItem value="all" className="text-[#c0c0c0] text-xs">All</SelectItem>
          <SelectItem value="winning" className="text-[#c0c0c0] text-xs">Win</SelectItem>
          <SelectItem value="losing" className="text-[#c0c0c0] text-xs">Loss</SelectItem>
          <SelectItem value="breakeven" className="text-[#c0c0c0] text-xs">BE</SelectItem>
        </SelectContent>
      </Select>

      <div className="h-4 w-px bg-[#2a2a2a] mx-1" />

      {/* Date From */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" className="h-6 px-2 text-xs text-[#888] hover:text-[#c0c0c0]">
            <CalendarIcon className="mr-1 h-3 w-3" />
            {filters.dateFrom ? format(new Date(filters.dateFrom), 'dd.MM') : 'From'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-[#1a1a1a] border-[#2a2a2a]">
          <Calendar
            mode="single"
            selected={filters.dateFrom ? new Date(filters.dateFrom) : undefined}
            onSelect={(date) => updateFilter('dateFrom', date ? format(date, 'yyyy-MM-dd') : '')}
            className="text-[#c0c0c0]"
          />
        </PopoverContent>
      </Popover>

      {/* Date To */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" className="h-6 px-2 text-xs text-[#888] hover:text-[#c0c0c0]">
            <CalendarIcon className="mr-1 h-3 w-3" />
            {filters.dateTo ? format(new Date(filters.dateTo), 'dd.MM') : 'To'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-[#1a1a1a] border-[#2a2a2a]">
          <Calendar
            mode="single"
            selected={filters.dateTo ? new Date(filters.dateTo) : undefined}
            onSelect={(date) => updateFilter('dateTo', date ? format(date, 'yyyy-MM-dd') : '')}
            className="text-[#c0c0c0]"
          />
        </PopoverContent>
      </Popover>

      <div className="h-4 w-px bg-[#2a2a2a] mx-1" />

      {/* Sort */}
      <Select value={filters.sortBy} onValueChange={(v) => updateFilter('sortBy', v)}>
        <SelectTrigger className="w-[90px] h-6 bg-[#0d0d0d] border-0 text-[#c0c0c0] text-xs">
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
          <SelectItem value="default" className="text-[#c0c0c0] text-xs">Default</SelectItem>
          <SelectItem value="best_pnl" className="text-[#c0c0c0] text-xs">Best PNL</SelectItem>
          <SelectItem value="worst_pnl" className="text-[#c0c0c0] text-xs">Worst PNL</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}