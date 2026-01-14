import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Edit2, Trash2, Check, X, Zap, Image as ImageIcon, LinkIcon, Paperclip, TrendingUp, TrendingDown, Wallet, Package, AlertTriangle, Target, Plus, Trophy, ThumbsUp, ThumbsDown, Share2, ChevronDown, ChevronUp, Download, Copy, Clock, Timer } from 'lucide-react';
import { cn } from "@/lib/utils";
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import html2canvas from 'html2canvas';
import { useQuery } from '@tanstack/react-query';
import ShareTradeCard from './ShareTradeCard';

const formatPrice = (price) => {
  if (price === undefined || price === null || price === '') return '—';
  const p = parseFloat(price);
  if (isNaN(p)) return '—';
  
  if (Math.abs(p) >= 1) {
    const str = p.toPrecision(4);
    const formatted = parseFloat(str).toString();
    return `$${formatted}`;
  }
  
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

export default function ClosedTradeCard({ trade, onUpdate, onDelete, currentBalance, formatDate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTrade, setEditedTrade] = useState(trade);
  const [showScreenshotModal, setShowScreenshotModal] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState(trade.screenshot_url || '');
  const [screenshotInput, setScreenshotInput] = useState('');
  const [satisfaction, setSatisfaction] = useState(0);
  const [mistakes, setMistakes] = useState([]);
  const [newMistake, setNewMistake] = useState('');
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareImageUrl, setShareImageUrl] = useState('');
  const [generatingAI, setGeneratingAI] = useState(false);
  const [editingAnalytics, setEditingAnalytics] = useState(false);
  const [editingMistakes, setEditingMistakes] = useState(false);
  const [editingSatisfaction, setEditingSatisfaction] = useState(false);
  const [savedSatisfaction, setSavedSatisfaction] = useState(0);
  const [userEmail, setUserEmail] = useState('trader');
  const [editingConfidence, setEditingConfidence] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [savedConfidence, setSavedConfidence] = useState(0);

  const { data: tradeTemplates = [] } = useQuery({
    queryKey: ['tradeTemplates'],
    queryFn: async () => {
      const profiles = await base44.entities.UserProfile.list('-created_date', 10);
      const activeProfile = profiles.find(p => p.is_active);
      if (!activeProfile) return [];
      return base44.entities.TradeTemplates.filter({ profile_id: activeProfile.id }, '-created_date', 1);
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

  useEffect(() => {
    setEditedTrade(trade);
    setScreenshotUrl(trade.screenshot_url || '');
    // Parse mistakes from violation_tags or mistakes field
    try {
      let parsedMistakes = [];
      if (trade.violation_tags) {
        parsedMistakes = typeof trade.violation_tags === 'string' ? JSON.parse(trade.violation_tags) : trade.violation_tags;
      } else if (trade.mistakes) {
        parsedMistakes = typeof trade.mistakes === 'string' ? JSON.parse(trade.mistakes) : trade.mistakes;
      }
      setMistakes(Array.isArray(parsedMistakes) ? parsedMistakes : []);
    } catch {
      setMistakes([]);
    }
  }, [trade]);
  
  // Initialize satisfaction and confidence only once when trade changes
  useEffect(() => {
    const tradeSatisfaction = trade.satisfaction !== undefined && trade.satisfaction !== null ? trade.satisfaction : 0;
    const tradeConfidence = trade.confidence_level !== undefined && trade.confidence_level !== null ? trade.confidence_level : 0;
    
    setSatisfaction(tradeSatisfaction);
    setSavedSatisfaction(tradeSatisfaction);
    setConfidence(tradeConfidence);
    setSavedConfidence(tradeConfidence);
  }, [trade.id]);

  useEffect(() => {
    base44.auth.me().then(user => {
      if (user?.email) setUserEmail(user.email);
    }).catch(() => {});
  }, []);

  const isLong = trade.direction === 'Long';
  const balance = trade.account_balance_at_entry || currentBalance || 100000;
  const pnl = trade.pnl_usd || 0;
  const pnlPercent = trade.pnl_percent_of_balance || 0;
  const rMultiple = trade.r_multiple || 0;

  // Display size - use saved position_size (which includes all history) or calculate max
  const displaySize = (() => {
    let size = parseFloat(trade.position_size) || 0;
    
    // If we have position_size saved and it's > 0, use it directly
    if (size > 0) {
      return size;
    }
    
    // Otherwise calculate from PNL and prices as fallback
    const entryPrice = parseFloat(trade.entry_price) || 0;
    const closePrice = parseFloat(trade.close_price) || 0;
    const pnlUsd = parseFloat(trade.pnl_usd) || 0;
    
    if (entryPrice > 0 && closePrice > 0 && Math.abs(pnlUsd) > 0) {
      const priceDiff = Math.abs(closePrice - entryPrice);
      if (priceDiff > 0) {
        const priceChangePercent = priceDiff / entryPrice;
        size = Math.abs(pnlUsd / priceChangePercent);
      }
    }
    
    return size;
  })();

  // Calculate initial stop risk
  const originalEntry = trade.original_entry_price || trade.entry_price || 0;
  const originalStop = trade.original_stop_price || trade.stop_price || 0;
  const initialStopDistance = Math.abs(originalEntry - originalStop);
  const initialRiskUsd = originalEntry > 0 ? (initialStopDistance / originalEntry) * displaySize : 0;
  const initialRiskPercent = (initialRiskUsd / balance) * 100;

  // Calculate stop when close risk
  const closeStopDistance = Math.abs((trade.entry_price || 0) - (trade.stop_price || 0));
  const closeRiskUsd = (trade.entry_price && trade.entry_price > 0) ? (closeStopDistance / trade.entry_price) * displaySize : 0;
  const closeRiskPercent = (closeRiskUsd / balance) * 100;

  // Calculate take profit potential
  const takeProfitDistance = Math.abs((trade.take_price || 0) - (trade.entry_price || 0));
  const takePotentialUsd = (trade.entry_price && trade.entry_price > 0) ? (takeProfitDistance / trade.entry_price) * displaySize : 0;
  const takePotentialPercent = (takePotentialUsd / balance) * 100;

  const balanceAfterClose = balance + pnl;

  const formatDuration = (minutes) => {
    if (!minutes) return '—';
    const d = Math.floor(minutes / 1440);
    const h = Math.floor((minutes % 1440) / 60);
    const m = minutes % 60;
    let result = [];
    if (d > 0) result.push(`${d}d`);
    if (h > 0) result.push(`${h}h`);
    if (m > 0) result.push(`${m}m`);
    return result.join(' ');
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

  const handleSave = async () => {
    const closePrice = parseFloat(editedTrade.close_price);
    
    if (!closePrice || closePrice <= 0) {
      // Reopen trade
      const updated = {
        ...editedTrade,
        close_price: null,
        date_close: null,
        pnl_usd: 0,
        pnl_percent_of_balance: 0,
        r_multiple: 0,
        satisfaction,
        mistakes: JSON.stringify(mistakes)
      };
      await onUpdate(trade.id, updated);
      setIsEditing(false);
      toast.success('Trade reopened');
      return;
    }

    // Recalculate PNL
    const entryPrice = parseFloat(editedTrade.entry_price) || 0;
    const positionSize = parseFloat(editedTrade.position_size) || displaySize;
    const maxRiskUsd = trade.max_risk_usd || initialRiskUsd;

    const pnlUsd = isLong 
      ? ((closePrice - entryPrice) / entryPrice) * positionSize
      : ((entryPrice - closePrice) / entryPrice) * positionSize;

    const pnlPercent = (pnlUsd / balance) * 100;
    const rMultiple = maxRiskUsd > 0 ? pnlUsd / maxRiskUsd : 0;

    const updated = {
      ...editedTrade,
      close_price: closePrice,
      position_size: positionSize,
      pnl_usd: pnlUsd,
      pnl_percent_of_balance: pnlPercent,
      r_multiple: rMultiple,
      satisfaction,
      violation_tags: JSON.stringify(mistakes),
      original_stop_price: editedTrade.original_stop_price || trade.original_stop_price || editedTrade.stop_price,
    };

    await onUpdate(trade.id, updated);
    setIsEditing(false);
    toast.success('Trade updated');
  };



  const generateShareImage = async () => {
    const shareContent = document.getElementById(`share-content-closed-${trade.id}`);
    if (!shareContent) return;

    try {
      const canvas = await html2canvas(shareContent, { 
        backgroundColor: '#0a0a0a',
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true,
        width: 600,
        height: 600
      });
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      setShareImageUrl(dataUrl);
      setShowShareModal(true);
    } catch (error) {
      console.error('Share image generation error:', error);
      toast.error('Failed to generate image');
    }
  };

  const copyShareImage = async () => {
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
  };

  const downloadShareImage = () => {
    const link = document.createElement('a');
    link.download = `trade-${trade.coin}-${formatDate(trade.date_close || trade.date_open)}.png`;
    link.href = shareImageUrl;
    link.click();
  };

  const generateAIAnalysis = async () => {
    setGeneratingAI(true);
    try {
      const prompt = `Analyze this closed trade:
Coin: ${trade.coin}
Direction: ${trade.direction}
Entry: ${trade.entry_price}, Close: ${trade.close_price}
PNL: $${pnl.toFixed(2)} (${pnlPercent.toFixed(1)}%)
R-multiple: ${rMultiple.toFixed(1)}R
Strategy: ${trade.strategy_tag || 'None'}
Entry Reason: ${trade.entry_reason || 'None'}

Provide brief analysis in JSON format:
{
  "strengths": "What went well",
  "risks": "What could be improved",
  "tip": "Key takeaway"
}`;
      
      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            strengths: { type: 'string' },
            risks: { type: 'string' },
            tip: { type: 'string' }
          }
        }
      });

      const score = pnl > 0 ? Math.min(10, 5 + Math.round(rMultiple * 2)) : Math.max(0, 5 - Math.abs(rMultiple) * 2);
      
      await onUpdate(trade.id, { 
        ai_analysis: JSON.stringify(result),
        ai_score: score
      });
      toast.success('AI analysis generated');
    } catch (error) {
      toast.error('Failed to generate analysis');
    }
    setGeneratingAI(false);
  };

  return (
    <div className="bg-[#0a0a0a] relative overflow-hidden">
      {/* Gradient separator line */}
      <div className="absolute top-0 left-12 right-12 z-10">
        <div className="h-[2px] bg-gradient-to-r from-transparent via-[#c0c0c0]/40 to-transparent" style={{
          maskImage: 'linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%)'
        }} />
      </div>

      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-radial from-[#c0c0c0]/8 via-transparent to-transparent blur-2xl" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-gradient-radial from-[#888]/8 via-transparent to-transparent blur-2xl" />
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `linear-gradient(to right, #c0c0c0 1px, transparent 1px), linear-gradient(to bottom, #c0c0c0 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }} />
      </div>

      <div className="p-4 relative z-20">
        {/* Edit/Delete buttons */}
        <div className="absolute top-4 right-4 flex flex-col justify-between z-10" style={{ height: '70px' }}>
          {isEditing ? (
            <>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={handleSave}
                className="h-7 w-7 p-0 hover:bg-emerald-500/20 text-emerald-400"
              >
                <Check className="w-3.5 h-3.5" />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => { setEditedTrade(trade); setIsEditing(false); }}
                className="h-7 w-7 p-0 hover:bg-[#2a2a2a] text-[#888]"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setIsEditing(true)}
                className="h-7 w-7 p-0 hover:bg-[#2a2a2a]"
              >
                <Edit2 className="w-3.5 h-3.5 text-[#888] hover:text-[#c0c0c0]" />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => onDelete(trade)}
                className="h-7 w-7 p-0 hover:bg-red-500/20"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400/70 hover:text-red-400" />
              </Button>
            </>
          )}
        </div>

        {/* Top section: Technical data - narrower panels with right margin */}
        <div className="grid grid-cols-6 gap-2 mb-4 mr-20">
          {/* Entry price */}
          <div className="bg-gradient-to-br from-[#151515] to-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-2.5">
            <div className="flex items-center gap-1 mb-1">
              {isLong ? <TrendingUp className="w-3 h-3 text-emerald-400/70" /> : <TrendingDown className="w-3 h-3 text-red-400/70" />}
              <span className="text-[9px] text-[#666] uppercase tracking-wide">Entry</span>
            </div>
            {isEditing ? (
              <Input
                type="number"
                step="any"
                value={editedTrade.entry_price}
                onChange={(e) => setEditedTrade(prev => ({ ...prev, entry_price: e.target.value }))}
                className="h-6 text-sm font-bold bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
              />
            ) : (
              <>
                <div className="text-sm font-bold text-[#c0c0c0]">{formatPrice(trade.entry_price)}</div>
                <div className="text-[8px] text-[#666] mt-0.5">
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

          {/* Position size */}
          <div className="bg-gradient-to-br from-[#151515] to-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-2.5">
            <div className="flex items-center gap-1 mb-1">
              <Package className="w-3 h-3 text-[#888]" />
              <span className="text-[9px] text-[#666] uppercase tracking-wide">Size</span>
            </div>
            {isEditing ? (
              <Input
                type="number"
                value={editedTrade.position_size || displaySize}
                onChange={(e) => setEditedTrade(prev => ({ ...prev, position_size: e.target.value }))}
                className="h-6 text-sm font-bold bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
              />
            ) : (
              <div className="text-sm font-bold text-[#c0c0c0]">${formatNumber(displaySize)}</div>
            )}
          </div>

          {/* Initial Stop */}
          <div className="bg-gradient-to-br from-red-500/10 to-[#0d0d0d] border border-red-500/30 rounded-lg p-2.5">
            <div className="text-[9px] text-red-400/70 uppercase tracking-wide mb-1">Initial Stop</div>
            {isEditing ? (
              <Input
                type="number"
                step="any"
                value={editedTrade.original_stop_price || editedTrade.stop_price}
                onChange={(e) => setEditedTrade(prev => ({ ...prev, original_stop_price: e.target.value }))}
                className="h-6 text-sm font-bold bg-[#0d0d0d] border-red-500/20 text-red-400"
              />
            ) : (
              <>
                <div className="text-sm font-bold text-red-400">{formatPrice(originalStop)}</div>
                <div className="text-[8px] text-red-400/60 mt-0.5">${formatNumber(initialRiskUsd)} • {initialRiskPercent.toFixed(1)}%</div>
              </>
            )}
          </div>

          {/* Stop When Close */}
          <div className="bg-gradient-to-br from-red-500/5 to-[#0d0d0d] border border-red-500/20 rounded-lg p-2.5">
            <div className="text-[9px] text-red-400/50 uppercase tracking-wide mb-1">Stop When Close</div>
            <div className="text-sm font-bold text-red-400/80">{formatPrice(trade.stop_price)}</div>
            <div className="text-[8px] text-red-400/50 mt-0.5">${formatNumber(closeRiskUsd)} • {closeRiskPercent.toFixed(1)}%</div>
          </div>

          {/* Take */}
          <div className="bg-gradient-to-br from-emerald-500/10 to-[#0d0d0d] border border-emerald-500/30 rounded-lg p-2.5">
            <div className="flex items-center gap-1 mb-1">
              <Target className="w-3 h-3 text-emerald-400/70" />
              <span className="text-[9px] text-emerald-400/70 uppercase tracking-wide">Take</span>
            </div>
            <div className="text-sm font-bold text-emerald-400">{formatPrice(trade.take_price)}</div>
            <div className="text-[8px] text-emerald-400/60 mt-0.5">${formatNumber(takePotentialUsd)} • {takePotentialPercent.toFixed(1)}%</div>
          </div>

          {/* Close price */}
          <div className="bg-gradient-to-br from-[#151515] to-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-2.5">
            <div className="flex items-center gap-1 mb-1">
              <X className="w-3 h-3 text-[#888]" />
              <span className="text-[9px] text-[#666] uppercase tracking-wide">Close Price</span>
            </div>
            {isEditing ? (
              <Input
                type="number"
                step="any"
                value={editedTrade.close_price}
                onChange={(e) => setEditedTrade(prev => ({ ...prev, close_price: e.target.value }))}
                className="h-6 text-sm font-bold bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
              />
            ) : (
              <>
                <div className="text-sm font-bold text-[#c0c0c0]">{formatPrice(trade.close_price)}</div>
                {trade.date_close && (
                  <div className="text-[8px] text-[#666] mt-0.5">
                    {(() => {
                      const date = new Date(trade.date_close);
                      return date.toLocaleString('ru-RU', { 
                        day: '2-digit', 
                        month: '2-digit',
                        hour: '2-digit', 
                        minute: '2-digit' 
                      });
                    })()}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Duration + Timeframe + Balance */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="bg-gradient-to-br from-[#151515] to-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-2 py-1.5 flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-amber-400/70" />
            <div>
              <div className="text-[7px] text-[#666] uppercase">Duration</div>
              <div className="text-xs font-bold text-amber-400">{formatDuration(trade.actual_duration_minutes)}</div>
            </div>
          </div>
          <div className="bg-gradient-to-r from-purple-500/20 via-blue-500/20 to-cyan-500/20 border border-purple-500/30 rounded-lg px-2 py-1.5 flex items-center gap-1.5">
            <Timer className="w-3 h-3 text-purple-400/70" />
            <div>
              <div className="text-[7px] text-[#666] uppercase">Timeframe</div>
              <div className="text-xs font-bold text-purple-300 uppercase tracking-wide">{trade.timeframe || '—'}</div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-[#151515] to-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-2 py-1.5">
            <div className="text-[7px] text-[#666] uppercase mb-0.5">Bal. Entry</div>
            <div className="text-xs font-bold text-[#888]">${formatNumber(balance)}</div>
          </div>
          <div className="bg-gradient-to-br from-[#151515] to-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-2 py-1.5">
            <div className="text-[7px] text-[#666] uppercase mb-0.5">Bal. After</div>
            <div className={cn(
              "text-xs font-bold",
              pnl >= 0 ? "text-emerald-400" : "text-red-400"
            )}>${formatNumber(balanceAfterClose)}</div>
          </div>
        </div>

        {/* MAIN ACCENT: PNL Section */}
        <div className={cn(
          "relative rounded-xl p-6 mb-4 overflow-hidden border-2",
          pnl >= 0 
            ? "bg-gradient-to-br from-emerald-500/20 via-[#0d0d0d] to-emerald-500/10 border-emerald-500/40 shadow-[0_0_35px_rgba(16,185,129,0.25)]"
            : "bg-gradient-to-br from-red-500/20 via-[#0d0d0d] to-red-500/10 border-red-500/40 shadow-[0_0_35px_rgba(239,68,68,0.25)]"
        )}>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />
          <Button
            size="sm"
            onClick={generateShareImage}
            className="absolute top-2 right-2 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 border border-violet-500/40 h-6 px-2 z-20 gap-1"
          >
            <Share2 className="w-2.5 h-2.5" />
            <span className="text-[10px] font-bold">Поделиться</span>
          </Button>
          <div className="relative z-10 grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-xs text-[#888] mb-2 uppercase tracking-wide">PNL ($)</p>
              <p className={cn(
                "text-4xl font-black",
                pnl >= 0 ? "text-emerald-400" : "text-red-400"
              )}>
               {pnl >= 0 ? '+' : '-'}${formatNumber(Math.abs(pnl))}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#888] mb-2 uppercase tracking-wide">PNL (%)</p>
              <p className={cn(
                "text-4xl font-black",
                pnlPercent >= 0 ? "text-emerald-400" : "text-red-400"
              )}>
               {pnlPercent >= 0 ? '+' : '-'}{Math.abs(pnlPercent).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-[#888] mb-2 uppercase tracking-wide">R Multiple</p>
              <p className={cn(
                "text-4xl font-black",
                rMultiple >= 0 ? "text-emerald-400" : "text-red-400"
              )}>
               {rMultiple >= 0 ? '+' : '-'}{Math.abs(rMultiple).toFixed(1)}R
              </p>
            </div>
          </div>
        </div>

        {/* Hidden share content */}
        <div id={`share-content-closed-${trade.id}`} className="fixed -left-[9999px]">
          <ShareTradeCard trade={trade} isOpen={false} />
        </div>

        {/* Combined Details Section */}
        <div className="bg-[#151515] border border-[#2a2a2a] rounded-xl p-4 mb-3">
          {/* Trade Analytics & AI side-by-side */}
          <div className="grid grid-cols-2 gap-3 mb-3">
          {/* Trade Analytics */}
          <div className="bg-gradient-to-br from-[#151515] to-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3 relative">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                {!trade.trade_analysis && !editingAnalytics && (
                  <AlertTriangle className="w-3 h-3 text-red-400" />
                )}
                <div className="text-[10px] text-[#888] uppercase tracking-wide">Trade Analytics</div>
              </div>
              {!editingAnalytics && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingAnalytics(true)}
                  className="h-5 px-2 text-[8px] text-[#888] hover:text-[#c0c0c0]"
                >
                  <Edit2 className="w-2.5 h-2.5 mr-1" />
                  Edit
                </Button>
              )}
            </div>
            {editingAnalytics ? (
              <div className="space-y-2">
                <Textarea
                  value={editedTrade.trade_analysis || ''}
                  onChange={(e) => setEditedTrade(prev => ({ ...prev, trade_analysis: e.target.value }))}
                  placeholder="What did you learn?"
                  className="bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0] text-xs min-h-[60px]"
                />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setEditingAnalytics(false)} className="h-6 text-xs">
                    Cancel
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={async () => {
                      await onUpdate(trade.id, { trade_analysis: editedTrade.trade_analysis });
                      setEditingAnalytics(false);
                      toast.success('Saved');
                    }}
                    className="h-6 text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400"
                  >
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-xs text-[#c0c0c0] whitespace-pre-wrap min-h-[40px]">
                {trade.trade_analysis || <span className="text-[#555]">Click Edit to add your analysis...</span>}
              </div>
            )}
          </div>

          {/* AI Trade Analysis */}
          <div className="bg-gradient-to-br from-yellow-500/10 via-[#0d0d0d] to-amber-500/10 border border-yellow-500/30 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-[10px] text-yellow-400 uppercase tracking-wide font-semibold">AI Analysis</span>
              {trade.ai_score && (
                <span className={cn(
                  "text-sm font-bold",
                  trade.ai_score >= 7 ? "text-emerald-400" : trade.ai_score >= 5 ? "text-yellow-400" : "text-red-400"
                )}>
                  {trade.ai_score}/10
                </span>
              )}
            </div>
            {!trade.ai_analysis && (
              <Button
                size="sm"
                onClick={generateAIAnalysis}
                disabled={generatingAI}
                className="h-6 px-2 text-xs bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400"
              >
                {generatingAI ? 'Generating...' : 'Generate'}
              </Button>
            )}
          </div>
          {trade.ai_analysis ? (
            (() => {
              try {
                const analysis = JSON.parse(trade.ai_analysis);
                return (
                  <div className="space-y-2 text-[10px]">
                    <div className="flex gap-1.5">
                      <span className="text-emerald-400 shrink-0">✓</span>
                      <span className="text-[#c0c0c0]">{analysis.strengths}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <span className="text-yellow-400 shrink-0">⚠</span>
                      <span className="text-[#c0c0c0]">{analysis.risks}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <span className="text-blue-400 shrink-0">💡</span>
                      <span className="text-[#c0c0c0]">{analysis.tip}</span>
                    </div>
                  </div>
                );
              } catch {
                return <p className="text-xs text-[#666]">No analysis available</p>;
              }
            })()
          ) : (
            <p className="text-xs text-[#666]">Click Generate to create AI analysis</p>
          )}
          </div>
          </div>

          {/* Details Collapsible Section */}
          <button
            onClick={() => setDetailsExpanded(!detailsExpanded)}
            className="w-full bg-gradient-to-r from-[#1a1a1a] to-[#151515] border border-[#2a2a2a] rounded-lg p-3 flex items-center justify-between hover:border-[#333] transition-colors"
          >
            <span className="text-sm font-semibold text-[#c0c0c0]">Details</span>
            {detailsExpanded ? <ChevronUp className="w-4 h-4 text-[#888]" /> : <ChevronDown className="w-4 h-4 text-[#888]" />}
          </button>

          {detailsExpanded && (
            <div className="pt-3 space-y-3">
            {/* Satisfaction - REDESIGNED (compact, gradient background) */}
            <div 
              className={cn(
                "relative rounded-lg p-2.5 overflow-hidden border transition-all duration-300",
                savedSatisfaction === 0 ? "bg-gradient-to-r from-[#1a1a1a] to-[#151515] border-[#2a2a2a]" :
                savedSatisfaction >= 7 ? "bg-gradient-to-r from-emerald-500/25 via-emerald-500/15 to-emerald-500/5 border-emerald-500/40" :
                savedSatisfaction >= 4 ? "bg-gradient-to-r from-amber-500/25 via-amber-500/15 to-amber-500/5 border-amber-500/40" :
                "bg-gradient-to-r from-red-500/25 via-red-500/15 to-red-500/5 border-red-500/40"
              )}
            >
              {editingSatisfaction ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-[#888] uppercase tracking-wide">Satisfaction</div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-bold text-[#c0c0c0]">{satisfaction}/10</div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await onUpdate(trade.id, { satisfaction });
                          setSavedSatisfaction(satisfaction);
                          setEditingSatisfaction(false);
                        }}
                        className="h-5 w-5 p-0 hover:bg-emerald-500/20"
                      >
                        <Check className="w-3 h-3 text-emerald-400" />
                      </Button>
                    </div>
                  </div>
                  <Slider
                    value={[satisfaction]}
                    onValueChange={([val]) => setSatisfaction(val)}
                    min={0}
                    max={10}
                    step={1}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-[#888] uppercase tracking-wide">Satisfaction</div>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "text-xl font-bold",
                      savedSatisfaction >= 7 ? "text-emerald-400" :
                      savedSatisfaction >= 4 ? "text-amber-400" :
                      "text-red-400"
                    )}>{savedSatisfaction}</div>
                    <span className="text-xs text-[#666]">/10</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingSatisfaction(true)}
                      className="h-5 w-5 p-0 hover:bg-transparent"
                    >
                      <Edit2 className="w-3 h-3 text-[#888] hover:text-[#c0c0c0]" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Missed Opportunities + Mistakes */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gradient-to-br from-orange-500/10 via-[#0d0d0d] to-orange-500/5 border border-orange-500/30 rounded-lg p-3">
                <div className="text-[10px] text-orange-400 uppercase tracking-wide mb-2">Missed Opportunity</div>
                <p className="text-xs text-[#c0c0c0]">
                  {(() => {
                    if (!trade.take_price) return 'No take profit set';
                    const takeDistance = Math.abs(trade.take_price - trade.entry_price);
                    const potentialUsd = (takeDistance / trade.entry_price) * trade.position_size;
                    const missed = potentialUsd - pnl;
                    if (missed > 0 && pnl > 0) {
                      return `Could've made +$${formatNumber(missed)} more if held to TP`;
                    }
                    return 'None - trade executed well';
                  })()}
                </p>
              </div>

              <div className="bg-gradient-to-br from-red-500/10 via-[#0d0d0d] to-red-500/5 border border-red-500/30 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] text-red-400 uppercase tracking-wide">Mistakes</div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingMistakes(!editingMistakes)}
                  className="h-5 px-2 text-[8px] text-red-400"
                >
                  <Edit2 className="w-2.5 h-2.5 mr-1" />
                  Edit
                </Button>
              </div>
              {editingMistakes && (
                <div className="flex gap-1 mb-2">
                  <Input
                    value={newMistake}
                    onChange={(e) => setNewMistake(e.target.value)}
                    placeholder="Add mistake..."
                    className="h-6 text-xs bg-[#0d0d0d] border-red-500/20 text-[#c0c0c0]"
                    onKeyPress={(e) => e.key === 'Enter' && addMistake()}
                  />
                  <Button 
                    size="sm" 
                    onClick={async () => {
                      if (newMistake.trim()) {
                        const updated = [...mistakes, { text: newMistake, auto: false }];
                        setMistakes(updated);
                        await onUpdate(trade.id, { violation_tags: JSON.stringify(updated) });
                        setNewMistake('');
                        toast.success('Mistake added');
                      }
                    }}
                    className="h-6 px-2 bg-red-500/20 hover:bg-red-500/30 text-red-400"
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              )}
              <div className="space-y-1">
                {mistakes.length > 0 ? mistakes.map((mistake, i) => (
                  <div key={i} className="flex items-center justify-between text-xs text-[#c0c0c0] bg-[#0d0d0d] rounded px-2 py-1">
                    <span>{mistake.text || mistake}</span>
                    {editingMistakes && (
                      <button 
                        onClick={async () => {
                          const updated = mistakes.filter((_, idx) => idx !== i);
                          setMistakes(updated);
                          await onUpdate(trade.id, { violation_tags: JSON.stringify(updated) });
                          toast.success('Mistake removed');
                        }}
                        className="text-red-400/70 hover:text-red-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )) : (
                  <p className="text-xs text-[#666]">No mistakes logged</p>
                )}
              </div>
              </div>
            </div>

            {/* Gambling Detect + Confidence */}
            <div className="grid grid-cols-2 gap-3">
              {(() => {
                const gamblingScore = 0;
                const bgGradient = gamblingScore === 0 ? "from-emerald-500/30 via-[#0d0d0d] to-emerald-500/20" : "from-red-500/30 via-[#0d0d0d] to-red-500/20";
                const borderColor = gamblingScore === 0 ? "border-emerald-500/60" : "border-red-500/60";
                const textColor = gamblingScore === 0 ? "text-emerald-300" : "text-red-300";
                
                return (
                  <div className={cn(
                    "bg-gradient-to-br rounded-lg py-3 px-3 relative overflow-hidden border-2",
                    bgGradient,
                    borderColor
                  )}>
                    <div className="relative z-10 flex items-center justify-between gap-3">
                      <div className="flex flex-col">
                        <span className={cn("text-2xl font-black leading-none mb-1", textColor)}>{gamblingScore}</span>
                        <div className={cn("text-[9px] uppercase tracking-wider font-bold whitespace-nowrap", textColor)}>
                          🎰 Gambling
                        </div>
                      </div>
                      <div className="text-[9px] text-[#888] leading-relaxed">
                        Risk OK
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="bg-gradient-to-br from-[#151515] to-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
                {editingConfidence ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] text-[#888] uppercase tracking-wide">Confidence</div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-bold text-[#c0c0c0]">{confidence}/10</div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await onUpdate(trade.id, { confidence_level: confidence });
                            setSavedConfidence(confidence);
                            setEditingConfidence(false);
                          }}
                          className="h-5 w-5 p-0 hover:bg-emerald-500/20"
                        >
                          <Check className="w-3 h-3 text-emerald-400" />
                        </Button>
                      </div>
                    </div>
                    <Slider
                      value={[confidence]}
                      onValueChange={([val]) => setConfidence(val)}
                      min={0}
                      max={10}
                      step={1}
                    />
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg font-bold text-[#c0c0c0]">{savedConfidence}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingConfidence(true)}
                        className="h-5 w-5 p-0 hover:bg-transparent"
                      >
                        <Edit2 className="w-3 h-3 text-[#888] hover:text-[#c0c0c0]" />
                      </Button>
                    </div>
                    <div className="h-1.5 bg-[#0d0d0d] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-amber-500 via-[#c0c0c0] to-emerald-500 transition-all"
                        style={{ width: `${(savedConfidence / 10) * 100}%` }}
                      />
                    </div>
                    <div className="text-center text-[9px] text-[#666] uppercase tracking-wide mt-1">Confidence</div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom layout: Strategy, Screenshot (left), Entry Reason (right) */}
            <div className="grid grid-cols-2 gap-3">
              {/* Left column */}
              <div className="space-y-3">
                <div className="bg-gradient-to-br from-[#151515] to-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-2.5">
                  <div className="text-[9px] text-[#666] uppercase tracking-wide mb-1.5 text-center">Strategy</div>
                  {isEditing ? (
                    <div className="space-y-1">
                      <Input
                        list="closed-strategy-templates"
                        value={editedTrade.strategy_tag || ''}
                        onChange={(e) => setEditedTrade(prev => ({ ...prev, strategy_tag: e.target.value }))}
                        className="h-7 text-xs bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
                      />
                      <datalist id="closed-strategy-templates">
                        {strategyTemplates.map((s, i) => (
                          <option key={i} value={s} />
                        ))}
                      </datalist>
                      {strategyTemplates.length > 0 && (
                        <div className="flex flex-wrap gap-1 justify-center">
                          {strategyTemplates.map((s, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setEditedTrade(prev => ({ ...prev, strategy_tag: s }))}
                              className="text-[8px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded hover:bg-blue-500/20"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-[#c0c0c0] text-center font-medium">
                      {trade.strategy_tag || <span className="text-[#555]">⋯</span>}
                    </div>
                  )}
                </div>

                <div className="bg-gradient-to-br from-[#151515] to-[#0d0d0d] border border-[#2a2a2a] rounded-lg overflow-hidden">
                  <div className="px-3 py-2 border-b border-[#2a2a2a]">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-3.5 h-3.5 text-[#888]" />
                      <span className="text-[9px] text-[#666] uppercase tracking-wide">Screenshot</span>
                    </div>
                  </div>
                  <div className="p-2">
                    {screenshotUrl ? (
                      <div 
                        onClick={() => setShowScreenshotModal(true)}
                        className="relative w-full h-24 bg-[#0d0d0d] rounded overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                      >
                        <img src={screenshotUrl} alt="Screenshot" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="h-24 flex items-center justify-center text-[10px] text-[#666]">No screenshot</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right column - Entry Reason */}
              <div className="bg-gradient-to-br from-[#151515] to-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-2.5">
                <div className="text-[9px] text-[#666] uppercase tracking-wide mb-1.5 text-center">Entry Reason</div>
                {isEditing ? (
                  <div className="space-y-1">
                    <Textarea
                      value={editedTrade.entry_reason || ''}
                      onChange={(e) => setEditedTrade(prev => ({ ...prev, entry_reason: e.target.value }))}
                      placeholder="Why did you enter?"
                      className="h-[80px] text-xs bg-[#0d0d0d] border-[#2a2a2a] resize-none text-[#c0c0c0]"
                    />
                    {entryReasonTemplates.length > 0 && (
                      <div className="flex flex-wrap gap-1 max-h-[48px] overflow-y-auto">
                        {entryReasonTemplates.map((reason, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setEditedTrade(prev => ({ ...prev, entry_reason: reason }))}
                            className="text-[8px] bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded hover:bg-green-500/20"
                          >
                            {reason}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-2 text-xs text-[#c0c0c0] whitespace-pre-wrap max-h-[130px] overflow-y-auto">
                    {trade.entry_reason || <span className="text-[#555]">⋯</span>}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom collapse button */}
            <Button
              onClick={() => setDetailsExpanded(false)}
              variant="outline"
              className="w-full mt-3 bg-[#151515] hover:bg-[#1a1a1a] border-[#2a2a2a] text-[#888] hover:text-[#c0c0c0]"
            >
              <ChevronUp className="w-4 h-4 mr-2" />
              Hide Details
            </Button>
            </div>
          )}
        </div>
      </div>

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

      {/* Share Modal - Enhanced */}
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
                onClick={copyShareImage} 
                className="flex-1 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow-lg shadow-violet-500/30"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy to Clipboard
              </Button>
              <Button 
                onClick={downloadShareImage} 
                className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-lg shadow-emerald-500/30"
              >
                <Download className="w-4 h-4 mr-2" />
                Download PNG
              </Button>
            </div>
            <p className="text-xs text-center text-[#666]">
              High quality image ready for social media
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}