import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { CheckCircle, XCircle, AlertTriangle, TrendingDown, Activity, Clock, ChevronDown, ChevronUp, Shield, Zap, Target } from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { getTradesForActiveProfile, getActiveProfileId, getDataForActiveProfile } from '../components/utils/profileUtils';
import { getTodayInUserTz, getTodayOpenedTrades, getTodayClosedTrades } from '../components/utils/dateUtils';

// Risk Meter Component
const RiskMeter = ({ label, current, limit, unit = '', inverse = false, icon: Icon }) => {
  const percentage = limit > 0 ? Math.min((Math.abs(current) / limit) * 100, 100) : 0;
  const remaining = limit - Math.abs(current);
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

  const glowColors = {
    danger: 'shadow-[0_0_20px_rgba(239,68,68,0.2)]',
    warning: 'shadow-[0_0_20px_rgba(251,191,36,0.2)]',
    safe: 'shadow-[0_0_20px_rgba(16,185,129,0.2)]'
  };

  return (
    <div className={cn(
      "relative bg-gradient-to-br backdrop-blur-sm rounded-xl border p-6 transition-all",
      statusColors[status],
      glowColors[status]
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
          <span className={cn("text-3xl font-bold", textColors[status])}>
            {inverse && current >= 0 ? '+' : ''}{Math.abs(current).toFixed(current % 1 === 0 ? 0 : 2)}{unit}
          </span>
          <span className="text-[#666] text-sm">/ {limit}{unit}</span>
        </div>
      </div>

      {/* Progress bar */}
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
        <span className={cn("font-medium", remaining > 0 ? textColors[status] : 'text-red-400')}>
          {remaining > 0 ? remaining.toFixed(remaining % 1 === 0 ? 0 : 2) : 0}{unit}
        </span> remaining
      </div>
    </div>
  );
};

// Preset Badge
const PresetBadge = ({ name, description, values, isActive, onApply }) => (
  <button
    onClick={() => onApply(values)}
    className={cn(
      "relative group rounded-xl p-4 border-2 transition-all text-left",
      isActive 
        ? "bg-gradient-to-br from-violet-500/20 via-[#1a1a1a] to-transparent border-violet-500/50" 
        : "bg-[#111]/50 border-[#2a2a2a] hover:border-[#c0c0c0]/30 hover:bg-[#1a1a1a]"
    )}
  >
    <div className="flex items-center gap-2 mb-2">
      <Zap className={cn("w-4 h-4", isActive ? "text-violet-400" : "text-[#666]")} />
      <span className={cn("font-bold text-sm", isActive ? "text-violet-400" : "text-[#c0c0c0]")}>
        {name}
      </span>
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

export default function RiskManager() {
  const queryClient = useQueryClient();
  const [showViolations, setShowViolations] = useState(false);
  const [lossMode, setLossMode] = useState('percent');
  const [userTimezone, setUserTimezone] = useState('UTC');
  const [resetTime, setResetTime] = useState('00:00');

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 30 * 60 * 1000,
  });

  useEffect(() => {
    if (user?.preferred_timezone) {
      setUserTimezone(user.preferred_timezone);
    }
  }, [user]);

  const { data: trades = [] } = useQuery({
    queryKey: ['trades'],
    queryFn: () => getTradesForActiveProfile(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: riskSettings } = useQuery({
    queryKey: ['riskSettings', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const settings = await getDataForActiveProfile('RiskSettings', '-created_date', 1);
      return settings[0] || null;
    },
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000,
  });

  const { data: behaviorLogs = [] } = useQuery({
    queryKey: ['behaviorLogs', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return getDataForActiveProfile('BehaviorLog', '-date', 20);
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

  useEffect(() => {
    setResetTime('00:00');
  }, [userTimezone]);

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
      toast.success('Settings saved');
    },
  });

  // Calculate metrics - use centralized date utilities
  const today = getTodayInUserTz(userTimezone);
  const todayOpenedTrades = getTodayOpenedTrades(trades, userTimezone);
  const closedTodayTrades = getTodayClosedTrades(trades, userTimezone);

  // Daily loss = sum of all negative PNL today (in percent)
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

  // Consecutive losses
  const recentTrades = [...trades].filter(t => t.close_price).sort((a, b) => 
    new Date(b.date_close || b.date) - new Date(a.date_close || a.date)
  ).slice(0, 10);
  const consecutiveLosses = recentTrades.findIndex(t => (t.pnl_usd || 0) >= 0);
  const lossStreak = consecutiveLosses === -1 ? Math.min(recentTrades.length, formData.max_consecutive_losses) : consecutiveLosses;

  // Calculate total risk from all open trades
  const openTrades = trades.filter(t => !t.close_price);
  const totalOpenRisk = openTrades.reduce((sum, t) => {
    const riskUsd = t.risk_usd || 0;
    return sum + riskUsd;
  }, 0);
  const totalOpenRiskPercent = openTrades.reduce((sum, t) => {
    const riskPercent = t.risk_percent || 0;
    return sum + riskPercent;
  }, 0);

  // Violations
  const violations = [];
  const settings = formData;

  if (settings.daily_max_loss_percent && todayPnlPercent < -settings.daily_max_loss_percent) {
    violations.push({
      type: 'error',
      rule: 'Daily Loss Limit',
      value: `${todayPnlPercent.toFixed(2)}%`,
      limit: `${settings.daily_max_loss_percent}%`,
      date: today
    });
  }

  if (settings.daily_max_r && todayR < -settings.daily_max_r) {
    violations.push({
      type: 'error',
      rule: 'Daily R Loss',
      value: `${todayR.toFixed(2)}R`,
      limit: `${settings.daily_max_r}R`,
      date: today
    });
  }

  if (settings.max_trades_per_day && todayOpenedTrades.length >= settings.max_trades_per_day) {
    violations.push({
      type: 'error',
      rule: 'Max Trades',
      value: `${todayOpenedTrades.length}`,
      limit: `${settings.max_trades_per_day}`,
      date: today
    });
  }

  if (lossStreak >= settings.max_consecutive_losses) {
    violations.push({
      type: 'error',
      rule: 'Loss Streak',
      value: `${lossStreak} losses`,
      limit: `${settings.max_consecutive_losses}`,
      date: today
    });
  }

  const canTrade = violations.length === 0;
  const hasWarnings = todayPnlPercent < -settings.daily_max_loss_percent * 0.7 || 
                      todayOpenedTrades.length >= settings.max_trades_per_day - 1;

  // Presets
  const presets = [
    {
      name: 'Prop Firm',
      description: 'Standard prop firm rules (5% daily, 8% overall)',
      values: {
        daily_max_loss_percent: 5,
        daily_max_r: 5,
        max_trades_per_day: 10,
        max_consecutive_losses: 3,
        max_risk_per_trade_percent: 1
      }
    },
    {
      name: 'Conservative',
      description: 'Lower risk, ideal for building consistency',
      values: {
        daily_max_loss_percent: 2,
        daily_max_r: 2,
        max_trades_per_day: 3,
        max_consecutive_losses: 2,
        max_risk_per_trade_percent: 0.5
      }
    },
    {
      name: 'Aggressive',
      description: 'Higher limits for experienced traders',
      values: {
        daily_max_loss_percent: 5,
        daily_max_r: 5,
        max_trades_per_day: 15,
        max_consecutive_losses: 4,
        max_risk_per_trade_percent: 2
      }
    }
  ];

  const applyPreset = (values) => {
    setFormData({ ...formData, ...values });
  };

  const handleSave = () => {
    saveSettingsMutation.mutate(formData);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Premium Status Banner */}
      <div className={cn(
        "relative overflow-hidden rounded-2xl border-2 transition-all",
        canTrade 
          ? "bg-gradient-to-br from-emerald-500/10 via-[#1a1a1a] to-transparent border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.15)]"
          : hasWarnings
          ? "bg-gradient-to-br from-amber-500/10 via-[#1a1a1a] to-transparent border-amber-500/30 shadow-[0_0_40px_rgba(251,191,36,0.15)]"
          : "bg-gradient-to-br from-red-500/10 via-[#1a1a1a] to-transparent border-red-500/30 shadow-[0_0_40px_rgba(239,68,68,0.15)]"
      )}>
        {/* Glow effect */}
        <div className={cn(
          "absolute inset-0 opacity-20",
          canTrade ? "bg-gradient-to-r from-emerald-500/20 to-transparent" :
          hasWarnings ? "bg-gradient-to-r from-amber-500/20 to-transparent" :
          "bg-gradient-to-r from-red-500/20 to-transparent"
        )} />

        <div className="relative p-8 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className={cn(
              "w-20 h-20 rounded-2xl flex items-center justify-center backdrop-blur-xl border-2 transition-all",
              canTrade ? "bg-emerald-500/20 border-emerald-500/40" :
              hasWarnings ? "bg-amber-500/20 border-amber-500/40" :
              "bg-red-500/20 border-red-500/40"
            )}>
              {canTrade ? (
                <CheckCircle className="w-10 h-10 text-emerald-400" />
              ) : hasWarnings ? (
                <AlertTriangle className="w-10 h-10 text-amber-400" />
              ) : (
                <XCircle className="w-10 h-10 text-red-400" />
              )}
            </div>
            <div>
              <h2 className={cn(
                "text-3xl font-bold mb-1",
                canTrade ? "text-emerald-400" : hasWarnings ? "text-amber-400" : "text-red-400"
              )}>
                {canTrade ? 'Ready to Trade' : hasWarnings ? 'Caution' : 'Stop Trading'}
              </h2>
              <p className="text-[#888]">
                {canTrade 
                  ? 'All risk parameters within limits'
                  : hasWarnings
                  ? 'Approaching risk limits - trade carefully'
                  : `${violations.length} violation${violations.length > 1 ? 's' : ''} detected`
                }
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-[#666] mb-1">Daily reset</div>
            <div className="text-sm text-[#888] font-medium">{resetTime} {userTimezone.split('/')[1]}</div>
          </div>
        </div>
      </div>

      {/* Risk Meters Grid */}
      <div className="grid grid-cols-5 gap-4">
        <RiskMeter
          label="Daily Loss"
          current={lossMode === 'percent' ? Math.abs(todayPnlPercent) : Math.abs(todayPnlUsd)}
          limit={lossMode === 'percent' ? settings.daily_max_loss_percent : settings.daily_max_loss_percent * 1000}
          unit={lossMode === 'percent' ? '%' : '$'}
          icon={TrendingDown}
        />
        <RiskMeter
          label="Daily R Loss"
          current={Math.abs(Math.min(todayR, 0))}
          limit={settings.daily_max_r}
          unit="R"
          icon={Activity}
        />
        <RiskMeter
          label="Trades Today"
          current={todayOpenedTrades.length}
          limit={settings.max_trades_per_day}
          icon={Shield}
        />
        <RiskMeter
          label="Total Open Risk"
          current={totalOpenRiskPercent}
          limit={settings.max_total_open_risk_percent || 5}
          unit="%"
          icon={Target}
        />
        <RiskMeter
          label="Loss Streak"
          current={lossStreak}
          limit={settings.max_consecutive_losses}
          icon={AlertTriangle}
        />
      </div>

      {/* Violations Card */}
      {violations.length > 0 && (
        <div 
          onClick={() => setShowViolations(true)}
          className="bg-gradient-to-br from-red-500/10 via-[#1a1a1a] to-transparent rounded-xl border border-red-500/30 p-6 cursor-pointer hover:border-red-500/50 transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-red-500/20">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-red-400 font-bold text-lg">{violations.length} Active Violation{violations.length > 1 ? 's' : ''}</h3>
                <p className="text-[#888] text-sm">Click to view details</p>
              </div>
            </div>
            <ChevronDown className="w-5 h-5 text-[#666]" />
          </div>
        </div>
      )}

      {/* Settings Section */}
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl border border-[#2a2a2a] p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-violet-400" />
            <h3 className="text-[#c0c0c0] font-bold text-lg">Risk Settings</h3>
          </div>
          <Button 
            onClick={handleSave}
            disabled={saveSettingsMutation.isLoading}
            className="bg-gradient-to-r from-[#c0c0c0] to-[#a0a0a0] text-black hover:from-[#b0b0b0] hover:to-[#909090] font-bold"
          >
            {saveSettingsMutation.isLoading ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>

        {/* Presets */}
        <div className="mb-6">
          <h4 className="text-xs text-[#666] font-medium uppercase tracking-wider mb-3">Quick Presets</h4>
          <div className="grid grid-cols-3 gap-3">
            {presets.map(preset => (
              <PresetBadge
                key={preset.name}
                {...preset}
                isActive={false}
                onApply={applyPreset}
              />
            ))}
          </div>
        </div>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="bg-[#111] border border-[#2a2a2a]">
            <TabsTrigger value="basic" className="data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-[#c0c0c0] text-[#888]">Basic</TabsTrigger>
            <TabsTrigger value="advanced" className="data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-[#c0c0c0] text-[#888]">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="mt-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label className="text-[#888] text-xs uppercase tracking-wider">Daily Max Loss</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    type="number"
                    value={formData.daily_max_loss_percent}
                    onChange={(e) => setFormData({...formData, daily_max_loss_percent: parseFloat(e.target.value)})}
                    className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLossMode(lossMode === 'percent' ? 'usd' : 'percent')}
                    className="bg-[#111] border-[#2a2a2a] text-[#888] hover:text-[#c0c0c0] px-3"
                  >
                    {lossMode === 'percent' ? '%' : '$'}
                  </Button>
                </div>
                <p className="text-[#666] text-xs mt-1">Stop trading if exceeded</p>
              </div>

              <div>
                <Label className="text-[#888] text-xs uppercase tracking-wider">Daily Max R Loss</Label>
                <Input
                  type="number"
                  value={formData.daily_max_r}
                  onChange={(e) => setFormData({...formData, daily_max_r: parseFloat(e.target.value)})}
                  className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2"
                />
                <p className="text-[#666] text-xs mt-1">Maximum R loss per day</p>
              </div>

              <div>
                <Label className="text-[#888] text-xs uppercase tracking-wider">Max Trades Per Day</Label>
                <Input
                  type="number"
                  value={formData.max_trades_per_day}
                  onChange={(e) => setFormData({...formData, max_trades_per_day: parseInt(e.target.value)})}
                  className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2"
                />
                <p className="text-[#666] text-xs mt-1">Limit daily trades</p>
              </div>

              <div>
                <Label className="text-[#888] text-xs uppercase tracking-wider">Max Consecutive Losses</Label>
                <Input
                  type="number"
                  value={formData.max_consecutive_losses}
                  onChange={(e) => setFormData({...formData, max_consecutive_losses: parseInt(e.target.value)})}
                  className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2"
                />
                <p className="text-[#666] text-xs mt-1">Pause after losses</p>
              </div>

              <div>
                <Label className="text-[#888] text-xs uppercase tracking-wider">Max Risk Per Trade</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.max_risk_per_trade_percent}
                  onChange={(e) => setFormData({...formData, max_risk_per_trade_percent: parseFloat(e.target.value)})}
                  className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2"
                />
                <p className="text-[#666] text-xs mt-1">Max % risk per trade</p>
              </div>

              <div>
                <Label className="text-[#888] text-xs uppercase tracking-wider">Max Total Open Risk</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.max_total_open_risk_percent || 5}
                  onChange={(e) => setFormData({...formData, max_total_open_risk_percent: parseFloat(e.target.value)})}
                  className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2"
                />
                <p className="text-[#666] text-xs mt-1">Max combined risk % from all open trades</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="mt-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label className="text-[#888] text-xs uppercase tracking-wider">Trading Hours Start</Label>
                <Input
                  type="time"
                  value={formData.trading_hours_start}
                  onChange={(e) => setFormData({...formData, trading_hours_start: e.target.value})}
                  className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2"
                />
              </div>

              <div>
                <Label className="text-[#888] text-xs uppercase tracking-wider">Trading Hours End</Label>
                <Input
                  type="time"
                  value={formData.trading_hours_end}
                  onChange={(e) => setFormData({...formData, trading_hours_end: e.target.value})}
                  className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2"
                />
              </div>

              <div className="col-span-2">
                <Label className="text-[#888] text-xs uppercase tracking-wider">Banned Coins</Label>
                <Input
                  value={formData.banned_coins}
                  onChange={(e) => setFormData({...formData, banned_coins: e.target.value.toUpperCase()})}
                  placeholder="DOGE,SHIB (coins you should avoid)"
                  className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2"
                />
                <p className="text-[#666] text-xs mt-1">Comma-separated list of coins to avoid trading</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Violations Modal */}
      {showViolations && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setShowViolations(false)}>
          <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl p-6 w-[500px] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-6">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h3 className="text-[#c0c0c0] text-lg font-bold">Risk Violations</h3>
            </div>
            <div className="space-y-3">
              {violations.map((v, i) => (
                <div key={i} className="bg-[#111] rounded-lg border border-red-500/20 p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-red-400 font-bold text-sm">{v.rule}</span>
                    <span className="text-xs text-[#666]">{v.date}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#888]">Current: <span className="text-red-400 font-bold">{v.value}</span></span>
                    <span className="text-[#666]">Limit: {v.limit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}