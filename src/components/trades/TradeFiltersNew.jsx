import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function TradeFiltersNew({ filters, setFilters, strategies, coins }) {
  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-3">
      {/* First Row */}
      <div className="flex gap-2 flex-wrap">
        {/* Search */}
        <Input
          placeholder="Search..."
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
          className="w-[200px] bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]"
        />

        {/* All/L/S */}
        <div className="flex gap-1 bg-[#151515] rounded-lg p-1 border border-[#2a2a2a]">
          <Button
            size="sm"
            variant={filters.direction === 'all' ? 'default' : 'ghost'}
            onClick={() => updateFilter('direction', 'all')}
            className={cn(
              "h-8 px-3",
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
              "h-8 px-3",
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
              "h-8 px-3",
              filters.direction === 'Short' 
                ? "bg-red-500 text-white" 
                : "text-[#888] hover:text-[#c0c0c0]"
            )}
          >
            S
          </Button>
        </div>

        {/* Coins */}
        <Select value={filters.coin} onValueChange={(v) => updateFilter('coin', v)}>
          <SelectTrigger className="w-[140px] bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]">
            <SelectValue placeholder="All Coins" />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
            <SelectItem value="all" className="text-[#c0c0c0]">All Coins</SelectItem>
            {coins.map(coin => (
              <SelectItem key={coin} value={coin} className="text-[#c0c0c0]">{coin}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Strategies */}
        <Select value={filters.strategy} onValueChange={(v) => updateFilter('strategy', v)}>
          <SelectTrigger className="w-[140px] bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]">
            <SelectValue placeholder="All Strategies" />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
            <SelectItem value="all" className="text-[#c0c0c0]">All Strategies</SelectItem>
            {strategies.map(s => (
              <SelectItem key={s} value={s} className="text-[#c0c0c0]">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Rules */}
        <Select value={filters.ruleCompliance} onValueChange={(v) => updateFilter('ruleCompliance', v)}>
          <SelectTrigger className="w-[120px] bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]">
            <SelectValue placeholder="Rules" />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
            <SelectItem value="all" className="text-[#c0c0c0]">All Rules</SelectItem>
            <SelectItem value="true" className="text-[#c0c0c0]">Followed</SelectItem>
            <SelectItem value="false" className="text-[#c0c0c0]">Violated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Second Row */}
      <div className="flex gap-2 flex-wrap">
        {/* Date From */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[180px] justify-start text-left bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateFrom ? format(new Date(filters.dateFrom), 'dd.MM.yyyy') : 'From Date'}
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
            <Button variant="outline" className="w-[180px] justify-start text-left bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateTo ? format(new Date(filters.dateTo), 'dd.MM.yyyy') : 'To Date'}
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

        {/* Sort */}
        <Select value={filters.sortBy} onValueChange={(v) => updateFilter('sortBy', v)}>
          <SelectTrigger className="w-[180px] bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
            <SelectItem value="latest" className="text-[#c0c0c0]">Latest First</SelectItem>
            <SelectItem value="best_percent" className="text-[#c0c0c0]">Best % First</SelectItem>
            <SelectItem value="worst_percent" className="text-[#c0c0c0]">Worst % First</SelectItem>
            <SelectItem value="best_usd" className="text-[#c0c0c0]">Best $ First</SelectItem>
            <SelectItem value="worst_usd" className="text-[#c0c0c0]">Worst $ First</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}