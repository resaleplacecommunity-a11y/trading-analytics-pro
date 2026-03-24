import { useState, useEffect } from 'react';
import { useConfirm } from "@/components/ui/ConfirmDialog";
import html2canvas from 'html2canvas';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Zap, Target, Plus, Edit2, Check, X, Image, Timer, Share2, Copy, Download, Trash2, RefreshCw, Loader2, Scale, Camera } from 'lucide-react';
import { cn } from "@/lib/utils";
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ShareTradeCard from './ShareTradeCard';
import { avgEntryFromHistory, pnlUsd, riskUsd as calcRiskUsd, parseNum } from '../utils/tradeMath';

/* ─── helpers ─────────────────────────────────────────────────────────────── */
const formatPrice = (price) => {
  if (price === undefined || price === null || price === '') return '—';
  const p = parseFloat(price);
  if (isNaN(p)) return '—';
  if (Math.abs(p) >= 1) {
    const str = p.toPrecision(4);
    return `$${parseFloat(str).toString()}`;
  }
  const str = p.toFixed(20);
  const match = str.match(/\.0*([1-9]\d{0,3})/);
  if (match) {
    const zeros = str.indexOf(match[1]) - str.indexOf('.') - 1;
    return `$${p.toFixed(zeros + 4).replace(/0+$/, '')}`;
  }
  return `$${p.toFixed(4).replace(/\.?0+$/, '')}`;
};

const formatNumber = (num) => {
  if (num === undefined || num === null || num === '') return '—';
  const n = parseFloat(num);
  if (isNaN(n)) return '—';
  return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
};

/* ─── glass styles ────────────────────────────────────────────────────────── */
const glassCard   = "bg-white/[0.03] backdrop-blur-xl border border-white/[0.07] shadow-[0_4px_16px_rgba(0,0,0,0.3)] rounded-xl";
const glassStop   = "bg-red-500/[0.06] backdrop-blur-xl border-l-2 border-l-red-600 border border-red-900/30 shadow-[0_4px_16px_rgba(180,0,0,0.15)] rounded-xl";
const glassTake   = "bg-emerald-500/[0.05] backdrop-blur-xl border-l-2 border-l-emerald-600 border border-emerald-900/30 shadow-[0_4px_16px_rgba(0,180,80,0.12)] rounded-xl";
const glassRR     = "bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] shadow-[0_4px_16px_rgba(0,0,0,0.25)] rounded-xl";
const glassAI     = "bg-cyan-500/[0.05] backdrop-blur-xl border-l-2 border-l-cyan-500 border border-cyan-900/30 shadow-[0_4px_16px_rgba(0,180,220,0.1)] rounded-xl";
const labelCls    = "text-[11px] font-semibold uppercase tracking-widest select-none";
const labelMuted  = { color: 'rgba(255,255,255,0.4)' };

