import { TrendingUp, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';

export default function BestWorstTrade({ trades }) {
  if (!trades || trades.length === 0) {
    return (
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
        <h3 className="text-[#c0c0c0] text-sm font-medium mb-4">Best / Worst Trade</h3>
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 mx-auto mb-4 flex items-center justify-center">
            <TrendingUp className="w-8 h-8 text-violet-400/60" />
          </div>
          <p className="text-[#888] text-sm mb-1">No trades yet</p>
          <p className="text-[#666] text-xs">Close trades to see best/worst</p>
        </div>
      </div>
    );
  }

  // Best trade: highest positive PNL
  const profitTrades = trades.filter(t => (t.pnl_usd || 0) > 0);
  const bestTrade = profitTrades.length > 0 
    ? profitTrades.reduce((max, t) => (t.pnl_usd > max.pnl_usd ? t : max))
    : null;

  // Worst trade: largest negative PNL
  const lossTrades = trades.filter(t => (t.pnl_usd || 0) < 0);
  const worstTrade = lossTrades.length > 0
    ? lossTrades.reduce((min, t) => (t.pnl_usd < min.pnl_usd ? t : min))
    : null;

  const TradeCard = ({ trade, type }) => {
    if (!trade) {
      return (
        <div className="bg-[#151515] rounded-lg p-4 flex flex-col items-center justify-center h-full py-8">
          <div className={`text-3xl mb-2`}>{type === 'best' ? '🏆' : '📉'}</div>
          <p className="text-[#888] text-sm mb-1">{type === 'best' ? 'No wins yet' : 'No losses yet'}</p>
          <p className="text-[#666] text-xs">{type === 'best' ? 'Keep trading!' : 'Great job!'}</p>
        </div>
      );
    }
    
    const isProfit = type === 'best';
    const pnlUsd = trade.pnl_usd || 0;
    const pnlPercent = trade.pnl_percent_of_balance || 0;
    const formatWithSpaces = (num) => Math.round(num).toLocaleString('ru-RU').replace(/,/g, ' ');

    return (
      <div className="bg-[#151515] rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          {isProfit ? (
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          ) : (
            <TrendingDown className="w-5 h-5 text-red-400" />
          )}
          <h4 className={`text-sm font-medium ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
            {isProfit ? 'Best Trade' : 'Worst Trade'}
          </h4>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[#666] text-xs">Coin</span>
            <span className="text-[#c0c0c0] text-sm font-medium">{trade.coin}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#666] text-xs">Date</span>
            <span className="text-[#c0c0c0] text-sm">
              {format(new Date(trade.date), 'MMM dd, yyyy')}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#666] text-xs">Profit</span>
            <span className={`text-sm font-bold ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
              {isProfit ? '+' : '-'}${formatWithSpaces(Math.abs(pnlUsd))}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#666] text-xs">Profit %</span>
            <span className={`text-sm font-bold ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
              {isProfit ? '+' : '-'}{Math.abs(pnlPercent).toFixed(2)}%
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
      <h3 className="text-[#c0c0c0] text-sm font-medium mb-4">Best / Worst Trade</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TradeCard trade={bestTrade} type="best" />
        <TradeCard trade={worstTrade} type="worst" />
      </div>
    </div>
  );
}