import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ChevronDown, 
  ChevronRight, 
  TrendingUp, 
  TrendingDown, 
  XCircle, 
  MoveRight, 
  Clock,
  Trash2,
  Save
} from 'lucide-react';
import { cn } from "@/lib/utils";

export default function TradeRowCompact({ 
  trade, 
  onClosePosition, 
  onMoveStopToBE,
  onUpdate,
  onDelete 
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedTrade, setEditedTrade] = useState(trade);
  const [duration, setDuration] = useState(0);
  
  const isLong = trade.direction === 'Long';
  const isOpen = trade.status === 'open' || trade.status === 'partially_closed';
  const isClosed = trade.status === 'closed';
  const pnl = trade.pnl_usd || 0;
  const isProfit = pnl >= 0;

  // Live duration for open trades
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
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const handleSave = () => {
    onUpdate(editedTrade);
    setEditing(false);
  };

  const statusColors = {
    open: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    closed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    partially_closed: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
  };

  const timeframeLabels = {
    scalp: 'Scalp', day: 'Day', swing: 'Swing',
    mid_term: 'Mid', long_term: 'Long', spot: 'Spot'
  };

  const originalRiskUsd = Math.abs(trade.stop_usd || 0);
  const originalRiskPercent = Math.abs(trade.stop_percent || 0);

  return (
    <div className="bg-[#151515] rounded-lg border border-[#2a2a2a] hover:border-[#3a3a3a] transition-all">
      {/* Compact Row */}
      <div 
        onClick={() => !editing && setExpanded(!expanded)}
        className="flex items-center gap-3 p-2.5 cursor-pointer"
      >
        {/* Expand Icon */}
        <button 
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="text-[#666] hover:text-[#c0c0c0] transition-colors shrink-0"
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {/* Direction Icon */}
        <div className={cn(
          "w-6 h-6 rounded flex items-center justify-center shrink-0",
          isLong ? "bg-emerald-500/20" : "bg-red-500/20"
        )}>
          {isLong ? 
            <TrendingUp className="w-3 h-3 text-emerald-400" /> : 
            <TrendingDown className="w-3 h-3 text-red-400" />
          }
        </div>

        {/* Main Info */}
        <div className="flex items-center gap-2 min-w-[140px]">
          <span className="text-[#c0c0c0] font-semibold text-sm">{trade.coin}</span>
          <Badge className={cn("text-[10px] px-1.5 py-0 border", statusColors[trade.status || 'closed'])}>
            {trade.status === 'partially_closed' ? 'Partial' : trade.status === 'open' ? 'Open' : 'Closed'}
          </Badge>
        </div>

        {/* Date */}
        <div className="text-xs text-[#888] min-w-[100px]">
          {format(new Date(trade.date_open || trade.date), 'dd.MM.yy HH:mm')}
        </div>

        {/* Tags */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {trade.timeframe && (
            <Badge className="bg-purple-500/10 text-purple-400 border-0 text-[10px] px-1.5 py-0">
              {timeframeLabels[trade.timeframe]}
            </Badge>
          )}
          {trade.strategy_tag && (
            <Badge className="bg-[#1a1a1a] text-[#888] border-0 text-[10px] px-1.5 py-0 truncate max-w-[100px]">
              {trade.strategy_tag}
            </Badge>
          )}
        </div>

        {/* Quick Metrics */}
        <div className="flex items-center gap-4 text-xs">
          <div className="text-center min-w-[60px]">
            <span className="text-[#666]">Entry</span>
            <span className="text-[#c0c0c0] ml-1 font-medium">${trade.entry_price?.toFixed(4)}</span>
          </div>
          <div className="text-center min-w-[50px]">
            <span className="text-[#666]">{isOpen ? 'RR' : 'R'}</span>
            <span className={cn(
              "ml-1 font-medium",
              isOpen 
                ? ((trade.rr_ratio || 0) >= 1.3 ? "text-emerald-400" : "text-amber-400")
                : ((trade.r_multiple || 0) >= 0 ? "text-emerald-400" : "text-red-400")
            )}>
              {isOpen ? (trade.rr_ratio || 0).toFixed(1) : `${(trade.r_multiple || 0).toFixed(1)}R`}
            </span>
          </div>
        </div>

        {/* Result or Duration */}
        {isOpen ? (
          <div className="flex items-center gap-1 text-amber-400 text-xs min-w-[70px] justify-end">
            <Clock className="w-3 h-3" />
            <span className="font-mono">{formatDuration(duration)}</span>
          </div>
        ) : (
          <div className="text-right min-w-[90px]">
            <p className={cn("text-sm font-bold", isProfit ? "text-emerald-400" : "text-red-400")}>
              {isProfit ? '+' : ''}${pnl.toFixed(2)}
            </p>
            <p className={cn("text-[10px]", isProfit ? "text-emerald-400/70" : "text-red-400/70")}>
              {isProfit ? '+' : ''}{(trade.pnl_percent_of_balance || trade.pnl_percent || 0).toFixed(2)}%
            </p>
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-[#2a2a2a] p-4 space-y-4 bg-[#1a1a1a]">
          {/* Action Buttons for Open Trades */}
          {isOpen && (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={(e) => { e.stopPropagation(); onClosePosition(trade); }}
                className="flex-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 border-0"
              >
                <XCircle className="w-3 h-3 mr-1" />
                Close Position
              </Button>
              <Button
                size="sm"
                onClick={(e) => { e.stopPropagation(); onMoveStopToBE(trade); }}
                className="flex-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border-0"
              >
                <MoveRight className="w-3 h-3 mr-1" />
                Move SL → BE
              </Button>
            </div>
          )}

          {!editing ? (
            <>
              {/* Technical Details Grid */}
              <div className="grid grid-cols-4 gap-3 text-xs">
                <div className="bg-[#151515] rounded p-2">
                  <p className="text-[#666] mb-1">Entry</p>
                  <p className="text-[#c0c0c0] font-medium">${trade.entry_price?.toFixed(4)}</p>
                </div>
                <div className="bg-[#151515] rounded p-2">
                  <p className="text-[#666] mb-1">{isClosed ? 'Close' : 'Current'}</p>
                  <p className="text-[#c0c0c0] font-medium">
                    {trade.close_price ? `$${trade.close_price.toFixed(4)}` : '—'}
                  </p>
                </div>
                <div className="bg-[#151515] rounded p-2">
                  <p className="text-[#666] mb-1">Size</p>
                  <p className="text-[#c0c0c0] font-medium">${trade.position_size?.toFixed(0)}</p>
                </div>
                <div className="bg-[#151515] rounded p-2">
                  <p className="text-[#666] mb-1">Balance</p>
                  <p className="text-[#c0c0c0] font-medium">${(trade.account_balance_at_entry || 0).toFixed(0)}</p>
                </div>
              </div>

              {/* SL/TP Row */}
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="bg-[#151515] rounded p-2">
                  <p className="text-[#666] mb-1">Stop Loss</p>
                  <p className="text-red-400 font-medium">${trade.stop_price?.toFixed(4)}</p>
                  <p className="text-red-400/60 text-[10px] mt-0.5">
                    ${originalRiskUsd.toFixed(2)} • {originalRiskPercent.toFixed(2)}%
                  </p>
                </div>
                <div className="bg-[#151515] rounded p-2">
                  <p className="text-[#666] mb-1">Take Profit</p>
                  <p className="text-emerald-400 font-medium">${trade.take_price?.toFixed(4)}</p>
                </div>
                <div className="bg-[#151515] rounded p-2">
                  <p className="text-[#666] mb-1">Risk:Reward</p>
                  <p className={cn(
                    "font-bold text-base",
                    (trade.rr_ratio || 0) >= 1.3 ? "text-emerald-400" : "text-amber-400"
                  )}>
                    {(trade.rr_ratio || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Duration & AI */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-[#151515] rounded p-2">
                  <p className="text-[#666] mb-1">Duration</p>
                  <p className="text-[#c0c0c0]">
                    {isOpen ? (
                      <span className="text-amber-400">{formatDuration(duration)}</span>
                    ) : trade.actual_duration_minutes > 0 ? (
                      `${Math.floor(trade.actual_duration_minutes / 60)}h ${trade.actual_duration_minutes % 60}m`
                    ) : '—'}
                  </p>
                  {trade.expected_duration_minutes > 0 && (
                    <p className="text-[#666] text-[10px] mt-0.5">
                      Expected: {Math.floor(trade.expected_duration_minutes / 60)}h {trade.expected_duration_minutes % 60}m
                    </p>
                  )}
                </div>
                <div className="bg-[#151515] rounded p-2">
                  <p className="text-[#666] mb-1">AI Score</p>
                  <p className={cn(
                    "font-medium",
                    (trade.ai_score || 0) > 5 ? "text-emerald-400" : "text-red-400"
                  )}>
                    {(trade.ai_score || 0).toFixed(1)}/10
                  </p>
                </div>
              </div>

              {/* Psychology */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-[#151515] rounded p-2">
                  <p className="text-[#666] mb-1">Emotional State</p>
                  <p className="text-amber-400 font-medium">{trade.emotional_state || 5}/10</p>
                </div>
                <div className="bg-[#151515] rounded p-2">
                  <p className="text-[#666] mb-1">Confidence</p>
                  <p className="text-purple-400 font-medium">{trade.confidence_level || 5}/10</p>
                </div>
              </div>

              {/* Notes */}
              {trade.entry_reason && (
                <div className="bg-[#151515] rounded p-2 text-xs">
                  <p className="text-[#666] mb-1">Entry Reason</p>
                  <p className="text-[#c0c0c0]">{trade.entry_reason}</p>
                </div>
              )}

              {trade.trade_analysis && (
                <div className="bg-amber-500/10 rounded p-2 text-xs">
                  <p className="text-amber-400 mb-1">Analysis</p>
                  <p className="text-[#c0c0c0]">{trade.trade_analysis}</p>
                </div>
              )}

              {/* Violation Tags */}
              {trade.violation_tags && (
                <div className="flex gap-1 flex-wrap">
                  {trade.violation_tags.split(',').map((tag, i) => (
                    <Badge key={i} className="bg-red-500/10 text-red-400 border-0 text-[10px]">
                      {tag.trim()}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Edit/Delete Buttons */}
              <div className="flex gap-2 pt-2 border-t border-[#2a2a2a]">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(true)}
                  className="flex-1 border-[#2a2a2a] text-[#888]"
                >
                  Edit Details
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDelete(trade)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </>
          ) : (
            // Edit Mode
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  step="any"
                  value={editedTrade.entry_price}
                  onChange={(e) => setEditedTrade({...editedTrade, entry_price: parseFloat(e.target.value)})}
                  placeholder="Entry"
                  className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] h-8 text-xs"
                />
                <Input
                  type="number"
                  step="any"
                  value={editedTrade.close_price || ''}
                  onChange={(e) => setEditedTrade({...editedTrade, close_price: parseFloat(e.target.value)})}
                  placeholder="Close"
                  className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] h-8 text-xs"
                />
              </div>
              <Textarea
                value={editedTrade.trade_analysis || ''}
                onChange={(e) => setEditedTrade({...editedTrade, trade_analysis: e.target.value})}
                placeholder="Trade analysis..."
                className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] text-xs min-h-[60px]"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} className="flex-1 bg-[#c0c0c0] text-black">
                  <Save className="w-3 h-3 mr-1" />
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="border-[#2a2a2a]">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}