import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Target, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export default function GoalSetup({ goal, onSave }) {
  const [mode, setMode] = useState(goal?.mode || 'personal');
  const [data, setData] = useState({
    current_capital_usd: goal?.current_capital_usd || '',
    target_capital_usd: goal?.target_capital_usd || '',
    prop_account_size_usd: goal?.prop_account_size_usd || '',
    prop_fee_usd: goal?.prop_fee_usd || '',
    profit_split_percent: goal?.profit_split_percent || 80,
    time_horizon_days: goal?.time_horizon_days || '',
    target_date: goal?.target_date || ''
  });

  const handleSave = () => {
    // Validate required fields
    if (mode === 'personal') {
      if (!data.current_capital_usd || !data.target_capital_usd) {
        return;
      }
    } else {
      if (!data.prop_account_size_usd || !data.target_capital_usd) {
        return;
      }
    }
    
    if (!data.time_horizon_days && !data.target_date) {
      return;
    }
    
    onSave({ mode, ...data, is_active: true });
  };

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-2xl border-2 border-[#2a2a2a] p-6">
      <div className="flex items-center gap-2 mb-6">
        <Target className="w-5 h-5 text-violet-400" />
        <h3 className="text-lg font-bold text-[#c0c0c0]">Set Your Goal</h3>
      </div>

      {/* Mode Selection */}
      <div className="mb-6">
        <Label className="text-[#888] text-xs uppercase tracking-wider mb-3">Mode</Label>
        <div className="flex gap-3">
          {['personal', 'prop'].map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "flex-1 py-4 px-6 rounded-lg border-2 transition-all",
                mode === m
                  ? "bg-violet-500/20 border-violet-500/50 text-violet-400"
                  : "bg-[#111] border-[#2a2a2a] text-[#666] hover:border-[#3a3a3a]"
              )}
            >
              <div className="font-bold text-sm uppercase">{m === 'personal' ? 'Personal Capital' : 'Prop Firm'}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Personal Mode */}
      {mode === 'personal' && (
        <div className="space-y-4">
          <div>
            <Label className="text-[#888] text-xs uppercase tracking-wider mb-2">Current Capital ($)</Label>
            <Input
              type="number"
              value={data.current_capital_usd}
              onChange={(e) => setData({ ...data, current_capital_usd: Number(e.target.value) })}
              placeholder="10000"
              className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
            />
          </div>
          <div>
            <Label className="text-[#888] text-xs uppercase tracking-wider mb-2">Target Capital ($)</Label>
            <Input
              type="number"
              value={data.target_capital_usd}
              onChange={(e) => setData({ ...data, target_capital_usd: Number(e.target.value) })}
              placeholder="50000"
              className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
            />
          </div>
        </div>
      )}

      {/* Prop Mode */}
      {mode === 'prop' && (
        <div className="space-y-4">
          <div>
            <Label className="text-[#888] text-xs uppercase tracking-wider mb-2">Account Size ($)</Label>
            <Input
              type="number"
              value={data.prop_account_size_usd}
              onChange={(e) => setData({ ...data, prop_account_size_usd: Number(e.target.value) })}
              placeholder="100000"
              className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
            />
          </div>
          <div>
            <Label className="text-[#888] text-xs uppercase tracking-wider mb-2">Prop Fee ($)</Label>
            <Input
              type="number"
              value={data.prop_fee_usd}
              onChange={(e) => setData({ ...data, prop_fee_usd: Number(e.target.value) })}
              placeholder="300"
              className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
            />
          </div>
          <div>
            <Label className="text-[#888] text-xs uppercase tracking-wider mb-2">Profit Split (%)</Label>
            <Input
              type="number"
              value={data.profit_split_percent}
              onChange={(e) => setData({ ...data, profit_split_percent: Number(e.target.value) })}
              placeholder="80"
              className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
            />
          </div>
          <div>
            <Label className="text-[#888] text-xs uppercase tracking-wider mb-2">Target Earnings ($)</Label>
            <Input
              type="number"
              value={data.target_capital_usd}
              onChange={(e) => setData({ ...data, target_capital_usd: Number(e.target.value) })}
              placeholder="10000"
              className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
            />
          </div>
        </div>
      )}

      {/* Time Horizon */}
      <div className="mt-6 space-y-4">
        <div>
          <Label className="text-[#888] text-xs uppercase tracking-wider mb-2">Time Horizon (days)</Label>
          <Input
            type="number"
            value={data.time_horizon_days}
            onChange={(e) => setData({ ...data, time_horizon_days: Number(e.target.value) })}
            placeholder="180"
            className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
          />
        </div>
        <div className="text-center text-[#666] text-sm">or</div>
        <div>
          <Label className="text-[#888] text-xs uppercase tracking-wider mb-2">Target Date</Label>
          <Input
            type="date"
            value={data.target_date}
            onChange={(e) => setData({ ...data, target_date: e.target.value })}
            className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
          />
        </div>
      </div>

      <Button
        onClick={handleSave}
        className="w-full mt-6 bg-gradient-to-r from-violet-500 to-violet-600 text-white hover:from-violet-600 hover:to-violet-700"
      >
        <TrendingUp className="w-4 h-4 mr-2" />
        Calculate & Save Goal
      </Button>
    </div>
  );
}