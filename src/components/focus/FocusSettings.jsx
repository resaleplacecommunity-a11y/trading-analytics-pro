import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Target, TrendingUp, Calculator, Calendar } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getActiveProfileId } from '../utils/profileUtils';
import { differenceInDays } from 'date-fns';

export default function FocusSettings() {
  const queryClient = useQueryClient();
  const [goalSettings, setGoalSettings] = useState({
    current_capital: 10000,
    target_capital: 20000,
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });

  const [propSettings, setPropSettings] = useState({
    account_size: 100000,
    profit_split: 80,
    challenge1_target: 10000,
    challenge1_days: 30,
    challenge2_target: 5000,
    challenge2_days: 60,
  });

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
  });

  useEffect(() => {
    if (focusSettings) {
      setGoalSettings({
        current_capital: focusSettings.current_capital_usd || 10000,
        target_capital: focusSettings.target_capital_usd || 20000,
        start_date: focusSettings.start_date || new Date().toISOString().split('T')[0],
        end_date: focusSettings.target_date || new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });
      
      if (focusSettings.mode === 'prop') {
        setPropSettings({
          account_size: focusSettings.prop_account_size_usd || 100000,
          profit_split: focusSettings.profit_split_percent || 80,
          challenge1_target: focusSettings.challenge1_target || 10000,
          challenge1_days: focusSettings.challenge1_days || 30,
          challenge2_target: focusSettings.challenge2_target || 5000,
          challenge2_days: focusSettings.challenge2_days || 60,
        });
      }
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
        is_active: true,
        mode: 'personal'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['focusSettings']);
      toast.success('Settings saved');
    },
  });

  const handleGoalChange = (field, value) => {
    const newSettings = { ...goalSettings, [field]: value };
    setGoalSettings(newSettings);
    setTimeout(() => {
      saveSettingsMutation.mutate({
        current_capital_usd: parseFloat(newSettings.current_capital) || 0,
        target_capital_usd: parseFloat(newSettings.target_capital) || 0,
        start_date: newSettings.start_date,
        target_date: newSettings.end_date,
      });
    }, 500);
  };

  const handlePropChange = (field, value) => {
    const newSettings = { ...propSettings, [field]: value };
    setPropSettings(newSettings);
    setTimeout(() => {
      saveSettingsMutation.mutate({
        mode: 'prop',
        prop_account_size_usd: parseFloat(newSettings.account_size) || 0,
        profit_split_percent: parseFloat(newSettings.profit_split) || 80,
        challenge1_target: parseFloat(newSettings.challenge1_target) || 0,
        challenge1_days: parseInt(newSettings.challenge1_days) || 0,
        challenge2_target: parseFloat(newSettings.challenge2_target) || 0,
        challenge2_days: parseInt(newSettings.challenge2_days) || 0,
      });
    }, 500);
  };

  // Calculate target breakdown
  const targetProfit = (goalSettings.target_capital || 0) - (goalSettings.current_capital || 0);
  const totalDays = goalSettings.start_date && goalSettings.end_date 
    ? Math.max(differenceInDays(new Date(goalSettings.end_date), new Date(goalSettings.start_date)), 1)
    : 1;
  const profitPerDay = targetProfit / totalDays;
  const profitPerWeek = profitPerDay * 5;
  const profitPerMonth = profitPerDay * 20;

  // Calculator logic
  const calcCapital = parseFloat(calculator.capital) || 0;
  const calcRisk = parseFloat(calculator.risk_per_trade) || 0;
  const calcWinrate = parseFloat(calculator.winrate) / 100 || 0;
  const calcRR = parseFloat(calculator.rr_ratio) || 0;
  const calcTrades = parseFloat(calculator.trades_per_day) || 0;

  const riskAmount = calcCapital * (calcRisk / 100);
  const expectancyPerTrade = (calcWinrate * (calcRR * riskAmount)) - ((1 - calcWinrate) * riskAmount);
  const estDaily = expectancyPerTrade * calcTrades;
  const estWeekly = estDaily * 5;
  const estMonthly = estDaily * 20;
  const estYearly = estDaily * 252;

  return (
    <div className="space-y-6">
      {/* Goal Settings */}
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl border border-[#2a2a2a] p-6">
        <div className="flex items-center gap-2 mb-6">
          <Target className="w-5 h-5 text-violet-400" />
          <h3 className="text-[#c0c0c0] font-bold text-lg">Goal Settings</h3>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <Label className="text-[#888] text-xs uppercase tracking-wider">Current Capital ($)</Label>
            <Input
              type="number"
              value={goalSettings.current_capital}
              onChange={(e) => handleGoalChange('current_capital', e.target.value)}
              className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2"
            />
          </div>

          <div>
            <Label className="text-[#888] text-xs uppercase tracking-wider">Target Capital ($)</Label>
            <Input
              type="number"
              value={goalSettings.target_capital}
              onChange={(e) => handleGoalChange('target_capital', e.target.value)}
              className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2"
            />
          </div>

          <div>
            <Label className="text-[#888] text-xs uppercase tracking-wider">Start Date</Label>
            <Input
              type="date"
              value={goalSettings.start_date}
              onChange={(e) => handleGoalChange('start_date', e.target.value)}
              className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2"
            />
          </div>

          <div>
            <Label className="text-[#888] text-xs uppercase tracking-wider">End Date</Label>
            <Input
              type="date"
              value={goalSettings.end_date}
              onChange={(e) => handleGoalChange('end_date', e.target.value)}
              className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2"
            />
          </div>
        </div>

        {/* Target Breakdown */}
        <div className="mt-6 pt-6 border-t border-[#2a2a2a]">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span className="text-[#888] text-sm font-medium">Required Profit (based on goal)</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#111]/50 rounded-lg border border-emerald-500/30 p-4">
              <div className="text-[#666] text-xs mb-1">Per Day</div>
              <div className="text-emerald-400 text-2xl font-bold">
                {isFinite(profitPerDay) ? `$${profitPerDay.toFixed(0)}` : '—'}
              </div>
            </div>
            <div className="bg-[#111]/50 rounded-lg border border-emerald-500/30 p-4">
              <div className="text-[#666] text-xs mb-1">Per Week</div>
              <div className="text-emerald-400 text-2xl font-bold">
                {isFinite(profitPerWeek) ? `$${profitPerWeek.toFixed(0)}` : '—'}
              </div>
            </div>
            <div className="bg-[#111]/50 rounded-lg border border-emerald-500/30 p-4">
              <div className="text-[#666] text-xs mb-1">Per Month</div>
              <div className="text-emerald-400 text-2xl font-bold">
                {isFinite(profitPerMonth) ? `$${profitPerMonth.toFixed(0)}` : '—'}
              </div>
            </div>
          </div>
          <p className="text-[#666] text-xs mt-2">* Assuming 20 trading days per month</p>
        </div>
      </div>

      {/* Prop Firm Challenges */}
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl border border-[#2a2a2a] p-6">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-5 h-5 text-blue-400" />
          <h3 className="text-[#c0c0c0] font-bold text-lg">Prop Firm Settings</h3>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <Label className="text-[#888] text-xs uppercase tracking-wider">Account Size ($)</Label>
            <Input
              type="number"
              value={propSettings.account_size}
              onChange={(e) => handlePropChange('account_size', e.target.value)}
              className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2"
            />
          </div>

          <div>
            <Label className="text-[#888] text-xs uppercase tracking-wider">Profit Split (%)</Label>
            <Input
              type="number"
              value={propSettings.profit_split}
              onChange={(e) => handlePropChange('profit_split', e.target.value)}
              className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mt-2"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-[#111]/50 rounded-lg border border-[#2a2a2a] p-4">
            <h4 className="text-[#c0c0c0] font-medium text-sm mb-4">Challenge 1</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[#888] text-xs">Profit Target ($)</Label>
                <Input
                  type="number"
                  value={propSettings.challenge1_target}
                  onChange={(e) => handlePropChange('challenge1_target', e.target.value)}
                  className="bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0] mt-1 h-9"
                />
              </div>
              <div>
                <Label className="text-[#888] text-xs">Time Limit (days)</Label>
                <Input
                  type="number"
                  value={propSettings.challenge1_days}
                  onChange={(e) => handlePropChange('challenge1_days', e.target.value)}
                  className="bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0] mt-1 h-9"
                />
              </div>
            </div>
          </div>

          <div className="bg-[#111]/50 rounded-lg border border-[#2a2a2a] p-4">
            <h4 className="text-[#c0c0c0] font-medium text-sm mb-4">Challenge 2 (Optional)</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[#888] text-xs">Profit Target ($)</Label>
                <Input
                  type="number"
                  value={propSettings.challenge2_target}
                  onChange={(e) => handlePropChange('challenge2_target', e.target.value)}
                  className="bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0] mt-1 h-9"
                />
              </div>
              <div>
                <Label className="text-[#888] text-xs">Time Limit (days)</Label>
                <Input
                  type="number"
                  value={propSettings.challenge2_days}
                  onChange={(e) => handlePropChange('challenge2_days', e.target.value)}
                  className="bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0] mt-1 h-9"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Earnings Calculator */}
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl border border-[#2a2a2a] p-6">
        <div className="flex items-center gap-2 mb-6">
          <Calculator className="w-5 h-5 text-cyan-400" />
          <h3 className="text-[#c0c0c0] font-bold text-lg">Earnings Calculator</h3>
        </div>

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

        {/* Outputs */}
        <div className="pt-6 border-t border-[#2a2a2a]">
          <div className="text-[#888] text-sm font-medium mb-4">Estimated Profit</div>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-cyan-500/20 to-[#0d0d0d] rounded-lg border border-cyan-500/30 p-4">
              <div className="text-[#666] text-xs mb-1">Per Day</div>
              <div className="text-cyan-400 text-xl font-bold">
                ${isFinite(estDaily) ? Math.max(estDaily, 0).toFixed(0) : '0'}
              </div>
            </div>
            <div className="bg-gradient-to-br from-cyan-500/20 to-[#0d0d0d] rounded-lg border border-cyan-500/30 p-4">
              <div className="text-[#666] text-xs mb-1">Per Week</div>
              <div className="text-cyan-400 text-xl font-bold">
                ${isFinite(estWeekly) ? Math.max(estWeekly, 0).toFixed(0) : '0'}
              </div>
            </div>
            <div className="bg-gradient-to-br from-cyan-500/20 to-[#0d0d0d] rounded-lg border border-cyan-500/30 p-4">
              <div className="text-[#666] text-xs mb-1">Per Month</div>
              <div className="text-cyan-400 text-xl font-bold">
                ${isFinite(estMonthly) ? Math.max(estMonthly, 0).toFixed(0) : '0'}
              </div>
            </div>
            <div className="bg-gradient-to-br from-cyan-500/20 to-[#0d0d0d] rounded-lg border border-cyan-500/30 p-4">
              <div className="text-[#666] text-xs mb-1">Per Year</div>
              <div className="text-cyan-400 text-xl font-bold">
                ${isFinite(estYearly) ? Math.max(estYearly, 0).toFixed(0) : '0'}
              </div>
            </div>
          </div>
          <p className="text-[#666] text-xs mt-4">
            * Estimates only. Real results may vary. Assuming 20 trading days/month, 252 trading days/year.
          </p>
        </div>
      </div>
    </div>
  );
}