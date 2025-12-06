import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save, AlertTriangle } from 'lucide-react';

export default function RiskSettingsForm({ settings, onSave }) {
  const [formData, setFormData] = useState({
    daily_max_loss_percent: 3,
    daily_max_r: 3,
    max_trades_per_day: 5,
    trading_hours_start: '09:00',
    trading_hours_end: '22:00',
    allowed_coins: 'BTC,ETH,SOL',
    emotions_threshold: 5,
    confidence_threshold: 5,
    auto_warning_enabled: true,
    max_consecutive_losses: 3,
    ...settings
  });

  const handleSubmit = () => {
    onSave(formData);
  };

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-6 border border-[#2a2a2a]">
      <div className="flex items-center gap-2 mb-6">
        <AlertTriangle className="w-5 h-5 text-amber-400" />
        <h3 className="text-[#c0c0c0] font-semibold">Risk Management Settings</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label className="text-[#888]">Daily Max Loss %</Label>
          <Input 
            type="number"
            value={formData.daily_max_loss_percent}
            onChange={(e) => setFormData({...formData, daily_max_loss_percent: parseFloat(e.target.value)})}
            className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] mt-1"
          />
          <p className="text-[#666] text-xs mt-1">Stop trading if daily loss exceeds this %</p>
        </div>

        <div>
          <Label className="text-[#888]">Daily Max R Loss</Label>
          <Input 
            type="number"
            value={formData.daily_max_r}
            onChange={(e) => setFormData({...formData, daily_max_r: parseFloat(e.target.value)})}
            className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] mt-1"
          />
          <p className="text-[#666] text-xs mt-1">Stop trading if daily R loss exceeds this</p>
        </div>

        <div>
          <Label className="text-[#888]">Max Trades Per Day</Label>
          <Input 
            type="number"
            value={formData.max_trades_per_day}
            onChange={(e) => setFormData({...formData, max_trades_per_day: parseInt(e.target.value)})}
            className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] mt-1"
          />
        </div>

        <div>
          <Label className="text-[#888]">Max Consecutive Losses</Label>
          <Input 
            type="number"
            value={formData.max_consecutive_losses}
            onChange={(e) => setFormData({...formData, max_consecutive_losses: parseInt(e.target.value)})}
            className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] mt-1"
          />
          <p className="text-[#666] text-xs mt-1">Pause after this many losses in a row</p>
        </div>

        <div>
          <Label className="text-[#888]">Trading Hours Start</Label>
          <Input 
            type="time"
            value={formData.trading_hours_start}
            onChange={(e) => setFormData({...formData, trading_hours_start: e.target.value})}
            className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] mt-1"
          />
        </div>

        <div>
          <Label className="text-[#888]">Trading Hours End</Label>
          <Input 
            type="time"
            value={formData.trading_hours_end}
            onChange={(e) => setFormData({...formData, trading_hours_end: e.target.value})}
            className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] mt-1"
          />
        </div>

        <div className="md:col-span-2">
          <Label className="text-[#888]">Allowed Coins (comma-separated)</Label>
          <Input 
            value={formData.allowed_coins}
            onChange={(e) => setFormData({...formData, allowed_coins: e.target.value.toUpperCase()})}
            placeholder="BTC,ETH,SOL,AVAX"
            className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] mt-1"
          />
        </div>

        <div>
          <Label className="text-[#888]">Min Emotional State to Trade</Label>
          <Input 
            type="number"
            min="1"
            max="10"
            value={formData.emotions_threshold}
            onChange={(e) => setFormData({...formData, emotions_threshold: parseInt(e.target.value)})}
            className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] mt-1"
          />
        </div>

        <div>
          <Label className="text-[#888]">Min Confidence to Trade</Label>
          <Input 
            type="number"
            min="1"
            max="10"
            value={formData.confidence_threshold}
            onChange={(e) => setFormData({...formData, confidence_threshold: parseInt(e.target.value)})}
            className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] mt-1"
          />
        </div>

        <div className="md:col-span-2 flex items-center justify-between bg-[#151515] rounded-lg p-4">
          <div>
            <Label className="text-[#c0c0c0]">Auto Warning System</Label>
            <p className="text-[#666] text-xs">Show warnings when risk limits are approached</p>
          </div>
          <Switch 
            checked={formData.auto_warning_enabled}
            onCheckedChange={(v) => setFormData({...formData, auto_warning_enabled: v})}
          />
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <Button onClick={handleSubmit} className="bg-[#c0c0c0] text-black hover:bg-[#a0a0a0]">
          <Save className="w-4 h-4 mr-2" />
          Save Settings
        </Button>
      </div>
    </div>
  );
}