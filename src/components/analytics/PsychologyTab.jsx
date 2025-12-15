import { Brain, TrendingUp, AlertCircle } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { cn } from "@/lib/utils";
import { applyFilters } from './filterUtils';

const formatNumber = (num) => {
  if (num === undefined || num === null || num === '') return '—';
  const n = parseFloat(num);
  if (isNaN(n)) return '—';
  return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
};

export default function PsychologyTab({ trades, filters }) {
  const filtered = applyFilters(trades, filters);
  const closedTrades = filtered.filter(t => t.close_price_final || t.close_price);

  // Confidence vs R correlation
  const confidenceData = closedTrades
    .filter(t => t.confidence !== undefined && t.confidence !== null)
    .map(t => ({
      confidence: t.confidence || 0,
      r: t.r_multiple || 0,
      pnl: t.pnl_total_usd || t.pnl_usd || 0
    }));

  // Calculate correlation
  const avgConfidence = confidenceData.length > 0 
    ? confidenceData.reduce((s, d) => s + d.confidence, 0) / confidenceData.length 
    : 0;
  const avgR = confidenceData.length > 0 
    ? confidenceData.reduce((s, d) => s + d.r, 0) / confidenceData.length 
    : 0;

  // Best state analysis
  const highConfTrades = closedTrades.filter(t => (t.confidence || 0) >= 7);
  const lowConfTrades = closedTrades.filter(t => (t.confidence || 0) < 7);

  const highConfAvgR = highConfTrades.length > 0 
    ? highConfTrades.reduce((s, t) => s + (t.r_multiple || 0), 0) / highConfTrades.length 
    : 0;
  const lowConfAvgR = lowConfTrades.length > 0 
    ? lowConfTrades.reduce((s, t) => s + (t.r_multiple || 0), 0) / lowConfTrades.length 
    : 0;

  // Satisfaction analysis
  const satisfactionData = closedTrades
    .filter(t => t.satisfaction !== undefined && t.satisfaction !== null)
    .map(t => ({
      satisfaction: t.satisfaction || 0,
      pnl: t.pnl_total_usd || t.pnl_usd || 0
    }));

  const avgSatisfaction = satisfactionData.length > 0
    ? satisfactionData.reduce((s, d) => s + d.satisfaction, 0) / satisfactionData.length
    : 0;

  return (
    <div className="space-y-4 mt-4">
      {/* Key Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-emerald-500/10 to-[#0d0d0d] rounded-xl p-5 border border-emerald-500/30">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-5 h-5 text-emerald-400" />
            <h3 className="text-emerald-400 text-sm font-medium">Your Best State</h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-[#888] mb-1">Confidence Range</p>
              <p className="text-2xl font-bold text-emerald-400">7-10</p>
            </div>
            <div className="bg-[#151515] rounded-lg p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-[#666]">Avg R (High Conf)</span>
                <span className="text-sm font-bold text-emerald-400">{highConfAvgR.toFixed(2)}R</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#666]">Avg R (Low Conf)</span>
                <span className="text-sm font-bold text-red-400">{lowConfAvgR.toFixed(2)}R</span>
              </div>
            </div>
            <p className="text-xs text-[#888]">
              You perform {((highConfAvgR / (lowConfAvgR || 1)) * 100 - 100).toFixed(0)}% better when confident
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500/10 to-[#0d0d0d] rounded-xl p-5 border border-red-500/30">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <h3 className="text-red-400 text-sm font-medium">Red Zone Detection</h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-[#888] mb-1">Stop Trading When</p>
              <div className="space-y-1 mt-2">
                <div className="flex items-center gap-2 text-xs text-red-400">
                  <div className="w-1 h-1 rounded-full bg-red-400" />
                  <span>Confidence &lt; 5</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-red-400">
                  <div className="w-1 h-1 rounded-full bg-red-400" />
                  <span>2+ consecutive losses</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-red-400">
                  <div className="w-1 h-1 rounded-full bg-red-400" />
                  <span>Daily loss &gt; -3%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confidence vs R Scatter */}
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
        <h3 className="text-[#c0c0c0] text-sm font-medium mb-4">Confidence vs R-Multiple</h3>
        {confidenceData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <XAxis 
                  dataKey="confidence" 
                  name="Confidence"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#666', fontSize: 10 }}
                  label={{ value: 'Confidence', position: 'insideBottom', offset: -5, fill: '#888', fontSize: 11 }}
                />
                <YAxis 
                  dataKey="r" 
                  name="R"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#666', fontSize: 10 }}
                  label={{ value: 'R-Multiple', angle: -90, position: 'insideLeft', fill: '#888', fontSize: 11 }}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload?.[0]) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3">
                          <p className="text-xs text-[#888]">Confidence: {data.confidence}</p>
                          <p className="text-sm text-[#c0c0c0] font-bold">{data.r.toFixed(2)}R</p>
                          <p className={cn(
                            "text-xs",
                            data.pnl >= 0 ? "text-emerald-400" : "text-red-400"
                          )}>
                            {data.pnl >= 0 ? '+' : ''}${formatNumber(data.pnl)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter data={confidenceData}>
                  {confidenceData.map((entry, index) => (
                    <Cell key={index} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-[#666] text-sm text-center py-12">No confidence data available</p>
        )}
      </div>

      {/* Satisfaction Metrics */}
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
        <h3 className="text-[#c0c0c0] text-sm font-medium mb-4">Satisfaction Metrics</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-xs text-[#888] mb-2">Avg Satisfaction</p>
            <p className="text-3xl font-bold text-[#c0c0c0]">{avgSatisfaction.toFixed(1)}</p>
            <p className="text-xs text-[#666] mt-1">/10</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-[#888] mb-2">High Sat. Trades</p>
            <p className="text-3xl font-bold text-emerald-400">
              {satisfactionData.filter(d => d.satisfaction >= 7).length}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-[#888] mb-2">Low Sat. Trades</p>
            <p className="text-3xl font-bold text-red-400">
              {satisfactionData.filter(d => d.satisfaction < 5).length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}