import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ExternalLink, TrendingUp, TrendingDown, X } from 'lucide-react';
import { formatNumber, formatPrice, formatPercent } from './analyticsCalculations';
import { cn } from "@/lib/utils";
import { createPageUrl } from '../../utils';
import { Link } from 'react-router-dom';

export default function TradesDrawer({ isOpen, onClose, title, trades, filters }) {
  if (!trades || trades.length === 0) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="w-full sm:max-w-2xl bg-[#0a0a0a] border-l border-[#2a2a2a] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-[#c0c0c0]">{title}</SheetTitle>
          </SheetHeader>
          <div className="text-center py-12 text-[#666]">
            No trades found
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl_usd || 0), 0);
  const avgPnl = totalPnl / trades.length;
  const wins = trades.filter(t => (t.pnl_usd || 0) > 0).length;
  const losses = trades.filter(t => (t.pnl_usd || 0) < 0).length;
  const winrate = trades.length > 0 ? (wins / trades.length) * 100 : 0;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl bg-[#0a0a0a] border-l border-[#2a2a2a] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl font-bold text-[#c0c0c0] flex items-center justify-between">
            <span>{title}</span>
            <Link to={createPageUrl('Trades')}>
              <Button size="sm" variant="ghost" className="text-[#888] hover:text-[#c0c0c0]">
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in Trades
              </Button>
            </Link>
          </SheetTitle>
        </SheetHeader>

        {/* Summary Stats */}
        <div className="mt-6 grid grid-cols-4 gap-3">
          <div className="bg-[#111]/50 rounded-lg p-3 border border-[#2a2a2a]">
            <div className="text-xs text-[#666] mb-1">Total PNL</div>
            <div className={cn(
              "text-lg font-bold",
              totalPnl >= 0 ? "text-emerald-400" : "text-red-400"
            )}>
              {totalPnl >= 0 ? '+' : ''}${formatNumber(Math.abs(totalPnl))}
            </div>
          </div>
          <div className="bg-[#111]/50 rounded-lg p-3 border border-[#2a2a2a]">
            <div className="text-xs text-[#666] mb-1">Avg PNL</div>
            <div className={cn(
              "text-lg font-bold",
              avgPnl >= 0 ? "text-emerald-400" : "text-red-400"
            )}>
              {avgPnl >= 0 ? '+' : ''}${formatNumber(Math.abs(avgPnl))}
            </div>
          </div>
          <div className="bg-[#111]/50 rounded-lg p-3 border border-[#2a2a2a]">
            <div className="text-xs text-[#666] mb-1">Winrate</div>
            <div className={cn(
              "text-lg font-bold",
              winrate >= 50 ? "text-emerald-400" : "text-red-400"
            )}>
              {winrate.toFixed(0)}%
            </div>
          </div>
          <div className="bg-[#111]/50 rounded-lg p-3 border border-[#2a2a2a]">
            <div className="text-xs text-[#666] mb-1">Trades</div>
            <div className="text-lg font-bold text-[#c0c0c0]">
              {trades.length}
            </div>
            <div className="text-xs text-[#666]">{wins}W / {losses}L</div>
          </div>
        </div>

        {/* Trades List */}
        <div className="mt-6 space-y-2">
          {trades.map((trade) => {
            const isLong = trade.direction === 'Long';
            const pnl = trade.pnl_usd || 0;
            const isProfit = pnl >= 0;
            const coinName = trade.coin?.replace('USDT', '') || '—';
            const isOpen = !trade.close_price;

            return (
              <div
                key={trade.id}
                className={cn(
                  "p-3 rounded-lg border transition-all hover:shadow-lg cursor-pointer",
                  isOpen ? "bg-amber-500/10 border-amber-500/30" :
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
                      <div className="font-bold text-[#c0c0c0] flex items-center gap-2">
                        {coinName}
                        {isOpen && (
                          <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded">OPEN</span>
                        )}
                      </div>
                      <div className="text-xs text-[#888]">
                        {new Date(trade.date_close || trade.date_open || trade.date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-right">
                      <div className="text-[#666] text-xs">Entry</div>
                      <div className="text-[#c0c0c0]">{formatPrice(trade.entry_price)}</div>
                    </div>
                    {!isOpen && (
                      <div className="text-right">
                        <div className="text-[#666] text-xs">Close</div>
                        <div className="text-[#c0c0c0]">{formatPrice(trade.close_price)}</div>
                      </div>
                    )}
                    {!isOpen && (
                      <div className="text-right min-w-[100px]">
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
                    )}
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
      </SheetContent>
    </Sheet>
  );
}