/* ─── component ───────────────────────────────────────────────────────────── */
export default function OpenTradeCard({ trade, onUpdate, currentBalance, formatDate }) {
  const queryClient = useQueryClient();
  const { confirm: confirmDialog, Dialog: ConfirmDialogComponent } = useConfirm();

  /* state */
  const [isEditing, setIsEditing]             = useState(false);
  const [editedTrade, setEditedTrade]         = useState(trade);
  const [hasChanges, setHasChanges]           = useState(false);
  const lang = localStorage.getItem('tradingpro_lang') || 'ru';

  const [showCloseModal, setShowCloseModal]   = useState(false);
  const [showPartialModal, setShowPartialModal] = useState(false);
  const [showAddModal, setShowAddModal]       = useState(false);
  const [closePrice, setClosePrice]           = useState('');
  const [closeComment, setCloseComment]       = useState('');
  const [partialPercent, setPartialPercent]   = useState(50);
  const [partialPrice, setPartialPrice]       = useState('');
  const [addPrice, setAddPrice]               = useState('');
  const [addSize, setAddSize]                 = useState('');

  const [isGeneratingAI, setIsGeneratingAI]   = useState(false);
  const [aiAnalysis, setAiAnalysis]           = useState(null);
  const [liveTimer, setLiveTimer]             = useState(0);
  const [showAI, setShowAI]                   = useState(false);
  const [screenshotUrl, setScreenshotUrl]     = useState(trade.screenshot_url || '');
  const [screenshotInput, setScreenshotInput] = useState('');
  const [showScreenshotModal, setShowScreenshotModal] = useState(false);
  const [actionHistory, setActionHistory]     = useState([]);
  const [currentActionIndex, setCurrentActionIndex] = useState(0);
  const [showShareModal, setShowShareModal]   = useState(false);
  const [shareImageUrl, setShareImageUrl]     = useState('');
  const [refreshingPnl, setRefreshingPnl]     = useState(false);

  /* trade_actions for new ACTIONS section */
  const [tradeActions, setTradeActions]       = useState([]);
  const [tradeActionIdx, setTradeActionIdx]   = useState(0);

  /* queries */
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

  const { data: activeConnection = null } = useQuery({
    queryKey: ['activeExchangeConnectionForOpenTradeCard'],
    queryFn: async () => {
      const user = await base44.auth.me();
      if (!user) return null;
      const profiles = await base44.entities.UserProfile.filter({ created_by: user.email }, '-created_date', 10);
      const activeProfile = profiles.find(p => p.is_active);
      if (!activeProfile) return null;
      const res = await base44.functions.invoke('exchangeConnectionsApi', { method: 'GET', path: '/connections', profile_id: activeProfile.id });
      const list = res?.data?.connections || [];
      return list.find(c => c.is_active && c.exchange === 'bybit') || list.find(c => c.is_active) || null;
    },
    staleTime: 20000,
  });

  const templates = tradeTemplates[0] || {};
  let strategyTemplates = [];
  try { strategyTemplates = templates.strategy_templates ? JSON.parse(templates.strategy_templates) : []; } catch {}

  const isOpen  = !trade.close_price && trade.position_size > 0;
  const isLong  = trade.direction === 'Long';
  const balance = trade.account_balance_at_entry || currentBalance || 100000;

  /* effects */
  useEffect(() => {
    if (trade.ai_analysis) {
      try { setAiAnalysis(JSON.parse(trade.ai_analysis)); } catch {}
    }
  }, [trade.ai_analysis]);

  useEffect(() => {
    setEditedTrade(trade);
    setScreenshotUrl(trade.screenshot_url || '');
    try {
      const h = trade.action_history ? JSON.parse(trade.action_history) : [];
      setActionHistory(h);
      setCurrentActionIndex(h.length > 0 ? h.length - 1 : 0);
    } catch { setActionHistory([]); setCurrentActionIndex(0); }
    try {
      const ta = trade.trade_actions ? JSON.parse(trade.trade_actions) : [];
      setTradeActions(ta);
      setTradeActionIdx(ta.length > 0 ? ta.length - 1 : 0);
    } catch { setTradeActions([]); setTradeActionIdx(0); }
  }, [trade]);

  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          handleScreenshotUpload(items[i].getAsFile());
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const update = () => {
      const openTime = new Date(trade.date_open || trade.date);
      setLiveTimer(Math.floor((new Date() - openTime) / 1000));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [trade.date_open, trade.date, isOpen]);

  const formatDuration = (seconds) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    let r = [];
    if (d > 0) r.push(`${d}d`);
    if (h > 0) r.push(`${h}h`);
    r.push(`${m}m`);
    return r.join(' ');
  };

  const usedStrategies = [...new Set((allTrades || []).map(t => t.strategy_tag).filter(Boolean))];
  const activeTrade    = isEditing ? editedTrade : trade;

  const entry = parseFloat(activeTrade.entry_price) || 0;
  const stop  = parseFloat(activeTrade.stop_price)  || 0;
  const take  = parseFloat(activeTrade.take_price)  || 0;
  const size  = parseFloat(activeTrade.position_size) || 0;

  const hasStop    = stop && stop > 0;
  const isStopAtBE = hasStop && Math.abs(stop - entry) < 0.0001;

  const riskUsd = (() => {
    if (!hasStop) return null;
    if (isStopAtBE) return 0;
    if (activeTrade.risk_usd !== undefined && activeTrade.risk_usd !== null && activeTrade.risk_usd > 0) return activeTrade.risk_usd;
    if (!entry || !size) return null;
    return (Math.abs(entry - stop) / entry) * size;
  })();
  const riskPercent = riskUsd !== null ? (riskUsd / balance) * 100 : null;

  const hasTake       = take && take > 0;
  const takeDistance  = hasTake ? Math.abs(take - entry) : 0;
  const potentialUsd  = hasTake && entry > 0 && size > 0 ? (takeDistance / entry) * size : null;
  const potentialPercent = potentialUsd !== null ? (potentialUsd / balance) * 100 : null;

  let rrRatio = null;
  if (isStopAtBE && hasTake && trade.original_risk_usd > 0)           rrRatio = potentialUsd / trade.original_risk_usd;
  else if (riskUsd && riskUsd > 0 && potentialUsd !== null)            rrRatio = potentialUsd / riskUsd;
  else if (activeTrade.rr_ratio != null && activeTrade.rr_ratio > 0)  rrRatio = activeTrade.rr_ratio;

  /* partial closes avg */
  const partialClosesList = (() => {
    try { return trade.partial_closes ? JSON.parse(trade.partial_closes) : []; }
    catch { return []; }
  })();
  const hasPartials    = partialClosesList.length > 0;
  const avgClosePrice  = hasPartials
    ? partialClosesList.reduce((s, pc) => s + (parseFloat(pc.price) || 0) * (parseFloat(pc.size_usd) || 0), 0) /
      partialClosesList.reduce((s, pc) => s + (parseFloat(pc.size_usd) || 0), 0)
    : 0;
  const realizedPnl    = parseFloat(trade.realized_pnl_usd) || 0;

  /* handlers */
  const handleEdit   = () => { setEditedTrade({ ...trade }); setHasChanges(false); setIsEditing(true); };
  const handleCancel = () => { setEditedTrade({ ...trade }); setIsEditing(false); setHasChanges(false); };
  const handleFieldChange = (field, value) => {
    setEditedTrade(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const addAction = (action) => {
    const newHistory = [...(actionHistory || []), action];
    return newHistory;
  };

  /* save trade_actions helper */
  const saveTradeAction = async (newAction) => {
    const updated = [...tradeActions, newAction];
    setTradeActions(updated);
    setTradeActionIdx(updated.length - 1);
    await onUpdate(trade.id, { trade_actions: JSON.stringify(updated) });
  };

  const handleSave = async () => {
    if (editedTrade.close_price && parseFloat(editedTrade.close_price) > 0) {
      await handleCloseFromEdit(parseFloat(editedTrade.close_price));
      return;
    }
    const newEntry = parseFloat(editedTrade.entry_price) || 0;
    const newStop  = parseFloat(editedTrade.stop_price) || 0;
    const newTake  = parseFloat(editedTrade.take_price) || 0;
    const newSize  = parseFloat(editedTrade.position_size) || 0;
    const newStopDist  = Math.abs(newEntry - newStop);
    const newRiskUsd   = (newStopDist / newEntry) * newSize;
    const newRiskPct   = (newRiskUsd / balance) * 100;
    const newTakeDist  = Math.abs(newTake - newEntry);
    const newPotential = (newTakeDist / newEntry) * newSize;
    const origRisk     = trade.original_risk_usd || newRiskUsd;
    const newRR        = newRiskUsd === 0 && newTake > 0
      ? (origRisk > 0 ? newPotential / origRisk : 0)
      : (newRiskUsd > 0 ? newPotential / newRiskUsd : 0);
    const updated = {
      ...editedTrade,
      risk_usd: newRiskUsd,
      risk_percent: newRiskPct,
      rr_ratio: newRR,
      original_entry_price: editedTrade.original_entry_price || trade.original_entry_price || newEntry,
      original_stop_price:  editedTrade.original_stop_price  || trade.original_stop_price  || newStop,
      original_risk_usd:    editedTrade.original_risk_usd    || trade.original_risk_usd    || newRiskUsd,
    };
    await onUpdate(trade.id, updated);
    setIsEditing(false);
    setHasChanges(false);
    toast.success('Trade updated');
  };

  const handleCloseFromEdit = async (price) => {
    if (!price || parseFloat(price) <= 0) {
      const newHistory = addAction({ timestamp: new Date().toISOString(), action: 'reopen_trade', description: 'Trade reopened' });
      const updated = { ...editedTrade, close_price: null, date_close: null, pnl_usd: 0, pnl_percent_of_balance: 0, r_multiple: null, action_history: JSON.stringify(newHistory) };
      await onUpdate(trade.id, updated);
      setIsEditing(false);
      toast.success('Trade reopened');
      return;
    }
    const entryPrice = parseNum(trade.entry_price);
    const currentPositionSize = parseNum(trade.position_size);
    let maxPositionSize = currentPositionSize;
    try {
      const pc = trade.partial_closes ? JSON.parse(trade.partial_closes) : [];
      const totalClosed = pc.reduce((s, c) => s + parseNum(c.size_usd), 0);
      maxPositionSize = currentPositionSize + totalClosed;
    } catch {}
    const realizedBefore = parseNum(trade.realized_pnl_usd);
    const remainingPnl   = pnlUsd(trade.direction, entryPrice, price, currentPositionSize);
    const totalPnl       = realizedBefore + remainingPnl;
    const maxRiskUsd     = parseNum(trade.max_risk_usd) || parseNum(trade.original_risk_usd) || riskUsd;
    const closeData = {
      ...editedTrade,
      close_price: price,
      date_close: new Date().toISOString(),
      pnl_usd: totalPnl,
      realized_pnl_usd: totalPnl,
      pnl_percent_of_balance: (totalPnl / balance) * 100,
      r_multiple: maxRiskUsd > 0 ? totalPnl / maxRiskUsd : 0,
      position_size: maxPositionSize,
      actual_duration_minutes: Math.floor((new Date() - new Date(trade.date_open || trade.date)) / 60000),
      risk_usd: 0, risk_percent: 0, rr_ratio: 0,
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
    } catch { toast.error('Failed to upload screenshot'); }
  };

  const handleRefreshPnl = async () => {
    if (refreshingPnl) return;
    setRefreshingPnl(true);
    try {
      let conn = activeConnection;
      if (!conn) {
        const user = await base44.auth.me();
        if (!user) { toast.error('Not logged in'); return; }
        const profiles = await base44.entities.UserProfile.filter({ created_by: user.email }, '-created_date', 10);
        const profile = profiles.find(p => p.is_active) || profiles[0];
        if (!profile) { toast.error('No active profile'); return; }
        const connRes = await base44.functions.invoke('exchangeConnectionsApi', { method: 'GET', path: '/connections', profile_id: profile.id });
        const conns = connRes?.data?.connections || [];
        conn = conns.find(c => c.is_active) || conns[0] || null;
      }
      if (!conn) { toast.error(lang === 'ru' ? 'Нет подключения к бирже' : 'No exchange connection'); return; }
      const res = await base44.functions.invoke('syncExchangeConnection', { connection_id: conn.id });
      if (res?.data?.ok) {
        toast.success(lang === 'ru' ? `✅ PnL обновлён` : `✅ PnL refreshed`);
        queryClient.invalidateQueries({ queryKey: ['trades'] });
        queryClient.invalidateQueries({ queryKey: ['allTrades'] });
        queryClient.invalidateQueries({ queryKey: ['activeExchangeConnectionForOpenTradeCard'] });
      } else {
        toast.error(res?.data?.error || 'Sync failed');
      }
    } catch (e) { toast.error(e?.message || 'Refresh error'); }
    finally { setRefreshingPnl(false); }
  };

  const handleMoveToBE = async () => {
    const entryPrice   = parseNum(activeTrade.entry_price);
    const takePrice    = parseNum(activeTrade.take_price);
    const currentSize  = parseNum(activeTrade.position_size);
    const takeDist     = Math.abs(takePrice - entryPrice);
    const potUsd       = (takeDist / entryPrice) * currentSize;
    const originalRisk = parseNum(trade.original_risk_usd) || riskUsd;
    const maxRiskUsd   = parseNum(trade.max_risk_usd) || originalRisk;
    const newHistory   = addAction({ timestamp: new Date().toISOString(), action: 'move_sl_be', description: `Stop moved to BE at ${formatPrice(entryPrice)}` });
    const updated = {
      stop_price: entryPrice,
      original_stop_price: activeTrade.original_stop_price || activeTrade.stop_price,
      original_risk_usd: trade.original_risk_usd || riskUsd,
      max_risk_usd: maxRiskUsd,
      risk_usd: 0, risk_percent: 0,
      rr_ratio: originalRisk > 0 ? potUsd / originalRisk : 0,
      action_history: JSON.stringify(newHistory)
    };
    await onUpdate(trade.id, updated);
    /* also save to trade_actions */
    await saveTradeAction({ type: 'sl_to_be', time: new Date().toISOString(), price: entryPrice });
    toast.success('Stop moved to breakeven');
  };

  const handleHitSL = async () => {
    const entryPrice = parseFloat(activeTrade.entry_price) || 0;
    const curSize    = parseFloat(activeTrade.position_size) || 0;
    let maxSize = curSize;
    try {
      const pc = trade.partial_closes ? JSON.parse(trade.partial_closes) : [];
      maxSize = curSize + pc.reduce((s, c) => s + (parseFloat(c.size_usd) || 0), 0);
    } catch {}
    const maxRiskUsd = trade.max_risk_usd || trade.original_risk_usd || riskUsd;
    const stopPrice  = activeTrade.stop_price || 0;
    const realized   = trade.realized_pnl_usd || 0;
    const curPnl     = isLong ? ((stopPrice - entryPrice) / entryPrice) * curSize : ((entryPrice - stopPrice) / entryPrice) * curSize;
    const totalPnl   = realized + curPnl;
    const newHistory = addAction({ timestamp: new Date().toISOString(), action: 'hit_sl', description: `Hit SL at ${formatPrice(stopPrice)}` });
    const closeData  = {
      close_price: stopPrice, date_close: new Date().toISOString(),
      pnl_usd: totalPnl, pnl_percent_of_balance: (totalPnl / balance) * 100,
      r_multiple: maxRiskUsd > 0 ? totalPnl / maxRiskUsd : null,
      realized_pnl_usd: totalPnl, position_size: maxSize,
      actual_duration_minutes: Math.floor((new Date() - new Date(trade.date_open || trade.date)) / 60000),
      risk_usd: null, risk_percent: null, rr_ratio: null,
      action_history: JSON.stringify(newHistory)
    };
    await onUpdate(trade.id, closeData);
    toast.success('Position closed at Stop Loss');
  };

  const handleHitTP = async () => {
    const entryPrice = parseFloat(activeTrade.entry_price) || 0;
    const curSize    = parseFloat(activeTrade.position_size) || 0;
    let maxSize = curSize;
    try {
      const pc = trade.partial_closes ? JSON.parse(trade.partial_closes) : [];
      maxSize = curSize + pc.reduce((s, c) => s + (parseFloat(c.size_usd) || 0), 0);
    } catch {}
    const maxRiskUsd = trade.max_risk_usd || trade.original_risk_usd || riskUsd;
    const takePrice  = activeTrade.take_price || 0;
    const realized   = trade.realized_pnl_usd || 0;
    const curPnl     = isLong ? ((takePrice - entryPrice) / entryPrice) * curSize : ((entryPrice - takePrice) / entryPrice) * curSize;
    const totalPnl   = realized + curPnl;
    const newHistory = addAction({ timestamp: new Date().toISOString(), action: 'hit_tp', description: `Hit TP at ${formatPrice(takePrice)}` });
    const closeData  = {
      close_price: takePrice, date_close: new Date().toISOString(),
      pnl_usd: totalPnl, pnl_percent_of_balance: (totalPnl / balance) * 100,
      r_multiple: maxRiskUsd > 0 ? totalPnl / maxRiskUsd : null,
      realized_pnl_usd: totalPnl, position_size: maxSize,
      actual_duration_minutes: Math.floor((new Date() - new Date(trade.date_open || trade.date)) / 60000),
      risk_usd: null, risk_percent: null, rr_ratio: null,
      action_history: JSON.stringify(newHistory)
    };
    await onUpdate(trade.id, closeData);
    toast.success('Position closed at Take Profit');
  };

  const handleClosePosition = async () => {
    const price = parseFloat(closePrice);
    if (!price) return;
    const entryPrice = parseFloat(activeTrade.entry_price) || 0;
    const curSize    = parseFloat(activeTrade.position_size) || 0;
    let maxSize = curSize;
    try {
      const pc = trade.partial_closes ? JSON.parse(trade.partial_closes) : [];
      maxSize = curSize + pc.reduce((s, c) => s + (parseFloat(c.size_usd) || 0), 0);
    } catch {}
    const maxRiskUsd = trade.max_risk_usd || trade.original_risk_usd || riskUsd;
    const realized   = trade.realized_pnl_usd || 0;
    const remPnl     = isLong ? ((price - entryPrice) / entryPrice) * curSize : ((entryPrice - price) / entryPrice) * curSize;
    const totalPnl   = realized + remPnl;
    const newHistory = addAction({ timestamp: new Date().toISOString(), action: 'close_position', description: `Closed at ${formatPrice(price)} with ${totalPnl >= 0 ? '+' : '-'}$${Math.round(Math.abs(totalPnl))}` });
    const closeData  = {
      close_price: price, date_close: new Date().toISOString(),
      pnl_usd: totalPnl, pnl_percent_of_balance: (totalPnl / balance) * 100,
      r_multiple: maxRiskUsd > 0 ? totalPnl / maxRiskUsd : null,
      realized_pnl_usd: totalPnl, position_size: maxSize,
      close_comment: closeComment,
      actual_duration_minutes: Math.floor((new Date() - new Date(trade.date_open || trade.date)) / 60000),
      risk_usd: null, risk_percent: null, rr_ratio: null,
      action_history: JSON.stringify(newHistory)
    };
    await onUpdate(trade.id, closeData);
    /* also record in trade_actions */
    await saveTradeAction({ type: 'partial_close', time: new Date().toISOString(), price, pnl_usd: totalPnl, size: curSize });
    setShowCloseModal(false); setClosePrice(''); setCloseComment('');
    toast.success('Position closed');
  };

  const handlePartialClose = async () => {
    const price = parseFloat(partialPrice);
    if (!price) return;
    const closedSize    = (partialPercent / 100) * activeTrade.position_size;
    const remainingSize = activeTrade.position_size - closedSize;
    const partialPnl    = isLong
      ? ((price - activeTrade.entry_price) / activeTrade.entry_price) * closedSize
      : ((activeTrade.entry_price - price) / activeTrade.entry_price) * closedSize;
    const pcs = trade.partial_closes ? JSON.parse(trade.partial_closes) : [];
    pcs.push({ percent: partialPercent, size_usd: closedSize, price, pnl_usd: partialPnl, timestamp: new Date().toISOString() });
    const newHistory = addAction({ timestamp: new Date().toISOString(), action: 'partial_close', description: `Closed ${partialPercent}% at ${formatPrice(price)} — ${partialPnl >= 0 ? '+' : '-'}$${Math.round(Math.abs(partialPnl))}` });
    const updated = {
      position_size: remainingSize,
      realized_pnl_usd: (trade.realized_pnl_usd || 0) + partialPnl,
      partial_closes: JSON.stringify(pcs),
      action_history: JSON.stringify(newHistory)
    };
    if (activeTrade.stop_price && activeTrade.stop_price > 0) {
      const newStopDist = Math.abs(activeTrade.entry_price - activeTrade.stop_price);
      updated.risk_usd     = (newStopDist / activeTrade.entry_price) * remainingSize;
      updated.risk_percent = (updated.risk_usd / balance) * 100;
    } else { updated.risk_usd = null; updated.risk_percent = null; }
    const newTakeDist     = Math.abs(activeTrade.take_price - activeTrade.entry_price);
    const newPotentialUsd = (newTakeDist / activeTrade.entry_price) * remainingSize;
    const origRisk        = trade.original_risk_usd || riskUsd;
    const currentMaxRisk  = Math.max(trade.max_risk_usd || origRisk, updated.risk_usd || 0);
    updated.max_risk_usd  = currentMaxRisk;
    updated.rr_ratio      = updated.risk_usd === 0 && newTakeDist > 0
      ? newPotentialUsd / (origRisk > 0 ? origRisk : 1)
      : updated.risk_usd > 0 ? newPotentialUsd / updated.risk_usd : 0;
    if (remainingSize <= 0) {
      Object.assign(updated, {
        position_size: 0, close_price: price, date_close: new Date().toISOString(),
        pnl_usd: (trade.realized_pnl_usd || 0) + partialPnl,
        pnl_percent_of_balance: (((trade.realized_pnl_usd || 0) + partialPnl) / balance) * 100,
        r_multiple: (trade.max_risk_usd || origRisk) > 0 ? updated.pnl_usd / (trade.max_risk_usd || origRisk) : null,
        actual_duration_minutes: Math.floor((new Date() - new Date(trade.date_open || trade.date)) / 60000),
        risk_usd: null, risk_percent: null, rr_ratio: null
      });
    }
    await onUpdate(trade.id, updated);
    /* also record in trade_actions */
    await saveTradeAction({ type: 'partial_close', time: new Date().toISOString(), price, pnl_usd: partialPnl, size: closedSize });
    setShowPartialModal(false); setPartialPrice('');
    toast.success(`Partially closed ${partialPercent}% at ${formatPrice(price)}`);
  };

  const handleAddPosition = async () => {
    const price      = parseNum(addPrice);
    const addedSize  = parseNum(addSize);
    if (!price || !addedSize) return;
    const oldSize    = parseNum(activeTrade.position_size);
    const newSize    = oldSize + addedSize;
    const addsHistory = trade.adds_history ? JSON.parse(trade.adds_history) : [];
    addsHistory.push({ price, size_usd: addedSize, timestamp: new Date().toISOString() });
    const tempTrade  = { ...trade, position_size: newSize, adds_history: JSON.stringify(addsHistory) };
    const histData   = avgEntryFromHistory(tempTrade);
    const newEntry   = histData.avgEntry;
    const newHistory = addAction({ timestamp: new Date().toISOString(), action: 'add_position', description: `Added $${Math.round(addedSize)} at ${formatPrice(price)}` });
    const stopPrice  = parseNum(activeTrade.stop_price);
    const newRiskUsd   = calcRiskUsd(newEntry, stopPrice, newSize);
    const newRiskPct   = (newRiskUsd / balance) * 100;
    const takePrice    = parseNum(activeTrade.take_price);
    const newTakeDist  = Math.abs(takePrice - newEntry);
    const newPotential = (newTakeDist / newEntry) * newSize;
    const origRisk     = parseNum(trade.original_risk_usd) || riskUsd;
    const curMaxRisk   = Math.max(parseNum(trade.max_risk_usd) || origRisk, newRiskUsd);
    const newRR        = newRiskUsd === 0 && newTakeDist > 0
      ? (origRisk > 0 ? newPotential / origRisk : 0)
      : curMaxRisk > 0 ? newPotential / curMaxRisk : 0;
    const updated = {
      entry_price: newEntry, position_size: newSize, stop_price: stopPrice,
      risk_usd: newRiskUsd, risk_percent: newRiskPct, rr_ratio: newRR,
      max_risk_usd: curMaxRisk,
      original_entry_price: trade.original_entry_price || trade.entry_price,
      original_stop_price:  trade.original_stop_price  || trade.stop_price,
      original_risk_usd:    trade.original_risk_usd    || trade.risk_usd || riskUsd,
      adds_history: JSON.stringify(addsHistory),
      action_history: JSON.stringify(newHistory)
    };
    await onUpdate(trade.id, updated);
    setShowAddModal(false); setAddPrice(''); setAddSize('');
    toast.success(`Added $${Math.round(addedSize)} at ${formatPrice(price)}`);
  };

  const calcCurrentPnl = () => {
    if (!isOpen) return 0;
    const isExchangeTrade = trade.import_source === 'bybit' || !!trade.external_id;
    return isExchangeTrade ? (parseFloat(trade.pnl_usd) || 0) : (parseFloat(trade.realized_pnl_usd) || 0);
  };

  const handleGenerateAI = async () => {
    setIsGeneratingAI(true);
    try {
      const riskStr      = riskUsd !== null && riskPercent !== null ? `(Risk: $${riskUsd.toFixed(0)} / ${riskPercent.toFixed(1)}%)` : '(Risk: undefined)';
      const potentialStr = potentialUsd !== null && potentialPercent !== null ? `(Potential: $${potentialUsd.toFixed(0)} / ${potentialPercent.toFixed(1)}%)` : '(Potential: undefined)';
      const rrStr        = rrRatio !== null ? `1:${rrRatio.toFixed(1)}` : 'undefined';
      const prompt = `Analyze this open trading position:\n- Coin: ${activeTrade.coin}\n- Direction: ${activeTrade.direction}\n- Entry: ${activeTrade.entry_price}\n- Size: $${activeTrade.position_size}\n- Stop: ${activeTrade.stop_price} ${riskStr}\n- Take: ${activeTrade.take_price} ${potentialStr}\n- RR Ratio: ${rrStr}\n- Strategy: ${activeTrade.strategy_tag || 'Not specified'}\n- Timeframe: ${activeTrade.timeframe || 'Not specified'}\n- Entry Reason: ${activeTrade.entry_reason || 'Not specified'}\n\nProvide: score (1-10), strengths, risks, tip. Brief and practical.`;
      const response = await base44.integrations.Core.InvokeLLM({
        prompt, add_context_from_internet: true,
        response_json_schema: { type: "object", properties: { score: { type: "number" }, strengths: { type: "string" }, risks: { type: "string" }, tip: { type: "string" } } }
      });
      setAiAnalysis(response);
      const newHistory = addAction({ timestamp: new Date().toISOString(), action: 'generate_ai_analysis', description: `AI score ${response.score}/10` });
      await onUpdate(trade.id, { ai_score: response.score, ai_analysis: JSON.stringify(response), action_history: JSON.stringify(newHistory) });
    } catch { toast.error('Failed to generate AI analysis'); }
    finally { setIsGeneratingAI(false); }
  };

  /* ─── render helpers ────────────────────────────────────────────────────── */
  const isExchangeTrade = !!(trade.external_id || trade.import_source === 'bybit');

  /* formatted trade_actions entries */
  const formatTradeAction = (ta) => {
    if (!ta) return '—';
    switch (ta.type) {
      case 'sl_to_be':      return `SL → BE @ ${formatPrice(ta.price)}`;
      case 'partial_close': return `Partial close: ${ta.pnl_usd >= 0 ? '+' : '-'}$${Math.round(Math.abs(ta.pnl_usd))} @ ${formatPrice(ta.price)}`;
      case 'close':         return `Closed @ ${formatPrice(ta.price)}`;
      default:              return ta.type;
    }
  };

  /* ─── JSX ────────────────────────────────────────────────────────────────── */
  return (
    <div className="backdrop-blur-2xl bg-white/[0.02] border border-white/[0.08] shadow-[0_16px_48px_rgba(0,0,0,0.5)] rounded-2xl p-4 relative overflow-hidden">

      {/* top chrome line */}
      <div className="absolute top-0 left-12 right-12 pointer-events-none">
        <div className="h-[1.5px] bg-gradient-to-r from-transparent via-white/20 to-transparent"
          style={{ maskImage: 'linear-gradient(to right,transparent 0%,black 5%,black 95%,transparent 100%)', WebkitMaskImage: 'linear-gradient(to right,transparent 0%,black 5%,black 95%,transparent 100%)' }} />
      </div>

      {/* Live timer */}
      {isOpen && liveTimer > 0 && (
        <div className="absolute top-3 left-4 flex items-center gap-1 text-[9px] text-white/30 z-10">
          <Timer className="w-3 h-3" />
          <span className="font-mono">{formatDuration(liveTimer)}</span>
        </div>
      )}

      {/* Edit controls */}
      <div className="absolute top-3 right-3 flex gap-1.5 z-10">
        {isEditing ? (
          <>
            <Button size="sm" variant="ghost" onClick={handleSave} disabled={!hasChanges}
              className={cn("h-7 w-7 p-0 rounded-md", hasChanges ? "hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-white/20 border border-white/[0.06]")}>
              <Check className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancel}
              className="h-7 w-7 p-0 rounded-md hover:bg-white/[0.06] text-white/40 border border-white/[0.06]">
              <X className="w-3.5 h-3.5" />
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={handleEdit}
            className="h-7 w-7 p-0 rounded-md hover:bg-white/[0.06] border border-white/[0.06]">
            <Edit2 className="w-3.5 h-3.5 text-white/40" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-[1fr,1px,1fr] gap-0 relative mt-3">

        {/* ══════════════════════════════════════════════════════════════════
            LEFT COLUMN
        ══════════════════════════════════════════════════════════════════ */}
        <div className="flex flex-col gap-2.5 pr-4">

          {/* Row 1: ENTRY | CLOSE */}
          <div className="grid grid-cols-2 gap-2">

            {/* ENTRY */}
            <div className={`${glassCard} p-3`}>
              <div className={`${labelCls} mb-1.5`} style={labelMuted}>ENTRY</div>
              {isEditing ? (
                <Input type="number" step="any" value={editedTrade.entry_price}
                  onChange={(e) => handleFieldChange('entry_price', e.target.value)}
                  className="h-7 text-sm font-mono bg-black/30 border-white/10 text-white" />
              ) : (
                <>
                  <div className="text-[26px] leading-none font-mono font-bold text-white tabular-nums">{formatPrice(activeTrade.entry_price)}</div>
                  <div className="text-[11px] font-mono mt-1.5 tabular-nums" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    {(() => {
                      const d = new Date(trade.date_open || trade.date);
                      return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                    })()}
                  </div>
                </>
              )}
            </div>

            {/* CLOSE */}
            <div className={`${glassCard} p-3`} style={{ background: 'rgba(255,255,255,0.015)' }}>
              <div className={`${labelCls} mb-1.5`} style={labelMuted}>CLOSE</div>
              {isEditing ? (
                <Input type="number" step="any" value={editedTrade.close_price || ''}
                  onChange={(e) => handleFieldChange('close_price', e.target.value)}
                  placeholder="—" className="h-7 text-sm font-mono bg-black/30 border-white/10 text-white" />
              ) : hasPartials && !activeTrade.close_price ? (
                <>
                  <div className="text-[22px] leading-none font-mono font-bold text-white tabular-nums">{formatPrice(avgClosePrice)}</div>
                  <div className={cn("text-[11px] font-mono mt-1.5 tabular-nums", realizedPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                    realized: {realizedPnl >= 0 ? '+' : '-'}${Math.round(Math.abs(realizedPnl))}
                  </div>
                </>
              ) : activeTrade.close_price ? (
                <div className="text-[22px] leading-none font-mono font-bold text-white tabular-nums">{formatPrice(activeTrade.close_price)}</div>
              ) : (
                <>
                  <div className="text-[22px] leading-none font-mono font-bold text-white/30 tabular-nums">—</div>
                  <div className="text-[11px] mt-1.5" style={{ color: 'rgba(255,255,255,0.22)' }}>Waiting...</div>
                </>
              )}
            </div>
          </div>

          {/* Row 2: SIZE | BAL — inline label+value */}
          <div className="grid grid-cols-2 gap-2">

            {/* SIZE */}
            <div className={`${glassCard} p-3`}>
              {isEditing ? (
                <>
                  <div className={`${labelCls} mb-1`} style={labelMuted}>SIZE</div>
                  <Input type="number" value={editedTrade.position_size}
                    onChange={(e) => handleFieldChange('position_size', e.target.value)}
                    className="h-7 text-sm font-mono bg-black/30 border-white/10 text-white" />
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <span className={`${labelCls}`} style={labelMuted}>SIZE</span>
                  <span className="text-[16px] font-mono font-semibold text-white tabular-nums">${formatNumber(activeTrade.position_size)}</span>
                </div>
              )}
            </div>

            {/* BAL */}
            <div className={`${glassCard} p-3`}>
              {isEditing ? (
                <>
                  <div className={`${labelCls} mb-1`} style={labelMuted}>BAL.</div>
                  <Input type="number" value={editedTrade.account_balance_at_entry || balance}
                    onChange={(e) => handleFieldChange('account_balance_at_entry', e.target.value)}
                    className="h-7 text-sm font-mono bg-black/30 border-white/10 text-white" />
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <span className={`${labelCls}`} style={labelMuted}>BAL.</span>
                  <span className="text-[16px] font-mono font-semibold text-white tabular-nums">${formatNumber(balance)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Row 3: STOP | TAKE | R:R */}
          <div className="grid grid-cols-3 gap-2">

            {/* STOP */}
            <div className={`${glassStop} p-3 flex flex-col relative`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`${labelCls} text-red-300/70`}>STOP</span>
                <span className="text-[14px]">🖐</span>
              </div>
              {isEditing ? (
                <Input type="number" step="any" value={editedTrade.stop_price}
                  onChange={(e) => handleFieldChange('stop_price', e.target.value)}
                  className="h-7 text-xs font-mono bg-black/40 border-red-500/30 text-red-300" />
              ) : (
                <>
                  <div className="text-[20px] leading-none font-mono font-bold text-white tabular-nums truncate">
                    {hasStop ? formatPrice(activeTrade.stop_price) : '—'}
                  </div>
                  {hasStop && entry > 0 && (() => {
                    const distUsd    = riskUsd !== null ? Math.abs(riskUsd) : (size > 0 ? size * Math.abs(entry - stop) / entry : null);
                    const balancePct = distUsd !== null && balance > 0 ? (distUsd / balance) * 100 : null;
                    return (
                      <div className="text-[11px] mt-1.5 tabular-nums" style={{ color: 'rgba(255,100,100,0.8)' }}>
                        {distUsd !== null ? `-$${Math.round(distUsd)}` : ''}{balancePct !== null ? ` (${balancePct.toFixed(1)}%)` : ''}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>

            {/* TAKE */}
            <div className={`${glassTake} p-3 flex flex-col relative`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`${labelCls} text-emerald-300/70`}>TAKE</span>
                <span className="text-[14px]">🎯</span>
              </div>
              {isEditing ? (
                <Input type="number" step="any" value={editedTrade.take_price}
                  onChange={(e) => handleFieldChange('take_price', e.target.value)}
                  className="h-7 text-xs font-mono bg-black/40 border-emerald-500/30 text-emerald-300" />
              ) : (
                <>
                  <div className="text-[20px] leading-none font-mono font-bold tabular-nums truncate" style={{ color: hasTake ? '#17D48A' : 'rgba(255,255,255,0.2)' }}>
                    {hasTake ? formatPrice(activeTrade.take_price) : '—'}
                  </div>
                  {hasTake && entry > 0 && (() => {
                    const tpDist  = potentialUsd !== null ? Math.abs(potentialUsd) : (size > 0 ? size * Math.abs(take - entry) / entry : null);
                    const tpPct   = tpDist !== null && balance > 0 ? (tpDist / balance) * 100 : null;
                    return (
                      <div className="text-[11px] mt-1.5 tabular-nums" style={{ color: 'rgba(60,220,130,0.8)' }}>
                        {tpDist !== null ? `+$${Math.round(tpDist)}` : ''}{tpPct !== null ? ` (${tpPct.toFixed(1)}%)` : ''}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>

            {/* R:R */}
            <div className={`${glassRR} p-3 flex flex-col relative`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`${labelCls}`} style={labelMuted}>R:R</span>
                <span className="text-[14px]">⚖️</span>
              </div>
              {isStopAtBE && hasTake && potentialPercent !== null ? (
                <div className="text-[20px] leading-none font-mono font-bold tabular-nums text-emerald-400">
                  +{potentialPercent.toFixed(1)}%
                </div>
              ) : (
                <div className={cn(
                  "text-[20px] leading-none font-mono font-bold tabular-nums",
                  !hasStop || !hasTake ? "text-white/20" :
                  rrRatio && rrRatio >= 2 ? "text-emerald-400" : "text-white/70"
                )}>
                  {!hasStop || !hasTake ? '—' : rrRatio ? `1:${rrRatio.toFixed(1)}` : '—'}
                </div>
              )}
            </div>
          </div>

          {/* GAMBLING DETECT — full-width */}
          <div className={`${glassCard} relative overflow-hidden`} style={{ minHeight: 64 }}>
            {/* blurred bg text */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
              <span className="text-[10px] text-white/[0.04] blur-[3px] font-mono tracking-widest">
                PATTERN DETECTED · RISK · IMPULSE · FOMO · TILT · REVENGE
              </span>
            </div>
            {/* centered badge */}
            <div className="h-16 flex items-center justify-center">
              <span className="px-3 py-1.5 bg-violet-900/60 border border-violet-500/40 text-violet-300 rounded-full text-[11px] font-semibold tracking-wide">
                🧪 IN DEVELOPMENT
              </span>
            </div>
          </div>

          {/* SCREENSHOT */}
          <div className={`${glassCard} p-3`} style={{ minHeight: 100 }}>
            {/* header row */}
            <div className="flex items-center gap-2 mb-2">
              <Camera className="w-3.5 h-3.5 text-white/30" />
              <span className={`${labelCls} flex-1`} style={labelMuted}>SCREENSHOT</span>
              {screenshotUrl && (
                <Button size="sm" variant="ghost"
                  onClick={async () => {
                    const ok = await confirmDialog('Delete screenshot?');
                    if (!ok) return;
                    setScreenshotUrl('');
                    await onUpdate(trade.id, { screenshot_url: null });
                    toast.success('Screenshot deleted');
                  }}
                  className="h-5 w-5 p-0 hover:bg-red-500/10 text-red-400/60 hover:text-red-400">
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
              <Button size="sm" variant="ghost"
                onClick={() => document.getElementById('screenshot-upload').click()}
                className="h-5 w-5 p-0 hover:bg-white/[0.06] text-white/30 hover:text-white/60">
                <Plus className="w-3 h-3" />
              </Button>
              <input id="screenshot-upload" type="file" accept="image/*" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleScreenshotUpload(e.target.files[0])} />
            </div>
            {/* image area */}
            {screenshotUrl ? (
              <div onClick={() => setShowScreenshotModal(true)}
                className="w-full h-16 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity border border-white/[0.04]">
                <img src={screenshotUrl} alt="Screenshot" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="h-16 rounded-lg" style={{ background: 'rgba(255,255,255,0.015)' }} />
            )}
          </div>

          {/* Action buttons: + Add | Close Position | Partial */}
          {!isEditing && isOpen && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '+ Add',          onClick: () => setShowAddModal(true) },
                { label: 'Close Position', onClick: () => setShowCloseModal(true) },
                { label: 'Partial',        onClick: () => setShowPartialModal(true) },
              ].map(({ label, onClick }) => (
                <Button key={label} size="sm" onClick={onClick}
                  className="h-10 bg-transparent border border-white/[0.08] text-white/70 hover:bg-white/[0.05] hover:text-white text-[11px] font-medium">
                  {label}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* VERTICAL DIVIDER */}
        <div className="bg-white/[0.05]" />

        {/* ══════════════════════════════════════════════════════════════════
            RIGHT COLUMN
        ══════════════════════════════════════════════════════════════════ */}
        <div className="flex flex-col gap-2.5 pl-4">

          {/* STRATEGY */}
          <div className={`${glassCard} p-3`}>
            <div className="flex items-center justify-between gap-2">
              <span className={`${labelCls} shrink-0`} style={labelMuted}>STRATEGY</span>
              {isEditing ? (
                <>
                  <Input value={editedTrade.strategy_tag || ''} onChange={(e) => handleFieldChange('strategy_tag', e.target.value)}
                    list="strategies" placeholder="Strategy..." className="h-7 text-xs bg-black/30 border-white/10 text-white flex-1" />
                  <datalist id="strategies">{usedStrategies.map(s => <option key={s} value={s} />)}</datalist>
                </>
              ) : activeTrade.strategy_tag ? (
                <span className="bg-violet-800/60 border border-violet-500/50 text-violet-200 px-3 py-1 rounded-md text-sm font-semibold truncate max-w-[160px]">
                  {activeTrade.strategy_tag}
                </span>
              ) : (
                <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>
              )}
            </div>
          </div>

          {/* TIMEFRAME — simple row, no bull/bear toggle */}
          <div className={`${glassCard} p-3`}>
            <div className="flex items-center justify-between gap-2">
              <span className={`${labelCls} shrink-0`} style={labelMuted}>TIMEFRAME</span>
              {isEditing ? (
                <Select value={editedTrade.timeframe || ''} onValueChange={(val) => handleFieldChange('timeframe', val)}>
                  <SelectTrigger className="h-7 text-xs bg-black/30 border-white/10 text-white w-32">
                    <SelectValue placeholder="..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-[#333]">
                    {['scalp','day','swing','mid_term','long_term','spot'].map(v => (
                      <SelectItem key={v} value={v} className="text-white capitalize">{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-[13px] font-mono font-semibold text-white/80 uppercase">
                  {activeTrade.timeframe || <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>}
                </span>
              )}
            </div>
          </div>

          {/* ENTRY REASON */}
          <div className={`${glassCard} p-3 flex-1 min-h-[120px]`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`${labelCls}`} style={labelMuted}>ENTRY REASON</span>
              {!isEditing && (
                <Button size="sm" variant="ghost" onClick={handleEdit}
                  className="h-5 w-5 p-0 hover:bg-white/[0.06] text-white/30">
                  <Edit2 className="w-3 h-3" />
                </Button>
              )}
            </div>
            {isEditing ? (
              <Textarea value={editedTrade.entry_reason || ''} onChange={(e) => handleFieldChange('entry_reason', e.target.value)}
                placeholder="Why did you enter?" className="h-[90px] text-xs bg-black/30 border-white/10 resize-none text-white" />
            ) : (
              <div className="min-h-[80px] flex items-center justify-center">
                {activeTrade.entry_reason ? (
                  <div className="w-full text-[11px] text-white/70 whitespace-pre-wrap leading-relaxed">
                    {activeTrade.entry_reason}
                  </div>
                ) : (
                  <span className="text-white/20 text-sm">...</span>
                )}
              </div>
            )}
          </div>

          {/* ACTIONS — trade_actions navigator */}
          <div className={`${glassCard} p-2.5`}>
            <div className="flex items-center justify-between">
              <button onClick={() => setTradeActionIdx(Math.max(0, tradeActionIdx - 1))}
                disabled={tradeActionIdx === 0 || tradeActions.length === 0}
                className="w-6 h-6 flex items-center justify-center text-white/40 disabled:opacity-20 text-sm hover:text-white/60 transition-colors">
                &lt;
              </button>
              <div className="flex-1 px-2 text-center">
                {tradeActions.length > 0 ? (
                  <p className="text-[11px] text-white/70 truncate">{formatTradeAction(tradeActions[tradeActionIdx])}</p>
                ) : (
                  <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.2)' }}>No actions yet</p>
                )}
              </div>
              <button onClick={() => setTradeActionIdx(Math.min(tradeActions.length - 1, tradeActionIdx + 1))}
                disabled={tradeActionIdx >= tradeActions.length - 1 || tradeActions.length === 0}
                className="w-6 h-6 flex items-center justify-center text-white/40 disabled:opacity-20 text-sm hover:text-white/60 transition-colors">
                &gt;
              </button>
            </div>
          </div>

          {/* AI SCORE */}
          <div className={`${glassAI} p-3 relative`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[16px]">🤖</span>
                <div>
                  <div className={`${labelCls} text-cyan-300/60`}>AI SCORE</div>
                  {activeTrade.ai_score && (
                    <div className={cn("text-sm font-bold tabular-nums mt-0.5",
                      activeTrade.ai_score >= 7 ? "text-emerald-400" : activeTrade.ai_score >= 5 ? "text-yellow-400" : "text-red-400")}>
                      {activeTrade.ai_score}/10
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {!activeTrade.ai_score && (
                  <Button size="sm" variant="ghost" onClick={handleGenerateAI} disabled={true}
                    className="h-7 px-3 text-[11px] bg-black/20 border border-white/[0.06] text-white/30 cursor-not-allowed rounded-md">
                    Generate
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setShowAI(!showAI)}
                  className="h-6 w-6 p-0 rounded-full bg-black/20 border border-white/[0.06] text-white/30 hover:text-white/60">
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            </div>
            {/* IN DEVELOPMENT badge */}
            {!activeTrade.ai_score && (
              <div className="mt-2">
                <span className="px-2 py-0.5 bg-cyan-900/40 border border-cyan-500/30 rounded-full text-[10px] text-cyan-400/70 font-semibold">
                  🧪 IN DEVELOPMENT
                </span>
              </div>
            )}
            {showAI && aiAnalysis && (
              <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2 text-[10px]">
                <div className="flex gap-1.5"><span className="text-emerald-400 shrink-0">✓</span><span className="text-white/60 leading-relaxed">{aiAnalysis.strengths}</span></div>
                <div className="flex gap-1.5"><span className="text-yellow-400 shrink-0">⚠</span><span className="text-white/60 leading-relaxed">{aiAnalysis.risks}</span></div>
                <div className="flex gap-1.5"><span className="text-blue-400 shrink-0">💡</span><span className="text-white/60 leading-relaxed">{aiAnalysis.tip}</span></div>
              </div>
            )}
          </div>

          {/* Bottom buttons: share + SL→BE | Hit SL | Hit TP */}
          {!isEditing && isOpen && (
            <div className="flex items-center gap-2">
              {/* Share */}
              <Button size="sm" variant="ghost"
                onClick={async () => {
                  try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = 600; canvas.height = 400;
                    const grad = ctx.createLinearGradient(0, 0, 0, 400);
                    grad.addColorStop(0, '#1a1a1a'); grad.addColorStop(1, '#0a0a0a');
                    ctx.fillStyle = grad; ctx.fillRect(0, 0, 600, 400);
                    ctx.fillStyle = '#c0c0c0'; ctx.font = 'bold 32px Arial';
                    ctx.fillText(`${trade.coin} ${trade.direction}`, 40, 80);
                    ctx.font = '20px Arial';
                    ctx.fillText(`Entry: ${formatPrice(trade.entry_price)}`, 40, 140);
                    ctx.fillText(`Size: $${formatNumber(trade.position_size)}`, 40, 180);
                    const pnl = calcCurrentPnl();
                    ctx.fillStyle = pnl >= 0 ? '#10b981' : '#ef4444';
                    ctx.font = 'bold 28px Arial';
                    ctx.fillText(`${pnl >= 0 ? '+' : '-'}$${formatNumber(Math.abs(pnl))}`, 40, 240);
                    setShareImageUrl(canvas.toDataURL('image/png'));
                    setShowShareModal(true);
                  } catch { toast.error('Failed to generate share image'); }
                }}
                className="h-8 w-8 p-0 rounded-full bg-black/20 border border-white/[0.06] hover:bg-white/[0.06]">
                <Share2 className="w-3.5 h-3.5 text-white/40" />
              </Button>

              {/* SL→BE | Hit SL | Hit TP — only for manual trades */}
              {!isExchangeTrade && (
                <div className="flex-1 grid grid-cols-3 gap-1.5">
                  <Button size="sm" onClick={handleMoveToBE}
                    className="h-8 bg-transparent border border-white/[0.08] text-white/60 hover:bg-white/[0.05] hover:text-white text-[11px] font-medium rounded-full">
                    SL→BE
                  </Button>
                  <Button size="sm" onClick={handleHitSL}
                    className="h-8 bg-transparent border border-red-500/20 text-red-400/70 hover:bg-red-500/10 hover:text-red-400 text-[11px] font-medium rounded-full">
                    Hit SL
                  </Button>
                  <Button size="sm" onClick={handleHitTP}
                    className="h-8 bg-transparent border border-emerald-500/20 text-emerald-400/70 hover:bg-emerald-500/10 hover:text-emerald-400 text-[11px] font-medium rounded-full">
                    Hit TP
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}

      {/* Close */}
      <Dialog open={showCloseModal} onOpenChange={setShowCloseModal}>
        <DialogContent className="bg-[#111] border border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.2)] [&>button]:text-white [&>button]:hover:text-white">
          <DialogHeader><DialogTitle className="text-white/80 text-lg">Close Position</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-white/40 mb-2 block">Close Price</Label>
              <Input type="number" step="any" value={closePrice} onChange={(e) => setClosePrice(e.target.value)}
                placeholder="Enter close price..." className="bg-black/40 border-red-500/30 text-white h-12 text-lg" />
            </div>
            <div>
              <Label className="text-sm text-white/40 mb-2 block">Comment (optional)</Label>
              <Textarea value={closeComment} onChange={(e) => setCloseComment(e.target.value)}
                placeholder="Why did you close?" className="bg-black/40 border-red-500/30 h-20 resize-none text-white" />
            </div>
            <Button onClick={handleClosePosition} className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold h-12">
              Confirm Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Partial */}
      <Dialog open={showPartialModal} onOpenChange={setShowPartialModal}>
        <DialogContent className="bg-[#111] border border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.2)] [&>button]:text-white [&>button]:hover:text-white">
          <DialogHeader><DialogTitle className="text-white/80 text-lg">Partial Close</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-3">
                <Label className="text-sm text-white/40">Close Percentage</Label>
                <span className="text-2xl font-bold text-amber-400">{partialPercent}%</span>
              </div>
              <Slider value={[partialPercent]} onValueChange={([v]) => setPartialPercent(v)} min={1} max={100} step={1} className="mb-2" />
            </div>
            <div>
              <Label className="text-sm text-white/40 mb-2 block">Close Price</Label>
              <Input type="number" step="any" value={partialPrice} onChange={(e) => setPartialPrice(e.target.value)}
                placeholder="Enter close price..." className="bg-black/40 border-amber-500/30 text-white h-12 text-lg" />
            </div>
            <Button onClick={handlePartialClose} className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold h-12">
              Confirm Partial Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="bg-[#111] border border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.2)] [&>button]:text-white [&>button]:hover:text-white">
          <DialogHeader><DialogTitle className="text-white/80 text-lg">Add to Position</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-white/40 mb-2 block">Entry Price</Label>
              <Input type="number" step="any" value={addPrice} onChange={(e) => setAddPrice(e.target.value)}
                placeholder="New entry price..." className="bg-black/40 border-blue-500/30 text-white h-12 text-lg" />
            </div>
            <div>
              <Label className="text-sm text-white/40 mb-2 block">Size ($)</Label>
              <Input type="number" value={addSize} onChange={(e) => setAddSize(e.target.value)}
                placeholder="Additional size..." className="bg-black/40 border-blue-500/30 text-white h-12 text-lg" />
            </div>
            <Button onClick={handleAddPosition} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold h-12">
              Confirm Add Position
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Screenshot fullscreen */}
      <Dialog open={showScreenshotModal} onOpenChange={setShowScreenshotModal}>
        <DialogContent className="bg-[#111] border-white/[0.06] max-w-4xl [&>button]:text-white [&>button]:hover:text-white">
          <DialogHeader><DialogTitle className="text-white/60">Screenshot</DialogTitle></DialogHeader>
          <div className="w-full max-h-[70vh] overflow-auto">
            <img src={screenshotUrl} alt="Screenshot" className="w-full h-auto" />
          </div>
        </DialogContent>
      </Dialog>

      {/* Share */}
      <Dialog open={showShareModal} onOpenChange={setShowShareModal}>
        <DialogContent className="bg-[#0a0a0a] border-white/[0.06] max-w-[650px] [&>button]:text-white [&>button]:hover:text-white">
          <DialogHeader><DialogTitle className="text-white/70 text-xl font-bold">Share Your Trade</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="w-full rounded-xl p-3 border border-white/[0.06]">
              <img src={shareImageUrl} alt="Share" className="w-full h-auto rounded-lg" />
            </div>
            <div className="flex gap-3">
              <Button onClick={async () => {
                try {
                  const resp = await fetch(shareImageUrl);
                  const blob = await resp.blob();
                  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                  toast.success('Copied to clipboard');
                } catch { toast.error('Failed to copy'); }
              }} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white">
                <Copy className="w-4 h-4 mr-2" /> Copy
              </Button>
              <Button onClick={() => {
                const link = document.createElement('a');
                link.download = `trade-${trade.coin}-${new Date().toISOString().split('T')[0]}.png`;
                link.href = shareImageUrl; link.click();
              }} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                <Download className="w-4 h-4 mr-2" /> Download
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden share content */}
      <div id={`share-content-open-${trade.id}`} className="fixed -left-[9999px]">
        <ShareTradeCard trade={trade} isOpen={true} />
      </div>

      <ConfirmDialogComponent />
    </div>
  );
}
