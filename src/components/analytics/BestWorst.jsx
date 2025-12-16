import { Trophy, TrendingDown, TrendingUp, Target, Coins } from 'lucide-react';
import { formatNumber, formatPrice } from './analyticsCalculations';
import { cn } from "@/lib/utils";

export default function BestWorst({ trades, onDrillDown }) {
  const closed = trades.filter(t => t.close_price);
  
  if (closed.length === 0) {
    return (
      <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-6">
        <h3 className="text-lg font-bold text-[#c0c0c0] mb-4">Best & Worst</h3>
        <div className="text-center py-8 text-[#666]">
          <p className="text-sm">No closed trades yet</p>
        </div>
      </div>
    );
  }
  
  // Best and worst trade
  const sortedByPnl = [...closed].sort((a, b) => (b.pnl_usd || 0) - (a.pnl_usd || 0));
  const bestTrade = sortedByPnl[0];
  const worstTrade = sortedByPnl[sortedByPnl.length - 1];
  
  // Best and worst coin
  const coinMap = {};
  closed.forEach(t => {
    const coin = t.coin?.replace('USDT', '') || 'Unknown';
    if (!coinMap[coin]) coinMap[coin] = { pnl: 0, trades: [] };
    coinMap[coin].pnl += t.pnl_usd || 0;
    coinMap[coin].trades.push(t);
  });
  const coinEntries = Object.entries(coinMap).map(([name, data]) => ({ name, ...data }));
  const bestCoin = coinEntries.sort((a, b) => b.pnl - a.pnl)[0];
  const worstCoin = coinEntries.sort((a, b) => a.pnl - b.pnl)[0];
  
  // Best and worst strategy
  const stratMap = {};
  closed.forEach(t => {
    const strat = t.strategy_tag || 'No Strategy';
    if (!stratMap[strat]) stratMap[strat] = { pnl: 0, trades: [] };
    stratMap[strat].pnl += t.pnl_usd || 0;
    stratMap[strat].trades.push(t);
  });
  const stratEntries = Object.entries(stratMap).map(([name, data]) => ({ name, ...data }));
  const bestStrat = stratEntries.sort((a, b) => b.pnl - a.pnl)[0];
  const worstStrat = stratEntries.sort((a, b) => a.pnl - b.pnl)[0];

  const TradeCard = ({ trade, isBest }) => (
    <div 
      onClick={() => onDrillDown(isBest ? 'Best Trade' : 'Worst Trade', [trade])}
      className={cn(
        "p-4 rounded-lg border cursor-pointer transition-all hover:shadow-lg",
        isBest ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30"
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
        "text-2xl font-bold font-mono",
        isBest ? "text-emerald-400" : "text-red-400"
      )}>
        {(trade.pnl_usd || 0) >= 0 ? '+' : ''}${formatNumber(Math.abs(trade.pnl_usd || 0))}
      </div>
      <div className="text-xs text-[#888] mt-1">
        {formatPrice(trade.entry_price)} → {formatPrice(trade.close_price)}
      </div>
    </div>
  );

  const InfoCard = ({ icon: Icon, label, name, pnl, trades, color, onClick }) => (
    <div 
      onClick={() => onClick(name, trades)}
      className="p-4 bg-[#111]/50 rounded-lg border border-[#2a2a2a] cursor-pointer hover:bg-[#1a1a1a] transition-all"
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("w-4 h-4", color)} />
        <span className="text-xs text-[#666] uppercase tracking-wide">{label}</span>
      </div>
      <div className="font-bold text-[#c0c0c0] mb-1">{name}</div>
      <div className={cn(
        "text-lg font-bold font-mono",
        pnl >= 0 ? "text-emerald-400" : "text-red-400"
      )}>
        {pnl >= 0 ? '+' : ''}${formatNumber(Math.abs(pnl))}
      </div>
      <div className="text-xs text-[#666] mt-1">{trades.length} trades</div>
    </div>
  );

  return (
    <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-6">
      <h3 className="text-lg font-bold text-[#c0c0c0] mb-6 flex items-center gap-2">
        <Trophy className="w-5 h-5 text-amber-400" />
        Best & Worst
      </h3>

      <div className="space-y-4">
        {/* Best/Worst Trades */}
        <div>
          <div className="text-xs text-[#666] uppercase tracking-wide mb-3">Trades</div>
          <div className="grid grid-cols-2 gap-3">
            <TradeCard trade={bestTrade} isBest={true} />
            <TradeCard trade={worstTrade} isBest={false} />
          </div>
        </div>

        {/* Best/Worst Coins */}
        <div>
          <div className="text-xs text-[#666] uppercase tracking-wide mb-3">Coins</div>
          <div className="grid grid-cols-2 gap-3">
            <InfoCard 
              icon={Coins}
              label="Best"
              name={bestCoin.name}
              pnl={bestCoin.pnl}
              trades={bestCoin.trades}
              color="text-emerald-400"
              onClick={(name, trades) => onDrillDown(`Best Coin: ${name}`, trades)}
            />
            <InfoCard 
              icon={Coins}
              label="Worst"
              name={worstCoin.name}
              pnl={worstCoin.pnl}
              trades={worstCoin.trades}
              color="text-red-400"
              onClick={(name, trades) => onDrillDown(`Worst Coin: ${name}`, trades)}
            />
          </div>
        </div>

        {/* Best/Worst Strategies */}
        <div>
          <div className="text-xs text-[#666] uppercase tracking-wide mb-3">Strategies</div>
          <div className="grid grid-cols-2 gap-3">
            <InfoCard 
              icon={Target}
              label="Best"
              name={bestStrat.name}
              pnl={bestStrat.pnl}
              trades={bestStrat.trades}
              color="text-violet-400"
              onClick={(name, trades) => onDrillDown(`Best Strategy: ${name}`, trades)}
            />
            <InfoCard 
              icon={Target}
              label="Worst"
              name={worstStrat.name}
              pnl={worstStrat.pnl}
              trades={worstStrat.trades}
              color="text-orange-400"
              onClick={(name, trades) => onDrillDown(`Worst Strategy: ${name}`, trades)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}