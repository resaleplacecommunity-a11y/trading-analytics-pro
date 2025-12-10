import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { XCircle, MoveRight, Save, Trash2, Edit2, Check } from 'lucide-react';
import { cn } from "@/lib/utils";

// Format price based on value
const formatPrice = (price) => {
  if (!price) return '—';
  if (price >= 1) return `$${Math.round(price)}`;
  return `$${parseFloat(price).toFixed(4).replace(/\.?0+$/, '')}`;
};

// Calculate all metrics from scratch with CORRECT formulas
const calculateMetrics = (trade, currentBalance) => {
  const isLong = trade.direction === 'Long';
  const entry = parseFloat(trade.entry_price) || 0;
  const stop = parseFloat(trade.stop_price) || 0;
  const originalStop = parseFloat(trade.original_stop_price) || stop;
  const take = parseFloat(trade.take_price) || 0;
  const size = parseFloat(trade.position_size) || 0;
  const close = parseFloat(trade.close_price) || 0;
  const balance = parseFloat(trade.account_balance_at_entry) || currentBalance || 100000;

  if (!entry || !size) return {};

  // Risk calculation from BALANCE
  let riskUsd = 0;
  let riskPercent = 0;
  let plannedRR = 0;
  
  if (stop) {
    const stopDistance = Math.abs(entry - stop);
    riskUsd = (stopDistance / entry) * size;
    riskPercent = (riskUsd / balance) * 100;
    
    // Planned RR based on current stop
    if (take) {
      const takeDistance = Math.abs(take - entry);
      plannedRR = (takeDistance / entry) * size / riskUsd;
    }
  }

  // Actual R (for closed trades) - use ORIGINAL stop
  let actualR = 0;
  let pnlUsd = 0;
  let pnlPercent = 0;

  if (close) {
    const priceMove = isLong ? (close - entry) : (entry - close);
    pnlUsd = (priceMove / entry) * size;
    pnlPercent = (pnlUsd / balance) * 100;
    
    // R uses ORIGINAL stop (before BE move)
    if (originalStop) {
      const originalStopDistance = Math.abs(entry - originalStop);
      const originalRiskUsd = (originalStopDistance / entry) * size;
      actualR = originalRiskUsd !== 0 ? pnlUsd / originalRiskUsd : 0;
    }
  }

  return {
    risk_usd: riskUsd,
    risk_percent: riskPercent,
    rr_ratio: plannedRR,
    pnl_usd: pnlUsd,
    pnl_percent_of_balance: pnlPercent,
    r_multiple: actualR,
    status: close ? 'closed' : 'open'
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
  const [liveTimer, setLiveTimer] = useState(0);

  // Update editedTrade when trade changes
  useEffect(() => {
    setEditedTrade(trade);
  }, [trade]);

  // Live timer for open trades
  useEffect(() => {
    if (!isOpen) return;
    const updateTimer = () => {
      const openTime = new Date(trade.date_open || trade.date);
      const now = new Date();
      const diff = Math.floor((now - openTime) / 1000);
      setLiveTimer(diff);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isOpen, trade.date_open, trade.date]);

  const formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const metrics = calculateMetrics(editing ? editedTrade : trade, currentBalance);

  const handleSave = () => {
    const calculated = calculateMetrics(editedTrade, currentBalance);
    
    // Calculate duration for closed trades
    let actualDuration = 0;
    if (editedTrade.close_price && editedTrade.date_open) {
      const openTime = new Date(editedTrade.date_open || editedTrade.date);
      const closeTime = editedTrade.date_close ? new Date(editedTrade.date_close) : new Date();
      actualDuration = Math.floor((closeTime - openTime) / 60000); // minutes
    }
    
    const updated = {
      ...editedTrade,
      ...calculated,
      original_stop_price: editedTrade.original_stop_price || trade.original_stop_price || editedTrade.stop_price,
      actual_duration_minutes: actualDuration
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
      close_price: parseFloat(closingPrice),
      date_close: new Date().toISOString()
    };
    
    const calculated = calculateMetrics(closedTrade, currentBalance);
    
    // Calculate duration
    const openTime = new Date(trade.date_open || trade.date);
    const closeTime = new Date();
    const actualDuration = Math.floor((closeTime - openTime) / 60000);
    
    const updated = {
      ...closedTrade,
      ...calculated,
      status: 'closed',
      actual_duration_minutes: actualDuration
    };
    
    onUpdate(updated);
    setShowCloseInput(false);
    setClosingPrice('');
  };

  const handleMoveStopToBE = () => {
    const updated = {
      ...trade,
      original_stop_price: trade.original_stop_price || trade.stop_price,
      stop_price: trade.entry_price
    };
    const calculated = calculateMetrics(updated, currentBalance);
    onUpdate({ ...updated, ...calculated });
  };

  return (
    <div className="bg-[#1a1a1a] border-t border-[#2a2a2a] px-4 py-3">
      {/* Action Buttons for Open Trades */}
      {isOpen && !editing && !showCloseInput && (
        <div className="flex gap-2 mb-3">
          <Button
            size="sm"
            onClick={(e) => { e.stopPropagation(); setShowCloseInput(true); }}
            className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border-0 h-7 text-xs"
          >
            <XCircle className="w-3 h-3 mr-1" />
            Close Position
          </Button>
          <Button
            size="sm"
            onClick={(e) => { e.stopPropagation(); handleMoveStopToBE(); }}
            className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border-0 h-7 text-xs"
          >
            <MoveRight className="w-3 h-3 mr-1" />
            Move SL → BE
          </Button>
          <Button
            size="sm"
            onClick={() => setEditing(true)}
            className="bg-[#2a2a2a] text-[#c0c0c0] hover:bg-[#333] border-0 h-7 text-xs ml-auto"
          >
            <Edit2 className="w-3 h-3 mr-1" />
            Edit
          </Button>
        </div>
      )}

      {/* Quick Close Input */}
      {showCloseInput && (
        <div className="bg-red-500/10 rounded-lg p-2.5 mb-3 border border-red-500/30">
          <p className="text-red-400 text-xs mb-2 font-medium">Close Position</p>
          <div className="flex gap-2">
            <Input
              type="number"
              step="any"
              value={closingPrice}
              onChange={(e) => setClosingPrice(e.target.value)}
              placeholder="Enter close price..."
              className="bg-[#151515] border-[#2a2a2a] text-white h-7 text-xs"
              autoFocus
            />
            <Button size="sm" onClick={handleQuickClose} className="bg-red-500 text-white hover:bg-red-600 h-7 px-3 text-xs">
              Confirm
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowCloseInput(false)} className="h-7 px-2 text-xs text-[#888]">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {!editing ? (
        <div className="space-y-2.5">
          {/* Core Technical Data - Compact Grid */}
          <div className="grid grid-cols-6 gap-1.5 text-[10px]">
            <div className="bg-[#151515] rounded px-2 py-1.5 border border-[#222]">
              <p className="text-[#666] mb-0.5">Entry</p>
              <p className="text-[#c0c0c0] font-semibold text-xs">{formatPrice(trade.entry_price)}</p>
            </div>
            <div className="bg-[#151515] rounded px-2 py-1.5 border border-red-500/20">
              <p className="text-[#666] mb-0.5">Stop</p>
              <p className="text-red-400 font-semibold text-xs">{formatPrice(trade.stop_price)}</p>
            </div>
            <div className="bg-[#151515] rounded px-2 py-1.5 border border-emerald-500/20">
              <p className="text-[#666] mb-0.5">Take</p>
              <p className="text-emerald-400 font-semibold text-xs">{formatPrice(trade.take_price)}</p>
            </div>
            <div className="bg-[#151515] rounded px-2 py-1.5 border border-[#222]">
              <p className="text-[#666] mb-0.5">Size</p>
              <p className="text-[#c0c0c0] font-semibold text-xs">${Math.round(trade.position_size)}</p>
            </div>
            <div className="bg-[#151515] rounded px-2 py-1.5 border border-[#222]">
              <p className="text-[#666] mb-0.5">Balance</p>
              <p className="text-[#888] font-semibold text-xs">${Math.round(trade.account_balance_at_entry || currentBalance)}</p>
            </div>
            <div className="bg-[#151515] rounded px-2 py-1.5 border border-[#222]">
              <p className="text-[#666] mb-0.5">Duration</p>
              <p className="text-amber-400 font-mono text-xs">
                {isOpen ? formatDuration(liveTimer) : trade.actual_duration_minutes ? `${Math.floor(trade.actual_duration_minutes / 60)}h ${trade.actual_duration_minutes % 60}m` : '—'}
              </p>
            </div>
          </div>

          {/* Risk & RR for OPEN trades */}
          {isOpen && (
            <div className="bg-gradient-to-br from-red-500/10 to-amber-500/10 rounded-lg p-2.5 border border-red-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-red-400/70 mb-1">Risk</p>
                  <p className="text-red-400 font-bold text-sm">
                    ${Math.round(metrics.risk_usd)} <span className="text-red-400/70 text-[10px]">• {metrics.risk_percent?.toFixed(1)}%</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-[#666] mb-1">Planned RR</p>
                  <p className={cn(
                    "font-bold text-lg",
                    metrics.rr_ratio >= 1.5 ? "text-emerald-400" : "text-amber-400"
                  )}>
                    1:{metrics.rr_ratio?.toFixed(1)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Results for CLOSED trades */}
          {!isOpen && (
            <div className="bg-gradient-to-br from-emerald-500/10 to-blue-500/10 rounded-lg p-2.5 border border-emerald-500/20">
              <div className="grid grid-cols-4 gap-2 text-[10px]">
                <div>
                  <p className="text-[#666] mb-1">Close</p>
                  <p className="text-[#c0c0c0] font-semibold text-xs">{formatPrice(trade.close_price)}</p>
                </div>
                <div>
                  <p className="text-[#666] mb-1">PNL $</p>
                  <p className={cn(
                    "text-sm font-bold",
                    metrics.pnl_usd >= 0 ? "text-emerald-400" : "text-red-400"
                  )}>
                    {metrics.pnl_usd >= 0 ? '+' : ''}${Math.round(metrics.pnl_usd)}
                  </p>
                </div>
                <div>
                  <p className="text-[#666] mb-1">PNL %</p>
                  <p className={cn(
                    "text-sm font-bold",
                    metrics.pnl_percent_of_balance >= 0 ? "text-emerald-400" : "text-red-400"
                  )}>
                    {metrics.pnl_percent_of_balance >= 0 ? '+' : ''}{metrics.pnl_percent_of_balance?.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-[#666] mb-1">R Multiple</p>
                  <p className={cn(
                    "text-base font-bold",
                    metrics.r_multiple >= 0 ? "text-emerald-400" : "text-red-400"
                  )}>
                    {metrics.r_multiple?.toFixed(1)}R
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Psychology & Strategy */}
          <div className="grid grid-cols-4 gap-1.5 text-[10px]">
            <div className="bg-[#151515] rounded px-2 py-1.5">
              <p className="text-[#666] mb-0.5">Strategy</p>
              <p className="text-purple-400 font-medium text-xs">{trade.strategy_tag || '—'}</p>
            </div>
            <div className="bg-[#151515] rounded px-2 py-1.5">
              <p className="text-[#666] mb-0.5">Timeframe</p>
              <p className="text-blue-400 font-medium text-xs">{trade.timeframe || '—'}</p>
            </div>
            <div className="bg-[#151515] rounded px-2 py-1.5">
              <p className="text-[#666] mb-0.5">Emotion</p>
              <p className="text-amber-400 font-medium text-xs">{trade.emotional_state || 5}/10</p>
            </div>
            <div className="bg-[#151515] rounded px-2 py-1.5">
              <p className="text-[#666] mb-0.5">Confidence</p>
              <p className="text-purple-400 font-medium text-xs">{trade.confidence_level || 5}/10</p>
            </div>
          </div>

          {/* Notes */}
          {(trade.entry_reason || trade.trade_analysis) && (
            <div className="space-y-1.5">
              {trade.entry_reason && (
                <div className="bg-[#151515] rounded p-2 text-[10px] border border-[#222]">
                  <p className="text-[#666] mb-1 font-medium">Entry Reason</p>
                  <p className="text-[#c0c0c0] leading-relaxed">{trade.entry_reason}</p>
                </div>
              )}
              {trade.trade_analysis && (
                <div className="bg-amber-500/10 rounded p-2 text-[10px] border border-amber-500/30">
                  <p className="text-amber-400 mb-1 font-medium">Analysis</p>
                  <p className="text-[#c0c0c0] leading-relaxed">{trade.trade_analysis}</p>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          {!showCloseInput && !isOpen && (
            <div className="flex gap-2 pt-1.5 border-t border-[#2a2a2a]">
              <Button
                size="sm"
                onClick={() => setEditing(true)}
                className="bg-[#2a2a2a] text-[#c0c0c0] hover:bg-[#333] h-6 text-xs px-2"
              >
                <Edit2 className="w-3 h-3 mr-1" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(trade)}
                className="text-red-400/70 hover:text-red-400 hover:bg-red-500/10 h-6 text-xs px-2"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Delete
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* Edit Mode - Compact */
        <div className="space-y-2.5">
          {/* Prices */}
          <div className="grid grid-cols-4 gap-1.5">
            <div>
              <label className="text-[9px] text-[#666] uppercase mb-1 block">Entry</label>
              <Input
                type="number"
                step="any"
                value={editedTrade.entry_price}
                onChange={(e) => handleFieldChange('entry_price', e.target.value)}
                className="bg-[#151515] border-[#2a2a2a] text-white h-7 text-xs"
              />
            </div>
            <div>
              <label className="text-[9px] text-[#666] uppercase mb-1 block">Stop</label>
              <Input
                type="number"
                step="any"
                value={editedTrade.stop_price}
                onChange={(e) => handleFieldChange('stop_price', e.target.value)}
                className="bg-[#151515] border-[#2a2a2a] text-white h-7 text-xs"
              />
            </div>
            <div>
              <label className="text-[9px] text-[#666] uppercase mb-1 block">Take</label>
              <Input
                type="number"
                step="any"
                value={editedTrade.take_price}
                onChange={(e) => handleFieldChange('take_price', e.target.value)}
                className="bg-[#151515] border-[#2a2a2a] text-white h-7 text-xs"
              />
            </div>
            <div>
              <label className="text-[9px] text-[#666] uppercase mb-1 block">Size $</label>
              <Input
                type="number"
                value={editedTrade.position_size}
                onChange={(e) => handleFieldChange('position_size', e.target.value)}
                className="bg-[#151515] border-[#2a2a2a] text-white h-7 text-xs"
              />
            </div>
          </div>

          {/* Close & Balance */}
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="text-[9px] text-[#666] uppercase mb-1 block">Close Price</label>
              <Input
                type="number"
                step="any"
                value={editedTrade.close_price || ''}
                onChange={(e) => handleFieldChange('close_price', e.target.value)}
                placeholder="Leave empty for open"
                className="bg-[#151515] border-[#2a2a2a] text-white h-7 text-xs"
              />
            </div>
            <div>
              <label className="text-[9px] text-[#666] uppercase mb-1 block">Balance at Entry</label>
              <Input
                type="number"
                value={editedTrade.account_balance_at_entry}
                onChange={(e) => handleFieldChange('account_balance_at_entry', e.target.value)}
                className="bg-[#151515] border-[#2a2a2a] text-white h-7 text-xs"
              />
            </div>
          </div>

          {/* Strategy & Timeframe */}
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="text-[9px] text-[#666] uppercase mb-1 block">Strategy</label>
              <Input
                value={editedTrade.strategy_tag || ''}
                onChange={(e) => handleFieldChange('strategy_tag', e.target.value)}
                placeholder="e.g., Breakout, Reversal"
                className="bg-[#151515] border-[#2a2a2a] text-white h-7 text-xs"
              />
            </div>
            <div>
              <label className="text-[9px] text-[#666] uppercase mb-1 block">Timeframe</label>
              <Select value={editedTrade.timeframe || 'scalp'} onValueChange={(v) => handleFieldChange('timeframe', v)}>
                <SelectTrigger className="bg-[#151515] border-[#2a2a2a] text-white h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-[#333]">
                  <SelectItem value="scalp">Scalp</SelectItem>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="swing">Swing</SelectItem>
                  <SelectItem value="mid_term">Mid Term</SelectItem>
                  <SelectItem value="long_term">Long Term</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Psychology */}
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-[9px] text-[#666] uppercase">Emotion</label>
                <span className="text-amber-400 text-[10px] font-bold">{editedTrade.emotional_state || 5}/10</span>
              </div>
              <Slider
                value={[editedTrade.emotional_state || 5]}
                onValueChange={([v]) => handleFieldChange('emotional_state', v)}
                max={10}
                min={1}
                step={1}
                className="py-1"
              />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-[9px] text-[#666] uppercase">Confidence</label>
                <span className="text-purple-400 text-[10px] font-bold">{editedTrade.confidence_level || 5}/10</span>
              </div>
              <Slider
                value={[editedTrade.confidence_level || 5]}
                onValueChange={([v]) => handleFieldChange('confidence_level', v)}
                max={10}
                min={1}
                step={1}
                className="py-1"
              />
            </div>
          </div>

          {/* Analysis */}
          <div>
            <label className="text-[9px] text-[#666] uppercase mb-1 block">Analysis</label>
            <Textarea
              value={editedTrade.trade_analysis || ''}
              onChange={(e) => handleFieldChange('trade_analysis', e.target.value)}
              placeholder="What did you learn? What could be improved?"
              className="bg-[#151515] border-[#2a2a2a] text-white text-xs min-h-[50px]"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleSave} className="bg-emerald-500 text-white hover:bg-emerald-600 h-7 text-xs px-3">
              <Check className="w-3 h-3 mr-1" />
              Save
            </Button>
            <Button 
              size="sm" 
              variant="ghost"
              onClick={() => { setEditedTrade(trade); setEditing(false); }}
              className="h-7 text-xs px-3 text-[#888] hover:text-[#c0c0c0]"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}