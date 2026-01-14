import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from 'lucide-react';

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

export default function ShareTradeCard({ trade, isOpen }) {
  const isLong = trade.direction === 'Long';
  const pnl = trade.pnl_usd || 0;
  const pnlPercent = trade.pnl_percent_of_balance || 0;
  const gamblingScore = 0; // You can add gambling detection logic here

  const dateObj = new Date(isOpen ? (trade.date_open || trade.date) : (trade.date_close || trade.date_open || trade.date));
  const dateStr = dateObj.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = dateObj.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="w-[600px] h-[600px] bg-black relative overflow-hidden flex flex-col">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] via-black to-[#0d0d0d]" />
      
      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-[0.08]" style={{
        backgroundImage: `linear-gradient(to right, #c0c0c0 1px, transparent 1px), linear-gradient(to bottom, #c0c0c0 1px, transparent 1px)`,
        backgroundSize: '40px 40px'
      }} />
      
      {/* Glow effects */}
      {!isOpen && (
        <div className={cn(
          "absolute inset-0",
          pnl >= 0 
            ? "bg-gradient-to-br from-emerald-500/20 via-transparent to-transparent"
            : "bg-gradient-to-br from-red-500/20 via-transparent to-transparent"
        )} />
      )}

      {/* Header: Logo + Name */}
      <div className="relative z-10 p-8 border-b border-[#2a2a2a]/50">
        <div className="flex items-center gap-4">
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69349b30698117be30e537d8/d941b1ccb_.jpg" 
            alt="TAP Logo" 
            className="w-16 h-16 object-contain"
          />
          <div>
            <h1 className="text-2xl font-black text-[#c0c0c0] tracking-tight">Trading Analytics Pro</h1>
            <p className="text-sm text-[#888] tracking-wide">TAP</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 p-8 flex flex-col justify-between">
        {/* Coin + Direction */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {isLong ? (
              <TrendingUp className="w-12 h-12 text-emerald-400" />
            ) : (
              <TrendingDown className="w-12 h-12 text-red-400" />
            )}
            <div>
              <div className="text-5xl font-black text-[#c0c0c0]">{trade.coin?.replace('USDT', '')}</div>
              <div className={cn(
                "text-xl font-bold",
                isLong ? "text-emerald-400" : "text-red-400"
              )}>
                {trade.direction}
              </div>
            </div>
          </div>
          
          {/* Date & Time */}
          <div className="text-right">
            <div className="text-lg font-bold text-[#c0c0c0]">{dateStr}</div>
            <div className="text-sm text-[#888]">{timeStr}</div>
          </div>
        </div>

        {/* Trade Data */}
        <div className="space-y-6">
          {isOpen ? (
            /* Open Trade Data */
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#1a1a1a]/80 rounded-xl p-4 border border-[#2a2a2a]">
                <div className="text-xs text-[#888] mb-2">Entry Price</div>
                <div className="text-2xl font-black text-[#c0c0c0]">{formatPrice(trade.entry_price)}</div>
              </div>
              <div className="bg-gradient-to-br from-red-500/20 to-[#1a1a1a]/80 rounded-xl p-4 border border-red-500/40">
                <div className="text-xs text-red-400/80 mb-2">Stop Price</div>
                <div className="text-2xl font-black text-red-400">{formatPrice(trade.stop_price)}</div>
              </div>
              <div className="bg-gradient-to-br from-emerald-500/20 to-[#1a1a1a]/80 rounded-xl p-4 border border-emerald-500/40">
                <div className="text-xs text-emerald-400/80 mb-2">Take Profit</div>
                <div className="text-2xl font-black text-emerald-400">{formatPrice(trade.take_price)}</div>
              </div>
              <div className={cn(
                "rounded-xl p-4 border-2",
                gamblingScore === 0 
                  ? "bg-gradient-to-br from-emerald-500/30 to-[#1a1a1a]/80 border-emerald-500/50"
                  : "bg-gradient-to-br from-red-500/30 to-[#1a1a1a]/80 border-red-500/50"
              )}>
                <div className={cn(
                  "text-xs mb-2 font-bold",
                  gamblingScore === 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  🎰 Gambling
                </div>
                <div className={cn(
                  "text-3xl font-black",
                  gamblingScore === 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  {gamblingScore}
                </div>
              </div>
            </div>
          ) : (
            /* Closed Trade Data */
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#1a1a1a]/80 rounded-xl p-4 border border-[#2a2a2a]">
                  <div className="text-xs text-[#888] mb-2">Entry Price</div>
                  <div className="text-2xl font-black text-[#c0c0c0]">{formatPrice(trade.entry_price)}</div>
                </div>
                <div className="bg-[#1a1a1a]/80 rounded-xl p-4 border border-[#2a2a2a]">
                  <div className="text-xs text-[#888] mb-2">Close Price</div>
                  <div className="text-2xl font-black text-[#c0c0c0]">{formatPrice(trade.close_price)}</div>
                </div>
              </div>

              {/* PNL Section */}
              <div className={cn(
                "rounded-2xl p-6 border-2",
                pnl >= 0
                  ? "bg-gradient-to-br from-emerald-500/30 to-emerald-500/10 border-emerald-500/60 shadow-[0_0_40px_rgba(16,185,129,0.4)]"
                  : "bg-gradient-to-br from-red-500/30 to-red-500/10 border-red-500/60 shadow-[0_0_40px_rgba(239,68,68,0.4)]"
              )}>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-xs text-[#888] mb-1">PNL ($)</div>
                    <div className={cn(
                      "text-3xl font-black",
                      pnl >= 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                      {pnl >= 0 ? '+' : ''}${formatNumber(Math.abs(pnl))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#888] mb-1">PNL (%)</div>
                    <div className={cn(
                      "text-3xl font-black",
                      pnlPercent >= 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                      {pnlPercent >= 0 ? '+' : ''}{Math.abs(pnlPercent).toFixed(1)}%
                    </div>
                  </div>
                  <div className={cn(
                    "rounded-xl p-3 border-2",
                    gamblingScore === 0 
                      ? "bg-gradient-to-br from-emerald-500/30 to-emerald-500/10 border-emerald-500/60"
                      : "bg-gradient-to-br from-red-500/30 to-red-500/10 border-red-500/60"
                  )}>
                    <div className={cn(
                      "text-xs mb-1 font-bold",
                      gamblingScore === 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                      🎰 Gambling
                    </div>
                    <div className={cn(
                      "text-2xl font-black",
                      gamblingScore === 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                      {gamblingScore}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 p-6 border-t border-[#2a2a2a]/50">
        <div className="text-center text-xs text-[#666]">
          Generated by Trading Analytics Pro • {isOpen ? 'Open Position' : 'Closed Trade'}
        </div>
      </div>
    </div>
  );
}