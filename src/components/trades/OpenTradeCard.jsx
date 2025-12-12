import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Zap, TrendingUp, AlertTriangle, Target, Plus, Percent, Clock, Edit2, Trash2 } from 'lucide-react';
import { cn } from "@/lib/utils";
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";
import { useQuery } from '@tanstack/react-query';

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
  const [liveTimer, setLiveTimer] = useState(0);
  const [editingConfidence, setEditingConfidence] = useState(!trade.confidence_level);
  const [strategyInput, setStrategyInput] = useState(trade.strategy_tag || '');

  const { data: allTrades } = useQuery({
    queryKey: ['trades'],
    queryFn: () => base44.entities.Trade.list(),
  });

  const isLong = trade.direction === 'Long';
  const balance = trade.account_balance_at_entry || currentBalance || 100000;

  // Live timer
  useEffect(() => {
    const updateTimer = () => {
      const openTime = new Date(trade.date_open || trade.date);
      const now = new Date();
      const diff = Math.floor((now - openTime) / 1000);
      setLiveTimer(diff);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [trade.date_open, trade.date]);

  const formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // Get unique strategies
  const usedStrategies = [...new Set((allTrades || []).map(t => t.strategy_tag).filter(Boolean))];

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

  const confidenceColor = (val) => {
    if (val >= 8) return 'text-emerald-400 bg-emerald-500/20';
    if (val >= 6) return 'text-amber-400 bg-amber-500/20';
    return 'text-red-400 bg-red-500/20';
  };

  return (
    <div className="bg-[#0d0d0d] p-4 relative overflow-hidden">
      {/* Rounded separator line */}
      <div className="absolute top-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-[#c0c0c0]/30 to-transparent rounded-full" />
      {/* Background Design - Cyberpunk Grid */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Radial gradients */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-radial from-[#c0c0c0]/10 via-transparent to-transparent blur-2xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-radial from-[#888]/10 via-transparent to-transparent blur-2xl" />
        
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `
            linear-gradient(to right, #c0c0c0 1px, transparent 1px),
            linear-gradient(to bottom, #c0c0c0 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }} />
        
        {/* Diagonal lines */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 35px,
            #c0c0c0 35px,
            #c0c0c0 36px
          )`
        }} />
        
        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-32 h-32 border-l-2 border-t-2 border-[#c0c0c0]/10" />
        <div className="absolute bottom-0 right-0 w-32 h-32 border-r-2 border-b-2 border-[#c0c0c0]/10" />
        
        {/* Floating geometric shapes */}
        <div className="absolute top-1/4 right-1/4 w-2 h-2 bg-[#c0c0c0]/20 rotate-45 blur-[1px]" />
        <div className="absolute bottom-1/3 left-1/3 w-3 h-3 border border-[#c0c0c0]/15 rotate-12" />
        <div className="absolute top-2/3 right-1/3 w-1.5 h-1.5 bg-[#888]/20 rounded-full blur-[0.5px]" />
      </div>
      {/* Edit & Delete - Top Right */}
      <div className="absolute top-2 right-2 flex gap-1 z-10">
        <Button size="sm" variant="ghost" onClick={() => {}} className="h-6 w-6 p-0 hover:bg-[#2a2a2a]">
          <Edit2 className="w-3 h-3 text-[#888] hover:text-[#c0c0c0]" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onDelete(trade)} className="h-6 w-6 p-0 hover:bg-red-500/20">
          <Trash2 className="w-3 h-3 text-red-400/70 hover:text-red-400" />
        </Button>
      </div>

      {/* Main Content - Two Columns */}
      <div className="grid grid-cols-2 gap-6 relative mt-4">
        {/* LEFT: Technical Parameters */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#151515] border border-[#2a2a2a] rounded-lg p-2">
            <div className="text-[10px] text-[#666] mb-0.5 text-center">Entry</div>
            <div className="text-sm font-bold text-[#c0c0c0] text-center">{formatPrice(localTrade.entry_price)}</div>
          </div>
          <div className="bg-[#151515] border border-[#2a2a2a] rounded-lg p-2 flex flex-col items-center justify-center">
            <div className="text-[10px] text-[#666] mb-1 text-center">Close</div>
            <div className="w-8 h-8 rounded-full bg-[#2a2a2a] flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
            </div>
          </div>

          <div className="bg-[#151515] border border-[#2a2a2a] rounded-lg p-2">
            <div className="text-[10px] text-[#666] mb-0.5 text-center">Size</div>
            <div className="text-sm font-bold text-[#c0c0c0] text-center">${Math.round(localTrade.position_size)}</div>
          </div>
          <div className="bg-[#151515] border border-[#2a2a2a] rounded-lg p-2">
            <div className="text-[10px] text-[#666] mb-0.5 text-center">St. Balance</div>
            <div className="text-sm font-bold text-[#c0c0c0] text-center">${Math.round(balance)}</div>
          </div>

          <div className="bg-[#151515] border border-red-500/20 rounded-lg p-2">
            <div className="text-[10px] text-[#666] mb-0.5 text-center">Stop</div>
            <div className="text-sm font-bold text-red-400 text-center">{formatPrice(localTrade.stop_price)}</div>
            <div className="text-[9px] text-red-400/70 text-center">${Math.round(riskUsd)} • {riskPercent.toFixed(1)}%</div>
          </div>
          <div className="bg-[#151515] border border-emerald-500/20 rounded-lg p-2">
            <div className="text-[10px] text-[#666] mb-0.5 text-center">Take</div>
            <div className="text-sm font-bold text-emerald-400 text-center">{formatPrice(localTrade.take_price)}</div>
            <div className="text-[9px] text-emerald-400/70 text-center">${Math.round(potentialUsd)} • {potentialPercent.toFixed(1)}%</div>
          </div>

          <div className="bg-[#151515] border border-[#2a2a2a] rounded-lg p-2.5 col-span-2">
            <div className="text-[10px] text-[#666] mb-2 text-center">Confidence</div>
            {editingConfidence ? (
              <div className="px-2">
                <Slider
                  value={[localTrade.confidence_level || 5]}
                  onValueChange={([val]) => {
                    setLocalTrade({...localTrade, confidence_level: val});
                  }}
                  onValueCommit={([val]) => {
                    onUpdate(trade.id, { confidence_level: val });
                    setEditingConfidence(false);
                  }}
                  min={1}
                  max={10}
                  step={1}
                  className="mb-2"
                />
                <div className="flex justify-between text-[9px] text-[#666]">
                  <span>1</span>
                  <span className="text-[#c0c0c0] font-bold">{localTrade.confidence_level || 5}</span>
                  <span>10</span>
                </div>
              </div>
            ) : (
              <div 
                onClick={() => setEditingConfidence(true)}
                className={cn(
                  "text-2xl font-bold rounded-lg px-4 py-2 cursor-pointer hover:opacity-80 transition-all duration-200 text-center mx-auto w-fit",
                  confidenceColor(localTrade.confidence_level || 5)
                )}
              >
                {localTrade.confidence_level || 5}/10
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Analytics */}
        <div className="space-y-2.5">
          <div>
            <Label className="text-[10px] text-[#666] mb-1 block">Стратегия</Label>
            <Input
              value={strategyInput}
              onChange={(e) => setStrategyInput(e.target.value)}
              onBlur={() => {
                setLocalTrade({...localTrade, strategy_tag: strategyInput});
                onUpdate(trade.id, { strategy_tag: strategyInput });
              }}
              list="strategies"
              placeholder="Введите стратегию..."
              className="h-8 text-xs bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]"
            />
            <datalist id="strategies">
              {usedStrategies.map(s => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          <div className="bg-[#151515] border border-[#2a2a2a] rounded-lg p-2.5">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-[10px] text-[#666]">Timeframe</Label>
              <Label className="text-[10px] text-[#666]">Market</Label>
            </div>
            <div className="flex gap-2">
              <Select 
                value={localTrade.timeframe || ''} 
                onValueChange={(val) => {
                  setLocalTrade({...localTrade, timeframe: val});
                  onUpdate(trade.id, { timeframe: val });
                }}
              >
                <SelectTrigger className="h-7 text-xs bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]">
                  <SelectValue placeholder="TF..." />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-[#333]">
                  <SelectItem value="scalp">Scalp</SelectItem>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="swing">Swing</SelectItem>
                  <SelectItem value="mid_term">Mid-term</SelectItem>
                  <SelectItem value="long_term">Long-term</SelectItem>
                  <SelectItem value="spot">Spot</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={localTrade.market_context === 'Bullish' ? 'default' : 'outline'}
                  onClick={() => {
                    setLocalTrade({...localTrade, market_context: 'Bullish'});
                    onUpdate(trade.id, { market_context: 'Bullish' });
                  }}
                  className={cn(
                    "h-7 px-2 text-[10px]",
                    localTrade.market_context === 'Bullish' 
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
                      : "bg-[#0d0d0d] border-[#2a2a2a] text-[#888]"
                  )}
                >
                  Bull
                </Button>
                <Button
                  size="sm"
                  variant={localTrade.market_context === 'Bearish' ? 'default' : 'outline'}
                  onClick={() => {
                    setLocalTrade({...localTrade, market_context: 'Bearish'});
                    onUpdate(trade.id, { market_context: 'Bearish' });
                  }}
                  className={cn(
                    "h-7 px-2 text-[10px]",
                    localTrade.market_context === 'Bearish' 
                      ? "bg-red-500/20 text-red-400 border-red-500/30" 
                      : "bg-[#0d0d0d] border-[#2a2a2a] text-[#888]"
                  )}
                >
                  Bear
                </Button>
              </div>
            </div>
          </div>

          <div>
            <Label className="text-[10px] text-[#666] mb-1 block">Причина входа</Label>
            <Textarea
              value={localTrade.entry_reason || ''}
              onChange={(e) => setLocalTrade({...localTrade, entry_reason: e.target.value})}
              onBlur={() => onUpdate(trade.id, { entry_reason: localTrade.entry_reason })}
              placeholder="Почему вошли в эту сделку?"
              className="h-20 text-xs bg-[#151515] border-[#2a2a2a] resize-none text-[#c0c0c0]"
            />
          </div>

          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border border-[#2a2a2a] rounded-lg p-2.5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-amber-400" />
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
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={handleGenerateAI} 
                  disabled={isGeneratingAI} 
                  className="h-5 text-[10px] px-2 text-[#c0c0c0] hover:text-white"
                >
                  {isGeneratingAI ? 'Анализ...' : 'Создать'}
                </Button>
              )}
            </div>
            {aiAnalysis && (
              <div className="space-y-1.5 text-[10px]">
                <div>
                  <span className="text-emerald-400">✓ </span>
                  <span className="text-[#c0c0c0]">{aiAnalysis.strengths}</span>
                </div>
                <div>
                  <span className="text-amber-400">⚠ </span>
                  <span className="text-[#c0c0c0]">{aiAnalysis.risks}</span>
                </div>
                <div>
                  <span className="text-blue-400">💡 </span>
                  <span className="text-[#c0c0c0]">{aiAnalysis.tip}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons - Bottom */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#2a2a2a]">
        <div className="flex gap-2">
          <Button 
            size="sm" 
            onClick={() => setShowAddModal(true)} 
            className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 h-7 text-xs"
          >
            <Plus className="w-3 h-3 mr-1" /> Add
          </Button>
          <Button 
            size="sm" 
            onClick={() => setShowCloseModal(true)} 
            className="bg-[#1a1a1a] text-[#c0c0c0] hover:bg-[#252525] border border-[#333] h-7 text-xs"
          >
            Close Position
          </Button>
          <Button 
            size="sm" 
            onClick={() => setShowPartialModal(true)} 
            className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30 h-7 text-xs"
          >
            <Percent className="w-3 h-3 mr-1" /> Partial Close
          </Button>
        </div>
        
        <div className="flex gap-2">
          <Button 
            size="sm" 
            onClick={handleMoveToBE} 
            className="bg-[#1a1a1a] text-[#c0c0c0] hover:bg-[#252525] border border-[#333] h-7 text-xs"
          >
            <Target className="w-3 h-3 mr-1" /> Move SL → BE
          </Button>
          <Button 
            size="sm" 
            onClick={handleHitSL} 
            className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 h-7 text-xs"
          >
            <AlertTriangle className="w-3 h-3 mr-1" /> Hit SL
          </Button>
          <Button 
            size="sm" 
            onClick={handleHitTP} 
            className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 h-7 text-xs"
          >
            <TrendingUp className="w-3 h-3 mr-1" /> Hit TP
          </Button>
        </div>
      </div>

      {/* Modals */}
      <Dialog open={showCloseModal} onOpenChange={setShowCloseModal}>
        <DialogContent className="bg-[#1a1a1a] border-[#333]">
          <DialogHeader>
            <DialogTitle className="text-[#c0c0c0]">Закрыть позицию</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-[#888]">Цена закрытия</Label>
              <Input
                type="number"
                value={closePrice}
                onChange={(e) => setClosePrice(e.target.value)}
                placeholder="Введите цену..."
                className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]"
              />
            </div>
            <div>
              <Label className="text-xs text-[#888]">Комментарий (опционально)</Label>
              <Textarea
                value={closeComment}
                onChange={(e) => setCloseComment(e.target.value)}
                placeholder="Почему закрыли?"
                className="bg-[#151515] border-[#2a2a2a] h-16 resize-none text-[#c0c0c0]"
              />
            </div>
            <Button onClick={handleClosePosition} className="w-full bg-red-500 hover:bg-red-600 text-white">Подтвердить</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPartialModal} onOpenChange={setShowPartialModal}>
        <DialogContent className="bg-[#1a1a1a] border-[#333]">
          <DialogHeader>
            <DialogTitle className="text-[#c0c0c0]">Частичное закрытие</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-[#888] mb-2 block">Закрыть {partialPercent}% позиции</Label>
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
              <Label className="text-xs text-[#888]">Цена закрытия</Label>
              <Input
                type="number"
                value={partialPrice}
                onChange={(e) => setPartialPrice(e.target.value)}
                placeholder="Введите цену..."
                className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]"
              />
            </div>
            <Button onClick={handlePartialClose} className="w-full bg-amber-500 hover:bg-amber-600 text-black">Подтвердить</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="bg-[#1a1a1a] border-[#333]">
          <DialogHeader>
            <DialogTitle className="text-[#c0c0c0]">Усреднить позицию</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-[#888]">Цена входа</Label>
              <Input
                type="number"
                value={addPrice}
                onChange={(e) => setAddPrice(e.target.value)}
                placeholder="Новая цена входа"
                className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]"
              />
            </div>
            <div>
              <Label className="text-xs text-[#888]">Размер ($)</Label>
              <Input
                type="number"
                value={addSize}
                onChange={(e) => setAddSize(e.target.value)}
                placeholder="Дополнительный размер"
                className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]"
              />
            </div>
            <Button onClick={handleAddPosition} className="w-full bg-blue-500 hover:bg-blue-600 text-white">Подтвердить</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}