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
    if (!(trade.close_price_final || trade.close_price) || !trade.take_price) return;
    
    const actualPnl = trade.pnl_total_usd || trade.pnl_usd || 0;
    if (actualPnl <= 0) return; // Only winning trades
    
    const entryPrice = trade.entry_price || 0;
    const closePrice = trade.close_price_final || trade.close_price;
    const takePrice = trade.take_price;
    const direction = trade.direction;
    
    // Check if closed before TP
    const reachedTP = (direction === 'Long' && closePrice >= takePrice) || 
                      (direction === 'Short' && closePrice <= takePrice);
    
    if (!reachedTP) {
      // Calculate potential if reached TP
      let potentialPnl = 0;
      if (direction === 'Long') {
        potentialPnl = ((takePrice - entryPrice) / entryPrice) * (trade.position_size || 0);
      } else {
        potentialPnl = ((entryPrice - takePrice) / entryPrice) * (trade.position_size || 0);
      }

      if (potentialPnl > actualPnl) {
        missedProfit += (potentialPnl - actualPnl);
        earlyExitCount++;
      }
    }
  });

  // Calculate improvement potential
  const totalPnl = trades.reduce((s, t) => s + (t.pnl_total_usd || t.pnl_usd || 0), 0);
  const avgPnl = trades.length > 0 ? totalPnl / trades.length : 0;
  const winningTrades = trades.filter(t => (t.pnl_total_usd || t.pnl_usd || 0) > 0);
  const losingTrades = trades.filter(t => (t.pnl_total_usd || t.pnl_usd || 0) < 0);
  
  const avgWin = winningTrades.length > 0 
    ? winningTrades.reduce((s, t) => s + (t.pnl_total_usd || t.pnl_usd || 0), 0) / winningTrades.length 
    : 0;
  const avgLoss = losingTrades.length > 0
    ? Math.abs(losingTrades.reduce((s, t) => s + (t.pnl_total_usd || t.pnl_usd || 0), 0) / losingTrades.length)
    : 0;

  // If trader improved win rate by 10% and reduced avg loss by 20%
  const currentWR = trades.length > 0 ? winningTrades.length / trades.length : 0;
  const improvedWR = Math.min(1, currentWR + 0.1);
  const improvedAvgLoss = avgLoss * 0.8;
  
  const currentExpectancy = (currentWR * avgWin) - ((1 - currentWR) * avgLoss);
  const improvedExpectancy = (improvedWR * avgWin) - ((1 - improvedWR) * improvedAvgLoss);
  
  const improvementPotentialUsd = (improvedExpectancy - currentExpectancy) * trades.length;
  const improvementPotentialPercent = improvementPotentialUsd > 0 ? 
    ((improvementPotentialUsd / 100000) * 100).toFixed(0) : 0;
  
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