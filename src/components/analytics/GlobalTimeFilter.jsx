import { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { cn } from "@/lib/utils";

const presets = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'Last 30 Days', value: '30days' },
  { label: 'All Time', value: 'all' },
  { label: 'Custom Range', value: 'custom' }
];

export default function GlobalTimeFilter({ onFilterChange, activeDataset, onDatasetChange }) {
  const [selectedPreset, setSelectedPreset] = useState('all');
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [showCustom, setShowCustom] = useState(false);

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
        from = startOfDay(subDays(now, 1));
        to = endOfDay(subDays(now, 1));
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
    onFilterChange({ from, to });
  };

  const handleCustomApply = () => {
    if (dateFrom && dateTo) {
      onFilterChange({ from: startOfDay(dateFrom), to: endOfDay(dateTo) });
      setShowCustom(false);
    }
  };

  return (
    <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#0a0a0a]/95 border-b border-[#2a2a2a]/50 p-4">
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
                  "h-8 px-3 text-xs font-medium transition-all",
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

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#666]">Dataset:</span>
          <div className="flex gap-1 bg-[#1a1a1a] rounded-lg p-1 border border-[#2a2a2a]">
            {['closed', 'open', 'both'].map(ds => (
              <button
                key={ds}
                onClick={() => onDatasetChange(ds)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded transition-all",
                  activeDataset === ds
                    ? "bg-white text-black"
                    : "text-[#888] hover:text-[#c0c0c0]"
                )}
              >
                {ds === 'closed' ? 'Closed' : ds === 'open' ? 'Open' : 'Both'}
              </button>
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