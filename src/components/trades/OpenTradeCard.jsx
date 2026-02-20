import { useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Zap, TrendingUp, AlertTriangle, Target, Plus, Percent, Edit2, Check, X, TrendingDown, Wallet, Package, Image, Link as LinkIcon, Paperclip, Clock, Calendar, Timer, Hourglass, Share2, Copy, Download, Trash2, Beaker } from 'lucide-react';
import { cn } from "@/lib/utils";
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";
import { useQuery } from '@tanstack/react-query';
import ShareTradeCard from './ShareTradeCard';
import { avgEntryFromHistory, pnlUsd, riskUsd as calcRiskUsd, parseNum } from '../utils/tradeMath';

const formatPrice = (price) => {
  if (price === undefined || price === null || price === '') return '—';
  const p = parseFloat(price);
  if (isNaN(p)) return '—';
  
  if (Math.abs(p) >= 1) {
    // For numbers >= 1: show up to 4 significant digits total (before + after decimal)
    const str = p.toPrecision(4);
    const formatted = parseFloat(str).toString(); // Remove trailing zeros
    return `$${formatted}`;
  }
  
  // For numbers < 1: show 4 significant digits after leading zeros
  const str = p.toFixed(20);
  const match = str.match(/\.0*([1-9]\d{0,3})/);
  if (match) {
    const zeros = str.indexOf(match[1]) - str.indexOf('.') - 1;
    const formatted = p.toFixed(zeros + 4).replace(/0+$/, '');
    return `$${formatted}`;
  }
  return `$${p.toFixed(4).replace(/\.?0+$/, '')}`;
};

const formatNumber = (num) => {
  if (num === undefined || num === null || num === '') return '—';
  const n = parseFloat(num);
  if (isNaN(n)) return '—';
  return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
};

