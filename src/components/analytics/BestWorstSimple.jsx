import { Trophy, TrendingDown } from 'lucide-react';
import { formatNumber, formatPrice } from './analyticsCalculations';
import { cn } from "@/lib/utils";

export default function BestWorstSimple({ trades, onDrillDown }) {
  const closed = trades.filter(t => t.close_price);
  
  if (closed.length === 0) {
    return null;
  }
  
  const sortedByPnl = [...closed].sort((a, b) => (b.pnl_usd || 0) - (a.pnl_usd || 0));
  const bestTrades = sortedByPnl.slice(0, 3);
  const worstTrades = sortedByPnl.slice(-3).reverse();

  const TradeCard = ({ trade, isBest }) => (
    <div 
      onClick={() => onDrillDown(isBest ? 'Best Trade' : 'Worst Trade', [trade])}
      className={cn(
        "p-4 rounded-lg border cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]",
        isBest ? "bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/50" : "bg-red-500/10 border-red-500/30 hover:border-red-500/50"
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-bold text-[#c0c0c0]">{trade.coin?.replace('USDT', '')}</div>
          <div className="text-xs text-[#888]">
            {new Date(trade.date_close || trade.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        </div>
        {isBest ? <Trophy className="w-5 h-5 text-emerald-400" /> : <TrendingDown className="w-5 h-5 text-red-400" />}
      </div>
      <div className={cn(
        "text-2xl font-bold mb-1",
        isBest ? "text-emerald-400" : "text-red-400"
      )}>
        {(trade.pnl_usd || 0) >= 0 ? '+' : ''}${formatNumber(Math.abs(trade.pnl_usd || 0))}
      </div>
      <div className="text-xs text-[#666]">
        {formatPrice(trade.entry_price)} → {formatPrice(trade.close_price)}
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-2 gap-6 mb-6">
      {/* Best Trades */}
      <div className="backdrop-blur-md bg-gradient-to-br from-emerald-500/10 via-[#1a1a1a] to-emerald-500/5 rounded-xl border border-emerald-500/30 p-6">
        <h3 className="text-lg font-bold text-emerald-400 mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5" />
          Best Trades
        </h3>
        <div className="space-y-3">
          {bestTrades.map((trade) => (
            <TradeCard key={trade.id} trade={trade} isBest={true} />
          ))}
        </div>
      </div>

      {/* Worst Trades */}
      <div className="backdrop-blur-md bg-gradient-to-br from-red-500/10 via-[#1a1a1a] to-red-500/5 rounded-xl border border-red-500/30 p-6">
        <h3 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
          <TrendingDown className="w-5 h-5" />
          Worst Trades
        </h3>
        <div className="space-y-3">
          {worstTrades.map((trade) => (
            <TradeCard key={trade.id} trade={trade} isBest={false} />
          ))}
        </div>
      </div>
    </div>
  );
}