import { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Target, TrendingUp, Calculator, Calendar, Edit2, Save, X, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getActiveProfileId } from '../utils/profileUtils';
import { differenceInDays } from 'date-fns';
import UnsavedChangesModal from '../UnsavedChangesModal';
import { formatCurrency, formatPercent } from '../utils/formatUtils';

const DEFAULT_FOCUS_SETTINGS = {
  current_capital: 10000,
  target_capital: 20000,
  start_date: new Date().toISOString().split('T')[0],
  end_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
};

export default function FocusSettings() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [draft, setDraft] = useState(null); // null until loaded
  const [savedState, setSavedState] = useState(DEFAULT_FOCUS_SETTINGS);
  const [errors, setErrors] = useState({});
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const [calculator, setCalculator] = useState({
    capital: 10000,
    risk_per_trade: 2,
    winrate: 50,
    rr_ratio: 3,
    trades_per_day: 3,
  });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: focusSettings } = useQuery({
    queryKey: ['focusSettings', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const profileId = await getActiveProfileId();
      const settings = await base44.entities.FocusGoal.filter({ 
        profile_id: profileId,
        is_active: true 
      }, '-created_at', 1);
      return settings[0] || null;
    },
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000,
  });

  const { data: riskSettings } = useQuery({
    queryKey: ['riskSettings', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const profileId = await getActiveProfileId();
      const settings = await base44.entities.RiskSettings.filter({ 
        profile_id: profileId
      }, '-created_date', 1);
      return settings[0] || null;
    },
    enabled: !!user?.email,
  });



  const isDirty = useMemo(() => {
    if (!draft) return false;
    return JSON.stringify(draft) !== JSON.stringify(savedState);
  }, [draft, savedState]);

  // Load settings when focusSettings changes or profile switches
  useEffect(() => {
    const loadedData = focusSettings ? {
      current_capital: focusSettings.current_capital_usd ?? null,
      target_capital: focusSettings.target_capital_usd ?? null,
      start_date: focusSettings.start_date ?? null,
      end_date: focusSettings.target_date ?? null,
    } : {
      current_capital: null,
      target_capital: null,
      start_date: null,
      end_date: null,
    };

    // Check if editing and dirty before overwriting
    if (isEditing && isDirty) {
      setPendingAction(() => () => {
        setDraft(loadedData);
        setSavedState(loadedData);
        setIsEditing(false);
        setErrors({});
      });
      setShowUnsavedModal(true);
    } else {
      setDraft(loadedData);
      setSavedState(loadedData);
      setIsEditing(false);
      setErrors({});
    }
  }, [focusSettings]);

  const saveSettingsMutation = useMutation({
    mutationFn: async (data) => {
      const profileId = await getActiveProfileId();
      if (focusSettings?.id) {
        return base44.entities.FocusGoal.update(focusSettings.id, { ...data, profile_id: profileId });
      }
      return base44.entities.FocusGoal.create({ 
        ...data, 
        profile_id: profileId,
        is_active: true
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries(['focusSettings']);
      // Wait for refetch to complete
      await queryClient.refetchQueries(['focusSettings']);
      toast.success('Saved', { duration: 2000 });
    },
    onError: () => {
      toast.error('Save failed');
    },
  });

  const validate = useCallback(() => {
    if (!draft) return false;
    const newErrors = {};
    
    if (!draft.current_capital || parseFloat(draft.current_capital) <= 0) {
      newErrors.current_capital = 'Must be > 0';
    }
    if (!draft.target_capital || parseFloat(draft.target_capital) <= 0) {
      newErrors.target_capital = 'Must be > 0';
    }
    if (parseFloat(draft.target_capital) < parseFloat(draft.current_capital)) {
      newErrors.target_capital = 'Must be ≥ current capital';
    }
    if (draft.start_date && draft.end_date && new Date(draft.end_date) <= new Date(draft.start_date)) {
      newErrors.end_date = 'Must be after start date';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [draft]);

  useEffect(() => {
    if (isEditing) {
      validate();
    }
  }, [draft, isEditing, validate]);

  const handleSave = async () => {
    if (!validate()) {
      toast.error('Please fix validation errors');
      return;
    }
    const data = {
      mode: 'personal',
      current_capital_usd: parseFloat(draft.current_capital) || 0,
      target_capital_usd: parseFloat(draft.target_capital) || 0,
      start_date: draft.start_date,
      target_date: draft.end_date,
    };
    
    // Update saved state immediately to prevent flicker
    setSavedState(draft);
    
    saveSettingsMutation.mutate(data);
  };

  const handleCancel = () => {
    setDraft(savedState);
    setIsEditing(false);
    setErrors({});
  };

  // Goal calculations (30 trading days/month)
  const goalDurationDays = useMemo(() => {
    if (!draft || !draft.start_date || !draft.end_date) return 0;
    return Math.max(differenceInDays(new Date(draft.end_date), new Date(draft.start_date)), 1);
  }, [draft]);

  const goalRequiredProfit = useMemo(() => {
    if (!draft) return { perDay: 0, perWeek: 0, perMonth: 0 };
    const profit = (parseFloat(draft.target_capital) || 0) - (parseFloat(draft.current_capital) || 0);
    const days = goalDurationDays || 1;
    const perDay = profit / days;
    const perWeek = perDay * 5;
    const perMonth = perDay * 30; // 30 trading days/month
    return { perDay, perWeek, perMonth };
  }, [draft, goalDurationDays]);



  // Calculator
  const calcResults = useMemo(() => {
    const capital = parseFloat(calculator.capital) || 0;
    const risk = parseFloat(calculator.risk_per_trade) || 0;
    const wr = Math.min(Math.max(parseFloat(calculator.winrate) / 100, 0), 1);
    const rr = parseFloat(calculator.rr_ratio) || 0;
    const trades = parseFloat(calculator.trades_per_day) || 0;

    const riskAmt = capital * (risk / 100);
    const expectancy = (wr * (rr * riskAmt)) - ((1 - wr) * riskAmt);
    const daily = expectancy * trades;
    const weekly = daily * 5;
    const monthly = daily * 30; // 30 trading days/month
    const yearly = daily * 252;

    return { daily, weekly, monthly, yearly };
  }, [calculator]);

  const riskConfigured = riskSettings && 
    (riskSettings.daily_max_loss_percent > 0 || riskSettings.max_trades_per_day > 0);

  // Loading state - prevent blink
  if (!draft) {
    return (
      <div className="flex items-center justify-center py-12 bg-[#0d0d0d] rounded-xl">
        <div className="text-[#666] text-sm">Loading settings...</div>
      </div>
    );
  }

  return (
    <>
      {showUnsavedModal && (
        <UnsavedChangesModal
          onDiscard={() => {
            if (pendingAction) {
              pendingAction();
              setPendingAction(null);
            }
            setShowUnsavedModal(false);
          }}
          onStay={() => {
            setPendingAction(null);
            setShowUnsavedModal(false);
          }}
        />
      )}

      <div className="space-y-6 bg-[#0d0d0d]">
        {/* Warning if risk not configured */}
        {!riskConfigured && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-400 text-sm font-medium">You must configure Risk Settings before using Goal projections.</p>
              <p className="text-[#888] text-xs mt-1">Go to Settings → Risk tab to set your risk parameters.</p>
            </div>
          </div>
        )}

        {/* Goal Settings */}
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl border border-[#2a2a2a] p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Target className="w-5 h-5 text-violet-400" />
              <h3 className="text-[#c0c0c0] font-bold text-lg">Goal Settings</h3>
              {isEditing && isDirty && (
                <span className="flex items-center gap-1 text-amber-400 text-xs">
                  <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                  Unsaved changes
                </span>
              )}
            </div>

            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button
                    onClick={handleCancel}
                    variant="outline"
                    size="sm"
                    className="bg-[#111] border-[#2a2a2a] text-[#888] hover:text-[#c0c0c0]"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSave}
                    disabled={!isDirty || saveSettingsMutation.isPending || Object.keys(errors).length > 0}
                    size="sm"
                    className={cn(
                      "bg-gradient-to-r from-[#c0c0c0] to-[#a0a0a0] text-black hover:from-[#b0b0b0] hover:to-[#909090] font-bold",
                      (!isDirty || Object.keys(errors).length > 0) && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <Save className="w-4 h-4 mr-1" />
                    {saveSettingsMutation.isPending ? 'Saving...' : 'Save'}
                  </Button>
                </>
              ) : (
                <Button 
                  onClick={() => setIsEditing(true)}
                  size="sm"
                  className="bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 border border-violet-500/50"
                >
                  <Edit2 className="w-4 h-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-6">

            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label className="text-[#888] text-xs uppercase tracking-wider">Current Capital ($)</Label>
                <Input
                  type="number"
                  value={draft.current_capital}
                  onChange={(e) => setDraft({ ...draft, current_capital: e.target.value })}
                  disabled={!isEditing}
                  className={cn(
                    "bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2",
                    !isEditing && "opacity-60 cursor-not-allowed",
                    errors.current_capital && "border-red-500/50"
                  )}
                />
                {errors.current_capital && (
                  <p className="text-red-400 text-xs mt-1">{errors.current_capital}</p>
                )}
              </div>

              <div>
                <Label className="text-[#888] text-xs uppercase tracking-wider">Target Capital ($)</Label>
                <Input
                  type="number"
                  value={draft.target_capital}
                  onChange={(e) => setDraft({ ...draft, target_capital: e.target.value })}
                  disabled={!isEditing}
                  className={cn(
                    "bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2",
                    !isEditing && "opacity-60 cursor-not-allowed",
                    errors.target_capital && "border-red-500/50"
                  )}
                />
                {errors.target_capital && (
                  <p className="text-red-400 text-xs mt-1">{errors.target_capital}</p>
                )}
              </div>

              <div>
                <Label className="text-[#888] text-xs uppercase tracking-wider">Start Date</Label>
                <Input
                  type="date"
                  value={draft.start_date}
                  onChange={(e) => setDraft({ ...draft, start_date: e.target.value })}
                  disabled={!isEditing}
                  className={cn(
                    "bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2",
                    !isEditing && "opacity-60 cursor-not-allowed"
                  )}
                />
              </div>

              <div>
                <Label className="text-[#888] text-xs uppercase tracking-wider">End Date</Label>
                <Input
                  type="date"
                  value={draft.end_date}
                  onChange={(e) => setDraft({ ...draft, end_date: e.target.value })}
                  disabled={!isEditing}
                  className={cn(
                    "bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2",
                    !isEditing && "opacity-60 cursor-not-allowed",
                    errors.end_date && "border-red-500/50"
                  )}
                />
                {errors.end_date && (
                  <p className="text-red-400 text-xs mt-1">{errors.end_date}</p>
                )}
              </div>
            </div>

            {/* Goal Duration + Required Profit */}
            <div className="pt-6 border-t border-[#2a2a2a]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  <span className="text-[#888] text-sm font-medium">Required Profit (based on goal)</span>
                </div>
                <span className="text-[#c0c0c0] text-sm font-bold">
                  {goalDurationDays} days
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#111]/50 rounded-lg border border-emerald-500/30 p-4">
                  <div className="text-[#666] text-xs mb-1">Per Day</div>
                  <div className="text-emerald-400 text-2xl font-bold">
                    ${formatCurrency(goalRequiredProfit.perDay)}
                  </div>
                </div>
                <div className="bg-[#111]/50 rounded-lg border border-emerald-500/30 p-4">
                  <div className="text-[#666] text-xs mb-1">Per Week</div>
                  <div className="text-emerald-400 text-2xl font-bold">
                    ${formatCurrency(goalRequiredProfit.perWeek)}
                  </div>
                </div>
                <div className="bg-[#111]/50 rounded-lg border border-emerald-500/30 p-4">
                  <div className="text-[#666] text-xs mb-1">Per Month</div>
                  <div className="text-emerald-400 text-2xl font-bold">
                    ${formatCurrency(goalRequiredProfit.perMonth)}
                  </div>
                </div>
              </div>
              <p className="text-[#666] text-xs mt-2">* Assuming 30 trading days per month</p>
            </div>
          </div>
      </div>

      {/* Earnings Calculator (Collapsible) */}
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl border border-[#2a2a2a] overflow-hidden">
        <button
          onClick={() => setCalculatorOpen(!calculatorOpen)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#1a1a1a]/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-cyan-400" />
            <h3 className="text-[#c0c0c0] font-bold text-lg">Earnings Calculator</h3>
          </div>
          {calculatorOpen ? (
            <ChevronDown className="w-5 h-5 text-[#888]" />
          ) : (
            <ChevronRight className="w-5 h-5 text-[#888]" />
          )}
        </button>

        {calculatorOpen && (
          <div className="px-6 pb-6 pt-2">
            <div className="grid grid-cols-3 gap-6 mb-6">
              <div>
                <Label className="text-[#888] text-xs uppercase tracking-wider">Capital ($)</Label>
                <Input
                  type="number"
                  value={calculator.capital}
                  onChange={(e) => setCalculator({ ...calculator, capital: e.target.value })}
                  className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2"
                />
              </div>

              <div>
                <Label className="text-[#888] text-xs uppercase tracking-wider">Risk per Trade (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={calculator.risk_per_trade}
                  onChange={(e) => setCalculator({ ...calculator, risk_per_trade: e.target.value })}
                  className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2"
                />
              </div>

              <div>
                <Label className="text-[#888] text-xs uppercase tracking-wider">Winrate (%)</Label>
                <Input
                  type="number"
                  value={calculator.winrate}
                  onChange={(e) => setCalculator({ ...calculator, winrate: e.target.value })}
                  className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2"
                />
              </div>

              <div>
                <Label className="text-[#888] text-xs uppercase tracking-wider">Risk/Reward (R:R)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={calculator.rr_ratio}
                  onChange={(e) => setCalculator({ ...calculator, rr_ratio: e.target.value })}
                  className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2"
                />
              </div>

              <div>
                <Label className="text-[#888] text-xs uppercase tracking-wider">Trades per Day</Label>
                <Input
                  type="number"
                  value={calculator.trades_per_day}
                  onChange={(e) => setCalculator({ ...calculator, trades_per_day: e.target.value })}
                  className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2"
                />
              </div>
            </div>

            {/* Calculator Outputs */}
            <div className="pt-6 border-t border-[#2a2a2a]">
              <div className="text-[#888] text-sm font-medium mb-4">Estimated Profit</div>
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-cyan-500/20 to-[#0d0d0d] rounded-lg border border-cyan-500/30 p-4">
                  <div className="text-[#666] text-xs mb-1">Per Day</div>
                  <div className="text-cyan-400 text-xl font-bold">
                    ${formatCurrency(Math.max(calcResults.daily, 0))}
                  </div>
                </div>
                <div className="bg-gradient-to-br from-cyan-500/20 to-[#0d0d0d] rounded-lg border border-cyan-500/30 p-4">
                  <div className="text-[#666] text-xs mb-1">Per Week</div>
                  <div className="text-cyan-400 text-xl font-bold">
                    ${formatCurrency(Math.max(calcResults.weekly, 0))}
                  </div>
                </div>
                <div className="bg-gradient-to-br from-cyan-500/20 to-[#0d0d0d] rounded-lg border border-cyan-500/30 p-4">
                  <div className="text-[#666] text-xs mb-1">Per Month</div>
                  <div className="text-cyan-400 text-xl font-bold">
                    ${formatCurrency(Math.max(calcResults.monthly, 0))}
                  </div>
                </div>
                <div className="bg-gradient-to-br from-cyan-500/20 to-[#0d0d0d] rounded-lg border border-cyan-500/30 p-4">
                  <div className="text-[#666] text-xs mb-1">Per Year</div>
                  <div className="text-cyan-400 text-xl font-bold">
                    ${formatCurrency(Math.max(calcResults.yearly, 0))}
                  </div>
                </div>
              </div>
              <p className="text-[#666] text-xs mt-4">
                * Estimates only. Real results may vary. Assuming 30 trading days/month, 252 trading days/year.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}