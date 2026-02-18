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
  prop_account_size: 100000,
  prop_account_cost: 500,
  profit_split: 80,
  challenge1_target: 10000,
  challenge1_days: 30,
  challenge2_enabled: false,
  challenge2_target: 5000,
  challenge2_days: 60,
  post_challenge_profit: 20000,
  post_challenge_duration_days: 90,
};

export default function FocusSettings() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [mode, setMode] = useState(null); // null until loaded
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [draft, setDraft] = useState(null); // null until loaded
  const [savedState, setSavedState] = useState(DEFAULT_FOCUS_SETTINGS);
  const [savedMode, setSavedMode] = useState('goal');
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
    if (!draft || !mode) return false;
    return JSON.stringify({ ...draft, mode }) !== JSON.stringify({ ...savedState, mode: savedMode });
  }, [draft, savedState, mode, savedMode]);

  // Load settings when focusSettings changes or profile switches
  useEffect(() => {
    const loadedData = focusSettings ? {
      current_capital: focusSettings.current_capital_usd || 10000,
      target_capital: focusSettings.target_capital_usd || 20000,
      start_date: focusSettings.start_date || new Date().toISOString().split('T')[0],
      end_date: focusSettings.target_date || new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      prop_account_size: focusSettings.prop_account_size_usd || 100000,
      prop_account_cost: focusSettings.prop_account_cost_usd || 500,
      profit_split: focusSettings.profit_split_percent || 80,
      challenge1_target: focusSettings.challenge1_target || 10000,
      challenge1_days: focusSettings.challenge1_days || 30,
      challenge2_enabled: !!focusSettings.challenge2_enabled,
      challenge2_target: focusSettings.challenge2_target || 5000,
      challenge2_days: focusSettings.challenge2_days || 60,
      post_challenge_profit: focusSettings.post_challenge_profit || 20000,
      post_challenge_duration_days: focusSettings.post_challenge_duration_days || 90,
    } : DEFAULT_FOCUS_SETTINGS;

    const loadedMode = focusSettings?.mode === 'prop' ? 'prop' : 'goal';

    // Check if editing and dirty before overwriting
    if (isEditing && isDirty) {
      setPendingAction(() => () => {
        setDraft(loadedData);
        setSavedState(loadedData);
        setMode(loadedMode);
        setSavedMode(loadedMode);
        setIsEditing(false);
        setErrors({});
      });
      setShowUnsavedModal(true);
    } else {
      setDraft(loadedData);
      setSavedState(loadedData);
      setMode(loadedMode);
      setSavedMode(loadedMode);
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
    if (!draft || !mode) return false;
    const newErrors = {};
    
    if (mode === 'goal') {
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
    } else {
      if (!draft.prop_account_size || parseFloat(draft.prop_account_size) <= 0) {
        newErrors.prop_account_size = 'Must be > 0';
      }
      if (parseFloat(draft.profit_split) < 0 || parseFloat(draft.profit_split) > 100) {
        newErrors.profit_split = 'Must be 0-100%';
      }
      if (!draft.post_challenge_duration_days || parseInt(draft.post_challenge_duration_days) <= 0) {
        newErrors.post_challenge_duration_days = 'Must be > 0';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [draft, mode]);

  useEffect(() => {
    if (isEditing) {
      validate();
    }
  }, [draft, mode, isEditing, validate]);

  const handleSave = async () => {
    if (!validate()) {
      toast.error('Please fix validation errors');
      return;
    }
    const data = {
      mode,
      current_capital_usd: parseFloat(draft.current_capital) || 0,
      target_capital_usd: parseFloat(draft.target_capital) || 0,
      start_date: draft.start_date,
      target_date: draft.end_date,
      prop_account_size_usd: parseFloat(draft.prop_account_size) || 0,
      prop_account_cost_usd: parseFloat(draft.prop_account_cost) || 0,
      profit_split_percent: parseFloat(draft.profit_split) || 80,
      challenge1_target: parseFloat(draft.challenge1_target) || 0,
      challenge1_days: parseInt(draft.challenge1_days) || 0,
      challenge2_enabled: !!draft.challenge2_enabled,
      challenge2_target: parseFloat(draft.challenge2_target) || 0,
      challenge2_days: parseInt(draft.challenge2_days) || 0,
      post_challenge_profit: parseFloat(draft.post_challenge_profit) || 0,
      post_challenge_duration_days: parseInt(draft.post_challenge_duration_days) || 90,
    };
    
    // Update saved state immediately to prevent flicker
    setSavedState(draft);
    setSavedMode(mode);
    
    saveSettingsMutation.mutate(data);
  };

  const handleCancel = () => {
    setDraft(savedState);
    setMode(savedMode);
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

  // Prop calculations (30 trading days/month)
  const propRequiredProfit = useMemo(() => {
    if (!draft) return { perDay: 0, perWeek: 0, perMonth: 0, totalChallengeDays: 0, remainingDays: 0 };
    const totalChallengeDays = (parseInt(draft.challenge1_days) || 0) + (draft.challenge2_enabled ? (parseInt(draft.challenge2_days) || 0) : 0);
    const profit = parseFloat(draft.post_challenge_profit) || 0;
    const duration = parseInt(draft.post_challenge_duration_days) || 1;
    const perDay = profit / duration;
    const perWeek = perDay * 5;
    const perMonth = perDay * 30; // 30 trading days/month
    return { perDay, perWeek, perMonth, totalChallengeDays, duration };
  }, [draft]);

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
  if (!draft || mode === null) {
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

        {/* Mode Selection + Edit/Save */}
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl border border-[#2a2a2a] p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="flex gap-2 bg-[#111] rounded-lg p-1 border border-[#2a2a2a]">
                <button
                  onClick={() => isEditing && setMode('goal')}
                  disabled={!isEditing}
                  className={cn(
                    "px-4 py-2 rounded-md text-sm font-medium transition-all focus:outline-none focus-visible:outline-none",
                    mode === 'goal'
                      ? "bg-violet-500/20 text-violet-400"
                      : "text-[#666] hover:text-[#c0c0c0]",
                    !isEditing && "cursor-not-allowed"
                  )}
                >
                  Goal
                </button>
                <button
                  onClick={() => isEditing && setMode('prop')}
                  disabled={!isEditing}
                  className={cn(
                    "px-4 py-2 rounded-md text-sm font-medium transition-all focus:outline-none focus-visible:outline-none",
                    mode === 'prop'
                      ? "bg-blue-500/20 text-blue-400"
                      : "text-[#666] hover:text-[#c0c0c0]",
                    !isEditing && "cursor-not-allowed"
                  )}
                >
                  Prop Firm
                </button>
              </div>
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
                    disabled={!isDirty || saveSettingsMutation.isPending || Object.keys(errors).length > 0 || !riskConfigured}
                    size="sm"
                    className={cn(
                      "bg-gradient-to-r from-[#c0c0c0] to-[#a0a0a0] text-black hover:from-[#b0b0b0] hover:to-[#909090] font-bold",
                      (!isDirty || Object.keys(errors).length > 0 || !riskConfigured) && "opacity-50 cursor-not-allowed"
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

        {/* GOAL MODE */}
        {mode === 'goal' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-violet-400" />
              <h3 className="text-[#c0c0c0] font-bold text-lg">Goal Settings</h3>
            </div>

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
        )}

        {/* PROP FIRM MODE */}
        {mode === 'prop' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              <h3 className="text-[#c0c0c0] font-bold text-lg">Prop Firm Settings</h3>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label className="text-[#888] text-xs uppercase tracking-wider">Prop Account Size ($)</Label>
                <Input
                  type="number"
                  value={draft.prop_account_size}
                  onChange={(e) => setDraft({ ...draft, prop_account_size: e.target.value })}
                  disabled={!isEditing}
                  className={cn(
                    "bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2",
                    !isEditing && "opacity-60 cursor-not-allowed",
                    errors.prop_account_size && "border-red-500/50"
                  )}
                />
                {errors.prop_account_size && (
                  <p className="text-red-400 text-xs mt-1">{errors.prop_account_size}</p>
                )}
              </div>

              <div>
                <Label className="text-[#888] text-xs uppercase tracking-wider">Prop Account Cost ($)</Label>
                <Input
                  type="number"
                  value={draft.prop_account_cost}
                  onChange={(e) => setDraft({ ...draft, prop_account_cost: e.target.value })}
                  disabled={!isEditing}
                  className={cn(
                    "bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2",
                    !isEditing && "opacity-60 cursor-not-allowed"
                  )}
                />
              </div>

              <div>
                <Label className="text-[#888] text-xs uppercase tracking-wider">Profit Split (%)</Label>
                <Input
                  type="number"
                  value={draft.profit_split}
                  onChange={(e) => setDraft({ ...draft, profit_split: e.target.value })}
                  disabled={!isEditing}
                  className={cn(
                    "bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2",
                    !isEditing && "opacity-60 cursor-not-allowed",
                    errors.profit_split && "border-red-500/50"
                  )}
                />
                {errors.profit_split && (
                  <p className="text-red-400 text-xs mt-1">{errors.profit_split}</p>
                )}
              </div>
            </div>

            {/* Challenges */}
            <div className="space-y-4 pt-4 border-t border-[#2a2a2a]">
              <div className="bg-[#111]/50 rounded-lg border border-[#2a2a2a] p-4">
                <h4 className="text-[#c0c0c0] font-medium text-sm mb-4">Challenge 1</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[#888] text-xs">Profit Target ($)</Label>
                    <Input
                      type="number"
                      value={draft.challenge1_target}
                      onChange={(e) => setDraft({ ...draft, challenge1_target: e.target.value })}
                      disabled={!isEditing}
                      className={cn(
                        "bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0] mt-1 h-9",
                        !isEditing && "opacity-60 cursor-not-allowed"
                      )}
                    />
                  </div>
                  <div>
                    <Label className="text-[#888] text-xs">Target Time (days)</Label>
                    <Input
                      type="number"
                      value={draft.challenge1_days}
                      onChange={(e) => setDraft({ ...draft, challenge1_days: e.target.value })}
                      disabled={!isEditing}
                      className={cn(
                        "bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0] mt-1 h-9",
                        !isEditing && "opacity-60 cursor-not-allowed"
                      )}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-[#111]/50 rounded-lg border border-[#2a2a2a] p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[#c0c0c0] font-medium text-sm">Challenge 2 (Optional)</h4>
                  <Switch
                    checked={draft.challenge2_enabled}
                    onCheckedChange={(checked) => isEditing && setDraft({ ...draft, challenge2_enabled: checked })}
                    disabled={!isEditing}
                    className={cn(
                      "data-[state=checked]:bg-emerald-500",
                      !isEditing && "opacity-60 cursor-not-allowed"
                    )}
                  />
                </div>
                {draft.challenge2_enabled && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-[#888] text-xs">Profit Target ($)</Label>
                      <Input
                        type="number"
                        value={draft.challenge2_target}
                        onChange={(e) => setDraft({ ...draft, challenge2_target: e.target.value })}
                        disabled={!isEditing}
                        className={cn(
                          "bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0] mt-1 h-9",
                          !isEditing && "opacity-60 cursor-not-allowed"
                        )}
                      />
                    </div>
                    <div>
                      <Label className="text-[#888] text-xs">Target Time (days)</Label>
                      <Input
                        type="number"
                        value={draft.challenge2_days}
                        onChange={(e) => setDraft({ ...draft, challenge2_days: e.target.value })}
                        disabled={!isEditing}
                        className={cn(
                          "bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0] mt-1 h-9",
                          !isEditing && "opacity-60 cursor-not-allowed"
                        )}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Post-Challenge Profit Goal */}
            <div className="pt-4 border-t border-[#2a2a2a]">
              <h4 className="text-[#c0c0c0] font-medium text-sm mb-4">Post-Challenge Profit Goal</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-[#888] text-xs uppercase tracking-wider">Profit Goal After Challenges ($)</Label>
                  <Input
                    type="number"
                    value={draft.post_challenge_profit}
                    onChange={(e) => setDraft({ ...draft, post_challenge_profit: e.target.value })}
                    disabled={!isEditing}
                    className={cn(
                      "bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2",
                      !isEditing && "opacity-60 cursor-not-allowed"
                    )}
                  />
                </div>
                <div>
                  <Label className="text-[#888] text-xs uppercase tracking-wider">Target Duration (days)</Label>
                  <Input
                    type="number"
                    value={draft.post_challenge_duration_days}
                    onChange={(e) => setDraft({ ...draft, post_challenge_duration_days: e.target.value })}
                    disabled={!isEditing}
                    className={cn(
                      "bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2",
                      !isEditing && "opacity-60 cursor-not-allowed",
                      errors.post_challenge_duration_days && "border-red-500/50"
                    )}
                  />
                  {errors.post_challenge_duration_days && (
                    <p className="text-red-400 text-xs mt-1">{errors.post_challenge_duration_days}</p>
                  )}
                </div>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-400" />
                    <span className="text-[#888] text-sm font-medium">Required Profit (post-challenge)</span>
                  </div>
                  <div className="text-xs text-[#666]">
                    Challenge duration: {propRequiredProfit.totalChallengeDays} days • Target period: {propRequiredProfit.duration} days
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-[#111]/50 rounded-lg border border-emerald-500/30 p-4">
                    <div className="text-[#666] text-xs mb-1">Per Day</div>
                    <div className="text-emerald-400 text-2xl font-bold">
                      ${formatCurrency(propRequiredProfit.perDay)}
                    </div>
                  </div>
                  <div className="bg-[#111]/50 rounded-lg border border-emerald-500/30 p-4">
                    <div className="text-[#666] text-xs mb-1">Per Week</div>
                    <div className="text-emerald-400 text-2xl font-bold">
                      ${formatCurrency(propRequiredProfit.perWeek)}
                    </div>
                  </div>
                  <div className="bg-[#111]/50 rounded-lg border border-emerald-500/30 p-4">
                    <div className="text-[#666] text-xs mb-1">Per Month</div>
                    <div className="text-emerald-400 text-2xl font-bold">
                      ${formatCurrency(propRequiredProfit.perMonth)}
                    </div>
                  </div>
                </div>
                <p className="text-[#666] text-xs mt-2">* Assuming 30 trading days per month</p>
              </div>
            </div>
          </div>
        )}
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