export default function OpenTradeCard({ trade, onUpdate, currentBalance, formatDate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTrade, setEditedTrade] = useState(trade);
  const [hasChanges, setHasChanges] = useState(false);
  const lang = localStorage.getItem('tradingpro_lang') || 'ru';
  
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
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareImageUrl, setShareImageUrl] = useState('');

  const { data: allTrades } = useQuery({
    queryKey: ['trades'],
    queryFn: async () => {
      const user = await base44.auth.me();
      if (!user) return [];
      const profiles = await base44.entities.UserProfile.filter({ created_by: user.email });
      const activeProfile = profiles.find(p => p.is_active);
      if (!activeProfile) return [];
      return base44.entities.Trade.filter({ 
        created_by: user.email,
        profile_id: activeProfile.id 
      }, '-date_open', 500);
    },
  });

  const { data: tradeTemplates = [] } = useQuery({
    queryKey: ['tradeTemplates'],
    queryFn: async () => {
      const user = await base44.auth.me();
      if (!user) return [];
      const profiles = await base44.entities.UserProfile.filter({ created_by: user.email }, '-created_date', 10);
      const activeProfile = profiles.find(p => p.is_active);
      if (!activeProfile) return [];
      return base44.entities.TradeTemplates.filter({ 
        created_by: user.email,
        profile_id: activeProfile.id 
      }, '-created_date', 1);
    },
  });

  const templates = tradeTemplates[0] || {};
  let strategyTemplates = [];
  let entryReasonTemplates = [];
  
  try {
    strategyTemplates = templates.strategy_templates ? JSON.parse(templates.strategy_templates) : [];
    entryReasonTemplates = templates.entry_reason_templates ? JSON.parse(templates.entry_reason_templates) : [];
  } catch (e) {
    strategyTemplates = [];
    entryReasonTemplates = [];
  }

  const isOpen = !trade.close_price && trade.position_size > 0;
  const isLong = trade.direction === 'Long';
  const balance = trade.account_balance_at_entry || currentBalance || 100000;

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

  const entry = parseFloat(activeTrade.entry_price) || 0;
  const stop = parseFloat(activeTrade.stop_price) || 0;
  const take = parseFloat(activeTrade.take_price) || 0;
  const size = parseFloat(activeTrade.position_size) || 0;

  // Calculate if stop is defined and at breakeven - null when no stop
  const hasStop = stop && stop > 0;
  const isStopAtBE = hasStop && Math.abs(stop - entry) < 0.0001;
  
  // Risk calculation - null when stop is missing
  const riskUsd = (() => {
    if (!hasStop) return null;
    if (isStopAtBE) return 0;
    if (activeTrade.risk_usd !== undefined && activeTrade.risk_usd !== null && activeTrade.risk_usd > 0) {
      return activeTrade.risk_usd;
    }
    if (!entry || !size) return null;
    const stopDistance = Math.abs(entry - stop);
    return (stopDistance / entry) * size;
  })();
  
  const riskPercent = riskUsd !== null && riskUsd !== undefined
    ? (riskUsd / balance) * 100
    : null;

  // Potential profit calculation - null when no take
  const hasTake = take && take > 0;
  const takeDistance = hasTake ? Math.abs(take - entry) : 0;
  const potentialUsd = hasTake && entry > 0 && size > 0 ? (takeDistance / entry) * size : null;
  const potentialPercent = potentialUsd !== null ? (potentialUsd / balance) * 100 : null;

  // Calculate RR - null when undefined
  let rrRatio = null;
  
  if (isStopAtBE && hasTake && trade.original_risk_usd && trade.original_risk_usd > 0) {
    rrRatio = potentialUsd / trade.original_risk_usd;
  } else if (riskUsd && riskUsd > 0 && hasTake && potentialUsd !== null) {
    rrRatio = potentialUsd / riskUsd;
  } else if (activeTrade.rr_ratio !== undefined && activeTrade.rr_ratio !== null && activeTrade.rr_ratio > 0) {
    rrRatio = activeTrade.rr_ratio;
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
    if (editedTrade.close_price && parseFloat(editedTrade.close_price) > 0) {
      await handleCloseFromEdit(parseFloat(editedTrade.close_price));
      return;
    }

    const newEntry = parseFloat(editedTrade.entry_price) || 0;
    const newStop = parseFloat(editedTrade.stop_price) || 0;
    const newTake = parseFloat(editedTrade.take_price) || 0;
    const newSize = parseFloat(editedTrade.position_size) || 0;

    const newStopDistance = Math.abs(newEntry - newStop);
    const newRiskUsd = (newStopDistance / newEntry) * newSize;
    const newRiskPercent = (newRiskUsd / balance) * 100;

    const newTakeDistance = Math.abs(newTake - newEntry);
    const newPotentialUsd = (newTakeDistance / newEntry) * newSize;
    
    const originalRiskUsd = trade.original_risk_usd || newRiskUsd;
    let newRR = 0;
    
    if (newRiskUsd === 0 && newTake > 0) {
      newRR = originalRiskUsd > 0 ? newPotentialUsd / originalRiskUsd : 0;
    } else {
      newRR = newRiskUsd > 0 ? newPotentialUsd / newRiskUsd : 0;
    }

    const updated = {
      ...editedTrade,
      risk_usd: newRiskUsd,
      risk_percent: newRiskPercent,
      rr_ratio: newRR,
      original_entry_price: editedTrade.original_entry_price || trade.original_entry_price || newEntry,
      original_stop_price: editedTrade.original_stop_price || trade.original_stop_price || newStop,
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
    if (!price || parseFloat(price) <= 0) {
      // If close_price is being cleared, reopen the trade
      const newHistory = addAction({
        timestamp: new Date().toISOString(),
        action: 'reopen_trade',
        description: 'Trade reopened'
      });
      
      const updated = {
        ...editedTrade,
        close_price: null,
        date_close: null,
        pnl_usd: 0,
        pnl_percent_of_balance: 0,
        r_multiple: null,
        action_history: JSON.stringify(newHistory)
      };
      await onUpdate(trade.id, updated);
      setIsEditing(false);
      toast.success('Trade reopened');
      return;
    }

    const entryPrice = parseNum(trade.entry_price);
    const currentPositionSize = parseNum(trade.position_size);
    
    // Calculate max position size
    let maxPositionSize = currentPositionSize;
    try {
      const partialCloses = trade.partial_closes ? JSON.parse(trade.partial_closes) : [];
      const totalClosed = partialCloses.reduce((sum, close) => sum + parseNum(close.size_usd), 0);
      maxPositionSize = currentPositionSize + totalClosed;
    } catch {}
    
    const realizedBefore = parseNum(trade.realized_pnl_usd);
    const remainingPnl = pnlUsd(trade.direction, entryPrice, price, currentPositionSize);
    const totalPnl = realizedBefore + remainingPnl;
    const maxRiskUsd = parseNum(trade.max_risk_usd) || parseNum(trade.original_risk_usd) || riskUsd;

    const closeData = {
      ...editedTrade,
      close_price: price,
      date_close: new Date().toISOString(),
      pnl_usd: totalPnl,
      realized_pnl_usd: totalPnl,
      pnl_percent_of_balance: (totalPnl / balance) * 100,
      r_multiple: maxRiskUsd > 0 ? totalPnl / maxRiskUsd : 0,
      position_size: maxPositionSize,
      actual_duration_minutes: Math.floor((new Date().getTime() - new Date(trade.date_open || trade.date).getTime()) / 60000),
      risk_usd: 0,
      risk_percent: 0,
      rr_ratio: 0,
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
    const entryPrice = parseNum(activeTrade.entry_price);
    const takePrice = parseNum(activeTrade.take_price);
    const currentSize = parseNum(activeTrade.position_size);
    
    // Calculate potential profit in USD
    const takeDistance = Math.abs(takePrice - entryPrice);
    const potentialUsd = (takeDistance / entryPrice) * currentSize;
    
    const originalRisk = parseNum(trade.original_risk_usd) || riskUsd;
    const maxRiskUsd = parseNum(trade.max_risk_usd) || originalRisk;
    
    const newHistory = addAction({
      timestamp: new Date().toISOString(),
      action: 'move_sl_be',
      description: `Stop moved to breakeven at ${formatPrice(entryPrice)}`
    });
    
    const updated = {
      stop_price: entryPrice,
      original_stop_price: activeTrade.original_stop_price || activeTrade.stop_price,
      original_risk_usd: trade.original_risk_usd || riskUsd,
      max_risk_usd: maxRiskUsd,
      risk_usd: 0,
      risk_percent: 0,
      rr_ratio: originalRisk > 0 ? potentialUsd / originalRisk : 0,
      action_history: JSON.stringify(newHistory)
    };
    await onUpdate(trade.id, updated);
    toast.success('Stop moved to breakeven');
  };

  const handleHitSL = async () => {
    const entryPrice = parseFloat(activeTrade.entry_price) || 0;
    const currentPositionSize = parseFloat(activeTrade.position_size) || 0;
    
    // Calculate max position size
    let maxPositionSize = currentPositionSize;
    try {
      const partialCloses = trade.partial_closes ? JSON.parse(trade.partial_closes) : [];
      const totalClosed = partialCloses.reduce((sum, close) => sum + (parseFloat(close.size_usd) || 0), 0);
      maxPositionSize = currentPositionSize + totalClosed;
    } catch {}
    
    const maxRiskUsd = trade.max_risk_usd || trade.original_risk_usd || riskUsd;
    const stopPrice = activeTrade.stop_price || 0;
    const realizedPnl = trade.realized_pnl_usd || 0;

    const currentPnl = isLong 
      ? ((stopPrice - entryPrice) / entryPrice) * currentPositionSize
      : ((entryPrice - stopPrice) / entryPrice) * currentPositionSize;

    const totalPnl = realizedPnl + currentPnl;

    const newHistory = addAction({
      timestamp: new Date().toISOString(),
      action: 'hit_sl',
      description: `Hit Stop Loss at ${formatPrice(stopPrice)} with ${totalPnl >= 0 ? `+$${Math.round(totalPnl)}` : `-$${Math.round(Math.abs(totalPnl))}`} total`
    });

    const closeData = {
      close_price: stopPrice,
      date_close: new Date().toISOString(),
      pnl_usd: totalPnl,
      pnl_percent_of_balance: (totalPnl / balance) * 100,
      r_multiple: maxRiskUsd && maxRiskUsd > 0 ? totalPnl / maxRiskUsd : null,
      realized_pnl_usd: totalPnl,
      position_size: maxPositionSize, // Save max size for closed trade
      actual_duration_minutes: Math.floor((new Date().getTime() - new Date(trade.date_open || trade.date).getTime()) / 60000),
      risk_usd: null,
      risk_percent: null,
      rr_ratio: null,
      action_history: JSON.stringify(newHistory)
    };

    await onUpdate(trade.id, closeData);
    toast.success('Position closed at Stop Loss');
  };

  const handleHitTP = async () => {
    const entryPrice = parseFloat(activeTrade.entry_price) || 0;
    const currentPositionSize = parseFloat(activeTrade.position_size) || 0;
    
    // Calculate max position size
    let maxPositionSize = currentPositionSize;
    try {
      const partialCloses = trade.partial_closes ? JSON.parse(trade.partial_closes) : [];
      const totalClosed = partialCloses.reduce((sum, close) => sum + (parseFloat(close.size_usd) || 0), 0);
      maxPositionSize = currentPositionSize + totalClosed;
    } catch {}
    
    const maxRiskUsd = trade.max_risk_usd || trade.original_risk_usd || riskUsd;
    const takePrice = activeTrade.take_price || 0;
    const realizedPnl = trade.realized_pnl_usd || 0;

    const currentPnl = isLong 
      ? ((takePrice - entryPrice) / entryPrice) * currentPositionSize
      : ((entryPrice - takePrice) / entryPrice) * currentPositionSize;
    
    const totalPnl = realizedPnl + currentPnl;

    const newHistory = addAction({
      timestamp: new Date().toISOString(),
      action: 'hit_tp',
      description: `Hit Take Profit at ${formatPrice(takePrice)} with ${totalPnl >= 0 ? `+$${Math.round(totalPnl)}` : `-$${Math.round(Math.abs(totalPnl))}`} total`
    });

    const closeData = {
      close_price: takePrice,
      date_close: new Date().toISOString(),
      pnl_usd: totalPnl,
      pnl_percent_of_balance: (totalPnl / balance) * 100,
      r_multiple: maxRiskUsd && maxRiskUsd > 0 ? totalPnl / maxRiskUsd : null,
      realized_pnl_usd: totalPnl,
      position_size: maxPositionSize, // Save max size for closed trade
      actual_duration_minutes: Math.floor((new Date().getTime() - new Date(trade.date_open || trade.date).getTime()) / 60000),
      risk_usd: null,
      risk_percent: null,
      rr_ratio: null,
      action_history: JSON.stringify(newHistory)
    };

    await onUpdate(trade.id, closeData);
    toast.success('Position closed at Take Profit');
  };

  const handleClosePosition = async () => {
    const price = parseFloat(closePrice);
    if (!price) return;

    const entryPrice = parseFloat(activeTrade.entry_price) || 0;
    const currentPositionSize = parseFloat(activeTrade.position_size) || 0;
    
    // Calculate max position size (for display)
    let maxPositionSize = currentPositionSize;
    try {
      const partialCloses = trade.partial_closes ? JSON.parse(trade.partial_closes) : [];
      const totalClosed = partialCloses.reduce((sum, close) => sum + (parseFloat(close.size_usd) || 0), 0);
      maxPositionSize = currentPositionSize + totalClosed;
    } catch {}
    
    const maxRiskUsd = trade.max_risk_usd || trade.original_risk_usd || riskUsd;
    const realizedPnl = trade.realized_pnl_usd || 0;

    const remainingPnl = isLong 
      ? ((price - entryPrice) / entryPrice) * currentPositionSize
      : ((entryPrice - price) / entryPrice) * currentPositionSize;

    const totalPnl = realizedPnl + remainingPnl;

    const newHistory = addAction({
      timestamp: new Date().toISOString(),
      action: 'close_position',
      description: `Closed position at ${formatPrice(price)} with ${totalPnl >= 0 ? `+$${Math.round(totalPnl)}` : `-$${Math.round(Math.abs(totalPnl))}`} total ${totalPnl >= 0 ? 'profit' : 'loss'}`
    });

    const closeData = {
      close_price: price,
      date_close: new Date().toISOString(),
      pnl_usd: totalPnl,
      pnl_percent_of_balance: (totalPnl / balance) * 100,
      r_multiple: maxRiskUsd && maxRiskUsd > 0 ? totalPnl / maxRiskUsd : null,
      realized_pnl_usd: totalPnl,
      position_size: maxPositionSize, // Save max size for closed trade
      close_comment: closeComment,
      actual_duration_minutes: Math.floor((new Date().getTime() - new Date(trade.date_open || trade.date).getTime()) / 60000),
      risk_usd: null,
      risk_percent: null,
      rr_ratio: null,
      action_history: JSON.stringify(newHistory)
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

    // Recalculate risk - null if no stop
    if (activeTrade.stop_price && activeTrade.stop_price > 0) {
      const newStopDistance = Math.abs(activeTrade.entry_price - activeTrade.stop_price);
      updated.risk_usd = (newStopDistance / activeTrade.entry_price) * remainingSize;
      updated.risk_percent = (updated.risk_usd / balance) * 100;
    } else {
      updated.risk_usd = null;
      updated.risk_percent = null;
    }

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
      updated.r_multiple = maxRiskUsd && maxRiskUsd > 0 ? updated.pnl_usd / maxRiskUsd : null;
      updated.actual_duration_minutes = Math.floor((new Date().getTime() - new Date(trade.date_open || trade.date).getTime()) / 60000);
      updated.risk_usd = null;
      updated.risk_percent = null;
      updated.rr_ratio = null;
    }

    await onUpdate(trade.id, updated);
    setShowPartialModal(false);
    setPartialPrice('');
    toast.success(`Partially closed ${partialPercent}% at ${formatPrice(price)}`);
  };

  const handleAddPosition = async () => {
    const price = parseNum(addPrice);
    const addedSize = parseNum(addSize);
    if (!price || !addedSize) return;

    const oldSize = parseNum(activeTrade.position_size);
    const newSize = oldSize + addedSize;
    const oldEntry = parseNum(activeTrade.entry_price);

    const addsHistory = trade.adds_history ? JSON.parse(trade.adds_history) : [];
    addsHistory.push({
      price,
      size_usd: addedSize,
      timestamp: new Date().toISOString()
    });

    // Calculate new entry using proper DCA math
    const tempTrade = {
      ...trade,
      position_size: newSize,
      adds_history: JSON.stringify(addsHistory)
    };
    const historyData = avgEntryFromHistory(tempTrade);
    const newEntry = historyData.avgEntry;

    const newHistory = addAction({
      timestamp: new Date().toISOString(),
      action: 'add_position',
      description: `Added $${Math.round(addedSize)} at ${formatPrice(price)}`
    });

    // Calculate new risk based on NEW entry and existing stop
    const stopPrice = parseNum(activeTrade.stop_price);
    const newRiskUsd = calcRiskUsd(newEntry, stopPrice, newSize);
    const newRiskPercent = (newRiskUsd / balance) * 100;

    // Calculate potential profit
    const takePrice = parseNum(activeTrade.take_price);
    const newTakeDistance = Math.abs(takePrice - newEntry);
    const newPotentialUsd = (newTakeDistance / newEntry) * newSize;
    
    // Track max risk
    const originalRiskUsd = parseNum(trade.original_risk_usd) || riskUsd;
    const currentMaxRisk = Math.max(parseNum(trade.max_risk_usd) || originalRiskUsd, newRiskUsd);
    
    // Calculate RR - use max_risk_usd for proper RR after averaging
    let newRR = 0;
    if (newRiskUsd === 0 && newTakeDistance > 0) {
      newRR = originalRiskUsd > 0 ? newPotentialUsd / originalRiskUsd : 0;
    } else {
      newRR = currentMaxRisk > 0 ? newPotentialUsd / currentMaxRisk : 0;
    }

    const updated = {
      entry_price: newEntry,
      position_size: newSize,
      stop_price: stopPrice,
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

  const calcCurrentPnl = () => {
    if (!isOpen) return 0;
    const currentPrice = parseFloat(activeTrade.entry_price) || 0;
    const entryPrice = parseFloat(activeTrade.entry_price) || 0;
    const currentSize = parseFloat(activeTrade.position_size) || 0;
    const realizedPnl = parseFloat(trade.realized_pnl_usd) || 0;
    
    const unrealizedPnl = isLong 
      ? ((currentPrice - entryPrice) / entryPrice) * currentSize
      : ((entryPrice - currentPrice) / entryPrice) * currentSize;
    
    return realizedPnl + unrealizedPnl;
  };

  const handleGenerateAI = async () => {
    setIsGeneratingAI(true);
    try {
      const riskStr = riskUsd !== null && riskPercent !== null 
        ? `(Risk: $${riskUsd.toFixed(0)} / ${riskPercent.toFixed(1)}%)` 
        : '(Risk: undefined)';
      const potentialStr = potentialUsd !== null && potentialPercent !== null 
        ? `(Potential: $${potentialUsd.toFixed(0)} / ${potentialPercent.toFixed(1)}%)` 
        : '(Potential: undefined)';
      const rrStr = rrRatio !== null ? `1:${rrRatio.toFixed(1)}` : 'undefined';
      
      const prompt = `Analyze this open trading position:\n- Coin: ${activeTrade.coin}\n- Direction: ${activeTrade.direction}\n- Entry: ${activeTrade.entry_price}\n- Size: $${activeTrade.position_size}\n- Stop: ${activeTrade.stop_price} ${riskStr}\n- Take: ${activeTrade.take_price} ${potentialStr}\n- RR Ratio: ${rrStr}\n- Strategy: ${activeTrade.strategy_tag || 'Not specified'}\n- Timeframe: ${activeTrade.timeframe || 'Not specified'}\n- Market Context: ${activeTrade.market_context || 'Not specified'}\n- Entry Reason: ${activeTrade.entry_reason || 'Not specified'}\n\nProvide a concise analysis (3-4 sentences):\n1. What's good about this trade\n2. Key risks or weaknesses\n3. One actionable tip for improvement\n\nKeep it brief and practical.`;

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

      <div className="absolute top-3 right-3 flex gap-1.5 z-10">
        {isEditing ? (
          <>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={handleSave} 
              disabled={!hasChanges}
              className={cn(
                "h-7 w-7 p-0 rounded-md",
                hasChanges ? "hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-[#444] border border-[#2a2a2a]"
              )}
            >
              <Check className="w-3.5 h-3.5" />
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={handleCancel} 
              className="h-7 w-7 p-0 rounded-md hover:bg-[#2a2a2a] text-[#888] border border-[#2a2a2a]"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </>
        ) : (
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={handleEdit} 
            className="h-7 w-7 p-0 rounded-md hover:bg-[#2a2a2a] border border-[#2a2a2a]"
          >
            <Edit2 className="w-3.5 h-3.5 text-[#888] hover:text-[#c0c0c0]" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-[1fr,1px,1fr] gap-0 relative mt-3">
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-2.5 pr-4">
          {/* Row 1: Entry & Close */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#131313] border border-[#2a2a2a] rounded-xl p-2.5">
              <div className="text-[9px] text-[#666] uppercase tracking-wider mb-1.5">Entry</div>
              {isEditing ? (
                <Input
                  type="number"
                  step="any"
                  value={editedTrade.entry_price}
                  onChange={(e) => handleFieldChange('entry_price', e.target.value)}
                  className="h-7 text-sm font-mono bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
                />
              ) : (
                <>
                  <div className="text-base font-mono font-bold text-[#e0e0e0] tabular-nums">{formatPrice(activeTrade.entry_price)}</div>
                  <div className="text-[8px] text-[#555] mt-1 font-mono">
                    {(() => {
                      const dateStr = trade.date_open || trade.date;
                      const date = new Date(dateStr);
                      return date.toLocaleString('ru-RU', { 
                        day: '2-digit', 
                        month: '2-digit',
                        hour: '2-digit', 
                        minute: '2-digit' 
                      });
                    })()}
                  </div>
                </>
              )}
            </div>

            <div className="bg-[#131313] border border-[#2a2a2a] rounded-xl p-2.5">
              <div className="text-[9px] text-[#666] uppercase tracking-wider mb-1.5">Close</div>
              {isEditing ? (
                <Input
                  type="number"
                  step="any"
                  value={editedTrade.close_price || ''}
                  onChange={(e) => handleFieldChange('close_price', e.target.value)}
                  placeholder="—"
                  className="h-7 text-sm font-mono bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
                />
              ) : (
                <>
                  <div className="text-base font-mono font-bold text-[#e0e0e0] tabular-nums">
                    {activeTrade.close_price ? formatPrice(activeTrade.close_price) : '—'}
                  </div>
                  {!activeTrade.close_price && (
                    <div className="text-[8px] text-[#555] mt-1">Waiting...</div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Row 2: Size & Balance */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#131313] border border-[#2a2a2a] rounded-xl p-2.5">
              <div className="text-[9px] text-[#666] uppercase tracking-wider mb-1.5">Size</div>
              {isEditing ? (
                <Input
                  type="number"
                  value={editedTrade.position_size}
                  onChange={(e) => handleFieldChange('position_size', e.target.value)}
                  className="h-7 text-sm font-mono bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
                />
              ) : (
                <div className="text-base font-mono font-bold text-[#e0e0e0] tabular-nums truncate">
                  ${formatNumber(activeTrade.position_size)}
                </div>
              )}
            </div>

            <div className="bg-[#131313] border border-[#2a2a2a] rounded-xl p-2.5">
              <div className="text-[9px] text-[#666] uppercase tracking-wider mb-1.5">Bal.</div>
              {isEditing ? (
                <Input
                  type="number"
                  value={editedTrade.account_balance_at_entry || balance}
                  onChange={(e) => handleFieldChange('account_balance_at_entry', e.target.value)}
                  className="h-7 text-sm font-mono bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
                />
              ) : (
                <div className="text-base font-mono font-bold text-[#e0e0e0] tabular-nums truncate">
                  ${formatNumber(balance)}
                </div>
              )}
            </div>
          </div>

          {/* Row 3: Stop, Take & R:R */}
          <div className="bg-[#131313] border border-[#2a2a2a] rounded-xl p-3">
            <div className="grid grid-cols-3 gap-3">
              {/* Stop */}
              <div className="flex flex-col border-l-2 border-red-500/40 pl-2">
                <div className="text-[9px] text-[#666] uppercase tracking-wider mb-1.5">Stop</div>
                {isEditing ? (
                  <Input
                    type="number"
                    step="any"
                    value={editedTrade.stop_price}
                    onChange={(e) => handleFieldChange('stop_price', e.target.value)}
                    className="h-7 text-xs font-mono bg-[#0d0d0d] border-red-500/20 text-red-400"
                  />
                ) : (
                  <>
                    <div className="text-sm font-mono font-bold text-red-400 tabular-nums truncate">
                      {formatPrice(activeTrade.stop_price)}
                    </div>
                    <div className="text-[8px] text-[#555] mt-0.5 tabular-nums">
                      {riskUsd !== null && riskPercent !== null ? (
                        <>{Math.abs(riskPercent).toFixed(1)}%</>
                      ) : '—'}
                    </div>
                  </>
                )}
              </div>

              {/* Take */}
              <div className="flex flex-col border-l-2 border-emerald-500/40 pl-2">
                <div className="text-[9px] text-[#666] uppercase tracking-wider mb-1.5">Take</div>
                {isEditing ? (
                  <Input
                    type="number"
                    step="any"
                    value={editedTrade.take_price}
                    onChange={(e) => handleFieldChange('take_price', e.target.value)}
                    className="h-7 text-xs font-mono bg-[#0d0d0d] border-emerald-500/20 text-emerald-400"
                  />
                ) : (
                  <>
                    <div className="text-sm font-mono font-bold text-emerald-400 tabular-nums truncate">
                      {formatPrice(activeTrade.take_price)}
                    </div>
                    <div className="text-[8px] text-[#555] mt-0.5 tabular-nums">
                      {potentialPercent !== null ? <>{potentialPercent.toFixed(1)}%</> : '—'}
                    </div>
                  </>
                )}
              </div>

              {/* R:R */}
              {!isEditing && (
                <div className="flex flex-col items-center justify-center">
                  <div className="text-[9px] text-[#666] uppercase tracking-wider mb-1">R:R</div>
                  <div className={cn(
                    "text-lg font-mono font-bold tabular-nums",
                    !hasStop || !hasTake ? "text-[#555]" :
                    (rrRatio && rrRatio >= 2 ? "text-emerald-400" : "text-[#888]")
                  )}>
                    {!hasStop || !hasTake ? '—' : rrRatio ? `1:${Math.round(rrRatio)}` : '—'}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* GAMBLING DETECT */}
          <div className="bg-[#131313] border border-[#2a2a2a] rounded-xl p-3 relative overflow-hidden">
            <div className="absolute top-2 right-2">
              <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded-full text-[8px] text-amber-400 uppercase tracking-wider font-semibold">
                Soon
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Beaker className="w-4 h-4 text-[#666]" />
              <div>
                <div className="text-[10px] text-[#888] uppercase tracking-wider font-semibold">Gambling Detect</div>
                <div className="text-[8px] text-[#555] mt-0.5">Feature in development</div>
              </div>
            </div>
          </div>

          {/* Screenshot Panel */}
          <div className="bg-[#131313] border border-[#2a2a2a] rounded-xl p-2.5">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[9px] text-[#666] uppercase tracking-wider">Screenshot</div>
              <div className="flex items-center gap-1">
                {screenshotUrl && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (!confirm('Delete screenshot?')) return;
                      setScreenshotUrl('');
                      await onUpdate(trade.id, { screenshot_url: null });
                      toast.success('Screenshot deleted');
                    }}
                    className="h-5 w-5 p-0 hover:bg-red-500/10 text-red-400/70 hover:text-red-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => document.getElementById('screenshot-upload').click()}
                  className="h-5 w-5 p-0 hover:bg-[#2a2a2a] text-[#888]"
                >
                  <Plus className="w-3 h-3" />
                </Button>
                <input 
                  id="screenshot-upload" 
                  type="file" 
                  accept="image/*" 
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleScreenshotUpload(e.target.files[0])}
                />
              </div>
            </div>
            {screenshotUrl ? (
              <div 
                onClick={() => setShowScreenshotModal(true)}
                className="relative w-full h-20 bg-[#0d0d0d] rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity border border-[#2a2a2a]"
              >
                <img src={screenshotUrl} alt="Screenshot" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="h-20 bg-[#0d0d0d] rounded-lg border border-[#2a2a2a] flex items-center justify-center">
                <div className="text-[9px] text-[#555]">No screenshot</div>
              </div>
            )}
          </div>

          {/* Primary Actions */}
          {!isEditing && isOpen && (
            <div className="grid grid-cols-3 gap-2">
              <Button 
                size="sm" 
                onClick={() => setShowAddModal(true)} 
                className="bg-[#1a1a1a] text-[#c0c0c0] hover:bg-[#222] border border-[#2a2a2a] h-8 text-[10px] font-medium"
              >
                + Add
              </Button>
              <Button 
                size="sm" 
                onClick={() => setShowCloseModal(true)} 
                className="bg-[#1a1a1a] text-[#c0c0c0] hover:bg-[#222] border border-[#2a2a2a] h-8 text-[10px] font-medium"
              >
                Close
              </Button>
              <Button 
                size="sm" 
                onClick={() => setShowPartialModal(true)} 
                className="bg-[#1a1a1a] text-[#c0c0c0] hover:bg-[#222] border border-[#2a2a2a] h-8 text-[10px] font-medium"
              >
                Partial
              </Button>
            </div>
          )}
        </div>

        {/* VERTICAL DIVIDER */}
        <div className="bg-[#2a2a2a]" />

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-2.5 pl-4">
          {/* Strategy */}
          <div className="flex items-center justify-between">
            <div className="text-[9px] text-[#666] uppercase tracking-wider">Strategy</div>
            {isEditing ? (
              <Input
                value={editedTrade.strategy_tag || ''}
                onChange={(e) => handleFieldChange('strategy_tag', e.target.value)}
                list="strategies"
                placeholder="Strategy..."
                className="h-7 text-xs bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0] flex-1 ml-2"
              />
            ) : activeTrade.strategy_tag ? (
              <span className="px-2 py-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[10px] text-[#e0e0e0] font-medium truncate max-w-[200px]">
                {activeTrade.strategy_tag}
              </span>
            ) : (
              <span className="text-[10px] text-[#555]">—</span>
            )}
            <datalist id="strategies">
              {usedStrategies.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>

          {/* Timeframe & Market */}
          <div className="bg-[#131313] border border-[#2a2a2a] rounded-xl p-2.5">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <div className="text-[9px] text-[#666] uppercase tracking-wider mb-1.5">Timeframe</div>
                {isEditing ? (
                  <Select 
                    value={editedTrade.timeframe || ''} 
                    onValueChange={(val) => handleFieldChange('timeframe', val)}
                  >
                    <SelectTrigger className="h-7 text-xs bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]">
                      <SelectValue placeholder="..." />
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
                ) : activeTrade.timeframe ? (
                  <div className="px-2.5 py-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[10px] text-[#e0e0e0] uppercase tracking-wider font-medium truncate">
                    {activeTrade.timeframe}
                  </div>
                ) : (
                  <div className="text-[10px] text-[#555]">—</div>
                )}
              </div>
              
              <div className="flex-1">
                <div className="text-[9px] text-[#666] uppercase tracking-wider mb-1.5">Market</div>
                {isEditing ? (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      onClick={() => handleFieldChange('market_context', 'Bullish')}
                      className={cn(
                        "h-7 px-2 text-[10px] flex-1",
                        activeTrade.market_context === 'Bullish' 
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
                          : "bg-[#0d0d0d] border-[#2a2a2a] text-[#666]"
                      )}
                    >
                      Bull
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleFieldChange('market_context', 'Bearish')}
                      className={cn(
                        "h-7 px-2 text-[10px] flex-1",
                        activeTrade.market_context === 'Bearish' 
                          ? "bg-red-500/20 text-red-400 border-red-500/30" 
                          : "bg-[#0d0d0d] border-[#2a2a2a] text-[#666]"
                      )}
                    >
                      Bear
                    </Button>
                  </div>
                ) : activeTrade.market_context ? (
                  <div className={cn(
                    "px-2.5 py-1 border rounded-lg text-[10px] font-medium truncate text-center",
                    activeTrade.market_context === 'Bullish' 
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "bg-red-500/10 border-red-500/30 text-red-400"
                  )}>
                    {activeTrade.market_context}
                  </div>
                ) : (
                  <div className="text-[10px] text-[#555]">—</div>
                )}
              </div>
            </div>
          </div>

          {/* Entry Reason */}
          <div className="bg-[#131313] border border-[#2a2a2a] rounded-xl p-2.5 flex-1 min-h-[140px] relative">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[9px] text-[#666] uppercase tracking-wider">Entry Reason</div>
              {!isEditing && activeTrade.entry_reason && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleEdit}
                  className="h-5 w-5 p-0 hover:bg-[#2a2a2a] text-[#666]"
                >
                  <Edit2 className="w-3 h-3" />
                </Button>
              )}
            </div>
            {isEditing ? (
              <Textarea
                value={editedTrade.entry_reason || ''}
                onChange={(e) => handleFieldChange('entry_reason', e.target.value)}
                placeholder="Why did you enter?"
                className="h-[100px] text-xs bg-[#0d0d0d] border-[#2a2a2a] resize-none text-[#c0c0c0]"
              />
            ) : (
              <div className="h-[100px] text-[10px] text-[#c0c0c0] whitespace-pre-wrap overflow-y-auto leading-relaxed">
                {activeTrade.entry_reason || <div className="h-full flex items-center justify-center text-[#555]">—</div>}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="bg-[#131313] border border-[#2a2a2a] rounded-xl p-2.5">
            <div className="flex items-center justify-between">
              <button 
                onClick={() => setCurrentActionIndex(Math.max(0, currentActionIndex - 1))}
                disabled={currentActionIndex === 0 || actionHistory.length === 0}
                className="w-6 h-6 flex items-center justify-center text-[#666] hover:text-[#888] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ←
              </button>
              <div className="flex-1 px-2">
                {actionHistory.length > 0 ? (
                  <p className="text-[9px] text-[#c0c0c0] text-center leading-relaxed truncate">
                    {actionHistory[currentActionIndex]?.description || '—'}
                  </p>
                ) : (
                  <p className="text-[9px] text-[#555] text-center">No actions yet</p>
                )}
              </div>
              <button 
                onClick={() => setCurrentActionIndex(Math.min(actionHistory.length - 1, currentActionIndex + 1))}
                disabled={currentActionIndex >= actionHistory.length - 1 || actionHistory.length === 0}
                className="w-6 h-6 flex items-center justify-center text-[#666] hover:text-[#888] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                →
              </button>
            </div>
          </div>

          {/* AI Score */}
          <div className="bg-[#131313] border border-[#2a2a2a] rounded-xl p-2.5 relative">
            <div className="absolute top-2 right-2">
              <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded-full text-[8px] text-amber-400 uppercase tracking-wider font-semibold">
                In Development
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#666]" />
                <div>
                  <div className="text-[10px] text-[#888] uppercase tracking-wider font-semibold">AI Score</div>
                  {activeTrade.ai_score && (
                    <div className={cn(
                      "text-sm font-bold tabular-nums mt-0.5",
                      activeTrade.ai_score >= 7 ? "text-emerald-400" : 
                      activeTrade.ai_score >= 5 ? "text-yellow-400" : "text-red-400"
                    )}>
                      {activeTrade.ai_score}/10
                    </div>
                  )}
                </div>
              </div>
              {!activeTrade.ai_score && (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={handleGenerateAI}
                  disabled={true}
                  className="h-7 px-2 text-[10px] text-[#555] cursor-not-allowed"
                >
                  Generate
                </Button>
              )}
              {activeTrade.ai_score && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowAI(!showAI)}
                  className="h-5 w-5 p-0 hover:bg-[#2a2a2a] text-[#666]"
                >
                  <Plus className="w-3 h-3" />
                </Button>
              )}
            </div>
            {showAI && aiAnalysis && (
              <div className="mt-3 pt-3 border-t border-[#2a2a2a] space-y-2 text-[9px]">
                <div className="flex gap-1.5">
                  <span className="text-emerald-400 shrink-0">✓</span>
                  <span className="text-[#c0c0c0] leading-relaxed">{aiAnalysis.strengths}</span>
                </div>
                <div className="flex gap-1.5">
                  <span className="text-yellow-400 shrink-0">⚠</span>
                  <span className="text-[#c0c0c0] leading-relaxed">{aiAnalysis.risks}</span>
                </div>
                <div className="flex gap-1.5">
                  <span className="text-blue-400 shrink-0">💡</span>
                  <span className="text-[#c0c0c0] leading-relaxed">{aiAnalysis.tip}</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          {!isEditing && isOpen && (
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                variant="ghost"
                onClick={async () => {
                  try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = 600;
                    canvas.height = 400;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
                    gradient.addColorStop(0, '#1a1a1a');
                    gradient.addColorStop(1, '#0a0a0a');
                    ctx.fillStyle = gradient;
                    ctx.fillRect(0, 0, 600, 400);
                    ctx.fillStyle = '#c0c0c0';
                    ctx.font = 'bold 32px Arial';
                    ctx.fillText(`${trade.coin} ${trade.direction}`, 40, 80);
                    ctx.font = '20px Arial';
                    ctx.fillText(`Entry: ${formatPrice(trade.entry_price)}`, 40, 140);
                    ctx.fillText(`Size: $${formatNumber(trade.position_size)}`, 40, 180);
                    const pnl = calcCurrentPnl();
                    ctx.fillStyle = pnl >= 0 ? '#10b981' : '#ef4444';
                    ctx.font = 'bold 28px Arial';
                    ctx.fillText(`${pnl >= 0 ? '+' : ''}$${formatNumber(Math.abs(pnl))}`, 40, 240);
                    const dataUrl = canvas.toDataURL('image/png');
                    setShareImageUrl(dataUrl);
                    setShowShareModal(true);
                  } catch (error) {
                    toast.error('Failed to generate share image');
                  }
                }}
                className="h-8 w-8 p-0 hover:bg-[#1a1a1a] border border-[#2a2a2a]"
              >
                <Share2 className="w-3.5 h-3.5 text-[#888]" />
              </Button>
              <div className="flex-1 grid grid-cols-3 gap-1.5">
                <Button 
                  size="sm" 
                  onClick={handleMoveToBE} 
                  className="bg-[#1a1a1a] text-[#c0c0c0] hover:bg-[#222] border border-[#2a2a2a] h-8 text-[10px] font-medium"
                >
                  SL→BE
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleHitSL} 
                  className="bg-[#1a1a1a] text-red-400/80 hover:bg-red-500/10 border border-red-500/20 h-8 text-[10px] font-medium"
                >
                  Hit SL
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleHitTP} 
                  className="bg-[#1a1a1a] text-emerald-400/80 hover:bg-emerald-500/10 border border-emerald-500/20 h-8 text-[10px] font-medium"
                >
                  Hit TP
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Undo Action Logic */}
      {actionHistory.length > 0 && false && (
        <div className="hidden">
          <button
            onClick={async () => {
                    if (!confirm('Отменить это действие?')) return;
                    
                    const currentAction = actionHistory[currentActionIndex];
                    const actionType = currentAction?.action;
                    
                    let updates = {};
                    
                    if (actionType === 'move_sl_be') {
                      const originalStop = trade.original_stop_price;
                      const newEntry = parseFloat(trade.entry_price) || 0;
                      const newSize = parseFloat(trade.position_size) || 0;
                      const newStopDistance = Math.abs(newEntry - originalStop);
                      const newRiskUsd = (newStopDistance / newEntry) * newSize;
                      const newRiskPercent = (newRiskUsd / balance) * 100;
                      
                      const takePrice = parseFloat(trade.take_price) || 0;
                      const newTakeDistance = Math.abs(takePrice - newEntry);
                      const newPotentialUsd = (newTakeDistance / newEntry) * newSize;
                      const newRR = newRiskUsd > 0 ? newPotentialUsd / newRiskUsd : 0;
                      
                      updates = {
                        stop_price: originalStop,
                        risk_usd: newRiskUsd,
                        risk_percent: newRiskPercent,
                        rr_ratio: newRR,
                        max_risk_usd: trade.original_risk_usd
                      };
                    } else if (actionType === 'partial_close') {
                      const partialCloses = trade.partial_closes ? JSON.parse(trade.partial_closes) : [];
                      const lastClose = partialCloses[partialCloses.length - 1];
                      
                      if (lastClose) {
                        const restoredSize = parseFloat(trade.position_size) + parseFloat(lastClose.size_usd);
                        const restoredRealizedPnl = (trade.realized_pnl_usd || 0) - (lastClose.pnl_usd || 0);
                        
                        const newStopDistance = Math.abs(trade.entry_price - trade.stop_price);
                        const newRiskUsd = (newStopDistance / trade.entry_price) * restoredSize;
                        const newRiskPercent = (newRiskUsd / balance) * 100;
                        
                        const takePrice = parseFloat(trade.take_price) || 0;
                        const newTakeDistance = Math.abs(takePrice - trade.entry_price);
                        const newPotentialUsd = (newTakeDistance / trade.entry_price) * restoredSize;
                        
                        const isStopAtBE = Math.abs(trade.stop_price - trade.entry_price) < 0.0001;
                        const newRR = isStopAtBE && takePrice > 0
                          ? newPotentialUsd / (trade.original_risk_usd || 1)
                          : newRiskUsd > 0 ? newPotentialUsd / newRiskUsd : 0;
                        
                        updates = {
                          position_size: restoredSize,
                          realized_pnl_usd: restoredRealizedPnl,
                          partial_closes: JSON.stringify(partialCloses.slice(0, -1)),
                          risk_usd: newRiskUsd,
                          risk_percent: newRiskPercent,
                          rr_ratio: newRR
                        };
                      }
                    } else if (actionType === 'add_position') {
                      const addsHistory = trade.adds_history ? JSON.parse(trade.adds_history) : [];
                      const lastAdd = addsHistory[addsHistory.length - 1];
                      
                      if (lastAdd) {
                        const currentEntry = parseFloat(trade.entry_price);
                        const currentSize = parseFloat(trade.position_size);
                        const addedSize = parseFloat(lastAdd.size_usd);
                        const addedPrice = parseFloat(lastAdd.price);
                        
                        const previousSize = currentSize - addedSize;
                        const previousEntry = previousSize > 0 
                          ? (currentEntry * currentSize - addedPrice * addedSize) / previousSize
                          : currentEntry;
                        
                        const newStopDistance = Math.abs(previousEntry - trade.stop_price);
                        const newRiskUsd = (newStopDistance / previousEntry) * previousSize;
                        const newRiskPercent = (newRiskUsd / balance) * 100;
                        
                        const takePrice = parseFloat(trade.take_price) || 0;
                        const newTakeDistance = Math.abs(takePrice - previousEntry);
                        const newPotentialUsd = (newTakeDistance / previousEntry) * previousSize;
                        const newRR = newRiskUsd > 0 ? newPotentialUsd / newRiskUsd : 0;
                        
                        updates = {
                          entry_price: previousEntry,
                          position_size: previousSize,
                          adds_history: JSON.stringify(addsHistory.slice(0, -1)),
                          risk_usd: newRiskUsd,
                          risk_percent: newRiskPercent,
                          rr_ratio: newRR,
                          max_risk_usd: trade.original_risk_usd
                        };
                      }
                    } else if (actionType === 'hit_sl' || actionType === 'hit_tp' || actionType === 'close_position') {
                      const newStopDistance = Math.abs(trade.entry_price - trade.stop_price);
                      const newRiskUsd = (newStopDistance / trade.entry_price) * trade.position_size;
                      const newRiskPercent = (newRiskUsd / balance) * 100;
                      
                      const takePrice = parseFloat(trade.take_price) || 0;
                      const newTakeDistance = Math.abs(takePrice - trade.entry_price);
                      const newPotentialUsd = (newTakeDistance / trade.entry_price) * trade.position_size;
                      const newRR = newRiskUsd > 0 ? newPotentialUsd / newRiskUsd : 0;
                      
                      updates = {
                        close_price: null,
                        date_close: null,
                        pnl_usd: 0,
                        pnl_percent_of_balance: 0,
                        r_multiple: null,
                        actual_duration_minutes: null,
                        realized_pnl_usd: 0,
                        risk_usd: newRiskUsd,
                        risk_percent: newRiskPercent,
                        rr_ratio: newRR
                      };
                    }
                    
                    const newHistory = actionHistory.filter((_, i) => i !== currentActionIndex);
                    updates.action_history = JSON.stringify(newHistory);
                    
                    await onUpdate(trade.id, updates);
                    setActionHistory(newHistory);
                    setCurrentActionIndex(Math.max(0, currentActionIndex - 1));
                    toast.success('Действие отменено');
                  }}
                >
                  ✕
                </button>
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

      {/* Share Modal */}
      <Dialog open={showShareModal} onOpenChange={setShowShareModal}>
        <DialogContent className="bg-[#0a0a0a] border-[#2a2a2a] max-w-[650px] [&>button]:text-white [&>button]:hover:text-white">
          <DialogHeader>
            <DialogTitle className="text-[#c0c0c0] text-xl font-bold">Share Your Trade</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="w-full bg-gradient-to-br from-[#151515] to-[#0a0a0a] rounded-xl p-3 border border-[#2a2a2a]">
              <img src={shareImageUrl} alt="Share" className="w-full h-auto rounded-lg shadow-2xl" />
            </div>
            <div className="flex gap-3">
              <Button 
                onClick={async () => {
                  try {
                    const response = await fetch(shareImageUrl);
                    const blob = await response.blob();
                    await navigator.clipboard.write([
                      new ClipboardItem({ 'image/png': blob })
                    ]);
                    toast.success('Copied to clipboard');
                  } catch {
                    toast.error('Failed to copy');
                  }
                }}
                className="flex-1 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow-lg shadow-violet-500/30"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy to Clipboard
              </Button>
              <Button 
                onClick={() => {
                  const link = document.createElement('a');
                  link.download = `open-trade-${trade.coin}-${new Date().toISOString().split('T')[0]}.png`;
                  link.href = shareImageUrl;
                  link.click();
                }}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-lg shadow-emerald-500/30"
              >
                <Download className="w-4 h-4 mr-2" />
                Download PNG
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden share content */}
      <div id={`share-content-open-${trade.id}`} className="fixed -left-[9999px]">
        <ShareTradeCard trade={trade} isOpen={true} />
      </div>
      </div>
      );
      }