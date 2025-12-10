import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { XCircle, MoveRight, Save, Trash2 } from 'lucide-react';
import { cn } from "@/lib/utils";

// Calculate all metrics from scratch
const calculateMetrics = (trade, currentBalance) => {
  const isLong = trade.direction === 'Long';
  const entry = parseFloat(trade.entry_price) || 0;
  const stop = parseFloat(trade.stop_price) || 0;
  const take = parseFloat(trade.take_price) || 0;
  const size = parseFloat(trade.position_size) || 0;
  const close = parseFloat(trade.close_price) || 0;
  const balance = parseFloat(trade.account_balance_at_entry) || currentBalance || 100000;

  if (!entry || !stop || !size) return {};

  // Risk calculation (from BALANCE, not position)
  const priceRisk = isLong ? (entry - stop) : (stop - entry);
  const riskUsd = size * (priceRisk / entry);
  const riskPercent = (riskUsd / balance) * 100;

  // Potential reward
  let potentialRewardUsd = 0;
  let potentialRewardPercent = 0;
  let plannedRR = 0;
  
  if (take) {
    const priceReward = isLong ? (take - entry) : (entry - take);
    potentialRewardUsd = size * (priceReward / entry);
    potentialRewardPercent = (potentialRewardUsd / balance) * 100;
    plannedRR = Math.abs(riskUsd) !== 0 ? potentialRewardUsd / Math.abs(riskUsd) : 0;
  }

  // Actual PNL (only if closed)
  let pnlUsd = 0;
  let pnlPercent = 0;
  let actualR = 0;

  if (close) {
    const priceMove = isLong ? (close - entry) : (entry - close);
    pnlUsd = size * (priceMove / entry);
    pnlPercent = (pnlUsd / balance) * 100;
    actualR = Math.abs(riskUsd) !== 0 ? pnlUsd / Math.abs(riskUsd) : 0;
  }

  return {
    risk_usd: Math.abs(riskUsd),
    risk_percent: Math.abs(riskPercent),
    potential_reward_usd: potentialRewardUsd,
    potential_reward_percent: potentialRewardPercent,
    rr_ratio: plannedRR,
    pnl_usd: pnlUsd,
    pnl_percent_of_balance: pnlPercent,
    r_multiple: actualR
  };
};

