import { useState, useEffect } from 'react';
import { Calendar, ChevronDown, Filter, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const presets = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'Last 30 Days', value: '30days' },
  { label: 'All Time', value: 'all' },
  { label: 'Custom Range', value: 'custom' }
];

export default function GlobalTimeFilter({ onFilterChange, allTrades }) {
  const [selectedPreset, setSelectedPreset] = useState('all');
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [showCustom, setShowCustom] = useState(false);
  const [selectedCoins, setSelectedCoins] = useState([]);
  const [selectedStrategies, setSelectedStrategies] = useState([]);
  const [timezone, setTimezone] = useState('UTC');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Extract unique coins and strategies
  const uniqueCoins = [...new Set(allTrades.map(t => t.coin).filter(Boolean))].sort();
  const uniqueStrategies = [...new Set(allTrades.map(t => t.strategy_tag).filter(Boolean))].sort();

  const handlePresetSelect = (preset) => {
    setSelectedPreset(preset);
    
    if (preset === 'custom') {
      setShowCustom(true);
      return;
    }
    
    setShowCustom(false);
    const now = new Date();
    
    let from, to;
    switch (preset) {
      case 'today':
        from = startOfDay(now);
        to = endOfDay(now);
        break;
      case 'yesterday':
        const yesterday = subDays(now, 1);
        from = startOfDay(yesterday);
        to = endOfDay(yesterday);
        break;
      case 'week':
        from = startOfWeek(now, { weekStartsOn: 1 });
        to = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'month':
        from = startOfMonth(now);
        to = endOfMonth(now);
        break;
      case '30days':
        from = startOfDay(subDays(now, 30));
        to = endOfDay(now);
        break;
      case 'all':
        from = null;
        to = null;
        break;
      default:
        from = null;
        to = null;
    }
    
    setDateFrom(from);
    setDateTo(to);
    
    // Apply immediately
    onFilterChange({ 
      from, 
      to, 
      coins: selectedCoins, 
      strategies: selectedStrategies, 
      timezone 
    });
  };

  const handleCustomApply = () => {
    if (dateFrom && dateTo) {
      onFilterChange({ 
        from: startOfDay(dateFrom), 
        to: endOfDay(dateTo),
        coins: selectedCoins,
        strategies: selectedStrategies,
        timezone
      });
      setShowCustom(false);
    }
  };

  const applyFilters = (timeFilter) => {
    onFilterChange({ 
      ...timeFilter,
      coins: selectedCoins,
      strategies: selectedStrategies,
      timezone
    });
  };

  const toggleCoin = (coin) => {
    setSelectedCoins(prev => 
      prev.includes(coin) ? prev.filter(c => c !== coin) : [...prev, coin]
    );
  };

  const toggleStrategy = (strategy) => {
    setSelectedStrategies(prev => 
      prev.includes(strategy) ? prev.filter(s => s !== strategy) : [...prev, strategy]
    );
  };

  useEffect(() => {
    if (selectedPreset !== 'custom' && selectedPreset !== 'all') {
      onFilterChange({ 
        from: dateFrom, 
        to: dateTo, 
        coins: selectedCoins, 
        strategies: selectedStrategies, 
        timezone 
      });
    }
  }, [selectedCoins, selectedStrategies, timezone]);

  return (
    <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#0a0a0a]/70 border-b border-[#2a2a2a]/30 rounded-2xl p-4 mb-4">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-[#888]" />
          <div className="flex gap-2">
            {presets.map(preset => (
              <Button
                key={preset.value}
                size="sm"
                onClick={() => handlePresetSelect(preset.value)}
                className={cn(
                  "h-8 px-3 text-xs font-medium transition-all rounded-full",
                  selectedPreset === preset.value
                    ? "bg-white text-black hover:bg-gray-100"
                    : "bg-[#1a1a1a] text-[#888] hover:bg-[#222] hover:text-[#c0c0c0] border border-[#2a2a2a]"
                )}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {showCustom && (
        <div className="mt-3 flex items-center gap-3 max-w-7xl mx-auto">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="bg-[#1a1a1a] border-[#2a2a2a] text-[#c0c0c0]">
                <Calendar className="w-4 h-4 mr-2" />
                {dateFrom ? format(dateFrom, 'MMM dd, yyyy') : 'From'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-[#1a1a1a] border-[#333]">
              <CalendarComponent
                mode="single"
                selected={dateFrom}
                onSelect={setDateFrom}
              />
            </PopoverContent>
          </Popover>

          <span className="text-[#666]">→</span>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="bg-[#1a1a1a] border-[#2a2a2a] text-[#c0c0c0]">
                <Calendar className="w-4 h-4 mr-2" />
                {dateTo ? format(dateTo, 'MMM dd, yyyy') : 'To'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-[#1a1a1a] border-[#333]">
              <CalendarComponent
                mode="single"
                selected={dateTo}
                onSelect={setDateTo}
              />
            </PopoverContent>
          </Popover>

          <Button
            onClick={handleCustomApply}
            disabled={!dateFrom || !dateTo}
            className="bg-white text-black hover:bg-gray-100"
          >
            Apply
          </Button>
        </div>
      )}
    </div>
  );
}