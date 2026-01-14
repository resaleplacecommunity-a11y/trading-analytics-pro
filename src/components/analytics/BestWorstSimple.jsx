import { Trophy, TrendingDown } from 'lucide-react';
import { formatNumber, formatPrice } from './analyticsCalculations';
import { cn } from "@/lib/utils";

export default function BestWorstSimple({ trades }) {
  const closed = trades.filter(t => t.close_price);
  
  if (closed.length === 0) {
    return null;
  }
  
  const profitTrades = closed.filter(t => (t.pnl_usd || 0) > 0).sort((a, b) => (b.pnl_usd || 0) - (a.pnl_usd || 0));
  const lossTrades = closed.filter(t => (t.pnl_usd || 0) < 0).sort((a, b) => (a.pnl_usd || 0) - (b.pnl_usd || 0));
  
  const bestTrades = profitTrades.slice(0, 3);
  const worstTrades = lossTrades.slice(0, 3);

  const TradeCard = ({ trade, isBest }) => (
    <div 
      className={cn(
        "p-3 rounded-lg border transition-all",
        isBest ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isBest ? <Trophy className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
          <div>
            <div className="font-bold text-[#c0c0c0] text-sm">{trade.coin?.replace('USDT', '')}</div>
            <div className="text-xs text-[#888]">
              {new Date(trade.date_close || trade.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          </div>
        </div>
        <div className={cn(
          "text-xl font-bold",
          isBest ? "text-emerald-400" : "text-red-400"
        )}>
          {(trade.pnl_usd || 0) >= 0 ? '+' : '−'}${formatNumber(Math.abs(trade.pnl_usd || 0))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-2 gap-4 mb-6">
      {/* Best Trades */}
      <div className="backdrop-blur-md bg-gradient-to-br from-emerald-500/10 via-[#1a1a1a] to-emerald-500/5 rounded-xl border border-emerald-500/30 p-4">
        <h3 className="text-sm font-bold text-emerald-400 mb-3 flex items-center gap-2">
          <Trophy className="w-4 h-4" />
          Best Trades
        </h3>
        <div className="space-y-2">
          {bestTrades.length === 0 ? (
            <div className="text-center py-6 text-[#666] text-xs">No profit trades yet</div>
          ) : (
            bestTrades.map((trade) => (
              <TradeCard key={trade.id} trade={trade} isBest={true} />
            ))
          )}
        </div>
      </div>

      {/* Worst Trades */}
      <div className="backdrop-blur-md bg-gradient-to-br from-red-500/10 via-[#1a1a1a] to-red-500/5 rounded-xl border border-red-500/30 p-4">
        <h3 className="text-sm font-bold text-red-400 mb-3 flex items-center gap-2">
          <TrendingDown className="w-4 h-4" />
          Worst Trades
        </h3>
        <div className="space-y-2">
          {worstTrades.length === 0 ? (
            <div className="text-center py-6 text-[#666] text-xs">No loss trades yet</div>
          ) : (
            worstTrades.map((trade) => (
              <TradeCard key={trade.id} trade={trade} isBest={false} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}