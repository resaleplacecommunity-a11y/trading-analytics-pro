import { useState } from 'react';
import { Sparkles, TrendingUp, AlertTriangle, Target, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { base44 } from '@/api/base44Client';

export default function AIInsights({ trades, metrics }) {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState(null);

  const generateInsights = async () => {
    setLoading(true);
    try {
      // Prepare data summary
      const summary = {
        totalTrades: trades.length,
        netPnl: metrics.netPnlUsd,
        winrate: metrics.winrate,
        avgR: metrics.avgR,
        profitFactor: metrics.profitFactor,
        disciplineScore: metrics.disciplineScore
      };

      // Get top strategies
      const stratMap = {};
      trades.filter(t => t.close_price && t.strategy_tag).forEach(t => {
        const strat = t.strategy_tag;
        if (!stratMap[strat]) stratMap[strat] = { pnl: 0, trades: 0 };
        stratMap[strat].pnl += t.pnl_usd || 0;
        stratMap[strat].trades += 1;
      });
      const topStrategies = Object.entries(stratMap)
        .map(([name, data]) => ({ name, pnl: data.pnl, trades: data.trades }))
        .sort((a, b) => b.pnl - a.pnl)
        .slice(0, 3);

      const prompt = `Analyze this trading performance and provide insights:

Summary:
- Total Trades: ${summary.totalTrades}
- Net PNL: $${summary.netPnl.toFixed(2)}
- Winrate: ${summary.winrate.toFixed(1)}%
- Avg R: ${summary.avgR.toFixed(2)}R
- Profit Factor: ${typeof summary.profitFactor === 'number' ? summary.profitFactor.toFixed(2) : summary.profitFactor}
- Discipline Score: ${summary.disciplineScore}/100

Top Strategies: ${topStrategies.map(s => `${s.name} ($${s.pnl.toFixed(0)}, ${s.trades} trades)`).join(', ')}

Provide analysis in JSON format:
{
  "patterns": ["3 key patterns that are working"],
  "leaks": ["2 biggest issues costing money"],
  "actions": ["3 specific actions for next week"],
  "estimate": "Potential gain if improvements are made (short phrase)"
}`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            patterns: { type: 'array', items: { type: 'string' } },
            leaks: { type: 'array', items: { type: 'string' } },
            actions: { type: 'array', items: { type: 'string' } },
            estimate: { type: 'string' }
          }
        }
      });

      setInsights(result);
    } catch (error) {
      console.error('Failed to generate insights:', error);
    }
    setLoading(false);
  };

  return (
    <div className="backdrop-blur-md bg-gradient-to-br from-violet-500/10 via-[#1a1a1a] to-purple-500/10 rounded-xl border border-violet-500/30 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-[#c0c0c0] flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-violet-400" />
          AI Insights
        </h3>
        {!insights && (
          <Button
            onClick={generateInsights}
            disabled={loading || trades.length < 5}
            className="bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 border border-violet-500/30"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Insights
              </>
            )}
          </Button>
        )}
      </div>

      {!insights && !loading && (
        <div className="text-center py-12">
          <Sparkles className="w-12 h-12 mx-auto mb-4 text-violet-400/50" />
          <p className="text-[#888] mb-2">Get AI-powered analysis of your trading</p>
          <p className="text-xs text-[#666]">
            {trades.length < 5 ? 'Need at least 5 trades' : 'Click Generate to start'}
          </p>
        </div>
      )}

      {insights && (
        <div className="space-y-6">
          {/* Patterns */}
          <div className="bg-emerald-500/10 rounded-lg p-4 border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-bold text-emerald-400">What's Working</span>
            </div>
            <ul className="space-y-2">
              {insights.patterns.map((pattern, idx) => (
                <li key={idx} className="text-sm text-[#c0c0c0] flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">•</span>
                  <span>{pattern}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Leaks */}
          <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/20">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-sm font-bold text-red-400">Biggest Leaks</span>
            </div>
            <ul className="space-y-2">
              {insights.leaks.map((leak, idx) => (
                <li key={idx} className="text-sm text-[#c0c0c0] flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">•</span>
                  <span>{leak}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div className="bg-violet-500/10 rounded-lg p-4 border border-violet-500/20">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-bold text-violet-400">Next Week Actions</span>
            </div>
            <ul className="space-y-2">
              {insights.actions.map((action, idx) => (
                <li key={idx} className="text-sm text-[#c0c0c0] flex items-start gap-2">
                  <span className="text-violet-400 mt-0.5">{idx + 1}.</span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Estimate */}
          {insights.estimate && (
            <div className="bg-[#111]/50 rounded-lg p-4 border border-[#2a2a2a]">
              <div className="text-xs text-[#666] mb-1">Potential Impact</div>
              <div className="text-sm text-[#c0c0c0]">{insights.estimate}</div>
            </div>
          )}

          <Button
            onClick={generateInsights}
            disabled={loading}
            variant="outline"
            className="w-full bg-[#111]/50 border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
          >
            Regenerate Insights
          </Button>
        </div>
      )}
    </div>
  );
}