import { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { cn } from "@/lib/utils";
import { format, subDays, startOfDay, startOfWeek, startOfMonth } from 'date-fns';

export default function RiskOverviewNew({ trades, riskSettings, behaviorLogs }) {
  const [timeframe, setTimeframe] = useState('today'); // today, yesterday, week, month
  
  // Get date ranges
  const getDateRange = () => {
    const now = startOfDay(new Date());
    switch (timeframe) {
      case 'today':
        return { start: now, end: now };
      case 'yesterday':
        const yesterday = subDays(now, 1);
        return { start: yesterday, end: yesterday };
      case 'week':
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: now };
      case 'month':
        return { start: startOfMonth(now), end: now };
      default:
        return { start: now, end: now };
    }
  };

  const { start, end } = getDateRange();
  
  // Filter trades for timeframe
  const filteredTrades = trades.filter(t => {
    const tradeDate = startOfDay(new Date(t.date_close || t.date_open || t.date));
    return tradeDate >= start && tradeDate <= end;
  });

  // Calculate metrics
  const tradesCount = filteredTrades.length;
  const maxTrades = riskSettings?.max_trades_per_day || 10;
  
  // Max Drawdown
  let maxDrawdown = 0;
  let peak = 0;
  let cumulative = 0;
  filteredTrades
    .sort((a, b) => new Date(a.date_close || a.date_open || a.date) - new Date(b.date_close || b.date_open || b.date))
    .forEach(trade => {
      cumulative += (trade.pnl_usd || 0);
      if (cumulative > peak) peak = cumulative;
      const drawdown = peak - cumulative;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    });
  const maxDrawdownLimit = riskSettings?.daily_max_loss_percent 
    ? (riskSettings.daily_max_loss_percent / 100) * 100000 
    : 5000;
  
  // Stop Losses count
  const stopLossesCount = filteredTrades.filter(t => {
    const pnl = t.pnl_usd || 0;
    const stopLoss = t.stop_usd || 0;
    return pnl < 0 && Math.abs(pnl) >= Math.abs(stopLoss) * 0.8; // Hit stop or close
  }).length;
  const maxStopLosses = riskSettings?.max_consecutive_losses || 3;

  // Violations
  const violations = [];
  if (tradesCount >= maxTrades) {
    violations.push({ type: 'warning', message: 'Trade limit reached' });
  }
  if (maxDrawdown >= maxDrawdownLimit) {
    violations.push({ type: 'error', message: 'Max drawdown exceeded' });
  }
  if (stopLossesCount >= maxStopLosses) {
    violations.push({ type: 'error', message: 'Too many stop losses' });
  }

  const canTrade = violations.filter(v => v.type === 'error').length === 0;

  const timeframeLabels = {
    today: 'Today',
    yesterday: 'Yesterday',
    week: 'This Week',
    month: 'This Month'
  };

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[#c0c0c0] text-sm font-medium">Risk Status</h3>
        
        {/* Timeframe Selector */}
        <div className="flex gap-1 bg-[#151515] rounded-lg p-1">
          {['today', 'yesterday', 'week', 'month'].map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={cn(
                "px-2 py-1 rounded text-xs transition-all",
                timeframe === tf 
                  ? "bg-[#c0c0c0] text-black font-medium" 
                  : "text-[#666] hover:text-[#888]"
              )}
            >
              {timeframeLabels[tf]}
            </button>
          ))}
        </div>
      </div>

      <div className={cn(
        "px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 mb-4",
        canTrade ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
      )}>
        {canTrade ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
        {canTrade ? "Ready to Trade" : "Stop Trading"}
      </div>
      
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-3 bg-[#151515] rounded-lg">
          <p className="text-[#666] text-xs mb-1">Trades</p>
          <p className="text-[#c0c0c0] text-lg font-bold">{tradesCount}</p>
          <p className="text-[#666] text-xs">/ {maxTrades}</p>
        </div>
        
        <div className="text-center p-3 bg-[#151515] rounded-lg">
          <p className="text-[#666] text-xs mb-1">Max Drawdown</p>
          <p className={cn(
            "text-lg font-bold",
            maxDrawdown >= maxDrawdownLimit ? "text-red-400" : "text-[#c0c0c0]"
          )}>
            ${maxDrawdown.toFixed(0)}
          </p>
          <p className="text-[#666] text-xs">/ ${maxDrawdownLimit.toFixed(0)}</p>
        </div>
        
        <div className="text-center p-3 bg-[#151515] rounded-lg">
          <p className="text-[#666] text-xs mb-1">Stop Losses</p>
          <p className={cn(
            "text-lg font-bold",
            stopLossesCount >= maxStopLosses ? "text-red-400" : "text-[#c0c0c0]"
          )}>
            {stopLossesCount}
          </p>
          <p className="text-[#666] text-xs">/ {maxStopLosses}</p>
        </div>
      </div>
      
      {violations.length > 0 ? (
        <div className="space-y-2">
          {violations.map((v, i) => (
            <div key={i} className={cn(
              "flex items-center gap-2 p-2 rounded-lg text-xs",
              v.type === 'error' ? "bg-red-500/10 text-red-400" : "bg-yellow-500/10 text-yellow-400"
            )}>
              <AlertTriangle className="w-4 h-4" />
              {v.message}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs">
          <CheckCircle className="w-4 h-4" />
          All risk parameters within limits
        </div>
      )}
    </div>
  );
}