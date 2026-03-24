import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import { Layers, Activity, Maximize, ArrowDownRight, ArrowUpRight } from "lucide-react";

export function Flow() {
  const domAsks = Array.from({ length: 15 }, (_, i) => ({
    price: 64300 + (14 - i) * 10,
    size: Math.random() * 5 + 1,
    total: 0
  })).map((d, i, arr) => {
    d.total = arr.slice(0, i + 1).reduce((sum, item) => sum + item.size, 0);
    return d;
  });

  const domBids = Array.from({ length: 15 }, (_, i) => ({
    price: 64290 - i * 10,
    size: Math.random() * 5 + 1,
    total: 0
  })).map((d, i, arr) => {
    d.total = arr.slice(0, i + 1).reduce((sum, item) => sum + item.size, 0);
    return d;
  });

  const volClusters = Array.from({ length: 20 }, (_, i) => ({
    price: 64000 + i * 50,
    volume: Math.random() * 100,
    delta: (Math.random() - 0.4) * 50,
    id: `vol-cluster-${i}`
  }));

  return (
    <div className="flex h-full w-full bg-[#0a0b0f] text-zinc-300 font-sans overflow-hidden">
      
      {/* Left sidebar: Liquidity & Orderbook */}
      <div className="w-[300px] border-r border-zinc-800/60 bg-[#12131a] flex flex-col z-10">
        <div className="h-12 border-b border-zinc-800/60 flex items-center justify-between px-4">
           <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
            <Layers className="w-3.5 h-3.5" />
            DOM / Liquidity
          </h3>
          <span className="text-zinc-100 font-bold text-sm">BTC/USD</span>
        </div>

        <div className="flex-1 overflow-y-auto p-2 flex flex-col font-mono text-xs">
          {/* Asks (Red) */}
          <div className="flex-1 flex flex-col justify-end mb-2">
            {domAsks.map((ask, i) => (
              <div key={i} className="flex justify-between py-0.5 px-2 relative group hover:bg-zinc-800/50 cursor-crosshair">
                <div className="absolute right-0 top-0 bottom-0 bg-rose-500/10 z-0" style={{ width: `${(ask.total / 100) * 100}%` }}></div>
                <span className="text-rose-400 z-10">{ask.price.toFixed(1)}</span>
                <span className="text-zinc-300 z-10">{ask.size.toFixed(3)}</span>
                <span className="text-zinc-500 z-10">{ask.total.toFixed(3)}</span>
              </div>
            ))}
          </div>

          {/* Spread */}
          <div className="py-2 px-2 flex justify-between items-center border-y border-zinc-800/60 bg-[#0d0e12] my-1">
            <span className="text-sm font-bold text-zinc-100">64,295.5</span>
            <span className="text-zinc-500 text-[10px]">Spread 10.0</span>
          </div>

          {/* Bids (Green) */}
          <div className="flex-1 flex flex-col">
            {domBids.map((bid, i) => (
              <div key={i} className="flex justify-between py-0.5 px-2 relative group hover:bg-zinc-800/50 cursor-crosshair">
                <div className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 z-0" style={{ width: `${(bid.total / 100) * 100}%` }}></div>
                <span className="text-emerald-400 z-10">{bid.price.toFixed(1)}</span>
                <span className="text-zinc-300 z-10">{bid.size.toFixed(3)}</span>
                <span className="text-zinc-500 z-10">{bid.total.toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main flow area */}
      <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">
        
        {/* Top Flow Metrics */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Cumulative CVD (1H)', val: '+452 BTC', icon: ArrowUpRight, color: 'emerald' },
            { label: 'Taker Buy/Sell Ratio', val: '1.24', icon: Activity, color: 'teal' },
            { label: 'Liquidity Imbalance', val: 'Bid Heavy', icon: Maximize, color: 'zinc' },
            { label: 'Funding Rate', val: '0.0120%', icon: ArrowDownRight, color: 'rose' },
          ].map((metric, i) => (
            <div key={i} className="bg-[#12131a] border border-zinc-800/60 rounded-xl p-4 shadow-sm">
               <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">{metric.label}</h3>
               <div className="flex items-center gap-2">
                 <metric.icon className={`w-4 h-4 text-${metric.color}-400`} />
                 <span className={`text-lg font-bold text-zinc-100 ${metric.color === 'emerald' ? 'text-emerald-400' : metric.color === 'rose' ? 'text-rose-400' : ''}`}>
                   {metric.val}
                 </span>
               </div>
            </div>
          ))}
        </div>

        {/* Volume Clusters & Key Levels */}
        <div className="flex-1 grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-[#12131a] border border-zinc-800/60 rounded-xl p-5 shadow-sm flex flex-col relative h-[400px]">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-4">Volume Profile & Delta Clusters</h3>
            <div className="flex-1 w-full relative h-[300px]">
              <div className="absolute inset-0">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={volClusters} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="id" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} width={60} tickFormatter={(val) => {
                    const match = volClusters.find(d => d.id === val);
                    return match ? match.price.toString() : '';
                  }} />
                  <Bar dataKey="volume" barSize={12} fill="#3f3f46" opacity={0.5} radius={[0, 4, 4, 0]} />
                  <Bar dataKey="delta" barSize={8} radius={[0, 2, 2, 0]}>
                    {volClusters.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.delta > 0 ? '#10b981' : '#f43f5e'} opacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="col-span-1 bg-[#12131a] border border-zinc-800/60 rounded-xl p-5 shadow-sm">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-4">Structural Levels</h3>
            <div className="space-y-3 font-mono text-sm">
              {[
                { label: 'Weekly VAH', price: '65,800', type: 'res' },
                { label: 'Daily VAH', price: '64,950', type: 'res' },
                { label: 'POC', price: '63,200', type: 'neut' },
                { label: 'Daily VAL', price: '62,500', type: 'sup' },
                { label: 'Weekly VAL', price: '61,200', type: 'sup' },
              ].map((lvl, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded bg-[#0d0e12] border border-zinc-800/50">
                  <span className="text-xs text-zinc-400">{lvl.label}</span>
                  <span className={`font-bold ${lvl.type === 'res' ? 'text-rose-400' : lvl.type === 'sup' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {lvl.price}
                  </span>
                </div>
              ))}
            </div>
            
            <div className="mt-6 p-4 bg-teal-900/10 border border-teal-500/20 rounded-lg">
              <p className="text-xs text-teal-400/80 leading-relaxed">
                <strong className="text-teal-400 font-semibold block mb-1">AI Flow Insight:</strong>
                Strong passive bids detected at 62,500 absorbing taker sell pressure over the last 4 hours.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
