import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, ReferenceLine } from 'recharts';

export default function CollapsibleChart({ 
  title, 
  icon: Icon, 
  iconColor, 
  data, 
  dataKey, 
  xKey, 
  yFormatter, 
  tooltipFormatter 
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 mb-6 overflow-hidden">
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between p-6 cursor-pointer hover:bg-[#1a1a1a]/50 transition-all"
      >
        <h3 className="text-lg font-bold text-[#c0c0c0] flex items-center gap-2">
          <Icon className={`w-5 h-5 ${iconColor}`} />
          {title}
        </h3>
        {isExpanded ? <ChevronUp className="w-5 h-5 text-[#888]" /> : <ChevronDown className="w-5 h-5 text-[#888]" />}
      </div>

      {isExpanded && (
        <div className="px-6 pb-6 border-t border-[#2a2a2a]/50">
          {data.length === 0 ? (
            <div className="text-center py-12 text-[#666]">
              <p className="text-sm">No data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" opacity={0.3} />
                <XAxis 
                  dataKey={xKey} 
                  stroke="#666" 
                  tick={{ fill: '#c0c0c0', fontSize: 11 }} 
                  angle={-45} 
                  textAnchor="end" 
                  height={60} 
                />
                <YAxis 
                  stroke="#666" 
                  tick={{ fill: '#c0c0c0', fontSize: 11 }} 
                  tickFormatter={yFormatter} 
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#c0c0c0' }}
                  labelStyle={{ color: '#c0c0c0' }}
                  itemStyle={{ color: '#c0c0c0' }}
                  formatter={tooltipFormatter}
                  cursor={{ fill: 'rgba(192, 192, 192, 0.1)' }}
                />
                {dataKey === 'pnl' && <ReferenceLine y={0} stroke="#c0c0c0" strokeDasharray="3 3" opacity={0.5} />}
                <Bar 
                  dataKey={dataKey} 
                  radius={[4, 4, 0, 0]}
                >
                  {data.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={dataKey === 'pnl' ? (entry[dataKey] >= 0 ? '#10b981' : '#ef4444') : '#06b6d4'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}