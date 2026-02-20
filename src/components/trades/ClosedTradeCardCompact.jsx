import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Edit2, Check, X, TrendingUp, TrendingDown, Package, AlertTriangle, Target, Clock, Timer, Beaker, Trash2, Image, Link as LinkIcon, Paperclip } from 'lucide-react';
import { cn } from "@/lib/utils";
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";

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
  return Math.round(n).toLocaleString('en-US');
};

export default function ClosedTradeCardCompact({ trade, onUpdate, currentBalance }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTrade, setEditedTrade] = useState(trade);
  const [showScreenshotModal, setShowScreenshotModal] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState(trade.screenshot_url || '');
  const [screenshotInput, setScreenshotInput] = useState('');
  const [showScreenshot, setShowScreenshot] = useState(false);
  const [editingAnalytics, setEditingAnalytics] = useState(false);

  const isLong = trade.direction === 'Long';
  const entryPrice = parseFloat(editedTrade.entry_price) || 0;
  const closePrice = parseFloat(editedTrade.close_price) || 0;
  const positionSize = parseFloat(editedTrade.position_size) || 0;
  const balance = parseFloat(editedTrade.account_balance_at_entry || currentBalance) || 0;
  
  const pnl = parseFloat(trade.pnl_usd) || 0;
  const pnlPercent = parseFloat(trade.pnl_percent_of_balance) || 0;
  const rMultiple = parseFloat(trade.r_multiple) || 0;

  useEffect(() => {
    setEditedTrade(trade);
    setScreenshotUrl(trade.screenshot_url || '');
  }, [trade]);

  const handleSave = async () => {
    const closePrice = parseFloat(editedTrade.close_price);
    
    if (!closePrice || closePrice <= 0) {
      await onUpdate(trade.id, {
        ...editedTrade,
        close_price: null,
        date_close: null,
        pnl_usd: 0,
        pnl_percent_of_balance: 0,
        r_multiple: 0
      });
      setIsEditing(false);
      toast.success('Trade reopened');
      return;
    }

    const pnlUsd = isLong 
      ? ((closePrice - entryPrice) / entryPrice) * positionSize
      : ((entryPrice - closePrice) / entryPrice) * positionSize;

    const pnlPercent = (pnlUsd / balance) * 100;
    const maxRiskUsd = trade.max_risk_usd || trade.original_risk_usd || 0;
    const rMultiple = maxRiskUsd > 0 ? pnlUsd / maxRiskUsd : 0;

    await onUpdate(trade.id, {
      ...editedTrade,
      close_price: closePrice,
      position_size: positionSize,
      pnl_usd: pnlUsd,
      pnl_percent_of_balance: pnlPercent,
      r_multiple: rMultiple
    });
    setIsEditing(false);
    toast.success('Trade updated');
  };

  const handleScreenshotUpload = async (file) => {
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setScreenshotUrl(file_url);
    await onUpdate(trade.id, { screenshot_url: file_url });
    toast.success('Screenshot uploaded');
  };

  const handleScreenshotUrl = async () => {
    if (!screenshotInput) return;
    setScreenshotUrl(screenshotInput);
    await onUpdate(trade.id, { screenshot_url: screenshotInput });
    setScreenshotInput('');
    toast.success('Screenshot added');
  };

  return (
    <div className="bg-[#111] border border-[#2a2a2a] rounded-lg overflow-hidden relative">
      {/* Header - Compact */}
      <div className="p-3 flex items-center justify-between border-b border-[#2a2a2a]">
        <div className="flex items-center gap-2">
          <div className={cn(
            "px-2 py-0.5 rounded text-xs font-bold",
            isLong ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
          )}>
            {trade.coin} {trade.direction}
          </div>
          {trade.timeframe && (
            <div className="px-2 py-0.5 rounded text-xs bg-[#1a1a1a] text-[#888] border border-[#2a2a2a]">
              {trade.timeframe}
            </div>
          )}
          <div className={cn(
            "px-2 py-0.5 rounded text-xs font-bold",
            pnl >= 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
          )}>
            {pnl >= 0 ? '+' : ''}{formatNumber(pnl)}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isEditing ? (
            <>
              <Button size="sm" variant="ghost" onClick={handleSave} className="h-6 w-6 p-0">
                <Check className="w-3 h-3 text-emerald-400" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditedTrade(trade); setIsEditing(false); }} className="h-6 w-6 p-0">
                <X className="w-3 h-3 text-[#888]" />
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)} className="h-6 w-6 p-0">
              <Edit2 className="w-3 h-3 text-[#888]" />
            </Button>
          )}
        </div>
      </div>

      {/* Main Content - Compact Grid */}
      <div className="p-3 space-y-2">
        {/* First Row - Prices & Core Metrics */}
        <div className="grid grid-cols-6 gap-2">
          <div className="bg-[#151515] rounded p-2">
            <div className="text-[9px] text-[#666] uppercase mb-1">Entry</div>
            <div className="text-sm font-bold text-[#c0c0c0]">{formatPrice(entryPrice)}</div>
          </div>
          <div className="bg-[#151515] rounded p-2">
            <div className="text-[9px] text-[#666] uppercase mb-1">Close</div>
            <div className="text-sm font-bold text-[#c0c0c0]">{formatPrice(closePrice)}</div>
          </div>
          <div className="bg-[#151515] rounded p-2">
            <div className="text-[9px] text-[#666] uppercase mb-1">Size</div>
            <div className="text-sm font-bold text-[#c0c0c0]">${formatNumber(positionSize)}</div>
          </div>
          <div className="bg-[#151515] rounded p-2">
            <div className="text-[9px] text-[#666] uppercase mb-1">R Multiple</div>
            <div className={cn(
              "text-sm font-bold",
              rMultiple >= 0 ? "text-emerald-400" : "text-red-400"
            )}>
              {rMultiple >= 0 ? '+' : ''}{rMultiple.toFixed(1)}R
            </div>
          </div>
          <div className="bg-[#151515] rounded p-2">
            <div className="text-[9px] text-[#666] uppercase mb-1">Balance</div>
            <div className="text-sm font-bold text-[#c0c0c0]">${formatNumber(balance)}</div>
          </div>
          <div className="bg-[#151515] rounded p-2">
            <div className="text-[9px] text-[#666] uppercase mb-1">Duration</div>
            <div className="text-sm font-bold text-[#c0c0c0]">
              {trade.actual_duration_minutes ? `${Math.round(trade.actual_duration_minutes / 60)}h` : '—'}
            </div>
          </div>
        </div>

        {/* Analytics Section */}
        <div className="bg-[#151515] border border-[#2a2a2a] rounded p-2">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[10px] text-[#888] uppercase tracking-wide">Trade Analytics</div>
            {!editingAnalytics && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingAnalytics(true)}
                className="h-4 px-1.5 text-[8px] text-[#888] hover:text-[#c0c0c0]"
              >
                <Edit2 className="w-2.5 h-2.5 mr-0.5" />
                Edit
              </Button>
            )}
          </div>
          {editingAnalytics ? (
            <div className="space-y-1.5">
              <Textarea
                value={editedTrade.trade_analysis || ''}
                onChange={(e) => setEditedTrade(prev => ({ ...prev, trade_analysis: e.target.value }))}
                placeholder="What did you learn?"
                className="bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0] text-xs min-h-[50px]"
              />
              <div className="flex gap-1.5 justify-end">
                <Button size="sm" variant="ghost" onClick={() => setEditingAnalytics(false)} className="h-5 text-xs">
                  Cancel
                </Button>
                <Button 
                  size="sm" 
                  onClick={async () => {
                    await onUpdate(trade.id, { trade_analysis: editedTrade.trade_analysis });
                    setEditingAnalytics(false);
                    toast.success('Saved');
                  }}
                  className="h-5 text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400"
                >
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-xs text-[#c0c0c0] whitespace-pre-wrap min-h-[30px]">
              {trade.trade_analysis || <span className="text-[#555]">Click Edit to add analysis...</span>}
            </div>
          )}
        </div>

        {/* AI Analytics - with Soon overlay */}
        <div className="relative bg-[#151515] border border-amber-500/30 rounded p-2">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] text-amber-400 uppercase tracking-wide font-semibold">AI Analysis</span>
          </div>
          <div className="text-xs text-[#666] mb-1">Quality: —/10</div>
          <div className="text-[10px] text-[#555]">Strengths, risks, and tips...</div>
          {/* Soon curtain */}
          <div className="absolute inset-0 rounded bg-black/70 backdrop-blur-[2px] flex items-center justify-center">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40">
              <Beaker className="w-3 h-3 text-amber-400" />
              <span className="text-amber-400 text-xs font-medium">Soon</span>
            </div>
          </div>
        </div>

        {/* Screenshot Section - Compact */}
        <div className="bg-[#151515] border border-[#2a2a2a] rounded overflow-hidden">
          <button 
            onClick={() => setShowScreenshot(!showScreenshot)}
            className="w-full px-2 py-1.5 flex items-center justify-between hover:bg-[#1a1a1a] transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <Image className="w-3 h-3 text-[#888]" />
              <span className="text-[9px] text-[#666] uppercase">Screenshot</span>
            </div>
            <span className="text-xs text-[#666]">{showScreenshot ? '−' : '+'}</span>
          </button>
          {showScreenshot && (
            <div className="px-2 pb-2 space-y-1.5">
              {screenshotUrl ? (
                <div className="relative">
                  <div 
                    onClick={() => setShowScreenshotModal(true)}
                    className="relative w-full h-20 bg-[#0d0d0d] rounded overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <img src={screenshotUrl} alt="Screenshot" className="w-full h-full object-cover" />
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async (e) => {
                      e.stopPropagation();
                      setScreenshotUrl('');
                      await onUpdate(trade.id, { screenshot_url: null });
                      toast.success('Screenshot removed');
                    }}
                    className="absolute top-1 right-1 h-5 w-5 p-0 bg-black/60 hover:bg-red-500/80"
                  >
                    <Trash2 className="w-3 h-3 text-white" />
                  </Button>
                </div>
              ) : (
                <div className="text-[9px] text-[#666] text-center py-1.5">No screenshot</div>
              )}
              <div className="flex gap-1">
                <Input
                  type="text"
                  placeholder="Paste URL..."
                  value={screenshotInput}
                  onChange={(e) => setScreenshotInput(e.target.value)}
                  className="h-5 text-[9px] bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0] flex-1"
                />
                <Button 
                  size="sm" 
                  onClick={handleScreenshotUrl}
                  className="h-5 px-1.5 bg-[#2a2a2a] hover:bg-[#333] text-[9px]"
                >
                  <LinkIcon className="w-2.5 h-2.5" />
                </Button>
                <Button 
                  size="sm" 
                  onClick={() => document.getElementById(`screenshot-upload-closed-${trade.id}`).click()}
                  className="h-5 px-1.5 bg-[#2a2a2a] hover:bg-[#333] text-[9px]"
                >
                  <Paperclip className="w-2.5 h-2.5" />
                </Button>
                <input 
                  id={`screenshot-upload-closed-${trade.id}`}
                  type="file" 
                  accept="image/*" 
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleScreenshotUpload(e.target.files[0])}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Screenshot Modal */}
      <Dialog open={showScreenshotModal} onOpenChange={setShowScreenshotModal}>
        <DialogContent className="max-w-4xl">
          <img src={screenshotUrl} alt="Trade Screenshot" className="w-full h-auto" />
        </DialogContent>
      </Dialog>
    </div>
  );
}