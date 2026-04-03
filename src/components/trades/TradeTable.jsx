import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, TrendingUp, TrendingDown, Timer, Filter, ChevronUp, AlertCircle, Trash2, CalendarDays } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Slider } from "@/components/ui/slider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  onClosePosition,
  onMoveStopToBE,
  onDelete,
  currentBalance,
  bulkDeleteMode = false,
  selectedTradeIds = [],
  onToggleSelection = () => {},
  coinSearch = '',
}) {
  const [expandedIds, setExpandedIds] = useState([]);
  const [userTimezone, setUserTimezone] = useState('Europe/Moscow');
  const [groupByDay, setGroupByDay] = useState(false);
  const [collapsedDays, setCollapsedDays] = useState({});

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
  const [dateInputFrom, setDateInputFrom] = useState('');
  const [dateInputTo, setDateInputTo] = useState('');
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
  const itemsPerPage = 30;
  
  // Helper to check if trade is BE
  const isBE = (trade) => {
    if (!trade.close_price) return false;
    const pnl = trade.pnl_usd || 0;
    const balance = trade.account_balance_at_entry || currentBalance || 100000;
    const pnlPercent = Math.abs((pnl / balance) * 100);
    return Math.abs(pnl) <= 0.5 || pnlPercent <= 0.01;
  };

  // Separate open and closed trades - SOURCE OF TRUTH: close_price or date_close
  const isClosedTrade = (t) => t.close_price != null || t.date_close != null;
  const openTrades = trades.filter(t => !isClosedTrade(t));
  const closedTrades = trades.filter(t => isClosedTrade(t));

  // Debug: Log counts
  console.log(`[TradeTable] Total: ${trades.length}, Open: ${openTrades.length}, Closed: ${closedTrades.length}`);

  // Get unique values
  const coins = [...new Set(trades.map(t => t.coin?.replace('USDT', '')).filter(Boolean))];
  const strategies = [...new Set(trades.map(t => t.strategy_tag).filter(Boolean))];

  // Apply filters
  let filtered = trades.filter(trade => {
    if (filters.direction !== 'all' && trade.direction !== filters.direction) return false;
    
    const coinName = trade.coin?.replace('USDT', '');
    if (filters.coin !== 'all' && coinName !== filters.coin) return false;
    
    if (filters.strategy !== 'all' && trade.strategy_tag !== filters.strategy) return false;
    
    // Status filter - SOURCE OF TRUTH: close_price/date_close for CLOSED
    const isClosed = isClosedTrade(trade);
    if (filters.status !== 'all') {
      if (filters.status === 'open' && isClosed) return false;
      if (filters.status === 'win' && (!isClosed || (trade.pnl_usd || 0) <= 0 || isBE(trade))) return false;
      if (filters.status === 'lose' && (!isClosed || (trade.pnl_usd || 0) >= 0 || isBE(trade))) return false;
      if (filters.status === 'be' && !isBE(trade)) return false;
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

  // Coin search filter (from parent)
  if (coinSearch && coinSearch.trim()) {
    const q = coinSearch.trim().toLowerCase();
    filtered = filtered.filter(t => {
      const coin = (t.coin || '').toLowerCase().replace('usdt', '');
      return coin.includes(q) || (t.coin || '').toLowerCase().includes(q);
    });
  }

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
    // Default sort: open first (newest by date_open), then closed (newest by date_close)
    filtered.sort((a, b) => {
      const aOpen = !isClosedTrade(a);
      const bOpen = !isClosedTrade(b);
      
      if (aOpen && !bOpen) return -1;
      if (!aOpen && bOpen) return 1;

      if (aOpen && bOpen) {
        return new Date(b.date_open || b.date) - new Date(a.date_open || a.date);
      }
      // Both closed — sort by date_close desc
      return new Date(b.date_close || b.date_open || b.date) - new Date(a.date_close || a.date_open || a.date);
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
  const anyOpenTradesMissingSL = openTrades.length > 0 && openTrades.every(t => !t.stop_price || parseFloat(t.stop_price) === 0);

  // Calculate open trades summary - handle null risk
  const totalCurrentRisk = openTrades.reduce((sum, t) => {
    // Skip trades with no stop
    if (!t.stop_price || t.stop_price <= 0 || !t.entry_price || !t.position_size) return sum;
    
    const isStopAtBE = Math.abs(t.entry_price - t.stop_price) < 0.0001;
    if (isStopAtBE) return sum; // BE = no risk
    
    let riskUsd = t.risk_usd;
    
    // If risk_usd is not valid, recalculate
    if (!riskUsd || riskUsd <= 0) {
      const stopDistance = Math.abs(t.entry_price - t.stop_price);
      riskUsd = (stopDistance / t.entry_price) * t.position_size;
    }
    
    return sum + (riskUsd > 0 ? riskUsd : 0);
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
  const totalUnrealizedPnl = openTrades.reduce((sum, t) => sum + (parseFloat(t.pnl_usd) || 0), 0);

  // Decide if we show visual separation (only if no status filter applied)
  const showSeparation = filters.status === 'all' && !hasActiveFilters;

  // Pagination calculations - always limit to itemsPerPage regardless of filters/view
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedFiltered = filtered.slice(startIndex, endIndex);
  const paginatedOpenTrades = paginatedFiltered.filter(t => !isClosedTrade(t));
  const paginatedClosedTrades = paginatedFiltered.filter(t => isClosedTrade(t));

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  return (
    <div className="space-y-4 w-full overflow-x-auto">

      {/* Open Trades Block */}
      {showSeparation && paginatedOpenTrades.length > 0 && (
        <div className="rounded-2xl overflow-hidden relative w-fit min-w-[900px] mx-auto" style={{background:"linear-gradient(135deg,rgba(255,255,255,0.07) 0%,rgba(255,255,255,0.02) 50%,rgba(255,255,255,0.05) 100%)",backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",border:"1px solid rgba(255,255,255,0.12)",boxShadow:"0 8px 32px rgba(0,0,0,0.4),0 0 0 1px rgba(255,255,255,0.05) inset,0 1px 0 rgba(255,255,255,0.15) inset"}}>
          {/* Premium glow effect */}
          {/* Glass shine overlays */}
          <div className="absolute inset-0 pointer-events-none" style={{background:"linear-gradient(135deg,rgba(255,255,255,0.08) 0%,transparent 40%)",borderRadius:"inherit"}} />
          <div className="absolute top-0 left-0 right-0 h-px pointer-events-none" style={{background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)"}} />
          <div className="absolute top-0 left-0 bottom-0 w-px pointer-events-none" style={{background:"linear-gradient(180deg,rgba(255,255,255,0.15),transparent)"}} />
          <div className="relative">
          {/* Header */}
          <div className="border-b" style={{background:"rgba(0,0,0,0.3)",borderColor:"rgba(255,255,255,0.08)"}}>
          <div className="px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#777] uppercase tracking-widest font-medium">Open Trades</span>
              {totalUnrealizedPnl !== 0 && (
                <>
                  <span className="text-[#333] text-[10px] mx-1">|</span>
                  <span className="text-[9px] text-[#555] tracking-widest">uPnL</span>
                  <span className={`text-[11px] font-bold tabular-nums ${totalUnrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {totalUnrealizedPnl >= 0 ? '+' : '-'}${formatNumber(Math.abs(totalUnrealizedPnl))}
                  </span>
                </>
              )}

            </div>
            
          </div>
          <div className={cn(
            "hidden sm:grid gap-3 px-3 py-2.5 text-[10px] font-medium uppercase tracking-wide",
            bulkDeleteMode ? "grid-cols-[30px_30px_40px_100px_100px_60px_90px_110px_140px_90px_70px_30px]" : "grid-cols-[30px_40px_100px_100px_60px_90px_110px_140px_90px_70px_30px]"
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
              <PopoverContent className="w-32 p-2 bg-[#111] border-[#222]">
                <div className="space-y-1">
                  <button onClick={() => updateFilter('direction', 'all')} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] hover:bg-white/[0.06] text-[#888] hover:text-white transition-colors", filters.direction === 'all' && "bg-[#c0c0c0] text-black")}>All</button>
                  <button onClick={() => updateFilter('direction', 'Long')} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] hover:bg-white/[0.06] text-[#888] hover:text-white transition-colors", filters.direction === 'Long' && "bg-emerald-500 text-white")}>Long</button>
                  <button onClick={() => updateFilter('direction', 'Short')} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] hover:bg-white/[0.06] text-[#888] hover:text-white transition-colors", filters.direction === 'Short' && "bg-red-500 text-white")}>Short</button>
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
              <PopoverContent className="w-52 p-2 bg-[#111] border-[#222]">
                <Input 
                  placeholder="Search coin..." 
                  value={searchCoin}
                  onChange={(e) => setSearchCoin(e.target.value)}
                  className="h-7 text-xs mb-2 bg-[#0d0d0d] border-[#2a2a2a] text-white"
                />
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  <button onClick={() => { updateFilter('coin', 'all'); setSearchCoin(''); }} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] hover:bg-white/[0.06] text-[#888] hover:text-white transition-colors", filters.coin === 'all' && "bg-[#c0c0c0] text-black")}>All Coins</button>
                  {filteredCoins.slice(0, 10).map(coin => (
                    <button key={coin} onClick={() => { updateFilter('coin', coin); setSearchCoin(''); }} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] hover:bg-white/[0.06] text-[#888] hover:text-white transition-colors", filters.coin === coin && "bg-[#2a2a2a] text-white")}>{coin}</button>
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
              <PopoverContent className="w-auto p-4 bg-[#111] border-[#222]" style={{backdropFilter:'blur(20px)',boxShadow:'0 8px 32px rgba(0,0,0,0.5)'}}>
                <div className="space-y-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] text-[#555] uppercase tracking-widest">From</span>
                    <input type="date" value={dateInputFrom} onChange={e => setDateInputFrom(e.target.value)} style={{colorScheme:'dark',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'6px 10px',fontSize:'12px',color:'#c0c0c0',outline:'none',width:'160px'}} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] text-[#555] uppercase tracking-widest">To</span>
                    <input type="date" value={dateInputTo} onChange={e => setDateInputTo(e.target.value)} style={{colorScheme:'dark',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'6px 10px',fontSize:'12px',color:'#c0c0c0',outline:'none',width:'160px'}} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { updateFilter('dateFrom', dateInputFrom ? new Date(dateInputFrom) : null); updateFilter('dateTo', dateInputTo ? new Date(dateInputTo) : null); }} className="flex-1 px-3 py-1.5 rounded-md text-[11px] font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors">Apply</button>
                    {(filters.dateFrom || filters.dateTo) && (
                      <button onClick={() => { updateFilter('dateFrom', null); updateFilter('dateTo', null); setDateInputFrom(''); setDateInputTo(''); }} className="px-2 py-1.5 rounded-md text-[11px] text-[#555] hover:text-red-400 transition-colors">Clear</button>
                    )}
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
              <PopoverContent className="w-36 p-1.5 bg-[#111] border-[#222]" style={{backdropFilter:'blur(20px)',boxShadow:'0 8px 32px rgba(0,0,0,0.5)'}}>
                <div className="space-y-0.5">
                  <button onClick={() => updateFilter('status', 'all')} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all", filters.status === 'all' ? "bg-white/[0.12] text-white" : "text-[#666] hover:text-[#c0c0c0] hover:bg-white/[0.06]")}>All</button>
                  <button onClick={() => updateFilter('status', 'win')} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all", filters.status === 'win' ? "bg-emerald-500/20 text-emerald-400" : "text-[#666] hover:text-emerald-400 hover:bg-emerald-500/10")}>Win</button>
                  <button onClick={() => updateFilter('status', 'lose')} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all", filters.status === 'lose' ? "bg-red-500/20 text-red-400" : "text-[#666] hover:text-red-400 hover:bg-red-500/10")}>Lose</button>
                  <button onClick={() => updateFilter('status', 'be')} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all", filters.status === 'be' ? "bg-amber-500/20 text-amber-400" : "text-[#666] hover:text-amber-400 hover:bg-amber-500/10")}>BE</button>
                </div>
              </PopoverContent>
            </Popover>

            <div className="text-center text-[#666]">Entry</div>
            <div className="text-center text-[#666]">RR / R</div>

            {/* PNL - Clickable for sort */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-center text-[#888] hover:text-[#c0c0c0] transition-colors flex items-center justify-center gap-1 group">
                  uPnL
                  {filters.pnlSort === 'desc' ? <ChevronDown className="w-2.5 h-2.5 text-amber-400" /> : filters.pnlSort === 'asc' ? <ChevronUp className="w-2.5 h-2.5 text-amber-400" /> : <Filter className="w-2.5 h-2.5 opacity-50 group-hover:opacity-100" />}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-2 bg-[#111] border-[#222]">
                <div className="space-y-1">
                  <button onClick={() => { updateFilter('pnlSort', 'default'); updateFilter('durationSort', 'default'); }} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] hover:bg-white/[0.06] text-[#888] hover:text-white transition-colors", filters.pnlSort === 'default' && "bg-[#c0c0c0] text-black")}>Default (Time)</button>
                  <button onClick={() => { updateFilter('pnlSort', 'desc'); updateFilter('durationSort', 'default'); }} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] hover:bg-white/[0.06] text-[#888] hover:text-white transition-colors", filters.pnlSort === 'desc' && "bg-emerald-500/20 text-emerald-400")}>Largest first</button>
                  <button onClick={() => { updateFilter('pnlSort', 'asc'); updateFilter('durationSort', 'default'); }} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] hover:bg-white/[0.06] text-[#888] hover:text-white transition-colors", filters.pnlSort === 'asc' && "bg-red-500/20 text-red-400")}>Smallest first</button>
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
              <PopoverContent className="w-40 p-2 bg-[#111] border-[#222]">
                <div className="space-y-1">
                  <button onClick={() => { updateFilter('durationSort', 'default'); updateFilter('pnlSort', 'default'); }} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] hover:bg-white/[0.06] text-[#888] hover:text-white transition-colors", filters.durationSort === 'default' && "bg-[#c0c0c0] text-black")}>Default (Time)</button>
                  <button onClick={() => { updateFilter('durationSort', 'desc'); updateFilter('pnlSort', 'default'); }} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] hover:bg-white/[0.06] text-[#888] hover:text-white transition-colors", filters.durationSort === 'desc' && "bg-[#2a2a2a] text-white")}>Longest first</button>
                  <button onClick={() => { updateFilter('durationSort', 'asc'); updateFilter('pnlSort', 'default'); }} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] hover:bg-white/[0.06] text-[#888] hover:text-white transition-colors", filters.durationSort === 'asc' && "bg-[#2a2a2a] text-white")}>Shortest first</button>
                </div>
              </PopoverContent>
            </Popover>
            {/* AI - label only, no filter */}
            <div className="text-center text-[#666]">AI</div>
          </div>
        </div>

          {/* Body */}
          <div>
            {paginatedOpenTrades.map((trade) => {
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
                  rowBg="liquid-open"
                  formatDate={formatDate}
                  onToggle={() => setExpandedIds(prev => 
                    isExpanded ? prev.filter(id => id !== trade.id) : [...prev, trade.id]
                  )}
                  onUpdate={onUpdate}
                  onClosePosition={onClosePosition}
                  onMoveStopToBE={onMoveStopToBE}
                  onDelete={onDelete}
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
            <div className="border-t" style={{background:"rgba(0,0,0,0.25)",borderColor:"rgba(255,255,255,0.06)"}}>
              {/* Stats row */}
              <div className="px-3 py-1.5">
                <p className="text-[9px] text-[#666] tracking-wide">
                  Total Risk: <span className="text-red-400 font-bold">${formatNumber(totalCurrentRisk)}</span> / <span className="text-red-400/70">{totalRiskPercent.toFixed(1)}%</span>
                  <span className="mx-2">•</span>
                  Potential Profit: <span className="text-emerald-400 font-bold">${formatNumber(totalPotentialProfit)}</span> / <span className="text-emerald-400/70">{totalPotentialPercent.toFixed(1)}%</span>
                  <span className="mx-2">•</span>
                  Total RR: {anyOpenTradesMissingSL ? (
                    <span className="text-amber-400 text-[10px] font-medium">⚠️ Set SL — or risk liquidation</span>
                  ) : totalCurrentRisk < 0.01 ? (
                    <span className="text-purple-400 font-bold uppercase tracking-wide">NO RISK BRO ONLY PROFIT</span>
                  ) : (
                    <span className="text-[#c0c0c0] font-bold">1:{Math.round(totalRR)}</span>
                  )}
                </p>
              </div>

            </div>
            )}
            </div>
            </div>
            )}

      {/* Closed Trades Block */}
      {showSeparation && paginatedClosedTrades.length > 0 && (
        <div className="rounded-2xl overflow-hidden relative w-fit min-w-[900px] mx-auto" style={{background:"linear-gradient(135deg,rgba(255,255,255,0.05) 0%,rgba(255,255,255,0.01) 50%,rgba(255,255,255,0.04) 100%)",backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",border:"1px solid rgba(255,255,255,0.08)",boxShadow:"0 8px 32px rgba(0,0,0,0.5),0 0 0 1px rgba(255,255,255,0.03) inset,0 1px 0 rgba(255,255,255,0.1) inset"}}>
          {/* Subtle texture */}
          <div className="absolute inset-0 opacity-[0.02]" style={{
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 20px, #c0c0c0 20px, #c0c0c0 21px)`
          }} />
          <div className="relative">
          {/* Header */}
          <div className="border-b" style={{background:"rgba(0,0,0,0.3)",borderColor:"rgba(255,255,255,0.08)"}}>
          <div className="px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#888] uppercase tracking-wide">Closed Trades</span>
              <button
                onClick={() => setGroupByDay(v => !v)}
                className={cn(
                  "flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-colors",
                  groupByDay
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                    : "bg-white/[0.03] border-white/[0.08] text-[#666] hover:text-[#888]"
                )}
              >
                <CalendarDays className="w-3 h-3" />
                Group by Day
              </button>
            </div>
            
          </div>
          <div className={cn(
            "hidden sm:grid gap-3 px-3 py-2.5 text-[10px] font-medium uppercase tracking-wide",
            bulkDeleteMode ? "grid-cols-[30px_30px_40px_100px_100px_60px_90px_110px_140px_90px_70px_30px]" : "grid-cols-[30px_40px_100px_100px_60px_90px_110px_140px_90px_70px_30px]"
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
                <PopoverContent className="w-32 p-2 bg-[#111] border-[#222]">
                  <div className="space-y-1">
                    <button onClick={() => updateFilter('direction', 'all')} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] hover:bg-white/[0.06] text-[#888] hover:text-white transition-colors", filters.direction === 'all' && "bg-[#c0c0c0] text-black")}>All</button>
                    <button onClick={() => updateFilter('direction', 'Long')} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] hover:bg-white/[0.06] text-[#888] hover:text-white transition-colors", filters.direction === 'Long' && "bg-emerald-500 text-white")}>Long</button>
                    <button onClick={() => updateFilter('direction', 'Short')} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] hover:bg-white/[0.06] text-[#888] hover:text-white transition-colors", filters.direction === 'Short' && "bg-red-500 text-white")}>Short</button>
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
                <PopoverContent className="w-52 p-2 bg-[#111] border-[#222]">
                  <Input 
                    placeholder="Search coin..." 
                    value={searchCoin}
                    onChange={(e) => setSearchCoin(e.target.value)}
                    className="h-7 text-xs mb-2 bg-[#0d0d0d] border-[#2a2a2a] text-white"
                  />
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    <button onClick={() => { updateFilter('coin', 'all'); setSearchCoin(''); }} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] hover:bg-white/[0.06] text-[#888] hover:text-white transition-colors", filters.coin === 'all' && "bg-[#c0c0c0] text-black")}>All Coins</button>
                    {filteredCoins.slice(0, 10).map(coin => (
                      <button key={coin} onClick={() => { updateFilter('coin', coin); setSearchCoin(''); }} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] hover:bg-white/[0.06] text-[#888] hover:text-white transition-colors", filters.coin === coin && "bg-[#2a2a2a] text-white")}>{coin}</button>
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
                                <PopoverContent className="w-auto p-4 bg-[#111] border-[#222]" style={{backdropFilter:'blur(20px)',boxShadow:'0 8px 32px rgba(0,0,0,0.5)'}}>
                    <div className="space-y-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-[#555] uppercase tracking-widest">From</span>
                        <input type="date" value={dateInputFrom} onChange={e => setDateInputFrom(e.target.value)} style={{colorScheme:'dark',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'6px 10px',fontSize:'12px',color:'#c0c0c0',outline:'none',width:'160px'}} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-[#555] uppercase tracking-widest">To</span>
                        <input type="date" value={dateInputTo} onChange={e => setDateInputTo(e.target.value)} style={{colorScheme:'dark',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'6px 10px',fontSize:'12px',color:'#c0c0c0',outline:'none',width:'160px'}} />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { updateFilter('dateFrom', dateInputFrom ? new Date(dateInputFrom) : null); updateFilter('dateTo', dateInputTo ? new Date(dateInputTo) : null); }} className="flex-1 px-3 py-1.5 rounded-md text-[11px] font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors">Apply</button>
                        {(filters.dateFrom || filters.dateTo) && (
                          <button onClick={() => { updateFilter('dateFrom', null); updateFilter('dateTo', null); setDateInputFrom(''); setDateInputTo(''); }} className="px-2 py-1.5 rounded-md text-[11px] text-[#555] hover:text-red-400 transition-colors">Clear</button>
                        )}
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
                <PopoverContent className="w-36 p-1.5 bg-[#111] border-[#222]" style={{backdropFilter:'blur(20px)',boxShadow:'0 8px 32px rgba(0,0,0,0.5)'}}>
                  <div className="space-y-0.5">
                    <button onClick={() => updateFilter('status', 'all')} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all", filters.status === 'all' ? "bg-white/[0.12] text-white" : "text-[#666] hover:text-[#c0c0c0] hover:bg-white/[0.06]")}>All</button>
                    <button onClick={() => updateFilter('status', 'win')} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all", filters.status === 'win' ? "bg-emerald-500/20 text-emerald-400" : "text-[#666] hover:text-emerald-400 hover:bg-emerald-500/10")}>Win</button>
                    <button onClick={() => updateFilter('status', 'lose')} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all", filters.status === 'lose' ? "bg-red-500/20 text-red-400" : "text-[#666] hover:text-red-400 hover:bg-red-500/10")}>Lose</button>
                    <button onClick={() => updateFilter('status', 'be')} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all", filters.status === 'be' ? "bg-amber-500/20 text-amber-400" : "text-[#666] hover:text-amber-400 hover:bg-amber-500/10")}>BE</button>
                  </div>
                </PopoverContent>
              </Popover>
              <div className="text-center text-[#666]">Entry</div>
              <div className="text-center text-[#666]">RR / R</div>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="text-center text-[#888] hover:text-[#c0c0c0] transition-colors flex items-center justify-center gap-1 group">
                    PnL
                    {filters.pnlSort === 'desc' ? <ChevronDown className="w-2.5 h-2.5 text-amber-400" /> : filters.pnlSort === 'asc' ? <ChevronUp className="w-2.5 h-2.5 text-amber-400" /> : <Filter className="w-2.5 h-2.5 opacity-50 group-hover:opacity-100" />}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-40 p-2 bg-[#111] border-[#222]">
                  <div className="space-y-1">
                    <button onClick={() => { updateFilter('pnlSort', 'default'); updateFilter('durationSort', 'default'); }} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] hover:bg-white/[0.06] text-[#888] hover:text-white transition-colors", filters.pnlSort === 'default' && "bg-[#c0c0c0] text-black")}>Default (Time)</button>
                    <button onClick={() => { updateFilter('pnlSort', 'desc'); updateFilter('durationSort', 'default'); }} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] hover:bg-white/[0.06] text-[#888] hover:text-white transition-colors", filters.pnlSort === 'desc' && "bg-emerald-500/20 text-emerald-400")}>Largest first</button>
                    <button onClick={() => { updateFilter('pnlSort', 'asc'); updateFilter('durationSort', 'default'); }} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] hover:bg-white/[0.06] text-[#888] hover:text-white transition-colors", filters.pnlSort === 'asc' && "bg-red-500/20 text-red-400")}>Smallest first</button>
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
                <PopoverContent className="w-40 p-2 bg-[#111] border-[#222]">
                  <div className="space-y-1">
                    <button onClick={() => { updateFilter('durationSort', 'default'); updateFilter('pnlSort', 'default'); }} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] hover:bg-white/[0.06] text-[#888] hover:text-white transition-colors", filters.durationSort === 'default' && "bg-[#c0c0c0] text-black")}>Default (Time)</button>
                    <button onClick={() => { updateFilter('durationSort', 'desc'); updateFilter('pnlSort', 'default'); }} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] hover:bg-white/[0.06] text-[#888] hover:text-white transition-colors", filters.durationSort === 'desc' && "bg-[#2a2a2a] text-white")}>Longest first</button>
                    <button onClick={() => { updateFilter('durationSort', 'asc'); updateFilter('pnlSort', 'default'); }} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] hover:bg-white/[0.06] text-[#888] hover:text-white transition-colors", filters.durationSort === 'asc' && "bg-[#2a2a2a] text-white")}>Shortest first</button>
                  </div>
                </PopoverContent>
              </Popover>

              <div></div>
            </div>
          </div>
          
          {/* Body */}
          <div>
            {groupByDay ? (() => {
              // Group paginatedClosedTrades by close date
              const groups = {};
              paginatedClosedTrades.forEach(trade => {
                const dateKey = trade.date_close
                  ? formatDate(trade.date_close).split(' ')[0]
                  : (trade.date ? formatDate(trade.date).split(' ')[0] : 'Unknown');
                if (!groups[dateKey]) groups[dateKey] = [];
                groups[dateKey].push(trade);
              });
              const sortedDays = Object.keys(groups).sort((a, b) => new Date(b) - new Date(a));
              return sortedDays.map(dayKey => {
                const dayTrades = groups[dayKey];
                const dayPnl = dayTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
                const dayWins = dayTrades.filter(t => (t.pnl_usd || 0) > 0).length;
                const dayLosses = dayTrades.filter(t => (t.pnl_usd || 0) < 0).length;
                const isCollapsed = collapsedDays[dayKey];
                return (
                  <div key={dayKey}>
                    {/* Day header */}
                    <div
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors hover:bg-white/[0.03] border-b"
                      style={{background:'rgba(0,0,0,0.2)',borderColor:'rgba(255,255,255,0.05)'}}
                      onClick={() => setCollapsedDays(prev => ({ ...prev, [dayKey]: !prev[dayKey] }))}
                    >
                      {isCollapsed
                        ? <ChevronRight className="w-3.5 h-3.5 text-[#555]" />
                        : <ChevronDown className="w-3.5 h-3.5 text-[#555]" />
                      }
                      <span className="text-xs font-semibold text-[#c0c0c0]">{dayKey}</span>
                      <span className="text-[10px] text-[#666]">{dayTrades.length} trade{dayTrades.length !== 1 ? 's' : ''}</span>
                      <span className={cn("text-[10px] font-bold ml-1", dayPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                        {dayPnl >= 0 ? '+' : '-'}${Math.round(Math.abs(dayPnl)).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-emerald-400 ml-1">{dayWins}W</span>
                      <span className="text-[10px] text-red-400">{dayLosses}L</span>
                    </div>
                    {/* Day trades */}
                    {!isCollapsed && dayTrades.map(trade => {
                      const isExpanded = expandedIds.includes(trade.id);
                      const isOpen = !trade.close_price;
                      const isLong = trade.direction === 'Long';
                      const pnl = trade.pnl_usd || 0;
                      const isBETrade = isBE(trade);
                      const isProfit = pnl >= 0;
                      const coinName = trade.coin?.replace('USDT', '');
                      let rowBg = isBETrade ? 'liquid-be' : isProfit ? 'liquid-win' : 'liquid-lose';
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
                          onClosePosition={onClosePosition}
                          onMoveStopToBE={onMoveStopToBE}
                          onDelete={onDelete}
                          currentBalance={currentBalance}
                          bulkDeleteMode={bulkDeleteMode}
                          isSelected={selectedTradeIds.includes(trade.id)}
                          onToggleSelection={() => onToggleSelection(trade.id)}
                        />
                      );
                    })}
                  </div>
                );
              });
            })() : paginatedClosedTrades.map((trade) => {
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
                rowBg = 'liquid-be';
              } else if (isProfit) {
                rowBg = 'liquid-win';
              } else {
                rowBg = 'liquid-lose';
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
                  onClosePosition={onClosePosition}
                  onMoveStopToBE={onMoveStopToBE}
                  onDelete={onDelete}
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

            {showSeparation && filtered.length > 0 && (
              <div className="rounded-xl px-4 py-3 flex items-center justify-between flex-wrap gap-2" style={{background:"linear-gradient(135deg,rgba(255,255,255,0.05) 0%,rgba(255,255,255,0.02) 100%)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,0.08)",boxShadow:"0 4px 16px rgba(0,0,0,0.3)"}}>
                <div className="text-xs text-[#666]">
                  Showing {startIndex + 1}-{Math.min(endIndex, filtered.length)} of {filtered.length} trades
                </div>
                <div className="flex items-center gap-2 flex-wrap">
          {filtered.length > itemsPerPage && (
                    <>
                      <Button
                        onClick={handlePrevPage}
                        disabled={safeCurrentPage === 1}
                        size="sm"
                        variant="outline"
                        className="bg-[#111] border-[#2a2a2a] text-[#888] hover:text-[#c0c0c0] disabled:opacity-30"
                      >
                        Previous
                      </Button>
                      <span className="text-xs text-[#c0c0c0] px-3">
                        Page {safeCurrentPage} of {totalPages}
                      </span>
                      <Button
                        onClick={handleNextPage}
                        disabled={safeCurrentPage === totalPages}
                        size="sm"
                        variant="outline"
                        className="bg-[#111] border-[#2a2a2a] text-[#888] hover:text-[#c0c0c0] disabled:opacity-30"
                      >
                        Next
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Unified view when filters are active */}
            {!showSeparation && (
              <div className="rounded-2xl overflow-hidden relative w-fit min-w-[900px] mx-auto" style={{background:"linear-gradient(135deg,rgba(255,255,255,0.06) 0%,rgba(255,255,255,0.02) 50%,rgba(255,255,255,0.05) 100%)",backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",border:"1px solid rgba(255,255,255,0.1)",boxShadow:"0 8px 32px rgba(0,0,0,0.45),0 0 0 1px rgba(255,255,255,0.04) inset,0 1px 0 rgba(255,255,255,0.12) inset"}}>
                {/* Luxury overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#c0c0c0]/3 via-transparent to-[#888]/3 pointer-events-none" />
                <div className="relative">
            <div className="bg-[#1a1a1a] border-b border-[#2a2a2a] sticky top-0 z-20">
            <div className="px-3 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-[#888] uppercase tracking-wide">All Trades</span>
                {hasActiveFilters && (
                  <>
                    {filters.direction !== 'all' && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.1] text-[10px] text-[#c0c0c0]">{filters.direction}<button onClick={() => updateFilter('direction', 'all')} className="ml-0.5 text-[#666] hover:text-red-400">×</button></span>}
                    {filters.status !== 'all' && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.1] text-[10px] text-[#c0c0c0]">{filters.status}<button onClick={() => updateFilter('status', 'all')} className="ml-0.5 text-[#666] hover:text-red-400">×</button></span>}
                    {filters.coin !== 'all' && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.1] text-[10px] text-[#c0c0c0]">{filters.coin}<button onClick={() => updateFilter('coin', 'all')} className="ml-0.5 text-[#666] hover:text-red-400">×</button></span>}
                    {(filters.dateFrom || filters.dateTo) && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.1] text-[10px] text-[#c0c0c0]">{filters.dateFrom ? new Date(filters.dateFrom).toLocaleDateString('en',{month:'short',day:'numeric'}) : '…'}{' → '}{filters.dateTo ? new Date(filters.dateTo).toLocaleDateString('en',{month:'short',day:'numeric'}) : '…'}<button onClick={() => { updateFilter('dateFrom', null); updateFilter('dateTo', null); }} className="ml-0.5 text-[#666] hover:text-red-400">×</button></span>}
                    <button onClick={resetFilters} className="text-[10px] text-[#555] hover:text-red-400 transition-colors">Clear all</button>
                  </>
                )}
              </div>
              <span className="text-xs text-[#c0c0c0] font-bold">{paginatedFiltered.length} of {filtered.length}</span>
            </div>
            <div className={cn(
              "hidden sm:grid gap-3 px-3 py-2.5 text-[10px] font-medium uppercase tracking-wide",
              bulkDeleteMode ? "grid-cols-[30px_30px_40px_100px_100px_60px_90px_110px_140px_90px_70px_30px]" : "grid-cols-[30px_40px_100px_100px_60px_90px_110px_140px_90px_70px_30px]"
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
               <PopoverContent className="w-32 p-2 bg-[#111] border-[#222]">
                 <div className="space-y-1">
                   <button onClick={() => updateFilter('direction', 'all')} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] hover:bg-white/[0.06] text-[#888] hover:text-white transition-colors", filters.direction === 'all' && "bg-[#c0c0c0] text-black")}>All</button>
                   <button onClick={() => updateFilter('direction', 'Long')} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] hover:bg-white/[0.06] text-[#888] hover:text-white transition-colors", filters.direction === 'Long' && "bg-emerald-500 text-white")}>Long</button>
                   <button onClick={() => updateFilter('direction', 'Short')} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] hover:bg-white/[0.06] text-[#888] hover:text-white transition-colors", filters.direction === 'Short' && "bg-red-500 text-white")}>Short</button>
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
               <PopoverContent className="w-52 p-2 bg-[#111] border-[#222]">
                 <Input 
                   placeholder="Search coin..." 
                   value={searchCoin}
                   onChange={(e) => setSearchCoin(e.target.value)}
                   className="h-7 text-xs mb-2 bg-[#0d0d0d] border-[#2a2a2a] text-white"
                 />
                 <div className="space-y-1 max-h-32 overflow-y-auto">
                   <button onClick={() => { updateFilter('coin', 'all'); setSearchCoin(''); }} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] hover:bg-white/[0.06] text-[#888] hover:text-white transition-colors", filters.coin === 'all' && "bg-[#c0c0c0] text-black")}>All Coins</button>
                   {filteredCoins.slice(0, 10).map(coin => (
                     <button key={coin} onClick={() => { updateFilter('coin', coin); setSearchCoin(''); }} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] hover:bg-white/[0.06] text-[#888] hover:text-white transition-colors", filters.coin === coin && "bg-[#2a2a2a] text-white")}>{coin}</button>
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
               <PopoverContent className="w-36 p-1.5 bg-[#111] border-[#222]" style={{backdropFilter:'blur(20px)',boxShadow:'0 8px 32px rgba(0,0,0,0.5)'}}>
                 <div className="space-y-0.5">
                   <button onClick={() => updateFilter('status', 'all')} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all", filters.status === 'all' ? "bg-white/[0.12] text-white" : "text-[#666] hover:text-[#c0c0c0] hover:bg-white/[0.06]")}>All</button>
                   <button onClick={() => updateFilter('status', 'win')} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all", filters.status === 'win' ? "bg-emerald-500/20 text-emerald-400" : "text-[#666] hover:text-emerald-400 hover:bg-emerald-500/10")}>Win</button>
                   <button onClick={() => updateFilter('status', 'lose')} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all", filters.status === 'lose' ? "bg-red-500/20 text-red-400" : "text-[#666] hover:text-red-400 hover:bg-red-500/10")}>Lose</button>
                   <button onClick={() => updateFilter('status', 'be')} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all", filters.status === 'be' ? "bg-amber-500/20 text-amber-400" : "text-[#666] hover:text-amber-400 hover:bg-amber-500/10")}>BE</button>
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
                               <PopoverContent className="w-auto p-4 bg-[#111] border-[#222]" style={{backdropFilter:'blur(20px)',boxShadow:'0 8px 32px rgba(0,0,0,0.5)'}}>
                    <div className="space-y-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-[#555] uppercase tracking-widest">From</span>
                        <input type="date" value={dateInputFrom} onChange={e => setDateInputFrom(e.target.value)} style={{colorScheme:'dark',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'6px 10px',fontSize:'12px',color:'#c0c0c0',outline:'none',width:'160px'}} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-[#555] uppercase tracking-widest">To</span>
                        <input type="date" value={dateInputTo} onChange={e => setDateInputTo(e.target.value)} style={{colorScheme:'dark',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'6px 10px',fontSize:'12px',color:'#c0c0c0',outline:'none',width:'160px'}} />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { updateFilter('dateFrom', dateInputFrom ? new Date(dateInputFrom) : null); updateFilter('dateTo', dateInputTo ? new Date(dateInputTo) : null); }} className="flex-1 px-3 py-1.5 rounded-md text-[11px] font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors">Apply</button>
                        {(filters.dateFrom || filters.dateTo) && (
                          <button onClick={() => { updateFilter('dateFrom', null); updateFilter('dateTo', null); setDateInputFrom(''); setDateInputTo(''); }} className="px-2 py-1.5 rounded-md text-[11px] text-[#555] hover:text-red-400 transition-colors">Clear</button>
                        )}
                      </div>
                    </div>
                  </PopoverContent>
             </Popover>
             <div className="text-center text-[#666]">Entry</div>
             <div className="text-center text-[#666]">RR / R</div>
             <Popover>
               <PopoverTrigger asChild>
                 <button className="text-center text-[#888] hover:text-[#c0c0c0] transition-colors flex items-center justify-center gap-1 group">
                   PnL
                   {filters.pnlSort === 'desc' ? <ChevronDown className="w-2.5 h-2.5 text-amber-400" /> : filters.pnlSort === 'asc' ? <ChevronUp className="w-2.5 h-2.5 text-amber-400" /> : <Filter className="w-2.5 h-2.5 opacity-50 group-hover:opacity-100" />}
                 </button>
               </PopoverTrigger>
               <PopoverContent className="w-40 p-2 bg-[#111] border-[#222]">
                 <div className="space-y-1">
                   <button onClick={() => { updateFilter('pnlSort', 'default'); updateFilter('durationSort', 'default'); }} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] hover:bg-white/[0.06] text-[#888] hover:text-white transition-colors", filters.pnlSort === 'default' && "bg-[#c0c0c0] text-black")}>Default (Time)</button>
                   <button onClick={() => { updateFilter('pnlSort', 'desc'); updateFilter('durationSort', 'default'); }} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] hover:bg-white/[0.06] text-[#888] hover:text-white transition-colors", filters.pnlSort === 'desc' && "bg-emerald-500/20 text-emerald-400")}>Largest first</button>
                   <button onClick={() => { updateFilter('pnlSort', 'asc'); updateFilter('durationSort', 'default'); }} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] hover:bg-white/[0.06] text-[#888] hover:text-white transition-colors", filters.pnlSort === 'asc' && "bg-red-500/20 text-red-400")}>Smallest first</button>
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
               <PopoverContent className="w-40 p-2 bg-[#111] border-[#222]">
                 <div className="space-y-1">
                   <button onClick={() => { updateFilter('durationSort', 'default'); updateFilter('pnlSort', 'default'); }} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] hover:bg-white/[0.06] text-[#888] hover:text-white transition-colors", filters.durationSort === 'default' && "bg-[#c0c0c0] text-black")}>Default (Time)</button>
                   <button onClick={() => { updateFilter('durationSort', 'desc'); updateFilter('pnlSort', 'default'); }} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] hover:bg-white/[0.06] text-[#888] hover:text-white transition-colors", filters.durationSort === 'desc' && "bg-[#2a2a2a] text-white")}>Longest first</button>
                   <button onClick={() => { updateFilter('durationSort', 'asc'); updateFilter('pnlSort', 'default'); }} className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[11px] hover:bg-white/[0.06] text-[#888] hover:text-white transition-colors", filters.durationSort === 'asc' && "bg-[#2a2a2a] text-white")}>Shortest first</button>
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
                 rowBg = 'liquid-be';
               } else if (isProfit) {
                 rowBg = 'liquid-win';
               } else {
                 rowBg = 'liquid-lose';
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
                   onToggle={() => setExpandedIds(prev => isExpanded ? prev.filter(id => id !== trade.id) : [...prev, trade.id])}
                   onUpdate={onUpdate}
                    onClosePosition={onClosePosition}
                   onMoveStopToBE={onMoveStopToBE}
                   onDelete={onDelete}
                   currentBalance={currentBalance}
                   bulkDeleteMode={bulkDeleteMode}
                   isSelected={selectedTradeIds.includes(trade.id)}
                   onToggleSelection={() => onToggleSelection(trade.id)}
                   />
                   );
                   })
                   )}
                   </div>

                   {/* Pagination Footer - only in unified view */}
                   {filtered.length > 0 && (
                     <div className="border-t px-4 py-3 flex items-center justify-between flex-wrap gap-2" style={{background:"rgba(0,0,0,0.25)",borderColor:"rgba(255,255,255,0.06)"}}>
                       <div className="text-xs text-[#666]">
                         Showing {startIndex + 1}-{Math.min(endIndex, filtered.length)} of {filtered.length} trades
                       </div>
                       <div className="flex items-center gap-2 flex-wrap">
          {filtered.length > itemsPerPage && (
                           <>
                             <Button
                               onClick={handlePrevPage}
                               disabled={safeCurrentPage === 1}
                               size="sm"
                               variant="outline"
                               className="bg-[#111] border-[#2a2a2a] text-[#888] hover:text-[#c0c0c0] disabled:opacity-30"
                             >
                               Previous
                             </Button>
                             <span className="text-xs text-[#c0c0c0] px-3">
                               Page {safeCurrentPage} of {totalPages}
                             </span>
                             <Button
                               onClick={handleNextPage}
                               disabled={safeCurrentPage === totalPages}
                               size="sm"
                               variant="outline"
                               className="bg-[#111] border-[#2a2a2a] text-[#888] hover:text-[#c0c0c0] disabled:opacity-30"
                             >
                               Next
                             </Button>
                           </>
                         )}
                       </div>
                     </div>
                   )}
                   </div>
                   </div>
                   )}
                   </div>
                   );
                   }


const getLiquidRowStyle = (rowBg, isExpanded) => {
  if (isExpanded) return {background: 'rgba(10,10,10,0.6)'};
  const styles = {
    'liquid-win':  {background:'linear-gradient(90deg,rgba(16,185,129,0.1),rgba(16,185,129,0.04))',borderBottom:'1px solid rgba(16,185,129,0.1)'},
    'liquid-lose': {background:'linear-gradient(90deg,rgba(239,68,68,0.1),rgba(239,68,68,0.04))',borderBottom:'1px solid rgba(239,68,68,0.08)'},
    'liquid-be':   {background:'linear-gradient(90deg,rgba(245,158,11,0.1),rgba(245,158,11,0.04))',borderBottom:'1px solid rgba(245,158,11,0.08)'},
    'liquid-open': {background:'rgba(255,255,255,0.015)',borderBottom:'1px solid rgba(255,255,255,0.04)'},
  };
  return styles[rowBg] || {};
};

const getLiquidHoverStyle = (rowBg) => {
  const styles = {
    'liquid-win':  'rgba(16,185,129,0.15)',
    'liquid-lose': 'rgba(239,68,68,0.15)',
    'liquid-be':   'rgba(245,158,11,0.15)',
    'liquid-open': 'rgba(255,255,255,0.05)',
  };
  return styles[rowBg] || 'rgba(255,255,255,0.03)';
};

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
  onClosePosition: _onClosePosition,
  onMoveStopToBE: _onMoveStopToBE,
  onDelete,
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
      const openTime = new Date(trade.original_date_open || trade.date_open || trade.date);
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

  // Calculate risk on the fly if not stored - null when undefined
  const balance = trade.account_balance_at_entry || currentBalance || 100000;
  const hasStop = trade.stop_price && trade.stop_price > 0;
  const isStopAtBE = hasStop && Math.abs(trade.stop_price - trade.entry_price) / (trade.entry_price || 1) < 0.002; // within 0.2% = BE
  // Stop in profit: stop is above entry for Long, or below for Short — no risk of loss
  const isStopInProfit = hasStop && !isStopAtBE && (
    (trade.direction === 'Long' && trade.stop_price > trade.entry_price) ||
    (trade.direction === 'Short' && trade.stop_price < trade.entry_price)
  );
  
  const displayRiskUsd = (() => {
    if (!hasStop) return null;
    if (isStopAtBE) return 0;
    if (trade.risk_usd !== undefined && trade.risk_usd !== null && trade.risk_usd > 0) return trade.risk_usd;
    if (!trade.entry_price || !trade.position_size) return null;
    const stopDistance = Math.abs(trade.entry_price - trade.stop_price);
    return (stopDistance / trade.entry_price) * trade.position_size;
  })();

  const displayRiskPercent = displayRiskUsd !== null && displayRiskUsd !== undefined
    ? (displayRiskUsd / balance) * 100
    : null;

  // Calculate RR - null when undefined
  const hasTake = trade.take_price && trade.take_price > 0;
  let rrRatio = null;
  
  if (hasTake && trade.entry_price && trade.position_size) {
    const takeDistance = Math.abs(trade.take_price - trade.entry_price);
    const potentialUsd = (takeDistance / trade.entry_price) * trade.position_size;
    
    if (isStopAtBE && trade.original_risk_usd) {
      rrRatio = potentialUsd / trade.original_risk_usd;
    } else if (displayRiskUsd && displayRiskUsd > 0) {
      rrRatio = potentialUsd / displayRiskUsd;
    } else if (trade.rr_ratio !== undefined && trade.rr_ratio !== null && trade.rr_ratio > 0) {
      rrRatio = trade.rr_ratio;
    }
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
      
      {/* Mobile Row */}
      <div
        className={`flex sm:hidden items-center justify-between px-3 py-2.5 cursor-pointer transition-all duration-200 relative z-10 row-${rowBg}`}
        style={getLiquidRowStyle(rowBg, isExpanded)}
        
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn("w-6 h-6 rounded flex items-center justify-center shrink-0", isLong ? "bg-emerald-500/20" : "bg-red-500/20")}>
            {isLong ? <TrendingUp className="w-3 h-3 text-emerald-400" /> : <TrendingDown className="w-3 h-3 text-red-400" />}
          </div>
          <span className="text-[#c0c0c0] font-bold text-sm">{coinName}</span>
          {isOpen ? (
            <span className="text-[9px] text-amber-400 font-mono">{formatDuration(duration)}</span>
          ) : isBETrade ? (
            <span className="text-[9px] text-amber-400 font-bold">BE</span>
          ) : isProfit ? (
            <span className="text-[9px] text-emerald-400 font-bold">WIN</span>
          ) : (
            <span className="text-[9px] text-red-400 font-bold">LOSE</span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {!isOpen && (() => {
            let r = trade.r_multiple;
            if ((r === null || r === undefined) && trade.pnl_usd != null) {
              const riskUsd = trade.risk_usd || trade.original_risk_usd;
              if (riskUsd && riskUsd > 0) r = trade.pnl_usd / riskUsd;
            }
            return r !== null && r !== undefined ? (
              <span className={cn("text-xs font-bold", r >= 0 ? "text-emerald-400" : "text-red-400")}>
                {r >= 0 ? '+' : ''}{r.toFixed(1)}R
              </span>
            ) : null;
          })()}
          <div className={cn("text-sm font-bold", isOpen ? (pnl >= 0 ? "text-emerald-400" : "text-red-400") : (isProfit ? "text-emerald-400" : "text-red-400"))}>
            {pnl !== 0 ? `${pnl >= 0 ? '+' : '-'}$${formatNumber(Math.abs(pnl))}` : '—'}
          </div>
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-[#666]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#666]" />}
        </div>
      </div>

      {/* Desktop Row */}
      <div 
        className={cn(
          `hidden sm:grid group gap-3 px-3 py-2.5 items-center transition-all duration-200 relative z-10 row-${rowBg}`,
          bulkDeleteMode ? "grid-cols-[30px_30px_40px_100px_100px_60px_90px_110px_140px_90px_70px_30px]" : "grid-cols-[30px_40px_100px_100px_60px_90px_110px_140px_90px_70px_30px]",
        )}
        style={getLiquidRowStyle(rowBg, isExpanded)}
        
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
                !hasTake ? "text-[#666]" :
                (isStopAtBE || isStopInProfit) ? "text-emerald-400" :
                (rrRatio && rrRatio >= 2 ? "text-emerald-400" : "text-red-400")
              )}>
                {(() => {
                  if (!hasTake) return '—';
                  if (isStopAtBE || isStopInProfit) {
                    // Show potential profit % from balance (no downside risk)
                    const takeDistance = Math.abs(trade.take_price - trade.entry_price);
                    const potentialUsd = trade.entry_price > 0 && trade.position_size > 0
                      ? (takeDistance / trade.entry_price) * trade.position_size : 0;
                    const potentialPct = balance > 0 ? (potentialUsd / balance) * 100 : 0;
                    return `+${potentialPct.toFixed(1)}%`;
                  }
                  return rrRatio ? `1:${Math.round(rrRatio)}` : '—';
                })()}
              </div>
              <div className="text-[9px] text-red-400/70">
                {!(isStopAtBE || isStopInProfit) && displayRiskUsd !== null && displayRiskPercent !== null ? (
                  <>Risk: ${formatNumber(Math.abs(displayRiskUsd))} / {Math.abs(displayRiskPercent).toFixed(1)}%</>
                ) : !(isStopAtBE || isStopInProfit) ? (
                  <span className="text-[#666]">—</span>
                ) : null}
              </div>
            </div>
          ) : (() => {
              // Use stored r_multiple
              let r = trade.r_multiple;
              if ((r === null || r === undefined) && trade.pnl_usd != null) {
                const riskUsd = trade.risk_usd || trade.original_risk_usd;
                if (riskUsd && riskUsd > 0) r = trade.pnl_usd / riskUsd;
              }
              return (
                <span className={cn(
                  "text-sm font-bold",
                  r === null || r === undefined ? "text-[#666]" :
                  r >= 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  {r !== null && r !== undefined ?
                    `${r >= 0 ? '+' : ''}${r.toFixed(1)}R` :
                    '—'}
                </span>
              );
            })()}
        </div>

        {/* uPnL column */}
        <div className="text-center">
          {isOpen ? (
            trade.pnl_usd != null && parseFloat(trade.pnl_usd) !== 0 ? (
              <div>
                <div className={cn(
                  "text-sm font-bold",
                  parseFloat(trade.pnl_usd) >= 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  {parseFloat(trade.pnl_usd) >= 0 ? '+' : '-'}${formatNumber(Math.abs(parseFloat(trade.pnl_usd)))}
                </div>
                {trade.realized_pnl_usd != null && trade.realized_pnl_usd !== 0 && (
                  <div className={cn("text-[9px] mt-0.5", trade.realized_pnl_usd >= 0 ? "text-emerald-500/60" : "text-red-500/60")}>
                    realized: {trade.realized_pnl_usd >= 0 ? '+' : '-'}${formatNumber(Math.abs(trade.realized_pnl_usd))}
                  </div>
                )}
              </div>
            ) : (
              <span className="text-xs text-[#666]">—</span>
            )
          ) : (
            <div className="flex items-baseline gap-1 justify-center">
              <span className={cn("text-sm font-bold", isProfit ? "text-emerald-400" : "text-red-400")}>
                {isProfit ? `+$${formatNumber(pnl)}` : `-$${formatNumber(Math.abs(pnl))}`}
              </span>
              <span className={cn("text-[9px]", isProfit ? "text-emerald-400/60" : "text-red-400/60")}>
                {isProfit ? '+' : ''}{pnlPercent.toFixed(1)}%
              </span>
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
          <div title="AI scoring — coming soon" className="flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"
              style={{animation: 'spin 8s linear infinite', opacity: 0.6}}>
              {Array.from({length: 12}).map((_, i) => {
                const angle = (i / 12) * Math.PI * 2;
                const r = 8;
                const cx = 11 + r * Math.cos(angle);
                const cy = 11 + r * Math.sin(angle);
                const size = 1.2 + (i % 3) * 0.4;
                const opacity = 0.3 + (i / 12) * 0.7;
                return <circle key={i} cx={cx} cy={cy} r={size} fill="white" opacity={opacity} />;
              })}
            </svg>
          </div>
        </div>

        {/* Row Actions */}
        <div className="flex items-center justify-center gap-1">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/15"
                aria-label="Delete trade"
                onClick={(e) => e.stopPropagation()}
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-[#111] border-[#333] text-[#c0c0c0]">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete trade?</AlertDialogTitle>
                <AlertDialogDescription className="text-[#888]">
                  This action cannot be undone. {coinName ? `${coinName} ` : ''}{trade.direction} trade will be removed permanently.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-transparent border-[#333] text-[#c0c0c0] hover:bg-[#1a1a1a]">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => onDelete?.(trade)}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      {/* end Desktop Row */}

      {/* Expanded Details */}
      {isExpanded && (
        isOpen ? (
          <OpenTradeCard
            trade={trade}
            onUpdate={onUpdate}
            currentBalance={currentBalance}
            formatDate={formatDate}
          />
        ) : (
          <ClosedTradeCard 
            trade={trade}
            onUpdate={onUpdate}
            currentBalance={currentBalance}
            formatDate={formatDate}
          />
        )
      )}
    </div>
  );
}