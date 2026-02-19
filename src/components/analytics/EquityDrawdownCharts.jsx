import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatNumber } from './analyticsCalculations';
import { useState, useMemo } from 'react';

const CustomTooltip = ({ active, payload, viewMode }) => {
  if (!active || !payload || payload.length === 0) return null;
  
  const data = payload[0].payload;
  
  return (
    <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-3">
      <div className="text-xs text-[#c0c0c0] mb-1">{data.date}</div>
      {viewMode === 'equity' ? (
        <>
          <div className="text-sm font-bold text-emerald-400">${data.equity?.toLocaleString('ru-RU')}</div>
          {data.pnl !== undefined && (
            <div className={`text-xs ${data.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {data.pnl >= 0 ? '+' : '−'}${Math.round(Math.abs(data.pnl)).toLocaleString('ru-RU')}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="text-sm font-bold text-red-400">−{Math.abs(data.drawdown)?.toFixed(2)}%</div>
          <div className="text-xs text-red-400">−${Math.abs(data.drawdownUsd || 0).toLocaleString('ru-RU')}</div>
        </>
      )}
    </div>
  );
};

export default function EquityDrawdownCharts({ equityCurve, startBalance }) {
  const [viewMode, setViewMode] = useState('equity'); // 'equity' or 'drawdown'

  // Calculate drawdown curve - inverted so 0 is top and drawdown goes down
  const drawdownData = useMemo(() => {
    let peak = startBalance;
    return equityCurve.map(point => {
      if (point.equity > peak) peak = point.equity;
      const drawdownPercent = ((point.equity - peak) / peak) * 100; // negative value
      const drawdownUsd = point.equity - peak; // negative value
      return {
        ...point,
        drawdown: drawdownPercent, // keep negative
        drawdownUsd: drawdownUsd // keep negative
      };
    });
  }, [equityCurve, startBalance]);

  const maxDrawdownPercent = Math.abs(Math.min(...drawdownData.map(d => d.drawdown)));
  const maxDrawdownUsd = Math.abs(Math.min(...drawdownData.map(d => d.drawdownUsd)));
  const maxEquity = Math.max(...equityCurve.map(p => p.equity));
  const currentEquity = equityCurve[equityCurve.length - 1]?.equity || startBalance;
  const totalPnl = currentEquity - startBalance;
  const totalPnlPercent = ((totalPnl / startBalance) * 100).toFixed(1);

  return (
    <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-6 mb-6 hover:border-[#c0c0c0]/20 transition-all">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-[#c0c0c0] mb-1 flex items-center gap-2">
            {viewMode === 'drawdown' ? <TrendingDown className="w-5 h-5 text-red-400" /> : <TrendingUp className="w-5 h-5 text-emerald-400" />}
            {viewMode === 'drawdown' ? 'Drawdown Curve' : 'Equity Curve'}
          </h3>
          <p className="text-xs text-[#666]">
            {viewMode === 'drawdown' 
              ? `Max DD: −${maxDrawdownPercent.toFixed(1)}% / −$${formatNumber(maxDrawdownUsd)} | Peak: $${formatNumber(maxEquity)}` 
              : `Total: ${totalPnl >= 0 ? '+' : '−'}$${formatNumber(Math.abs(totalPnl))} (${totalPnl >= 0 ? '+' : '−'}${Math.abs(parseFloat(totalPnlPercent))}%) | Peak: $${formatNumber(maxEquity)}`
            }
          </p>
        </div>
        <button
          onClick={() => setViewMode(viewMode === 'equity' ? 'drawdown' : 'equity')}
          className="px-3 py-1.5 text-xs font-medium bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg hover:bg-[#222] hover:border-[#c0c0c0]/30 transition-all text-[#c0c0c0]"
        >
          Toggle View
        </button>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        {viewMode === 'drawdown' ? (
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
              tick={{ fill: '#c0c0c0', fontSize: 11 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              stroke="#666" 
              tick={{ fill: '#c0c0c0', fontSize: 11 }}
              tickFormatter={(val) => `${val.toFixed(0)}%`}
              domain={['auto', 0]}
            />
            <Tooltip content={<CustomTooltip viewMode="drawdown" />} cursor={{ fill: 'rgba(192, 192, 192, 0.05)' }} />
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
              tick={{ fill: '#c0c0c0', fontSize: 11 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              stroke="#666" 
              tick={{ fill: '#c0c0c0', fontSize: 11 }}
              tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip viewMode="equity" />} cursor={{ fill: 'rgba(192, 192, 192, 0.05)' }} />
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