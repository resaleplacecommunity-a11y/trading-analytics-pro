import { TrendingUp, TrendingDown, Target, Zap, Award, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SimulatorStats({ simulation }) {
  const isProfitable = simulation.total_pnl > 0;
  
  const stats = [
    {
      label: 'Total P&L',
      value: `$${simulation.total_pnl.toLocaleString()}`,
      subValue: `${simulation.total_pnl_percent.toFixed(2)}%`,
      icon: isProfitable ? TrendingUp : TrendingDown,
      color: isProfitable ? 'emerald' : 'red'
    },
    {
      label: 'Final Capital',
      value: `$${simulation.final_capital.toLocaleString()}`,
      subValue: `from $${simulation.initial_capital.toLocaleString()}`,
      icon: Target,
      color: 'violet'
    },
    {
      label: 'Total Trades',
      value: simulation.total_trades,
      subValue: `${simulation.trades_per_day} per day`,
      icon: Zap,
      color: 'amber'
    },
    {
      label: 'Max Drawdown',
      value: `${simulation.max_drawdown.toFixed(2)}%`,
      subValue: simulation.max_drawdown > 20 ? 'High risk' : 'Acceptable',
      icon: AlertTriangle,
      color: simulation.max_drawdown > 20 ? 'red' : 'emerald'
    },
    {
      label: 'Sharpe Ratio',
      value: simulation.sharpe_ratio.toFixed(2),
      subValue: simulation.sharpe_ratio > 1 ? 'Good' : 'Poor',
      icon: Award,
      color: simulation.sharpe_ratio > 1 ? 'emerald' : 'amber'
    }
  ];

  const colorClasses = {
    emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 text-emerald-400',
    red: 'from-red-500/20 to-red-500/5 border-red-500/30 text-red-400',
    violet: 'from-violet-500/20 to-violet-500/5 border-violet-500/30 text-violet-400',
    amber: 'from-amber-500/20 to-amber-500/5 border-amber-500/30 text-amber-400'
  };

  return (
    <div className="space-y-6">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat, idx) => (
          <div
            key={idx}
            className={cn(
              "bg-gradient-to-br backdrop-blur-sm rounded-xl border-2 p-4",
              colorClasses[stat.color]
            )}
          >
            <div className="flex items-center gap-2 mb-3">
              <stat.icon className="w-4 h-4" />
              <span className="text-[#888] text-xs uppercase tracking-wider">{stat.label}</span>
            </div>
            <div className="text-2xl font-bold mb-1">{stat.value}</div>
            <div className="text-[#666] text-xs">{stat.subValue}</div>
          </div>
        ))}
      </div>

      {/* Strategy Parameters */}
      <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-2xl border-2 border-[#2a2a2a] p-6">
        <h3 className="text-lg font-bold text-[#c0c0c0] mb-4">Strategy Parameters</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <div className="text-[#888] text-xs uppercase tracking-wider mb-1">Win Rate</div>
            <div className="text-[#c0c0c0] text-xl font-bold">{simulation.winrate}%</div>
          </div>
          <div>
            <div className="text-[#888] text-xs uppercase tracking-wider mb-1">Avg R:R</div>
            <div className="text-[#c0c0c0] text-xl font-bold">{simulation.avg_rr}</div>
          </div>
          <div>
            <div className="text-[#888] text-xs uppercase tracking-wider mb-1">Risk/Trade</div>
            <div className="text-[#c0c0c0] text-xl font-bold">{simulation.risk_per_trade}%</div>
          </div>
          <div>
            <div className="text-[#888] text-xs uppercase tracking-wider mb-1">Period</div>
            <div className="text-[#c0c0c0] text-xl font-bold">{simulation.simulation_days}d</div>
          </div>
        </div>
      </div>
    </div>
  );
}