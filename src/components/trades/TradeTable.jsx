import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ChevronRight, ChevronDown, TrendingUp, TrendingDown, Clock, Timer, Trophy, XCircle, Filter, ChevronUp, Search, AlertCircle } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Slider } from "@/components/ui/slider";
import TradeExpandedDetails from './TradeExpandedDetails';
import OpenTradeCard from './OpenTradeCard';
import ClosedTradeCard from './ClosedTradeCard';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { formatDateInTimezone } from '../../components/utils/timeUtils';

// Format entry price
const formatEntryPrice = (price) => {
  if (price === undefined || price === null || price === '') return '—';
  const p = parseFloat(price);
  if (isNaN(p)) return '—';
  
  if (Math.abs(p) >= 1) {
    // For numbers >= 1: show up to 4 significant digits total (before + after decimal)
    const str = p.toPrecision(4);
    const formatted = parseFloat(str).toString(); // Remove trailing zeros
    return `$${formatted}`;
  }
  
  // For numbers < 1: show 4 significant digits after leading zeros
  const str = p.toFixed(20);
  const match = str.match(/\.0*([1-9]\d{0,3})/);
  if (match) {
    const zeros = str.indexOf(match[1]) - str.indexOf('.') - 1;
    const formatted = p.toFixed(zeros + 4).replace(/0+$/, '');
    return `$${formatted}`;
  }
  return `$${p.toFixed(4).replace(/\.?0+$/, '')}`;
};

const formatNumber = (num) => {
  if (num === undefined || num === null || num === '') return '—';
  const n = parseFloat(num);
  if (isNaN(n)) return '—';
  return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
};

