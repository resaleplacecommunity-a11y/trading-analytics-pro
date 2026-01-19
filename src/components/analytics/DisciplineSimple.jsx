import { Brain } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function DisciplineSimple({ trades, disciplineScore }) {
  const closedTrades = trades.filter(t => t.close_price);
  const totalTrades = closedTrades.length;
  const withReason = closedTrades.filter(t => t.entry_reason && t.entry_reason.trim().length > 0).length;
  const withAnalysis = closedTrades.filter(t => t.trade_analysis && t.trade_analysis.trim().length > 0).length;
  const goodRisk = closedTrades.filter(t => {
    const initialRisk = t.original_risk_usd || t.max_risk_usd || t.risk_usd || 0;
    const balance = t.account_balance_at_entry || 100000;
    const riskPercent = (initialRisk / balance) * 100;
    return riskPercent > 0 && riskPercent <= 3;
  }).length;

  // Recalculate discipline score from bars (make it match)
  const totalChecks = withReason + withAnalysis + goodRisk;
  const maxChecks = totalTrades * 3; // 3 checks per trade
  const calculatedScore = maxChecks > 0 ? Math.round((totalChecks / maxChecks) * 100) : 0;

  const complianceItems = [
    { label: 'Entry Reason', value: totalTrades > 0 ? (withReason / totalTrades) * 100 : 0, count: withReason },
    { label: 'Post Analysis', value: totalTrades > 0 ? (withAnalysis / totalTrades) * 100 : 0, count: withAnalysis },
    { label: 'Risk ≤ 3%', value: totalTrades > 0 ? (goodRisk / totalTrades) * 100 : 0, count: goodRisk }
  ];

  // Use calculatedScore instead of passed disciplineScore to ensure consistency
  const finalScore = calculatedScore;

  return (
    <div className="backdrop-blur-md bg-gradient-to-br from-violet-500/15 via-[#1a1a1a] to-violet-500/5 rounded-xl border-2 border-violet-500/40 p-6 mb-6 col-span-2 shadow-[0_0_30px_rgba(139,92,246,0.2)]">
      <h3 className="text-base font-bold text-[#c0c0c0] mb-5 flex items-center gap-2">
        <Brain className="w-5 h-5 text-violet-400" />
        Discipline & Psychology
      </h3>

      <div className="flex items-center gap-8">
        {/* Discipline Score Circle */}
        <div className="relative w-32 h-32 flex-shrink-0">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 blur-xl" />
          <svg className="w-full h-full transform -rotate-90 relative z-10">
            <circle cx="64" cy="64" r="56" stroke="#2a2a2a" strokeWidth="8" fill="none" />
            <circle 
              cx="64" 
              cy="64" 
              r="56" 
              stroke={finalScore >= 70 ? "#10b981" : finalScore >= 50 ? "#f59e0b" : "#ef4444"}
              strokeWidth="8" 
              fill="none"
              strokeDasharray={`${2 * Math.PI * 56}`}
              strokeDashoffset={`${2 * Math.PI * 56 * (1 - finalScore / 100)}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className={cn(
                "text-3xl font-black",
                finalScore >= 70 ? "text-emerald-400" : finalScore >= 50 ? "text-amber-400" : "text-red-400"
              )}>
                {finalScore}
              </div>
              <div className="text-xs text-[#666] font-medium">/100</div>
            </div>
          </div>
        </div>
        
        {/* Compliance Breakdown */}
        <div className="flex-1 space-y-3">
          {complianceItems.map(item => (
            <div key={item.label} className="bg-[#0d0d0d]/50 rounded-lg p-3 border border-[#2a2a2a]/50">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-[#c0c0c0] font-medium">{item.label}</span>
                <span className="text-[#888] font-bold">{item.count}/{totalTrades}</span>
              </div>
              <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all rounded-full",
                    item.value >= 70 ? "bg-gradient-to-r from-emerald-400 to-emerald-500" : 
                    item.value >= 50 ? "bg-gradient-to-r from-amber-400 to-amber-500" : 
                    "bg-gradient-to-r from-red-400 to-red-500"
                  )}
                  style={{ width: `${item.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}