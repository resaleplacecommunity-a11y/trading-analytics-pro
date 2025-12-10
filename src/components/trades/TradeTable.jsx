import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ChevronRight, ChevronDown, TrendingUp, TrendingDown, Clock, Trophy, XCircle, ChevronUp } from 'lucide-react';
import { cn } from "@/lib/utils";
import TradeExpandedDetails from './TradeExpandedDetails';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

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
    result: 'all',
    dateFrom: '',
    dateTo: ''
  });

  // Get unique values
  const coins = [...new Set(trades.map(t => t.coin?.replace('USDT', '')).filter(Boolean))];
  const strategies = [...new Set(trades.map(t => t.strategy_tag).filter(Boolean))];

  // Apply filters
  let filtered = trades.filter(trade => {
    if (filters.direction !== 'all' && trade.direction !== filters.direction) return false;
    
    const coinName = trade.coin?.replace('USDT', '');
    if (filters.coin !== 'all' && coinName !== filters.coin) return false;
    
    if (filters.strategy !== 'all' && trade.strategy_tag !== filters.strategy) return false;
    
    // Result filter (only for closed)
    const isOpen = !trade.close_price;
    if (filters.result !== 'all' && !isOpen) {
      const pnl = trade.pnl_usd || 0;
      if (filters.result === 'winning' && pnl <= 0) return false;
      if (filters.result === 'losing' && pnl >= 0) return false;
    }
    
    if (filters.dateFrom) {
      const tradeDate = toMoscowTime(trade.date_open || trade.date);
      const fromDate = new Date(filters.dateFrom);
      if (tradeDate < fromDate) return false;
    }
    
    if (filters.dateTo) {
      const tradeDate = toMoscowTime(trade.date_open || trade.date);
      const toDate = new Date(filters.dateTo + 'T23:59:59');
      if (tradeDate > toDate) return false;
    }
    
    return true;
  });

  // Default sort: open first (newest), then closed (newest)
  filtered.sort((a, b) => {
    const aOpen = !a.close_price;
    const bOpen = !b.close_price;
    
    if (aOpen && !bOpen) return -1;
    if (!aOpen && bOpen) return 1;
    
    return new Date(b.date_open || b.date) - new Date(a.date_open || a.date);
  });

  return (
    <div className="space-y-2">
      <div className="bg-[#151515] rounded-lg border border-[#2a2a2a] overflow-hidden">
        {/* Header */}
        <div className="bg-[#1a1a1a] border-b border-[#2a2a2a] sticky top-0 z-10">
          <div className="grid grid-cols-[30px_40px_100px_60px_100px_100px_90px_110px_140px_90px_70px] gap-3 px-3 py-2.5 text-[10px] text-[#666] font-medium uppercase tracking-wide">
            <div></div>
            
            {/* Direction Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-center hover:text-[#c0c0c0] transition-colors flex items-center justify-center gap-1">
                  Dir {filters.direction !== 'all' && <ChevronUp className="w-3 h-3" />}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-32 p-2 bg-[#1a1a1a] border-[#2a2a2a]">
                <div className="space-y-1">
                  <Button size="sm" variant="ghost" onClick={() => setFilters(prev => ({ ...prev, direction: 'all' }))} className="w-full justify-start text-xs">All</Button>
                  <Button size="sm" variant="ghost" onClick={() => setFilters(prev => ({ ...prev, direction: 'Long' }))} className="w-full justify-start text-xs text-emerald-400">Long</Button>
                  <Button size="sm" variant="ghost" onClick={() => setFilters(prev => ({ ...prev, direction: 'Short' }))} className="w-full justify-start text-xs text-red-400">Short</Button>
                </div>
              </PopoverContent>
            </Popover>
            
            {/* Coin Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="hover:text-[#c0c0c0] transition-colors flex items-center gap-1">
                  Coin {filters.coin !== 'all' && <ChevronUp className="w-3 h-3" />}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-2 bg-[#1a1a1a] border-[#2a2a2a] max-h-64 overflow-y-auto">
                <div className="space-y-1">
                  <Button size="sm" variant="ghost" onClick={() => setFilters(prev => ({ ...prev, coin: 'all' }))} className="w-full justify-start text-xs">All Coins</Button>
                  {coins.map(coin => (
                    <Button key={coin} size="sm" variant="ghost" onClick={() => setFilters(prev => ({ ...prev, coin }))} className="w-full justify-start text-xs">{coin}</Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            
            {/* Result Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-center hover:text-[#c0c0c0] transition-colors flex items-center justify-center gap-1">
                  Status {filters.result !== 'all' && <ChevronUp className="w-3 h-3" />}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-32 p-2 bg-[#1a1a1a] border-[#2a2a2a]">
                <div className="space-y-1">
                  <Button size="sm" variant="ghost" onClick={() => setFilters(prev => ({ ...prev, result: 'all' }))} className="w-full justify-start text-xs">All</Button>
                  <Button size="sm" variant="ghost" onClick={() => setFilters(prev => ({ ...prev, result: 'winning' }))} className="w-full justify-start text-xs text-emerald-400">Win</Button>
                  <Button size="sm" variant="ghost" onClick={() => setFilters(prev => ({ ...prev, result: 'losing' }))} className="w-full justify-start text-xs text-red-400">Loss</Button>
                </div>
              </PopoverContent>
            </Popover>
            
            <div className="text-center">Date</div>
            
            {/* Strategy Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-center hover:text-[#c0c0c0] transition-colors flex items-center justify-center gap-1">
                  Strategy {filters.strategy !== 'all' && <ChevronUp className="w-3 h-3" />}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2 bg-[#1a1a1a] border-[#2a2a2a] max-h-64 overflow-y-auto">
                <div className="space-y-1">
                  <Button size="sm" variant="ghost" onClick={() => setFilters(prev => ({ ...prev, strategy: 'all' }))} className="w-full justify-start text-xs">All Strategies</Button>
                  {strategies.map(s => (
                    <Button key={s} size="sm" variant="ghost" onClick={() => setFilters(prev => ({ ...prev, strategy: s }))} className="w-full justify-start text-xs">{s}</Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            
            <div className="text-center">Entry</div>
            <div className="text-center">RR / R</div>
            <div className="text-center">PNL</div>
            <div className="text-center">Duration</div>
            <div className="text-center">AI</div>
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