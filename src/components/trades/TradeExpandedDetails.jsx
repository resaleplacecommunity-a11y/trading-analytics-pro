import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { XCircle, MoveRight, Save, Trash2, Clock } from 'lucide-react';
import { cn } from "@/lib/utils";

// Calculation helpers
const calculateMetrics = (trade) => {
  const isLong = trade.direction === 'Long';
  const entry = parseFloat(trade.entry_price) || 0;
  const stop = parseFloat(trade.stop_price) || 0;
  const take = parseFloat(trade.take_price) || 0;
  const size = parseFloat(trade.position_size) || 0;
  const close = parseFloat(trade.close_price) || 0;
  const balance = parseFloat(trade.account_balance_at_entry) || 10000;

  if (!entry || !stop || !size) return {};

  // Risk calculation
  const priceRisk = isLong ? (entry - stop) : (stop - entry);
  const riskUsd = size * (priceRisk / entry);
  const riskPercent = (riskUsd / balance) * 100;

  // Potential reward (at TP)
  let potentialRewardUsd = 0;
  let potentialRewardPercent = 0;
  let plannedRR = 0;
  
  if (take) {
    const priceReward = isLong ? (take - entry) : (entry - take);
    potentialRewardUsd = size * (priceReward / entry);
    potentialRewardPercent = (potentialRewardUsd / balance) * 100;
    plannedRR = riskUsd !== 0 ? potentialRewardUsd / riskUsd : 0;
  }

  // Actual PNL (for closed trades)
  let pnlUsd = 0;
  let pnlPercent = 0;
  let actualR = 0;

  if (close && (trade.status === 'closed')) {
    const priceMove = isLong ? (close - entry) : (entry - close);
    pnlUsd = size * (priceMove / entry);
    pnlPercent = (pnlUsd / balance) * 100;
    actualR = riskUsd !== 0 ? pnlUsd / riskUsd : 0;
  }

  return {
    risk_usd: Math.abs(riskUsd),
    risk_percent: Math.abs(riskPercent),
    potential_reward_usd: potentialRewardUsd,
    potential_reward_percent: potentialRewardPercent,
    planned_rr: plannedRR,
    pnl_usd: pnlUsd,
    pnl_percent_of_balance: pnlPercent,
    r_multiple: actualR
  };
};

