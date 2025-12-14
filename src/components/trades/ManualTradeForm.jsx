import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, Timer, Hourglass, Paperclip, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const formatNumberWithSpaces = (num) => {
  if (num === undefined || num === null || num === '') return '—';
  const n = parseFloat(num);
  if (isNaN(n)) return '—';
  return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
};

export default function ManualTradeForm({ isOpen, onClose, onSubmit, currentBalance }) {
  const [formData, setFormData] = useState({
    date_open: new Date().toISOString(),
    coin: '',
    direction: 'Long',
    entry_price: '',
    position_size: '',
    stop_price: '',
    take_price: '',
    confidence_level: 5,
    strategy_tag: '',
    timeframe: '',
    market_context: '',
    entry_reason: '',
    screenshot_url: '',
    close_price: '',
    account_balance_at_entry: currentBalance || 100000
  });

  const [calculations, setCalculations] = useState({
    riskUsd: 0,
    riskPercent: 0,
    potentialUsd: 0,
    potentialPercent: 0,
    rrRatio: 0
  });

  useEffect(() => {
    if (currentBalance) {
      setFormData(prev => ({ ...prev, account_balance_at_entry: currentBalance }));
    }
  }, [currentBalance]);

  useEffect(() => {
    const entry = parseFloat(formData.entry_price) || 0;
    const stop = parseFloat(formData.stop_price) || 0;
    const take = parseFloat(formData.take_price) || 0;
    const size = parseFloat(formData.position_size) || 0;
    const balance = formData.account_balance_at_entry || 100000;

    if (entry && stop && size) {
      const stopDistance = Math.abs(entry - stop);
      const riskUsd = (stopDistance / entry) * size;
      const riskPercent = (riskUsd / balance) * 100;

      let potentialUsd = 0;
      let potentialPercent = 0;
      let rrRatio = 0;

      if (take) {
        const takeDistance = Math.abs(take - entry);
        potentialUsd = (takeDistance / entry) * size;
        potentialPercent = (potentialUsd / balance) * 100;
        rrRatio = riskUsd > 0 ? potentialUsd / riskUsd : 0;
      }

      setCalculations({
        riskUsd,
        riskPercent,
        potentialUsd,
        potentialPercent,
        rrRatio
      });
    } else {
      setCalculations({
        riskUsd: 0,
        riskPercent: 0,
        potentialUsd: 0,
        potentialPercent: 0,
        rrRatio: 0
      });
    }
  }, [formData.entry_price, formData.stop_price, formData.take_price, formData.position_size, formData.account_balance_at_entry]);

  const handleSubmit = () => {
    if (!formData.coin || !formData.entry_price || !formData.position_size) {
      toast.error('Please fill in required fields');
      return;
    }

    const tradeData = {
      ...formData,
      entry_price: parseFloat(formData.entry_price),
      position_size: parseFloat(formData.position_size),
      stop_price: parseFloat(formData.stop_price) || null,
      take_price: parseFloat(formData.take_price) || null,
      close_price: parseFloat(formData.close_price) || null,
      risk_usd: calculations.riskUsd,
      risk_percent: calculations.riskPercent,
      rr_ratio: calculations.rrRatio,
      original_risk_usd: calculations.riskUsd,
      original_entry_price: parseFloat(formData.entry_price),
      original_stop_price: parseFloat(formData.stop_price) || null
    };

    onSubmit(tradeData);
  };

  const handleFileUpload = async (file) => {
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData(prev => ({ ...prev, screenshot_url: file_url }));
      toast.success('Screenshot uploaded');
    } catch (error) {
      toast.error('Failed to upload screenshot');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-[#2a2a2a]">
        <DialogHeader>
          <DialogTitle className="text-[#c0c0c0] text-xl">Add Trade Manually</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Required Fields */}
          <div className="space-y-4 p-4 bg-[#111] rounded-lg border border-[#2a2a2a]">
            <h3 className="text-sm font-semibold text-[#c0c0c0] uppercase tracking-wide">Required Fields</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-[#888]">Date & Time</Label>
                <Input
                  type="datetime-local"
                  value={formData.date_open.slice(0, 16)}
                  onChange={(e) => setFormData(prev => ({ ...prev, date_open: new Date(e.target.value).toISOString() }))}
                  className="bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
                />
              </div>

              <div>
                <Label className="text-xs text-[#888]">Coin</Label>
                <Input
                  value={formData.coin}
                  onChange={(e) => setFormData(prev => ({ ...prev, coin: e.target.value.toUpperCase() }))}
                  placeholder="BTC, ETH, SOL..."
                  className="bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
                />
              </div>

              <div>
                <Label className="text-xs text-[#888]">Direction</Label>
                <Select value={formData.direction} onValueChange={(val) => setFormData(prev => ({ ...prev, direction: val }))}>
                  <SelectTrigger className="bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Long">Long</SelectItem>
                    <SelectItem value="Short">Short</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-[#888]">Entry Price</Label>
                <Input
                  type="number"
                  step="any"
                  value={formData.entry_price}
                  onChange={(e) => setFormData(prev => ({ ...prev, entry_price: e.target.value }))}
                  placeholder="0.00"
                  className="bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
                />
              </div>

              <div>
                <Label className="text-xs text-[#888]">Position Size (USD)</Label>
                <Input
                  type="number"
                  value={formData.position_size}
                  onChange={(e) => setFormData(prev => ({ ...prev, position_size: e.target.value }))}
                  placeholder="0"
                  className="bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
                />
              </div>

              <div>
                <Label className="text-xs text-[#888]">Stop Loss</Label>
                <Input
                  type="number"
                  step="any"
                  value={formData.stop_price}
                  onChange={(e) => setFormData(prev => ({ ...prev, stop_price: e.target.value }))}
                  placeholder="0.00"
                  className="bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
                />
              </div>

              <div>
                <Label className="text-xs text-[#888]">Take Profit</Label>
                <Input
                  type="number"
                  step="any"
                  value={formData.take_price}
                  onChange={(e) => setFormData(prev => ({ ...prev, take_price: e.target.value }))}
                  placeholder="0.00"
                  className="bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
                />
              </div>
            </div>
          </div>

          {/* Auto Calculator */}
          {(calculations.riskUsd > 0 || calculations.potentialUsd > 0) && (
            <div className="p-4 bg-gradient-to-br from-[#1a1a1a] to-[#111] rounded-lg border border-[#333]">
              <h3 className="text-sm font-semibold text-[#c0c0c0] uppercase tracking-wide mb-3">Auto Calculator</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-[#666] mb-1">Risk</p>
                  <p className="text-lg font-bold text-red-400">${formatNumberWithSpaces(calculations.riskUsd)}</p>
                  <p className="text-xs text-red-400/70">{calculations.riskPercent.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-xs text-[#666] mb-1">Potential Profit</p>
                  <p className="text-lg font-bold text-emerald-400">${formatNumberWithSpaces(calculations.potentialUsd)}</p>
                  <p className="text-xs text-emerald-400/70">{calculations.potentialPercent.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-xs text-[#666] mb-1">Risk/Reward</p>
                  <p className={cn(
                    "text-lg font-bold",
                    calculations.rrRatio >= 2 ? "text-emerald-400" : "text-red-400"
                  )}>
                    1:{Math.round(calculations.rrRatio)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Additional Fields */}
          <div className="space-y-4 p-4 bg-[#111] rounded-lg border border-[#2a2a2a]">
            <h3 className="text-sm font-semibold text-[#c0c0c0] uppercase tracking-wide">Additional Details</h3>
            
            <div>
              <Label className="text-xs text-[#888] mb-2 block">Confidence Level: {formData.confidence_level}</Label>
              <Slider
                value={[formData.confidence_level]}
                onValueChange={([val]) => setFormData(prev => ({ ...prev, confidence_level: val }))}
                min={0}
                max={10}
                step={1}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-[#888]">Strategy</Label>
                <Input
                  value={formData.strategy_tag}
                  onChange={(e) => setFormData(prev => ({ ...prev, strategy_tag: e.target.value }))}
                  placeholder="Strategy name..."
                  className="bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
                />
              </div>

              <div>
                <Label className="text-xs text-[#888]">Timeframe</Label>
                <Select value={formData.timeframe} onValueChange={(val) => setFormData(prev => ({ ...prev, timeframe: val }))}>
                  <SelectTrigger className="bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scalp">Scalp</SelectItem>
                    <SelectItem value="day">Day</SelectItem>
                    <SelectItem value="swing">Swing</SelectItem>
                    <SelectItem value="mid_term">Mid-term</SelectItem>
                    <SelectItem value="long_term">Long-term</SelectItem>
                    <SelectItem value="spot">Spot</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs text-[#888] mb-2 block">Market Context</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, market_context: 'Bullish' }))}
                  className={cn(
                    "flex-1",
                    formData.market_context === 'Bullish' 
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
                      : "bg-[#0d0d0d] border-[#2a2a2a] text-[#666]"
                  )}
                >
                  Bullish
                </Button>
                <Button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, market_context: 'Bearish' }))}
                  className={cn(
                    "flex-1",
                    formData.market_context === 'Bearish' 
                      ? "bg-red-500/20 text-red-400 border-red-500/30" 
                      : "bg-[#0d0d0d] border-[#2a2a2a] text-[#666]"
                  )}
                >
                  Bearish
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-xs text-[#888]">Entry Reason</Label>
              <Textarea
                value={formData.entry_reason}
                onChange={(e) => setFormData(prev => ({ ...prev, entry_reason: e.target.value }))}
                placeholder="Why did you enter this trade?"
                className="bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0] h-20"
              />
            </div>

            <div>
              <Label className="text-xs text-[#888] block mb-2">Screenshot</Label>
              {formData.screenshot_url ? (
                <div className="relative">
                  <img src={formData.screenshot_url} alt="Screenshot" className="w-full rounded" />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setFormData(prev => ({ ...prev, screenshot_url: '' }))}
                    className="absolute top-2 right-2 bg-black/50"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  onClick={() => document.getElementById('manual-screenshot-upload').click()}
                  variant="outline"
                  className="w-full"
                >
                  <Paperclip className="w-4 h-4 mr-2" />
                  Upload Screenshot
                </Button>
              )}
              <input
                id="manual-screenshot-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              />
            </div>

            <div>
              <Label className="text-xs text-[#888]">Close Price (if already closed)</Label>
              <Input
                type="number"
                step="any"
                value={formData.close_price}
                onChange={(e) => setFormData(prev => ({ ...prev, close_price: e.target.value }))}
                placeholder="Leave empty if trade is open"
                className="bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-1 bg-white hover:bg-gray-100 text-black font-semibold"
            >
              Add Trade
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}