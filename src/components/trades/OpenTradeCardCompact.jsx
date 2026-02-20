import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { TrendingUp, AlertTriangle, Plus, Percent, Edit2, Check, X, TrendingDown, Wallet, Package, Image, Link as LinkIcon, Paperclip, Trash2, Beaker } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

export default function OpenTradeCardCompact({ trade, onUpdate, currentBalance }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTrade, setEditedTrade] = useState(trade);
  const [showScreenshot, setShowScreenshot] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState(trade.screenshot_url || '');
  const [screenshotInput, setScreenshotInput] = useState('');
  const [showScreenshotModal, setShowScreenshotModal] = useState(false);

  const isLong = trade.direction === 'Long';
  const entryPrice = parseFloat(editedTrade.entry_price) || 0;
  const stopPrice = parseFloat(editedTrade.stop_price) || 0;
  const takePrice = parseFloat(editedTrade.take_price) || 0;
  const positionSize = parseFloat(editedTrade.position_size) || 0;
  const balance = parseFloat(editedTrade.account_balance_at_entry || currentBalance) || 0;

  const riskUsd = stopPrice && stopPrice > 0 
    ? Math.abs(entryPrice - stopPrice) / entryPrice * positionSize 
    : null;
  const riskPercent = riskUsd ? (riskUsd / balance) * 100 : null;

  const currentPnl = isLong 
    ? ((trade.close_price || entryPrice) - entryPrice) / entryPrice * positionSize
    : (entryPrice - (trade.close_price || entryPrice)) / entryPrice * positionSize;
  
  const realizedPnl = trade.realized_pnl_usd || 0;
  const totalPnl = realizedPnl + currentPnl;

  useEffect(() => {
    setEditedTrade(trade);
    setScreenshotUrl(trade.screenshot_url || '');
  }, [trade]);

  const handleSave = async () => {
    await onUpdate(trade.id, editedTrade);
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
      <div className="p-3 grid grid-cols-4 gap-2">
        {/* Entry */}
        <div className="bg-[#151515] rounded p-2">
          <div className="text-[9px] text-[#666] uppercase mb-1">Entry</div>
          <div className="text-sm font-bold text-[#c0c0c0]">{formatPrice(entryPrice)}</div>
        </div>

        {/* Stop */}
        <div className="bg-[#151515] rounded p-2">
          <div className="text-[9px] text-red-400/70 uppercase mb-1">Stop</div>
          <div className="text-sm font-bold text-red-400">{formatPrice(stopPrice)}</div>
        </div>

        {/* Take */}
        <div className="bg-[#151515] rounded p-2">
          <div className="text-[9px] text-emerald-400/70 uppercase mb-1">Take</div>
          <div className="text-sm font-bold text-emerald-400">{formatPrice(takePrice)}</div>
        </div>

        {/* PNL */}
        <div className="bg-[#151515] rounded p-2">
          <div className="text-[9px] text-[#666] uppercase mb-1">PNL</div>
          <div className={cn(
            "text-sm font-bold",
            totalPnl >= 0 ? "text-emerald-400" : "text-red-400"
          )}>
            {totalPnl >= 0 ? '+' : ''}{formatNumber(totalPnl)}
          </div>
        </div>

        {/* Size */}
        <div className="bg-[#151515] rounded p-2">
          <div className="text-[9px] text-[#666] uppercase mb-1">Size</div>
          <div className="text-sm font-bold text-[#c0c0c0]">${formatNumber(positionSize)}</div>
        </div>

        {/* Risk */}
        <div className="bg-[#151515] rounded p-2">
          <div className="text-[9px] text-[#666] uppercase mb-1">Risk</div>
          <div className="text-sm font-bold text-[#c0c0c0]">
            {riskPercent ? `${riskPercent.toFixed(1)}%` : '—'}
          </div>
        </div>

        {/* Emotion */}
        <div className="bg-[#151515] rounded p-2">
          <div className="text-[9px] text-[#666] uppercase mb-1">Emotion</div>
          <div className="text-sm font-bold text-amber-400">{trade.emotional_state || 5}/10</div>
        </div>

        {/* AI Score - with Coming Soon indicator */}
        <div className="bg-[#151515] rounded p-2 relative">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 mb-1 cursor-help">
                  <div className="text-[9px] text-[#666] uppercase">AI</div>
                  <Beaker className="w-3 h-3 text-amber-400" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Coming soon</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="text-sm font-bold text-[#555]">—</div>
        </div>
      </div>

      {/* Gambling Detect - with Soon overlay */}
      <div className="px-3 pb-3">
        <div className="relative bg-[#151515] border border-[#2a2a2a] rounded p-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#888] uppercase tracking-wide font-semibold">Gambling Detect</span>
            <span className="text-emerald-400 text-lg font-bold">0</span>
          </div>
          <div className="h-2 bg-[#0d0d0d] rounded-full mt-1">
            <div className="h-full bg-emerald-500" style={{ width: '0%' }} />
          </div>
          {/* Soon curtain */}
          <div className="absolute inset-0 rounded bg-black/70 backdrop-blur-[2px] flex items-center justify-center">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40">
              <Beaker className="w-3 h-3 text-amber-400" />
              <span className="text-amber-400 text-xs font-medium">Soon</span>
            </div>
          </div>
        </div>
      </div>

      {/* Screenshot Section - Compact */}
      <div className="px-3 pb-3">
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
                  onClick={() => document.getElementById(`screenshot-upload-${trade.id}`).click()}
                  className="h-5 px-1.5 bg-[#2a2a2a] hover:bg-[#333] text-[9px]"
                >
                  <Paperclip className="w-2.5 h-2.5" />
                </Button>
                <input 
                  id={`screenshot-upload-${trade.id}`}
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