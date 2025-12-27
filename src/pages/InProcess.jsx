import { Zap, Lock, Loader2, Sparkles } from 'lucide-react';
import { cn } from "@/lib/utils";

const IN_PROCESS_FEATURES = [
  { id: 1, title: 'Public Traders Profiles', description: 'Discover and learn from successful traders', status: 'In Development', progress: 65 },
  { id: 2, title: 'AI Market Analysis', description: 'Real-time AI-powered market insights', status: 'In Development', progress: 45 },
  { id: 3, title: 'Market Screeners', description: 'Advanced filtering and screening tools', status: 'In Development', progress: 30 },
  { id: 4, title: 'Social Trading Hub', description: 'Connect with traders worldwide', status: 'Coming Soon', progress: 15, blurred: true },
  { id: 5, title: 'Advanced Backtesting', description: 'Test strategies on historical data', status: 'Coming Soon', progress: 10, blurred: true },
  { id: 6, title: 'Portfolio Analytics', description: 'Multi-asset portfolio tracking', status: 'Coming Soon', progress: 5, blurred: true },
  { id: 7, title: 'Live Trading Rooms', description: 'Real-time collaboration with traders', status: 'Planned', progress: 0, blurred: true },
  { id: 8, title: 'Copy Trading', description: 'Automatically replicate expert trades', status: 'Planned', progress: 0, blurred: true },
  { id: 9, title: 'Custom Indicators', description: 'Build your own technical indicators', status: 'Planned', progress: 0, blurred: true },
];

export default function InProcessPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-[#0d0d0d] backdrop-blur-sm rounded-3xl border-2 border-amber-500/30 p-16">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-amber-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-[300px] h-[300px] bg-violet-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        
        <div className="relative z-10 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 rounded-full px-6 py-3 mb-6">
            <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
            <span className="text-amber-400 font-medium">Work in Progress</span>
          </div>
          
          <h1 className="text-5xl font-bold text-[#c0c0c0] mb-6">
            Exciting Features Coming Soon
          </h1>
          <p className="text-[#888] text-xl leading-relaxed">
            We're building powerful new tools to revolutionize your trading experience. 
            Stay tuned for groundbreaking updates that will take your performance to the next level!
          </p>
          
          <div className="mt-8 flex items-center justify-center gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-400">6</div>
              <div className="text-[#666] text-sm">Features In Progress</div>
            </div>
            <div className="w-px h-12 bg-[#2a2a2a]" />
            <div className="text-center">
              <div className="text-3xl font-bold text-emerald-400">3</div>
              <div className="text-[#666] text-sm">Beta Testing Soon</div>
            </div>
            <div className="w-px h-12 bg-[#2a2a2a]" />
            <div className="text-center">
              <div className="text-3xl font-bold text-violet-400">∞</div>
              <div className="text-[#666] text-sm">Ideas Planned</div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {IN_PROCESS_FEATURES.map((feature) => (
          <div
            key={feature.id}
            className={cn(
              "relative group bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-2xl border-2 border-[#2a2a2a] p-6 transition-all hover:border-[#3a3a3a] hover:scale-[1.02]",
              feature.blurred && "blur-[2px]"
            )}
          >
            {/* Progress Indicator */}
            <div className="absolute top-4 right-4">
              <div className="w-14 h-14 rounded-full border-4 border-[#1a1a1a] relative">
                <svg className="absolute inset-0 w-14 h-14 -rotate-90">
                  <circle
                    cx="28"
                    cy="28"
                    r="24"
                    fill="none"
                    stroke="#2a2a2a"
                    strokeWidth="4"
                  />
                  <circle
                    cx="28"
                    cy="28"
                    r="24"
                    fill="none"
                    stroke={feature.progress > 50 ? "#10b981" : feature.progress > 25 ? "#f59e0b" : "#666"}
                    strokeWidth="4"
                    strokeDasharray={`${feature.progress * 1.507} 150.7`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[#c0c0c0] text-xs font-bold">{feature.progress}%</span>
                </div>
              </div>
            </div>

            {/* Lock Icon for Blurred */}
            {feature.blurred && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="bg-[#1a1a1a]/90 rounded-xl p-4 border border-[#2a2a2a]">
                  <Lock className="w-8 h-8 text-[#666]" />
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 mb-4">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center",
                feature.progress > 50 ? "bg-emerald-500/20" :
                feature.progress > 25 ? "bg-amber-500/20" :
                "bg-[#2a2a2a]"
              )}>
                <Sparkles className={cn(
                  "w-6 h-6",
                  feature.progress > 50 ? "text-emerald-400" :
                  feature.progress > 25 ? "text-amber-400" :
                  "text-[#666]"
                )} />
              </div>
              <div className="flex-1">
                <h3 className="text-[#c0c0c0] font-bold text-lg">{feature.title}</h3>
                <p className="text-xs text-[#666] uppercase tracking-wider">{feature.status}</p>
              </div>
            </div>

            <p className="text-[#888] text-sm mb-6 leading-relaxed">{feature.description}</p>

            {/* Progress Bar */}
            <div className="h-2 bg-[#0d0d0d] rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full transition-all duration-1000",
                  feature.progress > 50 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" :
                  feature.progress > 25 ? "bg-gradient-to-r from-amber-500 to-amber-400" :
                  "bg-gradient-to-r from-[#444] to-[#333]"
                )}
                style={{ width: `${feature.progress}%` }}
              />
            </div>

            {/* Animated Border */}
            <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <div className={cn(
                "absolute inset-0 rounded-2xl animate-pulse",
                feature.progress > 50 ? "bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-emerald-500/20" :
                feature.progress > 25 ? "bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-amber-500/20" :
                "bg-gradient-to-r from-violet-500/20 via-violet-500/10 to-violet-500/20"
              )} />
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#1a1a1a]/90 via-[#0d0d0d]/90 to-[#1a1a1a]/90 backdrop-blur-sm rounded-3xl border-2 border-[#2a2a2a] p-12">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-1/4 w-48 h-48 bg-amber-500 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-emerald-500 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }} />
          <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-violet-500 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '3s' }} />
        </div>
        
        <div className="relative z-10 text-center">
          <div className="text-5xl mb-4">🚀✨💎</div>
          <p className="text-[#c0c0c0] text-2xl font-bold mb-3">
            More Amazing Features in Development
          </p>
          <p className="text-[#888] text-lg max-w-2xl mx-auto">
            We're constantly innovating to bring you the most advanced trading tools. 
            Every update brings you closer to trading mastery. Follow our journey!
          </p>
        </div>
      </div>
    </div>
  );
}