import { useState } from 'react';
import { Sparkles, AlertTriangle, TrendingUp, Target, BarChart3, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { base44 } from '@/api/base44Client';
import { cn } from "@/lib/utils";

export default function AIInsightsPremium({ trades, metrics }) {
  const [loading, setLoading] = useState(null);
  const [insights, setInsights] = useState({});

  const generateInsight = async (type) => {
    setLoading(type);
    try {
      let prompt = '';
      let schema = {};

      switch (type) {
        case 'mistakes':
          prompt = `Analyze trading mistakes from ${trades.length} trades. Net PNL: $${metrics.netPnlUsd.toFixed(0)}, Winrate: ${metrics.winrate.toFixed(1)}%. 
          Identify 3-5 biggest mistakes costing money. Return JSON: {"mistakes": [{"issue": "brief issue", "cost": "estimated $", "fix": "one action to fix"}]}`;
          schema = {
            type: "object",
            properties: {
              mistakes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    issue: { type: "string" },
                    cost: { type: "string" },
                    fix: { type: "string" }
                  }
                }
              }
            }
          };
          break;

        case 'missed':
          prompt = `Analyze missed profit opportunities from ${trades.length} trades. Look for early exits, missed follow-ups, small position sizes.
          Return JSON: {"opportunities": [{"scenario": "what was missed", "potential": "estimated $", "action": "how to catch next time"}]}`;
          schema = {
            type: "object",
            properties: {
              opportunities: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    scenario: { type: "string" },
                    potential: { type: "string" },
                    action: { type: "string" }
                  }
                }
              }
            }
          };
          break;

        case 'recommendations':
          prompt = `Based on ${trades.length} trades with ${metrics.winrate.toFixed(1)}% winrate, provide 5 specific recommendations to improve results.
          Return JSON: {"recommendations": [{"title": "brief title", "action": "specific action", "impact": "expected improvement"}]}`;
          schema = {
            type: "object",
            properties: {
              recommendations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    action: { type: "string" },
                    impact: { type: "string" }
                  }
                }
              }
            }
          };
          break;

        case 'overall':
          prompt = `Comprehensive trading analysis: ${trades.length} trades, Net PNL: $${metrics.netPnlUsd.toFixed(0)}, Winrate: ${metrics.winrate.toFixed(1)}%, Avg R: ${metrics.avgR.toFixed(2)}R.
          Return JSON: {"strengths": ["3 things working well"], "weaknesses": ["3 biggest issues"], "priority": "top 1 priority to focus on", "forecast": "realistic 30-day outlook"}`;
          schema = {
            type: "object",
            properties: {
              strengths: { type: "array", items: { type: "string" } },
              weaknesses: { type: "array", items: { type: "string" } },
              priority: { type: "string" },
              forecast: { type: "string" }
            }
          };
          break;
      }

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: schema
      });

      setInsights(prev => ({ ...prev, [type]: result }));
    } catch (error) {
      console.error('Failed to generate insights:', error);
    }
    setLoading(null);
  };

  const buttons = [
    {
      id: 'mistakes',
      label: 'Generate My Mistakes',
      icon: AlertTriangle,
      color: 'red',
      gradient: 'from-red-500/20 to-red-600/20',
      hoverGradient: 'hover:from-red-500/30 hover:to-red-600/30',
      borderColor: 'border-red-500/30',
      iconColor: 'text-red-400'
    },
    {
      id: 'missed',
      label: 'Missed Profit Analysis',
      icon: TrendingUp,
      color: 'amber',
      gradient: 'from-amber-500/20 to-amber-600/20',
      hoverGradient: 'hover:from-amber-500/30 hover:to-amber-600/30',
      borderColor: 'border-amber-500/30',
      iconColor: 'text-amber-400'
    },
    {
      id: 'recommendations',
      label: 'Improve Results',
      icon: Target,
      color: 'violet',
      gradient: 'from-violet-500/20 to-violet-600/20',
      hoverGradient: 'hover:from-violet-500/30 hover:to-violet-600/30',
      borderColor: 'border-violet-500/30',
      iconColor: 'text-violet-400'
    },
    {
      id: 'overall',
      label: 'Overall Analytics',
      icon: BarChart3,
      color: 'emerald',
      gradient: 'from-emerald-500/20 to-emerald-600/20',
      hoverGradient: 'hover:from-emerald-500/30 hover:to-emerald-600/30',
      borderColor: 'border-emerald-500/30',
      iconColor: 'text-emerald-400'
    }
  ];

  return (
    <div className="backdrop-blur-md bg-gradient-to-br from-violet-500/10 via-[#1a1a1a] to-purple-500/10 rounded-xl border border-violet-500/30 p-8 mb-6">
      <div className="flex items-center gap-3 mb-6">
        <Sparkles className="w-6 h-6 text-violet-400" />
        <h3 className="text-2xl font-bold text-[#c0c0c0]">AI Insights</h3>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {buttons.map((btn) => {
          const Icon = btn.icon;
          const isLoading = loading === btn.id;
          const hasData = insights[btn.id];

          return (
            <Button
              key={btn.id}
              onClick={() => generateInsight(btn.id)}
              disabled={isLoading || trades.length < 5}
              className={cn(
                "h-auto py-6 px-6 flex flex-col items-start gap-3 transition-all",
                "bg-gradient-to-br border-2",
                btn.gradient,
                btn.hoverGradient,
                btn.borderColor,
                "hover:scale-[1.02] hover:shadow-xl",
                (isLoading || hasData) && "ring-2 ring-offset-2 ring-offset-[#0a0a0a]",
                isLoading && "ring-violet-500/50",
                hasData && "ring-emerald-500/50"
              )}
            >
              <div className="flex items-center gap-3 w-full">
                {isLoading ? (
                  <Loader2 className={cn("w-6 h-6 animate-spin", btn.iconColor)} />
                ) : (
                  <Icon className={cn("w-6 h-6", btn.iconColor)} />
                )}
                <span className="text-lg font-bold text-[#c0c0c0]">{btn.label}</span>
              </div>
              {hasData && (
                <div className="text-xs text-emerald-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Generated
                </div>
              )}
            </Button>
          );
        })}
      </div>

      {/* Results Display */}
      {Object.keys(insights).length > 0 && (
        <div className="space-y-4 mt-6">
          {insights.mistakes && (
            <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/20">
              <h4 className="text-red-400 font-bold mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Your Mistakes
              </h4>
              <div className="space-y-2">
                {insights.mistakes.mistakes?.map((m, i) => (
                  <div key={i} className="bg-[#111]/50 rounded p-3">
                    <div className="font-bold text-[#c0c0c0] text-sm mb-1">{m.issue}</div>
                    <div className="text-xs text-red-400 mb-1">Cost: {m.cost}</div>
                    <div className="text-xs text-[#888]">Fix: {m.fix}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {insights.missed && (
            <div className="bg-amber-500/10 rounded-lg p-4 border border-amber-500/20">
              <h4 className="text-amber-400 font-bold mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Missed Opportunities
              </h4>
              <div className="space-y-2">
                {insights.missed.opportunities?.map((o, i) => (
                  <div key={i} className="bg-[#111]/50 rounded p-3">
                    <div className="font-bold text-[#c0c0c0] text-sm mb-1">{o.scenario}</div>
                    <div className="text-xs text-amber-400 mb-1">Potential: {o.potential}</div>
                    <div className="text-xs text-[#888]">Action: {o.action}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {insights.recommendations && (
            <div className="bg-violet-500/10 rounded-lg p-4 border border-violet-500/20">
              <h4 className="text-violet-400 font-bold mb-3 flex items-center gap-2">
                <Target className="w-4 h-4" />
                Recommendations
              </h4>
              <div className="space-y-2">
                {insights.recommendations.recommendations?.map((r, i) => (
                  <div key={i} className="bg-[#111]/50 rounded p-3">
                    <div className="font-bold text-[#c0c0c0] text-sm mb-1">{r.title}</div>
                    <div className="text-xs text-[#888] mb-1">{r.action}</div>
                    <div className="text-xs text-violet-400">Impact: {r.impact}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {insights.overall && (
            <div className="bg-emerald-500/10 rounded-lg p-4 border border-emerald-500/20">
              <h4 className="text-emerald-400 font-bold mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Overall Analysis
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-emerald-400 font-bold mb-2">Strengths</div>
                  <ul className="space-y-1">
                    {insights.overall.strengths?.map((s, i) => (
                      <li key={i} className="text-xs text-[#c0c0c0] flex items-start gap-2">
                        <span className="text-emerald-400">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-xs text-red-400 font-bold mb-2">Weaknesses</div>
                  <ul className="space-y-1">
                    {insights.overall.weaknesses?.map((w, i) => (
                      <li key={i} className="text-xs text-[#c0c0c0] flex items-start gap-2">
                        <span className="text-red-400">•</span>
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-emerald-500/20">
                <div className="text-xs text-[#888] mb-1">Priority Focus</div>
                <div className="text-sm text-[#c0c0c0] font-bold mb-3">{insights.overall.priority}</div>
                <div className="text-xs text-[#888] mb-1">30-Day Forecast</div>
                <div className="text-sm text-[#c0c0c0]">{insights.overall.forecast}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}