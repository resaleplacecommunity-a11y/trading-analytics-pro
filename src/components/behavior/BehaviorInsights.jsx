import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, AlertTriangle, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function BehaviorInsights({ trades, behaviorLogs }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);

  const generateInsights = async () => {
    setLoading(true);
    try {
      // Prepare behavior data
      const triggers = behaviorLogs.reduce((acc, l) => {
        acc[l.trigger_name] = (acc[l.trigger_name] || 0) + (l.trigger_count || 1);
        return acc;
      }, {});

      // Analyze trades with low emotional states
      const lowEmotionTrades = trades.filter(t => t.emotional_state && t.emotional_state < 5);
      const highEmotionTrades = trades.filter(t => t.emotional_state && t.emotional_state >= 7);
      
      const lowEmotionPnl = lowEmotionTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
      const highEmotionPnl = highEmotionTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0);

      // Analyze rule compliance
      const compliantTrades = trades.filter(t => t.rule_compliance);
      const nonCompliantTrades = trades.filter(t => !t.rule_compliance);
      
      const compliantPnl = compliantTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
      const nonCompliantPnl = nonCompliantTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0);

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a trading psychologist. Analyze this trader's behavioral patterns and provide deep insights in Russian.

Data:
- Total trades: ${trades.length}
- Behavioral triggers: ${JSON.stringify(triggers)}
- Trades with low emotion (1-4): ${lowEmotionTrades.length} with total PNL $${lowEmotionPnl.toFixed(2)}
- Trades with high emotion (7-10): ${highEmotionTrades.length} with total PNL $${highEmotionPnl.toFixed(2)}
- Rule-compliant trades: ${compliantTrades.length} with PNL $${compliantPnl.toFixed(2)}
- Non-compliant trades: ${nonCompliantTrades.length} with PNL $${nonCompliantPnl.toFixed(2)}

Provide detailed analysis:
1. Main behavioral pattern (what is the #1 issue)
2. When trader makes most mistakes (conditions)
3. When trader performs best (conditions)
4. Tilt risk triggers specific to this trader
5. Specific recommendations to improve psychology`,
        response_json_schema: {
          type: "object",
          properties: {
            main_pattern: { type: "string" },
            mistake_conditions: { type: "string" },
            best_conditions: { type: "string" },
            tilt_triggers: { type: "string" },
            recommendations: { type: "string" }
          }
        }
      });
      setInsights(result);
    } catch (err) {
      console.error('Failed to generate insights:', err);
    }
    setLoading(false);
  };

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <h3 className="text-[#c0c0c0] text-sm font-medium">AI Behavior Analysis</h3>
        </div>
        {!insights && (
          <Button 
            size="sm" 
            onClick={generateInsights}
            disabled={loading || trades.length === 0}
            className="bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Analyze'}
          </Button>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
        </div>
      )}

      {insights && !loading && (
        <div className="space-y-3">
          <div className="bg-red-500/10 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-red-400 text-xs">Main Pattern</span>
            </div>
            <p className="text-[#c0c0c0] text-sm">{insights.main_pattern}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#151515] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-red-400" />
                <span className="text-[#888] text-xs">Mistake Conditions</span>
              </div>
              <p className="text-[#c0c0c0] text-sm">{insights.mistake_conditions}</p>
            </div>
            <div className="bg-[#151515] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-[#888] text-xs">Best Conditions</span>
              </div>
              <p className="text-[#c0c0c0] text-sm">{insights.best_conditions}</p>
            </div>
          </div>

          <div className="bg-yellow-500/10 rounded-lg p-3">
            <p className="text-yellow-400 text-xs mb-1">Tilt Triggers</p>
            <p className="text-[#c0c0c0] text-sm">{insights.tilt_triggers}</p>
          </div>

          <div className="bg-emerald-500/10 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400 text-xs">Recommendations</span>
            </div>
            <p className="text-[#c0c0c0] text-sm">{insights.recommendations}</p>
          </div>
        </div>
      )}
    </div>
  );
}