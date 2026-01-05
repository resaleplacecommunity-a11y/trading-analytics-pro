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
      {/* Advanced background with animated elements */}
      <div className="absolute inset-0">
        {/* Base gradient with subtle animation */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#0d120d] to-[#0a0f0a]" />
        
        {/* Diagonal accent lines */}
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 100px, ${isWin ? '#10b981' : '#ef4444'} 100px, ${isWin ? '#10b981' : '#ef4444'} 102px)`
        }} />
        
        {/* Grid patterns - continuous gradient from white to green/red */}
        <div className="absolute inset-0 top-0 h-[30%] opacity-[0.12]" style={{
          backgroundImage: `linear-gradient(to right, rgba(220,220,220,0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(220,220,220,0.5) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }} />
        
        <div className="absolute inset-0 top-[30%] h-[40%] opacity-[0.15]" style={{
          backgroundImage: `linear-gradient(to right, ${isWin ? 'rgba(100,180,140,0.6)' : 'rgba(180,100,100,0.6)'} 1px, transparent 1px), linear-gradient(to bottom, ${isWin ? 'rgba(100,180,140,0.6)' : 'rgba(180,100,100,0.6)'} 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }} />
        
        <div className="absolute inset-0 top-[70%] h-[30%] opacity-[0.18]" style={{
          backgroundImage: `linear-gradient(to right, ${isWin ? 'rgba(16,185,129,0.8)' : 'rgba(239,68,68,0.8)'} 1px, transparent 1px), linear-gradient(to bottom, ${isWin ? 'rgba(16,185,129,0.8)' : 'rgba(239,68,68,0.8)'} 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }} />

        {/* Chaotic dots with color */}
        <div className="absolute inset-0 opacity-[0.25]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='150' height='150' viewBox='0 0 150 150' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='12' cy='18' r='1.5' fill='${isWin ? '%2310b981' : '%23ef4444'}'/%3E%3Ccircle cx='68' cy='9' r='1' fill='white'/%3E%3Ccircle cx='112' cy='35' r='1.3' fill='${isWin ? '%2310b981' : '%23ef4444'}'/%3E%3Ccircle cx='27' cy='62' r='0.9' fill='white'/%3E%3Ccircle cx='130' cy='73' r='1.6' fill='${isWin ? '%2310b981' : '%23ef4444'}'/%3E%3C/svg%3E")`,
          backgroundSize: '150px 150px'
        }} />

        {/* Enhanced glows */}
        <div className="absolute top-[10%] right-[15%] w-[500px] h-[500px] bg-gradient-radial from-white/10 via-[#c0c0c0]/5 to-transparent blur-3xl" />
        <div className={cn(
          "absolute bottom-[5%] left-[5%] w-[650px] h-[650px] bg-gradient-radial blur-3xl",
          isWin ? "from-emerald-400/30 via-emerald-500/15 to-transparent" : "from-red-400/30 via-red-500/15 to-transparent"
        )} />
        
        {/* Accent corner glow */}
        <div className={cn(
          "absolute top-0 left-0 w-[300px] h-[300px] bg-gradient-radial blur-2xl opacity-30",
          isWin ? "from-emerald-300/40 to-transparent" : "from-red-300/40 to-transparent"
        )} />
        
        {/* Strong color wash for wins/losses */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-t",
          isWin ? "from-emerald-500/25 via-emerald-500/8 to-transparent" : "from-red-500/20 via-red-500/6 to-transparent"
        )} />
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-between p-10">
        {/* Header with subtle animation hint */}
        <div className="text-center">
          <div className="mb-3 relative">
            <div className={cn(
              "absolute inset-0 blur-xl opacity-40",
              isWin ? "bg-emerald-400" : "bg-red-400"
            )} />
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69349b30698117be30e537d8/d941b1ccb_.jpg" 
              alt="Trading Pro" 
              className="w-20 h-20 mx-auto object-contain opacity-95 relative z-10 drop-shadow-2xl"
            />
          </div>
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent blur-sm" />
            <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-[#e0e0e0] via-white to-[#e0e0e0] tracking-tight mb-2 drop-shadow-lg">
              TRADING PRO
            </h1>
          </div>
          <p className="text-sm text-[#999] tracking-widest font-medium">@{userEmail}</p>
        </div>

        {/* Main Trade Card - Enhanced */}
        <div className={cn(
          "relative rounded-3xl border-2 shadow-2xl overflow-hidden backdrop-blur-xl",
          isWin 
            ? "bg-gradient-to-br from-[#1a1a1a]/95 via-[#151515]/95 to-emerald-950/20 border-emerald-400/40 shadow-emerald-500/20"
            : "bg-gradient-to-br from-[#1a1a1a]/95 via-[#151515]/95 to-red-950/20 border-red-400/40 shadow-red-500/20"
        )}>
          {/* Animated shine effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full opacity-50" />
          
          {/* Top section with coin and direction */}
          <div className={cn(
            "relative px-6 py-5 border-b",
            isWin 
              ? "bg-gradient-to-r from-[#1a1a1a] via-[#151515] to-emerald-950/30 border-emerald-500/20"
              : "bg-gradient-to-r from-[#1a1a1a] via-[#151515] to-red-950/30 border-red-500/20"
          )}>
            {/* Accent line on top */}
            <div className={cn(
              "absolute top-0 left-0 right-0 h-[2px]",
              isWin ? "bg-gradient-to-r from-transparent via-emerald-400 to-transparent" : "bg-gradient-to-r from-transparent via-red-400 to-transparent"
            )} />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg relative",
                  isLong 
                    ? "bg-gradient-to-br from-emerald-500/40 to-emerald-600/40 border-2 border-emerald-400/50" 
                    : "bg-gradient-to-br from-red-500/40 to-red-600/40 border-2 border-red-400/50"
                )}>
                  {/* Icon glow */}
                  <div className={cn(
                    "absolute inset-0 rounded-2xl blur-md",
                    isLong ? "bg-emerald-400/30" : "bg-red-400/30"
                  )} />
                  {isLong ? 
                    <TrendingUp className="w-7 h-7 text-emerald-300 relative z-10 drop-shadow-lg" /> : 
                    <TrendingDown className="w-7 h-7 text-red-300 relative z-10 drop-shadow-lg" />
                  }
                </div>
                <div>
                  <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#e0e0e0] to-white tracking-tight drop-shadow-lg">
                    {trade.coin?.replace('USDT', '')}
                  </div>
                  <div className={cn(
                    "text-sm font-bold uppercase tracking-widest mt-1",
                    isLong ? "text-emerald-300" : "text-red-300"
                  )}>
                    {trade.direction}
                  </div>
                </div>
              </div>
              <div className="text-right bg-[#0d0d0d]/50 rounded-xl px-4 py-2 border border-[#2a2a2a]">
                <div className="text-[10px] text-[#777] uppercase tracking-wider mb-0.5">Date</div>
                <div className="text-sm text-[#c0c0c0] font-bold">
                  {formatDate ? formatDate(trade.date_close || trade.date_open) : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Prices section - More visual */}
          <div className="grid grid-cols-2 gap-3 px-6 py-5 bg-[#0d0d0d]/70 relative">
            {/* Subtle divider */}
            <div className="absolute left-1/2 top-4 bottom-4 w-[1px] bg-gradient-to-b from-transparent via-[#333] to-transparent" />
            
            <div className="text-center relative">
              <div className="text-[10px] text-[#999] mb-2 uppercase tracking-widest font-semibold">Entry</div>
              <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-br from-[#c0c0c0] to-white">
                {formatPrice(trade.entry_price)}
              </div>
            </div>
            <div className="text-center relative">
              <div className="text-[10px] text-[#999] mb-2 uppercase tracking-widest font-semibold">Close</div>
              <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-br from-[#c0c0c0] to-white">
                {formatPrice(trade.close_price)}
              </div>
            </div>
          </div>

          {/* Main PNL Display - HERO SECTION - Maximum Visual Impact */}
          <div className={cn(
            "relative px-6 py-10 overflow-hidden",
            isWin 
              ? "bg-gradient-to-br from-emerald-500/30 via-emerald-500/15 to-transparent"
              : "bg-gradient-to-br from-red-500/30 via-red-500/15 to-transparent"
          )}>
            {/* Animated diagonal rays */}
            <div className="absolute inset-0 opacity-[0.12]" style={{
              backgroundImage: isWin 
                ? `repeating-linear-gradient(45deg, transparent, transparent 40px, rgba(16,185,129,0.4) 40px, rgba(16,185,129,0.4) 42px)`
                : `repeating-linear-gradient(45deg, transparent, transparent 40px, rgba(239,68,68,0.4) 40px, rgba(239,68,68,0.4) 42px)`
            }} />
            
            {/* Dynamic geometric pattern */}
            <div className="absolute inset-0 opacity-[0.08]" style={{
              backgroundImage: isWin 
                ? `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M40 10 L50 30 L40 50 L30 30 Z' fill='%2310b981' fill-opacity='0.7'/%3E%3C/svg%3E")`
                : `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 30 L50 30 L50 50 L30 50 Z' fill='%23ef4444' fill-opacity='0.7'/%3E%3C/svg%3E")`,
              backgroundSize: '80px 80px'
            }} />
            
            {/* Strong center glow */}
            <div className={cn(
              "absolute inset-0 blur-3xl",
              isWin 
                ? "bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.3)_0%,transparent_70%)]" 
                : "bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.3)_0%,transparent_70%)]"
            )} />

            <div className="relative z-10 grid grid-cols-3 gap-6">
              {/* PNL USD */}
              <div className="text-center relative group">
                <div className="text-[10px] text-[#bbb] mb-3 uppercase tracking-widest font-bold">PNL</div>
                <div className="relative inline-block">
                  {/* Number glow */}
                  <div className={cn(
                    "absolute inset-0 blur-2xl opacity-60",
                    isWin ? "bg-emerald-400" : "bg-red-400"
                  )} />
                  <div className={cn(
                    "text-[3.5rem] font-black leading-none mb-2 relative drop-shadow-2xl",
                    isWin 
                      ? "text-transparent bg-clip-text bg-gradient-to-b from-emerald-300 via-emerald-400 to-emerald-500" 
                      : "text-transparent bg-clip-text bg-gradient-to-b from-red-300 via-red-400 to-red-500"
                  )}>
                    {pnl >= 0 ? '+' : '−'}${formatNumber(Math.abs(pnl))}
                  </div>
                </div>
                <div className={cn(
                  "text-xs font-bold tracking-widest uppercase",
                  isWin ? "text-emerald-300/80" : "text-red-300/80"
                )}>
                  USD
                </div>
              </div>

              {/* PNL Percent */}
              <div className="text-center relative">
                <div className="text-[10px] text-[#bbb] mb-3 uppercase tracking-widest font-bold">Return</div>
                <div className="relative inline-block">
                  {/* Number glow */}
                  <div className={cn(
                    "absolute inset-0 blur-2xl opacity-60",
                    isWin ? "bg-emerald-400" : "bg-red-400"
                  )} />
                  <div className={cn(
                    "text-[3.5rem] font-black leading-none mb-2 relative drop-shadow-2xl",
                    isWin 
                      ? "text-transparent bg-clip-text bg-gradient-to-b from-emerald-300 via-emerald-400 to-emerald-500" 
                      : "text-transparent bg-clip-text bg-gradient-to-b from-red-300 via-red-400 to-red-500"
                  )}>
                    {pnlPercent >= 0 ? '+' : '−'}{Math.abs(pnlPercent).toFixed(1)}%
                  </div>
                </div>
                <div className={cn(
                  "text-xs font-bold tracking-widest uppercase",
                  isWin ? "text-emerald-300/80" : "text-red-300/80"
                )}>
                  of Balance
                </div>
              </div>

              {/* R Multiple */}
              <div className="text-center relative">
                <div className="text-[10px] text-[#bbb] mb-3 uppercase tracking-widest font-bold">R Multiple</div>
                <div className="relative inline-block">
                  {/* Number glow */}
                  <div className={cn(
                    "absolute inset-0 blur-2xl opacity-60",
                    isWin ? "bg-emerald-400" : "bg-red-400"
                  )} />
                  <div className={cn(
                    "text-[3.5rem] font-black leading-none mb-2 relative drop-shadow-2xl",
                    isWin 
                      ? "text-transparent bg-clip-text bg-gradient-to-b from-emerald-300 via-emerald-400 to-emerald-500" 
                      : "text-transparent bg-clip-text bg-gradient-to-b from-red-300 via-red-400 to-red-500"
                  )}>
                    {rMultiple >= 0 ? '+' : '−'}{Math.abs(rMultiple).toFixed(1)}R
                  </div>
                </div>
                <div className={cn(
                  "text-xs font-bold tracking-widest uppercase",
                  isWin ? "text-emerald-300/80" : "text-red-300/80"
                )}>
                  Risk
                </div>
              </div>
            </div>
          </div>

          {/* Bottom decorative footer - Enhanced */}
          <div className={cn(
            "relative px-6 py-4 border-t overflow-hidden",
            isWin 
              ? "bg-gradient-to-r from-[#0d0d0d] via-emerald-950/20 to-[#0d0d0d] border-emerald-500/20"
              : "bg-gradient-to-r from-[#0d0d0d] via-red-950/20 to-[#0d0d0d] border-red-500/20"
          )}>
            {/* Bottom accent line */}
            <div className={cn(
              "absolute bottom-0 left-0 right-0 h-[2px]",
              isWin ? "bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" : "bg-gradient-to-r from-transparent via-red-400/60 to-transparent"
            )} />
            
            <div className="flex items-center justify-center gap-4 text-xs">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0a0a0a]/50 rounded-lg border border-[#2a2a2a]">
                <Zap className="w-4 h-4 text-yellow-400/80" />
                <span className="text-[#999] font-medium">Smart Analytics</span>
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-[#555]" />
              <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg border",
                isWin 
                  ? "bg-emerald-500/10 border-emerald-400/40"
                  : "bg-red-500/10 border-red-400/40"
              )}>
                {isWin ? (
                  <>
                    <Trophy className="w-4 h-4 text-emerald-300" />
                    <span className="text-emerald-300 font-bold uppercase tracking-wide">Winner</span>
                  </>
                ) : (
                  <>
                    <Target className="w-4 h-4 text-red-300" />
                    <span className="text-red-300 font-bold uppercase tracking-wide">Learning</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Strategy badge at bottom - More prominent */}
        {trade.strategy_tag && (
          <div className="text-center">
            <div className="inline-block relative">
              {/* Glow behind badge */}
              <div className={cn(
                "absolute inset-0 blur-xl opacity-50",
                isWin ? "bg-emerald-400" : "bg-red-400"
              )} />
              <div className={cn(
                "relative px-8 py-2.5 rounded-full border-2 backdrop-blur-sm",
                isWin 
                  ? "bg-gradient-to-r from-emerald-500/25 via-emerald-400/25 to-emerald-500/25 border-emerald-400/60"
                  : "bg-gradient-to-r from-red-500/25 via-red-400/25 to-red-500/25 border-red-400/60"
              )}>
                <span className={cn(
                  "text-sm font-black uppercase tracking-[0.2em] drop-shadow-lg",
                  isWin 
                    ? "text-transparent bg-clip-text bg-gradient-to-r from-emerald-200 via-emerald-300 to-emerald-200"
                    : "text-transparent bg-clip-text bg-gradient-to-r from-red-200 via-red-300 to-red-200"
                )}>
                  {trade.strategy_tag}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}