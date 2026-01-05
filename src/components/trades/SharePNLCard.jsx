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
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#0d120d] to-[#0a0f0a]" />
        
        {/* Grid gradient */}
        <div className="absolute inset-0 top-0 h-[35%] opacity-[0.12]" style={{
          backgroundImage: `linear-gradient(to right, rgba(220,220,220,0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(220,220,220,0.5) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }} />
        
        <div className="absolute inset-0 top-[35%] h-[30%] opacity-[0.15]" style={{
          backgroundImage: `linear-gradient(to right, ${isWin ? 'rgba(100,180,140,0.6)' : 'rgba(180,100,100,0.6)'} 1px, transparent 1px), linear-gradient(to bottom, ${isWin ? 'rgba(100,180,140,0.6)' : 'rgba(180,100,100,0.6)'} 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }} />
        
        <div className="absolute inset-0 top-[65%] h-[35%] opacity-[0.18]" style={{
          backgroundImage: `linear-gradient(to right, ${isWin ? 'rgba(16,185,129,0.8)' : 'rgba(239,68,68,0.8)'} 1px, transparent 1px), linear-gradient(to bottom, ${isWin ? 'rgba(16,185,129,0.8)' : 'rgba(239,68,68,0.8)'} 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }} />

        {/* Dots */}
        <div className="absolute inset-0 opacity-[0.2]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='150' height='150' viewBox='0 0 150 150' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='12' cy='18' r='1.5' fill='${isWin ? '%2310b981' : '%23ef4444'}'/%3E%3Ccircle cx='68' cy='9' r='1' fill='white'/%3E%3Ccircle cx='112' cy='35' r='1.3' fill='${isWin ? '%2310b981' : '%23ef4444'}'/%3E%3Ccircle cx='27' cy='62' r='0.9' fill='white'/%3E%3Ccircle cx='130' cy='73' r='1.6' fill='${isWin ? '%2310b981' : '%23ef4444'}'/%3E%3C/svg%3E")`,
          backgroundSize: '150px 150px'
        }} />

        {/* Glows */}
        <div className="absolute top-[12%] right-[18%] w-[450px] h-[450px] bg-gradient-radial from-white/10 via-[#c0c0c0]/5 to-transparent blur-3xl" />
        <div className={cn(
          "absolute bottom-[8%] left-[8%] w-[550px] h-[550px] bg-gradient-radial blur-3xl",
          isWin ? "from-emerald-400/28 via-emerald-500/14 to-transparent" : "from-red-400/28 via-red-500/14 to-transparent"
        )} />
        
        <div className={cn(
          "absolute inset-0 bg-gradient-to-t",
          isWin ? "from-emerald-500/22 via-emerald-500/7 to-transparent" : "from-red-500/18 via-red-500/5 to-transparent"
        )} />
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-between p-10">
        {/* Header */}
        <div className="text-center">
          <div className="mb-3">
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69349b30698117be30e537d8/d941b1ccb_.jpg" 
              alt="Trading Pro" 
              className="w-20 h-20 mx-auto object-contain opacity-95"
            />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-2">
            TRADING PRO
          </h1>
          <p className="text-sm text-[#999] tracking-widest font-medium">@{userEmail}</p>
        </div>

        {/* Main Card */}
        <div className={cn(
          "relative rounded-3xl border-2 shadow-2xl overflow-hidden",
          isWin 
            ? "bg-[#1a1a1a]/95 border-emerald-400/40"
            : "bg-[#1a1a1a]/95 border-red-400/40"
        )}>
          {/* Top bar */}
          <div className={cn(
            "relative px-6 py-5 border-b",
            isWin 
              ? "bg-[#151515] border-emerald-500/20"
              : "bg-[#151515] border-red-500/20"
          )}>
            <div className={cn(
              "absolute top-0 left-0 right-0 h-[2px]",
              isWin ? "bg-gradient-to-r from-transparent via-emerald-400 to-transparent" : "bg-gradient-to-r from-transparent via-red-400 to-transparent"
            )} />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg border-2",
                  isLong 
                    ? "bg-emerald-500/30 border-emerald-400/50" 
                    : "bg-red-500/30 border-red-400/50"
                )}>
                  {isLong ? 
                    <TrendingUp className="w-7 h-7 text-emerald-300" /> : 
                    <TrendingDown className="w-7 h-7 text-red-300" />
                  }
                </div>
                <div>
                  <div className="text-4xl font-black text-white tracking-tight">
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
                <div className="text-sm text-white font-bold">
                  {formatDate ? formatDate(trade.date_close || trade.date_open) : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-3 px-6 py-5 bg-[#0d0d0d]/70 relative">
            <div className="absolute left-1/2 top-4 bottom-4 w-[1px] bg-gradient-to-b from-transparent via-[#333] to-transparent" />
            
            <div className="text-center">
              <div className="text-[10px] text-[#999] mb-2 uppercase tracking-widest font-semibold">Entry</div>
              <div className="text-2xl font-black text-white">
                {formatPrice(trade.entry_price)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-[#999] mb-2 uppercase tracking-widest font-semibold">Close</div>
              <div className="text-2xl font-black text-white">
                {formatPrice(trade.close_price)}
              </div>
            </div>
          </div>

          {/* PNL Section */}
          <div className={cn(
            "relative px-6 py-10 overflow-hidden",
            isWin 
              ? "bg-gradient-to-br from-emerald-500/25 via-emerald-500/12 to-transparent"
              : "bg-gradient-to-br from-red-500/25 via-red-500/12 to-transparent"
          )}>
            <div className="relative z-10 grid grid-cols-3 gap-4">
              {/* PNL USD */}
              <div className="text-center">
                <div className="text-[10px] text-[#bbb] mb-2 uppercase tracking-widest font-bold">PNL</div>
                <div className={cn(
                  "text-4xl font-black leading-tight mb-1",
                  isWin ? "text-emerald-400" : "text-red-400"
                )}>
                  {pnl >= 0 ? '+' : '−'}${formatNumber(Math.abs(pnl))}
                </div>
                <div className={cn(
                  "text-xs font-bold tracking-wider uppercase",
                  isWin ? "text-emerald-300/80" : "text-red-300/80"
                )}>
                  USD
                </div>
              </div>

              {/* PNL Percent */}
              <div className="text-center">
                <div className="text-[10px] text-[#bbb] mb-2 uppercase tracking-widest font-bold">Return</div>
                <div className={cn(
                  "text-4xl font-black leading-tight mb-1",
                  isWin ? "text-emerald-400" : "text-red-400"
                )}>
                  {pnlPercent >= 0 ? '+' : '−'}{Math.abs(pnlPercent).toFixed(1)}%
                </div>
                <div className={cn(
                  "text-xs font-bold tracking-wider uppercase",
                  isWin ? "text-emerald-300/80" : "text-red-300/80"
                )}>
                  of Balance
                </div>
              </div>

              {/* R Multiple */}
              <div className="text-center">
                <div className="text-[10px] text-[#bbb] mb-2 uppercase tracking-widest font-bold">R Multiple</div>
                <div className={cn(
                  "text-4xl font-black leading-tight mb-1",
                  isWin ? "text-emerald-400" : "text-red-400"
                )}>
                  {rMultiple >= 0 ? '+' : '−'}{Math.abs(rMultiple).toFixed(1)}R
                </div>
                <div className={cn(
                  "text-xs font-bold tracking-wider uppercase",
                  isWin ? "text-emerald-300/80" : "text-red-300/80"
                )}>
                  Risk
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className={cn(
            "relative px-6 py-4 border-t",
            isWin 
              ? "bg-[#0d0d0d] border-emerald-500/20"
              : "bg-[#0d0d0d] border-red-500/20"
          )}>
            <div className={cn(
              "absolute bottom-0 left-0 right-0 h-[2px]",
              isWin ? "bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" : "bg-gradient-to-r from-transparent via-red-400/60 to-transparent"
            )} />
            
            <div className="flex items-center justify-center gap-4 text-xs">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0a0a0a]/50 rounded-lg border border-[#2a2a2a]">
                <Zap className="w-4 h-4 text-yellow-400" />
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

        {/* Strategy badge */}
        {trade.strategy_tag && (
          <div className="text-center">
            <div className={cn(
              "inline-block px-8 py-2.5 rounded-full border-2 backdrop-blur-sm",
              isWin 
                ? "bg-emerald-500/20 border-emerald-400/60"
                : "bg-red-500/20 border-red-400/60"
            )}>
              <span className={cn(
                "text-sm font-black uppercase tracking-[0.2em]",
                isWin ? "text-emerald-200" : "text-red-200"
              )}>
                {trade.strategy_tag}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}