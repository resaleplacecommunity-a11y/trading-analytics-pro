import { useState } from "react";
import { 
  LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area,
  ComposedChart, Bar
} from "recharts";
import { 
  ChevronDown, Maximize2, MessageSquare, Bot, AlertCircle, FileText, 
  Settings2, Info, Send, Paperclip, Mic, Layout, Search, Zap, CheckCircle2,
  XCircle, Clock, Activity, LineChart as LineChartIcon, Eye, Target
} from "lucide-react";

const chartData = Array.from({ length: 100 }, (_, i) => {
  const base = 60000;
  const variation = Math.sin(i / 5) * 2000 + Math.cos(i / 2) * 1000 + (Math.random() - 0.5) * 500;
  return {
    time: `10:${String(i).padStart(2, '0')}`,
    price: base + variation + i * 50,
    volume: Math.random() * 1000 + 500,
    id: `time-data-point-${i}`
  };
});

const drawerTabs = ["News", "Fundamentals", "On-chain", "DOM", "Key Levels"];

export function Terminal() {
  const [activeDrawerTab, setActiveDrawerTab] = useState(drawerTabs[0]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [botMode, setBotMode] = useState("Validator");
  
  return (
    <div className="flex h-full w-full bg-[#0a0b0f] text-zinc-300 font-sans overflow-hidden">
      {/* Left Area: Chart Workspace */}
      <div className="flex-[6.5] flex flex-col border-r border-zinc-800/60 h-full relative z-10">
        
        {/* Session Header / Toolbar */}
        <div className="h-12 border-b border-zinc-800/60 bg-[#12131a] flex items-center justify-between px-3 z-20">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 hover:bg-zinc-800/50 px-2 py-1 rounded cursor-pointer transition">
              <span className="text-zinc-100 font-bold tracking-widest text-lg">BTC/USD</span>
              <ChevronDown className="w-4 h-4 text-zinc-500" />
            </div>
            
            <div className="h-4 w-[1px] bg-zinc-800" />
            
            <div className="flex gap-1">
              {['1m', '5m', '15m', '1h', '4h', 'D'].map(tf => (
                <button key={tf} className={`px-2 py-1 rounded text-xs font-medium ${tf === '4h' ? 'bg-zinc-800 text-teal-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}>
                  {tf}
                </button>
              ))}
              <div className="flex items-center ml-1 text-zinc-500 hover:text-zinc-300 cursor-pointer">
                <ChevronDown className="w-3 h-3" />
              </div>
            </div>
            
            <div className="h-4 w-[1px] bg-zinc-800" />
            
            <div className="flex items-center gap-3 text-xs">
              <button className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded hover:bg-zinc-800/50 transition">
                <Activity className="w-3.5 h-3.5" />
                Indicators
              </button>
              <button className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded hover:bg-zinc-800/50 transition">
                <LineChartIcon className="w-3.5 h-3.5" />
                Tools
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 bg-zinc-900/50 border border-zinc-800 rounded text-xs">
              <span className="text-zinc-500">Profile:</span>
              <span className="text-teal-400 font-medium">Swing Trading</span>
            </div>
            <button className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 rounded transition">
              <Layout className="w-4 h-4" />
            </button>
            <button className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 rounded transition">
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Main Chart Area */}
        <div className="flex-1 relative bg-[#0d0e12] overflow-hidden flex flex-col group">
          
          {/* Chart Header Info */}
          <div className="absolute top-4 left-4 z-10 flex flex-col gap-1 pointer-events-none">
            <div className="flex items-end gap-3">
              <span className="text-3xl font-bold text-zinc-100 tracking-tight">64,281.50</span>
              <span className="text-emerald-400 text-sm font-medium mb-1">+2.4%</span>
            </div>
            <div className="text-xs text-zinc-500 flex gap-3 font-mono">
              <span>O: 62,810.00</span>
              <span>H: 64,500.00</span>
              <span>L: 62,500.00</span>
              <span>C: 64,281.50</span>
            </div>
          </div>
          
          <div className="flex-1 w-full h-[500px] min-h-[300px] relative">
            <div className="absolute inset-0 pt-20 pb-4 pr-2 pl-2">
              <ResponsiveContainer width="100%" height={500}>
                <ComposedChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="id" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} minTickGap={30} tickFormatter={(val) => {
                  const match = chartData.find(d => d.id === val);
                  return match ? match.time : '';
                }} />
                <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} width={60} tickFormatter={(val) => val.toLocaleString()} />
                <YAxis yAxisId="left" orientation="left" domain={[0, 3000]} hide />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '6px', fontSize: '12px' }}
                  itemStyle={{ color: '#e4e4e7' }}
                  labelStyle={{ color: '#a1a1aa' }}
                />
                <Area yAxisId="right" type="monotone" dataKey="price" stroke="#2dd4bf" strokeWidth={1.5} fillOpacity={1} fill="url(#colorPrice)" isAnimationActive={false} />
                <Bar yAxisId="left" dataKey="volume" fill="#3f3f46" opacity={0.3} barSize={4} />
              </ComposedChart>
            </ResponsiveContainer>
            </div>
          </div>
          
          {/* Drawing Tools Sidebar Placeholder */}
          <div className="absolute left-2 top-24 bottom-24 w-10 bg-[#12131a]/80 backdrop-blur border border-zinc-800/60 rounded-lg py-2 flex flex-col items-center gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            {['1', '2', '3', '4', '5'].map(i => (
              <div key={i} className="w-6 h-6 rounded bg-zinc-800/50 hover:bg-zinc-700/80 cursor-pointer flex items-center justify-center">
                <div className="w-3 h-[1px] bg-zinc-400 rotate-45" />
              </div>
            ))}
          </div>

        </div>
        
        {/* Bottom Contextual Drawer */}
        <div className={`border-t border-zinc-800/60 bg-[#12131a] flex flex-col transition-all duration-300 ease-in-out ${drawerOpen ? 'h-64' : 'h-10'}`}>
          <div className="flex items-center justify-between px-4 h-10 border-b border-transparent bg-zinc-900/30">
            <div className="flex gap-1 h-full">
              {drawerTabs.map(tab => (
                <button 
                  key={tab}
                  onClick={() => {
                    setActiveDrawerTab(tab);
                    if (!drawerOpen) setDrawerOpen(true);
                  }}
                  className={`px-4 text-xs font-medium tracking-wide h-full flex items-center relative transition-colors ${activeDrawerTab === tab && drawerOpen ? 'text-zinc-100 bg-[#1a1b23]' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'}`}
                >
                  {tab}
                  {activeDrawerTab === tab && drawerOpen && (
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-teal-500" />
                  )}
                </button>
              ))}
            </div>
            
            <button 
              onClick={() => setDrawerOpen(!drawerOpen)}
              className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition"
            >
              <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${drawerOpen ? '' : 'rotate-180'}`} />
            </button>
          </div>
          
          {drawerOpen && (
            <div className="flex-1 p-4 overflow-y-auto bg-[#1a1b23]/50">
              {activeDrawerTab === "News" && (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-[#12131a] border border-zinc-800 rounded-lg">
                    <div className="mt-0.5"><AlertCircle className="w-4 h-4 text-amber-500" /></div>
                    <div>
                      <h4 className="text-zinc-200 text-sm font-medium">Fed Chair Powell Remarks on Inflation</h4>
                      <p className="text-zinc-500 text-xs mt-1">Impact: High volatility expected in 15 mins. Focus on rate path comments.</p>
                      <span className="text-zinc-600 text-[10px] uppercase mt-2 block">2 MINS AGO • MACRO</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-[#12131a] border border-zinc-800 rounded-lg opacity-80">
                    <div className="mt-0.5"><Zap className="w-4 h-4 text-teal-500" /></div>
                    <div>
                      <h4 className="text-zinc-200 text-sm font-medium">Large BTC Inflow to Coinbase Prime</h4>
                      <p className="text-zinc-500 text-xs mt-1">On-chain alert: 12,000 BTC moved. Potentially institutional restructuring.</p>
                      <span className="text-zinc-600 text-[10px] uppercase mt-2 block">45 MINS AGO • ON-CHAIN</span>
                    </div>
                  </div>
                </div>
              )}
              {activeDrawerTab !== "News" && (
                <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
                  {activeDrawerTab} data loaded securely from designated sources.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Right Area: AI Copilot Panel */}
      <div className="flex-[3.5] flex flex-col bg-[#0c0d12] border-l border-black/50 shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.5)] z-20 relative">
        
        {/* AI Header */}
        <div className="h-14 border-b border-zinc-800/60 px-4 flex items-center justify-between bg-[#12131a]/80 backdrop-blur z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-8 h-8 rounded border border-teal-500/30 bg-teal-900/20 flex items-center justify-center overflow-hidden">
                <Bot className="w-4 h-4 text-teal-400" />
                <div className="absolute inset-0 bg-gradient-to-tr from-teal-500/10 to-transparent opacity-50"></div>
              </div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 border-2 border-[#12131a] bg-teal-500 rounded-full shadow-[0_0_10px_rgba(45,212,191,0.5)]"></div>
            </div>
            <div>
              <h2 className="text-zinc-100 font-medium text-sm flex items-center gap-2">
                Nexus Copilot
                <span className="text-[9px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded-sm font-mono tracking-widest uppercase">v2.4</span>
              </h2>
              <div className="flex items-center gap-1 text-[11px] text-teal-500/80 mt-0.5 font-mono">
                <span className="w-1 h-1 rounded-full bg-teal-500 animate-pulse"></span>
                Processing market context
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex bg-zinc-900 border border-zinc-800 rounded p-0.5">
              {['Analyst', 'Validator'].map((mode) => (
                <button 
                  key={mode}
                  onClick={() => setBotMode(mode)}
                  className={`px-2 py-1 text-[10px] font-medium uppercase rounded-sm transition-all duration-200 ${
                    botMode === mode ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <button className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition ml-1">
              <Settings2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Current Context */}
        <div className="bg-[#12131a] border-b border-zinc-800/60 px-4 py-2 flex items-center justify-between group cursor-pointer hover:bg-zinc-900/50 transition">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Info className="w-3.5 h-3.5 text-teal-500/60" />
            <span>Active Context: <span className="text-zinc-300 font-medium">Swing Trading • Medium Risk • Trend Following</span></span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 transition" />
        </div>
        
        {/* Quick Actions */}
        <div className="px-3 pt-3 pb-2 flex flex-wrap gap-2 z-10 bg-[#0c0d12]">
          {[
            { label: 'Analyze Chart', icon: Search },
            { label: 'Validate Setup', icon: CheckCircle2 },
            { label: 'Build Plan', icon: FileText },
            { label: 'News Impact', icon: AlertCircle },
          ].map((action) => (
            <button key={action.label} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-zinc-800/80 bg-[#161722]/50 hover:bg-[#1a1b26] hover:border-zinc-700 text-[11px] text-zinc-300 transition-colors shadow-sm font-medium">
              <action.icon className="w-3 h-3 text-teal-500/70" />
              {action.label}
            </button>
          ))}
        </div>
        
        {/* Main Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 relative">
          
          {/* AI Message with Verdict Card */}
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full border border-teal-500/20 bg-teal-900/10 flex-shrink-0 flex items-center justify-center mt-1">
              <Bot className="w-3.5 h-3.5 text-teal-500" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="text-xs text-zinc-500 mb-1">Nexus Copilot <span className="ml-2 text-[10px]">10:42 AM</span></div>
              <p className="text-[13px] text-zinc-300 leading-relaxed">
                I've analyzed the BTC/USD 4H chart. We are approaching a major supply zone at 65,200, but momentum indicators remain supportive. 
              </p>
              
              {/* Verdict Card */}
              <div className="mt-3 rounded-lg border border-teal-500/20 bg-[#10161b] overflow-hidden shadow-lg shadow-teal-900/5">
                <div className="flex items-center justify-between px-3 py-2 border-b border-teal-500/10 bg-teal-900/10">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Verdict: Valid</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">#ID-8291</span>
                </div>
                
                <div className="p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wide flex items-center gap-1">
                        <Target className="w-3 h-3" /> Entry Idea
                      </div>
                      <div className="text-sm font-medium text-zinc-200">63,850 - 64,100</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wide flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Invalidation
                      </div>
                      <div className="text-sm font-medium text-rose-400">62,500 (4H Close)</div>
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-zinc-800/50">
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Targets</div>
                    <div className="flex gap-2">
                      <div className="px-2 py-1 bg-[#161b22] border border-zinc-800 rounded text-xs text-zinc-300">TP1: 65,200</div>
                      <div className="px-2 py-1 bg-[#161b22] border border-zinc-800 rounded text-xs text-zinc-300">TP2: 67,000</div>
                    </div>
                  </div>
                  
                  <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-md mt-2">
                    <p className="text-[11px] text-amber-500/90 leading-relaxed">
                      <span className="font-semibold text-amber-400">Risk Note:</span> FOMC minutes release at 14:00 EST. Consider reducing position size by 50% or moving stops to breakeven before the event.
                    </p>
                  </div>
                </div>
                
                <div className="px-3 py-2 border-t border-teal-500/10 bg-[#0a0d10] flex gap-2">
                  <button className="flex-1 py-1.5 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 rounded text-teal-400 text-xs font-medium transition-colors">
                    Save Setup
                  </button>
                  <button className="flex-1 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-zinc-300 text-xs font-medium transition-colors">
                    Refine Plan
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* User Message */}
          <div className="flex gap-3 flex-row-reverse">
            <div className="w-6 h-6 rounded-full bg-zinc-800 flex-shrink-0 flex items-center justify-center mt-1">
              <span className="text-[10px] text-zinc-400 font-bold">ME</span>
            </div>
            <div className="flex-1 text-right space-y-1">
              <div className="text-xs text-zinc-500 mb-1">10:45 AM</div>
              <div className="inline-block px-3 py-2 rounded-lg bg-zinc-800/80 border border-zinc-700/50 text-[13px] text-zinc-200 text-left">
                What if we drop below the VWAP on the 1H first?
              </div>
            </div>
          </div>
          
          {/* AI Typing Indicator */}
          <div className="flex gap-3">
             <div className="w-6 h-6 rounded-full border border-teal-500/20 bg-teal-900/10 flex-shrink-0 flex items-center justify-center mt-1">
              <Bot className="w-3.5 h-3.5 text-teal-500" />
            </div>
            <div className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#10131a] border border-zinc-800/50 w-fit">
              <span className="w-1.5 h-1.5 bg-teal-500/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-1.5 h-1.5 bg-teal-500/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-1.5 h-1.5 bg-teal-500/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
          
        </div>
        
        {/* Input Area */}
        <div className="p-3 bg-[#12131a] border-t border-zinc-800/60 z-10">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-teal-500/20 to-zinc-500/20 rounded-lg blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
            <div className="relative bg-[#0d0e12] border border-zinc-700 rounded-lg shadow-inner flex items-end p-1 focus-within:border-teal-500/50 focus-within:ring-1 focus-within:ring-teal-500/20 transition-all">
              <button className="p-2 text-zinc-500 hover:text-teal-400 transition-colors rounded-md hover:bg-zinc-800/50">
                <Paperclip className="w-4 h-4" />
              </button>
              <textarea 
                placeholder="Ask Copilot or use / for commands..."
                className="w-full bg-transparent border-none outline-none text-[13px] text-zinc-200 placeholder:text-zinc-600 resize-none max-h-32 min-h-[40px] py-2.5 px-2"
                rows={1}
              />
              <button className="p-2 text-zinc-500 hover:text-teal-400 transition-colors rounded-md hover:bg-zinc-800/50">
                <Mic className="w-4 h-4" />
              </button>
              <button className="p-2 text-zinc-400 bg-teal-500/10 hover:bg-teal-500/20 hover:text-teal-400 transition-colors rounded-md ml-1 mb-0.5 border border-teal-500/20">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 px-1 text-[10px] text-zinc-600 font-mono">
            <span>Press <span className="text-zinc-400 border border-zinc-800 rounded px-1 py-0.5">/</span> for commands</span>
            <span>Enterprise Mode Secure</span>
          </div>
        </div>
      </div>
    </div>
  );
}
