import { cn } from "@/lib/utils";

export default function CoinPerformance({ trades }) {
  // Calculate performance by coin
  const coinStats = trades.reduce((acc, trade) => {
    const coin = trade.coin?.replace('USDT', '') || 'Unknown';
    if (!acc[coin]) {
      acc[coin] = { coin, pnl: 0, trades: 0, wins: 0 };
    }
    acc[coin].pnl += (trade.pnl_usd || 0);
    acc[coin].trades += 1;
    if ((trade.pnl_usd || 0) > 0) acc[coin].wins += 1;
    return acc;
  }, {});

  // Best: only positive PNL coins
  const best = Object.values(coinStats)
    .filter(c => c.pnl > 0)
    .sort((a, b) => b.pnl - a.pnl)
    .slice(0, 5);

  // Worst: only negative PNL coins
  const worst = Object.values(coinStats)
    .filter(c => c.pnl < 0)
    .sort((a, b) => a.pnl - b.pnl)
    .slice(0, 5);

  const CoinRow = ({ coin, pnl, trades, wins }) => {
    const winrate = trades > 0 ? ((wins / trades) * 100).toFixed(0) : 0;
    const formatWithSpaces = (num) => Math.round(num).toLocaleString('ru-RU').replace(/,/g, ' ');
    return (
      <div className="flex items-center justify-between py-2 border-b border-[#222] last:border-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#252525] flex items-center justify-center">
            <span className="text-[#c0c0c0] text-xs font-medium">{coin.slice(0, 2)}</span>
          </div>
          <div>
            <p className="text-[#c0c0c0] text-sm font-medium">{coin}</p>
            <p className="text-[#666] text-xs">{trades} trades • {winrate}% WR</p>
          </div>
        </div>
        <p className={cn(
          "text-sm font-bold",
          pnl >= 0 ? "text-emerald-400" : "text-red-400"
        )}>
          {pnl >= 0 ? `+$${formatWithSpaces(pnl)}` : `-$${formatWithSpaces(Math.abs(pnl))}`}
        </p>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
        <h3 className="text-emerald-400 text-sm font-medium mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          Best Coins
        </h3>
        <div>
          {best.length > 0 ? best.map((c, i) => <CoinRow key={i} {...c} />) : 
            <p className="text-[#666] text-sm">No data yet</p>
          }
        </div>
      </div>
      
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
        <h3 className="text-red-400 text-sm font-medium mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-400"></span>
          Worst Coins
        </h3>
        <div>
          {worst.length > 0 ? worst.map((c, i) => <CoinRow key={i} {...c} />) : 
            <p className="text-[#666] text-sm">No data yet</p>
          }
        </div>
      </div>
    </div>
  );
}