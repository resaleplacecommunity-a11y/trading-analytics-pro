import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Zap, Edit2, Save, X } from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getActiveProfileId } from '../utils/profileUtils';

const PresetBadge = ({ name, description, values, onApply, disabled }) => (
  <button
    onClick={() => !disabled && onApply(values)}
    disabled={disabled}
    className={cn(
      "rounded-xl p-4 border-2 bg-[#111]/50 border-[#2a2a2a] transition-all text-left",
      disabled ? "opacity-50 cursor-not-allowed" : "hover:border-[#c0c0c0]/30 hover:bg-[#1a1a1a]"
    )}
  >
    <div className="flex items-center gap-2 mb-2">
      <Zap className="w-4 h-4 text-[#666]" />
      <span className="font-bold text-sm text-[#c0c0c0]">{name}</span>
    </div>
    <p className="text-xs text-[#666] mb-2">{description}</p>
    <div className="flex gap-2 flex-wrap text-[10px] text-[#888]">
      <span>Loss: {values.daily_max_loss_percent}%</span>
      <span>•</span>
      <span>R: {values.daily_max_r}</span>
      <span>•</span>
      <span>Trades: {values.max_trades_per_day}</span>
    </div>
  </button>
);

export default function RiskSettingsForm() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState({
    daily_max_loss_percent: 3,
    daily_max_r: 3,
    max_trades_per_day: 5,
    max_consecutive_losses: 3,
    max_risk_per_trade_percent: 1,
    max_total_open_risk_percent: 5,
    trading_hours_start: '09:00',
    trading_hours_end: '22:00',
    banned_coins: '',
  });
  const [errors, setErrors] = useState({});

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 30 * 60 * 1000,
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
    staleTime: 5 * 60 * 1000,
  });

  // Load settings into draft when riskSettings changes or profile switches
  useEffect(() => {
    if (riskSettings) {
      const loadedData = {
        daily_max_loss_percent: riskSettings.daily_max_loss_percent || 3,
        daily_max_r: riskSettings.daily_max_r || 3,
        max_trades_per_day: riskSettings.max_trades_per_day || 5,
        max_consecutive_losses: riskSettings.max_consecutive_losses || 3,
        max_risk_per_trade_percent: riskSettings.max_risk_per_trade_percent || 1,
        max_total_open_risk_percent: riskSettings.max_total_open_risk_percent || 5,
        trading_hours_start: riskSettings.trading_hours_start || '09:00',
        trading_hours_end: riskSettings.trading_hours_end || '22:00',
        banned_coins: riskSettings.banned_coins || '',
      };
      setDraft(loadedData);
      setIsEditing(false);
      setErrors({});
    }
  }, [riskSettings]);

  const saveSettingsMutation = useMutation({
    mutationFn: async (data) => {
      const profileId = await getActiveProfileId();
      if (riskSettings?.id) {
        return base44.entities.RiskSettings.update(riskSettings.id, { ...data, profile_id: profileId });
      }
      return base44.entities.RiskSettings.create({ ...data, profile_id: profileId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['riskSettings']);
      setIsEditing(false);
      setErrors({});
      toast.success('Risk settings saved');
    },
  });

  const validate = () => {
    const newErrors = {};
    if (draft.daily_max_loss_percent < 0 || draft.daily_max_loss_percent > 100) {
      newErrors.daily_max_loss_percent = 'Must be 0-100%';
    }
    if (draft.daily_max_r < 0) {
      newErrors.daily_max_r = 'Must be ≥ 0';
    }
    if (draft.max_trades_per_day < 1 || draft.max_trades_per_day > 100) {
      newErrors.max_trades_per_day = 'Must be 1-100';
    }
    if (draft.max_consecutive_losses < 1 || draft.max_consecutive_losses > 20) {
      newErrors.max_consecutive_losses = 'Must be 1-20';
    }
    if (draft.max_risk_per_trade_percent < 0 || draft.max_risk_per_trade_percent > 10) {
      newErrors.max_risk_per_trade_percent = 'Must be 0-10%';
    }
    if (draft.max_total_open_risk_percent < 0 || draft.max_total_open_risk_percent > 100) {
      newErrors.max_total_open_risk_percent = 'Must be 0-100%';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) {
      toast.error('Please fix validation errors');
      return;
    }
    saveSettingsMutation.mutate(draft);
  };

  const handleCancel = () => {
    if (riskSettings) {
      setDraft({
        daily_max_loss_percent: riskSettings.daily_max_loss_percent || 3,
        daily_max_r: riskSettings.daily_max_r || 3,
        max_trades_per_day: riskSettings.max_trades_per_day || 5,
        max_consecutive_losses: riskSettings.max_consecutive_losses || 3,
        max_risk_per_trade_percent: riskSettings.max_risk_per_trade_percent || 1,
        max_total_open_risk_percent: riskSettings.max_total_open_risk_percent || 5,
        trading_hours_start: riskSettings.trading_hours_start || '09:00',
        trading_hours_end: riskSettings.trading_hours_end || '22:00',
        banned_coins: riskSettings.banned_coins || '',
      });
    }
    setIsEditing(false);
    setErrors({});
  };

  const applyPreset = (values) => {
    setDraft({ ...draft, ...values });
  };

  const presets = [
    {
      name: 'Prop Firm',
      description: 'Standard prop firm rules',
      values: { daily_max_loss_percent: 5, daily_max_r: 5, max_trades_per_day: 10, max_consecutive_losses: 3, max_risk_per_trade_percent: 1 }
    },
    {
      name: 'Conservative',
      description: 'Lower risk, build consistency',
      values: { daily_max_loss_percent: 2, daily_max_r: 2, max_trades_per_day: 3, max_consecutive_losses: 2, max_risk_per_trade_percent: 0.5 }
    },
    {
      name: 'Aggressive',
      description: 'Higher limits',
      values: { daily_max_loss_percent: 5, daily_max_r: 5, max_trades_per_day: 15, max_consecutive_losses: 4, max_risk_per_trade_percent: 2 }
    }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl border border-[#2a2a2a] p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-violet-400" />
            <h3 className="text-[#c0c0c0] font-bold text-lg">Risk Settings</h3>
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
                  disabled={saveSettingsMutation.isPending || Object.keys(errors).length > 0}
                  size="sm"
                  className="bg-gradient-to-r from-[#c0c0c0] to-[#a0a0a0] text-black hover:from-[#b0b0b0] hover:to-[#909090] font-bold"
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

        {/* Presets */}
        <div className="mb-6">
          <h4 className="text-xs text-[#666] font-medium uppercase tracking-wider mb-3">Quick Presets</h4>
          <div className="grid grid-cols-3 gap-3">
            {presets.map(preset => (
              <PresetBadge key={preset.name} {...preset} onApply={applyPreset} disabled={!isEditing} />
            ))}
          </div>
        </div>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="bg-[#111] border border-[#2a2a2a]">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="mt-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label className="text-[#888] text-xs uppercase tracking-wider">Daily Max Loss (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={draft.daily_max_loss_percent}
                  onChange={(e) => setDraft({ ...draft, daily_max_loss_percent: parseFloat(e.target.value) || 0 })}
                  disabled={!isEditing}
                  className={cn(
                    "bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2",
                    !isEditing && "opacity-60 cursor-not-allowed",
                    errors.daily_max_loss_percent && "border-red-500/50"
                  )}
                />
                {errors.daily_max_loss_percent && (
                  <p className="text-red-400 text-xs mt-1">{errors.daily_max_loss_percent}</p>
                )}
              </div>

              <div>
                <Label className="text-[#888] text-xs uppercase tracking-wider">Daily Max R Loss (R)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={draft.daily_max_r}
                  onChange={(e) => setDraft({ ...draft, daily_max_r: parseFloat(e.target.value) || 0 })}
                  disabled={!isEditing}
                  className={cn(
                    "bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2",
                    !isEditing && "opacity-60 cursor-not-allowed",
                    errors.daily_max_r && "border-red-500/50"
                  )}
                />
                {errors.daily_max_r && (
                  <p className="text-red-400 text-xs mt-1">{errors.daily_max_r}</p>
                )}
              </div>

              <div>
                <Label className="text-[#888] text-xs uppercase tracking-wider">Max Trades Per Day</Label>
                <Input
                  type="number"
                  value={draft.max_trades_per_day}
                  onChange={(e) => setDraft({ ...draft, max_trades_per_day: parseInt(e.target.value) || 0 })}
                  disabled={!isEditing}
                  className={cn(
                    "bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2",
                    !isEditing && "opacity-60 cursor-not-allowed",
                    errors.max_trades_per_day && "border-red-500/50"
                  )}
                />
                {errors.max_trades_per_day && (
                  <p className="text-red-400 text-xs mt-1">{errors.max_trades_per_day}</p>
                )}
              </div>

              <div>
                <Label className="text-[#888] text-xs uppercase tracking-wider">Loss Streak</Label>
                <Input
                  type="number"
                  value={draft.max_consecutive_losses}
                  onChange={(e) => setDraft({ ...draft, max_consecutive_losses: parseInt(e.target.value) || 0 })}
                  disabled={!isEditing}
                  className={cn(
                    "bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2",
                    !isEditing && "opacity-60 cursor-not-allowed",
                    errors.max_consecutive_losses && "border-red-500/50"
                  )}
                />
                {errors.max_consecutive_losses && (
                  <p className="text-red-400 text-xs mt-1">{errors.max_consecutive_losses}</p>
                )}
              </div>

              <div>
                <Label className="text-[#888] text-xs uppercase tracking-wider">Max Risk Per Trade (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={draft.max_risk_per_trade_percent}
                  onChange={(e) => setDraft({ ...draft, max_risk_per_trade_percent: parseFloat(e.target.value) || 0 })}
                  disabled={!isEditing}
                  className={cn(
                    "bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2",
                    !isEditing && "opacity-60 cursor-not-allowed",
                    errors.max_risk_per_trade_percent && "border-red-500/50"
                  )}
                />
                {errors.max_risk_per_trade_percent && (
                  <p className="text-red-400 text-xs mt-1">{errors.max_risk_per_trade_percent}</p>
                )}
              </div>

              <div>
                <Label className="text-[#888] text-xs uppercase tracking-wider">Max Total Open Risk (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={draft.max_total_open_risk_percent}
                  onChange={(e) => setDraft({ ...draft, max_total_open_risk_percent: parseFloat(e.target.value) || 0 })}
                  disabled={!isEditing}
                  className={cn(
                    "bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2",
                    !isEditing && "opacity-60 cursor-not-allowed",
                    errors.max_total_open_risk_percent && "border-red-500/50"
                  )}
                />
                {errors.max_total_open_risk_percent && (
                  <p className="text-red-400 text-xs mt-1">{errors.max_total_open_risk_percent}</p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="mt-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label className="text-[#888] text-xs uppercase tracking-wider">Trading Hours Start</Label>
                <Input
                  type="time"
                  value={draft.trading_hours_start}
                  onChange={(e) => setDraft({ ...draft, trading_hours_start: e.target.value })}
                  disabled={!isEditing}
                  className={cn(
                    "bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2",
                    !isEditing && "opacity-60 cursor-not-allowed"
                  )}
                />
              </div>

              <div>
                <Label className="text-[#888] text-xs uppercase tracking-wider">Trading Hours End</Label>
                <Input
                  type="time"
                  value={draft.trading_hours_end}
                  onChange={(e) => setDraft({ ...draft, trading_hours_end: e.target.value })}
                  disabled={!isEditing}
                  className={cn(
                    "bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2",
                    !isEditing && "opacity-60 cursor-not-allowed"
                  )}
                />
              </div>

              <div className="col-span-2">
                <Label className="text-[#888] text-xs uppercase tracking-wider">Banned Coins</Label>
                <Input
                  value={draft.banned_coins}
                  onChange={(e) => setDraft({ ...draft, banned_coins: e.target.value.toUpperCase() })}
                  placeholder="DOGE,SHIB"
                  disabled={!isEditing}
                  className={cn(
                    "bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2",
                    !isEditing && "opacity-60 cursor-not-allowed"
                  )}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}