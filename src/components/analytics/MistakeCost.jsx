import { useMemo } from 'react';
import { AlertCircle, DollarSign } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function MistakeCost({ trades }) {
  const mistakes = useMemo(() => {
    const closed = trades.filter(t => t.close_price);
    const errors = [];

    // Rule violations
    const ruleViolations = closed.filter(t => t.rule_compliance === false);
    if (ruleViolations.length > 0) {
      const cost = ruleViolations.reduce((s, t) => s + (t.pnl_usd || 0), 0);
      errors.push({
        type: 'Rule Violations',
        count: ruleViolations.length,
        cost: Math.abs(cost),
        avgCost: Math.abs(cost / ruleViolations.length)
      });
    }

    // Trades without entry reason
    const noReason = closed.filter(t => !t.entry_reason || t.entry_reason.trim().length === 0);
    if (noReason.length > 0) {
      const cost = noReason.reduce((s, t) => s + (t.pnl_usd || 0), 0);
      errors.push({
        type: 'No Entry Reason',
        count: noReason.length,
        cost: Math.abs(cost),
        avgCost: Math.abs(cost / noReason.length)
      });
    }

    // High risk trades (>3%)
    const highRisk = closed.filter(t => (t.risk_percent || 0) > 3);
    if (highRisk.length > 0) {
      const cost = highRisk.reduce((s, t) => s + (t.pnl_usd || 0), 0);
      if (cost < 0) {
        errors.push({
          type: 'Oversized Risk (>3%)',
          count: highRisk.length,
          cost: Math.abs(cost),
          avgCost: Math.abs(cost / highRisk.length)
        });
      }
    }

    // Violation tags
    const withViolations = closed.filter(t => t.violation_tags && t.violation_tags.length > 0);
    if (withViolations.length > 0) {
      const cost = withViolations.reduce((s, t) => s + (t.pnl_usd || 0), 0);
      if (cost < 0) {
        errors.push({
          type: 'Tagged Violations',
          count: withViolations.length,
          cost: Math.abs(cost),
          avgCost: Math.abs(cost / withViolations.length)
        });
      }
    }

    return errors.sort((a, b) => b.cost - a.cost);
  }, [trades]);

  if (mistakes.length === 0) {
    return (
      <div className="backdrop-blur-md bg-gradient-to-br from-emerald-500/10 via-[#1a1a1a] to-emerald-500/5 rounded-xl border border-emerald-500/30 p-6 mb-6">
        <h3 className="text-lg font-bold text-emerald-400 mb-2">✓ Clean Trading</h3>
        <p className="text-sm text-[#888]">No significant mistakes detected in your trading!</p>
      </div>
    );
  }

  const totalCost = mistakes.reduce((s, m) => s + m.cost, 0);

  return (
    <div className="backdrop-blur-md bg-gradient-to-br from-red-500/10 via-[#1a1a1a] to-red-500/5 rounded-xl border border-red-500/30 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-red-400 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Mistake Analysis
        </h3>
        <div className="text-right">
          <div className="text-xs text-[#666]">Total Cost</div>
          <div className="text-2xl font-bold text-red-400">
            -${totalCost.toLocaleString('ru-RU').replace(/,/g, ' ')}
          </div>
        </div>
      </div>
      
      <div className="space-y-3">
        {mistakes.map((mistake, i) => (
          <div key={i} className="bg-[#111]/50 rounded-lg p-4 flex items-center justify-between">
            <div>
              <div className="font-medium text-[#c0c0c0] mb-1">{mistake.type}</div>
              <div className="text-xs text-[#666]">
                {mistake.count} trades • Avg: -${mistake.avgCost.toFixed(0)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-red-400">
                -${mistake.cost.toLocaleString('ru-RU').replace(/,/g, ' ')}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}