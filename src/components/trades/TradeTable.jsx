import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ChevronRight, ChevronDown, TrendingUp, TrendingDown, Clock, Trophy, XCircle, Filter, ChevronUp, Search } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Slider } from "@/components/ui/slider";
import TradeExpandedDetails from './TradeExpandedDetails';

// Moscow Time (UTC+3)
const toMoscowTime = (dateString) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  const moscowTime = new Date(date.getTime() + (3 * 60 * 60 * 1000) - (date.getTimezoneOffset() * 60 * 1000));
  return moscowTime;
};

const formatMoscowDate = (dateString) => {
  const moscowDate = toMoscowTime(dateString);
  if (!moscowDate) return '—';
  return format(moscowDate, 'dd.MM HH:mm');
};

// Format entry price
const formatEntryPrice = (price) => {
  if (!price) return '—';
  if (price >= 1) return `$${Math.round(price)}`;
  return `$${price.toFixed(4).replace(/\.?0+$/, '')}`;
};

export default function TradeTable({ 
  trades, 
  onUpdate, 
  onDelete, 
  onClosePosition,
  onMoveStopToBE,
  currentBalance
}) {
  const [expandedId, setExpandedId] = useState(null);
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
      const tradeDate = toMoscowTime(trade.date_open || trade.date);
      if (tradeDate < filters.dateFrom) return false;
    }
    
    if (filters.dateTo) {
      const tradeDate = toMoscowTime(trade.date_open || trade.date);
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
  };

  const filteredCoins = coins.filter(c => c.toLowerCase().includes(searchCoin.toLowerCase()));
  const filteredStrategies = strategies.filter(s => s.toLowerCase().includes(searchStrategy.toLowerCase()));

  const hasActiveFilters = filters.direction !== 'all' || filters.coin !== 'all' || filters.strategy !== 'all' || 
    filters.status !== 'all' || filters.dateFrom || filters.dateTo || filters.pnlSort !== 'default' || 
    filters.durationSort !== 'default' || filters.aiScoreMin !== 0 || filters.aiScoreMax !== 10;

  return (
    <div className="space-y-2">
      {hasActiveFilters && (
        <div className="flex items-center justify-between bg-[#1a1a1a] rounded-lg px-3 py-1.5 border border-amber-500/30">
          <span className="text-xs text-amber-400">Filters active</span>
          <Button size="sm" variant="ghost" onClick={resetFilters} className="h-5 text-xs text-[#888] hover:text-[#c0c0c0]">
            Reset
          </Button>
        </div>
      )}

      <div className="bg-[#151515] rounded-lg border border-[#2a2a2a] overflow-hidden">
        {/* Header */}
        <div className="bg-[#1a1a1a] border-b border-[#2a2a2a] sticky top-0 z-20">
          <div className="grid grid-cols-[30px_40px_100px_60px_100px_100px_90px_110px_140px_90px_70px] gap-3 px-3 py-2.5 text-[10px] font-medium uppercase tracking-wide">
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
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-[#666]">No trades found</div>
          ) : (
            filtered.map((trade) => {
              const isExpanded = expandedId === trade.id;
              const isOpen = !trade.close_price;
              const isLong = trade.direction === 'Long';
              const pnl = trade.pnl_usd || 0;
              const isProfit = pnl >= 0;
              const coinName = trade.coin?.replace('USDT', '');

              // Row tint
              let rowBg = 'hover:bg-[#1a1a1a]';
              if (isOpen) {
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
                  coinName={coinName}
                  rowBg={rowBg}
                  formatDate={formatMoscowDate}
                  onToggle={() => setExpandedId(isExpanded ? null : trade.id)}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  onClosePosition={onClosePosition}
                  onMoveStopToBE={onMoveStopToBE}
                  currentBalance={currentBalance}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function TradeRow({ 
  trade, 
  isExpanded, 
  isOpen, 
  isLong, 
  isProfit, 
  coinName, 
  rowBg,
  formatDate,
  onToggle,
  onUpdate,
  onDelete,
  onClosePosition,
  onMoveStopToBE,
  currentBalance
}) {
  const [duration, setDuration] = useState(0);

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
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const pnl = trade.pnl_usd || 0;
  const pnlPercent = trade.pnl_percent_of_balance || 0;

  return (
    <div className="border-b border-[#1a1a1a] last:border-0">
      {/* Main Row */}
      <div 
        className={cn("grid grid-cols-[30px_40px_100px_60px_100px_100px_90px_110px_140px_90px_70px] gap-3 px-3 py-2.5 items-center cursor-pointer transition-colors", rowBg)}
        onClick={onToggle}
      >
        {/* Expand */}
        <div className="flex items-center justify-center">
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
        <div className="text-[#c0c0c0] font-bold text-sm">
          {coinName}
        </div>

        {/* Status */}
        <div className="flex items-center justify-center gap-1">
          {isOpen ? (
            <span className="flex items-center gap-1 text-amber-400 text-xs">
              <Clock className="w-3 h-3" />
            </span>
          ) : isProfit ? (
            <span className="text-emerald-400 text-[10px] font-bold">WIN</span>
          ) : (
            <span className="text-red-400 text-[10px] font-bold">LOSE</span>
          )}
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

        {/* Strategy */}
        <div className="text-xs text-[#888] truncate text-center">
          {trade.strategy_tag || '—'}
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
                (trade.rr_ratio || 0) >= 1.5 ? "text-emerald-400" : "text-amber-400"
              )}>
                1:{(trade.rr_ratio || 0).toFixed(1)}
              </div>
              <div className="text-[9px] text-red-400/70">
                ${Math.round(Math.abs(trade.risk_usd || 0))} • {Math.abs(trade.risk_percent || 0).toFixed(1)}%
              </div>
            </div>
          ) : (
            <span className={cn(
              "text-sm font-bold",
              (trade.r_multiple || 0) >= 0 ? "text-emerald-400" : "text-red-400"
            )}>
              {(trade.r_multiple || 0).toFixed(1)}R
            </span>
          )}
        </div>

        {/* PNL */}
        <div className="text-center">
          {isOpen ? (
            <span className="text-xs text-[#666]">—</span>
          ) : (
            <div>
              <div className={cn(
                "text-sm font-bold",
                isProfit ? "text-emerald-400" : "text-red-400"
              )}>
                {isProfit ? '+' : ''}${Math.round(pnl)}
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
            `${Math.floor(trade.actual_duration_minutes / 60)}h ${trade.actual_duration_minutes % 60}m`
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
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <TradeExpandedDetails 
          trade={trade}
          isOpen={isOpen}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onClosePosition={onClosePosition}
          onMoveStopToBE={onMoveStopToBE}
          formatDate={formatDate}
          currentBalance={currentBalance}
        />
      )}
    </div>
  );
}