import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatNumber, calculateMaxDrawdown } from './analyticsCalculations';
import { useState } from 'react';
import { cn } from "@/lib/utils";

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-3 shadow-xl">
        <p className="text-xs text-[#888] mb-2">{label}</p>
        <p className="text-sm font-bold text-emerald-400">
          ${formatNumber(payload[0].value)}
        </p>
        {payload[0].payload.pnl !== undefined && (
          <p className={cn(
            "text-xs mt-1",
            payload[0].payload.pnl >= 0 ? "text-emerald-400" : "text-red-400"
          )}>
            {payload[0].payload.pnl >= 0 ? '+' : ''}${formatNumber(payload[0].payload.pnl)}
          </p>
        )}
      </div>
    );
  }
  return null;
};

export default function EquityDrawdownCharts({ equityCurve, startBalance }) {
  const [showDrawdown, setShowDrawdown] = useState(false);
  
  // Calculate drawdown data
  const drawdownData = equityCurve.map((point, idx) => {
    const peak = equityCurve.slice(0, idx + 1).reduce((max, p) => Math.max(max, p.equity), 0);
    const dd = peak > 0 ? ((peak - point.equity) / peak) * 100 : 0;
    return { ...point, drawdown: -dd };
  });
  
  const maxDD = calculateMaxDrawdown(equityCurve);
  const currentEquity = equityCurve[equityCurve.length - 1]?.equity || startBalance;
  const totalPnl = currentEquity - startBalance;
  const totalPnlPercent = ((totalPnl / startBalance) * 100).toFixed(1);

  return (
    <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-6 mb-6 hover:border-[#c0c0c0]/20 transition-all">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-[#c0c0c0] mb-1 flex items-center gap-2">
            {showDrawdown ? <TrendingDown className="w-5 h-5 text-red-400" /> : <TrendingUp className="w-5 h-5 text-emerald-400" />}
            {showDrawdown ? 'Drawdown Curve' : 'Equity Curve'}
          </h3>
          <p className="text-xs text-[#666]">
            {showDrawdown 
              ? `Max Drawdown: ${maxDD.toFixed(1)}%` 
              : `Total: ${totalPnl >= 0 ? '+' : ''}$${formatNumber(Math.abs(totalPnl))} (${totalPnlPercent}%)`
            }
          </p>
        </div>
        <button
          onClick={() => setShowDrawdown(!showDrawdown)}
          className="px-3 py-1.5 text-xs font-medium bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg hover:bg-[#222] hover:border-[#c0c0c0]/30 transition-all text-[#c0c0c0]"
        >
          Toggle View
        </button>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        {showDrawdown ? (
          <AreaChart data={drawdownData}>
            <defs>
              <linearGradient id="colorDD" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" opacity={0.3} />
            <XAxis 
              dataKey="date" 
              stroke="#666" 
              tick={{ fill: '#888', fontSize: 11 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              stroke="#666" 
              tick={{ fill: '#888', fontSize: 11 }}
              tickFormatter={(val) => `${val.toFixed(0)}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
            <Area 
              type="monotone" 
              dataKey="drawdown" 
              stroke="#ef4444" 
              strokeWidth={2}
              fill="url(#colorDD)" 
            />
          </AreaChart>
        ) : (
          <AreaChart data={equityCurve}>
            <defs>
              <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" opacity={0.3} />
            <XAxis 
              dataKey="date" 
              stroke="#666" 
              tick={{ fill: '#888', fontSize: 11 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              stroke="#666" 
              tick={{ fill: '#888', fontSize: 11 }}
              tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={startBalance} stroke="#666" strokeDasharray="3 3" />
            <Area 
              type="monotone" 
              dataKey="equity" 
              stroke="#10b981" 
              strokeWidth={2}
              fill="url(#colorEquity)" 
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}