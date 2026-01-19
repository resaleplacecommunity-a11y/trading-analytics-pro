import { useState, useEffect } from "react";
import { AlertTriangle, TrendingUp, CheckCircle, Edit2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const formatNumber = (num) => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

export default function TraderStrategyGeneratorEditable({ goal, trades, onStrategyUpdate }) {
  const [editing, setEditing] = useState({ tradesPerDay: false, winrate: false, rrRatio: false, riskPerTrade: false });
  const [tempValues, setTempValues] = useState({});
  const [strategy, setStrategy] = useState({
    tradesPerDay: goal?.trades_per_day || 3,
    winrate: goal?.winrate || 50,
    rrRatio: goal?.rr_ratio || 3,
    riskPerTrade: goal?.risk_per_trade || 2
  });
  const [analysis, setAnalysis] = useState(null);

  useEffect(() => {
    if (!trades) return;

    const closedTrades = trades.filter(t => t.close_price);
    const last30 = closedTrades.slice(0, 30);

    if (last30.length >= 30) {
      const totalDays = Math.max(1, Math.ceil((new Date() - new Date(last30[last30.length - 1].date_open)) / (1000 * 60 * 60 * 24)));
      const tradesPerDay = last30.length / totalDays;
      const wins = last30.filter(t => (t.pnl_usd || 0) > 0).length;
      const winrate = (wins / last30.length) * 100;
      const avgR = last30.reduce((sum, t) => sum + (t.r_multiple || 0), 0) / last30.length;
      const avgRisk = last30.reduce((sum, t) => sum + (t.risk_percent || 2), 0) / last30.length;
      const avgRR = last30.reduce((sum, t) => sum + (t.rr_ratio || 2), 0) / last30.length;

      setAnalysis({
        hasData: true,
        tradesPerDay: tradesPerDay.toFixed(1),
        winrate: winrate.toFixed(1),
        avgRisk: avgRisk.toFixed(2),
        avgRR: avgRR.toFixed(1),
        avgR: avgR.toFixed(2)
      });
    } else {
      setAnalysis({ hasData: false });
    }
  }, [trades]);

  useEffect(() => {
    setStrategy({
      tradesPerDay: goal?.trades_per_day || 3,
      winrate: goal?.winrate || 50,
      rrRatio: goal?.rr_ratio || 3,
      riskPerTrade: goal?.risk_per_trade || 2
    });
  }, [goal]);

  if (!goal) return null;

  const mode = goal.mode;
  const baseCapital = mode === 'personal' ? goal.current_capital_usd : goal.prop_account_size_usd;
  
  // Calculate expected profits: EV = risk_amount * (WR*RR - (1-WR))
  const riskAmount = baseCapital * (strategy.riskPerTrade / 100);
  const winrate = strategy.winrate / 100;
  const evPerTrade = riskAmount * (winrate * strategy.rrRatio - (1 - winrate));
  const profitPerTrade = evPerTrade;
  const profitPerDay = profitPerTrade * strategy.tradesPerDay;
  const profitPerWeek = profitPerDay * 5; // 5 trading days
  const profitPerMonth = profitPerDay * 21; // 21 trading days
  const profitPerYear = profitPerDay * 252; // 252 trading days

  const percentPerDay = (profitPerDay / baseCapital) * 100;
  const percentPerWeek = (profitPerWeek / baseCapital) * 100;
  const percentPerMonth = (profitPerMonth / baseCapital) * 100;
  const percentPerYear = (profitPerYear / baseCapital) * 100;

  const handleEdit = (field) => {
    setEditing({ ...editing, [field]: true });
    setTempValues({ ...tempValues, [field]: strategy[field] });
  };

  const handleSave = (field) => {
    const newStrategy = { ...strategy, [field]: parseFloat(tempValues[field]) || strategy[field] };
    setStrategy(newStrategy);
    setEditing({ ...editing, [field]: false });
    onStrategyUpdate?.(newStrategy);
  };

  // Check if strategy is unrealistic compared to actual trading
  const unrealistic = analysis?.hasData && (
    Math.abs(strategy.winrate - parseFloat(analysis.winrate)) > 15 ||
    Math.abs(strategy.rrRatio - parseFloat(analysis.avgRR)) > 1 ||
    Math.abs(strategy.riskPerTrade - parseFloat(analysis.avgRisk)) > 1 ||
    strategy.tradesPerDay > 10 ||
    strategy.winrate > 70
  );

  const getWarningMessage = () => {
    if (!analysis?.hasData) return null;
    const messages = [];
    if (Math.abs(strategy.winrate - parseFloat(analysis.winrate)) > 15) {
      messages.push(`Winrate differs significantly (actual: ${analysis.winrate}%)`);
    }
    if (Math.abs(strategy.rrRatio - parseFloat(analysis.avgRR)) > 1) {
      messages.push(`RR ratio differs (actual: 1:${analysis.avgRR})`);
    }
    if (Math.abs(strategy.riskPerTrade - parseFloat(analysis.avgRisk)) > 1) {
      messages.push(`Risk per trade differs (actual: ${analysis.avgRisk}%)`);
    }
    return messages.join(' • ');
  };

  return (
    <div className="bg-gradient-to-br from-blue-500/25 via-blue-500/15 to-[#0d0d0d] backdrop-blur-sm rounded-2xl border-2 border-blue-500/40 p-6 h-full flex flex-col shadow-[0_0_30px_rgba(59,130,246,0.2)]">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/30 flex items-center justify-center">
          <TrendingUp className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[#c0c0c0]">Recommended Strategy</h3>
          <p className="text-[#888] text-xs">Click values to edit and recalculate</p>
        </div>
      </div>

      {!analysis?.hasData && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4">
          <p className="text-amber-400 text-xs font-medium">
            Less than 30 trades. Showing default parameters.
          </p>
        </div>
      )}

      {/* Editable Metrics - Single Row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { key: 'tradesPerDay', label: 'Trades/Day', suffix: '' },
          { key: 'winrate', label: 'Winrate', suffix: '%' },
          { key: 'rrRatio', label: 'RR Ratio', prefix: '1:', suffix: '' },
          { key: 'riskPerTrade', label: 'Risk/Trade', suffix: '%' }
        ].map(({ key, label, prefix = '', suffix }) => (
          <div key={key} className="bg-gradient-to-br from-[#111]/80 to-[#0d0d0d] rounded-lg border border-blue-500/30 p-3 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
            <div className="text-[#666] text-xs uppercase tracking-wider mb-1">{label}</div>
            {editing[key] ? (
              <div className="flex items-center gap-1">
                {prefix && <span className="text-[#888] text-xs">{prefix}</span>}
                <Input
                  type="number"
                  value={tempValues[key]}
                  onChange={(e) => setTempValues({ ...tempValues, [key]: e.target.value })}
                  className="h-7 bg-[#0d0d0d] border-violet-500/50 text-[#c0c0c0] text-xs w-14"
                  onKeyDown={(e) => e.key === 'Enter' && handleSave(key)}
                  autoFocus
                />
                <Button
                  onClick={() => handleSave(key)}
                  size="icon"
                  className="h-7 w-7 bg-violet-500/20 hover:bg-violet-500/30"
                >
                  <Check className="w-3 h-3 text-violet-400" />
                </Button>
              </div>
            ) : (
              <button
                onClick={() => handleEdit(key)}
                className="flex items-center gap-1 hover:text-violet-400 transition-colors w-full group"
              >
                <span className="text-[#c0c0c0] text-base font-bold">
                  {prefix}{strategy[key]}{suffix}
                </span>
                <Edit2 className="w-3 h-3 text-[#666] group-hover:text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Expected Profit - Grid with borders */}
      <div className="grid grid-cols-2 gap-3 mb-auto">
        <div className="bg-gradient-to-br from-emerald-500/20 to-[#0d0d0d] rounded-lg border-2 border-emerald-500/40 p-3 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
          <div className="text-[#888] text-xs mb-1 font-medium">Per Day</div>
          <div className="text-emerald-400 text-xl font-black">${formatNumber(profitPerDay.toFixed(0))}</div>
          <div className="text-emerald-400/80 text-xs font-bold">+{percentPerDay.toFixed(1)}%</div>
        </div>
        <div className="bg-gradient-to-br from-emerald-500/20 to-[#0d0d0d] rounded-lg border-2 border-emerald-500/40 p-3 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
          <div className="text-[#888] text-xs mb-1 font-medium">Per Week</div>
          <div className="text-emerald-400 text-xl font-black">${formatNumber(profitPerWeek.toFixed(0))}</div>
          <div className="text-emerald-400/80 text-xs font-bold">+{percentPerWeek.toFixed(1)}%</div>
        </div>
        <div className="bg-gradient-to-br from-emerald-500/20 to-[#0d0d0d] rounded-lg border-2 border-emerald-500/40 p-3 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
          <div className="text-[#888] text-xs mb-1 font-medium">Per Month</div>
          <div className="text-emerald-400 text-xl font-black">${formatNumber(profitPerMonth.toFixed(0))}</div>
          <div className="text-emerald-400/80 text-xs font-bold">+{percentPerMonth.toFixed(1)}%</div>
        </div>
        <div className="bg-gradient-to-br from-emerald-500/20 to-[#0d0d0d] rounded-lg border-2 border-emerald-500/40 p-3 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
          <div className="text-[#888] text-xs mb-1 font-medium">Per Year</div>
          <div className="text-emerald-400 text-xl font-black">${formatNumber(profitPerYear.toFixed(0))}</div>
          <div className="text-emerald-400/80 text-xs font-bold">+{percentPerYear.toFixed(0)}%</div>
        </div>
      </div>

      {/* Warning */}
      {unrealistic && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mt-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-red-400 text-xs font-bold mb-1">Strategy differs from your trading</div>
              <div className="text-[#888] text-xs">{getWarningMessage()}</div>
            </div>
          </div>
        </div>
      )}

      {analysis?.hasData && !unrealistic && (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 mt-4">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <p className="text-emerald-400 text-xs font-medium">Strategy aligns with your trading</p>
        </div>
      )}
    </div>
  );
}