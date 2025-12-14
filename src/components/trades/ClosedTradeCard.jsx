import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Edit2, Trash2, Check, X, Zap, Image as ImageIcon, LinkIcon, Paperclip, TrendingUp, TrendingDown, Wallet, Package, AlertTriangle, Target, Plus, Trophy, ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from "@/lib/utils";
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  const [satisfaction, setSatisfaction] = useState(5);
  const [mistakes, setMistakes] = useState([]);
  const [newMistake, setNewMistake] = useState('');

  useEffect(() => {
    setEditedTrade(trade);
    setScreenshotUrl(trade.screenshot_url || '');
    // Parse mistakes from trade data or default
    try {
      const parsedMistakes = trade.mistakes ? JSON.parse(trade.mistakes) : [];
      setMistakes(parsedMistakes);
    } catch {
      setMistakes([]);
    }
    setSatisfaction(trade.satisfaction || 5);
  }, [trade]);

  const isLong = trade.direction === 'Long';
  const balance = trade.account_balance_at_entry || currentBalance || 100000;
  const pnl = trade.pnl_usd || 0;
  const pnlPercent = trade.pnl_percent_of_balance || 0;
  const rMultiple = trade.r_multiple || 0;

  // Calculate initial stop risk
  const originalEntry = trade.original_entry_price || trade.entry_price;
  const originalStop = trade.original_stop_price || trade.stop_price;
  const initialStopDistance = Math.abs(originalEntry - originalStop);
  const initialRiskUsd = (initialStopDistance / originalEntry) * trade.position_size;
  const initialRiskPercent = (initialRiskUsd / balance) * 100;

  // Calculate stop at close risk
  const closeStopDistance = Math.abs(trade.entry_price - trade.stop_price);
  const closeRiskUsd = (closeStopDistance / trade.entry_price) * trade.position_size;
  const closeRiskPercent = (closeRiskUsd / balance) * 100;

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
    const positionSize = parseFloat(editedTrade.position_size) || 0;
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
      mistakes: JSON.stringify(mistakes),
      original_stop_price: editedTrade.original_stop_price || trade.original_stop_price || editedTrade.stop_price,
    };

    await onUpdate(trade.id, updated);
    setIsEditing(false);
    toast.success('Trade updated');
  };

  const addMistake = () => {
    if (!newMistake.trim()) return;
    setMistakes(prev => [...prev, { text: newMistake, auto: false }]);
    setNewMistake('');
  };

  const removeMistake = (index) => {
    setMistakes(prev => prev.filter((_, i) => i !== index));
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
        <div className="absolute top-2 right-2 flex gap-1 z-10">
          {isEditing ? (
            <>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={handleSave}
                className="h-6 w-6 p-0 hover:bg-emerald-500/20 text-emerald-400"
              >
                <Check className="w-3 h-3" />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => { setEditedTrade(trade); setIsEditing(false); }}
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
                onClick={() => setIsEditing(true)}
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

        {/* Top section: Technical data */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {/* Entry price */}
          <div className="bg-gradient-to-br from-[#151515] to-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              {isLong ? <TrendingUp className="w-3 h-3 text-emerald-400/70" /> : <TrendingDown className="w-3 h-3 text-red-400/70" />}
              <span className="text-[9px] text-[#666] uppercase tracking-wide">Entry</span>
            </div>
            <div className="text-sm font-bold text-[#c0c0c0]">{formatPrice(trade.entry_price)}</div>
          </div>

          {/* Position size */}
          <div className="bg-gradient-to-br from-[#151515] to-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Package className="w-3 h-3 text-[#888]" />
              <span className="text-[9px] text-[#666] uppercase tracking-wide">Size</span>
            </div>
            {isEditing ? (
              <Input
                type="number"
                value={editedTrade.position_size}
                onChange={(e) => setEditedTrade(prev => ({ ...prev, position_size: e.target.value }))}
                className="h-7 text-sm font-bold bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
              />
            ) : (
              <div className="text-sm font-bold text-[#c0c0c0]">${formatNumber(trade.position_size)}</div>
            )}
          </div>

          {/* Balance at entry */}
          <div className="bg-gradient-to-br from-[#151515] to-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Wallet className="w-3 h-3 text-[#888]" />
              <span className="text-[9px] text-[#666] uppercase tracking-wide">Bal. Entry</span>
            </div>
            <div className="text-sm font-bold text-[#888]">${formatNumber(balance)}</div>
          </div>

          {/* Balance after */}
          <div className="bg-gradient-to-br from-[#151515] to-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Wallet className="w-3 h-3 text-[#888]" />
              <span className="text-[9px] text-[#666] uppercase tracking-wide">Bal. After</span>
            </div>
            <div className={cn(
              "text-sm font-bold",
              pnl >= 0 ? "text-emerald-400" : "text-red-400"
            )}>${formatNumber(balanceAfterClose)}</div>
          </div>

          {/* Initial Stop */}
          <div className="bg-gradient-to-br from-red-500/10 to-[#0d0d0d] border border-red-500/30 rounded-lg p-2.5">
            <div className="text-[9px] text-red-400/70 uppercase tracking-wide mb-1.5">Initial Stop</div>
            {isEditing ? (
              <Input
                type="number"
                step="any"
                value={editedTrade.original_stop_price || editedTrade.stop_price}
                onChange={(e) => setEditedTrade(prev => ({ ...prev, original_stop_price: e.target.value }))}
                className="h-7 text-xs font-bold bg-[#0d0d0d] border-red-500/20 text-red-400"
              />
            ) : (
              <>
                <div className="text-sm font-bold text-red-400">{formatPrice(originalStop)}</div>
                <div className="text-[8px] text-red-400/60 mt-0.5">${formatNumber(initialRiskUsd)} • {initialRiskPercent.toFixed(1)}%</div>
              </>
            )}
          </div>

          {/* Stop at close */}
          <div className="bg-gradient-to-br from-red-500/5 to-[#0d0d0d] border border-red-500/20 rounded-lg p-2.5">
            <div className="text-[9px] text-red-400/50 uppercase tracking-wide mb-1.5">Stop @ Close</div>
            <div className="text-sm font-bold text-red-400/80">{formatPrice(trade.stop_price)}</div>
            <div className="text-[8px] text-red-400/50 mt-0.5">${formatNumber(closeRiskUsd)} • {closeRiskPercent.toFixed(1)}%</div>
          </div>

          {/* Take */}
          <div className="bg-gradient-to-br from-emerald-500/10 to-[#0d0d0d] border border-emerald-500/30 rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Target className="w-3 h-3 text-emerald-400/70" />
              <span className="text-[9px] text-emerald-400/70 uppercase tracking-wide">Take</span>
            </div>
            <div className="text-sm font-bold text-emerald-400">{formatPrice(trade.take_price)}</div>
          </div>

          {/* Close price */}
          <div className="bg-gradient-to-br from-[#151515] to-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-2.5">
            <div className="text-[9px] text-[#666] uppercase tracking-wide mb-1.5">Close</div>
            {isEditing ? (
              <Input
                type="number"
                step="any"
                value={editedTrade.close_price}
                onChange={(e) => setEditedTrade(prev => ({ ...prev, close_price: e.target.value }))}
                className="h-7 text-sm font-bold bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
              />
            ) : (
              <div className="text-sm font-bold text-[#c0c0c0]">{formatPrice(trade.close_price)}</div>
            )}
          </div>
        </div>

        {/* Duration + Timeframe */}
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-gradient-to-br from-[#151515] to-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="text-[9px] text-[#666] uppercase">Duration:</span>
            <span className="text-xs font-bold text-amber-400">{formatDuration(trade.actual_duration_minutes)}</span>
          </div>
          {trade.timeframe && (
            <div className="bg-gradient-to-r from-purple-500/20 via-blue-500/20 to-cyan-500/20 border border-purple-500/30 rounded-lg px-3 py-2">
              <span className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-blue-300 to-cyan-300 uppercase tracking-wider">
                {trade.timeframe}
              </span>
            </div>
          )}
        </div>

        {/* MAIN ACCENT: PNL Section */}
        <div className={cn(
          "relative rounded-xl p-6 mb-4 overflow-hidden border-2",
          pnl >= 0 
            ? "bg-gradient-to-br from-emerald-500/20 via-[#0d0d0d] to-emerald-500/10 border-emerald-500/40 shadow-[0_0_35px_rgba(16,185,129,0.25)]"
            : "bg-gradient-to-br from-red-500/20 via-[#0d0d0d] to-red-500/10 border-red-500/40 shadow-[0_0_35px_rgba(239,68,68,0.25)]"
        )}>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />
          <div className="relative z-10 grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-xs text-[#888] mb-2 uppercase tracking-wide">PNL ($)</p>
              <p className={cn(
                "text-4xl font-black",
                pnl >= 0 ? "text-emerald-400" : "text-red-400"
              )}>
                {pnl >= 0 ? '+' : ''}${formatNumber(Math.abs(pnl))}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#888] mb-2 uppercase tracking-wide">PNL (%)</p>
              <p className={cn(
                "text-4xl font-black",
                pnlPercent >= 0 ? "text-emerald-400" : "text-red-400"
              )}>
                {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-[#888] mb-2 uppercase tracking-wide">R Multiple</p>
              <p className={cn(
                "text-4xl font-black",
                rMultiple >= 0 ? "text-emerald-400" : "text-red-400"
              )}>
                {rMultiple >= 0 ? '+' : ''}{rMultiple.toFixed(1)}R
              </p>
            </div>
          </div>
        </div>

        {/* Context Section */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Strategy & Confidence */}
          <div className="space-y-2">
            <div className="bg-gradient-to-br from-[#151515] to-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-2.5">
              <div className="text-[9px] text-[#666] uppercase tracking-wide mb-1.5 text-center">Strategy</div>
              {isEditing ? (
                <Input
                  value={editedTrade.strategy_tag || ''}
                  onChange={(e) => setEditedTrade(prev => ({ ...prev, strategy_tag: e.target.value }))}
                  className="h-7 text-xs bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
                />
              ) : (
                <div className="text-xs text-[#c0c0c0] text-center font-medium">
                  {trade.strategy_tag || <span className="text-[#555]">⋯</span>}
                </div>
              )}
            </div>

            <div className="bg-gradient-to-br from-[#151515] to-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
              <div className="flex items-center justify-center mb-2">
                <span className="text-lg font-bold text-[#c0c0c0]">{trade.confidence_level || 0}</span>
              </div>
              <div className="h-1.5 bg-[#0d0d0d] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 via-[#c0c0c0] to-emerald-500 transition-all"
                  style={{ width: `${((trade.confidence_level || 0) / 10) * 100}%` }}
                />
              </div>
              <div className="text-center text-[9px] text-[#666] uppercase tracking-wide mt-1">Confidence</div>
            </div>
          </div>

          {/* Entry Reason */}
          <div className="bg-gradient-to-br from-[#151515] to-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-2.5">
            <div className="text-[9px] text-[#666] uppercase tracking-wide mb-1.5 text-center">Entry Reason</div>
            <div className="h-[100px] p-2 text-xs text-[#c0c0c0] whitespace-pre-wrap overflow-y-auto flex items-center justify-center">
              {trade.entry_reason || <span className="text-[#555] text-2xl">⋯</span>}
            </div>
          </div>
        </div>

        {/* Screenshot + Gambling Detect */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Screenshot */}
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

          {/* Gambling Detect */}
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
        </div>

        {/* Analytics Section */}
        <div className="space-y-3">
          {/* Trade Analytics (Manual) */}
          <div className="bg-gradient-to-br from-[#151515] to-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
            <div className="text-[10px] text-[#888] uppercase tracking-wide mb-2">Trade Analytics (Manual)</div>
            {isEditing ? (
              <Textarea
                value={editedTrade.trade_analysis || ''}
                onChange={(e) => setEditedTrade(prev => ({ ...prev, trade_analysis: e.target.value }))}
                placeholder="What did you learn?"
                className="bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0] text-xs min-h-[60px]"
              />
            ) : (
              <div className="text-xs text-[#c0c0c0] whitespace-pre-wrap">
                {trade.trade_analysis || <span className="text-[#555]">⋯</span>}
              </div>
            )}
          </div>

          {/* Satisfaction Scale */}
          <div className="bg-gradient-to-br from-[#151515] to-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] text-[#888] uppercase tracking-wide">Satisfaction</div>
              <div className="flex items-center gap-1">
                <span className="text-lg font-bold text-[#c0c0c0]">{satisfaction}</span>
                <span className="text-xs text-[#666]">/10</span>
              </div>
            </div>
            {isEditing ? (
              <Slider
                value={[satisfaction]}
                onValueChange={([val]) => setSatisfaction(val)}
                min={0}
                max={10}
                step={1}
                className="mb-2"
              />
            ) : (
              <div className="h-2 bg-[#0d0d0d] rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all",
                    satisfaction >= 7 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" :
                    satisfaction >= 4 ? "bg-gradient-to-r from-amber-500 to-amber-400" :
                    "bg-gradient-to-r from-red-500 to-red-400"
                  )}
                  style={{ width: `${(satisfaction / 10) * 100}%` }}
                />
              </div>
            )}
          </div>

          {/* AI Trade Analysis */}
          <div className="bg-gradient-to-br from-yellow-500/10 via-[#0d0d0d] to-amber-500/10 border border-yellow-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-[10px] text-yellow-400 uppercase tracking-wide font-semibold">AI Analysis</span>
              {trade.ai_score && (
                <span className={cn(
                  "ml-auto text-sm font-bold",
                  trade.ai_score >= 7 ? "text-emerald-400" : trade.ai_score >= 5 ? "text-yellow-400" : "text-red-400"
                )}>
                  {trade.ai_score}/10
                </span>
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
              <p className="text-xs text-[#666]">No AI analysis</p>
            )}
          </div>

          {/* Missed Opportunity */}
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

          {/* Mistakes */}
          <div className="bg-gradient-to-br from-red-500/10 via-[#0d0d0d] to-red-500/5 border border-red-500/30 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] text-red-400 uppercase tracking-wide">Mistakes</div>
              {isEditing && (
                <div className="flex gap-1">
                  <Input
                    value={newMistake}
                    onChange={(e) => setNewMistake(e.target.value)}
                    placeholder="Add mistake..."
                    className="h-6 text-xs bg-[#0d0d0d] border-red-500/20 text-[#c0c0c0]"
                    onKeyPress={(e) => e.key === 'Enter' && addMistake()}
                  />
                  <Button size="sm" onClick={addMistake} className="h-6 px-2 bg-red-500/20 hover:bg-red-500/30 text-red-400">
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-1">
              {mistakes.length > 0 ? mistakes.map((mistake, i) => (
                <div key={i} className="flex items-center justify-between text-xs text-[#c0c0c0] bg-[#0d0d0d] rounded px-2 py-1">
                  <span>{mistake.text || mistake}</span>
                  {isEditing && (
                    <button onClick={() => removeMistake(i)} className="text-red-400/70 hover:text-red-400">
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
    </div>
  );
}