import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, RefreshCw, AlertTriangle, TrendingUp, Brain, Target } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function AIRecommendations({ trades, behaviorLogs }) {
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(false);

  const generateRecommendations = async () => {
    if (trades.length === 0) return;
    
    setLoading(true);
    try {
      // Prepare stats
      const wins = trades.filter(t => (t.pnl_usd || 0) > 0).length;
      const losses = trades.filter(t => (t.pnl_usd || 0) < 0).length;
      const winrate = trades.length > 0 ? (wins / trades.length * 100).toFixed(1) : 0;
      const totalPnl = trades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
      const avgR = trades.length > 0 ? trades.reduce((s, t) => s + (t.r_multiple || 0), 0) / trades.length : 0;
      const avgEmotion = trades.filter(t => t.emotional_state).reduce((s, t, _, a) => s + t.emotional_state / a.length, 0);
      
      // Best/Worst coins
      const coinStats = trades.reduce((acc, t) => {
        acc[t.coin] = (acc[t.coin] || 0) + (t.pnl_usd || 0);
        return acc;
      }, {});
      const sortedCoins = Object.entries(coinStats).sort((a, b) => b[1] - a[1]);
      const bestCoins = sortedCoins.slice(0, 3).map(([c]) => c);
      const worstCoins = sortedCoins.slice(-3).reverse().map(([c]) => c);

      // Behavior triggers
      const triggers = behaviorLogs?.reduce((acc, l) => {
        acc[l.trigger_name] = (acc[l.trigger_name] || 0) + (l.trigger_count || 1);
        return acc;
      }, {}) || {};

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a trading psychologist and coach. Analyze this trader's data and provide personalized recommendations in Russian.

Data:
- Total trades: ${trades.length}
- Winrate: ${winrate}%
- Total PNL: $${totalPnl.toFixed(2)}
- Average R: ${avgR.toFixed(2)}
- Average emotional state: ${avgEmotion.toFixed(1)}/10
- Best coins: ${bestCoins.join(', ') || 'N/A'}
- Worst coins: ${worstCoins.join(', ') || 'N/A'}
- Behavioral triggers: ${JSON.stringify(triggers)}
- Recent trades (last 5): ${JSON.stringify(trades.slice(0, 5).map(t => ({
  coin: t.coin, pnl: t.pnl_usd, r: t.r_multiple, rules: t.rule_compliance, emotion: t.emotional_state
})))}

Provide:
1. Main insight about current trading state
2. What to focus on today
3. What to avoid today
4. Coins to consider
5. Coins to avoid
6. Tilt risk assessment (low/medium/high)
7. One key improvement recommendation`,
        response_json_schema: {
          type: "object",
          properties: {
            main_insight: { type: "string" },
            focus_today: { type: "string" },
            avoid_today: { type: "string" },
            coins_to_consider: { type: "string" },
            coins_to_avoid: { type: "string" },
            tilt_risk: { type: "string" },
            key_improvement: { type: "string" }
          }
        }
      });
      setRecommendations(result);
    } catch (err) {
      console.error('Failed to generate recommendations:', err);
    }
    setLoading(false);
  };

  return (
    <div className={`bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a] transition-all duration-500 ${
      recommendations ? 'lg:col-span-2' : ''
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <h3 className="text-[#c0c0c0] text-sm font-medium">AI Recommendations</h3>
        </div>
        <Button 
          size="sm" 
          variant="ghost" 
          onClick={generateRecommendations}
          disabled={loading || trades.length === 0}
          className="text-[#888]"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </div>

      {!recommendations && !loading && (
        <div className="text-center py-6">
          <p className="text-[#666] text-sm mb-3">Get personalized AI insights based on your trading data</p>
          <Button 
            onClick={generateRecommendations} 
            disabled={trades.length === 0}
            className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Recommendations
          </Button>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
        </div>
      )}

      {recommendations && !loading && (
        <div className="space-y-4">
          {/* Main Insight - stays compact */}
          <div className="bg-[#151515] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-purple-400" />
              <span className="text-[#888] text-xs">Main Insight</span>
            </div>
            <p className="text-[#c0c0c0] text-sm leading-relaxed">{recommendations.main_insight}</p>
          </div>

          {/* Expanded content - uses full width */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-emerald-500/10 rounded-lg p-4 transition-all duration-300 hover:bg-emerald-500/15">
              <p className="text-emerald-400 text-xs font-medium mb-2">Focus Today</p>
              <p className="text-[#c0c0c0] text-sm leading-relaxed">{recommendations.focus_today}</p>
            </div>
            <div className="bg-red-500/10 rounded-lg p-4 transition-all duration-300 hover:bg-red-500/15">
              <p className="text-red-400 text-xs font-medium mb-2">Avoid Today</p>
              <p className="text-[#c0c0c0] text-sm leading-relaxed">{recommendations.avoid_today}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-[#151515] rounded-lg p-4">
              <p className="text-[#888] text-xs font-medium mb-2">Consider Coins</p>
              <p className="text-emerald-400 text-sm">{recommendations.coins_to_consider}</p>
            </div>
            <div className="bg-[#151515] rounded-lg p-4">
              <p className="text-[#888] text-xs font-medium mb-2">Avoid Coins</p>
              <p className="text-red-400 text-sm">{recommendations.coins_to_avoid}</p>
            </div>
          </div>

          <div className={`rounded-lg p-4 ${
            recommendations.tilt_risk === 'high' ? 'bg-red-500/10' :
            recommendations.tilt_risk === 'medium' ? 'bg-yellow-500/10' : 'bg-emerald-500/10'
          }`}>
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-5 h-5 ${
                recommendations.tilt_risk === 'high' ? 'text-red-400' :
                recommendations.tilt_risk === 'medium' ? 'text-yellow-400' : 'text-emerald-400'
              }`} />
              <span className="text-[#888] text-xs font-medium">Tilt Risk: </span>
              <span className={`text-sm font-bold ${
                recommendations.tilt_risk === 'high' ? 'text-red-400' :
                recommendations.tilt_risk === 'medium' ? 'text-yellow-400' : 'text-emerald-400'
              }`}>
                {recommendations.tilt_risk?.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="bg-blue-500/10 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-blue-400" />
              <span className="text-blue-400 text-xs font-medium">Key Improvement</span>
            </div>
            <p className="text-[#c0c0c0] text-sm leading-relaxed">{recommendations.key_improvement}</p>
          </div>
        </div>
      )}
    </div>
  );
}