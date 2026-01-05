import { TrendingUp, TrendingDown, Zap, Trophy, Target } from 'lucide-react';
import { cn } from "@/lib/utils";

const formatPrice = (price) => {
  if (price === undefined || price === null || price === '') return '—';
  const p = parseFloat(price);
  if (isNaN(p)) return '—';
  
  if (Math.abs(p) >= 1) {
    const str = p.toPrecision(4);
    const formatted = parseFloat(str).toString();
    return `$${formatted}`;
  }
  
  const str = p.toFixed(20);
  const match = str.match(/\.0*([1-9]\d{0,3})/);
  if (match) {
    const zeros = str.indexOf(match[1]) - str.indexOf('.') - 1;
    const formatted = p.toFixed(zeros + 4).replace(/0+$/, '');
    return `$${formatted}`;
  }
  return `$${p.toFixed(4).replace(/\.?0+$/, '')}`;
};

const formatNumber = (num) => {
  if (num === undefined || num === null || num === '') return '—';
  const n = parseFloat(num);
  if (isNaN(n)) return '—';
  return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
};

export default function SharePNLCard({ trade, userEmail, formatDate }) {
  const isLong = trade.direction === 'Long';
  const pnl = trade.pnl_usd || 0;
  const pnlPercent = trade.pnl_percent_of_balance || 0;
  const rMultiple = trade.r_multiple || 0;
  const isWin = pnl >= 0;

  return (
    <div className="w-[600px] h-[600px] relative overflow-hidden bg-[#0a0a0a]">
      {/* Advanced background */}
      <div className="absolute inset-0">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#0d120d] to-[#0a0f0a]" />
        
        {/* Grid patterns - continuous gradient from white to green */}
        <div className="absolute inset-0 top-0 h-[30%] opacity-[0.12]" style={{
          backgroundImage: `linear-gradient(to right, rgba(220,220,220,0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(220,220,220,0.5) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }} />
        
        <div className="absolute inset-0 top-[30%] h-[40%] opacity-[0.15]" style={{
          backgroundImage: `linear-gradient(to right, rgba(100,180,140,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(100,180,140,0.6) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }} />
        
        <div className="absolute inset-0 top-[70%] h-[30%] opacity-[0.18]" style={{
          backgroundImage: `linear-gradient(to right, rgba(16,185,129,0.8) 1px, transparent 1px), linear-gradient(to bottom, rgba(16,185,129,0.8) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }} />

        {/* Chaotic dots */}
        <div className="absolute inset-0 opacity-[0.2]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='150' height='150' viewBox='0 0 150 150' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='12' cy='18' r='1.5' fill='white'/%3E%3Ccircle cx='68' cy='9' r='1' fill='white'/%3E%3Ccircle cx='112' cy='35' r='1.3' fill='white'/%3E%3Ccircle cx='27' cy='62' r='0.9' fill='white'/%3E%3Ccircle cx='130' cy='73' r='1.6' fill='white'/%3E%3C/svg%3E")`,
          backgroundSize: '150px 150px'
        }} />

        {/* Glows */}
        <div className="absolute top-[10%] right-[15%] w-[500px] h-[500px] bg-gradient-radial from-white/8 via-[#c0c0c0]/4 to-transparent blur-3xl" />
        <div className="absolute bottom-[10%] left-[10%] w-[600px] h-[600px] bg-gradient-radial from-emerald-400/25 via-emerald-500/12 to-transparent blur-3xl" />
        
        {/* Strong emerald glow for wins */}
        {isWin && (
          <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/20 via-emerald-500/5 to-transparent" />
        )}
        {!isWin && (
          <div className="absolute inset-0 bg-gradient-to-t from-red-500/15 via-red-500/5 to-transparent" />
        )}
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-between p-12">
        {/* Header */}
        <div className="text-center">
          <div className="mb-2">
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69349b30698117be30e537d8/d941b1ccb_.jpg" 
              alt="Trading Pro" 
              className="w-16 h-16 mx-auto object-contain opacity-90"
            />
          </div>
          <h1 className="text-3xl font-black text-[#c0c0c0] tracking-tight mb-1">TRADING PRO</h1>
          <p className="text-sm text-[#888] tracking-wide">@{userEmail}</p>
        </div>

        {/* Main Trade Card */}
        <div className="bg-gradient-to-br from-[#1a1a1a]/95 via-[#151515]/95 to-[#0d0d0d]/95 rounded-2xl border-2 border-[#c0c0c0]/30 shadow-[0_0_40px_rgba(192,192,192,0.2)] overflow-hidden backdrop-blur-xl">
          {/* Top section with coin and direction */}
          <div className="bg-gradient-to-r from-[#1a1a1a] to-[#151515] px-6 py-4 border-b border-[#2a2a2a]/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center shadow-lg",
                  isLong ? "bg-gradient-to-br from-emerald-500/30 to-emerald-600/30 border border-emerald-400/40" : "bg-gradient-to-br from-red-500/30 to-red-600/30 border border-red-400/40"
                )}>
                  {isLong ? 
                    <TrendingUp className="w-7 h-7 text-emerald-400" /> : 
                    <TrendingDown className="w-7 h-7 text-red-400" />
                  }
                </div>
                <div>
                  <div className="text-3xl font-black text-[#c0c0c0] tracking-tight">
                    {trade.coin?.replace('USDT', '')}
                  </div>
                  <div className={cn(
                    "text-sm font-bold uppercase tracking-wider",
                    isLong ? "text-emerald-400" : "text-red-400"
                  )}>
                    {trade.direction}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-[#666] mb-1">Date</div>
                <div className="text-sm text-[#c0c0c0] font-medium">
                  {formatDate ? formatDate(trade.date_close || trade.date_open) : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Prices section */}
          <div className="grid grid-cols-2 gap-4 px-6 py-4 bg-[#0d0d0d]/50">
            <div className="text-center">
              <div className="text-xs text-[#888] mb-1.5 uppercase tracking-wide">Entry</div>
              <div className="text-xl font-bold text-[#c0c0c0]">{formatPrice(trade.entry_price)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-[#888] mb-1.5 uppercase tracking-wide">Close</div>
              <div className="text-xl font-bold text-[#c0c0c0]">{formatPrice(trade.close_price)}</div>
            </div>
          </div>

          {/* Main PNL Display - HERO SECTION */}
          <div className={cn(
            "relative px-6 py-8 overflow-hidden",
            isWin 
              ? "bg-gradient-to-br from-emerald-500/25 via-emerald-500/10 to-transparent"
              : "bg-gradient-to-br from-red-500/25 via-red-500/10 to-transparent"
          )}>
            {/* Dynamic pattern overlay */}
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: isWin 
                ? `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 10 L40 30 L30 50 L20 30 Z' fill='%2310b981' fill-opacity='0.6'/%3E%3C/svg%3E")`
                : `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 20 L40 20 L40 40 L20 40 Z' fill='%23ef4444' fill-opacity='0.6'/%3E%3C/svg%3E")`,
              backgroundSize: '60px 60px'
            }} />
            
            {/* Glow effect */}
            <div className={cn(
              "absolute inset-0 blur-3xl",
              isWin ? "bg-gradient-radial from-emerald-400/20 via-transparent to-transparent" : "bg-gradient-radial from-red-400/20 via-transparent to-transparent"
            )} />

            <div className="relative z-10 grid grid-cols-3 gap-6 text-center">
              {/* PNL USD */}
              <div>
                <div className="text-xs text-[#c0c0c0]/80 mb-2 uppercase tracking-wider font-semibold">PNL</div>
                <div className={cn(
                  "text-5xl font-black leading-none mb-1",
                  isWin ? "text-emerald-400" : "text-red-400"
                )}>
                  {pnl >= 0 ? '+' : '−'}${formatNumber(Math.abs(pnl))}
                </div>
                <div className={cn(
                  "text-sm font-semibold tracking-wide",
                  isWin ? "text-emerald-400/70" : "text-red-400/70"
                )}>
                  USD
                </div>
              </div>

              {/* PNL Percent */}
              <div>
                <div className="text-xs text-[#c0c0c0]/80 mb-2 uppercase tracking-wider font-semibold">Return</div>
                <div className={cn(
                  "text-5xl font-black leading-none mb-1",
                  isWin ? "text-emerald-400" : "text-red-400"
                )}>
                  {pnlPercent >= 0 ? '+' : '−'}{Math.abs(pnlPercent).toFixed(1)}%
                </div>
                <div className={cn(
                  "text-sm font-semibold tracking-wide",
                  isWin ? "text-emerald-400/70" : "text-red-400/70"
                )}>
                  of Balance
                </div>
              </div>

              {/* R Multiple */}
              <div>
                <div className="text-xs text-[#c0c0c0]/80 mb-2 uppercase tracking-wider font-semibold">R Multiple</div>
                <div className={cn(
                  "text-5xl font-black leading-none mb-1",
                  isWin ? "text-emerald-400" : "text-red-400"
                )}>
                  {rMultiple >= 0 ? '+' : '−'}{Math.abs(rMultiple).toFixed(1)}R
                </div>
                <div className={cn(
                  "text-sm font-semibold tracking-wide",
                  isWin ? "text-emerald-400/70" : "text-red-400/70"
                )}>
                  Risk
                </div>
              </div>
            </div>
          </div>

          {/* Bottom decorative footer */}
          <div className="bg-gradient-to-r from-[#0d0d0d] via-[#1a1a1a] to-[#0d0d0d] px-6 py-3 border-t border-[#2a2a2a]/50">
            <div className="flex items-center justify-center gap-4 text-xs text-[#666]">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-yellow-400/70" />
                <span>Smart Analytics</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-[#444]" />
              <div className="flex items-center gap-1.5">
                {isWin ? (
                  <>
                    <Trophy className="w-3.5 h-3.5 text-emerald-400/70" />
                    <span className="text-emerald-400/80 font-semibold">Winner</span>
                  </>
                ) : (
                  <>
                    <Target className="w-3.5 h-3.5 text-red-400/70" />
                    <span className="text-red-400/80 font-semibold">Learning</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Strategy badge at bottom */}
        {trade.strategy_tag && (
          <div className="mt-4 text-center">
            <div className="inline-block px-6 py-2 bg-gradient-to-r from-violet-500/20 via-purple-500/20 to-violet-500/20 border border-violet-400/40 rounded-full">
              <span className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-purple-300 to-violet-300 uppercase tracking-widest">
                {trade.strategy_tag}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}