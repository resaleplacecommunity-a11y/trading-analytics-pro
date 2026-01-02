import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';

export default function PnlChart({ trades, period = 'daily' }) {
  const today = startOfDay(new Date());
  
  // Build last 7 days with all days present
  const data = [];
  for (let i = 6; i >= 0; i--) {
    const date = subDays(today, i);
    const dateKey = format(date, 'yyyy-MM-dd');
    
    // Closed trades PNL
    const dayTrades = trades.filter(t => {
      if (!t.close_price) return false;
      const tradeDate = format(startOfDay(new Date(t.date_close || t.date_open || t.date)), 'yyyy-MM-dd');
      return tradeDate === dateKey;
    });
    
    let pnl = dayTrades.reduce((sum, t) => sum + (t.pnl_usd || 0), 0);
    
    // Add partial closes from open trades on this day
    trades.filter(t => !t.close_price && t.partial_closes).forEach(t => {
      try {
        const partials = JSON.parse(t.partial_closes);
        partials.forEach(pc => {
          if (pc.timestamp) {
            const pcDate = format(startOfDay(new Date(pc.timestamp)), 'yyyy-MM-dd');
            if (pcDate === dateKey) {
              pnl += (pc.pnl_usd || 0);
            }
          }
        });
      } catch {}
    });
    
    data.push({
      date: dateKey,
      day: format(date, 'MM/dd'),
      pnl: pnl,
      count: dayTrades.length
    });
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      const formatWithSpaces = (num) => Math.round(num).toLocaleString('ru-RU').replace(/,/g, ' ');
      return (
        <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3 shadow-xl">
          <p className="text-[#888] text-xs mb-1">{format(new Date(d.date), 'MMM dd, yyyy')}</p>
          <p className={`text-sm font-bold ${d.pnl > 0 ? 'text-emerald-400' : d.pnl < 0 ? 'text-red-400' : 'text-[#888]'}`}>
            {d.pnl > 0 ? '+' : ''}${formatWithSpaces(d.pnl)}
          </p>
          <p className="text-[#666] text-xs mt-1">{d.count} trade{d.count !== 1 ? 's' : ''}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
      <h3 className="text-[#c0c0c0] text-sm font-medium mb-4">Daily PNL (Last 7 Days)</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
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
              tickFormatter={(val) => `$${val}`}
            />
            <Tooltip content={<CustomTooltip />} cursor={false} />
            <ReferenceLine y={0} stroke="#333" strokeWidth={1} />
            <Bar dataKey="pnl" radius={[4, 4, 4, 4]}>
              {data.map((entry, index) => {
                let fill = '#4a4a4a'; // neutral grey
                if (entry.pnl > 0) fill = '#10b981'; // green
                if (entry.pnl < 0) fill = '#ef4444'; // red
                
                return (
                  <Cell 
                    key={index} 
                    fill={fill}
                    className="transition-all duration-200 hover:opacity-80"
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}