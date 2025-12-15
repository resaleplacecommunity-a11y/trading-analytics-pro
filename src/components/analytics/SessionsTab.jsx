import { Clock, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { cn } from "@/lib/utils";
import { applyFilters } from './filterUtils';

const formatNumber = (num) => {
  if (num === undefined || num === null || num === '') return '—';
  const n = parseFloat(num);
  if (isNaN(n)) return '—';
  return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
};

export default function SessionsTab({ trades, filters }) {
  const filtered = applyFilters(trades, filters);
  const closedTrades = filtered.filter(t => t.close_price_final || t.close_price);

  // Day of week analysis
  const dayOfWeekStats = {
    'Mon': { trades: 0, pnl: 0, wins: 0, totalR: 0 },
    'Tue': { trades: 0, pnl: 0, wins: 0, totalR: 0 },
    'Wed': { trades: 0, pnl: 0, wins: 0, totalR: 0 },
    'Thu': { trades: 0, pnl: 0, wins: 0, totalR: 0 },
    'Fri': { trades: 0, pnl: 0, wins: 0, totalR: 0 },
    'Sat': { trades: 0, pnl: 0, wins: 0, totalR: 0 },
    'Sun': { trades: 0, pnl: 0, wins: 0, totalR: 0 }
  };

  closedTrades.forEach(t => {
    const date = new Date(t.date_open);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const day = dayNames[date.getDay()];
    
    const pnl = t.pnl_total_usd || t.pnl_usd || 0;
    
    dayOfWeekStats[day].trades++;
    dayOfWeekStats[day].pnl += pnl;
    dayOfWeekStats[day].totalR += t.r_multiple || 0;
    if (pnl > 0) dayOfWeekStats[day].wins++;
  });

  const dayOfWeekData = Object.entries(dayOfWeekStats).map(([day, stats]) => ({
    day,
    pnl: stats.pnl,
    trades: stats.trades,
    winrate: stats.trades > 0 ? (stats.wins / stats.trades * 100) : 0,
    avgR: stats.trades > 0 ? stats.totalR / stats.trades : 0
  }));

  // Hour of day analysis
  const hourStats = {};
  for (let i = 0; i < 24; i++) {
    hourStats[i] = { hour: i, trades: 0, pnl: 0, wins: 0 };
  }

  closedTrades.forEach(t => {
    const date = new Date(t.date_open);
    const hour = date.getHours();
    
    const pnl = t.pnl_total_usd || t.pnl_usd || 0;
    
    hourStats[hour].trades++;
    hourStats[hour].pnl += pnl;
    if (pnl > 0) hourStats[hour].wins++;
  });

  const hourData = Object.values(hourStats)
    .filter(h => h.trades > 0)
    .map(h => ({
      hour: `${h.hour}:00`,
      pnl: h.pnl,
      trades: h.trades,
      winrate: (h.wins / h.trades * 100).toFixed(0)
    }));

  // Best/Worst times
  const bestDay = dayOfWeekData.reduce((max, d) => d.pnl > max.pnl ? d : max, dayOfWeekData[0]);
  const worstDay = dayOfWeekData.reduce((min, d) => d.pnl < min.pnl ? d : min, dayOfWeekData[0]);
  
  const bestHour = hourData.length > 0 
    ? hourData.reduce((max, h) => h.pnl > max.pnl ? h : max, hourData[0])
    : null;
  const worstHour = hourData.length > 0
    ? hourData.reduce((min, h) => h.pnl < min.pnl ? h : min, hourData[0])
    : null;

  return (
    <div className="space-y-4 mt-4">
      {/* Best/Worst Times */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-emerald-500/10 to-[#0d0d0d] rounded-xl p-5 border border-emerald-500/30">
          <h3 className="text-emerald-400 text-sm font-medium mb-4">Best Times</h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-[#888] mb-1">Best Day</p>
              <p className="text-2xl font-bold text-emerald-400">{bestDay?.day}</p>
              <p className="text-xs text-[#666] mt-1">+${formatNumber(bestDay?.pnl || 0)}</p>
            </div>
            {bestHour && (
              <div>
                <p className="text-xs text-[#888] mb-1">Best Hour</p>
                <p className="text-2xl font-bold text-emerald-400">{bestHour.hour}</p>
                <p className="text-xs text-[#666] mt-1">+${formatNumber(bestHour.pnl)}</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500/10 to-[#0d0d0d] rounded-xl p-5 border border-red-500/30">
          <h3 className="text-red-400 text-sm font-medium mb-4">Worst Times (Avoid)</h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-[#888] mb-1">Worst Day</p>
              <p className="text-2xl font-bold text-red-400">{worstDay?.day}</p>
              <p className="text-xs text-[#666] mt-1">{worstDay?.pnl < 0 ? '-' : ''}${formatNumber(Math.abs(worstDay?.pnl || 0))}</p>
            </div>
            {worstHour && (
              <div>
                <p className="text-xs text-[#888] mb-1">Worst Hour</p>
                <p className="text-2xl font-bold text-red-400">{worstHour.hour}</p>
                <p className="text-xs text-[#666] mt-1">-${formatNumber(Math.abs(worstHour.pnl))}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Day of Week Heatmap */}
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
        <h3 className="text-[#c0c0c0] text-sm font-medium mb-4">Day of Week Performance</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dayOfWeekData}>
              <XAxis 
                dataKey="day" 
                axisLine={false} 
                tickLine={false}
                tick={{ fill: '#666', fontSize: 11 }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false}
                tick={{ fill: '#666', fontSize: 10 }}
                tickFormatter={(val) => `$${val}`}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload?.[0]) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3">
                        <p className="text-[#c0c0c0] text-sm font-bold">{d.day}</p>
                        <p className={cn(
                          "text-sm",
                          d.pnl >= 0 ? "text-emerald-400" : "text-red-400"
                        )}>
                          {d.pnl >= 0 ? '+' : ''}${formatNumber(d.pnl)}
                        </p>
                        <p className="text-xs text-[#888]">{d.trades} trades • WR: {d.winrate.toFixed(0)}%</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {dayOfWeekData.map((entry, index) => (
                  <Cell key={index} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Hour of Day */}
      {hourData.length > 0 && (
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
          <h3 className="text-[#c0c0c0] text-sm font-medium mb-4">Hour of Day Performance</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourData}>
                <XAxis 
                  dataKey="hour" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fill: '#666', fontSize: 9 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fill: '#666', fontSize: 10 }}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload?.[0]) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3">
                          <p className="text-[#c0c0c0] text-sm font-bold">{d.hour}</p>
                          <p className={cn(
                            "text-sm",
                            d.pnl >= 0 ? "text-emerald-400" : "text-red-400"
                          )}>
                            {d.pnl >= 0 ? '+' : ''}${formatNumber(d.pnl)}
                          </p>
                          <p className="text-xs text-[#888]">{d.trades} trades</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {hourData.map((entry, index) => (
                    <Cell key={index} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}