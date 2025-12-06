import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export default function BehaviorChart({ behaviorLogs }) {
  // Group by trigger
  const triggerCounts = behaviorLogs.reduce((acc, log) => {
    acc[log.trigger_name] = (acc[log.trigger_name] || 0) + (log.trigger_count || 1);
    return acc;
  }, {});

  const data = Object.entries(triggerCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const colors = [
    '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4',
    '#10b981', '#f97316', '#6366f1', '#14b8a6', '#d946ef'
  ];

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3 shadow-xl">
          <p className="text-[#c0c0c0] text-sm font-medium">{payload[0].name}</p>
          <p className="text-[#888] text-xs">{payload[0].value} occurrences</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
      <h3 className="text-[#c0c0c0] text-sm font-medium mb-4">Behavioral Triggers Distribution</h3>
      {data.length > 0 ? (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="count"
              >
                {data.map((entry, index) => (
                  <Cell key={index} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ fontSize: '11px' }}
                formatter={(value) => <span className="text-[#888]">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-64 flex items-center justify-center text-[#666]">
          No behavior data yet
        </div>
      )}
    </div>
  );
}