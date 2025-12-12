import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Zap, TrendingUp, AlertTriangle, Target, Plus, Percent, Edit2, Trash2, Check, X } from 'lucide-react';
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
  const [isEditing, setIsEditing] = useState(false);
  const [editedTrade, setEditedTrade] = useState(trade);
  const [hasChanges, setHasChanges] = useState(false);
  
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showPartialModal, setShowPartialModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [closePrice, setClosePrice] = useState('');
  const [closeComment, setCloseComment] = useState('');
  const [partialPercent, setPartialPercent] = useState(50);
  const [partialPrice, setPartialPrice] = useState('');
  const [addPrice, setAddPrice] = useState('');
  const [addSize, setAddSize] = useState('');
  
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [liveTimer, setLiveTimer] = useState(0);

  const { data: allTrades } = useQuery({
    queryKey: ['trades'],
    queryFn: () => base44.entities.Trade.list(),
  });

  const isLong = trade.direction === 'Long';
  const balance = trade.account_balance_at_entry || currentBalance || 100000;

  // Load saved AI analysis
  useEffect(() => {
    if (trade.ai_analysis) {
      try {
        setAiAnalysis(JSON.parse(trade.ai_analysis));
      } catch {}
    }
  }, [trade.ai_analysis]);

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

  // Use edited or current trade for calculations
  const activeTrade = isEditing ? editedTrade : trade;

  // Calculate current metrics
  const stopDistance = Math.abs(activeTrade.entry_price - activeTrade.stop_price);
  const riskUsd = (stopDistance / activeTrade.entry_price) * activeTrade.position_size;
  const riskPercent = (riskUsd / balance) * 100;

  const takeDistance = Math.abs(activeTrade.take_price - activeTrade.entry_price);
  const potentialUsd = (takeDistance / activeTrade.entry_price) * activeTrade.position_size;
  const potentialPercent = (potentialUsd / balance) * 100;

  const rrRatio = riskUsd > 0 ? potentialUsd / riskUsd : 0;

  // Edit mode handlers
  const handleEdit = () => {
    setEditedTrade({...trade});
    setHasChanges(false);
    setIsEditing(true);
  };

  const handleFieldChange = (field, value) => {
    setEditedTrade(prev => ({...prev, [field]: value}));
    setHasChanges(true);
  };

  const handleSave = async () => {
    // If close price is filled, treat as full close
    if (editedTrade.close_price && parseFloat(editedTrade.close_price) > 0) {
      await handleCloseFromEdit(parseFloat(editedTrade.close_price));
      return;
    }

    // Recalculate metrics
    const entry = parseFloat(editedTrade.entry_price) || 0;
    const stop = parseFloat(editedTrade.stop_price) || 0;
    const take = parseFloat(editedTrade.take_price) || 0;
    const size = parseFloat(editedTrade.position_size) || 0;

    const newStopDistance = Math.abs(entry - stop);
    const newRiskUsd = (newStopDistance / entry) * size;
    const newRiskPercent = (newRiskUsd / balance) * 100;

    const newTakeDistance = Math.abs(take - entry);
    const newPotentialUsd = (newTakeDistance / entry) * size;
    const newRR = newRiskUsd > 0 ? newPotentialUsd / newRiskUsd : 0;

    const updated = {
      ...editedTrade,
      risk_usd: newRiskUsd,
      risk_percent: newRiskPercent,
      rr_ratio: newRR,
      // Preserve original values if not set
      original_entry_price: editedTrade.original_entry_price || trade.original_entry_price || entry,
      original_stop_price: editedTrade.original_stop_price || trade.original_stop_price || stop,
      original_risk_usd: editedTrade.original_risk_usd || trade.original_risk_usd || newRiskUsd,
    };

    await onUpdate(trade.id, updated);
    setIsEditing(false);
    setHasChanges(false);
    toast.success('Trade updated');
  };

  const handleCancel = () => {
    setEditedTrade({...trade});
    setIsEditing(false);
    setHasChanges(false);
  };

  const handleCloseFromEdit = async (price) => {
    const entry = parseFloat(editedTrade.entry_price) || 0;
    const size = parseFloat(editedTrade.position_size) || 0;
    const originalRisk = trade.original_risk_usd || riskUsd;

    const pnlUsd = isLong 
      ? ((price - entry) / entry) * size
      : ((entry - price) / entry) * size;

    const pnlPercent = (pnlUsd / balance) * 100;
    const rMultiple = originalRisk > 0 ? pnlUsd / originalRisk : 0;

    const closeData = {
      ...editedTrade,
      close_price: price,
      date_close: new Date().toISOString(),
      realized_pnl_usd: (trade.realized_pnl_usd || 0) + pnlUsd,
      pnl_usd: pnlUsd,
      pnl_percent_of_balance: pnlPercent,
      r_multiple: rMultiple,
      position_size: 0,
      actual_duration_minutes: Math.floor((new Date() - new Date(trade.date_open || trade.date)) / 60000)
    };

    await onUpdate(trade.id, closeData);
    setIsEditing(false);
    toast.success('Position closed');
  };

  // Move SL to BE
  const handleMoveToBE = async () => {
    const updated = {
      stop_price: activeTrade.entry_price,
      risk_usd: 0,
      risk_percent: 0,
    };
    await onUpdate(trade.id, updated);
    toast.success('Stop moved to breakeven');
  };

  // Hit SL
  const handleHitSL = async () => {
    const originalRisk = trade.original_risk_usd || riskUsd;
    const pnlUsd = isLong 
      ? ((activeTrade.stop_price - activeTrade.entry_price) / activeTrade.entry_price) * activeTrade.position_size
      : ((activeTrade.entry_price - activeTrade.stop_price) / activeTrade.entry_price) * activeTrade.position_size;

    const closeData = {
      close_price: activeTrade.stop_price,
      date_close: new Date().toISOString(),
      pnl_usd: pnlUsd,
      pnl_percent_of_balance: (pnlUsd / balance) * 100,
      r_multiple: originalRisk > 0 ? pnlUsd / originalRisk : 0,
      realized_pnl_usd: (trade.realized_pnl_usd || 0) + pnlUsd,
      position_size: 0,
      actual_duration_minutes: Math.floor((new Date() - new Date(trade.date_open || trade.date)) / 60000)
    };

    await onUpdate(trade.id, closeData);
    toast.success('Position closed at Stop Loss');
  };

  // Hit TP
  const handleHitTP = async () => {
    const originalRisk = trade.original_risk_usd || riskUsd;
    const pnlUsd = isLong 
      ? ((activeTrade.take_price - activeTrade.entry_price) / activeTrade.entry_price) * activeTrade.position_size
      : ((activeTrade.entry_price - activeTrade.take_price) / activeTrade.entry_price) * activeTrade.position_size;

    const closeData = {
      close_price: activeTrade.take_price,
      date_close: new Date().toISOString(),
      pnl_usd: pnlUsd,
      pnl_percent_of_balance: (pnlUsd / balance) * 100,
      r_multiple: originalRisk > 0 ? pnlUsd / originalRisk : 0,
      realized_pnl_usd: (trade.realized_pnl_usd || 0) + pnlUsd,
      position_size: 0,
      actual_duration_minutes: Math.floor((new Date() - new Date(trade.date_open || trade.date)) / 60000)
    };

    await onUpdate(trade.id, closeData);
    toast.success('Position closed at Take Profit');
  };

  // Close at custom price
  const handleClosePosition = async () => {
    const price = parseFloat(closePrice);
    if (!price) return;

    const originalRisk = trade.original_risk_usd || riskUsd;
    const pnlUsd = isLong 
      ? ((price - activeTrade.entry_price) / activeTrade.entry_price) * activeTrade.position_size
      : ((activeTrade.entry_price - price) / activeTrade.entry_price) * activeTrade.position_size;

    const closeData = {
      close_price: price,
      date_close: new Date().toISOString(),
      pnl_usd: pnlUsd,
      pnl_percent_of_balance: (pnlUsd / balance) * 100,
      r_multiple: originalRisk > 0 ? pnlUsd / originalRisk : 0,
      realized_pnl_usd: (trade.realized_pnl_usd || 0) + pnlUsd,
      position_size: 0,
      close_comment: closeComment,
      actual_duration_minutes: Math.floor((new Date() - new Date(trade.date_open || trade.date)) / 60000)
    };

    await onUpdate(trade.id, closeData);
    setShowCloseModal(false);
    setClosePrice('');
    setCloseComment('');
    toast.success('Position closed');
  };

  // Partial close
  const handlePartialClose = async () => {
    const price = parseFloat(partialPrice);
    if (!price) return;

    const closedSize = (partialPercent / 100) * activeTrade.position_size;
    const remainingSize = activeTrade.position_size - closedSize;

    const partialPnl = isLong
      ? ((price - activeTrade.entry_price) / activeTrade.entry_price) * closedSize
      : ((activeTrade.entry_price - price) / activeTrade.entry_price) * closedSize;

    // Update partial closes history
    const partialCloses = trade.partial_closes ? JSON.parse(trade.partial_closes) : [];
    partialCloses.push({
      percent: partialPercent,
      size_usd: closedSize,
      price,
      pnl_usd: partialPnl,
      timestamp: new Date().toISOString()
    });

    const updated = {
      position_size: remainingSize,
      realized_pnl_usd: (trade.realized_pnl_usd || 0) + partialPnl,
      partial_closes: JSON.stringify(partialCloses),
    };

    // Recalculate risk/reward with new size
    const newStopDistance = Math.abs(activeTrade.entry_price - activeTrade.stop_price);
    updated.risk_usd = (newStopDistance / activeTrade.entry_price) * remainingSize;
    updated.risk_percent = (updated.risk_usd / balance) * 100;

    const newTakeDistance = Math.abs(activeTrade.take_price - activeTrade.entry_price);
    const newPotentialUsd = (newTakeDistance / activeTrade.entry_price) * remainingSize;
    updated.rr_ratio = updated.risk_usd > 0 ? newPotentialUsd / updated.risk_usd : 0;

    // If 100% closed
    if (remainingSize <= 0) {
      updated.position_size = 0;
      updated.close_price = price;
      updated.date_close = new Date().toISOString();
      updated.pnl_usd = trade.realized_pnl_usd + partialPnl;
      updated.pnl_percent_of_balance = (updated.pnl_usd / balance) * 100;
      const originalRisk = trade.original_risk_usd || riskUsd;
      updated.r_multiple = originalRisk > 0 ? updated.pnl_usd / originalRisk : 0;
      updated.actual_duration_minutes = Math.floor((new Date() - new Date(trade.date_open || trade.date)) / 60000);
    }

    await onUpdate(trade.id, updated);
    setShowPartialModal(false);
    setPartialPrice('');
    toast.success(`Partially closed ${partialPercent}% at ${formatPrice(price)}`);
  };

  // Add to position
  const handleAddPosition = async () => {
    const price = parseFloat(addPrice);
    const size = parseFloat(addSize);
    if (!price || !size) return;

    const oldSize = activeTrade.position_size;
    const newSize = oldSize + size;
    const newEntry = (activeTrade.entry_price * oldSize + price * size) / newSize;

    // Update adds history
    const addsHistory = trade.adds_history ? JSON.parse(trade.adds_history) : [];
    addsHistory.push({
      price,
      size_usd: size,
      timestamp: new Date().toISOString()
    });

    const updated = {
      entry_price: newEntry,
      position_size: newSize,
      adds_history: JSON.stringify(addsHistory),
    };

    // Recalculate risk/reward
    const newStopDistance = Math.abs(newEntry - activeTrade.stop_price);
    updated.risk_usd = (newStopDistance / newEntry) * newSize;
    updated.risk_percent = (updated.risk_usd / balance) * 100;

    const newTakeDistance = Math.abs(activeTrade.take_price - newEntry);
    const newPotentialUsd = (newTakeDistance / newEntry) * newSize;
    updated.rr_ratio = updated.risk_usd > 0 ? newPotentialUsd / updated.risk_usd : 0;

    await onUpdate(trade.id, updated);
    setShowAddModal(false);
    setAddPrice('');
    setAddSize('');
    toast.success(`Added $${Math.round(size)} at ${formatPrice(price)}`);
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
      await onUpdate(trade.id, { 
        ai_score: response.score,
        ai_analysis: JSON.stringify(response)
      });
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
      <div className="absolute top-0 left-12 right-12">
        <div className="h-[2px] bg-gradient-to-r from-transparent via-[#c0c0c0]/70 to-transparent" style={{
          maskImage: 'linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)'
        }} />
      </div>

      {/* Background Design */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-radial from-[#c0c0c0]/10 via-transparent to-transparent blur-2xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-radial from-[#888]/10 via-transparent to-transparent blur-2xl" />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(to right, #c0c0c0 1px, transparent 1px), linear-gradient(to bottom, #c0c0c0 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }} />
        <div className="absolute top-0 left-0 w-32 h-32 border-l-2 border-t-2 border-[#c0c0c0]/10" />
        <div className="absolute bottom-0 right-0 w-32 h-32 border-r-2 border-b-2 border-[#c0c0c0]/10" />
      </div>

      {/* Edit & Delete - Top Right */}
      <div className="absolute top-2 right-2 flex gap-1 z-10">
        {isEditing ? (
          <>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={handleSave} 
              disabled={!hasChanges}
              className={cn(
                "h-6 w-6 p-0",
                hasChanges ? "hover:bg-emerald-500/20 text-emerald-400" : "text-[#444]"
              )}
            >
              <Check className="w-3 h-3" />
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={handleCancel} 
              className="h-6 w-6 p-0 hover:bg-[#2a2a2a] text-[#888]"
            >
              <X className="w-3 h-3" />
            </Button>
          </>
        ) : (
          <>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={handleEdit} 
              className="h-6 w-6 p-0 hover:bg-[#2a2a2a]"
            >
              <Edit2 className="w-3 h-3 text-[#888] hover:text-[#c0c0c0]" />
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => onDelete(trade)} 
              className="h-6 w-6 p-0 hover:bg-red-500/20"
            >
              <Trash2 className="w-3 h-3 text-red-400/70 hover:text-red-400" />
            </Button>
          </>
        )}
      </div>

      {/* Main Content - Two Columns */}
      <div className="grid grid-cols-2 gap-6 relative mt-4">
        {/* LEFT: Technical Parameters */}
        <div className="grid grid-cols-2 gap-2 self-start">
          {/* Entry */}
          <div className="bg-[#151515] border border-[#2a2a2a] rounded-lg p-2 flex flex-col items-center justify-center">
            <div className="text-[10px] text-[#666] mb-0.5">Entry</div>
            {isEditing ? (
              <Input
                type="number"
                step="any"
                value={editedTrade.entry_price}
                onChange={(e) => handleFieldChange('entry_price', e.target.value)}
                className="h-7 text-center text-xs bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
              />
            ) : (
              <div className="text-sm font-bold text-[#c0c0c0]">{formatPrice(activeTrade.entry_price)}</div>
            )}
          </div>

          {/* Close */}
          <div className="bg-[#151515] border border-[#2a2a2a] rounded-lg p-2 flex flex-col items-center justify-center">
            <div className="text-[10px] text-[#666] mb-0.5">Close</div>
            {isEditing ? (
              <Input
                type="number"
                step="any"
                value={editedTrade.close_price || ''}
                onChange={(e) => handleFieldChange('close_price', e.target.value)}
                placeholder="—"
                className="h-7 text-center text-xs bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
              />
            ) : (
              <div className="text-sm font-bold text-[#c0c0c0]">—</div>
            )}
          </div>

          {/* Size */}
          <div className="bg-[#151515] border border-[#2a2a2a] rounded-lg p-2 flex flex-col items-center justify-center">
            <div className="text-[10px] text-[#666] mb-0.5">Size</div>
            {isEditing ? (
              <Input
                type="number"
                value={editedTrade.position_size}
                onChange={(e) => handleFieldChange('position_size', e.target.value)}
                className="h-7 text-center text-xs bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
              />
            ) : (
              <div className="text-sm font-bold text-[#c0c0c0]">${Math.round(activeTrade.position_size)}</div>
            )}
          </div>

          {/* St. Balance */}
          <div className="bg-[#151515] border border-[#2a2a2a] rounded-lg p-2 flex flex-col items-center justify-center">
            <div className="text-[10px] text-[#666] mb-0.5">St. Balance</div>
            {isEditing ? (
              <Input
                type="number"
                value={editedTrade.account_balance_at_entry || balance}
                onChange={(e) => handleFieldChange('account_balance_at_entry', e.target.value)}
                className="h-7 text-center text-xs bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
              />
            ) : (
              <div className="text-sm font-bold text-[#c0c0c0]">${Math.round(balance)}</div>
            )}
          </div>

          {/* Stop */}
          <div className="bg-[#151515] border border-red-500/20 rounded-lg p-2 flex flex-col items-center justify-center">
            <div className="text-[10px] text-[#666] mb-0.5">Stop</div>
            {isEditing ? (
              <Input
                type="number"
                step="any"
                value={editedTrade.stop_price}
                onChange={(e) => handleFieldChange('stop_price', e.target.value)}
                className="h-7 text-center text-xs bg-[#0d0d0d] border-red-500/20 text-red-400"
              />
            ) : (
              <>
                <div className="text-sm font-bold text-red-400">{formatPrice(activeTrade.stop_price)}</div>
                <div className="text-[9px] text-red-400/70">${Math.round(riskUsd)} • {riskPercent.toFixed(1)}%</div>
              </>
            )}
          </div>

          {/* Take */}
          <div className="bg-[#151515] border border-emerald-500/20 rounded-lg p-2 flex flex-col items-center justify-center">
            <div className="text-[10px] text-[#666] mb-0.5">Take</div>
            {isEditing ? (
              <Input
                type="number"
                step="any"
                value={editedTrade.take_price}
                onChange={(e) => handleFieldChange('take_price', e.target.value)}
                className="h-7 text-center text-xs bg-[#0d0d0d] border-emerald-500/20 text-emerald-400"
              />
            ) : (
              <>
                <div className="text-sm font-bold text-emerald-400">{formatPrice(activeTrade.take_price)}</div>
                <div className="text-[9px] text-emerald-400/70">${Math.round(potentialUsd)} • {potentialPercent.toFixed(1)}%</div>
              </>
            )}
          </div>

          {/* Confidence */}
          <div className="bg-[#151515] border border-[#2a2a2a] rounded-lg p-2 col-span-2 flex flex-col items-center justify-center">
            <div className="text-[10px] text-[#666] mb-1">Confidence</div>
            {isEditing ? (
              <div className="w-full px-2">
                <Slider
                  value={[editedTrade.confidence_level || 5]}
                  onValueChange={([val]) => handleFieldChange('confidence_level', val)}
                  min={1}
                  max={10}
                  step={1}
                  className="mb-1"
                />
                <div className="flex justify-between text-[9px] text-[#666]">
                  <span>1</span>
                  <span className="text-[#888] font-bold">{editedTrade.confidence_level || 5}</span>
                  <span>10</span>
                </div>
              </div>
            ) : (
              <div className="text-2xl font-bold text-[#888]">
                {activeTrade.confidence_level || 5}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Analytics */}
        <div className="space-y-2.5 self-start">
          {/* Strategy */}
          <div>
            <Label className="text-[10px] text-[#666] mb-1 block">Strategy</Label>
            {isEditing ? (
              <Input
                value={editedTrade.strategy_tag || ''}
                onChange={(e) => handleFieldChange('strategy_tag', e.target.value)}
                list="strategies"
                placeholder="Enter strategy..."
                className="h-8 text-xs bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]"
              />
            ) : (
              <div className="h-8 px-3 flex items-center bg-[#151515] border border-[#2a2a2a] rounded-lg text-xs text-[#c0c0c0]">
                {activeTrade.strategy_tag || '—'}
              </div>
            )}
            <datalist id="strategies">
              {usedStrategies.map(s => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          {/* Timeframe & Market */}
          <div className="bg-[#151515] border border-[#2a2a2a] rounded-lg p-2.5">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-[10px] text-[#666]">Timeframe</Label>
              <Label className="text-[10px] text-[#666]">Market</Label>
            </div>
            <div className="flex gap-2">
              {isEditing ? (
                <Select 
                  value={editedTrade.timeframe || ''} 
                  onValueChange={(val) => handleFieldChange('timeframe', val)}
                >
                  <SelectTrigger className="h-7 text-xs bg-[#0d0d0d] border-[#2a2a2a] text-white">
                    <SelectValue placeholder="TF..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-[#333]">
                    <SelectItem value="scalp" className="text-white">Scalp</SelectItem>
                    <SelectItem value="day" className="text-white">Day</SelectItem>
                    <SelectItem value="swing" className="text-white">Swing</SelectItem>
                    <SelectItem value="mid_term" className="text-white">Mid-term</SelectItem>
                    <SelectItem value="long_term" className="text-white">Long-term</SelectItem>
                    <SelectItem value="spot" className="text-white">Spot</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="h-7 flex-1 flex items-center px-2 bg-[#0d0d0d] border border-[#2a2a2a] rounded text-xs text-[#c0c0c0]">
                  {activeTrade.timeframe || '—'}
                </div>
              )}
              
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={activeTrade.market_context === 'Bullish' ? 'default' : 'outline'}
                  onClick={() => isEditing && handleFieldChange('market_context', 'Bullish')}
                  disabled={!isEditing}
                  className={cn(
                    "h-7 px-2 text-[10px]",
                    activeTrade.market_context === 'Bullish' 
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
                      : "bg-[#0d0d0d] border-[#2a2a2a] text-[#888]"
                  )}
                >
                  Bull
                </Button>
                <Button
                  size="sm"
                  variant={activeTrade.market_context === 'Bearish' ? 'default' : 'outline'}
                  onClick={() => isEditing && handleFieldChange('market_context', 'Bearish')}
                  disabled={!isEditing}
                  className={cn(
                    "h-7 px-2 text-[10px]",
                    activeTrade.market_context === 'Bearish' 
                      ? "bg-red-500/20 text-red-400 border-red-500/30" 
                      : "bg-[#0d0d0d] border-[#2a2a2a] text-[#888]"
                  )}
                >
                  Bear
                </Button>
              </div>
            </div>
          </div>

          {/* Entry Reason */}
          <div>
            <Label className="text-[10px] text-[#666] mb-1 block">Entry Reason</Label>
            {isEditing ? (
              <Textarea
                value={editedTrade.entry_reason || ''}
                onChange={(e) => handleFieldChange('entry_reason', e.target.value)}
                placeholder="Why did you enter this trade?"
                className="h-20 text-xs bg-[#151515] border-[#2a2a2a] resize-none text-[#c0c0c0]"
              />
            ) : (
              <div className="min-h-[80px] p-2 bg-[#151515] border border-[#2a2a2a] rounded-lg text-xs text-[#c0c0c0] whitespace-pre-wrap">
                {activeTrade.entry_reason || '—'}
              </div>
            )}
          </div>

          {/* AI Score */}
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border border-[#2a2a2a] rounded-lg p-2.5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-amber-400" />
                <span className="text-[10px] text-[#666]">AI Score</span>
              </div>
              {activeTrade.ai_score ? (
                <span className={cn(
                  "text-sm font-bold",
                  activeTrade.ai_score >= 7 ? "text-emerald-400" : activeTrade.ai_score >= 5 ? "text-amber-400" : "text-red-400"
                )}>
                  {activeTrade.ai_score}/10
                </span>
              ) : (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={handleGenerateAI} 
                  disabled={isGeneratingAI} 
                  className="h-5 text-[10px] px-2 text-[#c0c0c0] hover:text-white"
                >
                  {isGeneratingAI ? 'Analyzing...' : 'Generate'}
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

      {/* Action Buttons - Bottom (only in view mode) */}
      {!isEditing && (
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
      )}

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
                placeholder="Enter price..."
                className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]"
              />
            </div>
            <div>
              <Label className="text-xs text-[#888]">Comment (optional)</Label>
              <Textarea
                value={closeComment}
                onChange={(e) => setCloseComment(e.target.value)}
                placeholder="Why did you close?"
                className="bg-[#151515] border-[#2a2a2a] h-16 resize-none text-[#c0c0c0]"
              />
            </div>
            <Button onClick={handleClosePosition} className="w-full bg-red-500 hover:bg-red-600 text-white">Confirm</Button>
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
                placeholder="Enter price..."
                className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]"
              />
            </div>
            <Button onClick={handlePartialClose} className="w-full bg-amber-500 hover:bg-amber-600 text-black">Confirm</Button>
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
                className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]"
              />
            </div>
            <div>
              <Label className="text-xs text-[#888]">Size ($)</Label>
              <Input
                type="number"
                value={addSize}
                onChange={(e) => setAddSize(e.target.value)}
                placeholder="Additional size"
                className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]"
              />
            </div>
            <Button onClick={handleAddPosition} className="w-full bg-blue-500 hover:bg-blue-600 text-white">Confirm</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}