export default function TradeTable({ 
  trades, 
  onUpdate, 
  onDelete, 
  onClosePosition,
  onMoveStopToBE,
  currentBalance,
  bulkDeleteMode,
  selectedTradeIds,
  onToggleSelection
}) {
  const [expandedIds, setExpandedIds] = useState([]);
  const [userTimezone, setUserTimezone] = useState('Europe/Moscow');

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  useEffect(() => {
    if (user?.preferred_timezone) {
      setUserTimezone(user.preferred_timezone);
    }
  }, [user]);

  useEffect(() => {
    const handleTimezoneChange = () => {
      base44.auth.me().then(u => {
        if (u?.preferred_timezone) setUserTimezone(u.preferred_timezone);
      });
    };
    window.addEventListener('timezonechange', handleTimezoneChange);
    return () => window.removeEventListener('timezonechange', handleTimezoneChange);
  }, []);

  const formatDate = (dateString) => formatDateInTimezone(dateString, userTimezone, 'short');
  const [filters, setFilters] = useState({
    direction: 'all',
    coin: 'all',
    strategy: 'all',
    status: 'all',
    dateFrom: null,
    dateTo: null,
    pnlSort: 'default',
    durationSort: 'default',
    aiScoreMin: 0,
    aiScoreMax: 10
  });
  const [searchCoin, setSearchCoin] = useState('');
  const [searchStrategy, setSearchStrategy] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  
  // Helper to check if trade is BE
  const isBE = (trade) => {
    if (!trade.close_price) return false;
    const pnl = trade.pnl_usd || 0;
    const balance = trade.account_balance_at_entry || currentBalance || 100000;
    const pnlPercent = Math.abs((pnl / balance) * 100);
    return Math.abs(pnl) <= 0.5 || pnlPercent <= 0.01;
  };

  // Separate open and closed trades
  const openTrades = trades.filter(t => !t.close_price);
  const closedTrades = trades.filter(t => t.close_price);

  // Get unique values
  const coins = [...new Set(trades.map(t => t.coin?.replace('USDT', '')).filter(Boolean))];
  const strategies = [...new Set(trades.map(t => t.strategy_tag).filter(Boolean))];

  // Apply filters
  let filtered = trades.filter(trade => {
    if (filters.direction !== 'all' && trade.direction !== filters.direction) return false;
    
    const coinName = trade.coin?.replace('USDT', '');
    if (filters.coin !== 'all' && coinName !== filters.coin) return false;
    
    if (filters.strategy !== 'all' && trade.strategy_tag !== filters.strategy) return false;
    
    // Status filter
    const isOpen = !trade.close_price;
    if (filters.status !== 'all') {
      if (filters.status === 'open' && !isOpen) return false;
      if (filters.status === 'win' && (isOpen || (trade.pnl_usd || 0) <= 0)) return false;
      if (filters.status === 'lose' && (isOpen || (trade.pnl_usd || 0) >= 0)) return false;
    }
    
    if (filters.dateFrom) {
      const tradeDate = new Date(trade.date_open || trade.date);
      if (tradeDate < filters.dateFrom) return false;
    }
    
    if (filters.dateTo) {
      const tradeDate = new Date(trade.date_open || trade.date);
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59);
      if (tradeDate > toDate) return false;
    }

    // AI Score filter
    const aiScore = trade.ai_score || 0;
    if (aiScore < filters.aiScoreMin || aiScore > filters.aiScoreMax) return false;
    
    return true;
  });

  // Sorting logic
  if (filters.pnlSort !== 'default') {
    filtered.sort((a, b) => {
      const aPnl = a.pnl_usd || 0;
      const bPnl = b.pnl_usd || 0;
      return filters.pnlSort === 'desc' ? bPnl - aPnl : aPnl - bPnl;
    });
  } else if (filters.durationSort !== 'default') {
    filtered.sort((a, b) => {
      const aDur = a.actual_duration_minutes || 0;
      const bDur = b.actual_duration_minutes || 0;
      return filters.durationSort === 'desc' ? bDur - aDur : aDur - bDur;
    });
  } else {
    // Default sort: open first (newest), then closed (newest)
    filtered.sort((a, b) => {
      const aOpen = !a.close_price;
      const bOpen = !b.close_price;
      
      if (aOpen && !bOpen) return -1;
      if (!aOpen && bOpen) return 1;
      
      return new Date(b.date_open || b.date) - new Date(a.date_open || a.date);
    });
  }

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to page 1 when filters change
  };

  const resetFilters = () => {
    setFilters({
      direction: 'all',
      coin: 'all',
      strategy: 'all',
      status: 'all',
      dateFrom: null,
      dateTo: null,
      pnlSort: 'default',
      durationSort: 'default',
      aiScoreMin: 0,
      aiScoreMax: 10
    });
    setSearchCoin('');
    setSearchStrategy('');
    setCurrentPage(1);
  };

  const filteredCoins = coins.filter(c => c.toLowerCase().includes(searchCoin.toLowerCase()));
  const filteredStrategies = strategies.filter(s => s.toLowerCase().includes(searchStrategy.toLowerCase()));

  const hasActiveFilters = filters.direction !== 'all' || filters.coin !== 'all' || filters.strategy !== 'all' || 
    filters.status !== 'all' || filters.dateFrom || filters.dateTo || filters.pnlSort !== 'default' || 
    filters.durationSort !== 'default' || filters.aiScoreMin !== 0 || filters.aiScoreMax !== 10;

  // Calculate open trades summary
  const totalOriginalRisk = openTrades.reduce((sum, t) => {
    // Use original_risk_usd if available (for BE trades), otherwise calculate current risk
    if (t.original_risk_usd) return sum + t.original_risk_usd;
    if (t.risk_usd) return sum + t.risk_usd;
    if (!t.entry_price || !t.stop_price || !t.position_size) return sum;
    const stopDistance = Math.abs(t.entry_price - t.stop_price);
    const riskUsd = (stopDistance / t.entry_price) * t.position_size;
    return sum + riskUsd;
  }, 0);
  const totalCurrentRisk = openTrades.reduce((sum, t) => {
    let riskUsd = t.risk_usd;
    
    // If risk_usd is 0 or undefined, recalculate unless stop is at breakeven
    if (riskUsd === 0 || riskUsd === undefined || riskUsd === null) {
      if (!t.entry_price || !t.stop_price || !t.position_size) return sum;
      const isStopAtBE = Math.abs(t.entry_price - t.stop_price) < 0.0001;
      if (!isStopAtBE) {
        const stopDistance = Math.abs(t.entry_price - t.stop_price);
        riskUsd = (stopDistance / t.entry_price) * t.position_size;
      } else {
        riskUsd = 0;
      }
    }
    
    return sum + riskUsd;
  }, 0);
  const totalRiskPercent = currentBalance > 0 ? (totalCurrentRisk / currentBalance) * 100 : 0;
  const totalPotentialProfit = openTrades.reduce((sum, t) => {
    if (!t.take_price || !t.entry_price || !t.position_size) return sum;
    const takeDistance = Math.abs(t.take_price - t.entry_price);
    const potential = (takeDistance / t.entry_price) * t.position_size;
    return sum + potential;
  }, 0);
  const totalPotentialPercent = currentBalance > 0 ? (totalPotentialProfit / currentBalance) * 100 : 0;
  const totalRR = totalCurrentRisk > 0 ? totalPotentialProfit / totalCurrentRisk : 0;

  // Decide if we show visual separation (only if no status filter applied)
  const showSeparation = filters.status === 'all' && !hasActiveFilters;

  // Pagination calculations
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedFiltered = filtered.slice(startIndex, endIndex);

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  return (
    <div className="space-y-4">
      {hasActiveFilters && (
        <div className="flex items-center justify-between bg-[#1a1a1a] rounded-lg px-3 py-1.5 border border-amber-500/30">
          <span className="text-xs text-amber-400">Filters active</span>
          <Button size="sm" variant="ghost" onClick={resetFilters} className="h-5 text-xs text-[#888] hover:text-[#c0c0c0]">
            Reset
          </Button>
        </div>
      )}

      {/* Open Trades Block */}
      {showSeparation && openTrades.length > 0 && (
        <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 via-[#151515]/90 to-[#1a1a1a]/90 rounded-xl border border-[#c0c0c0]/20 shadow-[0_0_30px_rgba(192,192,192,0.1)] overflow-hidden relative">
          {/* Premium glow effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#c0c0c0]/5 via-transparent to-[#c0c0c0]/5 pointer-events-none" />
          <div className="relative">
          {/* Header */}
          <div className="bg-[#1a1a1a] border-b border-[#2a2a2a]">
          <div className={cn(
            "grid gap-3 px-3 py-2.5 text-[10px] font-medium uppercase tracking-wide",
            bulkDeleteMode ? "grid-cols-[30px_30px_40px_100px_100px_60px_100px_90px_110px_140px_90px_70px_30px]" : "grid-cols-[30px_40px_100px_100px_60px_100px_90px_110px_140px_90px_70px_30px]"
          )}>
            {bulkDeleteMode && <div></div>}
            <div></div>
            
            {/* Direction - Clickable */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-center text-[#888] hover:text-[#c0c0c0] transition-colors flex items-center justify-center gap-1 group">
                  Dir
                  <Filter className={cn("w-2.5 h-2.5 opacity-50 group-hover:opacity-100", filters.direction !== 'all' && "text-amber-400 opacity-100")} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-32 p-2 bg-[#1a1a1a] border-[#333]">
                <div className="space-y-1">
                  <button onClick={() => updateFilter('direction', 'all')} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.direction === 'all' && "bg-[#c0c0c0] text-black")}>All</button>
                  <button onClick={() => updateFilter('direction', 'Long')} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.direction === 'Long' && "bg-emerald-500 text-white")}>Long</button>
                  <button onClick={() => updateFilter('direction', 'Short')} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.direction === 'Short' && "bg-red-500 text-white")}>Short</button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Coin - Clickable */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-left text-[#888] hover:text-[#c0c0c0] transition-colors flex items-center gap-1 group">
                  Coin
                  <Filter className={cn("w-2.5 h-2.5 opacity-50 group-hover:opacity-100", filters.coin !== 'all' && "text-amber-400 opacity-100")} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-2 bg-[#1a1a1a] border-[#333]">
                <Input 
                  placeholder="Search coin..." 
                  value={searchCoin}
                  onChange={(e) => setSearchCoin(e.target.value)}
                  className="h-7 text-xs mb-2 bg-[#0d0d0d] border-[#2a2a2a] text-white"
                />
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  <button onClick={() => { updateFilter('coin', 'all'); setSearchCoin(''); }} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.coin === 'all' && "bg-[#c0c0c0] text-black")}>All Coins</button>
                  {filteredCoins.slice(0, 10).map(coin => (
                    <button key={coin} onClick={() => { updateFilter('coin', coin); setSearchCoin(''); }} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.coin === coin && "bg-[#2a2a2a] text-white")}>{coin}</button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Date - Clickable */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-center text-[#888] hover:text-[#c0c0c0] transition-colors flex items-center justify-center gap-1 group">
                  Date
                  <Filter className={cn("w-2.5 h-2.5 opacity-50 group-hover:opacity-100", (filters.dateFrom || filters.dateTo) && "text-amber-400 opacity-100")} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-[#1a1a1a] border-[#333]">
                <div className="flex gap-2 p-3">
                  <div>
                    <p className="text-[10px] text-[#888] mb-2 text-center">From</p>
                    <Calendar
                      mode="single"
                      selected={filters.dateFrom}
                      onSelect={(date) => updateFilter('dateFrom', date)}
                      className="rounded-md border-0"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-[#888] mb-2 text-center">To</p>
                    <Calendar
                      mode="single"
                      selected={filters.dateTo}
                      onSelect={(date) => updateFilter('dateTo', date)}
                      className="rounded-md border-0"
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Status - Clickable */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-center text-[#888] hover:text-[#c0c0c0] transition-colors flex items-center justify-center gap-1 group">
                  Status
                  <Filter className={cn("w-2.5 h-2.5 opacity-50 group-hover:opacity-100", filters.status !== 'all' && "text-amber-400 opacity-100")} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-32 p-2 bg-[#1a1a1a] border-[#333]">
                <div className="space-y-1">
                  <button onClick={() => updateFilter('status', 'all')} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.status === 'all' && "bg-[#c0c0c0] text-black")}>All</button>
                  <button onClick={() => updateFilter('status', 'open')} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.status === 'open' && "bg-amber-500 text-black")}>Open</button>
                  <button onClick={() => updateFilter('status', 'win')} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.status === 'win' && "bg-emerald-500 text-white")}>Win</button>
                  <button onClick={() => updateFilter('status', 'lose')} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.status === 'lose' && "bg-red-500 text-white")}>Lose</button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Strategy - Clickable */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-center text-[#888] hover:text-[#c0c0c0] transition-colors flex items-center justify-center gap-1 group">
                  Strategy
                  <Filter className={cn("w-2.5 h-2.5 opacity-50 group-hover:opacity-100", filters.strategy !== 'all' && "text-amber-400 opacity-100")} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-2 bg-[#1a1a1a] border-[#333]">
                <Input 
                  placeholder="Search strategy..." 
                  value={searchStrategy}
                  onChange={(e) => setSearchStrategy(e.target.value)}
                  className="h-7 text-xs mb-2 bg-[#0d0d0d] border-[#2a2a2a] text-white"
                />
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  <button onClick={() => { updateFilter('strategy', 'all'); setSearchStrategy(''); }} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.strategy === 'all' && "bg-[#c0c0c0] text-black")}>All Strategies</button>
                  {filteredStrategies.map(s => (
                    <button key={s} onClick={() => { updateFilter('strategy', s); setSearchStrategy(''); }} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.strategy === s && "bg-[#2a2a2a] text-white")}>{s}</button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <div className="text-center text-[#666]">Entry</div>
            <div className="text-center text-[#666]">RR / R</div>

            {/* PNL - Clickable for sort */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-center text-[#888] hover:text-[#c0c0c0] transition-colors flex items-center justify-center gap-1 group">
                  PNL
                  {filters.pnlSort === 'desc' ? <ChevronDown className="w-2.5 h-2.5 text-amber-400" /> : filters.pnlSort === 'asc' ? <ChevronUp className="w-2.5 h-2.5 text-amber-400" /> : <Filter className="w-2.5 h-2.5 opacity-50 group-hover:opacity-100" />}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-2 bg-[#1a1a1a] border-[#333]">
                <div className="space-y-1">
                  <button onClick={() => { updateFilter('pnlSort', 'default'); updateFilter('durationSort', 'default'); }} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.pnlSort === 'default' && "bg-[#c0c0c0] text-black")}>Default (Time)</button>
                  <button onClick={() => { updateFilter('pnlSort', 'desc'); updateFilter('durationSort', 'default'); }} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.pnlSort === 'desc' && "bg-emerald-500/20 text-emerald-400")}>Largest first</button>
                  <button onClick={() => { updateFilter('pnlSort', 'asc'); updateFilter('durationSort', 'default'); }} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.pnlSort === 'asc' && "bg-red-500/20 text-red-400")}>Smallest first</button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Duration - Clickable for sort */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-center text-[#888] hover:text-[#c0c0c0] transition-colors flex items-center justify-center gap-1 group">
                  Duration
                  {filters.durationSort === 'desc' ? <ChevronDown className="w-2.5 h-2.5 text-amber-400" /> : filters.durationSort === 'asc' ? <ChevronUp className="w-2.5 h-2.5 text-amber-400" /> : <Filter className="w-2.5 h-2.5 opacity-50 group-hover:opacity-100" />}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-2 bg-[#1a1a1a] border-[#333]">
                <div className="space-y-1">
                  <button onClick={() => { updateFilter('durationSort', 'default'); updateFilter('pnlSort', 'default'); }} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.durationSort === 'default' && "bg-[#c0c0c0] text-black")}>Default (Time)</button>
                  <button onClick={() => { updateFilter('durationSort', 'desc'); updateFilter('pnlSort', 'default'); }} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.durationSort === 'desc' && "bg-[#2a2a2a] text-white")}>Longest first</button>
                  <button onClick={() => { updateFilter('durationSort', 'asc'); updateFilter('pnlSort', 'default'); }} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.durationSort === 'asc' && "bg-[#2a2a2a] text-white")}>Shortest first</button>
                </div>
              </PopoverContent>
            </Popover>

            {/* AI Score - Clickable for range */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-center text-[#888] hover:text-[#c0c0c0] transition-colors flex items-center justify-center gap-1 group">
                  AI
                  <Filter className={cn("w-2.5 h-2.5 opacity-50 group-hover:opacity-100", (filters.aiScoreMin !== 0 || filters.aiScoreMax !== 10) && "text-amber-400 opacity-100")} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-3 bg-[#1a1a1a] border-[#333]">
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs text-white mb-2">
                      <span>Min: {filters.aiScoreMin}</span>
                      <span>Max: {filters.aiScoreMax}</span>
                    </div>
                    <Slider
                      min={0}
                      max={10}
                      step={1}
                      value={[filters.aiScoreMin]}
                      onValueChange={([val]) => updateFilter('aiScoreMin', val)}
                      className="mb-3"
                    />
                    <Slider
                      min={0}
                      max={10}
                      step={1}
                      value={[filters.aiScoreMax]}
                      onValueChange={([val]) => updateFilter('aiScoreMax', val)}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

          {/* Body */}
          <div>
            {paginatedFiltered.filter(t => !t.close_price).map((trade) => {
              const isExpanded = expandedIds.includes(trade.id);
              const isLong = trade.direction === 'Long';
              const coinName = trade.coin?.replace('USDT', '');

              return (
                <TradeRow
                  key={trade.id}
                  trade={trade}
                  isExpanded={isExpanded}
                  isOpen={true}
                  isLong={isLong}
                  isProfit={false}
                  coinName={coinName}
                  rowBg="hover:bg-[#1a1a1a]"
                  formatDate={formatDate}
                  onToggle={() => setExpandedIds(prev => 
                    isExpanded ? prev.filter(id => id !== trade.id) : [...prev, trade.id]
                  )}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  onClosePosition={onClosePosition}
                  onMoveStopToBE={onMoveStopToBE}
                  currentBalance={currentBalance}
                  bulkDeleteMode={bulkDeleteMode}
                  isSelected={selectedTradeIds.includes(trade.id)}
                  onToggleSelection={() => onToggleSelection(trade.id)}
                />
              );
            })}
          </div>
          
          {/* Open Trades Summary */}
          {openTrades.length > 0 && (
            <div className="bg-[#1a1a1a] border-t border-[#2a2a2a] px-3 py-1.5">
              <p className="text-[9px] text-[#666] tracking-wide">
                Total Risk: <span className="text-red-400 font-bold">${formatNumber(totalCurrentRisk)}</span> / <span className="text-red-400/70">{totalRiskPercent.toFixed(1)}%</span>
                <span className="mx-2">•</span>
                Potential Profit: <span className="text-emerald-400 font-bold">${formatNumber(totalPotentialProfit)}</span> / <span className="text-emerald-400/70">{totalPotentialPercent.toFixed(1)}%</span>
                <span className="mx-2">•</span>
                Total RR: {totalCurrentRisk < 0.01 ? (
                  <span className="text-purple-400 font-bold uppercase tracking-wide">NO RISK BRO ONLY PROFIT</span>
                ) : (
                  <span className="text-[#c0c0c0] font-bold">1:{Math.round(totalRR)}</span>
                )}
              </p>
            </div>
            )}
            </div>
            </div>
            )}

      {/* Closed Trades Block */}
      {showSeparation && closedTrades.length > 0 && (
        <div className="backdrop-blur-md bg-gradient-to-br from-[#151515]/80 via-[#0d0d0d]/80 to-[#151515]/80 rounded-xl border border-[#888]/20 shadow-[0_0_20px_rgba(136,136,136,0.08)] overflow-hidden relative">
          {/* Subtle texture */}
          <div className="absolute inset-0 opacity-[0.02]" style={{
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 20px, #c0c0c0 20px, #c0c0c0 21px)`
          }} />
          <div className="relative">
          {/* Header */}
          <div className="bg-[#1a1a1a] border-b border-[#2a2a2a]">
          <div className={cn(
            "grid gap-3 px-3 py-2.5 text-[10px] font-medium uppercase tracking-wide",
            bulkDeleteMode ? "grid-cols-[30px_30px_40px_100px_100px_60px_100px_90px_110px_140px_90px_70px_30px]" : "grid-cols-[30px_40px_100px_100px_60px_100px_90px_110px_140px_90px_70px_30px]"
          )}>
            {bulkDeleteMode && <div></div>}
            <div></div>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="text-center text-[#888] hover:text-[#c0c0c0] transition-colors flex items-center justify-center gap-1 group">
                    Dir
                    <Filter className={cn("w-2.5 h-2.5 opacity-50 group-hover:opacity-100", filters.direction !== 'all' && "text-amber-400 opacity-100")} />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-32 p-2 bg-[#1a1a1a] border-[#333]">
                  <div className="space-y-1">
                    <button onClick={() => updateFilter('direction', 'all')} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.direction === 'all' && "bg-[#c0c0c0] text-black")}>All</button>
                    <button onClick={() => updateFilter('direction', 'Long')} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.direction === 'Long' && "bg-emerald-500 text-white")}>Long</button>
                    <button onClick={() => updateFilter('direction', 'Short')} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.direction === 'Short' && "bg-red-500 text-white")}>Short</button>
                  </div>
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="text-left text-[#888] hover:text-[#c0c0c0] transition-colors flex items-center gap-1 group">
                    Coin
                    <Filter className={cn("w-2.5 h-2.5 opacity-50 group-hover:opacity-100", filters.coin !== 'all' && "text-amber-400 opacity-100")} />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-2 bg-[#1a1a1a] border-[#333]">
                  <Input 
                    placeholder="Search coin..." 
                    value={searchCoin}
                    onChange={(e) => setSearchCoin(e.target.value)}
                    className="h-7 text-xs mb-2 bg-[#0d0d0d] border-[#2a2a2a] text-white"
                  />
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    <button onClick={() => { updateFilter('coin', 'all'); setSearchCoin(''); }} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.coin === 'all' && "bg-[#c0c0c0] text-black")}>All Coins</button>
                    {filteredCoins.slice(0, 10).map(coin => (
                      <button key={coin} onClick={() => { updateFilter('coin', coin); setSearchCoin(''); }} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.coin === coin && "bg-[#2a2a2a] text-white")}>{coin}</button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="text-center text-[#888] hover:text-[#c0c0c0] transition-colors flex items-center justify-center gap-1 group">
                    Date
                    <Filter className={cn("w-2.5 h-2.5 opacity-50 group-hover:opacity-100", (filters.dateFrom || filters.dateTo) && "text-amber-400 opacity-100")} />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-[#1a1a1a] border-[#333]">
                  <div className="flex gap-2 p-3">
                    <div>
                      <p className="text-[10px] text-[#888] mb-2 text-center">From</p>
                      <Calendar
                        mode="single"
                        selected={filters.dateFrom}
                        onSelect={(date) => updateFilter('dateFrom', date)}
                        className="rounded-md border-0"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] text-[#888] mb-2 text-center">To</p>
                      <Calendar
                        mode="single"
                        selected={filters.dateTo}
                        onSelect={(date) => updateFilter('dateTo', date)}
                        className="rounded-md border-0"
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="text-center text-[#888] hover:text-[#c0c0c0] transition-colors flex items-center justify-center gap-1 group">
                    Status
                    <Filter className={cn("w-2.5 h-2.5 opacity-50 group-hover:opacity-100", filters.status !== 'all' && "text-amber-400 opacity-100")} />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-32 p-2 bg-[#1a1a1a] border-[#333]">
                  <div className="space-y-1">
                    <button onClick={() => updateFilter('status', 'all')} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.status === 'all' && "bg-[#c0c0c0] text-black")}>All</button>
                    <button onClick={() => updateFilter('status', 'open')} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.status === 'open' && "bg-amber-500 text-black")}>Open</button>
                    <button onClick={() => updateFilter('status', 'win')} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.status === 'win' && "bg-emerald-500 text-white")}>Win</button>
                    <button onClick={() => updateFilter('status', 'lose')} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.status === 'lose' && "bg-red-500 text-white")}>Lose</button>
                  </div>
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="text-center text-[#888] hover:text-[#c0c0c0] transition-colors flex items-center justify-center gap-1 group">
                    Strategy
                    <Filter className={cn("w-2.5 h-2.5 opacity-50 group-hover:opacity-100", filters.strategy !== 'all' && "text-amber-400 opacity-100")} />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-2 bg-[#1a1a1a] border-[#333]">
                  <Input 
                    placeholder="Search strategy..." 
                    value={searchStrategy}
                    onChange={(e) => setSearchStrategy(e.target.value)}
                    className="h-7 text-xs mb-2 bg-[#0d0d0d] border-[#2a2a2a] text-white"
                  />
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    <button onClick={() => { updateFilter('strategy', 'all'); setSearchStrategy(''); }} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.strategy === 'all' && "bg-[#c0c0c0] text-black")}>All Strategies</button>
                    {filteredStrategies.map(s => (
                      <button key={s} onClick={() => { updateFilter('strategy', s); setSearchStrategy(''); }} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.strategy === s && "bg-[#2a2a2a] text-white")}>{s}</button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <div className="text-center text-[#666]">Entry</div>
              <div className="text-center text-[#666]">RR / R</div>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="text-center text-[#888] hover:text-[#c0c0c0] transition-colors flex items-center justify-center gap-1 group">
                    PNL
                    {filters.pnlSort === 'desc' ? <ChevronDown className="w-2.5 h-2.5 text-amber-400" /> : filters.pnlSort === 'asc' ? <ChevronUp className="w-2.5 h-2.5 text-amber-400" /> : <Filter className="w-2.5 h-2.5 opacity-50 group-hover:opacity-100" />}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-40 p-2 bg-[#1a1a1a] border-[#333]">
                  <div className="space-y-1">
                    <button onClick={() => { updateFilter('pnlSort', 'default'); updateFilter('durationSort', 'default'); }} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.pnlSort === 'default' && "bg-[#c0c0c0] text-black")}>Default (Time)</button>
                    <button onClick={() => { updateFilter('pnlSort', 'desc'); updateFilter('durationSort', 'default'); }} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.pnlSort === 'desc' && "bg-emerald-500/20 text-emerald-400")}>Largest first</button>
                    <button onClick={() => { updateFilter('pnlSort', 'asc'); updateFilter('durationSort', 'default'); }} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.pnlSort === 'asc' && "bg-red-500/20 text-red-400")}>Smallest first</button>
                  </div>
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="text-center text-[#888] hover:text-[#c0c0c0] transition-colors flex items-center justify-center gap-1 group">
                    Duration
                    {filters.durationSort === 'desc' ? <ChevronDown className="w-2.5 h-2.5 text-amber-400" /> : filters.durationSort === 'asc' ? <ChevronUp className="w-2.5 h-2.5 text-amber-400" /> : <Filter className="w-2.5 h-2.5 opacity-50 group-hover:opacity-100" />}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-40 p-2 bg-[#1a1a1a] border-[#333]">
                  <div className="space-y-1">
                    <button onClick={() => { updateFilter('durationSort', 'default'); updateFilter('pnlSort', 'default'); }} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.durationSort === 'default' && "bg-[#c0c0c0] text-black")}>Default (Time)</button>
                    <button onClick={() => { updateFilter('durationSort', 'desc'); updateFilter('pnlSort', 'default'); }} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.durationSort === 'desc' && "bg-[#2a2a2a] text-white")}>Longest first</button>
                    <button onClick={() => { updateFilter('durationSort', 'asc'); updateFilter('pnlSort', 'default'); }} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.durationSort === 'asc' && "bg-[#2a2a2a] text-white")}>Shortest first</button>
                  </div>
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="text-center text-[#888] hover:text-[#c0c0c0] transition-colors flex items-center justify-center gap-1 group">
                    AI
                    <Filter className={cn("w-2.5 h-2.5 opacity-50 group-hover:opacity-100", (filters.aiScoreMin !== 0 || filters.aiScoreMax !== 10) && "text-amber-400 opacity-100")} />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3 bg-[#1a1a1a] border-[#333]">
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs text-white mb-2">
                        <span>Min: {filters.aiScoreMin}</span>
                        <span>Max: {filters.aiScoreMax}</span>
                      </div>
                      <Slider
                        min={0}
                        max={10}
                        step={1}
                        value={[filters.aiScoreMin]}
                        onValueChange={([val]) => updateFilter('aiScoreMin', val)}
                        className="mb-3"
                      />
                      <Slider
                        min={0}
                        max={10}
                        step={1}
                        value={[filters.aiScoreMax]}
                        onValueChange={([val]) => updateFilter('aiScoreMax', val)}
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <div></div>
            </div>
          </div>
          
          {/* Body */}
          <div>
            {paginatedFiltered.filter(t => t.close_price).map((trade) => {
              const isExpanded = expandedIds.includes(trade.id);
              const isOpen = !trade.close_price;
              const isLong = trade.direction === 'Long';
              const pnl = trade.pnl_usd || 0;
              const isBETrade = isBE(trade);
              const isProfit = pnl >= 0;
              const coinName = trade.coin?.replace('USDT', '');

              // Row tint
              let rowBg = 'hover:bg-[#1a1a1a]';
              if (isOpen) {
                rowBg = 'hover:bg-[#1a1a1a]';
              } else if (isBETrade) {
                rowBg = 'bg-amber-500/15 hover:bg-amber-500/20';
              } else if (isProfit) {
                rowBg = 'bg-emerald-500/15 hover:bg-emerald-500/20';
              } else {
                rowBg = 'bg-red-500/15 hover:bg-red-500/20';
              }

              return (
                <TradeRow
                  key={trade.id}
                  trade={trade}
                  isExpanded={isExpanded}
                  isOpen={isOpen}
                  isLong={isLong}
                  isProfit={isProfit}
                  isBETrade={isBETrade}
                  coinName={coinName}
                  rowBg={rowBg}
                  formatDate={formatDate}
                  onToggle={() => setExpandedIds(prev => 
                    isExpanded ? prev.filter(id => id !== trade.id) : [...prev, trade.id]
                  )}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  onClosePosition={onClosePosition}
                  onMoveStopToBE={onMoveStopToBE}
                  currentBalance={currentBalance}
                  bulkDeleteMode={bulkDeleteMode}
                  isSelected={selectedTradeIds.includes(trade.id)}
                  onToggleSelection={() => onToggleSelection(trade.id)}
                />
              );
            })}
            </div>
            </div>
            </div>
            )}

            {/* Unified view when filters are active */}
            {!showSeparation && (
              <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/85 via-[#151515]/85 to-[#0d0d0d]/85 rounded-xl border border-[#c0c0c0]/15 shadow-[0_0_25px_rgba(192,192,192,0.08)] overflow-hidden relative">
                {/* Luxury overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#c0c0c0]/3 via-transparent to-[#888]/3 pointer-events-none" />
                <div className="relative">
            <div className="bg-[#1a1a1a] border-b border-[#2a2a2a] sticky top-0 z-20">
            <div className={cn(
              "grid gap-3 px-3 py-2.5 text-[10px] font-medium uppercase tracking-wide",
              bulkDeleteMode ? "grid-cols-[30px_30px_40px_100px_100px_60px_100px_90px_110px_140px_90px_70px_30px]" : "grid-cols-[30px_40px_100px_100px_60px_100px_90px_110px_140px_90px_70px_30px]"
            )}>
             {bulkDeleteMode && <div></div>}
             <div></div>
             <Popover>
               <PopoverTrigger asChild>
                 <button className="text-center text-[#888] hover:text-[#c0c0c0] transition-colors flex items-center justify-center gap-1 group">
                   Dir
                   <Filter className={cn("w-2.5 h-2.5 opacity-50 group-hover:opacity-100", filters.direction !== 'all' && "text-amber-400 opacity-100")} />
                 </button>
               </PopoverTrigger>
               <PopoverContent className="w-32 p-2 bg-[#1a1a1a] border-[#333]">
                 <div className="space-y-1">
                   <button onClick={() => updateFilter('direction', 'all')} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.direction === 'all' && "bg-[#c0c0c0] text-black")}>All</button>
                   <button onClick={() => updateFilter('direction', 'Long')} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.direction === 'Long' && "bg-emerald-500 text-white")}>Long</button>
                   <button onClick={() => updateFilter('direction', 'Short')} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.direction === 'Short' && "bg-red-500 text-white")}>Short</button>
                 </div>
               </PopoverContent>
             </Popover>
             <Popover>
               <PopoverTrigger asChild>
                 <button className="text-left text-[#888] hover:text-[#c0c0c0] transition-colors flex items-center gap-1 group">
                   Coin
                   <Filter className={cn("w-2.5 h-2.5 opacity-50 group-hover:opacity-100", filters.coin !== 'all' && "text-amber-400 opacity-100")} />
                 </button>
               </PopoverTrigger>
               <PopoverContent className="w-52 p-2 bg-[#1a1a1a] border-[#333]">
                 <Input 
                   placeholder="Search coin..." 
                   value={searchCoin}
                   onChange={(e) => setSearchCoin(e.target.value)}
                   className="h-7 text-xs mb-2 bg-[#0d0d0d] border-[#2a2a2a] text-white"
                 />
                 <div className="space-y-1 max-h-32 overflow-y-auto">
                   <button onClick={() => { updateFilter('coin', 'all'); setSearchCoin(''); }} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.coin === 'all' && "bg-[#c0c0c0] text-black")}>All Coins</button>
                   {filteredCoins.slice(0, 10).map(coin => (
                     <button key={coin} onClick={() => { updateFilter('coin', coin); setSearchCoin(''); }} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.coin === coin && "bg-[#2a2a2a] text-white")}>{coin}</button>
                   ))}
                 </div>
               </PopoverContent>
             </Popover>
             <Popover>
               <PopoverTrigger asChild>
                 <button className="text-center text-[#888] hover:text-[#c0c0c0] transition-colors flex items-center justify-center gap-1 group">
                   Status
                   <Filter className={cn("w-2.5 h-2.5 opacity-50 group-hover:opacity-100", filters.status !== 'all' && "text-amber-400 opacity-100")} />
                 </button>
               </PopoverTrigger>
               <PopoverContent className="w-32 p-2 bg-[#1a1a1a] border-[#333]">
                 <div className="space-y-1">
                   <button onClick={() => updateFilter('status', 'all')} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.status === 'all' && "bg-[#c0c0c0] text-black")}>All</button>
                   <button onClick={() => updateFilter('status', 'open')} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.status === 'open' && "bg-amber-500 text-black")}>Open</button>
                   <button onClick={() => updateFilter('status', 'win')} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.status === 'win' && "bg-emerald-500 text-white")}>Win</button>
                   <button onClick={() => updateFilter('status', 'lose')} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.status === 'lose' && "bg-red-500 text-white")}>Lose</button>
                 </div>
               </PopoverContent>
             </Popover>
             <Popover>
               <PopoverTrigger asChild>
                 <button className="text-center text-[#888] hover:text-[#c0c0c0] transition-colors flex items-center justify-center gap-1 group">
                   Date
                   <Filter className={cn("w-2.5 h-2.5 opacity-50 group-hover:opacity-100", (filters.dateFrom || filters.dateTo) && "text-amber-400 opacity-100")} />
                 </button>
               </PopoverTrigger>
               <PopoverContent className="w-auto p-0 bg-[#1a1a1a] border-[#333]">
                 <div className="flex gap-2 p-3">
                   <div>
                     <p className="text-[10px] text-[#888] mb-2 text-center">From</p>
                     <Calendar
                       mode="single"
                       selected={filters.dateFrom}
                       onSelect={(date) => updateFilter('dateFrom', date)}
                       className="rounded-md border-0"
                     />
                   </div>
                   <div>
                     <p className="text-[10px] text-[#888] mb-2 text-center">To</p>
                     <Calendar
                       mode="single"
                       selected={filters.dateTo}
                       onSelect={(date) => updateFilter('dateTo', date)}
                       className="rounded-md border-0"
                     />
                   </div>
                 </div>
               </PopoverContent>
             </Popover>
             <Popover>
               <PopoverTrigger asChild>
                 <button className="text-center text-[#888] hover:text-[#c0c0c0] transition-colors flex items-center justify-center gap-1 group">
                   Strategy
                   <Filter className={cn("w-2.5 h-2.5 opacity-50 group-hover:opacity-100", filters.strategy !== 'all' && "text-amber-400 opacity-100")} />
                 </button>
               </PopoverTrigger>
               <PopoverContent className="w-52 p-2 bg-[#1a1a1a] border-[#333]">
                 <Input 
                   placeholder="Search strategy..." 
                   value={searchStrategy}
                   onChange={(e) => setSearchStrategy(e.target.value)}
                   className="h-7 text-xs mb-2 bg-[#0d0d0d] border-[#2a2a2a] text-white"
                 />
                 <div className="space-y-1 max-h-32 overflow-y-auto">
                   <button onClick={() => { updateFilter('strategy', 'all'); setSearchStrategy(''); }} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.strategy === 'all' && "bg-[#c0c0c0] text-black")}>All Strategies</button>
                   {filteredStrategies.map(s => (
                     <button key={s} onClick={() => { updateFilter('strategy', s); setSearchStrategy(''); }} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.strategy === s && "bg-[#2a2a2a] text-white")}>{s}</button>
                   ))}
                 </div>
               </PopoverContent>
             </Popover>
             <div className="text-center text-[#666]">Entry</div>
             <div className="text-center text-[#666]">RR / R</div>
             <Popover>
               <PopoverTrigger asChild>
                 <button className="text-center text-[#888] hover:text-[#c0c0c0] transition-colors flex items-center justify-center gap-1 group">
                   PNL
                   {filters.pnlSort === 'desc' ? <ChevronDown className="w-2.5 h-2.5 text-amber-400" /> : filters.pnlSort === 'asc' ? <ChevronUp className="w-2.5 h-2.5 text-amber-400" /> : <Filter className="w-2.5 h-2.5 opacity-50 group-hover:opacity-100" />}
                 </button>
               </PopoverTrigger>
               <PopoverContent className="w-40 p-2 bg-[#1a1a1a] border-[#333]">
                 <div className="space-y-1">
                   <button onClick={() => { updateFilter('pnlSort', 'default'); updateFilter('durationSort', 'default'); }} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.pnlSort === 'default' && "bg-[#c0c0c0] text-black")}>Default (Time)</button>
                   <button onClick={() => { updateFilter('pnlSort', 'desc'); updateFilter('durationSort', 'default'); }} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.pnlSort === 'desc' && "bg-emerald-500/20 text-emerald-400")}>Largest first</button>
                   <button onClick={() => { updateFilter('pnlSort', 'asc'); updateFilter('durationSort', 'default'); }} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.pnlSort === 'asc' && "bg-red-500/20 text-red-400")}>Smallest first</button>
                 </div>
               </PopoverContent>
             </Popover>
             <Popover>
               <PopoverTrigger asChild>
                 <button className="text-center text-[#888] hover:text-[#c0c0c0] transition-colors flex items-center justify-center gap-1 group">
                   Duration
                   {filters.durationSort === 'desc' ? <ChevronDown className="w-2.5 h-2.5 text-amber-400" /> : filters.durationSort === 'asc' ? <ChevronUp className="w-2.5 h-2.5 text-amber-400" /> : <Filter className="w-2.5 h-2.5 opacity-50 group-hover:opacity-100" />}
                 </button>
               </PopoverTrigger>
               <PopoverContent className="w-40 p-2 bg-[#1a1a1a] border-[#333]">
                 <div className="space-y-1">
                   <button onClick={() => { updateFilter('durationSort', 'default'); updateFilter('pnlSort', 'default'); }} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.durationSort === 'default' && "bg-[#c0c0c0] text-black")}>Default (Time)</button>
                   <button onClick={() => { updateFilter('durationSort', 'desc'); updateFilter('pnlSort', 'default'); }} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.durationSort === 'desc' && "bg-[#2a2a2a] text-white")}>Longest first</button>
                   <button onClick={() => { updateFilter('durationSort', 'asc'); updateFilter('pnlSort', 'default'); }} className={cn("w-full text-left px-2 py-1 rounded text-xs hover:bg-[#252525] text-white", filters.durationSort === 'asc' && "bg-[#2a2a2a] text-white")}>Shortest first</button>
                 </div>
               </PopoverContent>
             </Popover>
             <Popover>
               <PopoverTrigger asChild>
                 <button className="text-center text-[#888] hover:text-[#c0c0c0] transition-colors flex items-center justify-center gap-1 group">
                   AI
                   <Filter className={cn("w-2.5 h-2.5 opacity-50 group-hover:opacity-100", (filters.aiScoreMin !== 0 || filters.aiScoreMax !== 10) && "text-amber-400 opacity-100")} />
                 </button>
               </PopoverTrigger>
               <PopoverContent className="w-56 p-3 bg-[#1a1a1a] border-[#333]">
                 <div className="space-y-3">
                   <div>
                     <div className="flex justify-between text-xs text-white mb-2">
                       <span>Min: {filters.aiScoreMin}</span>
                       <span>Max: {filters.aiScoreMax}</span>
                     </div>
                     <Slider
                       min={0}
                       max={10}
                       step={1}
                       value={[filters.aiScoreMin]}
                       onValueChange={([val]) => updateFilter('aiScoreMin', val)}
                       className="mb-3"
                     />
                     <Slider
                       min={0}
                       max={10}
                       step={1}
                       value={[filters.aiScoreMax]}
                       onValueChange={([val]) => updateFilter('aiScoreMax', val)}
                     />
                   </div>
                 </div>
               </PopoverContent>
             </Popover>
           </div>
           </div>

           <div>
           {filtered.length === 0 ? (
             <div className="text-center py-12 text-[#666]">No trades found</div>
           ) : (
             paginatedFiltered.map((trade) => {
               const isExpanded = expandedIds.includes(trade.id);
               const isOpen = !trade.close_price;
               const isLong = trade.direction === 'Long';
               const pnl = trade.pnl_usd || 0;
               const isBETrade = isBE(trade);
               const isProfit = pnl >= 0;
               const coinName = trade.coin?.replace('USDT', '');

               let rowBg = 'hover:bg-[#1a1a1a]';
               if (isOpen) {
                 rowBg = 'hover:bg-[#1a1a1a]';
               } else if (isBETrade) {
                 rowBg = 'bg-amber-500/15 hover:bg-amber-500/20';
               } else if (isProfit) {
                 rowBg = 'bg-emerald-500/15 hover:bg-emerald-500/20';
               } else {
                 rowBg = 'bg-red-500/15 hover:bg-red-500/20';
               }

               return (
                 <TradeRow
                   key={trade.id}
                   trade={trade}
                   isExpanded={isExpanded}
                   isOpen={isOpen}
                   isLong={isLong}
                   isProfit={isProfit}
                   isBETrade={isBETrade}
                   coinName={coinName}
                   rowBg={rowBg}
                   formatDate={formatDate}
                   onToggle={() => setExpandedId(isExpanded ? null : trade.id)}
                   onUpdate={onUpdate}
                   onDelete={onDelete}
                   onClosePosition={onClosePosition}
                   onMoveStopToBE={onMoveStopToBE}
                   currentBalance={currentBalance}
                   bulkDeleteMode={bulkDeleteMode}
                   isSelected={selectedTradeIds.includes(trade.id)}
                   onToggleSelection={() => onToggleSelection(trade.id)}
                   />
                   );
                   })
                   )}
                   </div>

                   {/* Pagination Footer */}
                   {filtered.length > itemsPerPage && (
                     <div className="bg-[#1a1a1a] border-t border-[#2a2a2a] px-4 py-3 flex items-center justify-between">
                       <div className="text-xs text-[#666]">
                         Showing {startIndex + 1}-{Math.min(endIndex, filtered.length)} of {filtered.length} trades
                       </div>
                       <div className="flex items-center gap-2">
                         <Button
                           onClick={handlePrevPage}
                           disabled={currentPage === 1}
                           size="sm"
                           variant="outline"
                           className="bg-[#111] border-[#2a2a2a] text-[#888] hover:text-[#c0c0c0] disabled:opacity-30"
                         >
                           Previous
                         </Button>
                         <span className="text-xs text-[#c0c0c0] px-3">
                           Page {currentPage} of {totalPages}
                         </span>
                         <Button
                           onClick={handleNextPage}
                           disabled={currentPage === totalPages}
                           size="sm"
                           variant="outline"
                           className="bg-[#111] border-[#2a2a2a] text-[#888] hover:text-[#c0c0c0] disabled:opacity-30"
                         >
                           Next
                         </Button>
                       </div>
                     </div>
                   )}
                   </div>
                   </div>
                   )}
                   </div>
                   );
                   }

