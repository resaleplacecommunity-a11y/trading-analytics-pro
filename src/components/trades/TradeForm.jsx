import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { X, Calculator, Upload } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

export default function TradeForm({ trade, onSubmit, onClose }) {
  // Get current date/time in local format for input
  const getLocalDateTimeString = (dateStr) => {
    if (!dateStr) {
      // For new trades, use current local time
      const now = new Date();
      return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }
    // For existing trades, convert UTC to local for display
    const date = new Date(dateStr);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  const [formData, setFormData] = useState({
    date: getLocalDateTimeString(trade?.date_open || trade?.date),
    coin: '',
    direction: 'Long',
    entry_price: '',
    position_size: '',
    stop_price: '',
    take_price: '',
    close_price: '',
    rule_compliance: true,
    emotional_state: 5,
    confidence_level: trade ? (trade.confidence_level || 0) : 0,
    entry_reason: '',
    trade_analysis: '',
    strategy_tag: '',
    status: 'closed',
    ...trade,
    date: getLocalDateTimeString(trade?.date_open || trade?.date)
  });

  const [calculated, setCalculated] = useState({});
  const [uploading, setUploading] = useState(false);

  // Auto-calculate values
  useEffect(() => {
    const entry = parseFloat(formData.entry_price);
    const stop = parseFloat(formData.stop_price);
    const take = parseFloat(formData.take_price);
    const close = parseFloat(formData.close_price);
    const size = parseFloat(formData.position_size);
    const isLong = formData.direction === 'Long';

    if (!entry || !stop || !size) {
      // Reset calculated values if no entry/stop/size
      setCalculated({
        stop_percent: 0,
        stop_usd: 0,
        take_percent: 0,
        take_usd: 0,
        rr_ratio: 0,
        pnl_percent: 0,
        pnl_usd: 0,
        r_multiple: 0
      });
      return;
    }

    const stopPercent = isLong ? ((entry - stop) / entry) * 100 : ((stop - entry) / entry) * 100;
    const stopUsd = (stopPercent / 100) * size;
    
    let takePercent = 0, takeUsd = 0, rrRatio = 0;
    if (take) {
      takePercent = isLong ? ((take - entry) / entry) * 100 : ((entry - take) / entry) * 100;
      takeUsd = (takePercent / 100) * size;
      rrRatio = Math.abs(takePercent / stopPercent);
    }

    let pnlPercent = 0, pnlUsd = 0, rMultiple = 0;
    if (close) {
      pnlPercent = isLong ? ((close - entry) / entry) * 100 : ((entry - close) / entry) * 100;
      pnlUsd = (pnlPercent / 100) * size;
      rMultiple = stopPercent !== 0 ? (pnlPercent / stopPercent) : 0;
    }

    setCalculated({
      stop_percent: stopPercent,
      stop_usd: stopUsd,
      take_percent: takePercent,
      take_usd: takeUsd,
      rr_ratio: rrRatio,
      pnl_percent: pnlPercent,
      pnl_usd: pnlUsd,
      r_multiple: rMultiple
    });
  }, [formData.entry_price, formData.stop_price, formData.take_price, formData.close_price, formData.position_size, formData.direction]);

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

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData(prev => ({ ...prev, screenshot_url: file_url }));
    } catch (err) {
      console.error('Upload failed:', err);
    }
    setUploading(false);
  };

  const handleSubmit = () => {
    // Convert local datetime to UTC ISO string for storage
    const localDateTime = new Date(formData.date);
    const utcDateTime = localDateTime.toISOString();
    
    const finalData = {
      ...formData,
      date: utcDateTime,
      date_open: utcDateTime,
      date_close: formData.close_price ? utcDateTime : null,
      entry_price: parseFloat(formData.entry_price) || 0,
      position_size: parseFloat(formData.position_size) || 0,
      stop_price: formData.stop_price ? parseFloat(formData.stop_price) : null,
      take_price: formData.take_price ? parseFloat(formData.take_price) : null,
      close_price: formData.close_price ? parseFloat(formData.close_price) : null,
      stop_percent: calculated.stop_percent || 0,
      stop_usd: calculated.stop_usd || 0,
      take_percent: calculated.take_percent || 0,
      take_usd: calculated.take_usd || 0,
      rr_ratio: calculated.rr_ratio || 0,
      pnl_percent: calculated.pnl_percent || 0,
      pnl_usd: calculated.pnl_usd || 0,
      r_multiple: calculated.r_multiple || 0,
    };
    onSubmit(finalData);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a] sticky top-0 bg-[#1a1a1a]">
          <h2 className="text-[#c0c0c0] text-lg font-semibold">{trade ? 'Edit Trade' : 'New Trade'}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5 text-[#666]" />
          </Button>
        </div>
        
        <div className="p-4 space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-[#888]">Date & Time</Label>
              <Input 
                type="datetime-local" 
                value={formData.date?.slice(0, 16)} 
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]"
              />
            </div>
            <div>
              <Label className="text-[#888]">Coin</Label>
              <Input 
                placeholder="BTC, ETH, SOL..." 
                value={formData.coin}
                onChange={(e) => setFormData({...formData, coin: e.target.value.toUpperCase()})}
                className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-[#888]">Direction</Label>
              <Select value={formData.direction} onValueChange={(v) => setFormData({...formData, direction: v})}>
                <SelectTrigger className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
                  <SelectItem value="Long">Long</SelectItem>
                  <SelectItem value="Short">Short</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[#888]">Strategy Tag</Label>
              <Input 
                list="strategy-templates"
                placeholder="e.g., Breakout, Support Bounce" 
                value={formData.strategy_tag}
                onChange={(e) => setFormData({...formData, strategy_tag: e.target.value})}
                className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]"
              />
              <datalist id="strategy-templates">
                {strategyTemplates.map((s, i) => (
                  <option key={i} value={s} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-[#888]">Entry Price</Label>
              <Input 
                type="number" 
                step="any"
                value={formData.entry_price}
                onChange={(e) => setFormData({...formData, entry_price: e.target.value})}
                className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]"
              />
            </div>
            <div>
              <Label className="text-[#888]">Position Size $</Label>
              <Input 
                type="number" 
                value={formData.position_size}
                onChange={(e) => setFormData({...formData, position_size: e.target.value})}
                className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]"
              />
            </div>
            <div>
              <Label className="text-[#888]">Stop Price</Label>
              <Input 
                type="number" 
                step="any"
                value={formData.stop_price}
                onChange={(e) => setFormData({...formData, stop_price: e.target.value})}
                className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]"
              />
            </div>
            <div>
              <Label className="text-[#888]">Take Profit</Label>
              <Input 
                type="number" 
                step="any"
                value={formData.take_price}
                onChange={(e) => setFormData({...formData, take_price: e.target.value})}
                className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]"
              />
            </div>
          </div>

          <div>
            <Label className="text-[#888]">Close Price</Label>
            <Input 
              type="number" 
              step="any"
              value={formData.close_price}
              onChange={(e) => setFormData({...formData, close_price: e.target.value})}
              className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]"
            />
          </div>

          {/* Calculated Values */}
          {Object.keys(calculated).length > 0 && (
            <div className="bg-[#151515] rounded-xl p-4 border border-[#252525]">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="w-4 h-4 text-[#888]" />
                <span className="text-[#888] text-sm">Auto-calculated</span>
              </div>
              <div className="grid grid-cols-4 gap-3 text-xs">
                <div className="text-center">
                  <p className="text-[#666]">Stop %</p>
                  <p className="text-red-400 font-medium">{calculated.stop_percent?.toFixed(2)}%</p>
                </div>
                <div className="text-center">
                  <p className="text-[#666]">Stop $</p>
                  <p className="text-red-400 font-medium">${calculated.stop_usd?.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[#666]">Take %</p>
                  <p className="text-emerald-400 font-medium">{calculated.take_percent?.toFixed(2)}%</p>
                </div>
                <div className="text-center">
                  <p className="text-[#666]">R:R</p>
                  <p className="text-[#c0c0c0] font-medium">{calculated.rr_ratio?.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[#666]">PNL %</p>
                  <p className={(calculated.pnl_percent || 0) >= 0 ? "text-emerald-400 font-medium" : "text-red-400 font-medium"}>
                    {calculated.pnl_percent?.toFixed(2)}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[#666]">PNL $</p>
                  <p className={(calculated.pnl_usd || 0) >= 0 ? "text-emerald-400 font-medium" : "text-red-400 font-medium"}>
                    ${calculated.pnl_usd?.toFixed(2)}
                  </p>
                </div>
                <div className="text-center col-span-2">
                  <p className="text-[#666]">R Multiple</p>
                  <p className={(calculated.r_multiple || 0) >= 0 ? "text-emerald-400 font-medium text-lg" : "text-red-400 font-medium text-lg"}>
                    {calculated.r_multiple?.toFixed(2)}R
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Psychology */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-[#888]">Emotional State</Label>
                <span className="text-[#c0c0c0] text-sm">{formData.emotional_state}/10</span>
              </div>
              <Slider 
                value={[formData.emotional_state]} 
                onValueChange={([v]) => setFormData({...formData, emotional_state: v})}
                max={10} 
                min={1} 
                step={1}
                className="py-2"
              />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-[#888]">Confidence Level</Label>
                <span className="text-[#c0c0c0] text-sm">{formData.confidence_level}/10</span>
              </div>
              <Slider 
                value={[formData.confidence_level]} 
                onValueChange={([v]) => setFormData({...formData, confidence_level: v})}
                max={10} 
                min={1} 
                step={1}
                className="py-2"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-[#888]">Rule Compliance</Label>
              <Switch 
                checked={formData.rule_compliance}
                onCheckedChange={(v) => setFormData({...formData, rule_compliance: v})}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-[#888]">Entry Reason</Label>
            <Textarea 
              list="entry-reason-templates"
              placeholder="Why did you enter this trade?"
              value={formData.entry_reason}
              onChange={(e) => setFormData({...formData, entry_reason: e.target.value})}
              className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] h-20"
            />
            {entryReasonTemplates.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {entryReasonTemplates.map((reason, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setFormData({...formData, entry_reason: reason})}
                    className="text-[10px] bg-green-500/10 text-green-400 px-2 py-1 rounded hover:bg-green-500/20 transition-colors"
                  >
                    {reason}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label className="text-[#888]">Trade Analysis</Label>
            <Textarea 
              placeholder="What did you learn? What could be improved?"
              value={formData.trade_analysis}
              onChange={(e) => setFormData({...formData, trade_analysis: e.target.value})}
              className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] h-20"
            />
          </div>

          {/* Screenshot */}
          <div>
            <Label className="text-[#888]">Screenshot</Label>
            <div className="mt-2">
              {formData.screenshot_url ? (
                <div className="relative">
                  <img src={formData.screenshot_url} alt="Trade" className="rounded-lg max-h-48 object-contain" />
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="absolute top-2 right-2 bg-black/50"
                    onClick={() => setFormData({...formData, screenshot_url: ''})}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 p-4 border border-dashed border-[#2a2a2a] rounded-lg cursor-pointer hover:border-[#3a3a3a] transition-colors">
                  <Upload className="w-5 h-5 text-[#666]" />
                  <span className="text-[#666] text-sm">{uploading ? 'Uploading...' : 'Upload Screenshot'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                </label>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-[#2a2a2a] sticky bottom-0 bg-[#1a1a1a]">
          <Button variant="ghost" onClick={onClose} className="text-[#888]">Cancel</Button>
          <Button onClick={handleSubmit} className="bg-[#c0c0c0] text-black hover:bg-[#a0a0a0]">
            {trade ? 'Update Trade' : 'Save Trade'}
          </Button>
        </div>
      </div>
    </div>
  );
}