export default function TradeExpandedDetails({ 
  trade, 
  onUpdate, 
  onDelete,
  onClosePosition,
  onMoveStopToBE,
  formatDate 
}) {
  const [editing, setEditing] = useState(false);
  const [editedTrade, setEditedTrade] = useState(trade);
  const [duration, setDuration] = useState(0);

  const isOpen = trade.status === 'open' || trade.status === 'partially_closed';
  const metrics = calculateMetrics(editedTrade);

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
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const handleSave = () => {
    const calculated = calculateMetrics(editedTrade);
    const updated = {
      ...editedTrade,
      ...calculated,
      // Keep original stop for historical accuracy
      original_stop_price: editedTrade.original_stop_price || editedTrade.stop_price
    };
    onUpdate(updated);
    setEditing(false);
  };

  const handleFieldChange = (field, value) => {
    setEditedTrade(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="bg-[#1a1a1a] border-t border-[#2a2a2a] p-4">
      {/* Action Buttons for Open Trades */}
      {isOpen && !editing && (
        <div className="flex gap-2 mb-4">
          <Button
            size="sm"
            onClick={(e) => { e.stopPropagation(); onClosePosition(trade); }}
            className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border-0"
          >
            <XCircle className="w-3 h-3 mr-1" />
            Close Position
          </Button>
          <Button
            size="sm"
            onClick={(e) => { e.stopPropagation(); onMoveStopToBE(trade); }}
            className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border-0"
          >
            <MoveRight className="w-3 h-3 mr-1" />
            Move SL → BE
          </Button>
        </div>
      )}

      {!editing ? (
        <div className="space-y-4">
          {/* Technical Grid */}
          <div className="grid grid-cols-5 gap-3 text-xs">
            <div className="bg-[#151515] rounded p-2">
              <p className="text-[#666] mb-1">Entry Price</p>
              <p className="text-[#c0c0c0] font-medium">${trade.entry_price?.toFixed(4)}</p>
            </div>
            <div className="bg-[#151515] rounded p-2">
              <p className="text-[#666] mb-1">Stop Price</p>
              <p className="text-red-400 font-medium">${trade.stop_price?.toFixed(4)}</p>
              <p className="text-red-400/60 text-[10px] mt-0.5">
                Risk: ${metrics.risk_usd?.toFixed(2)} ({metrics.risk_percent?.toFixed(2)}%)
              </p>
            </div>
            <div className="bg-[#151515] rounded p-2">
              <p className="text-[#666] mb-1">Take Profit</p>
              <p className="text-emerald-400 font-medium">${trade.take_price?.toFixed(4)}</p>
            </div>
            <div className="bg-[#151515] rounded p-2">
              <p className="text-[#666] mb-1">Position Size</p>
              <p className="text-[#c0c0c0] font-medium">${trade.position_size?.toFixed(0)}</p>
            </div>
            <div className="bg-[#151515] rounded p-2">
              <p className="text-[#666] mb-1">Planned RR</p>
              <p className={cn(
                "font-bold text-base",
                metrics.planned_rr >= 1.3 ? "text-emerald-400" : "text-amber-400"
              )}>
                {metrics.planned_rr?.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Results Row (for closed trades) */}
          {!isOpen && (
            <div className="grid grid-cols-4 gap-3 text-xs bg-[#151515] rounded p-3">
              <div>
                <p className="text-[#666] mb-1">Close Price</p>
                <p className="text-[#c0c0c0] font-medium">${trade.close_price?.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-[#666] mb-1">PNL USD</p>
                <p className={cn(
                  "text-lg font-bold",
                  metrics.pnl_usd >= 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  {metrics.pnl_usd >= 0 ? '+' : ''}${metrics.pnl_usd?.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-[#666] mb-1">PNL % (of balance)</p>
                <p className={cn(
                  "text-base font-bold",
                  metrics.pnl_percent_of_balance >= 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  {metrics.pnl_percent_of_balance >= 0 ? '+' : ''}{metrics.pnl_percent_of_balance?.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-[#666] mb-1">Actual R</p>
                <p className={cn(
                  "text-lg font-bold",
                  metrics.r_multiple >= 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  {metrics.r_multiple?.toFixed(2)}R
                </p>
              </div>
            </div>
          )}

          {/* Meta Info */}
          <div className="grid grid-cols-4 gap-3 text-xs">
            <div className="bg-[#151515] rounded p-2">
              <p className="text-[#666] mb-1">Balance at Entry</p>
              <p className="text-[#c0c0c0]">${(trade.account_balance_at_entry || 0).toFixed(0)}</p>
            </div>
            <div className="bg-[#151515] rounded p-2">
              <p className="text-[#666] mb-1">Duration</p>
              <p className="text-[#c0c0c0]">
                {isOpen ? (
                  <span className="text-amber-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDuration(duration)}
                  </span>
                ) : trade.actual_duration_minutes > 0 ? (
                  `${Math.floor(trade.actual_duration_minutes / 60)}h ${trade.actual_duration_minutes % 60}m`
                ) : '—'}
              </p>
            </div>
            <div className="bg-[#151515] rounded p-2">
              <p className="text-[#666] mb-1">Emotion</p>
              <p className="text-amber-400">{trade.emotional_state || 5}/10</p>
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

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-[#2a2a2a]">
            <Button
              size="sm"
              onClick={() => setEditing(true)}
              className="bg-[#c0c0c0] text-black hover:bg-[#a0a0a0]"
            >
              Edit Trade
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(trade)}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Delete
            </Button>
          </div>
        </div>
      ) : (
        /* Edit Mode */
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-2">
            <Input
              type="number"
              step="any"
              value={editedTrade.entry_price}
              onChange={(e) => handleFieldChange('entry_price', e.target.value)}
              placeholder="Entry"
              className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] h-8 text-xs"
            />
            <Input
              type="number"
              step="any"
              value={editedTrade.stop_price}
              onChange={(e) => handleFieldChange('stop_price', e.target.value)}
              placeholder="Stop"
              className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] h-8 text-xs"
            />
            <Input
              type="number"
              step="any"
              value={editedTrade.take_price}
              onChange={(e) => handleFieldChange('take_price', e.target.value)}
              placeholder="Take"
              className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] h-8 text-xs"
            />
            <Input
              type="number"
              value={editedTrade.position_size}
              onChange={(e) => handleFieldChange('position_size', e.target.value)}
              placeholder="Size"
              className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] h-8 text-xs"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Input
              type="number"
              step="any"
              value={editedTrade.close_price || ''}
              onChange={(e) => handleFieldChange('close_price', e.target.value)}
              placeholder="Close Price"
              className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] h-8 text-xs"
            />
            <Select 
              value={editedTrade.status} 
              onValueChange={(v) => handleFieldChange('status', v)}
            >
              <SelectTrigger className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              value={editedTrade.account_balance_at_entry}
              onChange={(e) => handleFieldChange('account_balance_at_entry', e.target.value)}
              placeholder="Balance"
              className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] h-8 text-xs"
            />
          </div>

          <Textarea
            value={editedTrade.trade_analysis || ''}
            onChange={(e) => handleFieldChange('trade_analysis', e.target.value)}
            placeholder="Analysis..."
            className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] text-xs min-h-[60px]"
          />

          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} className="bg-[#c0c0c0] text-black">
              <Save className="w-3 h-3 mr-1" />
              Save
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => { setEditedTrade(trade); setEditing(false); }}
              className="border-[#2a2a2a]"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}