import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Calendar, Clock, Timer, Hourglass, Paperclip, X } from 'lucide-react';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { parseNumberSafe, validateTradeData, formatNumber as formatNumberUtil } from '../utils/numberUtils';



export default function ManualTradeForm({ isOpen, onClose, onSubmit, currentBalance }) {
  const getInitialFormData = () => ({
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

  const [formData, setFormData] = useState(getInitialFormData());

  const [calculations, setCalculations] = useState({
    riskUsd: 0,
    riskPercent: 0,
    potentialUsd: 0,
    potentialPercent: 0,
    rrRatio: 0
  });

  useEffect(() => {
    if (isOpen) {
      // Reset form when opening
      setFormData(getInitialFormData());
      setCalculations({
        riskUsd: 0,
        riskPercent: 0,
        potentialUsd: 0,
        potentialPercent: 0,
        rrRatio: 0
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (currentBalance) {
      setFormData(prev => ({ ...prev, account_balance_at_entry: currentBalance }));
    }
  }, [currentBalance]);

  useEffect(() => {
    const entry = parseNumberSafe(formData.entry_price);
    const stop = parseNumberSafe(formData.stop_price);
    const take = parseNumberSafe(formData.take_price);
    const size = parseNumberSafe(formData.position_size);
    const balance = formData.account_balance_at_entry || 100000;

    if (entry && entry > 0 && stop && stop > 0 && size && size > 0) {
      const stopDistance = Math.abs(entry - stop);
      const riskUsd = (stopDistance / entry) * size;
      const riskPercent = (riskUsd / balance) * 100;

      let potentialUsd = 0;
      let potentialPercent = 0;
      let rrRatio = 0;

      if (take && take > 0) {
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
    console.log('=== MANUAL FORM SUBMIT ===');
    console.log('Form data before validation:', formData);
    
    // Validate using numberUtils
    const validation = validateTradeData(formData);
    
    if (!validation.valid) {
      console.error('Validation failed:', validation.errors);
      toast.error(validation.errors[0]);
      return;
    }

    const entry = parseNumberSafe(formData.entry_price);
    const size = parseNumberSafe(formData.position_size);
    const stop = parseNumberSafe(formData.stop_price);
    const take = parseNumberSafe(formData.take_price);
    const close = parseNumberSafe(formData.close_price);

    console.log('Parsed values:', { entry, size, stop, take, close });

    // Store as RAW numbers, not formatted strings
    const tradeData = {
      date_open: formData.date_open,
      coin: formData.coin.trim(),
      direction: formData.direction,
      entry_price: entry,
      position_size: size,
      stop_price: stop,
      take_price: take,
      close_price: close,
      confidence_level: formData.confidence_level,
      strategy_tag: formData.strategy_tag,
      timeframe: formData.timeframe,
      market_context: formData.market_context,
      entry_reason: formData.entry_reason,
      screenshot_url: formData.screenshot_url,
      account_balance_at_entry: formData.account_balance_at_entry
    };

    console.log('Final trade data to submit:', tradeData);

    onSubmit(tradeData);
    setFormData(getInitialFormData());
    setCalculations({
      riskUsd: 0,
      riskPercent: 0,
      potentialUsd: 0,
      potentialPercent: 0,
      rrRatio: 0
    });
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-[#2a2a2a] [&>button]:text-white [&>button]:hover:text-white">
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
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0] hover:bg-[#151515]"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {format(new Date(formData.date_open), 'dd MMM yyyy, HH:mm')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-[#1a1a1a] border-[#333]" align="start">
                    <div className="p-3 space-y-3">
                      <CalendarComponent
                        mode="single"
                        selected={new Date(formData.date_open)}
                        onSelect={(date) => {
                          if (date) {
                            const currentDate = new Date(formData.date_open);
                            date.setHours(currentDate.getHours());
                            date.setMinutes(currentDate.getMinutes());
                            setFormData(prev => ({ ...prev, date_open: date.toISOString() }));
                          }
                        }}
                        className="rounded-md border-0"
                      />
                      <div className="flex gap-2 pt-2 border-t border-[#2a2a2a]">
                        <div className="flex-1">
                          <Label className="text-xs text-[#888]">Hour</Label>
                          <Select 
                            value={new Date(formData.date_open).getHours().toString()}
                            onValueChange={(val) => {
                              const date = new Date(formData.date_open);
                              date.setHours(parseInt(val));
                              setFormData(prev => ({ ...prev, date_open: date.toISOString() }));
                            }}
                          >
                            <SelectTrigger className="h-8 bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1a1a1a] border-[#333] max-h-[200px]">
                              {Array.from({ length: 24 }, (_, i) => (
                                <SelectItem key={i} value={i.toString()}>{i.toString().padStart(2, '0')}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex-1">
                          <Label className="text-xs text-[#888]">Minute</Label>
                          <Select 
                            value={new Date(formData.date_open).getMinutes().toString()}
                            onValueChange={(val) => {
                              const date = new Date(formData.date_open);
                              date.setMinutes(parseInt(val));
                              setFormData(prev => ({ ...prev, date_open: date.toISOString() }));
                            }}
                          >
                            <SelectTrigger className="h-8 bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1a1a1a] border-[#333] max-h-[200px]">
                              {Array.from({ length: 60 }, (_, i) => (
                                <SelectItem key={i} value={i.toString()}>{i.toString().padStart(2, '0')}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
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
            <div className="relative p-5 bg-gradient-to-br from-purple-500/10 via-[#1a1a1a] to-blue-500/10 rounded-xl border border-purple-500/30 shadow-[0_0_25px_rgba(168,85,247,0.15)] overflow-hidden">
              {/* Premium background effects */}
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-transparent to-blue-500/5 pointer-events-none" />
              <div className="absolute inset-0 opacity-[0.03]" style={{
                backgroundImage: `linear-gradient(to right, #c0c0c0 1px, transparent 1px), linear-gradient(to bottom, #c0c0c0 1px, transparent 1px)`,
                backgroundSize: '30px 30px'
              }} />
              
              <div className="relative z-10">
                <h3 className="text-sm font-semibold text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-[#c0c0c0] to-blue-300 uppercase tracking-wide mb-4 flex items-center gap-2">
                  <div className="w-1 h-4 bg-gradient-to-b from-purple-400 to-blue-400 rounded-full" />
                  Auto Calculator
                </h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-gradient-to-br from-red-500/20 to-red-500/5 rounded-lg p-3 border border-red-500/30">
                    <p className="text-xs text-red-400/80 mb-1.5 font-medium">Risk</p>
                    <p className="text-xl font-bold text-red-400">${formatNumberUtil(calculations.riskUsd)}</p>
                    <p className="text-xs text-red-400/60 mt-1">{Number.isFinite(calculations.riskPercent) ? calculations.riskPercent.toFixed(1) : '—'}%</p>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 rounded-lg p-3 border border-emerald-500/30">
                    <p className="text-xs text-emerald-400/80 mb-1.5 font-medium">Potential</p>
                    <p className="text-xl font-bold text-emerald-400">${formatNumberUtil(calculations.potentialUsd)}</p>
                    <p className="text-xs text-emerald-400/60 mt-1">{Number.isFinite(calculations.potentialPercent) ? calculations.potentialPercent.toFixed(1) : '—'}%</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg p-3 border border-purple-500/30">
                    <p className="text-xs text-purple-400/80 mb-1.5 font-medium">R:R</p>
                    <p className={cn(
                      "text-xl font-bold",
                      calculations.rrRatio >= 2 ? "text-emerald-400" : "text-amber-400"
                    )}>
                      1:{Number.isFinite(calculations.rrRatio) ? Math.round(calculations.rrRatio) : '—'}
                    </p>
                  </div>
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