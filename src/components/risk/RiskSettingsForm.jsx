import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, AlertTriangle, TrendingDown, Activity, Shield, Target, Zap } from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getTradesForActiveProfile, getActiveProfileId } from '../utils/profileUtils';
import { getTodayInUserTz, getTodayOpenedTrades, getTodayClosedTrades } from '../utils/dateUtils';

const RiskMeter = ({ label, current, limit, unit = '', icon: Icon }) => {
  // Robust handling: NaN/Infinity → 0
  const safeCurrent = isFinite(current) ? current : 0;
  const safeLimit = isFinite(limit) && limit > 0 ? limit : 1;
  
  // Clamp percentage to 0-100%
  const percentage = Math.min(Math.max((Math.abs(safeCurrent) / safeLimit) * 100, 0), 100);
  const remaining = Math.max(safeLimit - Math.abs(safeCurrent), 0);
  const status = percentage >= 90 ? 'danger' : percentage >= 70 ? 'warning' : 'safe';
  
  const statusColors = {
    danger: 'from-red-500/20 via-red-500/10 to-transparent border-red-500/40',
    warning: 'from-amber-500/20 via-amber-500/10 to-transparent border-amber-500/40',
    safe: 'from-emerald-500/20 via-emerald-500/10 to-transparent border-emerald-500/40'
  };

  const textColors = {
    danger: 'text-red-400',
    warning: 'text-amber-400',
    safe: 'text-emerald-400'
  };

  return (
    <div className={cn(
      "relative bg-gradient-to-br backdrop-blur-sm rounded-xl border p-6",
      statusColors[status]
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={cn("w-4 h-4", textColors[status])} />}
          <span className="text-xs text-[#888] font-medium uppercase tracking-wider">{label}</span>
        </div>
        <div className={cn("text-xs font-bold", textColors[status])}>
          {percentage.toFixed(0)}%
        </div>
      </div>

      <div className="mb-3">
        <div className="flex items-baseline gap-2 mb-1">
          <span className={cn("text-3xl font-bold truncate max-w-[120px]", textColors[status])} title={`${Math.abs(safeCurrent).toLocaleString('en-US', { maximumFractionDigits: 2 })}${unit}`}>
            {isFinite(safeCurrent) ? new Intl.NumberFormat('en-US', { 
              maximumFractionDigits: safeCurrent >= 1000 ? 0 : 2,
              notation: safeCurrent >= 100000 ? 'compact' : 'standard'
            }).format(Math.abs(safeCurrent)) : '—'}{unit}
          </span>
          <span className="text-[#666] text-sm truncate">/ {isFinite(safeLimit) ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(safeLimit) : '—'}{unit}</span>
        </div>
      </div>

      <div className="relative h-2 bg-[#111]/50 rounded-full overflow-hidden mb-2">
        <div 
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
            status === 'danger' ? 'bg-gradient-to-r from-red-500 to-red-400' :
            status === 'warning' ? 'bg-gradient-to-r from-amber-500 to-amber-400' :
            'bg-gradient-to-r from-emerald-500 to-emerald-400'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="text-xs text-[#666]">
        <span className={cn("font-medium", textColors[status])}>
          {isFinite(remaining) ? new Intl.NumberFormat('en-US', {
            maximumFractionDigits: remaining >= 10 ? 0 : 2
          }).format(remaining) : '—'}{unit}
        </span> remaining
      </div>
    </div>
  );
};

const PresetBadge = ({ name, description, values, onApply }) => (
  <button
    onClick={() => onApply(values)}
    className="rounded-xl p-4 border-2 bg-[#111]/50 border-[#2a2a2a] hover:border-[#c0c0c0]/30 hover:bg-[#1a1a1a] transition-all text-left"
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

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 30 * 60 * 1000,
  });

  const userTimezone = user?.preferred_timezone || 'UTC';

  const { data: trades = [] } = useQuery({
    queryKey: ['trades', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return getTradesForActiveProfile();
    },
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000,
  });

  const { data: riskSettings } = useQuery({
    queryKey: ['riskSettings', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const settings = await base44.entities.RiskSettings.filter({ 
        created_by: user.email 
      }, '-created_date', 1);
      return settings[0] || null;
    },
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000,
  });

  const [formData, setFormData] = useState({
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

  useEffect(() => {
    if (riskSettings) {
      setFormData({
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
  }, [riskSettings]);

  const saveSettingsMutation = useMutation({
    mutationFn: async (data) => {
      const profileId = await getActiveProfileId();
      if (riskSettings?.id) {
        return base44.entities.RiskSettings.update(riskSettings.id, { ...data, profile_id: profileId });
      } else {
        return base44.entities.RiskSettings.create({ ...data, profile_id: profileId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['riskSettings']);
      toast.success('Risk settings saved');
    },
  });

  const handleFormChange = (updates) => {
    const newData = { ...formData, ...updates };
    setFormData(newData);
    // Auto-save after change
    const timeoutId = setTimeout(() => {
      saveSettingsMutation.mutate(newData);
    }, 500);
    return () => clearTimeout(timeoutId);
  };

  const todayOpenedTrades = getTodayOpenedTrades(trades, userTimezone);
  const closedTodayTrades = getTodayClosedTrades(trades, userTimezone);

  const todayPnlPercent = closedTodayTrades.reduce((s, t) => {
    const pnl = t.pnl_usd || 0;
    if (pnl < 0) {
      const balance = t.account_balance_at_entry || 100000;
      return s + ((pnl / balance) * 100);
    }
    return s;
  }, 0);

  const todayPnlUsd = closedTodayTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
  const todayR = closedTodayTrades.reduce((s, t) => s + (t.r_multiple || 0), 0);

  const recentTrades = [...trades].filter(t => t.close_price).sort((a, b) => 
    new Date(b.date_close || b.date) - new Date(a.date_close || a.date)
  ).slice(0, 10);
  const consecutiveLosses = recentTrades.findIndex(t => (t.pnl_usd || 0) >= 0);
  const lossStreak = consecutiveLosses === -1 ? Math.min(recentTrades.length, formData.max_consecutive_losses) : consecutiveLosses;

  const openTrades = trades.filter(t => !t.close_price);
  const totalOpenRiskPercent = openTrades.reduce((sum, t) => sum + (t.risk_percent || 0), 0);

  const violations = [];
  if (formData.daily_max_loss_percent && todayPnlPercent < -formData.daily_max_loss_percent) {
    violations.push({ rule: 'Daily Loss Limit', value: `${todayPnlPercent.toFixed(2)}%`, limit: `${formData.daily_max_loss_percent}%` });
  }
  if (formData.daily_max_r && todayR < -formData.daily_max_r) {
    violations.push({ rule: 'Daily R Loss', value: `${todayR.toFixed(2)}R`, limit: `${formData.daily_max_r}R` });
  }
  if (formData.max_trades_per_day && todayOpenedTrades.length >= formData.max_trades_per_day) {
    violations.push({ rule: 'Max Trades', value: `${todayOpenedTrades.length}`, limit: `${formData.max_trades_per_day}` });
  }
  if (lossStreak >= formData.max_consecutive_losses) {
    violations.push({ rule: 'Loss Streak', value: `${lossStreak} losses`, limit: `${formData.max_consecutive_losses}` });
  }

  const canTrade = violations.length === 0;

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

  const applyPreset = (values) => {
    const newData = { ...formData, ...values };
    setFormData(newData);
    saveSettingsMutation.mutate(newData);
  };

  return (
    <div className="space-y-6">
      {/* Settings Form */}
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl border border-[#2a2a2a] p-6">
        <div className="flex items-center gap-2 mb-6">
          <Shield className="w-5 h-5 text-violet-400" />
          <h3 className="text-[#c0c0c0] font-bold text-lg">Risk Settings</h3>
        </div>

        {/* Presets */}
        <div className="mb-6">
          <h4 className="text-xs text-[#666] font-medium uppercase tracking-wider mb-3">Quick Presets</h4>
          <div className="grid grid-cols-3 gap-3">
            {presets.map(preset => (
              <PresetBadge key={preset.name} {...preset} onApply={applyPreset} />
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
                  value={formData.daily_max_loss_percent}
                  onChange={(e) => handleFormChange({ daily_max_loss_percent: parseFloat(e.target.value) || 0 })}
                  className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2"
                />
              </div>

              <div>
                <Label className="text-[#888] text-xs uppercase tracking-wider">Daily Max R Loss (R)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.daily_max_r}
                  onChange={(e) => handleFormChange({ daily_max_r: parseFloat(e.target.value) || 0 })}
                  className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2"
                />
              </div>

              <div>
                <Label className="text-[#888] text-xs uppercase tracking-wider">Max Trades Per Day</Label>
                <Input
                  type="number"
                  value={formData.max_trades_per_day}
                  onChange={(e) => handleFormChange({ max_trades_per_day: parseInt(e.target.value) || 0 })}
                  className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2"
                />
              </div>

              <div>
                <Label className="text-[#888] text-xs uppercase tracking-wider">Loss Streak</Label>
                <Input
                  type="number"
                  value={formData.max_consecutive_losses}
                  onChange={(e) => handleFormChange({ max_consecutive_losses: parseInt(e.target.value) || 0 })}
                  className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2"
                />
              </div>

              <div>
                <Label className="text-[#888] text-xs uppercase tracking-wider">Max Risk Per Trade (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.max_risk_per_trade_percent}
                  onChange={(e) => handleFormChange({ max_risk_per_trade_percent: parseFloat(e.target.value) || 0 })}
                  className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2"
                />
              </div>

              <div>
                <Label className="text-[#888] text-xs uppercase tracking-wider">Max Total Open Risk (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.max_total_open_risk_percent || 5}
                  onChange={(e) => handleFormChange({ max_total_open_risk_percent: parseFloat(e.target.value) || 0 })}
                  className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="mt-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label className="text-[#888] text-xs uppercase tracking-wider">Trading Hours Start</Label>
                <Input
                  type="time"
                  value={formData.trading_hours_start}
                  onChange={(e) => handleFormChange({ trading_hours_start: e.target.value })}
                  className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2"
                />
              </div>

              <div>
                <Label className="text-[#888] text-xs uppercase tracking-wider">Trading Hours End</Label>
                <Input
                  type="time"
                  value={formData.trading_hours_end}
                  onChange={(e) => handleFormChange({ trading_hours_end: e.target.value })}
                  className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2"
                />
              </div>

              <div className="col-span-2">
                <Label className="text-[#888] text-xs uppercase tracking-wider">Banned Coins</Label>
                <Input
                  value={formData.banned_coins}
                  onChange={(e) => handleFormChange({ banned_coins: e.target.value.toUpperCase() })}
                  placeholder="DOGE,SHIB"
                  className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}