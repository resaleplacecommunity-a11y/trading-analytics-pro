import { AlertTriangle, TrendingUp } from 'lucide-react';

export default function MissedOpportunities({ trades }) {
  if (!trades || trades.length === 0) {
    return (
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-[#c0c0c0]" />
          <h3 className="text-[#c0c0c0] text-sm font-medium">Missed Opportunities</h3>
        </div>
        <p className="text-[#666] text-sm text-center py-8">No trades yet</p>
      </div>
    );
  }

  // Calculate missed profit from early exits
  let missedProfit = 0;
  let earlyExitCount = 0;

  trades.forEach(trade => {
    if (trade.close_price && trade.take_price && trade.entry_price) {
      const actualPnl = trade.pnl_usd || 0;
      const direction = trade.direction;
      
      // Calculate potential if reached TP
      let potentialPnl = 0;
      if (direction === 'Long') {
        potentialPnl = ((trade.take_price - trade.entry_price) / trade.entry_price) * (trade.position_size || 0);
      } else {
        potentialPnl = ((trade.entry_price - trade.take_price) / trade.entry_price) * (trade.position_size || 0);
      }

      // If closed before TP with profit less than potential
      if (actualPnl > 0 && actualPnl < potentialPnl * 0.8) {
        missedProfit += (potentialPnl - actualPnl);
        earlyExitCount++;
      }
    }
  });

  // Calculate improvement potential
  const avgPnl = trades.reduce((s, t) => s + (t.pnl_usd || 0), 0) / trades.length;
  const winningTrades = trades.filter(t => (t.pnl_usd || 0) > 0);
  const avgWin = winningTrades.length > 0 
    ? winningTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0) / winningTrades.length 
    : 0;

  // If trader improved win rate by 10% and avg win by 10%
  const improvementPotentialPercent = 20;
  const improvementPotentialUsd = avgWin > 0 ? (avgWin * trades.length * 0.2) : 0;
  
  const formatWithSpaces = (num) => Math.round(num).toLocaleString('ru-RU').replace(/,/g, ' ');

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-[#c0c0c0]" />
        <h3 className="text-[#c0c0c0] text-sm font-medium">Missed Opportunities</h3>
      </div>

      <div className="space-y-4">
        {/* Missed Profit */}
        <div className="bg-[#151515] rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#666] text-xs">Missed Profit (Early Exits)</span>
            <span className="text-yellow-400 text-lg font-bold">
              ${formatWithSpaces(missedProfit)}
            </span>
          </div>
          <p className="text-[#666] text-xs">
            {earlyExitCount} trade{earlyExitCount !== 1 ? 's' : ''} exited before reaching take profit target
          </p>
        </div>

        {/* Improvement Potential */}
        <div className="bg-[#151515] rounded-lg p-4">
          <div className="flex items-start gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-[#c0c0c0] text-sm font-medium mb-1">Improvement Potential</p>
              <p className="text-[#666] text-xs">
                If you improve consistency and discipline
              </p>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[#666] text-xs">Potential Gain %</span>
              <span className="text-emerald-400 text-sm font-bold">
                +{improvementPotentialPercent}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#666] text-xs">Potential Gain $</span>
              <span className="text-emerald-400 text-sm font-bold">
                +${formatWithSpaces(improvementPotentialUsd)}
              </span>
            </div>
          </div>
          
          <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
            <p className="text-[#888] text-xs leading-relaxed">
              Focus on holding winners to TP and maintaining strict stop losses to unlock this potential.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}