import { TrendingUp, TrendingDown, Target, Zap, DollarSign, Activity, BarChart3, Shield } from 'lucide-react';
import { formatNumber, formatDecimal, formatPercent } from './analyticsCalculations';
import { cn } from "@/lib/utils";
import { LineChart, Line, ResponsiveContainer } from 'recharts';

const KPICard = ({ icon: Icon, label, value, subtext, trend, color = "text-[#c0c0c0]", tooltip, sparklineData }) => (
  <div className="group relative backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-4 hover:border-[#c0c0c0]/30 transition-all duration-300 hover:shadow-[0_0_20px_rgba(192,192,192,0.1)] cursor-pointer">
    {/* Premium glow effect */}
    <div className="absolute inset-0 bg-gradient-to-r from-[#c0c0c0]/3 via-transparent to-[#888]/3 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    
    <div className="relative z-10">
      <div className="flex items-start justify-between mb-3">
        <div className={cn("p-2 rounded-lg bg-[#111]/50", 
          color === "text-emerald-400" && "bg-emerald-500/10",
          color === "text-red-400" && "bg-red-500/10",
          color === "text-violet-400" && "bg-violet-500/10"
        )}>
          <Icon className={cn("w-4 h-4", color)} />
        </div>
        {tooltip && (
          <button className="text-xs text-[#666] hover:text-[#888] transition-colors">
            ?
          </button>
        )}
      </div>
      
      <div className="text-xs text-[#666] uppercase tracking-wider mb-2 font-mono">{label}</div>
      <div className={cn("text-2xl font-bold mb-1 font-mono tabular-nums", color)}>{value}</div>
      {subtext && <div className="text-xs text-[#888] font-mono">{subtext}</div>}
      
      {sparklineData && sparklineData.length > 0 && (
        <div className="mt-2 h-8">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparklineData}>
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={color.includes('emerald') ? '#10b981' : color.includes('red') ? '#ef4444' : '#c0c0c0'}
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      
      {trend !== undefined && !sparklineData && (
        <div className={cn(
          "mt-2 text-xs flex items-center gap-1 font-mono",
          trend >= 0 ? "text-emerald-400" : "text-red-400"
        )}>
          {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {Math.abs(trend).toFixed(1)}%
        </div>
      )}
    </div>
  </div>
);

export default function CommandKPIs({ metrics, onClick, sparklines }) {
  const kpis = [
    {
      icon: DollarSign,
      label: 'Net PNL',
      value: metrics.netPnlUsd >= 0 ? `+$${formatNumber(metrics.netPnlUsd)}` : `-$${formatNumber(Math.abs(metrics.netPnlUsd))}`,
      subtext: formatPercent(metrics.netPnlPercent),
      color: metrics.netPnlUsd >= 0 ? "text-emerald-400" : "text-red-400",
      tooltip: "Total profit/loss for selected period",
      sparklineData: sparklines?.netPnl
    },
    {
      icon: Target,
      label: 'Winrate',
      value: `${metrics.winrate.toFixed(1)}%`,
      subtext: `${metrics.wins}W / ${metrics.losses}L`,
      color: metrics.winrate >= 50 ? "text-emerald-400" : "text-red-400",
      tooltip: "Percentage of winning trades",
      sparklineData: sparklines?.winrate
    },
    {
      icon: Activity,
      label: 'Avg R Multiple',
      value: metrics.avgR !== null && metrics.avgR !== undefined ? `${metrics.avgR >= 0 ? '+' : ''}${metrics.avgR.toFixed(2)}R` : '—',
      color: metrics.avgR >= 0 ? "text-emerald-400" : "text-red-400",
      tooltip: "Average risk-reward outcome"
    },
    {
      icon: Zap,
      label: 'Profit Factor',
      value: typeof metrics.profitFactor === 'number' ? metrics.profitFactor.toFixed(2) : metrics.profitFactor,
      color: (typeof metrics.profitFactor === 'number' && metrics.profitFactor >= 1.5) || metrics.profitFactor === '∞' ? "text-emerald-400" : "text-red-400",
      tooltip: "Gross profit / Gross loss"
    },
    {
      icon: BarChart3,
      label: 'Expectancy',
      value: metrics.expectancy >= 0 ? `+$${formatNumber(metrics.expectancy)}` : `-$${formatNumber(Math.abs(metrics.expectancy))}`,
      color: metrics.expectancy >= 0 ? "text-emerald-400" : "text-red-400",
      tooltip: "Expected value per trade"
    },
    {
      icon: TrendingDown,
      label: 'Max Drawdown',
      value: `${metrics.maxDrawdown.toFixed(1)}%`,
      color: metrics.maxDrawdown > 15 ? "text-red-400" : "text-emerald-400",
      tooltip: "Largest peak-to-trough decline"
    },
    {
      icon: Shield,
      label: 'Trades',
      value: formatNumber(metrics.tradesCount),
      subtext: `Closed: ${metrics.tradesCount} / Open: ${metrics.openCount || 0}`,
      color: "text-[#c0c0c0]",
      tooltip: "Total trades in period"
    },
    {
      icon: Activity,
      label: 'Discipline Index',
      value: `${metrics.disciplineScore}/100`,
      color: metrics.disciplineScore >= 70 ? "text-emerald-400" : metrics.disciplineScore >= 50 ? "text-amber-400" : "text-red-400",
      tooltip: "Overall trading discipline score"
    }
  ];

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {kpis.map((kpi, idx) => (
        <KPICard key={idx} {...kpi} onClick={() => onClick?.(kpi.label)} />
      ))}
    </div>
  );
}