import { Brain } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function DisciplineSimple({ trades, disciplineScore }) {
  const totalTrades = trades.length;
  const withReason = trades.filter(t => t.entry_reason && t.entry_reason.trim().length > 0).length;
  const withAnalysis = trades.filter(t => t.trade_analysis && t.trade_analysis.trim().length > 0).length;
  const goodRisk = trades.filter(t => t.close_price && (t.risk_percent || 0) <= 3).length;

  const complianceItems = [
    { label: 'Entry Reason', value: totalTrades > 0 ? (withReason / totalTrades) * 100 : 0, count: withReason },
    { label: 'Post Analysis', value: totalTrades > 0 ? (withAnalysis / totalTrades) * 100 : 0, count: withAnalysis },
    { label: 'Risk ≤ 3%', value: totalTrades > 0 ? (goodRisk / totalTrades) * 100 : 0, count: goodRisk }
  ];

  return (
    <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-6 mb-6">
      <h3 className="text-lg font-bold text-[#c0c0c0] mb-6 flex items-center gap-2">
        <Brain className="w-5 h-5 text-violet-400" />
        Discipline & Psychology
      </h3>

      <div className="flex items-center gap-6">
        {/* Discipline Score Circle */}
        <div className="relative w-32 h-32 flex-shrink-0">
          <svg className="w-full h-full transform -rotate-90">
            <circle cx="64" cy="64" r="56" stroke="#2a2a2a" strokeWidth="8" fill="none" />
            <circle 
              cx="64" 
              cy="64" 
              r="56" 
              stroke={disciplineScore >= 70 ? "#10b981" : disciplineScore >= 50 ? "#f59e0b" : "#ef4444"}
              strokeWidth="8" 
              fill="none"
              strokeDasharray={`${2 * Math.PI * 56}`}
              strokeDashoffset={`${2 * Math.PI * 56 * (1 - disciplineScore / 100)}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className={cn(
                "text-3xl font-bold",
                disciplineScore >= 70 ? "text-emerald-400" : disciplineScore >= 50 ? "text-amber-400" : "text-red-400"
              )}>
                {disciplineScore}
              </div>
              <div className="text-xs text-[#666]">/100</div>
            </div>
          </div>
        </div>
        
        {/* Compliance Breakdown */}
        <div className="flex-1 space-y-3">
          {complianceItems.map(item => (
            <div key={item.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#888]">{item.label}</span>
                <span className="text-[#c0c0c0]">{item.count}/{totalTrades}</span>
              </div>
              <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all rounded-full",
                    item.value >= 70 ? "bg-emerald-400" : item.value >= 50 ? "bg-amber-400" : "bg-red-400"
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