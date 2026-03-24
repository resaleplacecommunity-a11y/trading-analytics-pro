import { 
  Globe2, Zap, Brain, TrendingUp, AlertCircle, FileText, BarChart3, Newspaper
} from "lucide-react";

function Clock(props) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
}

export function Intelligence() {
  return (
    <div className="flex flex-col h-full w-full bg-[#0a0b0f] text-zinc-300 font-sans overflow-hidden">
      
      {/* AI Summary Banner */}
      <div className="border-b border-teal-500/20 bg-gradient-to-r from-[#12131a] via-teal-900/10 to-[#12131a] p-6 z-10 flex gap-6 items-start shadow-md">
        <div className="w-12 h-12 rounded-lg border border-teal-500/30 bg-teal-900/20 flex flex-shrink-0 items-center justify-center relative overflow-hidden">
          <Brain className="w-6 h-6 text-teal-400 z-10" />
          <div className="absolute inset-0 bg-teal-500/10 animate-pulse"></div>
        </div>
        <div>
          <h2 className="text-zinc-100 font-semibold flex items-center gap-2 tracking-tight">
            AI Market Synthesis
            <span className="text-[10px] px-2 py-0.5 bg-teal-500/10 text-teal-400 rounded-full font-mono uppercase border border-teal-500/20">Updated 2m ago</span>
          </h2>
          <p className="text-[13px] text-zinc-400 leading-relaxed mt-2 max-w-4xl">
            <strong className="text-zinc-200">Current Bias: Bullish Consolidation.</strong> Market is absorbing recent structural supply. FOMC minutes at 14:00 EST remain the primary volatility catalyst. On-chain data shows sustained institutional accumulation in the 61-63k range. Altcoin narratives are rotating towards Layer 2 infrastructure. 
          </p>
          <div className="flex gap-4 mt-4">
            <div className="flex items-center gap-2 text-[11px] font-medium text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
              <TrendingUp className="w-3.5 h-3.5" /> High Conviction: BTC Support at 62k
            </div>
            <div className="flex items-center gap-2 text-[11px] font-medium text-amber-500 uppercase tracking-widest bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
              <AlertCircle className="w-3.5 h-3.5" /> Risk Event: FOMC at 14:00
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto relative z-10">
        <div className="grid grid-cols-12 gap-6 h-full">
          
          {/* Left Column: Narrative & Events */}
          <div className="col-span-4 flex flex-col gap-6">
            
            {/* Narrative Tracker */}
            <div className="flex-1 bg-[#12131a] border border-zinc-800/60 rounded-xl p-5 shadow-sm">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest flex items-center gap-2 mb-4">
                <Globe2 className="w-4 h-4 text-zinc-400" />
                Narrative Heatmap
              </h3>
              <div className="space-y-4">
                {[
                  { name: "Layer 2 Rollups", score: 85, trend: "up" },
                  { name: "RWA Integration", score: 72, trend: "up" },
                  { name: "DePIN", score: 68, trend: "flat" },
                  { name: "AI Agents", score: 45, trend: "down" },
                ].map((narrative, i) => (
                  <div key={i} className="group">
                    <div className="flex justify-between items-end mb-1.5">
                      <span className="text-sm text-zinc-300 font-medium group-hover:text-teal-400 transition">{narrative.name}</span>
                      <span className="text-xs font-mono text-zinc-500">{narrative.score}/100</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${narrative.trend === 'up' ? 'bg-teal-500' : narrative.trend === 'down' ? 'bg-zinc-600' : 'bg-teal-700'}`}
                        style={{ width: `${narrative.score}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Macro Events */}
            <div className="flex-1 bg-[#12131a] border border-zinc-800/60 rounded-xl p-5 shadow-sm">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-zinc-400" />
                Key Catalysts (48h)
              </h3>
              <div className="space-y-3 relative before:absolute before:inset-y-0 before:left-1.5 before:w-px before:bg-zinc-800">
                {[
                  { time: "Today, 14:00", event: "FOMC Minutes Release", impact: "High", color: "rose" },
                  { time: "Tomorrow, 08:30", event: "US Initial Jobless Claims", impact: "Med", color: "amber" },
                  { time: "Tomorrow, 16:00", event: "ETH Core Devs Call", impact: "Low", color: "zinc" },
                ].map((ev, i) => (
                  <div key={i} className="relative pl-6">
                    <div className={`absolute left-[3px] top-1.5 w-1.5 h-1.5 rounded-full ring-2 ring-[#12131a] bg-${ev.color}-500`}></div>
                    <div className="text-[10px] text-zinc-500 font-mono mb-0.5">{ev.time}</div>
                    <div className="text-sm text-zinc-300 font-medium">{ev.event}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Middle & Right: Market Feed */}
          <div className="col-span-8 bg-[#12131a] border border-zinc-800/60 rounded-xl p-0 shadow-sm flex flex-col overflow-hidden">
            <div className="p-5 border-b border-zinc-800/60 flex items-center justify-between">
               <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <Newspaper className="w-4 h-4 text-zinc-400" />
                Aggregated Intelligence Feed
              </h3>
              <div className="flex gap-2">
                {['All', 'News', 'On-chain', 'Social'].map(filter => (
                  <button key={filter} className={`px-2 py-1 rounded text-[10px] font-medium uppercase tracking-wider ${filter === 'All' ? 'bg-zinc-800 text-teal-400' : 'text-zinc-500 hover:text-zinc-300'}`}>
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {[
                { tag: 'On-chain', time: '12m ago', title: 'Significant exchange outflow detected for ETH', desc: '45,000 ETH moved from Binance to unknown cold wallets in the last hour.', icon: BarChart3, color: 'emerald' },
                { tag: 'Macro', time: '45m ago', title: 'Treasury yields spike ahead of FOMC', desc: '10-year yield breaks 4.2%. Historically correlates with short-term risk asset weakness.', icon: Zap, color: 'amber' },
                { tag: 'Social', time: '1h ago', title: 'Sentiment shift on Solana ecosystem', desc: 'X/Twitter positive mentions up 400% following new validator client announcement.', icon: Globe2, color: 'teal' },
                { tag: 'News', time: '2h ago', title: 'Regulatory clarification in EU jurisdiction', desc: 'MiCA framework implementation details finalized. Positive medium-term catalyst.', icon: FileText, color: 'zinc' },
              ].map((item, i) => (
                <div key={i} className="p-4 rounded-lg bg-[#0d0e12] border border-zinc-800/50 hover:border-zinc-700 transition flex gap-4 group">
                  <div className={`w-10 h-10 rounded-full bg-${item.color}-500/10 border border-${item.color}-500/20 flex flex-shrink-0 items-center justify-center mt-1`}>
                    <item.icon className={`w-4 h-4 text-${item.color}-500`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 uppercase tracking-widest">{item.tag}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">{item.time}</span>
                    </div>
                    <h4 className="text-sm font-semibold text-zinc-200 group-hover:text-teal-400 transition">{item.title}</h4>
                    <p className="text-[13px] text-zinc-400 mt-1.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