function TradeRow({ 
  trade, 
  isExpanded, 
  isOpen, 
  isLong, 
  isProfit,
  isBETrade,
  coinName, 
  rowBg,
  formatDate,
  onToggle,
  onUpdate,
  onDelete,
  onClosePosition,
  onMoveStopToBE,
  currentBalance,
  bulkDeleteMode,
  isSelected,
  onToggleSelection
}) {
  const expandedBorderStyle = isExpanded 
    ? "border-2 border-[#c0c0c0]/30 shadow-[0_0_15px_rgba(192,192,192,0.2)] bg-[#111]" 
    : "";
  const [duration, setDuration] = useState(0);

  // Check for incomplete data
  const missingFields = [];
  if (isOpen) {
    if (!trade.strategy_tag) missingFields.push('Strategy');
    if (!trade.timeframe) missingFields.push('Timeframe');
    if (!trade.confidence_level || trade.confidence_level === 0) missingFields.push('Confidence');
    if (!trade.entry_reason) missingFields.push('Entry Reason');
    if (!trade.stop_price) missingFields.push('Stop Price');
    if (!trade.take_price) missingFields.push('Take Profit');
  } else {
    if (!trade.trade_analysis) missingFields.push('Trade Analysis');
    if (!trade.violation_tags) missingFields.push('Errors/Violations');
  }
  const hasIncompleteData = missingFields.length > 0;

  useEffect(() => {
    if (!isOpen) return;
    const updateDuration = () => {
      const openTime = new Date(trade.date_open || trade.date);
      const diff = Math.floor((new Date() - openTime) / 1000);
      setDuration(diff);
    };
    updateDuration();
    const interval = setInterval(updateDuration, 1000);
    return () => clearInterval(interval);
  }, [isOpen, trade.date_open, trade.date]);

  const formatDuration = (seconds) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    
    let result = [];
    if (d > 0) result.push(`${d}d`);
    if (h > 0) result.push(`${h}h`);
    result.push(`${m}m`);
    return result.join(' ');
  };

  const pnl = trade.pnl_usd || 0;
  const pnlPercent = trade.pnl_percent_of_balance || 0;

  // Calculate risk on the fly if not stored
  const balance = trade.account_balance_at_entry || currentBalance || 100000;
  const isStopAtBE = Math.abs(trade.stop_price - trade.entry_price) < 0.0001;
  
  const displayRiskUsd = (trade.risk_usd !== undefined && (trade.risk_usd > 0 || isStopAtBE))
    ? trade.risk_usd 
    : (() => {
      if (!trade.entry_price || !trade.stop_price || !trade.position_size) return 0;
      const stopDistance = Math.abs(trade.entry_price - trade.stop_price);
      return (stopDistance / trade.entry_price) * trade.position_size;
    })();

  const displayRiskPercent = (trade.risk_percent !== undefined && (trade.risk_percent > 0 || isStopAtBE))
    ? trade.risk_percent
    : ((displayRiskUsd / balance) * 100);

  // Calculate RR using same logic as OpenTradeCard
  const takeDistance = Math.abs(trade.take_price - trade.entry_price);
  const potentialUsd = (takeDistance / trade.entry_price) * trade.position_size;
  const potentialPercent = (potentialUsd / balance) * 100;
  
  let rrRatio = 0;
  if (isStopAtBE && trade.take_price > 0) {
    rrRatio = potentialUsd / (trade.original_risk_usd || 1);
  } else if (displayRiskUsd > 0 && trade.take_price > 0) {
    rrRatio = potentialUsd / displayRiskUsd;
  } else if (trade.rr_ratio !== undefined && trade.rr_ratio > 0) {
    rrRatio = trade.rr_ratio;
  }

  return (
    <div className={cn("border-b border-[#1a1a1a] last:border-0 transition-all duration-200 relative", expandedBorderStyle)}>
      {/* Background Design (when expanded) - Cyberpunk Style */}
      {isExpanded && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Radial gradients */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-radial from-[#c0c0c0]/15 via-[#888]/5 to-transparent blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-radial from-[#888]/12 via-transparent to-transparent blur-2xl" />
          
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: `
              linear-gradient(to right, #c0c0c0 1px, transparent 1px),
              linear-gradient(to bottom, #c0c0c0 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px'
          }} />
          
          {/* Diagonal lines */}
          <div className="absolute inset-0 opacity-[0.025]" style={{
            backgroundImage: `repeating-linear-gradient(
              45deg,
              transparent,
              transparent 40px,
              #c0c0c0 40px,
              #c0c0c0 41px
            )`
          }} />
          
          {/* Accent lines */}
          <div className="absolute top-0 left-1/4 w-[1px] h-full bg-gradient-to-b from-transparent via-[#c0c0c0]/20 to-transparent" />
          <div className="absolute top-0 right-1/3 w-[1px] h-full bg-gradient-to-b from-transparent via-[#c0c0c0]/15 to-transparent" />
          
          {/* Glow effects */}
          <div className="absolute top-1/4 right-1/4 w-32 h-32 bg-[#c0c0c0]/5 blur-[50px] rounded-full" />
          <div className="absolute bottom-1/3 left-1/3 w-40 h-40 bg-[#888]/8 blur-[60px] rounded-full" />
        </div>
      )}
      
      {/* Main Row */}
      <div 
        className={cn(
          "grid gap-3 px-3 py-2.5 items-center transition-colors relative z-10",
          bulkDeleteMode ? "grid-cols-[30px_30px_40px_100px_100px_60px_100px_90px_110px_140px_90px_70px_30px]" : "grid-cols-[30px_40px_100px_100px_60px_100px_90px_110px_140px_90px_70px_30px]",
          rowBg,
          isExpanded && "bg-[#111]"
        )}
      >
        {/* Checkbox for bulk delete */}
        {bulkDeleteMode && (
          <div className="flex items-center justify-center" onClick={(e) => { e.stopPropagation(); onToggleSelection(); }}>
            <input 
              type="checkbox" 
              checked={isSelected}
              onChange={() => {}}
              className="w-4 h-4 cursor-pointer accent-red-500"
            />
          </div>
        )}
        
        {/* Expand */}
        <div className="flex items-center justify-center cursor-pointer" onClick={onToggle}>
          {isExpanded ? 
            <ChevronDown className="w-3.5 h-3.5 text-[#666]" /> : 
            <ChevronRight className="w-3.5 h-3.5 text-[#666]" />
          }
        </div>

        {/* Direction */}
        <div className="flex items-center justify-center">
          <div className={cn(
            "w-7 h-7 rounded flex items-center justify-center",
            isLong ? "bg-emerald-500/20" : "bg-red-500/20"
          )}>
            {isLong ? 
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> : 
              <TrendingDown className="w-3.5 h-3.5 text-red-400" />
            }
          </div>
        </div>

        {/* Coin */}
        <div className="text-[#c0c0c0] font-bold text-sm cursor-pointer" onClick={onToggle}>
          {coinName}
        </div>

        {/* Date */}
        <div className="text-center">
          <div className="text-xs text-[#c0c0c0]">
            {formatDate(trade.date_open || trade.date).split(' ')[0]}
          </div>
          <div className="text-[10px] text-[#666]">
            {formatDate(trade.date_open || trade.date).split(' ')[1]}
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center justify-center gap-1">
          {isOpen ? (
            <Timer className="w-3.5 h-3.5 text-[#888]" />
          ) : isBETrade ? (
            <span className="text-amber-400 text-[10px] font-bold">BE</span>
          ) : isProfit ? (
            <span className="text-emerald-400 text-[10px] font-bold">WIN</span>
          ) : (
            <span className="text-red-400 text-[10px] font-bold">LOSE</span>
          )}
        </div>

        {/* Strategy */}
        <div className="text-xs text-[#888] truncate text-center">
          {trade.strategy_tag || <span className="text-[#555]">⋯</span>}
        </div>

        {/* Entry */}
        <div className="text-xs text-[#c0c0c0] font-medium text-center">
          {formatEntryPrice(trade.entry_price)}
        </div>

        {/* RR / R */}
        <div className="text-center">
          {isOpen ? (
            <div>
              <div className={cn(
                "text-sm font-bold",
                isStopAtBE && trade.take_price > 0 ? "text-emerald-400" : (rrRatio >= 2 ? "text-emerald-400" : "text-red-400")
              )}>
                {isStopAtBE && trade.take_price > 0 ? `0:${Math.round(potentialPercent)}%` : `1:${Math.round(rrRatio)}`}
              </div>
              <div className="text-[9px] text-red-400/70">
                Risk: ${formatNumber(Math.abs(displayRiskUsd))} / {Math.abs(displayRiskPercent).toFixed(1)}%
              </div>
            </div>
          ) : (
            <span className={cn(
              "text-sm font-bold",
              (trade.r_multiple || 0) >= 0 ? "text-emerald-400" : "text-red-400"
            )}>
              {(trade.r_multiple || 0) >= 0 ? '+' : ''}{(trade.r_multiple || 0).toFixed(1)}R
            </span>
          )}
        </div>

        {/* PNL */}
        <div className="text-center">
          {isOpen ? (
            (trade.realized_pnl_usd && trade.realized_pnl_usd !== 0) ? (
              <div>
                <div className={cn(
                  "text-sm font-bold",
                  trade.realized_pnl_usd >= 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  {trade.realized_pnl_usd >= 0 ? `+$${formatNumber(trade.realized_pnl_usd)}` : `-$${formatNumber(Math.abs(trade.realized_pnl_usd))}`}
                </div>
                <div className={cn(
                  "text-[10px]",
                  trade.realized_pnl_usd >= 0 ? "text-emerald-400/70" : "text-red-400/70"
                )}>
                  {trade.realized_pnl_usd >= 0 ? '+' : ''}{((trade.realized_pnl_usd / (trade.account_balance_at_entry || currentBalance)) * 100).toFixed(1)}%
                </div>
              </div>
            ) : (
              <span className="text-xs text-[#666]">—</span>
            )
          ) : (
            <div>
              <div className={cn(
                "text-sm font-bold",
                isProfit ? "text-emerald-400" : "text-red-400"
              )}>
                {isProfit ? `+$${formatNumber(pnl)}` : `-$${formatNumber(Math.abs(pnl))}`}
              </div>
              <div className={cn(
                "text-[10px]",
                isProfit ? "text-emerald-400/70" : "text-red-400/70"
              )}>
                {isProfit ? '+' : ''}{pnlPercent.toFixed(1)}%
              </div>
            </div>
          )}
        </div>

        {/* Duration */}
        <div className="text-center text-xs text-[#888]">
          {isOpen ? (
            <span className="text-amber-400 font-mono">{formatDuration(duration)}</span>
          ) : trade.actual_duration_minutes > 0 ? (
            formatDuration(trade.actual_duration_minutes * 60)
          ) : '—'}
        </div>

        {/* AI */}
        <div className="text-center">
          <span className={cn(
            "text-[10px] px-1.5 py-0.5 rounded",
            (trade.ai_score || 0) >= 5 ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
          )}>
            {(trade.ai_score || 0).toFixed(0)}/10
          </span>
        </div>

        {/* Warning Icon */}
        <div className="flex items-center justify-center">
          {hasIncompleteData && (
            <div className="relative group">
              <AlertCircle className="w-4 h-4 text-red-500 animate-pulse cursor-help" />
              <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 w-48 bg-[#111] border border-red-500/50 rounded-lg p-3 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity z-50 text-left shadow-xl">
                <div className="text-xs text-red-400 font-medium mb-2">Missing Fields:</div>
                <ul className="text-[10px] text-[#888] space-y-1">
                  {missingFields.map((field, i) => (
                    <li key={i}>• {field}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        isOpen ? (
          <OpenTradeCard
            trade={trade}
            onUpdate={onUpdate}
            onDelete={onDelete}
            currentBalance={currentBalance}
            formatDate={formatDate}
          />
        ) : (
          <ClosedTradeCard 
            trade={trade}
            onUpdate={onUpdate}
            onDelete={onDelete}
            currentBalance={currentBalance}
            formatDate={formatDate}
          />
        )
      )}
    </div>
  );
}