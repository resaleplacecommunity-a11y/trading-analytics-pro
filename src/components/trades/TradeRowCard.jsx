import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Target, XCircle, MoveRight, Clock } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function TradeRowCard({ trade, onClick, onClosePosition, onMoveStopToBE }) {
  const [duration, setDuration] = useState(0);
  const isProfit = (trade.pnl_usd || 0) >= 0;
  const isLong = trade.direction === 'Long';
  const aiScore = trade.ai_score || 0;
  const aiScoreGood = aiScore > 5;
  const isOpen = trade.status === 'open' || trade.status === 'partially_closed';

  const statusColors = {
    open: 'bg-amber-500/20 text-amber-400',
    closed: 'bg-gray-500/20 text-gray-400',
    partially_closed: 'bg-blue-500/20 text-blue-400'
  };

  const timeframeLabels = {
    scalp: 'Scalp',
    day: 'Day',
    swing: 'Swing',
    mid_term: 'Mid',
    long_term: 'Long',
    spot: 'Spot'
  };

  // Live duration timer for open trades
  useEffect(() => {
    if (!isOpen) return;
    
    const updateDuration = () => {
      const openTime = new Date(trade.date_open || trade.date);
      const now = new Date();
      const diff = Math.floor((now - openTime) / 1000);
      setDuration(diff);
    };

    updateDuration();
    const interval = setInterval(updateDuration, 1000);
    return () => clearInterval(interval);
  }, [isOpen, trade.date_open, trade.date]);

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  const handleActionClick = (e, action) => {
    e.stopPropagation();
    action();
  };

  // Calculate risk in USD and %
  const originalRiskUsd = Math.abs(trade.stop_usd || 0);
  const originalRiskPercent = Math.abs(trade.stop_percent || 0);
  const balance = trade.account_balance_at_entry || 10000;

  return (
    <div 
      onClick={() => onClick?.(trade)}
      className="bg-gradient-to-br from-[#1a1a1a] to-[#141414] rounded-lg p-3 border border-[#2a2a2a] hover:border-[#3a3a3a] transition-all duration-300 cursor-pointer group"
    >
      {/* Top Row - Core Info */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Direction Icon */}
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
            isLong ? "bg-emerald-500/20" : "bg-red-500/20"
          )}>
            {isLong ? 
              <TrendingUp className="w-4 h-4 text-emerald-400" /> : 
              <TrendingDown className="w-4 h-4 text-red-400" />
            }
          </div>

          {/* Coin & Badges */}
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="text-[#c0c0c0] font-semibold">{trade.coin}</span>
            <Badge variant="outline" className={cn("text-xs border-0 px-1.5 py-0", statusColors[trade.status || 'closed'])}>
              {trade.status === 'partially_closed' ? 'Partial' : trade.status === 'open' ? 'Open' : 'Closed'}
            </Badge>
            {trade.strategy_tag && (
              <Badge className="bg-[#252525] text-[#888] border-0 text-xs">
                {trade.strategy_tag}
              </Badge>
            )}
            {trade.timeframe && (
              <Badge className="bg-purple-500/20 text-purple-400 border-0 text-xs">
                {timeframeLabels[trade.timeframe]}
              </Badge>
            )}
            <Badge className={cn(
              "border-0 text-xs",
              aiScoreGood ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
            )}>
              AI: {aiScore.toFixed(1)}/10
            </Badge>
          </div>
        </div>

        {/* Dates */}
        <div className="text-right text-xs shrink-0">
          <p className="text-[#888]">Opened: {format(new Date(trade.date_open || trade.date), 'dd.MM HH:mm')}</p>
          {trade.date_close && (
            <p className="text-[#666]">Closed: {format(new Date(trade.date_close), 'dd.MM HH:mm')}</p>
          )}
        </div>
      </div>

      {/* Technical Block & Result Section */}
      <div className="flex items-center justify-between gap-4 mt-3">
        {/* Technical Details */}
        <div className="flex items-center gap-4 flex-1">
          <div className="text-center">
            <p className="text-[#666] text-xs">Entry</p>
            <p className="text-[#c0c0c0] text-sm font-medium">${trade.entry_price?.toFixed(4)}</p>
          </div>
          
          <div className="text-center">
            <p className="text-[#666] text-xs">Close</p>
            <p className="text-[#c0c0c0] text-sm font-medium">
              {trade.close_price ? `$${trade.close_price.toFixed(4)}` : '—'}
            </p>
          </div>

          <div className="text-center">
            <p className="text-[#666] text-xs">Size</p>
            <p className="text-[#c0c0c0] text-sm font-medium">${trade.position_size?.toFixed(0)}</p>
          </div>

          <div className="text-center">
            <p className="text-[#666] text-xs">Risk (SL)</p>
            <p className="text-red-400 text-xs font-medium">
              ${originalRiskUsd.toFixed(2)}
            </p>
            <p className="text-red-400/70 text-[10px]">
              {originalRiskPercent.toFixed(2)}%
            </p>
          </div>

          <div className="text-center">
            <p className="text-[#666] text-xs">{isOpen ? 'RR' : 'R'}</p>
            <p className={cn(
              "text-sm font-medium",
              isOpen 
                ? ((trade.rr_ratio || 0) >= 1.3 ? "text-emerald-400" : "text-red-400")
                : ((trade.r_multiple || 0) >= 0 ? "text-emerald-400" : "text-red-400")
            )}>
              {isOpen ? (trade.rr_ratio || 0).toFixed(2) : `${(trade.r_multiple || 0).toFixed(2)}R`}
            </p>
          </div>
        </div>

        {/* Result Section or Action Buttons */}
        {isOpen ? (
          <div className="flex flex-col gap-2 min-w-[200px]">
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={(e) => handleActionClick(e, () => onClosePosition(trade))}
                className="flex-1 h-8 bg-red-500/20 text-red-400 hover:bg-red-500/30 border-0"
              >
                <XCircle className="w-3 h-3 mr-1" />
                Close
              </Button>
              <Button
                size="sm"
                onClick={(e) => handleActionClick(e, () => onMoveStopToBE(trade))}
                className="flex-1 h-8 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border-0"
              >
                <MoveRight className="w-3 h-3 mr-1" />
                SL→BE
              </Button>
            </div>
            <div className="bg-[#151515] rounded-lg p-2 text-center">
              <div className="flex items-center justify-center gap-1 text-amber-400 text-xs">
                <Clock className="w-3 h-3" />
                <span>{formatDuration(duration)}</span>
              </div>
              {trade.expected_duration_minutes && (
                <p className="text-[#666] text-[10px] mt-0.5">
                  Expected: {Math.floor(trade.expected_duration_minutes / 60)}h {trade.expected_duration_minutes % 60}m
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="text-right min-w-[120px]">
            <p className={cn(
              "text-lg font-bold",
              isProfit ? "text-emerald-400" : "text-red-400"
            )}>
              {isProfit ? '+' : ''}${(trade.pnl_usd || 0).toFixed(2)}
            </p>
            <p className={cn(
              "text-xs",
              isProfit ? "text-emerald-400/70" : "text-red-400/70"
            )}>
              {isProfit ? '+' : ''}{(trade.pnl_percent_of_balance || trade.pnl_percent || 0).toFixed(2)}%
            </p>
            {trade.actual_duration_minutes > 0 && (
              <p className="text-[#666] text-[10px] mt-1">
                Duration: {Math.floor(trade.actual_duration_minutes / 60)}h {trade.actual_duration_minutes % 60}m
              </p>
            )}
          </div>
        )}
      </div>

      {/* Violation Tags (for closed trades) */}
      {!isOpen && trade.violation_tags && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {trade.violation_tags.split(',').map((tag, i) => (
            <Badge key={i} className="bg-red-500/10 text-red-400 border-0 text-[10px] px-2 py-0">
              {tag.trim()}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}