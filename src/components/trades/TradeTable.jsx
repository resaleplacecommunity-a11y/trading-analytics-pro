import { useState } from 'react';
import { format } from 'date-fns';
import { ChevronRight, ChevronDown, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from "@/lib/utils";
import TradeTableFilters from './TradeTableFilters';
import TradeExpandedDetails from './TradeExpandedDetails';

// Convert UTC to Moscow time (UTC+3)
const toMoscowTime = (dateString) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  // Convert to Moscow timezone (UTC+3)
  const moscowTime = new Date(date.getTime() + (3 * 60 * 60 * 1000) - (date.getTimezoneOffset() * 60 * 1000));
  return moscowTime;
};

const formatMoscowDate = (dateString) => {
  const moscowDate = toMoscowTime(dateString);
  if (!moscowDate) return '—';
  return format(moscowDate, 'dd.MM HH:mm');
};

export default function TradeTable({ 
  trades, 
  onUpdate, 
  onDelete, 
  onClosePosition,
  onMoveStopToBE 
}) {
  const [expandedId, setExpandedId] = useState(null);
  const [filters, setFilters] = useState({
    direction: 'all',
    coin: 'all',
    strategy: 'all',
    timeframe: 'all',
    result: 'all',
    dateFrom: '',
    dateTo: '',
    sortBy: 'default'
  });

  // Get unique values for filters
  const coins = [...new Set(trades.map(t => t.coin?.replace('USDT', '')).filter(Boolean))];
  const strategies = [...new Set(trades.map(t => t.strategy_tag).filter(Boolean))];
  const timeframes = [...new Set(trades.map(t => t.timeframe).filter(Boolean))];

  // Apply filters
  let filtered = trades.filter(trade => {
    if (filters.direction !== 'all' && trade.direction !== filters.direction) return false;
    
    const coinName = trade.coin?.replace('USDT', '');
    if (filters.coin !== 'all' && coinName !== filters.coin) return false;
    
    if (filters.strategy !== 'all' && trade.strategy_tag !== filters.strategy) return false;
    if (filters.timeframe !== 'all' && trade.timeframe !== filters.timeframe) return false;
    
    if (filters.result !== 'all' && trade.status === 'closed') {
      const pnl = trade.pnl_usd || 0;
      if (filters.result === 'winning' && pnl <= 0) return false;
      if (filters.result === 'losing' && pnl >= 0) return false;
      if (filters.result === 'breakeven' && Math.abs(pnl) > 1) return false;
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

  // Default sort: open first, then closed, newest first within each group
  if (filters.sortBy === 'default') {
    filtered.sort((a, b) => {
      const aOpen = a.status === 'open' || a.status === 'partially_closed';
      const bOpen = b.status === 'open' || b.status === 'partially_closed';
      
      if (aOpen && !bOpen) return -1;
      if (!aOpen && bOpen) return 1;
      
      // Within same status group, newest first
      return new Date(b.date_open || b.date) - new Date(a.date_open || a.date);
    });
  } else if (filters.sortBy === 'best_pnl') {
    filtered.sort((a, b) => (b.pnl_usd || 0) - (a.pnl_usd || 0));
  } else if (filters.sortBy === 'worst_pnl') {
    filtered.sort((a, b) => (a.pnl_usd || 0) - (b.pnl_usd || 0));
  }

  return (
    <div className="space-y-2">
      <TradeTableFilters 
        filters={filters}
        setFilters={setFilters}
        coins={coins}
        strategies={strategies}
        timeframes={timeframes}
      />

      <div className="bg-[#151515] rounded-lg border border-[#2a2a2a] overflow-hidden">
        {/* Table Header */}
        <div className="bg-[#1a1a1a] border-b border-[#2a2a2a]">
          <div className="grid grid-cols-[40px_50px_100px_80px_110px_100px_90px_100px_80px_100px_100px] gap-2 px-3 py-2 text-xs text-[#888] font-medium">
            <div></div>
            <div>Dir</div>
            <div>Coin</div>
            <div>Status</div>
            <div>Date</div>
            <div>Strategy</div>
            <div>TF</div>
            <div>Entry</div>
            <div className="text-right">R</div>
            <div className="text-right">PNL $</div>
            <div className="text-right">PNL %</div>
          </div>
        </div>

        {/* Table Body */}
        <div>
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-[#666]">
              No trades found
            </div>
          ) : (
            filtered.map((trade) => {
              const isExpanded = expandedId === trade.id;
              const isOpen = trade.status === 'open' || trade.status === 'partially_closed';
              const isLong = trade.direction === 'Long';
              const pnl = trade.pnl_usd || 0;
              const isProfit = pnl >= 0;
              const coinName = trade.coin?.replace('USDT', '');

              return (
                <div key={trade.id} className="border-b border-[#1a1a1a] last:border-0">
                  {/* Main Row */}
                  <div 
                    className="grid grid-cols-[40px_50px_100px_80px_110px_100px_90px_100px_80px_100px_100px] gap-2 px-3 py-2.5 hover:bg-[#1a1a1a] transition-colors cursor-pointer items-center"
                    onClick={() => setExpandedId(isExpanded ? null : trade.id)}
                  >
                    {/* Expand Icon */}
                    <div className="flex items-center justify-center">
                      {isExpanded ? 
                        <ChevronDown className="w-4 h-4 text-[#666]" /> : 
                        <ChevronRight className="w-4 h-4 text-[#666]" />
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
                    <div className="text-[#c0c0c0] font-semibold text-sm">
                      {coinName}
                    </div>

                    {/* Status */}
                    <div>
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded border",
                        isOpen 
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : "bg-gray-500/10 text-gray-400 border-gray-500/30"
                      )}>
                        {isOpen ? 'Open' : 'Closed'}
                      </span>
                    </div>

                    {/* Date */}
                    <div className="text-xs text-[#888]">
                      {formatMoscowDate(trade.date_open || trade.date)}
                    </div>

                    {/* Strategy */}
                    <div className="text-xs text-[#888] truncate">
                      {trade.strategy_tag || '—'}
                    </div>

                    {/* Timeframe */}
                    <div className="text-xs text-purple-400">
                      {trade.timeframe ? trade.timeframe.charAt(0).toUpperCase() + trade.timeframe.slice(1) : '—'}
                    </div>

                    {/* Entry */}
                    <div className="text-xs text-[#c0c0c0] font-medium">
                      ${trade.entry_price?.toFixed(4)}
                    </div>

                    {/* R */}
                    <div className="text-right">
                      {isOpen ? (
                        <span className={cn(
                          "text-xs font-medium",
                          (trade.rr_ratio || 0) >= 1.3 ? "text-emerald-400" : "text-amber-400"
                        )}>
                          {(trade.rr_ratio || 0).toFixed(1)}
                        </span>
                      ) : (
                        <span className={cn(
                          "text-xs font-bold",
                          (trade.r_multiple || 0) >= 0 ? "text-emerald-400" : "text-red-400"
                        )}>
                          {(trade.r_multiple || 0).toFixed(1)}R
                        </span>
                      )}
                    </div>

                    {/* PNL $ */}
                    <div className="text-right">
                      {isOpen ? (
                        <span className="text-xs text-[#666]">—</span>
                      ) : (
                        <span className={cn(
                          "text-sm font-bold",
                          isProfit ? "text-emerald-400" : "text-red-400"
                        )}>
                          {isProfit ? '+' : ''}{pnl.toFixed(2)}
                        </span>
                      )}
                    </div>

                    {/* PNL % */}
                    <div className="text-right">
                      {isOpen ? (
                        <span className="text-xs text-[#666]">—</span>
                      ) : (
                        <span className={cn(
                          "text-xs font-medium",
                          isProfit ? "text-emerald-400/70" : "text-red-400/70"
                        )}>
                          {isProfit ? '+' : ''}{(trade.pnl_percent_of_balance || 0).toFixed(2)}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <TradeExpandedDetails 
                      trade={trade}
                      onUpdate={onUpdate}
                      onDelete={onDelete}
                      onClosePosition={onClosePosition}
                      onMoveStopToBE={onMoveStopToBE}
                      formatDate={formatMoscowDate}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}