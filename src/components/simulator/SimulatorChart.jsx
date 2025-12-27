import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function SimulatorChart({ simulation }) {
  const equityCurve = typeof simulation.equity_curve === 'string' 
    ? JSON.parse(simulation.equity_curve) 
    : simulation.equity_curve;

  const tradesData = typeof simulation.trades_data === 'string'
    ? JSON.parse(simulation.trades_data)
    : simulation.trades_data;

  // Prepare drawdown data
  const drawdownData = tradesData
    .filter((_, idx) => idx % simulation.trades_per_day === 0)
    .map((t) => ({
      day: t.day,
      drawdown: -t.drawdown
    }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3">
          <p className="text-[#888] text-xs mb-1">Day {payload[0].payload.day}</p>
          <p className="text-[#c0c0c0] font-bold">
            ${payload[0].value.toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
  };

  const DrawdownTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3">
          <p className="text-[#888] text-xs mb-1">Day {payload[0].payload.day}</p>
          <p className="text-red-400 font-bold">
            {Math.abs(payload[0].value).toFixed(2)}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Equity Curve */}
      <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-2xl border-2 border-[#2a2a2a] p-6">
        <h3 className="text-lg font-bold text-[#c0c0c0] mb-6">Equity Curve</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={equityCurve}>
            <defs>
              <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis 
              dataKey="day" 
              stroke="#666"
              label={{ value: 'Days', position: 'insideBottom', offset: -5, fill: '#888' }}
            />
            <YAxis 
              stroke="#666"
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area 
              type="monotone" 
              dataKey="equity" 
              stroke="#10b981" 
              strokeWidth={2}
              fill="url(#equityGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Drawdown Chart */}
      <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-2xl border-2 border-[#2a2a2a] p-6">
        <h3 className="text-lg font-bold text-[#c0c0c0] mb-6">Drawdown</h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={drawdownData}>
            <defs>
              <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis 
              dataKey="day" 
              stroke="#666"
              label={{ value: 'Days', position: 'insideBottom', offset: -5, fill: '#888' }}
            />
            <YAxis 
              stroke="#666"
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip content={<DrawdownTooltip />} />
            <Area 
              type="monotone" 
              dataKey="drawdown" 
              stroke="#ef4444" 
              strokeWidth={2}
              fill="url(#drawdownGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}