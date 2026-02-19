import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X } from 'lucide-react';

export default function TradeFilters({ filters, setFilters, strategies, coins }) {
  const resetFilters = () => {
    setFilters({
      search: '',
      direction: 'all',
      strategy: 'all',
      coin: 'all',
      dateFrom: '',
      dateTo: '',
      minR: '',
      maxR: '',
      ruleCompliance: 'all'
    });
  };

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === 'search') return value !== '';
    if (key === 'direction' || key === 'strategy' || key === 'coin' || key === 'ruleCompliance') return value !== 'all';
    return value !== '';
  });

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-4 border border-[#2a2a2a] space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" />
          <Input 
            placeholder="Search by coin, strategy..."
            value={filters.search}
            onChange={(e) => setFilters({...filters, search: e.target.value})}
            className="pl-9 bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]"
          />
        </div>
        
        <Select value={filters.direction} onValueChange={(v) => setFilters({...filters, direction: v})}>
          <SelectTrigger className="w-32 bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]">
            <SelectValue placeholder="Direction" />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="Long">Long</SelectItem>
            <SelectItem value="Short">Short</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.coin} onValueChange={(v) => setFilters({...filters, coin: v})}>
          <SelectTrigger className="w-32 bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]">
            <SelectValue placeholder="Coin" />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
            <SelectItem value="all">All Coins</SelectItem>
            {coins.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.strategy} onValueChange={(v) => setFilters({...filters, strategy: v})}>
          <SelectTrigger className="w-40 bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]">
            <SelectValue placeholder="Strategy" />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
            <SelectItem value="all">All Strategies</SelectItem>
            {strategies.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.ruleCompliance} onValueChange={(v) => setFilters({...filters, ruleCompliance: v})}>
          <SelectTrigger className="w-36 bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]">
            <SelectValue placeholder="Rules" />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="true">Followed</SelectItem>
            <SelectItem value="false">Violated</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="icon" onClick={resetFilters} className="text-[#888]">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[#666] text-xs">From:</span>
          <Input 
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
            className="w-36 bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#666] text-xs">To:</span>
          <Input 
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
            className="w-36 bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#666] text-xs">R from:</span>
          <Input 
            type="number"
            placeholder="-3"
            value={filters.minR}
            onChange={(e) => setFilters({...filters, minR: e.target.value})}
            className="w-20 bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#666] text-xs">R to:</span>
          <Input 
            type="number"
            placeholder="5"
            value={filters.maxR}
            onChange={(e) => setFilters({...filters, maxR: e.target.value})}
            className="w-20 bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] text-xs"
          />
        </div>
      </div>
    </div>
  );
}