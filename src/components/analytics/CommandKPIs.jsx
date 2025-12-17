import { Target, Zap, DollarSign, Activity, BarChart3, Shield, HelpCircle, TrendingDown } from 'lucide-react';
import { formatNumber, formatDecimal, formatPercent } from './analyticsCalculations';
import { cn } from "@/lib/utils";
import { MetricHelp } from './MetricHelp';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const KPICard = ({ icon: Icon, label, value, subtext, color = "text-[#c0c0c0]", helpKey }) => {
  const help = MetricHelp[helpKey];
  
  return (
    <div className="group relative backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-4 hover:border-[#c0c0c0]/30 transition-all duration-300 hover:shadow-[0_0_20px_rgba(192,192,192,0.1)] cursor-pointer">
      {/* Premium glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#c0c0c0]/3 via-transparent to-[#888]/3 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon className={cn("w-4 h-4", color)} />
            <span className="text-xs text-[#666] uppercase tracking-wider">{label}</span>
          </div>
          {help && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-xs text-[#666] hover:text-[#c0c0c0] transition-colors">
                    <HelpCircle className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs bg-[#111] border-[#2a2a2a] p-4">
                  <div className="space-y-2">
                    <div className="font-bold text-[#c0c0c0]">{help.title}</div>
                    <div className="text-xs text-[#888]">{help.description}</div>
                    <div className="text-xs text-violet-400 font-mono">{help.formula}</div>
                    <div className="text-[10px] text-[#666] italic">{help.notes}</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        
        <div className={cn("text-2xl font-bold mb-1", color)}>{value}</div>
        {subtext && <div className="text-xs text-[#888]">{subtext}</div>}
      </div>
    </div>
  );
};

export default function CommandKPIs({ metrics, onClick, tradesCount }) {
  const lowSample = tradesCount < 10;
  
  const kpis = [
    {
      icon: DollarSign,
      label: 'Net PNL',
      value: metrics.netPnlUsd >= 0 ? `+$${formatNumber(metrics.netPnlUsd)}` : `-$${formatNumber(Math.abs(metrics.netPnlUsd))}`,
      subtext: formatPercent(metrics.netPnlPercent),
      color: metrics.netPnlUsd >= 0 ? "text-emerald-400" : "text-red-400",
      helpKey: "Net PNL"
    },
    {
      icon: Target,
      label: 'Winrate',
      value: `${metrics.winrate.toFixed(1)}%`,
      subtext: `${metrics.wins}W / ${metrics.losses}L / ${metrics.breakevens || 0}BE`,
      color: metrics.winrate >= 50 ? "text-emerald-400" : "text-red-400",
      helpKey: "Winrate"
    },
    {
      icon: Activity,
      label: 'Avg R',
      value: metrics.avgR !== null && metrics.avgR !== undefined ? `${metrics.avgR >= 0 ? '+' : ''}${metrics.avgR.toFixed(2)}R` : '—',
      color: metrics.avgR >= 0 ? "text-emerald-400" : "text-red-400",
      helpKey: "Avg R Multiple"
    },
    {
      icon: Zap,
      label: 'Profit Factor',
      value: typeof metrics.profitFactor === 'number' ? metrics.profitFactor.toFixed(2) : metrics.profitFactor,
      color: (typeof metrics.profitFactor === 'number' && metrics.profitFactor >= 1.5) || metrics.profitFactor === '∞' ? "text-emerald-400" : "text-red-400",
      helpKey: "Profit Factor"
    },
    {
      icon: BarChart3,
      label: 'Expectancy',
      value: metrics.expectancy >= 0 ? `+$${formatNumber(metrics.expectancy)}` : `-$${formatNumber(Math.abs(metrics.expectancy))}`,
      color: metrics.expectancy >= 0 ? "text-emerald-400" : "text-red-400",
      helpKey: "Expectancy"
    },
    {
      icon: TrendingDown,
      label: 'Max Drawdown',
      value: `-${metrics.maxDrawdown.percent.toFixed(1)}%`,
      subtext: `-$${formatNumber(metrics.maxDrawdown.usd)}`,
      color: metrics.maxDrawdown.percent > 15 ? "text-red-400" : "text-amber-400",
      helpKey: "Max Drawdown"
    },
    {
      icon: Shield,
      label: 'Trades',
      value: formatNumber(metrics.tradesCount),
      subtext: `Closed: ${metrics.tradesCount} / Open: ${metrics.openCount || 0}`,
      color: "text-[#c0c0c0]",
      helpKey: "Trades"
    },
    {
      icon: Activity,
      label: 'Discipline Index',
      value: `${metrics.disciplineScore}/100`,
      subtext: `Complete: ${Math.round(metrics.disciplineScore * metrics.tradesCount / 100)}/${metrics.tradesCount + (metrics.openCount || 0)}`,
      color: metrics.disciplineScore >= 70 ? "text-emerald-400" : metrics.disciplineScore >= 50 ? "text-amber-400" : "text-red-400",
      helpKey: "Discipline Index"
    }
  ];

  return (
    <div className="mb-6">
      {lowSample && (
        <div className="mb-3 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3">
          <div className="flex items-start gap-3">
            <span className="text-amber-400 text-lg">⚠️</span>
            <div>
              <div className="text-sm font-medium text-amber-400 mb-1">
                Недостаточно данных ({tradesCount}/10 сделок)
              </div>
              <div className="text-xs text-amber-400/80">
                Метрики станут стабильнее после 10+ закрытых сделок. Пока значения могут сильно меняться — используй их как ориентир, а не как вывод.
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => (
          <KPICard key={idx} {...kpi} onClick={() => onClick?.(kpi.label)} />
        ))}
      </div>
    </div>
  );
}