import { useState } from 'react';
import { Terminal as TerminalChart } from '../components/terminal/TerminalChart';
import { Intelligence } from '../components/terminal/Intelligence';
import { BotSettings } from '../components/terminal/BotSettings';
import { Flow } from '../components/terminal/Flow';
import { AiCalls } from '../components/terminal/AiCalls';

export default function TerminalPage() {
  const [activeTab, setActiveTab] = useState('terminal');

  const tabs = [
    { id: 'terminal', label: 'TERMINAL' },
    { id: 'intelligence', label: 'INTELLIGENCE' },
    { id: 'bot-settings', label: 'BOT SETTINGS' },
    { id: 'flow', label: 'FLOW' },
    { id: 'ai-calls', label: 'AI CALLS' },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] w-full bg-[#0a0b0f] text-zinc-300 -mx-4 lg:-mx-6 -mt-4 lg:-mt-6">
      {/* Tab nav */}
      <div className="flex-none h-10 border-b border-zinc-800/60 bg-[#0d0e12] flex items-center gap-1 px-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded text-xs font-medium uppercase tracking-wider transition-all ${
              activeTab === tab.id
                ? 'bg-zinc-800 text-teal-400'
                : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'terminal' && <TerminalChart />}
        {activeTab === 'intelligence' && <Intelligence />}
        {activeTab === 'bot-settings' && <BotSettings />}
        {activeTab === 'flow' && <Flow />}
        {activeTab === 'ai-calls' && <AiCalls />}
      </div>
    </div>
  );
}
