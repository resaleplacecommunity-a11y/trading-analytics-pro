import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Zap, TrendingUp, AlertTriangle, Target, Plus, Percent, Edit2, Trash2, Check, X, DollarSign, TrendingDown, Wallet, Package, Image, Link as LinkIcon, Paperclip, Clock, Calendar, Timer, Hourglass, Flame } from 'lucide-react';
import { cn } from "@/lib/utils";
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";
import { useQuery } from '@tanstack/react-query';
import { parseNumberSafe, formatPrice, formatNumber } from '../utils/numberUtils';

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
  const [showScreenshot, setShowScreenshot] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState(trade.screenshot_url || '');
  const [screenshotInput, setScreenshotInput] = useState('');
  const [showScreenshotModal, setShowScreenshotModal] = useState(false);
  const [actionHistory, setActionHistory] = useState([]);
  const [currentActionIndex, setCurrentActionIndex] = useState(0);

  const { data: allTrades } = useQuery({
    queryKey: ['trades'],
    queryFn: () => base44.entities.Trade.list(),
  });

  const isOpen = trade.status === 'OPEN' || (!trade.close_price_final && !trade.close_price);
  const isLong = trade.direction === 'Long';
  const balance = trade.balance_entry || trade.account_balance_at_entry || currentBalance || 100000;

  useEffect(() => {
    if (trade.ai_analysis) {
      try {
        setAiAnalysis(JSON.parse(trade.ai_analysis));
      } catch {}
    }
  }, [trade.ai_analysis]);

  useEffect(() => {
    setEditedTrade(trade);
    setScreenshotUrl(trade.screenshot_url || '');
    
    // Parse action history
    try {
      const history = trade.action_history ? JSON.parse(trade.action_history) : [];
      setActionHistory(history);
      setCurrentActionIndex(history.length > 0 ? history.length - 1 : 0);
    } catch {
      setActionHistory([]);
      setCurrentActionIndex(0);
    }
  }, [trade]);

  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          handleScreenshotUpload(blob);
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

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
  }, [trade.date_open, trade.date, isOpen]);

  const formatDuration = (seconds) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    
    let result = [];
    if (d > 0) result.push(`${d}d`);
    if (h > 0) result.push(`${h}h`);
    result.push(`${m}m`);
    return result.join(' ');
  };

  const usedStrategies = [...new Set((allTrades || []).map(t => t.strategy_tag).filter(Boolean))];

  const activeTrade = isEditing ? editedTrade : trade;

  console.log('OpenTradeCard rendering trade:', trade.id, 'activeTrade:', activeTrade);

  const entry = parseNumberSafe(activeTrade.entry_price);
  const stop = parseNumberSafe(activeTrade.stop_price || activeTrade.stop_price_current);
  const take = parseNumberSafe(activeTrade.take_price);
  const size = parseNumberSafe(activeTrade.position_size);

  console.log('Parsed values:', { entry, stop, take, size });

  // Calculate if stop is at breakeven
  const isStopAtBE = entry && stop && Math.abs(stop - entry) < 0.0001;
  
  // Calculate risk
  const riskUsd = (entry && stop && size && entry > 0) 
    ? Math.abs(entry - stop) / entry * size 
    : 0;
  const riskPercent = balance > 0 ? (riskUsd / balance) * 100 : 0;

  // Calculate potential
  const potentialUsd = (entry && take && size && entry > 0)
    ? Math.abs(take - entry) / entry * size
    : 0;
  const potentialPercent = balance > 0 ? (potentialUsd / balance) * 100 : 0;

  // Calculate RR properly for BE scenarios
  let rrRatio = 0;
  
  if (isStopAtBE && take > 0) {
    const originalRisk = trade.initial_risk_usd || trade.max_risk_usd || 1;
    if (originalRisk > 0) {
      rrRatio = potentialUsd / originalRisk;
    }
  } else if (riskUsd > 0 && potentialUsd > 0) {
    rrRatio = potentialUsd / riskUsd;
  }

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
    const closePrice = parseNumberSafe(editedTrade.close_price);
    
    if (closePrice && closePrice > 0) {
      await handleCloseFromEdit(closePrice);
      return;
    }

    const newEntry = parseNumberSafe(editedTrade.entry_price);
    const newStop = parseNumberSafe(editedTrade.stop_price);
    const newTake = parseNumberSafe(editedTrade.take_price);
    const newSize = parseNumberSafe(editedTrade.position_size);

    if (!newEntry || !newStop || !newSize) {
      toast.error('Entry, Stop, and Size are required');
      return;
    }

    const newStopDistance = Math.abs(newEntry - newStop);
    const newRiskUsd = (newStopDistance / newEntry) * newSize;
    const newRiskPercent = (newRiskUsd / balance) * 100;

    const newTakeDistance = newTake ? Math.abs(newTake - newEntry) : 0;
    const newPotentialUsd = newTake ? (newTakeDistance / newEntry) * newSize : 0;
    
    const originalRiskUsd = trade.initial_risk_usd || newRiskUsd;
    let newRR = 0;
    
    if (newRiskUsd === 0 && newTake > 0) {
      newRR = originalRiskUsd > 0 ? newPotentialUsd / originalRiskUsd : 0;
    } else {
      newRR = newRiskUsd > 0 ? newPotentialUsd / newRiskUsd : 0;
    }

    const newIsStopAtBE = Math.abs(newEntry - newStop) < 0.0001;
    
    const updated = {
      entry_price: newEntry,
      stop_price: newStop,
      stop_price_current: newStop,
      take_price: newTake,
      position_size: newSize,
      strategy_tag: editedTrade.strategy_tag,
      timeframe: editedTrade.timeframe,
      market_context: editedTrade.market_context,
      confidence: editedTrade.confidence || editedTrade.confidence_level,
      entry_reason: editedTrade.entry_reason,
      risk_usd: newIsStopAtBE ? 0 : newRiskUsd,
      risk_percent: newIsStopAtBE ? 0 : newRiskPercent,
      rr_ratio: newRR
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
    if (!price || price <= 0) {
      const updated = {
        status: 'OPEN',
        close_price_final: null,
        date_close: null,
        pnl_total_usd: 0,
        pnl_total_pct: 0,
        r_multiple: 0
      };
      await onUpdate(trade.id, updated);
      setIsEditing(false);
      toast.success('Trade reopened');
      return;
    }

    const entryPrice = parseNumberSafe(trade.entry_price);
    const currentPositionSize = parseNumberSafe(trade.position_size);
    const maxRisk = trade.max_risk_usd || trade.initial_risk_usd || riskUsd;

    if (!entryPrice || !currentPositionSize) {
      toast.error('Invalid trade data');
      return;
    }

    const pnlUsd = isLong 
      ? ((price - entryPrice) / entryPrice) * currentPositionSize
      : ((entryPrice - price) / entryPrice) * currentPositionSize;

    const pnlPercent = (pnlUsd / balance) * 100;
    const rMultiple = maxRisk > 0 ? pnlUsd / maxRisk : 0;

    const closeData = {
      status: 'CLOSED',
      close_price_final: price,
      date_close: new Date().toISOString(),
      pnl_total_usd: pnlUsd,
      pnl_total_pct: pnlPercent,
      r_multiple: rMultiple,
      actual_duration_minutes: Math.floor((new Date().getTime() - new Date(trade.date_open || trade.date).getTime()) / 60000),
      risk_at_close_usd: riskUsd
    };

    await onUpdate(trade.id, closeData);
    setIsEditing(false);
    toast.success('Position closed');
  };

  const handleScreenshotUpload = async (file) => {
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setScreenshotUrl(file_url);
      await onUpdate(trade.id, { screenshot_url: file_url });
      toast.success('Screenshot uploaded');
    } catch (error) {
      toast.error('Failed to upload screenshot');
    }
  };

  const handleScreenshotUrl = async () => {
    if (!screenshotInput) return;
    setScreenshotUrl(screenshotInput);
    await onUpdate(trade.id, { screenshot_url: screenshotInput });
    setScreenshotInput('');
    toast.success('Screenshot added');
  };

  const addAction = (action) => {
    const newHistory = [...(actionHistory || []), action];
    return newHistory;
  };

  const handleMoveToBE = async () => {
    console.log('Moving to BE, trade:', trade.id);
    const entryPrice = parseNumberSafe(activeTrade.entry_price);
    
    if (!entryPrice) {
      toast.error('Invalid entry price');
      return;
    }
    
    const updated = {
      stop_price_current: entryPrice,
      stop_price: entryPrice,
      risk_usd: 0,
      risk_percent: 0,
      original_risk_usd: trade.original_risk_usd || trade.risk_usd || riskUsd
    };
    
    console.log('Update payload:', updated);
    await onUpdate(trade.id, updated);
    toast.success('Stop moved to breakeven');
  };

  const handleHitSL = async () => {
    console.log('Hit SL clicked, trade:', trade.id);
    const entryPrice = parseNumberSafe(activeTrade.entry_price);
    const currentPositionSize = parseNumberSafe(activeTrade.position_size);
    const maxRiskUsd = trade.max_risk_usd || trade.initial_risk_usd || riskUsd;
    const stopPrice = parseNumberSafe(activeTrade.stop_price_current || activeTrade.stop_price);

    if (!entryPrice || !currentPositionSize || !stopPrice) {
      toast.error('Invalid trade data');
      return;
    }

    const currentPnl = isLong 
      ? ((stopPrice - entryPrice) / entryPrice) * currentPositionSize
      : ((entryPrice - stopPrice) / entryPrice) * currentPositionSize;

    const closeData = {
      status: 'CLOSED',
      close_price_final: stopPrice,
      date_close: new Date().toISOString(),
      pnl_total_usd: currentPnl,
      pnl_total_pct: (currentPnl / balance) * 100,
      r_multiple: maxRiskUsd > 0 ? currentPnl / maxRiskUsd : 0,
      actual_duration_minutes: Math.floor((new Date().getTime() - new Date(trade.date_open || trade.date).getTime()) / 60000),
      risk_at_close_usd: riskUsd
    };

    console.log('Hit SL update payload:', closeData);
    await onUpdate(trade.id, closeData);
    toast.success('Position closed at Stop Loss');
  };

  const handleHitTP = async () => {
    console.log('Hit TP clicked, trade:', trade.id);
    const entryPrice = parseNumberSafe(activeTrade.entry_price);
    const currentPositionSize = parseNumberSafe(activeTrade.position_size);
    const maxRiskUsd = trade.max_risk_usd || trade.initial_risk_usd || riskUsd;
    const takePrice = parseNumberSafe(activeTrade.take_price);

    if (!entryPrice || !currentPositionSize || !takePrice) {
      toast.error('Invalid trade data');
      return;
    }

    const currentPnl = isLong 
      ? ((takePrice - entryPrice) / entryPrice) * currentPositionSize
      : ((entryPrice - takePrice) / entryPrice) * currentPositionSize;

    const closeData = {
      status: 'CLOSED',
      close_price_final: takePrice,
      date_close: new Date().toISOString(),
      pnl_total_usd: currentPnl,
      pnl_total_pct: (currentPnl / balance) * 100,
      r_multiple: maxRiskUsd > 0 ? currentPnl / maxRiskUsd : 0,
      actual_duration_minutes: Math.floor((new Date().getTime() - new Date(trade.date_open || trade.date).getTime()) / 60000),
      risk_at_close_usd: riskUsd
    };

    console.log('Hit TP update payload:', closeData);
    await onUpdate(trade.id, closeData);
    toast.success('Position closed at Take Profit');
  };

  const handleClosePosition = async () => {
    const price = parseNumberSafe(closePrice);
    if (!price || price <= 0) {
      toast.error('Invalid close price');
      return;
    }

    const entryPrice = parseNumberSafe(activeTrade.entry_price);
    const currentPositionSize = parseNumberSafe(activeTrade.position_size);
    const maxRiskUsd = trade.max_risk_usd || trade.initial_risk_usd || riskUsd;

    if (!entryPrice || !currentPositionSize) {
      toast.error('Invalid trade data');
      return;
    }

    const remainingPnl = isLong 
      ? ((price - entryPrice) / entryPrice) * currentPositionSize
      : ((entryPrice - price) / entryPrice) * currentPositionSize;

    const closeData = {
      status: 'CLOSED',
      close_price_final: price,
      date_close: new Date().toISOString(),
      pnl_total_usd: remainingPnl,
      pnl_total_pct: (remainingPnl / balance) * 100,
      r_multiple: maxRiskUsd > 0 ? remainingPnl / maxRiskUsd : 0,
      actual_duration_minutes: Math.floor((new Date().getTime() - new Date(trade.date_open || trade.date).getTime()) / 60000),
      risk_at_close_usd: riskUsd
    };

    await onUpdate(trade.id, closeData);
    setShowCloseModal(false);
    setClosePrice('');
    setCloseComment('');
    toast.success('Position closed');
  };

  const handlePartialClose = async () => {
    const price = parseFloat(partialPrice);
    if (!price) return;

    const closedSize = (partialPercent / 100) * activeTrade.position_size;
    const remainingSize = activeTrade.position_size - closedSize;

    const partialPnl = isLong
      ? ((price - activeTrade.entry_price) / activeTrade.entry_price) * closedSize
      : ((activeTrade.entry_price - price) / activeTrade.entry_price) * closedSize;

    const partialCloses = trade.partial_closes ? JSON.parse(trade.partial_closes) : [];
    partialCloses.push({
      percent: partialPercent,
      size_usd: closedSize,
      price,
      pnl_usd: partialPnl,
      timestamp: new Date().toISOString()
    });

    const newHistory = addAction({
      timestamp: new Date().toISOString(),
      action: 'partial_close',
      description: `Closed ${partialPercent}% at ${formatPrice(price)} and ${partialPnl >= 0 ? 'locked' : 'realized'} ${partialPnl >= 0 ? `+$${Math.round(partialPnl)}` : `-$${Math.round(Math.abs(partialPnl))}`} ${partialPnl >= 0 ? 'profit' : 'loss'}`
    });

    const updated = {
      position_size: remainingSize,
      realized_pnl_usd: (trade.realized_pnl_usd || 0) + partialPnl,
      partial_closes: JSON.stringify(partialCloses),
      action_history: JSON.stringify(newHistory)
    };

    const newStopDistance = Math.abs(activeTrade.entry_price - activeTrade.stop_price);
    updated.risk_usd = (newStopDistance / activeTrade.entry_price) * remainingSize;
    updated.risk_percent = (updated.risk_usd / balance) * 100;

    const newTakeDistance = Math.abs(activeTrade.take_price - activeTrade.entry_price);
    const newPotentialUsd = (newTakeDistance / activeTrade.entry_price) * remainingSize;
    
    const originalRiskUsd = trade.original_risk_usd || riskUsd;
    const currentMaxRisk = Math.max(trade.max_risk_usd || originalRiskUsd, updated.risk_usd);
    updated.max_risk_usd = currentMaxRisk;
    
    // Calculate RR for partial close
    let newRR = 0;
    if (updated.risk_usd === 0 && newTakeDistance > 0) {
      newRR = newPotentialUsd / (originalRiskUsd > 0 ? originalRiskUsd : 1); 
    } else {
      newRR = updated.risk_usd > 0 ? newPotentialUsd / updated.risk_usd : 0;
    }
    updated.rr_ratio = newRR;

    if (remainingSize <= 0) {
      updated.position_size = 0;
      updated.close_price = price;
      updated.date_close = new Date().toISOString();
      updated.pnl_usd = (trade.realized_pnl_usd || 0) + partialPnl;
      updated.pnl_percent_of_balance = (updated.pnl_usd / balance) * 100;
      const maxRiskUsd = trade.max_risk_usd || originalRiskUsd;
      updated.r_multiple = maxRiskUsd > 0 ? updated.pnl_usd / maxRiskUsd : 0;
      updated.actual_duration_minutes = Math.floor((new Date().getTime() - new Date(trade.date_open || trade.date).getTime()) / 60000);
      updated.risk_usd = 0;
      updated.risk_percent = 0;
      updated.rr_ratio = 0;
    }

    await onUpdate(trade.id, updated);
    setShowPartialModal(false);
    setPartialPrice('');
    toast.success(`Partially closed ${partialPercent}% at ${formatPrice(price)}`);
  };

  const handleAddPosition = async () => {
    const price = parseFloat(addPrice);
    const addedSize = parseFloat(addSize);
    if (!price || !addedSize) return;

    const oldSize = parseFloat(activeTrade.position_size) || 0;
    const newSize = oldSize + addedSize;
    const oldEntry = parseFloat(activeTrade.entry_price) || 0;
    const newEntry = (oldEntry * oldSize + price * addedSize) / newSize;

    const addsHistory = trade.adds_history ? JSON.parse(trade.adds_history) : [];
    addsHistory.push({
      price,
      size_usd: addedSize,
      timestamp: new Date().toISOString()
    });

    const newHistory = addAction({
      timestamp: new Date().toISOString(),
      action: 'add_position',
      description: `Added $${Math.round(addedSize)} at ${formatPrice(price)}`
    });

    // Calculate new risk based on NEW entry and existing stop
    const stopPrice = parseFloat(activeTrade.stop_price) || 0;
    const newStopDistance = Math.abs(newEntry - stopPrice);
    const newRiskUsd = (newStopDistance / newEntry) * newSize;
    const newRiskPercent = (newRiskUsd / balance) * 100;

    // Calculate potential profit
    const takePrice = parseFloat(activeTrade.take_price) || 0;
    const newTakeDistance = Math.abs(takePrice - newEntry);
    const newPotentialUsd = (newTakeDistance / newEntry) * newSize;
    
    // Track max risk
    const originalRiskUsd = trade.original_risk_usd || riskUsd;
    const currentMaxRisk = Math.max(trade.max_risk_usd || 0, newRiskUsd);
    
    // Calculate RR
    let newRR = 0;
    if (newRiskUsd === 0 && newTakeDistance > 0) {
      newRR = originalRiskUsd > 0 ? newPotentialUsd / originalRiskUsd : 0;
    } else {
      newRR = newRiskUsd > 0 ? newPotentialUsd / newRiskUsd : 0;
    }

    const updated = {
      entry_price: newEntry,
      position_size: newSize,
      stop_price: stopPrice, // Ensure stop_price is preserved
      risk_usd: newRiskUsd,
      risk_percent: newRiskPercent,
      rr_ratio: newRR,
      max_risk_usd: currentMaxRisk,
      original_entry_price: trade.original_entry_price || trade.entry_price,
      original_stop_price: trade.original_stop_price || trade.stop_price,
      original_risk_usd: trade.original_risk_usd || (trade.risk_usd || riskUsd),
      adds_history: JSON.stringify(addsHistory),
      action_history: JSON.stringify(newHistory)
    };

    await onUpdate(trade.id, updated);
    setShowAddModal(false);
    setAddPrice('');
    setAddSize('');
    toast.success(`Added $${Math.round(addedSize)} at ${formatPrice(price)}`);
  };

  const handleGenerateAI = async () => {
    setIsGeneratingAI(true);
    try {
      const prompt = `Analyze this open trading position:\n- Coin: ${activeTrade.coin}\n- Direction: ${activeTrade.direction}\n- Entry: ${activeTrade.entry_price}\n- Size: $${activeTrade.position_size}\n- Stop: ${activeTrade.stop_price} (Risk: $${riskUsd.toFixed(0)} / ${riskPercent.toFixed(1)}%)\n- Take: ${activeTrade.take_price} (Potential: $${potentialUsd.toFixed(0)} / ${potentialPercent.toFixed(1)}%)\n- RR Ratio: 1:${rrRatio.toFixed(1)}\n- Strategy: ${activeTrade.strategy_tag || 'Not specified'}\n- Timeframe: ${activeTrade.timeframe || 'Not specified'}\n- Market Context: ${activeTrade.market_context || 'Not specified'}\n- Entry Reason: ${activeTrade.entry_reason || 'Not specified'}\n\nProvide a concise analysis (3-4 sentences):\n1. What's good about this trade\n2. Key risks or weaknesses\n3. One actionable tip for improvement\n\nKeep it brief and practical.`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
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
      
      const newHistory = addAction({
        timestamp: new Date().toISOString(),
        action: 'generate_ai_analysis',
        description: `AI generated score ${response.score}/10`
      });
      
      await onUpdate(trade.id, { 
        ai_score: response.score,
        ai_analysis: JSON.stringify(response),
        action_history: JSON.stringify(newHistory)
      });
    } catch (error) {
      toast.error('Failed to generate AI analysis');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  return (
    <div className="bg-[#0d0d0d] p-4 relative overflow-hidden">
      <div className="absolute top-0 left-12 right-12">
        <div className="h-[2px] bg-gradient-to-r from-transparent via-[#c0c0c0]/70 to-transparent" style={{
          maskImage: 'linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)'
        }} />
      </div>

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-radial from-[#c0c0c0]/10 via-transparent to-transparent blur-2xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-radial from-[#888]/10 via-transparent to-transparent blur-2xl" />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(to right, #c0c0c0 1px, transparent 1px), linear-gradient(to bottom, #c0c0c0 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }} />
      </div>

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

      <div className="grid grid-cols-2 gap-6 relative mt-4">
        {/* LEFT: Compact Technical Data */}
        <div className="flex flex-col gap-2 h-full justify-between">
          {/* Entry & Close */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border border-[#2a2a2a] rounded-lg p-2 shadow-[0_0_15px_rgba(192,192,192,0.03)]">
                <div className="flex items-center gap-1.5 mb-1.5">
                  {isLong ? (
                    <TrendingUp className="w-3 h-3 text-emerald-400/70" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-400/70" />
                  )}
                  <span className="text-[9px] text-[#666] uppercase tracking-wide">Entry</span>
                </div>
                {isEditing ? (
                  <Input
                    type="number"
                    step="any"
                    value={editedTrade.entry_price}
                    onChange={(e) => handleFieldChange('entry_price', e.target.value)}
                    className="h-7 text-sm font-bold bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
                  />
                ) : (
                  <div className="text-sm font-bold text-[#c0c0c0]">{formatPrice(activeTrade.entry_price)}</div>
                )}
              </div>

              <div className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border border-[#2a2a2a] rounded-lg p-2 shadow-[0_0_15px_rgba(192,192,192,0.03)]">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <X className="w-3 h-3 text-[#888]" />
                  <span className="text-[9px] text-[#666] uppercase tracking-wide">Close</span>
                </div>
                {isEditing ? (
                  <Input
                    type="number"
                    step="any"
                    value={editedTrade.close_price || ''}
                    onChange={(e) => handleFieldChange('close_price', e.target.value)}
                    placeholder="—"
                    className="h-7 text-sm font-bold bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
                  />
                ) : (
                  <div className="text-sm font-bold text-[#c0c0c0]">{formatPrice(activeTrade.close_price)}</div>
                )}
              </div>
            </div>

            {/* Realized PNL - show only if partial closes exist */}
            {!isEditing && isOpen && (() => {
              const partials = trade.partial_closes ? JSON.parse(trade.partial_closes) : [];
              const totalPercent = partials.reduce((sum, p) => sum + p.percent, 0);
              const realizedPnl = trade.realized_pnl_usd || 0;
              const realizedPercent = ((realizedPnl / balance) * 100);
              return totalPercent > 0 && (
                <div className="bg-gradient-to-r from-emerald-500/15 to-blue-500/15 border border-emerald-500/40 rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] text-emerald-400/90 uppercase tracking-wide font-semibold">Realized PNL</span>
                    <span className={cn(
                      "text-sm font-bold",
                      realizedPnl >= 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                      {realizedPnl >= 0 ? `+$${formatNumber(realizedPnl)}` : `-$${formatNumber(Math.abs(realizedPnl))}`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="text-[#888]">Closed: {totalPercent}%</span>
                    <span className={cn(
                      "font-semibold",
                      realizedPnl >= 0 ? "text-emerald-400/80" : "text-red-400/80"
                    )}>
                      {realizedPercent >= 0 ? '+' : ''}{realizedPercent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Size & Balance */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border border-[#2a2a2a] rounded-lg p-2 shadow-[0_0_15px_rgba(192,192,192,0.03)]">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Package className="w-3 h-3 text-[#888]" />
                <span className="text-[9px] text-[#666] uppercase tracking-wide">Size</span>
              </div>
              {isEditing ? (
                <Input
                  type="number"
                  value={editedTrade.position_size}
                  onChange={(e) => handleFieldChange('position_size', e.target.value)}
                  className="h-7 text-sm font-bold bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
                />
              ) : (
                <div className="text-sm font-bold text-[#c0c0c0]">${formatNumber(activeTrade.position_size)}</div>
              )}
            </div>

            <div className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border border-[#2a2a2a] rounded-lg p-2 shadow-[0_0_15px_rgba(192,192,192,0.03)]">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Wallet className="w-3 h-3 text-[#888]" />
                <span className="text-[9px] text-[#666] uppercase tracking-wide">Bal.</span>
              </div>
              {isEditing ? (
                <Input
                  type="number"
                  value={editedTrade.account_balance_at_entry || balance}
                  onChange={(e) => handleFieldChange('account_balance_at_entry', e.target.value)}
                  className="h-7 text-sm font-bold bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
                />
              ) : (
                <div className="text-sm font-bold text-[#c0c0c0]">${formatNumber(balance)}</div>
              )}
            </div>
          </div>

          {/* Stop, Take & RR in ONE ROW */}
          <div className="bg-gradient-to-br from-red-500/5 via-transparent to-emerald-500/5 border border-[#2a2a2a] rounded-lg p-2.5">
            <div className="grid grid-cols-3 gap-3 items-start">
              {/* Stop Loss */}
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle className="w-3 h-3 text-red-400/70" />
                  <span className="text-[9px] text-red-400/70 uppercase tracking-wide">Stop</span>
                </div>
                {isEditing ? (
                  <Input
                    type="number"
                    step="any"
                    value={editedTrade.stop_price}
                    onChange={(e) => handleFieldChange('stop_price', e.target.value)}
                    className="h-7 text-xs font-bold bg-[#0d0d0d] border-red-500/20 text-red-400"
                  />
                ) : (
                  <>
                    <div className="text-sm font-bold text-red-400">{formatPrice(activeTrade.stop_price)}</div>
                    <div className="text-[8px] text-red-400/60 mt-0.5">${formatNumber(riskUsd)} • {riskPercent.toFixed(1)}%</div>
                  </>
                )}
              </div>

              {/* Take Profit */}
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Target className="w-3 h-3 text-emerald-400/70" />
                  <span className="text-[9px] text-emerald-400/70 uppercase tracking-wide">Take</span>
                </div>
                {isEditing ? (
                  <Input
                    type="number"
                    step="any"
                    value={editedTrade.take_price}
                    onChange={(e) => handleFieldChange('take_price', e.target.value)}
                    className="h-7 text-xs font-bold bg-[#0d0d0d] border-emerald-500/20 text-emerald-400"
                  />
                ) : (
                  <>
                    <div className="text-sm font-bold text-emerald-400">{formatPrice(activeTrade.take_price)}</div>
                    <div className="text-[8px] text-emerald-400/60 mt-0.5">${formatNumber(potentialUsd)} • {potentialPercent.toFixed(1)}%</div>
                  </>
                )}
              </div>

              {/* RR Ratio */}
              {!isEditing && (
               <div className="flex flex-col items-center justify-start border-l border-[#2a2a2a] pl-3">
                 <div className="text-[9px] text-[#666] mb-1.5">R:R</div>
                 <div className={cn(
                   "text-lg font-bold leading-tight",
                   isStopAtBE && take > 0 ? "text-emerald-400" : (rrRatio >= 2 ? "text-emerald-400" : "text-red-400")
                 )}>
                   {isStopAtBE && take > 0 ? `0:${Math.round(potentialPercent)}%` : `1:${Math.round(rrRatio)}`}
                 </div>
               </div>
              )}
            </div>
          </div>

          {/* Confidence Slider */}
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border border-[#2a2a2a] rounded-lg p-3 shadow-[0_0_15px_rgba(192,192,192,0.03)]">
            <div className="flex items-center justify-center mb-2">
              <span className="text-lg font-bold text-[#c0c0c0]">{(isEditing ? editedTrade : activeTrade).confidence || (isEditing ? editedTrade : activeTrade).confidence_level || 0}</span>
            </div>
            {isEditing ? (
              <div>
                <Slider
                  value={[editedTrade.confidence || editedTrade.confidence_level || 0]}
                  onValueChange={([val]) => {
                    handleFieldChange('confidence', val);
                    handleFieldChange('confidence_level', val);
                  }}
                  min={0}
                  max={10}
                  step={1}
                  className="mb-1"
                />
                <div className="flex justify-between text-[8px] text-[#666]">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>
            ) : (
              <div className="h-1.5 bg-[#0d0d0d] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 via-[#c0c0c0] to-emerald-500 transition-all"
                  style={{ width: `${((activeTrade.confidence || activeTrade.confidence_level || 0) / 10) * 100}%` }}
                />
              </div>
            )}
            <div className="text-center text-[9px] text-[#666] uppercase tracking-wide mt-1">Confidence</div>
          </div>

          {/* GAMBLING DETECT - always visible */}
          {(() => {
            const gamblingScore = 0;
            const bgGradient = 
              gamblingScore === 0 ? "from-emerald-500/30 via-[#1a1a1a] to-emerald-500/20" :
              gamblingScore <= 3 ? "from-emerald-500/25 via-[#1a1a1a] to-yellow-500/20" :
              gamblingScore <= 6 ? "from-yellow-500/30 via-[#1a1a1a] to-orange-500/20" :
              "from-red-500/30 via-[#1a1a1a] to-red-500/20";
            const borderColor = 
              gamblingScore === 0 ? "border-emerald-500/60" :
              gamblingScore <= 3 ? "border-yellow-500/50" :
              gamblingScore <= 6 ? "border-orange-500/60" :
              "border-red-500/60";
            const shadowColor = 
              gamblingScore === 0 ? "shadow-[0_0_30px_rgba(16,185,129,0.3)]" :
              gamblingScore <= 3 ? "shadow-[0_0_25px_rgba(234,179,8,0.25)]" :
              gamblingScore <= 6 ? "shadow-[0_0_28px_rgba(249,115,22,0.3)]" :
              "shadow-[0_0_30px_rgba(239,68,68,0.3)]";
            const textColor = 
              gamblingScore === 0 ? "text-emerald-300" :
              gamblingScore <= 3 ? "text-emerald-300" :
              gamblingScore <= 6 ? "text-orange-300" :
              "text-red-300";
            
            return (
              <div className={cn(
                "bg-gradient-to-br rounded-lg py-3 px-3 relative overflow-hidden border-2",
                bgGradient,
                borderColor,
                shadowColor
              )}>
                <div className="absolute inset-0 opacity-10" style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ff0000' fill-opacity='1'%3E%3Ccircle cx='15' cy='15' r='3'/%3E%3Ccircle cx='45' cy='15' r='3'/%3E%3Ccircle cx='15' cy='45' r='3'/%3E%3Ccircle cx='45' cy='45' r='3'/%3E%3Ccircle cx='30' cy='30' r='4'/%3E%3C/g%3E%3C/svg%3E")`
                }} />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(239,68,68,0.15),transparent_70%)]" />
                <div className="relative z-10 flex items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <span className={cn("text-2xl font-black leading-none mb-1", textColor)}>{gamblingScore}</span>
                    <div className={cn("text-[9px] uppercase tracking-wider font-bold whitespace-nowrap", textColor)}>
                      🎰 Gambling Detect
                    </div>
                  </div>
                  <div className="text-[10px] text-[#888] leading-relaxed">
                    Reason: Your risk per trade is too high.
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Screenshot Panel */}
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border border-[#2a2a2a] rounded-lg overflow-hidden shadow-[0_0_15px_rgba(192,192,192,0.03)]">
            <button 
              onClick={() => setShowScreenshot(!showScreenshot)}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#1a1a1a] transition-colors"
            >
              <div className="flex items-center gap-2">
                <Image className="w-3.5 h-3.5 text-[#888]" />
                <span className="text-[9px] text-[#666] uppercase tracking-wide">Screenshot</span>
              </div>
              <span className="text-xs text-[#666]">{showScreenshot ? '−' : '+'}</span>
            </button>
            {showScreenshot && (
              <div className="px-3 pb-3 space-y-2">
                {screenshotUrl ? (
                  <div 
                    onClick={() => setShowScreenshotModal(true)}
                    className="relative w-full h-24 bg-[#0d0d0d] rounded overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <img src={screenshotUrl} alt="Screenshot" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="text-[10px] text-[#666] text-center py-2">No screenshot</div>
                )}
                <div className="flex gap-1">
                  <Input
                    type="text"
                    placeholder="Paste URL..."
                    value={screenshotInput}
                    onChange={(e) => setScreenshotInput(e.target.value)}
                    className="h-6 text-[10px] bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0] flex-1"
                  />
                  <Button 
                    size="sm" 
                    onClick={handleScreenshotUrl}
                    className="h-6 px-2 bg-[#2a2a2a] hover:bg-[#333] text-[10px]"
                  >
                    <LinkIcon className="w-3 h-3" />
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => document.getElementById('screenshot-upload').click()}
                    className="h-6 px-2 bg-[#2a2a2a] hover:bg-[#333] text-[10px]"
                  >
                    <Paperclip className="w-3 h-3" />
                  </Button>
                  <input 
                    id="screenshot-upload" 
                    type="file" 
                    accept="image/*" 
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleScreenshotUpload(e.target.files[0])}
                  />
                </div>
                <div className="text-[8px] text-[#666] text-center">Ctrl+V to paste image</div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Analytics & Context */}
        <div className="flex flex-col gap-2.5 h-full justify-between">
          {/* Strategy */}
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border border-[#2a2a2a] rounded-lg p-2.5 shadow-[0_0_15px_rgba(192,192,192,0.03)]">
            <div className="text-[9px] text-[#666] uppercase tracking-wide mb-1.5 text-center">Strategy</div>
            {isEditing ? (
              <Input
                value={editedTrade.strategy_tag || ''}
                onChange={(e) => handleFieldChange('strategy_tag', e.target.value)}
                list="strategies"
                placeholder="Enter strategy..."
                className="h-7 text-xs bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
              />
            ) : (
              <div className="text-xs text-[#c0c0c0] text-center font-medium">
                {activeTrade.strategy_tag || <span className="text-[#555]">⋯</span>}
              </div>
            )}
            <datalist id="strategies">
              {usedStrategies.map(s => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          {/* Timeframe & Market */}
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border border-[#2a2a2a] rounded-lg p-2.5 shadow-[0_0_15px_rgba(192,192,192,0.03)]">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-[9px] text-[#666] uppercase tracking-wide">Timeframe</Label>
              <Label className="text-[9px] text-[#666] uppercase tracking-wide">Market</Label>
            </div>
            <div className="flex gap-2">
              {isEditing ? (
                <Select 
                  value={editedTrade.timeframe || ''} 
                  onValueChange={(val) => handleFieldChange('timeframe', val)}
                >
                  <SelectTrigger className="h-7 text-xs bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0] flex-1">
                    <SelectValue placeholder="TF..." className="text-[#c0c0c0]" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-[#333]">
                    <SelectItem value="scalp" className="text-white">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        <span>Scalp</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="day" className="text-white">
                      <div className="flex items-center gap-2">
                        <Timer className="w-3 h-3" />
                        <span>Day</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="swing" className="text-white">
                      <div className="flex items-center gap-2">
                        <Hourglass className="w-3 h-3" />
                        <span>Swing</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="mid_term" className="text-white">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        <span>Mid-term</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="long_term" className="text-white">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        <span>Long-term</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="spot" className="text-white">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        <span>Spot</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                activeTrade.timeframe ? (
                  <div className="h-7 flex-1 flex items-center justify-center gap-1.5 bg-gradient-to-r from-purple-500/20 via-blue-500/20 to-cyan-500/20 border border-purple-500/30 rounded-lg relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgMjAgMTAgTSAxMCAwIEwgMTAgMjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjAzIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-40" />
                    {activeTrade.timeframe === 'scalp' && <Clock className="w-3 h-3 text-purple-300 relative z-10" />}
                    {activeTrade.timeframe === 'day' && <Timer className="w-3 h-3 text-blue-300 relative z-10" />}
                    {activeTrade.timeframe === 'swing' && <Hourglass className="w-3 h-3 text-cyan-300 relative z-10" />}
                    {(activeTrade.timeframe === 'mid_term' || activeTrade.timeframe === 'long_term' || activeTrade.timeframe === 'spot') && <Calendar className="w-3 h-3 text-purple-300 relative z-10" />}
                    <span className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-blue-300 to-cyan-300 uppercase tracking-wider relative z-10">
                      {activeTrade.timeframe}
                    </span>
                  </div>
                ) : (
                  <div className="h-7 flex-1 flex items-center px-2 bg-[#0d0d0d] border border-[#2a2a2a] rounded text-xs text-[#666]">—</div>
                )
              )}
              
              <div className="flex gap-1">
                <Button
                  size="sm"
                  onClick={() => isEditing && handleFieldChange('market_context', 'Bullish')}
                  disabled={!isEditing}
                  className={cn(
                    "h-7 px-2.5 text-[10px]",
                    activeTrade.market_context === 'Bullish' 
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
                      : "bg-[#0d0d0d] border-[#2a2a2a] text-[#666] hover:text-[#888]"
                  )}
                >
                  Bull
                </Button>
                <Button
                  size="sm"
                  onClick={() => isEditing && handleFieldChange('market_context', 'Bearish')}
                  disabled={!isEditing}
                  className={cn(
                    "h-7 px-2.5 text-[10px]",
                    activeTrade.market_context === 'Bearish' 
                      ? "bg-red-500/20 text-red-400 border-red-500/30" 
                      : "bg-[#0d0d0d] border-[#2a2a2a] text-[#666] hover:text-[#888]"
                  )}
                >
                  Bear
                </Button>
              </div>
            </div>
          </div>

          {/* Entry Reason */}
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border border-[#2a2a2a] rounded-lg p-2.5 shadow-[0_0_15px_rgba(192,192,192,0.03)] flex-grow min-h-[160px]">
            <div className="text-[9px] text-[#666] uppercase tracking-wide mb-1.5 text-center">Entry Reason</div>
            {isEditing ? (
              <Textarea
                value={editedTrade.entry_reason || ''}
                onChange={(e) => handleFieldChange('entry_reason', e.target.value)}
                placeholder="Why did you enter?"
                className="h-[130px] text-xs bg-[#0d0d0d] border-[#2a2a2a] resize-none text-[#c0c0c0]"
              />
            ) : (
              <div className="h-[130px] p-2 text-xs text-[#c0c0c0] whitespace-pre-wrap overflow-y-auto flex items-center justify-center">
                {activeTrade.entry_reason || <span className="text-[#555] text-2xl">⋯</span>}
              </div>
            )}
          </div>

          {/* Actions History */}
          <div className="bg-gradient-to-br from-orange-500/20 via-[#1a1a1a] to-orange-500/10 border border-orange-500/40 rounded-lg shadow-[0_0_20px_rgba(249,115,22,0.15)] flex items-stretch min-h-[60px] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 via-transparent to-orange-500/5 pointer-events-none" />
            <button 
              onClick={() => setCurrentActionIndex(Math.min(actionHistory.length - 1, currentActionIndex + 1))}
              disabled={currentActionIndex >= actionHistory.length - 1 || actionHistory.length === 0}
              className="w-8 flex items-center justify-center text-orange-400/70 hover:text-orange-300 disabled:opacity-30 disabled:cursor-not-allowed border-r border-orange-500/30 relative z-10"
            >
              ←
            </button>
            <div className="flex-1 flex flex-col items-center justify-center px-3 py-2 relative z-10">
              {actionHistory.length > 0 ? (
                <>
                  <p className="text-[10px] text-orange-100 text-center leading-relaxed font-medium">
                    {actionHistory[currentActionIndex]?.description || '—'}
                  </p>
                  <p className="text-[8px] text-orange-400/50 mt-1">
                    {actionHistory[currentActionIndex]?.timestamp && new Date(actionHistory[currentActionIndex].timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </>
              ) : (
                <p className="text-[10px] text-orange-400/50 text-center">No actions yet</p>
              )}
            </div>
            <button 
              onClick={() => setCurrentActionIndex(Math.max(0, currentActionIndex - 1))}
              disabled={currentActionIndex === 0 || actionHistory.length === 0}
              className="w-8 flex items-center justify-center text-orange-400/70 hover:text-orange-300 disabled:opacity-30 disabled:cursor-not-allowed border-l border-orange-500/30 relative z-10"
            >
              →
            </button>
          </div>



          {/* AI Analysis */}
          <div className="bg-gradient-to-br from-yellow-500/10 via-[#1a1a1a] to-amber-500/10 border border-yellow-500/30 rounded-lg overflow-hidden shadow-[0_0_20px_rgba(234,179,8,0.1)]">
            <button 
              onClick={() => setShowAI(!showAI)}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#1a1a1a]/50 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-[10px] text-yellow-400 uppercase tracking-wide font-semibold">AI Score</span>
              </div>
              <div className="flex items-center gap-2">
                {activeTrade.ai_score ? (
                  <span className={cn(
                    "text-base font-bold",
                    activeTrade.ai_score >= 7 ? "text-emerald-400" : activeTrade.ai_score >= 5 ? "text-yellow-400" : "text-red-400"
                  )}>
                    {activeTrade.ai_score}/10
                  </span>
                ) : (
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={(e) => { e.stopPropagation(); handleGenerateAI(); }}
                    disabled={isGeneratingAI} 
                    className="h-6 text-[10px] px-2 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10"
                  >
                    {isGeneratingAI ? 'Analyzing...' : 'Generate'}
                  </Button>
                )}
                <span className="text-xs text-[#666]">{showAI ? '−' : '+'}</span>
              </div>
            </button>
            {showAI && aiAnalysis && (
              <div className="px-3 pb-3 space-y-2 text-[10px]">
                <div className="flex gap-1.5">
                  <span className="text-emerald-400 shrink-0">✓</span>
                  <span className="text-[#c0c0c0]">{aiAnalysis.strengths}</span>
                </div>
                <div className="flex gap-1.5">
                  <span className="text-yellow-400 shrink-0">⚠</span>
                  <span className="text-[#c0c0c0]">{aiAnalysis.risks}</span>
                </div>
                <div className="flex gap-1.5">
                  <span className="text-blue-400 shrink-0">💡</span>
                  <span className="text-[#c0c0c0]">{aiAnalysis.tip}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>



      {/* INVALID DATA WARNING */}
      {!entry || !stop || !size || entry <= 0 || stop <= 0 || size <= 0 ? (
        <div className="mt-4 p-3 bg-red-500/20 border border-red-500/40 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <div>
            <p className="text-sm font-bold text-red-400">INVALID TRADE DATA</p>
            <p className="text-xs text-red-300/80">Missing required fields. Please edit or delete this trade.</p>
          </div>
        </div>
      ) : null}

      {/* Action Buttons */}
      {!isEditing && isOpen && entry && stop && size && entry > 0 && stop > 0 && size > 0 && (
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
              <Percent className="w-3 h-3 mr-1" /> Partial
            </Button>
          </div>
          
          <div className="flex gap-2">
            <Button 
              size="sm" 
              onClick={handleMoveToBE} 
              className="bg-[#1a1a1a] text-[#c0c0c0] hover:bg-[#252525] border border-[#333] h-7 text-xs"
            >
              <Target className="w-3 h-3 mr-1" /> SL→BE
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
        <DialogContent className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.2)] [&>button]:text-white [&>button]:hover:text-white">
          <DialogHeader>
            <DialogTitle className="text-[#c0c0c0] text-lg">Close Position</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-[#888] mb-2 block">Close Price</Label>
              <Input
                type="number"
                step="any"
                value={closePrice}
                onChange={(e) => setClosePrice(e.target.value)}
                placeholder="Enter close price..."
                className="bg-[#0d0d0d] border-red-500/30 text-[#c0c0c0] h-12 text-lg"
              />
            </div>
            <div>
              <Label className="text-sm text-[#888] mb-2 block">Comment (optional)</Label>
              <Textarea
                value={closeComment}
                onChange={(e) => setCloseComment(e.target.value)}
                placeholder="Why did you close?"
                className="bg-[#0d0d0d] border-red-500/30 h-20 resize-none text-[#c0c0c0]"
              />
            </div>
            <Button onClick={handleClosePosition} className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold h-12">
              Confirm Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPartialModal} onOpenChange={setShowPartialModal}>
        <DialogContent className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.2)] [&>button]:text-white [&>button]:hover:text-white">
          <DialogHeader>
            <DialogTitle className="text-[#c0c0c0] text-lg">Partial Close Position</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-3">
                <Label className="text-sm text-[#888]">Close Percentage</Label>
                <span className="text-2xl font-bold text-amber-400">{partialPercent}%</span>
              </div>
              <div className="relative">
                <Slider
                  value={[partialPercent]}
                  onValueChange={([val]) => setPartialPercent(val)}
                  min={1}
                  max={100}
                  step={1}
                  className="mb-2"
                />
                <div className="flex justify-between px-1">
                  {[0, 25, 50, 75, 100].map(val => (
                    <button 
                      key={val}
                      onClick={() => setPartialPercent(val || 1)}
                      className={cn(
                        "w-2 h-2 rounded-full transition-all",
                        partialPercent === val || (val === 0 && partialPercent < 25) || (val === 100 && partialPercent > 75) 
                          ? "bg-amber-400 scale-125" 
                          : "bg-[#444] hover:bg-[#666]"
                      )}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[9px] text-[#666] mt-1 px-1">
                  <span>0%</span>
                  <span>25%</span>
                  <span>50%</span>
                  <span>75%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
            <div>
              <Label className="text-sm text-[#888] mb-2 block">Close Price</Label>
              <Input
                type="number"
                step="any"
                value={partialPrice}
                onChange={(e) => setPartialPrice(e.target.value)}
                placeholder="Enter close price..."
                className="bg-[#0d0d0d] border-amber-500/30 text-[#c0c0c0] h-12 text-lg"
              />
            </div>
            <Button onClick={handlePartialClose} className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-semibold h-12">
              Confirm Partial Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.2)] [&>button]:text-white [&>button]:hover:text-white">
          <DialogHeader>
            <DialogTitle className="text-[#c0c0c0] text-lg">Add to Position</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-[#888] mb-2 block">Entry Price</Label>
              <Input
                type="number"
                step="any"
                value={addPrice}
                onChange={(e) => setAddPrice(e.target.value)}
                placeholder="New entry price..."
                className="bg-[#0d0d0d] border-blue-500/30 text-[#c0c0c0] h-12 text-lg"
              />
            </div>
            <div>
              <Label className="text-sm text-[#888] mb-2 block">Size ($)</Label>
              <Input
                type="number"
                value={addSize}
                onChange={(e) => setAddSize(e.target.value)}
                placeholder="Additional size..."
                className="bg-[#0d0d0d] border-blue-500/30 text-[#c0c0c0] h-12 text-lg"
              />
            </div>
            <Button onClick={handleAddPosition} className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold h-12">
              Confirm Add Position
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Screenshot Modal */}
      <Dialog open={showScreenshotModal} onOpenChange={setShowScreenshotModal}>
        <DialogContent className="bg-[#1a1a1a] border-[#333] max-w-4xl [&>button]:text-white [&>button]:hover:text-white">
          <DialogHeader>
            <DialogTitle className="text-[#c0c0c0]">Screenshot</DialogTitle>
          </DialogHeader>
          <div className="w-full max-h-[70vh] overflow-auto">
            <img src={screenshotUrl} alt="Screenshot" className="w-full h-auto" />
          </div>
        </DialogContent>
      </Dialog>
      </div>
      );
      }