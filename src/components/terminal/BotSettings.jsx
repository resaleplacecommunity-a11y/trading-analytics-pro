import { useState } from "react";
import { 
  Bot, Shield, Target, BookOpen, Brain, Clock, Zap, 
  Settings2, Activity, ToggleLeft, ToggleRight, Info, Plus
} from "lucide-react";

export function BotSettings() {
  const [activeTab, setActiveTab] = useState("Risk Engine");

  const settingsTabs = [
    { name: "Risk Engine", icon: Shield },
    { name: "Context / Sources", icon: Activity },
    { name: "Strategy / Playbook", icon: BookOpen },
    { name: "Bot Profile", icon: Brain },
    { name: "Memory", icon: Clock },
  ];

  return (
    <div className="flex h-full w-full bg-[#0a0b0f] text-zinc-300 font-sans overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r border-zinc-800/60 bg-[#0d0e12] flex flex-col z-10">
        <div className="p-6 border-b border-zinc-800/60 flex items-center gap-3">
          <div className="w-10 h-10 rounded border border-teal-500/30 bg-teal-900/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <h2 className="text-zinc-100 font-medium text-sm">Nexus Config</h2>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              <span className="text-xs text-zinc-500">System Online</span>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-6 flex-1 overflow-y-auto">
          {/* Bot Mode */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Bot Execution Mode</h3>
            <div className="space-y-2">
              {[
                { label: 'Shadow', desc: 'Alerts only, no drafting', active: false },
                { label: 'Approval', desc: 'Drafts plans for approval', active: true },
                { label: 'Auto (Locked)', desc: 'Full autonomy (requires key)', active: false, locked: true },
              ].map((mode) => (
                <button 
                  key={mode.label}
                  className={`w-full text-left p-3 rounded-lg border ${
                    mode.active 
                      ? 'bg-teal-500/5 border-teal-500/30 shadow-[inset_2px_0_0_0_rgba(45,212,191,1)]' 
                      : 'bg-zinc-900/30 border-zinc-800/60 hover:bg-zinc-800/50 hover:border-zinc-700'
                  } transition flex justify-between items-center group`}
                >
                  <div>
                    <div className={`text-sm font-medium ${mode.active ? 'text-teal-400' : mode.locked ? 'text-zinc-600' : 'text-zinc-300'}`}>
                      {mode.label}
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">{mode.desc}</div>
                  </div>
                  {mode.active && <Zap className="w-4 h-4 text-teal-500 opacity-80" />}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-zinc-800/60"></div>

          {/* Configuration Sections */}
          <div className="space-y-1">
            <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest px-2 mb-3">Configuration</h3>
            {settingsTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.name}
                  onClick={() => setActiveTab(tab.name)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition ${
                    activeTab === tab.name 
                      ? 'bg-zinc-800 text-zinc-100 font-medium' 
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${activeTab === tab.name ? 'text-teal-400' : 'text-zinc-500'}`} />
                  <span className="text-sm">{tab.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-[#0c0d12] flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="h-20 border-b border-zinc-800/60 bg-[#12131a] px-8 flex flex-col justify-center gap-1 z-10">
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2 tracking-tight">
            <Settings2 className="w-5 h-5 text-teal-500" />
            {activeTab}
          </h1>
          <p className="text-sm text-zinc-500 max-w-2xl">
            Configure how the AI Copilot analyzes markets, calculates risk, and structures trade plans before presenting them for execution.
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-8">
            
            {/* Risk Engine Section */}
            {activeTab === "Risk Engine" && (
              <div className="space-y-8">
                <div className="grid grid-cols-2 gap-6">
                  {/* Global Limits */}
                  <div className="bg-[#12131a] border border-zinc-800/60 rounded-xl p-6 shadow-lg">
                    <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-widest flex items-center gap-2 mb-5">
                      <Target className="w-4 h-4 text-rose-400" />
                      Global Exposure Limits
                    </h3>
                    
                    <div className="space-y-5">
                      <div className="flex items-center justify-between group">
                        <div>
                          <label className="text-sm text-zinc-300 font-medium group-hover:text-teal-400 transition">Risk Per Trade (%)</label>
                          <div className="text-[11px] text-zinc-500 mt-0.5">Base risk used by AI planner</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="number" defaultValue={1.5} step={0.1} className="w-20 bg-[#0d0e12] border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-200 text-right focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 transition font-mono" />
                        </div>
                      </div>

                      <div className="h-px bg-zinc-800/40"></div>

                      <div className="flex items-center justify-between group">
                        <div>
                          <label className="text-sm text-zinc-300 font-medium group-hover:text-teal-400 transition">Max Daily Loss (%)</label>
                          <div className="text-[11px] text-zinc-500 mt-0.5">Halt AI planning if exceeded</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="number" defaultValue={4.0} step={0.5} className="w-20 bg-[#0d0e12] border border-rose-900/50 rounded-md px-3 py-1.5 text-sm text-rose-400 text-right focus:outline-none focus:border-rose-500 transition font-mono" />
                        </div>
                      </div>

                      <div className="h-px bg-zinc-800/40"></div>

                      <div className="flex items-center justify-between group">
                        <div>
                          <label className="text-sm text-zinc-300 font-medium group-hover:text-teal-400 transition">Max Open Exposure</label>
                          <div className="text-[11px] text-zinc-500 mt-0.5">Total correlated risk cap</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="number" defaultValue={6.0} step={0.5} className="w-20 bg-[#0d0e12] border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-200 text-right focus:outline-none focus:border-teal-500 transition font-mono" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Positioning Rules */}
                  <div className="bg-[#12131a] border border-zinc-800/60 rounded-xl p-6 shadow-lg">
                    <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-widest flex items-center gap-2 mb-5">
                      <Shield className="w-4 h-4 text-emerald-400" />
                      Positioning Rules
                    </h3>
                    
                    <div className="space-y-5">
                      <div className="flex items-center justify-between group">
                        <div>
                          <label className="text-sm text-zinc-300 font-medium group-hover:text-teal-400 transition">Max Simultaneous</label>
                          <div className="text-[11px] text-zinc-500 mt-0.5">Open trades at once</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <select defaultValue="3" className="bg-[#0d0e12] border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-teal-500 transition font-mono w-24">
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                          </select>
                        </div>
                      </div>

                      <div className="h-px bg-zinc-800/40"></div>

                      <div className="flex items-center justify-between group">
                        <div>
                          <label className="text-sm text-zinc-300 font-medium group-hover:text-teal-400 transition">Max Loss Streak</label>
                          <div className="text-[11px] text-zinc-500 mt-0.5">Force cool-down period</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="number" defaultValue={3} className="w-20 bg-[#0d0e12] border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-200 text-right focus:outline-none focus:border-teal-500 transition font-mono" />
                        </div>
                      </div>

                      <div className="h-px bg-zinc-800/40"></div>

                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm text-zinc-300 font-medium">Enforce Breakeven Rule</label>
                          <div className="text-[11px] text-zinc-500 mt-0.5">Move stop at 1R profit</div>
                        </div>
                        <div className="text-teal-400 cursor-pointer hover:opacity-80 transition">
                          <ToggleRight className="w-8 h-8" strokeWidth={1.5} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Validation Info */}
                <div className="bg-teal-900/10 border border-teal-500/20 rounded-xl p-4 flex items-start gap-4 shadow-lg shadow-teal-900/5">
                  <div className="mt-0.5">
                    <Info className="w-5 h-5 text-teal-500" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-teal-400">Strict Validation Active</h4>
                    <p className="text-[13px] text-teal-100/60 mt-1 leading-relaxed">
                      The AI Copilot will reject any setup that exceeds a 1.5% portfolio risk or attempts to stack correlated exposure above 6.0%. Override requires manual password confirmation.
                    </p>
                  </div>
                </div>
                
                <div className="flex justify-end pt-4 border-t border-zinc-800/40">
                  <button className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md text-zinc-300 text-sm font-medium transition mr-3">Discard</button>
                  <button className="px-5 py-2 bg-teal-600 hover:bg-teal-500 border border-teal-500/50 rounded-md text-white shadow-[0_0_15px_rgba(13,148,136,0.3)] text-sm font-medium transition">Save Risk Profile</button>
                </div>
              </div>
            )}
            
            {/* Context / Sources Tab */}
            {activeTab === "Context / Sources" && (
              <div className="space-y-6">
                <div className="bg-[#12131a] border border-zinc-800/60 rounded-xl p-6 shadow-lg">
                  <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-widest mb-6">Data Feeds Processed by AI</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { name: 'Chart Structure / PA', state: true },
                      { name: 'Volume Profiles', state: true },
                      { name: 'DOM / Orderbook', state: true },
                      { name: 'Macro News (Real-time)', state: true },
                      { name: 'On-chain Inflows/Outflows', state: false },
                      { name: 'X / Twitter Sentiment', state: false },
                    ].map((source, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-[#0d0e12] border border-zinc-800/50 rounded-lg group hover:border-zinc-700 transition">
                        <span className="text-sm text-zinc-300 font-medium">{source.name}</span>
                        {source.state ? (
                           <ToggleRight className="w-8 h-8 text-teal-400 cursor-pointer" strokeWidth={1.5} />
                        ) : (
                           <ToggleLeft className="w-8 h-8 text-zinc-600 cursor-pointer" strokeWidth={1.5} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Other tabs placeholder */}
            {activeTab !== "Risk Engine" && activeTab !== "Context / Sources" && (
              <div className="flex flex-col items-center justify-center h-64 border border-zinc-800/60 border-dashed rounded-xl bg-[#12131a]/50">
                <div className="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4">
                  <Settings2 className="w-6 h-6 text-zinc-500" />
                </div>
                <h3 className="text-zinc-300 font-medium">{activeTab} configuration</h3>
                <p className="text-zinc-500 text-sm mt-1">Select modules to refine Nexus Copilot behavior.</p>
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}
