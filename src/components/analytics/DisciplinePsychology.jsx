import { Brain, Heart, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from "@/lib/utils";

export default function DisciplinePsychology({ trades, disciplineScore }) {
  // Calculate confidence/emotion trends
  const tradesWithData = trades
    .filter(t => t.confidence_level !== undefined || t.emotional_state !== undefined)
    .sort((a, b) => new Date(a.date_open || a.date) - new Date(b.date_open || b.date));
  
  const trendData = tradesWithData.slice(-20).map((t, idx) => ({
    index: idx,
    confidence: t.confidence_level || 0,
    emotion: t.emotional_state || 0,
    date: new Date(t.date_open || t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }));

  // Calculate compliance metrics
  const totalTrades = trades.length;
  const withReason = trades.filter(t => t.entry_reason && t.entry_reason.trim().length > 0).length;
  const withAnalysis = trades.filter(t => t.trade_analysis && t.trade_analysis.trim().length > 0).length;
  const withRuleCompliance = trades.filter(t => t.rule_compliance === true).length;
  const goodRisk = trades.filter(t => t.close_price && (t.risk_percent || 0) <= 3).length;

  const complianceItems = [
    { label: 'Entry Reason', value: totalTrades > 0 ? (withReason / totalTrades) * 100 : 0, count: withReason },
    { label: 'Post Analysis', value: totalTrades > 0 ? (withAnalysis / totalTrades) * 100 : 0, count: withAnalysis },
    { label: 'Rule Compliance', value: totalTrades > 0 ? (withRuleCompliance / totalTrades) * 100 : 0, count: withRuleCompliance },
    { label: 'Risk ≤ 3%', value: totalTrades > 0 ? (goodRisk / totalTrades) * 100 : 0, count: goodRisk }
  ];

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-3 shadow-xl">
          <p className="text-xs text-[#888] mb-1">{payload[0].payload.date}</p>
          {payload.map((entry, idx) => (
            <p key={idx} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value.toFixed(1)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-6">
      <h3 className="text-lg font-bold text-[#c0c0c0] mb-6 flex items-center gap-2">
        <Brain className="w-5 h-5 text-violet-400" />
        Discipline & Psychology
      </h3>

      <div className="grid grid-cols-2 gap-6">
        {/* Discipline Score Circle */}
        <div className="flex items-center gap-6">
          <div className="relative w-32 h-32">
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

        {/* Confidence & Emotion Trend */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-[#c0c0c0]">Confidence & Emotional Trend</div>
          </div>
          
          {trendData.length === 0 ? (
            <div className="text-center py-12 text-[#666]">
              <p className="text-sm">No psychology data</p>
              <p className="text-xs mt-1">Track confidence & emotion in trades</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={trendData}>
                <XAxis 
                  dataKey="date" 
                  stroke="#666" 
                  tick={{ fill: '#888', fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  stroke="#666" 
                  tick={{ fill: '#888', fontSize: 11 }}
                  domain={[0, 10]}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="confidence" 
                  stroke="#a78bfa" 
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Confidence"
                />
                <Line 
                  type="monotone" 
                  dataKey="emotion" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Emotion"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}