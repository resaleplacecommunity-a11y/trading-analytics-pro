import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Zap, TrendingUp, AlertTriangle, Target, Plus, Percent } from 'lucide-react';
import { cn } from "@/lib/utils";
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";

const formatPrice = (price) => {
  if (!price) return '—';
  if (price >= 1) return `$${Math.round(price)}`;
  return `$${price.toFixed(4).replace(/\.?0+$/, '')}`;
};

export default function OpenTradeCard({ trade, onUpdate, onDelete, currentBalance, formatDate }) {
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showPartialModal, setShowPartialModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [closePrice, setClosePrice] = useState('');
  const [closeComment, setCloseComment] = useState('');
  const [partialPercent, setPartialPercent] = useState(50);
  const [partialPrice, setPartialPrice] = useState('');
  const [addPrice, setAddPrice] = useState('');
  const [addSize, setAddSize] = useState('');
  const [localTrade, setLocalTrade] = useState(trade);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);

  const isLong = trade.direction === 'Long';
  const balance = trade.account_balance_at_entry || currentBalance || 100000;

  // Calculate current metrics
  const stopDistance = Math.abs(localTrade.entry_price - localTrade.stop_price);
  const riskUsd = (stopDistance / localTrade.entry_price) * localTrade.position_size;
  const riskPercent = (riskUsd / balance) * 100;

  const takeDistance = Math.abs(localTrade.take_price - localTrade.entry_price);
  const potentialUsd = (takeDistance / localTrade.entry_price) * localTrade.position_size;
  const potentialPercent = (potentialUsd / balance) * 100;

  const rrRatio = riskUsd > 0 ? potentialUsd / riskUsd : 0;

  // Move SL to BE
  const handleMoveToBE = async () => {
    const updated = {
      ...localTrade,
      stop_price: localTrade.entry_price,
      risk_usd: 0,
      risk_percent: 0,
      rr_ratio: 0
    };
    await onUpdate(trade.id, updated);
    setLocalTrade(updated);
    toast.success('Stop moved to breakeven');
  };

  // Hit SL
  const handleHitSL = async () => {
    const closeData = {
      close_price: localTrade.stop_price,
      date_close: new Date().toISOString(),
      status: 'closed',
      actual_duration_minutes: Math.floor((new Date() - new Date(trade.date_open || trade.date)) / 60000)
    };

    const pnlUsd = isLong 
      ? ((localTrade.stop_price - localTrade.entry_price) / localTrade.entry_price) * localTrade.position_size
      : ((localTrade.entry_price - localTrade.stop_price) / localTrade.entry_price) * localTrade.position_size;

    closeData.pnl_usd = pnlUsd;
    closeData.pnl_percent_of_balance = (pnlUsd / balance) * 100;
    closeData.r_multiple = riskUsd > 0 ? pnlUsd / riskUsd : 0;

    await onUpdate(trade.id, closeData);
    toast.success('Position closed at Stop Loss');
  };

  // Hit TP
  const handleHitTP = async () => {
    const closeData = {
      close_price: localTrade.take_price,
      date_close: new Date().toISOString(),
      status: 'closed',
      actual_duration_minutes: Math.floor((new Date() - new Date(trade.date_open || trade.date)) / 60000)
    };

    const pnlUsd = isLong 
      ? ((localTrade.take_price - localTrade.entry_price) / localTrade.entry_price) * localTrade.position_size
      : ((localTrade.entry_price - localTrade.take_price) / localTrade.entry_price) * localTrade.position_size;

    closeData.pnl_usd = pnlUsd;
    closeData.pnl_percent_of_balance = (pnlUsd / balance) * 100;
    closeData.r_multiple = riskUsd > 0 ? pnlUsd / riskUsd : 0;

    await onUpdate(trade.id, closeData);
    toast.success('Position closed at Take Profit');
  };

  // Close at custom price
  const handleClosePosition = async () => {
    const price = parseFloat(closePrice);
    if (!price) return;

    const closeData = {
      close_price: price,
      date_close: new Date().toISOString(),
      status: 'closed',
      actual_duration_minutes: Math.floor((new Date() - new Date(trade.date_open || trade.date)) / 60000),
      trade_analysis: closeComment
    };

    const pnlUsd = isLong 
      ? ((price - localTrade.entry_price) / localTrade.entry_price) * localTrade.position_size
      : ((localTrade.entry_price - price) / localTrade.entry_price) * localTrade.position_size;

    closeData.pnl_usd = pnlUsd;
    closeData.pnl_percent_of_balance = (pnlUsd / balance) * 100;
    closeData.r_multiple = riskUsd > 0 ? pnlUsd / riskUsd : 0;

    await onUpdate(trade.id, closeData);
    setShowCloseModal(false);
    toast.success('Position closed');
  };

  // Partial close
  const handlePartialClose = async () => {
    const price = parseFloat(partialPrice);
    if (!price) return;

    const closedSize = (partialPercent / 100) * localTrade.position_size;
    const remainingSize = localTrade.position_size - closedSize;

    const partialPnl = isLong
      ? ((price - localTrade.entry_price) / localTrade.entry_price) * closedSize
      : ((localTrade.entry_price - price) / localTrade.entry_price) * closedSize;

    const updated = {
      ...localTrade,
      position_size: remainingSize,
      pnl_usd: (localTrade.pnl_usd || 0) + partialPnl,
      partial_close_percent: partialPercent,
      partial_close_price: price
    };

    // Recalculate risk/reward with new size
    const newStopDistance = Math.abs(updated.entry_price - updated.stop_price);
    updated.risk_usd = (newStopDistance / updated.entry_price) * remainingSize;
    updated.risk_percent = (updated.risk_usd / balance) * 100;

    const newTakeDistance = Math.abs(updated.take_price - updated.entry_price);
    const newPotentialUsd = (newTakeDistance / updated.entry_price) * remainingSize;
    updated.rr_ratio = updated.risk_usd > 0 ? newPotentialUsd / updated.risk_usd : 0;

    await onUpdate(trade.id, updated);
    setLocalTrade(updated);
    setShowPartialModal(false);
    toast.success(`Partially closed ${partialPercent}% at ${formatPrice(price)}`);
  };

  // Add to position (averaging)
  const handleAddPosition = async () => {
    const price = parseFloat(addPrice);
    const size = parseFloat(addSize);
    if (!price || !size) return;

    const oldSize = localTrade.position_size;
    const newSize = oldSize + size;
    const newEntry = (localTrade.entry_price * oldSize + price * size) / newSize;

    const updated = {
      ...localTrade,
      entry_price: newEntry,
      position_size: newSize
    };

    // Recalculate risk/reward
    const newStopDistance = Math.abs(newEntry - updated.stop_price);
    updated.risk_usd = (newStopDistance / newEntry) * newSize;
    updated.risk_percent = (updated.risk_usd / balance) * 100;

    const newTakeDistance = Math.abs(updated.take_price - newEntry);
    const newPotentialUsd = (newTakeDistance / newEntry) * newSize;
    updated.rr_ratio = updated.risk_usd > 0 ? newPotentialUsd / updated.risk_usd : 0;

    await onUpdate(trade.id, updated);
    setLocalTrade(updated);
    setShowAddModal(false);
    toast.success(`Added ${formatPrice(size)} at ${formatPrice(price)}`);
  };

  // Generate AI analysis
  const handleGenerateAI = async () => {
    setIsGeneratingAI(true);
    try {
      const prompt = `Analyze this open trading position:
- Coin: ${trade.coin}
- Direction: ${trade.direction}
- Entry: ${trade.entry_price}
- Size: $${trade.position_size}
- Stop: ${trade.stop_price} (Risk: $${riskUsd.toFixed(0)} / ${riskPercent.toFixed(1)}%)
- Take: ${trade.take_price} (Potential: $${potentialUsd.toFixed(0)} / ${potentialPercent.toFixed(1)}%)
- RR Ratio: 1:${rrRatio.toFixed(1)}
- Strategy: ${trade.strategy_tag || 'Not specified'}
- Timeframe: ${trade.timeframe || 'Not specified'}
- Market Context: ${trade.market_context || 'Not specified'}
- Entry Reason: ${trade.entry_reason || 'Not specified'}

Provide a concise analysis (3-4 sentences):
1. What's good about this trade
2. Key risks or weaknesses
3. One actionable tip for improvement

Keep it brief and practical.`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            score: { type: "number", description: "Score from 1-10" },
            strengths: { type: "string" },
            risks: { type: "string" },
            tip: { type: "string" }
          }
        }
      });

      setAiAnalysis(response);
      await onUpdate(trade.id, { ai_score: response.score });
    } catch (error) {
      toast.error('Failed to generate AI analysis');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  return (
    <div className="bg-[#0d0d0d] border-t border-[#2a2a2a] p-4">
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-[#2a2a2a]">
        <Button size="sm" variant="outline" onClick={handleMoveToBE} className="bg-[#1a1a1a] border-[#333] hover:bg-[#252525] text-xs">
          <Target className="w-3 h-3 mr-1" /> Move SL → BE
        </Button>
        <Button size="sm" variant="outline" onClick={handleHitSL} className="bg-red-500/10 border-red-500/30 hover:bg-red-500/20 text-red-400 text-xs">
          <AlertTriangle className="w-3 h-3 mr-1" /> Hit SL
        </Button>
        <Button size="sm" variant="outline" onClick={handleHitTP} className="bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 text-xs">
          <TrendingUp className="w-3 h-3 mr-1" /> Hit TP
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowCloseModal(true)} className="bg-[#1a1a1a] border-[#333] hover:bg-[#252525] text-xs">
          Close Position
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowPartialModal(true)} className="bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20 text-amber-400 text-xs">
          <Percent className="w-3 h-3 mr-1" /> Partial Close
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowAddModal(true)} className="bg-[#1a1a1a] border-[#333] hover:bg-[#252525] text-xs">
          <Plus className="w-3 h-3 mr-1" /> Add
        </Button>
      </div>

      {/* Main Content - Two Columns */}
      <div className="grid grid-cols-2 gap-6">
        {/* LEFT: Technical Parameters */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#151515] border border-[#2a2a2a] rounded-lg p-2">
              <div className="text-[10px] text-[#666] mb-0.5">Entry</div>
              <div className="text-sm font-bold text-[#c0c0c0]">{formatPrice(localTrade.entry_price)}</div>
            </div>
            <div className="bg-[#151515] border border-[#2a2a2a] rounded-lg p-2 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full bg-[#2a2a2a] flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-[#888] animate-pulse" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#151515] border border-[#2a2a2a] rounded-lg p-2">
              <div className="text-[10px] text-[#666] mb-0.5">Size</div>
              <div className="text-sm font-bold text-[#c0c0c0]">${Math.round(localTrade.position_size)}</div>
            </div>
            <div className="bg-[#151515] border border-[#2a2a2a] rounded-lg p-2">
              <div className="text-[10px] text-[#666] mb-0.5">St. Balance</div>
              <div className="text-sm font-bold text-[#c0c0c0]">${Math.round(balance)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#151515] border border-red-500/20 rounded-lg p-2">
              <div className="text-[10px] text-[#666] mb-0.5">Stop</div>
              <div className="text-sm font-bold text-red-400">{formatPrice(localTrade.stop_price)}</div>
              <div className="text-[9px] text-red-400/70">${Math.round(riskUsd)} • {riskPercent.toFixed(1)}%</div>
            </div>
            <div className="bg-[#151515] border border-emerald-500/20 rounded-lg p-2">
              <div className="text-[10px] text-[#666] mb-0.5">Take</div>
              <div className="text-sm font-bold text-emerald-400">{formatPrice(localTrade.take_price)}</div>
              <div className="text-[9px] text-emerald-400/70">${Math.round(potentialUsd)} • {potentialPercent.toFixed(1)}%</div>
            </div>
          </div>

          <div className="bg-[#151515] border border-[#2a2a2a] rounded-lg p-3">
            <div className="text-[10px] text-[#666] mb-2">Confidence</div>
            <Slider
              value={[localTrade.confidence_level || 5]}
              onValueChange={([val]) => {
                setLocalTrade({...localTrade, confidence_level: val});
                onUpdate(trade.id, { confidence_level: val });
              }}
              min={1}
              max={10}
              step={1}
              className="mb-1"
            />
            <div className="flex justify-between text-[9px] text-[#666]">
              <span>1</span>
              <span className="text-[#c0c0c0] font-bold">{localTrade.confidence_level || 5}</span>
              <span>10</span>
            </div>
          </div>
        </div>

        {/* RIGHT: Analytics */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-[#666]">Strategy</Label>
              <Select 
                value={localTrade.strategy_tag || ''} 
                onValueChange={(val) => {
                  setLocalTrade({...localTrade, strategy_tag: val});
                  onUpdate(trade.id, { strategy_tag: val });
                }}
              >
                <SelectTrigger className="h-8 text-xs bg-[#151515] border-[#2a2a2a]">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Breakout">Breakout</SelectItem>
                  <SelectItem value="Pullback">Pullback</SelectItem>
                  <SelectItem value="Range">Range</SelectItem>
                  <SelectItem value="Trend">Trend</SelectItem>
                  <SelectItem value="Scalp">Scalp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] text-[#666]">Timeframe</Label>
              <Select 
                value={localTrade.timeframe || ''} 
                onValueChange={(val) => {
                  setLocalTrade({...localTrade, timeframe: val});
                  onUpdate(trade.id, { timeframe: val });
                }}
              >
                <SelectTrigger className="h-8 text-xs bg-[#151515] border-[#2a2a2a]">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scalp">Scalp</SelectItem>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="swing">Swing</SelectItem>
                  <SelectItem value="mid_term">Mid-term</SelectItem>
                  <SelectItem value="long_term">Long-term</SelectItem>
                  <SelectItem value="spot">Spot</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-[10px] text-[#666] mb-1 block">Reason for Entry</Label>
            <Textarea
              value={localTrade.entry_reason || ''}
              onChange={(e) => setLocalTrade({...localTrade, entry_reason: e.target.value})}
              onBlur={() => onUpdate(trade.id, { entry_reason: localTrade.entry_reason })}
              placeholder="Why did you enter this trade?"
              className="h-16 text-xs bg-[#151515] border-[#2a2a2a] resize-none"
            />
          </div>

          <div>
            <Label className="text-[10px] text-[#666] mb-1 block">Market Context</Label>
            <Select 
              value={localTrade.market_context || ''} 
              onValueChange={(val) => {
                setLocalTrade({...localTrade, market_context: val});
                onUpdate(trade.id, { market_context: val });
              }}
            >
              <SelectTrigger className="h-8 text-xs bg-[#151515] border-[#2a2a2a]">
                <SelectValue placeholder="Bullish / Bearish" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Bullish">Bullish</SelectItem>
                <SelectItem value="Bearish">Bearish</SelectItem>
                <SelectItem value="Neutral">Neutral</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border border-[#2a2a2a] rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px] text-[#666]">AI Score</span>
              </div>
              {localTrade.ai_score ? (
                <span className={cn(
                  "text-sm font-bold",
                  localTrade.ai_score >= 7 ? "text-emerald-400" : localTrade.ai_score >= 5 ? "text-amber-400" : "text-red-400"
                )}>
                  {localTrade.ai_score}/10
                </span>
              ) : (
                <Button size="sm" variant="ghost" onClick={handleGenerateAI} disabled={isGeneratingAI} className="h-6 text-xs">
                  {isGeneratingAI ? 'Analyzing...' : 'Generate'}
                </Button>
              )}
            </div>
            {aiAnalysis && (
              <div className="space-y-1.5 text-xs">
                <div>
                  <span className="text-emerald-400">✓ </span>
                  <span className="text-[#888]">{aiAnalysis.strengths}</span>
                </div>
                <div>
                  <span className="text-amber-400">⚠ </span>
                  <span className="text-[#888]">{aiAnalysis.risks}</span>
                </div>
                <div>
                  <span className="text-blue-400">💡 </span>
                  <span className="text-[#888]">{aiAnalysis.tip}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <Dialog open={showCloseModal} onOpenChange={setShowCloseModal}>
        <DialogContent className="bg-[#1a1a1a] border-[#333]">
          <DialogHeader>
            <DialogTitle className="text-[#c0c0c0]">Close Position</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-[#888]">Close Price</Label>
              <Input
                type="number"
                value={closePrice}
                onChange={(e) => setClosePrice(e.target.value)}
                placeholder="Enter close price"
                className="bg-[#151515] border-[#2a2a2a]"
              />
            </div>
            <div>
              <Label className="text-xs text-[#888]">Comment (optional)</Label>
              <Textarea
                value={closeComment}
                onChange={(e) => setCloseComment(e.target.value)}
                placeholder="Why did you close?"
                className="bg-[#151515] border-[#2a2a2a] h-16 resize-none"
              />
            </div>
            <Button onClick={handleClosePosition} className="w-full">Confirm Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPartialModal} onOpenChange={setShowPartialModal}>
        <DialogContent className="bg-[#1a1a1a] border-[#333]">
          <DialogHeader>
            <DialogTitle className="text-[#c0c0c0]">Partial Close</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-[#888] mb-2 block">Close {partialPercent}% of position</Label>
              <Slider
                value={[partialPercent]}
                onValueChange={([val]) => setPartialPercent(val)}
                min={1}
                max={100}
                step={1}
              />
              <div className="flex justify-between text-[9px] text-[#666] mt-1">
                <span>1%</span>
                <span className="text-[#c0c0c0]">{partialPercent}%</span>
                <span>100%</span>
              </div>
            </div>
            <div>
              <Label className="text-xs text-[#888]">Close Price</Label>
              <Input
                type="number"
                value={partialPrice}
                onChange={(e) => setPartialPrice(e.target.value)}
                placeholder="Enter close price"
                className="bg-[#151515] border-[#2a2a2a]"
              />
            </div>
            <Button onClick={handlePartialClose} className="w-full">Confirm Partial Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="bg-[#1a1a1a] border-[#333]">
          <DialogHeader>
            <DialogTitle className="text-[#c0c0c0]">Add to Position</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-[#888]">Entry Price</Label>
              <Input
                type="number"
                value={addPrice}
                onChange={(e) => setAddPrice(e.target.value)}
                placeholder="New entry price"
                className="bg-[#151515] border-[#2a2a2a]"
              />
            </div>
            <div>
              <Label className="text-xs text-[#888]">Position Size ($)</Label>
              <Input
                type="number"
                value={addSize}
                onChange={(e) => setAddSize(e.target.value)}
                placeholder="Additional size"
                className="bg-[#151515] border-[#2a2a2a]"
              />
            </div>
            <Button onClick={handleAddPosition} className="w-full">Confirm Add</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}