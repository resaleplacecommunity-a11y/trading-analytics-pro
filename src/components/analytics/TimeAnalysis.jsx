import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatInTimeZone } from 'date-fns-tz';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function TimeAnalysis({ trades }) {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });
  
  const userTimezone = user?.preferred_timezone || 'UTC';
  
  // Hour analysis
  const hourData = Array(24).fill(null).map((_, i) => ({
    hour: i,
    pnl: 0,
    trades: 0
  }));

  trades.forEach(t => {
    const dateStr = t.date_close || t.date_open || t.date;
    if (!dateStr) return;
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) return;
    const hour = parseInt(formatInTimeZone(dateObj, userTimezone, 'H'));
    hourData[hour].pnl += (t.pnl_usd || 0);
    hourData[hour].trades += 1;
  });

  // Day of week analysis - using Monday-first order
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayData = dayNames.map((name) => ({
    day: name,
    pnl: 0,
    trades: 0
  }));

  trades.forEach(t => {
    const dateStr = t.date_close || t.date_open || t.date;
    if (!dateStr) return;
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) return;
    const dayOfWeek = formatInTimeZone(dateObj, userTimezone, 'EEE'); // Mon, Tue, etc
    const dayIndex = dayNames.indexOf(dayOfWeek);
    if (dayIndex >= 0) {
      dayData[dayIndex].pnl += (t.pnl_usd || 0);
      dayData[dayIndex].trades += 1;
    }
  });

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3 shadow-xl">
          <p className="text-[#888] text-xs mb-1">{label}</p>
          <p className={`text-sm font-bold ${payload[0].value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            ${payload[0].value.toFixed(2)}
          </p>
          <p className="text-[#666] text-xs">{payload[0].payload.trades} trades</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
        <h3 className="text-[#c0c0c0] text-sm font-medium mb-4">Performance by Hour</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourData.filter(h => h.trades > 0)}>
              <XAxis 
                dataKey="hour" 
                axisLine={false} 
                tickLine={false}
                tick={{ fill: '#666', fontSize: 10 }}
                tickFormatter={(h) => `${h}:00`}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false}
                tick={{ fill: '#666', fontSize: 10 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {hourData.map((entry, index) => (
                  <Cell key={index} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
        <h3 className="text-[#c0c0c0] text-sm font-medium mb-4">Performance by Day</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dayData}>
              <XAxis 
                dataKey="day" 
                axisLine={false} 
                tickLine={false}
                tick={{ fill: '#666', fontSize: 10 }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false}
                tick={{ fill: '#666', fontSize: 10 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {dayData.map((entry, index) => (
                  <Cell key={index} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}