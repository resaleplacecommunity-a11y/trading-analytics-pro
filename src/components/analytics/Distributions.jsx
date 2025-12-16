import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, Eye, EyeOff } from 'lucide-react';
import { formatNumber } from './analyticsCalculations';
import { useState } from 'react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function Distributions({ trades, onDrillDown }) {
  const [showOutliers, setShowOutliers] = useState(true);
  
  // Calculate R distribution
  const rValues = trades
    .filter(t => t.close_price && t.r_multiple !== null && t.r_multiple !== undefined && !isNaN(t.r_multiple))
    .map(t => t.r_multiple);
  
  // Calculate PNL distribution
  const pnlValues = trades
    .filter(t => t.close_price && t.pnl_usd !== null && t.pnl_usd !== undefined)
    .map(t => t.pnl_usd);
  
  // Create R histogram
  const createHistogram = (values, bins = 10, capOutliers = !showOutliers) => {
    if (values.length === 0) return [];
    
    let min = Math.min(...values);
    let max = Math.max(...values);
    
    if (capOutliers) {
      const q1 = values.sort((a, b) => a - b)[Math.floor(values.length * 0.25)];
      const q3 = values.sort((a, b) => a - b)[Math.floor(values.length * 0.75)];
      const iqr = q3 - q1;
      min = Math.max(min, q1 - 1.5 * iqr);
      max = Math.min(max, q3 + 1.5 * iqr);
    }
    
    const binSize = (max - min) / bins;
    const histogram = Array(bins).fill(0).map((_, i) => ({
      range: `${(min + i * binSize).toFixed(1)} - ${(min + (i + 1) * binSize).toFixed(1)}`,
      count: 0,
      trades: []
    }));
    
    values.forEach((val, idx) => {
      if (val >= min && val <= max) {
        const binIndex = Math.min(Math.floor((val - min) / binSize), bins - 1);
        histogram[binIndex].count++;
        histogram[binIndex].trades.push(trades[idx]);
      }
    });
    
    return histogram;
  };
  
  const rHistogram = createHistogram(rValues, 12);
  const pnlHistogram = createHistogram(pnlValues, 12);

  return (
    <div className="grid grid-cols-2 gap-6 mb-6">
      {/* R Distribution */}
      <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[#c0c0c0] flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-violet-400" />
            R Distribution
          </h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowOutliers(!showOutliers)}
            className="text-xs text-[#888] hover:text-[#c0c0c0]"
          >
            {showOutliers ? <Eye className="w-3 h-3 mr-1" /> : <EyeOff className="w-3 h-3 mr-1" />}
            Outliers
          </Button>
        </div>
        
        {rHistogram.length === 0 ? (
          <div className="text-center py-12 text-[#666]">
            <p className="text-sm">Not enough data</p>
            <p className="text-xs mt-1">Need trades with R multiples</p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={rHistogram}>
                <XAxis 
                  dataKey="range" 
                  stroke="#666" 
                  tick={{ fill: '#888', fontSize: 9 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis stroke="#666" tick={{ fill: '#888', fontSize: 11 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111', border: '1px solid #2a2a2a', borderRadius: '8px' }}
                  labelStyle={{ color: '#888' }}
                  formatter={(value) => [value, 'Trades']}
                />
                <Bar 
                  dataKey="count" 
                  radius={[4, 4, 0, 0]}
                  onClick={(data) => data.trades && data.trades.length > 0 && onDrillDown('R Range: ' + data.range, data.trades)}
                  cursor="pointer"
                  onMouseEnter={(data, index) => {
                    const bars = document.querySelectorAll('.recharts-bar-rectangle path');
                    if (bars[index]) {
                      bars[index].style.opacity = '0.5';
                    }
                  }}
                  onMouseLeave={(data, index) => {
                    const bars = document.querySelectorAll('.recharts-bar-rectangle path');
                    if (bars[index]) {
                      bars[index].style.opacity = '0.8';
                    }
                  }}
                >
                  {rHistogram.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill="#8b5cf6" opacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

          </>
        )}
      </div>

      {/* PNL Distribution */}
      <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[#c0c0c0] flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            PNL Distribution
          </h3>
        </div>
        
        {pnlHistogram.length === 0 ? (
          <div className="text-center py-12 text-[#666]">
            <p className="text-sm">Not enough data</p>
            <p className="text-xs mt-1">Need closed trades</p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pnlHistogram}>
                <XAxis 
                  dataKey="range" 
                  stroke="#666" 
                  tick={{ fill: '#888', fontSize: 9 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis stroke="#666" tick={{ fill: '#888', fontSize: 11 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111', border: '1px solid #2a2a2a', borderRadius: '8px' }}
                  labelStyle={{ color: '#888' }}
                  formatter={(value) => [value, 'Trades']}
                />
                <Bar 
                  dataKey="count" 
                  radius={[4, 4, 0, 0]}
                  onClick={(data) => data.trades && data.trades.length > 0 && onDrillDown('PNL Range: ' + data.range, data.trades)}
                  cursor="pointer"
                  onMouseEnter={(data, index) => {
                    const bars = document.querySelectorAll('.recharts-bar-rectangle path');
                    if (bars[index]) {
                      bars[index].style.opacity = '0.5';
                    }
                  }}
                  onMouseLeave={(data, index) => {
                    const bars = document.querySelectorAll('.recharts-bar-rectangle path');
                    if (bars[index]) {
                      bars[index].style.opacity = '0.8';
                    }
                  }}
                >
                  {pnlHistogram.map((entry, index) => {
                    const midRange = parseFloat(entry.range.split(' - ')[0]);
                    return (
                      <Cell key={`cell-${index}`} fill={midRange >= 0 ? '#10b981' : '#ef4444'} opacity={0.8} />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

          </>
        )}
      </div>
    </div>
  );
}