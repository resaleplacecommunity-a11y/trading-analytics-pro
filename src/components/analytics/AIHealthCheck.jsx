import { useState, useEffect } from 'react';
import { Sparkles, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cn } from "@/lib/utils";

export default function AIHealthCheck({ metrics, trades }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generateInsights();
  }, [metrics, trades]);

  const generateInsights = async () => {
    setLoading(true);
    
    try {
      // Prepare metrics summary
      const summary = {
        netPnl: metrics.netPnlUsd,
        winrate: metrics.winrate,
        avgR: metrics.avgR,
        maxDrawdown: metrics.maxDrawdown.percent,
        disciplineScore: metrics.disciplineScore,
        tradesCount: metrics.tradesCount,
        recentTrades: trades.slice(-10).map(t => ({
          pnl: t.pnl_usd,
          ruleCompliance: t.rule_compliance,
          hasAnalysis: !!(t.trade_analysis && t.trade_analysis.trim())
        }))
      };

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a trading performance analyst. Analyze these metrics and provide a health check:

Metrics:
- Net PNL: $${summary.netPnl.toFixed(0)} (${metrics.netPnlPercent.toFixed(1)}%)
- Win Rate: ${summary.winrate.toFixed(1)}%
- Avg R Multiple: ${summary.avgR.toFixed(2)}R
- Max Drawdown: ${summary.maxDrawdown.toFixed(1)}%
- Discipline Score: ${summary.disciplineScore}/100
- Total Trades: ${summary.tradesCount}

Recent 10 trades:
${summary.recentTrades.map((t, i) => `Trade ${i+1}: PNL $${t.pnl.toFixed(0)}, Rule Compliance: ${t.ruleCompliance ? 'Yes' : 'No'}, Has Analysis: ${t.hasAnalysis ? 'Yes' : 'No'}`).join('\n')}

Provide EXACTLY 3-5 bullet points in Russian:
1-2 bullets about what is improving (if anything)
1-2 bullets about what is worsening or concerning
1 bullet with 1 specific actionable recommendation

Keep each bullet under 15 words. Be direct and specific. Use trader language.`,
        response_json_schema: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["healthy", "warning", "danger"] },
            bullets: {
              type: "array",
              items: { type: "string" },
              minItems: 3,
              maxItems: 5
            }
          },
          required: ["status", "bullets"]
        }
      });

      setInsights(response);
    } catch (error) {
      console.error('Failed to generate health check:', error);
      // Fallback
      setInsights({
        status: metrics.netPnlUsd > 0 ? 'healthy' : 'warning',
        bullets: [
          `Net PNL: ${metrics.netPnlUsd >= 0 ? '+' : ''}$${metrics.netPnlUsd.toFixed(0)}`,
          `Win rate: ${metrics.winrate.toFixed(1)}%`,
          `Дисциплина: ${metrics.disciplineScore}/100`
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-6 mb-6">
        <div className="flex items-center justify-center gap-3 text-[#888]">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Analyzing performance...</span>
        </div>
      </div>
    );
  }

  if (!insights) return null;

  const statusConfig = {
    healthy: {
      bg: 'from-emerald-500/10 via-[#1a1a1a] to-emerald-500/5',
      border: 'border-emerald-500/30',
      icon: TrendingUp,
      iconColor: 'text-emerald-400',
      title: '✅ Healthy Performance',
      titleColor: 'text-emerald-400'
    },
    warning: {
      bg: 'from-amber-500/10 via-[#1a1a1a] to-amber-500/5',
      border: 'border-amber-500/30',
      icon: Sparkles,
      iconColor: 'text-amber-400',
      title: '⚠️ Needs Attention',
      titleColor: 'text-amber-400'
    },
    danger: {
      bg: 'from-red-500/10 via-[#1a1a1a] to-red-500/5',
      border: 'border-red-500/30',
      icon: TrendingDown,
      iconColor: 'text-red-400',
      title: '🚨 Critical Issues',
      titleColor: 'text-red-400'
    }
  };

  const config = statusConfig[insights.status] || statusConfig.warning;
  const Icon = config.icon;

  return (
    <div className={cn(
      "backdrop-blur-md bg-gradient-to-br rounded-xl border p-6 mb-6",
      config.bg,
      config.border
    )}>
      <div className="flex items-start gap-4">
        <Icon className={cn("w-6 h-6 mt-0.5", config.iconColor)} />
        <div className="flex-1">
          <h3 className={cn("text-lg font-bold mb-3", config.titleColor)}>
            {config.title}
          </h3>
          <ul className="space-y-2">
            {insights.bullets.map((bullet, idx) => (
              <li key={idx} className="text-sm text-[#c0c0c0] flex items-start gap-2">
                <span className="text-[#666] mt-0.5">•</span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}