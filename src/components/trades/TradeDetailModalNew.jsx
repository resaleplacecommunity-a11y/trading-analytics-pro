import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, TrendingUp, TrendingDown, Trash2, Check, X as XIcon } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function TradeDetailModalNew({ trade, onClose, onSave, onDelete, allStrategies = [] }) {
  const [editedTrade, setEditedTrade] = useState({ ...trade });
  const isLong = editedTrade.direction === 'Long';
  const isProfit = (editedTrade.pnl_usd || 0) >= 0;

  // Auto-recalculate PNL and metrics when fields change
  useEffect(() => {
    const entry = parseFloat(editedTrade.entry_price);
    const stop = parseFloat(editedTrade.stop_price);
    const take = parseFloat(editedTrade.take_price);
    const close = parseFloat(editedTrade.close_price);
    const size = parseFloat(editedTrade.position_size);

    if (entry && stop && size) {
      const stopPercent = isLong ? ((entry - stop) / entry) * 100 : ((stop - entry) / entry) * 100;
      const stopUsd = (stopPercent / 100) * size;
      
      let takePercent = 0, takeUsd = 0, rrRatio = 0;
      if (take) {
        takePercent = isLong ? ((take - entry) / entry) * 100 : ((entry - take) / entry) * 100;
        takeUsd = (takePercent / 100) * size;
        rrRatio = Math.abs(takePercent / stopPercent);
      }

      let pnlPercent = 0, pnlUsd = 0, rMultiple = 0;
      if (close) {
        pnlPercent = isLong ? ((close - entry) / entry) * 100 : ((entry - close) / entry) * 100;
        pnlUsd = (pnlPercent / 100) * size;
        rMultiple = stopPercent !== 0 ? (pnlPercent / stopPercent) : 0;
      }

      setEditedTrade(prev => ({
        ...prev,
        stop_percent: stopPercent,
        stop_usd: stopUsd,
        take_percent: takePercent,
        take_usd: takeUsd,
        rr_ratio: rrRatio,
        pnl_percent: pnlPercent,
        pnl_usd: pnlUsd,
        r_multiple: rMultiple
      }));
    }
  }, [editedTrade.entry_price, editedTrade.stop_price, editedTrade.take_price, editedTrade.close_price, editedTrade.position_size, isLong]);

  const updateField = (field, value) => {
    setEditedTrade(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onSave(editedTrade);
    onClose();
  };

  const calculatePartialPnl = () => {
    if (!editedTrade.partial_close_percent || !editedTrade.partial_close_price) return 0;
    const partialSize = (editedTrade.position_size * editedTrade.partial_close_percent) / 100;
    const priceDiff = isLong 
      ? editedTrade.partial_close_price - editedTrade.entry_price
      : editedTrade.entry_price - editedTrade.partial_close_price;
    return (priceDiff / editedTrade.entry_price) * partialSize;
  };

  const rrRatio = editedTrade.rr_ratio || 0;
  const rrColor = rrRatio >= 1.3 ? 'text-emerald-400' : rrRatio < 1.2 ? 'text-red-400' : 'text-[#c0c0c0]';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a] sticky top-0 bg-[#1a1a1a] z-10">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              isLong ? "bg-emerald-500/20" : "bg-red-500/20"
            )}>
              {isLong ? 
                <TrendingUp className="w-5 h-5 text-emerald-400" /> : 
                <TrendingDown className="w-5 h-5 text-red-400" />
              }
            </div>
            <div>
              <h2 className="text-[#c0c0c0] text-lg font-semibold">{editedTrade.coin}</h2>
              <p className="text-[#666] text-xs">{format(new Date(editedTrade.date), 'dd.MM.yyyy HH:mm')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => onDelete(trade)}>
              <Trash2 className="w-4 h-4 text-red-400" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5 text-[#666]" />
            </Button>
          </div>
        </div>
        
        <div className="p-4 space-y-4">
          {/* PNL Summary */}
          <div className="bg-[#151515] rounded-xl p-4 text-center">
            <p className={cn(
              "text-3xl font-bold",
              isProfit ? "text-emerald-400" : "text-red-400"
            )}>
              {isProfit ? '+' : ''}${(editedTrade.pnl_usd || 0).toFixed(2)}
            </p>
            <p className={cn(
              "text-sm",
              isProfit ? "text-emerald-400/70" : "text-red-400/70"
            )}>
              {isProfit ? '+' : ''}{(editedTrade.pnl_percent_of_balance || editedTrade.pnl_percent || 0).toFixed(2)}% • {editedTrade.r_multiple != null ? `${editedTrade.r_multiple.toFixed(2)}R` : '—'}
            </p>
          </div>

          {/* Trade Details Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#151515] rounded-lg p-3">
              <p className="text-[#666] text-xs mb-1">Entry</p>
              <Input
                type="number"
                step="any"
                value={editedTrade.entry_price || ''}
                onChange={(e) => updateField('entry_price', parseFloat(e.target.value))}
                className="bg-[#1a1a1a] border-[#2a2a2a] text-[#c0c0c0] h-8"
              />
            </div>
            <div className="bg-[#151515] rounded-lg p-3">
              <p className="text-[#666] text-xs mb-1">Close Price</p>
              <Input
                type="number"
                step="any"
                value={editedTrade.close_price || ''}
                onChange={(e) => updateField('close_price', parseFloat(e.target.value))}
                className="bg-[#1a1a1a] border-[#2a2a2a] text-[#c0c0c0] h-8"
              />
            </div>
            <div className="bg-[#151515] rounded-lg p-3">
              <p className="text-[#666] text-xs mb-1">Size</p>
              <Input
                type="number"
                step="any"
                value={editedTrade.position_size || ''}
                onChange={(e) => updateField('position_size', parseFloat(e.target.value))}
                className="bg-[#1a1a1a] border-[#2a2a2a] text-[#c0c0c0] h-8"
              />
            </div>
          </div>

          {/* Stop, Take, RR */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#151515] rounded-lg p-3">
              <p className="text-[#666] text-xs mb-1">Stop</p>
              <Input
                type="number"
                step="any"
                value={editedTrade.stop_price || ''}
                onChange={(e) => updateField('stop_price', parseFloat(e.target.value))}
                className="bg-[#1a1a1a] border-[#2a2a2a] text-red-400 h-8"
              />
            </div>
            <div className="bg-[#151515] rounded-lg p-3">
              <p className="text-[#666] text-xs mb-1">Take</p>
              <Input
                type="number"
                step="any"
                value={editedTrade.take_price || ''}
                onChange={(e) => updateField('take_price', parseFloat(e.target.value))}
                className="bg-[#1a1a1a] border-[#2a2a2a] text-emerald-400 h-8"
              />
            </div>
            <div className="bg-[#151515] rounded-lg p-3 text-center">
              <p className="text-[#666] text-xs">Risk Reward</p>
              <p className={cn("text-xl font-bold", rrColor)}>
                {rrRatio.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Emotion Slider */}
          <div className="bg-[#151515] rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <p className="text-[#888] text-sm">Emotional State</p>
              <p className="text-amber-400 font-medium">{editedTrade.emotional_state || 5}/10</p>
            </div>
            <Slider
              value={[editedTrade.emotional_state || 5]}
              onValueChange={(val) => updateField('emotional_state', val[0])}
              min={1}
              max={10}
              step={1}
              className="w-full"
            />
          </div>

          {/* Confidence Slider */}
          <div className="bg-[#151515] rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <p className="text-[#888] text-sm">Confidence Level</p>
              <p className="text-purple-400 font-medium">{editedTrade.confidence_level || 5}/10</p>
            </div>
            <Slider
              value={[editedTrade.confidence_level || 5]}
              onValueChange={(val) => updateField('confidence_level', val[0])}
              min={1}
              max={10}
              step={1}
              className="w-full"
            />
          </div>

          {/* Rules Button */}
          <Button
            onClick={() => updateField('rule_compliance', !editedTrade.rule_compliance)}
            className={cn(
              "w-full h-12",
              editedTrade.rule_compliance 
                ? "bg-emerald-500 hover:bg-emerald-600 text-white" 
                : "bg-red-500 hover:bg-red-600 text-white"
            )}
          >
            {editedTrade.rule_compliance ? <Check className="w-5 h-5 mr-2" /> : <XIcon className="w-5 h-5 mr-2" />}
            {editedTrade.rule_compliance ? 'Rules Followed' : 'Rules Violated'}
          </Button>

          {/* Strategy */}
          <div>
            <p className="text-[#888] text-sm mb-2">Strategy</p>
            <Select 
              value={editedTrade.strategy_tag || ''} 
              onValueChange={(v) => updateField('strategy_tag', v)}
            >
              <SelectTrigger className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]">
                <SelectValue placeholder="Select or type strategy..." />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
                {allStrategies.map(s => (
                  <SelectItem key={s} value={s} className="text-[#c0c0c0]">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Or type new strategy..."
              value={editedTrade.strategy_tag || ''}
              onChange={(e) => updateField('strategy_tag', e.target.value)}
              className="mt-2 bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]"
            />
          </div>

          {/* Entry Reason */}
          <div>
            <p className="text-[#888] text-sm mb-2">Entry Reason</p>
            <Textarea
              value={editedTrade.entry_reason || ''}
              onChange={(e) => updateField('entry_reason', e.target.value)}
              className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] min-h-[80px]"
              placeholder="Why did you enter this trade?"
            />
          </div>

          {/* Trade Analysis */}
          <div>
            <p className="text-amber-400 text-sm mb-2">Trade Analysis (Post-Close)</p>
            <Textarea
              value={editedTrade.trade_analysis || ''}
              onChange={(e) => updateField('trade_analysis', e.target.value)}
              className="bg-amber-500/10 border-amber-500/30 text-[#c0c0c0] min-h-[80px]"
              placeholder="Post-trade analysis..."
            />
          </div>

          {/* Partial Close */}
          <div className="bg-[#151515] rounded-lg p-4 space-y-3">
            <p className="text-[#888] text-sm font-medium">Partial Position Close</p>
            <div>
              <div className="flex justify-between items-center mb-2">
                <p className="text-[#666] text-xs">Close Percentage</p>
                <p className="text-[#c0c0c0] text-sm">{editedTrade.partial_close_percent || 0}%</p>
              </div>
              <Slider
                value={[editedTrade.partial_close_percent || 0]}
                onValueChange={(val) => updateField('partial_close_percent', val[0])}
                min={0}
                max={100}
                step={5}
                className="w-full"
              />
              {editedTrade.partial_close_percent > 0 && (
                <p className="text-[#666] text-xs mt-1">
                  Closing ${((editedTrade.position_size * editedTrade.partial_close_percent) / 100).toFixed(2)} of position
                </p>
              )}
            </div>
            {editedTrade.partial_close_percent > 0 && (
              <div>
                <p className="text-[#666] text-xs mb-1">Partial Close Price</p>
                <Input
                  type="number"
                  step="any"
                  value={editedTrade.partial_close_price || ''}
                  onChange={(e) => updateField('partial_close_price', parseFloat(e.target.value))}
                  className="bg-[#1a1a1a] border-[#2a2a2a] text-[#c0c0c0]"
                  placeholder="Enter close price..."
                />
                {editedTrade.partial_close_price && (
                  <p className="text-[#666] text-xs mt-1">
                    Partial PNL: ${calculatePartialPnl().toFixed(2)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            className="w-full bg-[#c0c0c0] text-black hover:bg-[#a0a0a0] h-12 font-medium"
          >
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}