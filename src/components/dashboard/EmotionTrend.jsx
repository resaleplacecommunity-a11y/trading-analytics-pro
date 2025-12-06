import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from 'date-fns';

export default function EmotionTrend({ trades }) {
  // Group by date and calculate averages
  const grouped = trades.reduce((acc, trade) => {
    const dateKey = format(new Date(trade.date), 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = { 
        date: dateKey, 
        emotions: [], 
        confidence: [],
        pnl: 0
      };
    }
    if (trade.emotional_state) acc[dateKey].emotions.push(trade.emotional_state);
    if (trade.confidence_level) acc[dateKey].confidence.push(trade.confidence_level);
    acc[dateKey].pnl += (trade.pnl_usd || 0);
    return acc;
  }, {});

  const data = Object.values(grouped)
    .map(d => ({
      date: d.date,
      emotion: d.emotions.length > 0 ? 
        (d.emotions.reduce((a, b) => a + b, 0) / d.emotions.length).toFixed(1) : null,
      confidence: d.confidence.length > 0 ? 
        (d.confidence.reduce((a, b) => a + b, 0) / d.confidence.length).toFixed(1) : null,
      pnl: d.pnl
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3 shadow-xl">
          <p className="text-[#888] text-xs mb-2">{format(new Date(payload[0].payload.date), 'MMM dd')}</p>
          {payload.map((p, i) => (
            <p key={i} className="text-xs" style={{ color: p.color }}>
              {p.name}: {p.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
      <h3 className="text-[#c0c0c0] text-sm font-medium mb-4">Emotional & Confidence Trend</h3>
      <div className="h-48">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false}
                tick={{ fill: '#666', fontSize: 10 }}
                tickFormatter={(d) => format(new Date(d), 'MM/dd')}
              />
              <YAxis 
                domain={[0, 10]} 
                axisLine={false} 
                tickLine={false}
                tick={{ fill: '#666', fontSize: 10 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ fontSize: '11px' }}
                iconType="circle"
              />
              <Line 
                type="monotone" 
                dataKey="emotion" 
                name="Emotion"
                stroke="#f59e0b" 
                strokeWidth={2}
                dot={{ fill: '#f59e0b', r: 3 }}
              />
              <Line 
                type="monotone" 
                dataKey="confidence" 
                name="Confidence"
                stroke="#8b5cf6" 
                strokeWidth={2}
                dot={{ fill: '#8b5cf6', r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-[#666]">
            No data yet
          </div>
        )}
      </div>
    </div>
  );
}