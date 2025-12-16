import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X, TrendingUp, TrendingDown } from 'lucide-react';
import { formatNumber, formatPrice, formatPercent } from './analyticsCalculations';
import { cn } from "@/lib/utils";

export default function DrillDownModal({ isOpen, onClose, title, trades, metric }) {
  if (!trades || trades.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl bg-[#111] border-[#2a2a2a] [&>button]:text-white [&>button]:hover:text-white">
          <DialogHeader>
            <DialogTitle className="text-[#c0c0c0]">{title}</DialogTitle>
          </DialogHeader>
          <div className="text-center py-12 text-[#666]">
            No trades found for this filter
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl_usd || 0), 0);
  const avgPnl = totalPnl / trades.length;
  const wins = trades.filter(t => (t.pnl_usd || 0) > 0).length;
  const losses = trades.filter(t => (t.pnl_usd || 0) < 0).length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-[#2a2a2a] [&>button]:text-white [&>button]:hover:text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#c0c0c0]">{title}</DialogTitle>
          <div className="flex gap-6 mt-2 text-sm">
            <div>
              <span className="text-[#666]">Total PNL: </span>
              <span className={cn("font-bold", totalPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                {totalPnl >= 0 ? '+' : ''}${formatNumber(Math.abs(totalPnl))}
              </span>
            </div>
            <div>
              <span className="text-[#666]">Avg PNL: </span>
              <span className={cn("font-bold", avgPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                {avgPnl >= 0 ? '+' : ''}${formatNumber(Math.abs(avgPnl))}
              </span>
            </div>
            <div>
              <span className="text-[#666]">Trades: </span>
              <span className="font-bold text-[#c0c0c0]">{trades.length}</span>
              <span className="text-[#666] ml-2">({wins}W / {losses}L)</span>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4 space-y-2">
          {trades.map((trade) => {
            const isLong = trade.direction === 'Long';
            const pnl = trade.pnl_usd || 0;
            const isProfit = pnl >= 0;
            const coinName = trade.coin?.replace('USDT', '') || '—';

            return (
              <div
                key={trade.id}
                className={cn(
                  "p-3 rounded-lg border transition-all hover:shadow-lg",
                  isProfit ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded",
                      isLong ? "bg-emerald-500/20" : "bg-red-500/20"
                    )}>
                      {isLong ? 
                        <TrendingUp className="w-4 h-4 text-emerald-400" /> : 
                        <TrendingDown className="w-4 h-4 text-red-400" />
                      }
                    </div>
                    <div>
                      <div className="font-bold text-[#c0c0c0]">{coinName}</div>
                      <div className="text-xs text-[#888]">
                        {new Date(trade.date_close || trade.date_open || trade.date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-right">
                      <div className="text-[#666] text-xs">Entry</div>
                      <div className="text-[#c0c0c0]">{formatPrice(trade.entry_price)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[#666] text-xs">Close</div>
                      <div className="text-[#c0c0c0]">{formatPrice(trade.close_price)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[#666] text-xs">Size</div>
                      <div className="text-[#c0c0c0]">${formatNumber(trade.position_size)}</div>
                    </div>
                    <div className="text-right min-w-[120px]">
                      <div className={cn(
                        "text-lg font-bold",
                        isProfit ? "text-emerald-400" : "text-red-400"
                      )}>
                        {isProfit ? '+' : ''}${formatNumber(Math.abs(pnl))}
                      </div>
                      <div className={cn(
                        "text-xs",
                        isProfit ? "text-emerald-400/70" : "text-red-400/70"
                      )}>
                        {formatPercent(trade.pnl_percent_of_balance || 0)}
                      </div>
                    </div>
                  </div>
                </div>

                {trade.strategy_tag && (
                  <div className="mt-2 text-xs text-[#888]">
                    Strategy: <span className="text-[#c0c0c0]">{trade.strategy_tag}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}