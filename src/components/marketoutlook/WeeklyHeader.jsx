import { TrendingUp, Target, Calendar, CheckCircle, TrendingDown, Minus, Bitcoin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function WeeklyHeader({ currentWeek, weeklyOutlooks, weekLabel, isCurrentWeek, onUpdateWeek }) {
  const [isEditingBias, setIsEditingBias] = useState(false);
  const [isEditingBtcLevel, setIsEditingBtcLevel] = useState(false);
  const [tempBtcLevel, setTempBtcLevel] = useState('');
  // Calculate completion based on filled fields (>20% required for complete)
  const calculateCurrentWeekCompletion = () => {
    if (!currentWeek) return 0;
    const fields = [
      'btc_analysis', 'overall_trend', 'news_events', 'expectations_week', 
      'expectations_month', 'key_levels', 'setups_to_trade', 'risk_plan'
    ];
    const filledFields = fields.filter(field => currentWeek[field] && currentWeek[field].length > 0).length;
    return (filledFields / fields.length) * 100;
  };

  const currentWeekCompletion = calculateCurrentWeekCompletion();
  const isCurrentWeekComplete = currentWeekCompletion > 20;
  
  const completedWeeks = weeklyOutlooks.filter(w => w.status === 'completed').length;
  const totalWeeks = weeklyOutlooks.length;
  const completionRate = totalWeeks > 0 ? (completedWeeks / totalWeeks) * 100 : 0;

  const trend = currentWeek?.overall_trend || 'Range';
  const trendColors = {
    Bull: { bg: 'from-emerald-500/20 via-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', icon: TrendingUp },
    Bear: { bg: 'from-red-500/20 via-red-500/10', border: 'border-red-500/30', text: 'text-red-400', icon: TrendingUp },
    Range: { bg: 'from-amber-500/20 via-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', icon: Target }
  };

  const { bg, border, text, icon: Icon } = trendColors[trend];

  return (
    <div className={cn("relative overflow-hidden bg-gradient-to-br", bg, "to-[#0d0d0d] backdrop-blur-sm rounded-2xl border-2", border, "p-8")}>
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-radial from-white/5 to-transparent blur-3xl" />
      
      <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Week Status */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Calendar className={cn("w-5 h-5", text)} />
            <span className="text-[#888] text-sm font-medium uppercase tracking-wider">Current Week</span>
          </div>
          <div className="text-2xl font-bold text-[#c0c0c0] mb-2">{weekLabel}</div>
          <div className="flex items-center gap-2">
            {isCurrentWeek && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-violet-500/20 text-violet-400 rounded-full text-xs font-medium">
                <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
                Active
              </span>
            )}
            {isCurrentWeekComplete ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-medium">
                <CheckCircle className="w-3 h-3" />
                Complete
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium">
                {currentWeekCompletion.toFixed(0)}% filled
              </span>
            )}
          </div>
        </div>

        {/* Market Bias - Interactive */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Icon className={cn("w-5 h-5", text)} />
            <span className="text-[#888] text-sm font-medium uppercase tracking-wider">Market Bias</span>
          </div>
          
          {!isEditingBias ? (
            <button
              onClick={() => setIsEditingBias(true)}
              className="text-left group cursor-pointer"
            >
              <div className={cn("text-3xl font-bold mb-1", text)}>{trend}</div>
              <div className="text-sm text-[#888]">
                {currentWeek?.trend_timeframe || '1D'} timeframe
              </div>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <Select 
                value={trend} 
                onValueChange={(value) => {
                  onUpdateWeek({ overall_trend: value });
                  if (value && currentWeek?.trend_timeframe) {
                    setIsEditingBias(false);
                  }
                }}
              >
                <SelectTrigger className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] w-32 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bull">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <span>Bull</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="Bear">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-red-400" />
                      <span>Bear</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="Range">
                    <div className="flex items-center gap-2">
                      <Minus className="w-4 h-4 text-amber-400" />
                      <span>Range</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select 
                value={currentWeek?.trend_timeframe || '1D'} 
                onValueChange={(value) => {
                  onUpdateWeek({ trend_timeframe: value });
                  if (value && currentWeek?.overall_trend) {
                    setIsEditingBias(false);
                  }
                }}
              >
                <SelectTrigger className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] w-24 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1H">1 Hour</SelectItem>
                  <SelectItem value="4H">4 Hours</SelectItem>
                  <SelectItem value="1D">1 Day</SelectItem>
                  <SelectItem value="1W">1 Week</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* BTC Key Level */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Bitcoin className="w-5 h-5 text-amber-400" />
            <span className="text-[#888] text-sm font-medium uppercase tracking-wider">BTC Key Level</span>
          </div>
          
          {!isEditingBtcLevel ? (
            <button
              onClick={() => {
                setIsEditingBtcLevel(true);
                setTempBtcLevel(currentWeek?.btc_key_level || '');
              }}
              className="text-left group cursor-pointer"
            >
              <div className="text-3xl font-bold mb-1 text-amber-400">
                {currentWeek?.btc_key_level 
                  ? `$${currentWeek.btc_key_level.toLocaleString()}` 
                  : '$???'
                }
              </div>
              <div className="text-sm text-[#888]">
                {currentWeek?.btc_key_level ? 'Click to edit' : 'Set price level'}
              </div>
            </button>
          ) : (
            <div className="space-y-2">
              <Input
                type="number"
                placeholder="Enter BTC price"
                value={tempBtcLevel}
                onChange={(e) => setTempBtcLevel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onUpdateWeek({ btc_key_level: tempBtcLevel ? Number(tempBtcLevel) : null });
                    setIsEditingBtcLevel(false);
                  } else if (e.key === 'Escape') {
                    setIsEditingBtcLevel(false);
                  }
                }}
                className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] h-10"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    onUpdateWeek({ btc_key_level: tempBtcLevel ? Number(tempBtcLevel) : null });
                    setIsEditingBtcLevel(false);
                  }}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white h-8"
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditingBtcLevel(false)}
                  className="bg-[#111] border-[#2a2a2a] h-8"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}