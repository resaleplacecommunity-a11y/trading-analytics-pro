import { useState } from "react";
import { 
  BarChart2, TrendingUp, TrendingDown, Target, CheckCircle2, 
  XCircle, Clock, Filter, ChevronDown, Award, AlertTriangle, ArrowRight
} from "lucide-react";

export function AiCalls() {
  const [activeFilter, setActiveFilter] = useState("All");

  const summary = [
    { label: "Total AI Calls", value: "142", trend: "+12", icon: BarChart2 },
    { label: "Win Rate", value: "68.4%", trend: "+2.1%", icon: Award },
    { label: "Average R", value: "2.8R", trend: "-0.2R", icon: Target },
    { label: "Total Sim PnL", value: "+42.5R", trend: "+4.2R", icon: TrendingUp },
  ];

  const calls = [
    { id: "AC-104", time: "Today, 10:42", pair: "BTC/USD", dir: "Long", setup: "S/R Flip", verdict: "Valid", entry: "63,850", stop: "62,500", targets: "65,200 / 67,000", result: "Open", r: "--", source: "Chart + News", conf: "High" },
    { id: "AC-103", time: "Yesterday, 14:15", pair: "ETH/USD", dir: "Short", setup: "Dev Break", verdict: "Valid", entry: "3,120", stop: "3,180", targets: "2,950", result: "Win", r: "+2.8R", source: "Flow", conf: "Med" },
    { id: "AC-102", time: "Yesterday, 09:30", pair: "SOL/USD", dir: "Long", setup: "VWAP Bounce", verdict: "No Trade", entry: "--", stop: "--", targets: "--", result: "Missed", r: "--", source: "Chart", conf: "Low" },
    { id: "AC-101", time: "Oct 24, 18:00", pair: "BTC/USD", dir: "Long", setup: "Swept Low", verdict: "Valid", entry: "61,200", stop: "60,500", targets: "64,000", result: "Loss", r: "-1.0R", source: "Chart + On-chain", conf: "High" },
    { id: "AC-100", time: "Oct 23, 11:20", pair: "LINK/USD", dir: "Long", setup: "Accumulation", verdict: "Valid", entry: "14.50", stop: "13.80", targets: "16.20", result: "Win", r: "+2.4R", source: "Chart", conf: "Med" },
    { id: "AC-099", time: "Oct 22, 16:45", pair: "ETH/USD", dir: "Short", setup: "Range High", verdict: "Valid", entry: "3,400", stop: "3,450", targets: "3,200", result: "Win", r: "+4.0R", source: "Flow + News", conf: "High" },
    { id: "AC-098", time: "Oct 21, 08:15", pair: "AVAX/USD", dir: "Long", setup: "Breakout", verdict: "Invalidated", entry: "28.50", stop: "27.00", targets: "32.00", result: "Invalidated", r: "0.0R", source: "Chart", conf: "Low" },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0b0f] text-zinc-300 font-sans overflow-hidden">
      {/* Header & Summary */}
      <div className="border-b border-zinc-800/60 bg-[#12131a] px-6 py-6 z-10">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100 tracking-tight">AI Calls Logbook</h1>
            <p className="text-sm text-zinc-500 mt-1">Review, evaluate, and backtest Nexus Copilot performance.</p>
          </div>
          
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-zinc-800/80 bg-zinc-900 hover:bg-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 transition-colors shadow-sm font-medium">
              <Filter className="w-3.5 h-3.5" /> Filter
            </button>
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-zinc-800/80 bg-zinc-900 hover:bg-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 transition-colors shadow-sm font-medium">
              This Month <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Top Summary Row */}
        <div className="grid grid-cols-4 gap-4">
          {summary.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className="bg-[#0d0e12] border border-zinc-800/60 rounded-xl p-4 flex items-center justify-between shadow-sm group hover:border-zinc-700 transition">
                <div>
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1">{stat.label}</h3>
                  <div className="flex items-end gap-3">
                    <span className="text-2xl font-bold text-zinc-100">{stat.value}</span>
                    <span className={`text-xs font-medium mb-1 ${stat.trend.startsWith('+') ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {stat.trend}
                    </span>
                  </div>
                </div>
                <div className={`p-3 rounded-lg ${i === 3 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800/50 text-zinc-400'}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col p-6">
        
        {/* Table Filters */}
        <div className="flex gap-2 mb-4 z-10 relative">
          {['All', 'Open', 'Win', 'Loss', 'Invalidated', 'Missed'].map(filter => (
            <button 
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium uppercase tracking-wider transition ${
                activeFilter === filter 
                  ? 'bg-zinc-800 text-teal-400 shadow-sm border border-zinc-700' 
                  : 'bg-[#12131a] border border-zinc-800/60 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-y-auto bg-[#12131a] border border-zinc-800/60 rounded-xl shadow-lg relative z-10">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-[#0c0d12] sticky top-0 z-20 shadow-sm border-b border-zinc-800/80">
              <tr>
                <th className="px-4 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">ID / Time</th>
                <th className="px-4 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Pair / Dir</th>
                <th className="px-4 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Setup / Source</th>
                <th className="px-4 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Plan (Entry → Target)</th>
                <th className="px-4 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Result</th>
                <th className="px-4 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {calls.map((call, i) => (
                <tr key={i} className="hover:bg-zinc-800/20 transition-colors group cursor-pointer">
                  <td className="px-4 py-4">
                    <div className="font-mono text-zinc-300 text-xs">{call.id}</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">{call.time}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-semibold text-zinc-200">{call.pair}</div>
                    <div className={`text-[11px] font-medium mt-0.5 uppercase ${call.dir === 'Long' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {call.dir}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-zinc-300 text-xs">{call.setup}</div>
                    <div className="flex items-center gap-1 mt-1">
                      {call.conf === 'High' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>}
                      {call.conf === 'Med' && <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>}
                      {call.conf === 'Low' && <div className="w-1.5 h-1.5 rounded-full bg-zinc-600"></div>}
                      <span className="text-[10px] text-zinc-500">{call.source}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-mono text-xs flex items-center gap-2 text-zinc-300">
                      <span className="opacity-70">{call.entry}</span>
                      <ArrowRight className="w-3 h-3 text-zinc-600" />
                      <span className="text-emerald-400/80">{call.targets.split(' / ')[0]}</span>
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono mt-0.5">SL: {call.stop}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      {call.result === 'Win' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      {call.result === 'Loss' && <XCircle className="w-4 h-4 text-rose-400" />}
                      {call.result === 'Open' && <Clock className="w-4 h-4 text-teal-400" />}
                      {call.result === 'Invalidated' && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                      {call.result === 'Missed' && <div className="w-4 h-4 rounded-full border-2 border-zinc-600"></div>}
                      
                      <div>
                        <div className={`text-xs font-semibold uppercase ${
                          call.result === 'Win' ? 'text-emerald-400' :
                          call.result === 'Loss' ? 'text-rose-400' :
                          call.result === 'Open' ? 'text-teal-400' :
                          call.result === 'Invalidated' ? 'text-amber-500' : 'text-zinc-500'
                        }`}>{call.result}</div>
                        {call.r !== '--' && (
                          <div className={`text-[10px] font-mono mt-0.5 ${call.r.startsWith('+') ? 'text-emerald-400/70' : call.r === '0.0R' ? 'text-zinc-500' : 'text-rose-400/70'}`}>
                            {call.r}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button className="px-3 py-1.5 rounded border border-zinc-700 bg-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-700 hover:text-white transition opacity-0 group-hover:opacity-100">
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