export default function TradeExpandedDetails({ 
  trade, 
  isOpen,
  onUpdate, 
  onDelete,
  onClosePosition,
  onMoveStopToBE,
  formatDate,
  currentBalance
}) {
  const [editing, setEditing] = useState(false);
  const [editedTrade, setEditedTrade] = useState(trade);
  const [closingPrice, setClosingPrice] = useState('');
  const [showCloseInput, setShowCloseInput] = useState(false);

  const metrics = calculateMetrics(editedTrade, currentBalance);

  const handleSave = () => {
    const calculated = calculateMetrics(editedTrade, currentBalance);
    const updated = {
      ...editedTrade,
      ...calculated,
      original_stop_price: editedTrade.original_stop_price || editedTrade.stop_price
    };
    onUpdate(updated);
    setEditing(false);
  };

  const handleFieldChange = (field, value) => {
    setEditedTrade(prev => ({ ...prev, [field]: value }));
  };

  const handleQuickClose = () => {
    if (!closingPrice || parseFloat(closingPrice) <= 0) return;
    
    const closedTrade = {
      ...trade,
      close_price: parseFloat(closingPrice)
    };
    
    const calculated = calculateMetrics(closedTrade, currentBalance);
    const updated = {
      ...closedTrade,
      ...calculated,
      status: 'closed',
      date_close: new Date().toISOString()
    };
    
    onUpdate(updated);
    setShowCloseInput(false);
    setClosingPrice('');
  };

  return (
    <div className="bg-[#1a1a1a] border-t border-[#2a2a2a] p-4">
      {/* Action Buttons for Open Trades */}
      {isOpen && !editing && !showCloseInput && (
        <div className="flex gap-2 mb-4">
          <Button
            size="sm"
            onClick={(e) => { e.stopPropagation(); setShowCloseInput(true); }}
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

      {/* Quick Close Input */}
      {showCloseInput && (
        <div className="bg-red-500/10 rounded-lg p-3 mb-4">
          <p className="text-red-400 text-xs mb-2 font-medium">Enter Close Price:</p>
          <div className="flex gap-2">
            <Input
              type="number"
              step="any"
              value={closingPrice}
              onChange={(e) => setClosingPrice(e.target.value)}
              placeholder="Close price..."
              className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] h-8 text-sm"
              autoFocus
            />
            <Button size="sm" onClick={handleQuickClose} className="bg-red-500 text-white hover:bg-red-600">
              Close
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCloseInput(false)} className="border-[#2a2a2a]">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {!editing ? (
        <div className="space-y-4">
          {/* Technical Grid */}
          <div className="grid grid-cols-5 gap-2 text-xs">
            <div className="bg-[#151515] rounded p-2">
              <p className="text-[#666] mb-1">Entry</p>
              <p className="text-[#c0c0c0] font-medium">${trade.entry_price?.toFixed(4)}</p>
            </div>
            <div className="bg-[#151515] rounded p-2">
              <p className="text-[#666] mb-1">Stop</p>
              <p className="text-red-400 font-medium">${trade.stop_price?.toFixed(4)}</p>
              <p className="text-red-400/60 text-[10px] mt-0.5">
                ${metrics.risk_usd?.toFixed(0)} • {metrics.risk_percent?.toFixed(1)}%
              </p>
            </div>
            <div className="bg-[#151515] rounded p-2">
              <p className="text-[#666] mb-1">Take</p>
              <p className="text-emerald-400 font-medium">${trade.take_price?.toFixed(4)}</p>
            </div>
            <div className="bg-[#151515] rounded p-2">
              <p className="text-[#666] mb-1">Size</p>
              <p className="text-[#c0c0c0] font-medium">${trade.position_size?.toFixed(0)}</p>
            </div>
            <div className="bg-[#151515] rounded p-2">
              <p className="text-[#666] mb-1">Planned RR</p>
              <p className={cn(
                "font-bold text-base",
                metrics.rr_ratio >= 1.5 ? "text-emerald-400" : "text-amber-400"
              )}>
                {metrics.rr_ratio?.toFixed(1)}
              </p>
            </div>
          </div>

          {/* Results (for closed) */}
          {!isOpen && (
            <div className="grid grid-cols-4 gap-2 text-xs bg-[#151515] rounded p-3">
              <div>
                <p className="text-[#666] mb-1">Close</p>
                <p className="text-[#c0c0c0] font-medium">${trade.close_price?.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-[#666] mb-1">PNL USD</p>
                <p className={cn(
                  "text-base font-bold",
                  metrics.pnl_usd >= 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  {metrics.pnl_usd >= 0 ? '+' : ''}${Math.round(metrics.pnl_usd)}
                </p>
              </div>
              <div>
                <p className="text-[#666] mb-1">PNL %</p>
                <p className={cn(
                  "text-base font-bold",
                  metrics.pnl_percent_of_balance >= 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  {metrics.pnl_percent_of_balance >= 0 ? '+' : ''}{metrics.pnl_percent_of_balance?.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-[#666] mb-1">R Multiple</p>
                <p className={cn(
                  "text-lg font-bold",
                  metrics.r_multiple >= 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  {metrics.r_multiple?.toFixed(1)}R
                </p>
              </div>
            </div>
          )}

          {/* Meta */}
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="bg-[#151515] rounded p-2">
              <p className="text-[#666] mb-1">Balance</p>
              <p className="text-[#c0c0c0]">${(trade.account_balance_at_entry || 0).toFixed(0)}</p>
            </div>
            <div className="bg-[#151515] rounded p-2">
              <p className="text-[#666] mb-1">Timeframe</p>
              <p className="text-purple-400">{trade.timeframe || '—'}</p>
            </div>
            <div className="bg-[#151515] rounded p-2">
              <p className="text-[#666] mb-1">Emotion</p>
              <p className="text-amber-400">{trade.emotional_state || 5}/10</p>
            </div>
            <div className="bg-[#151515] rounded p-2">
              <p className="text-[#666] mb-1">Confidence</p>
              <p className="text-purple-400">{trade.confidence_level || 5}/10</p>
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
              Edit
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

          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              step="any"
              value={editedTrade.close_price || ''}
              onChange={(e) => handleFieldChange('close_price', e.target.value)}
              placeholder="Close Price (leave empty to keep open)"
              className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] h-8 text-xs"
            />
            <Input
              type="number"
              value={editedTrade.account_balance_at_entry}
              onChange={(e) => handleFieldChange('account_balance_at_entry', e.target.value)}
              placeholder="Balance at Entry"
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