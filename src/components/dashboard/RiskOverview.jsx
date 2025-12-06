import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function RiskOverview({ trades, riskSettings, behaviorLogs }) {
  const today = new Date().toISOString().split('T')[0];
  
  // Calculate today's stats
  const todayTrades = trades.filter(t => t.date?.startsWith(today));
  const todayPnl = todayTrades.reduce((sum, t) => sum + (t.pnl_usd || 0), 0);
  const todayPnlPercent = todayTrades.reduce((sum, t) => sum + (t.pnl_percent || 0), 0);
  const todayR = todayTrades.reduce((sum, t) => sum + (t.r_multiple || 0), 0);
  const todayViolations = behaviorLogs?.filter(l => l.date === today).length || 0;
  
  // Check violations
  const violations = [];
  
  if (riskSettings) {
    if (riskSettings.daily_max_loss_percent && todayPnlPercent < -riskSettings.daily_max_loss_percent) {
      violations.push({ type: 'error', message: 'Daily loss limit exceeded' });
    }
    if (riskSettings.daily_max_r && todayR < -riskSettings.daily_max_r) {
      violations.push({ type: 'error', message: 'Daily R limit exceeded' });
    }
    if (riskSettings.max_trades_per_day && todayTrades.length >= riskSettings.max_trades_per_day) {
      violations.push({ type: 'warning', message: 'Max trades limit reached' });
    }
    
    // Check consecutive losses
    const recentTrades = [...trades].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
    const consecutiveLosses = recentTrades.filter(t => (t.pnl_usd || 0) < 0).length;
    if (consecutiveLosses >= (riskSettings.max_consecutive_losses || 3)) {
      violations.push({ type: 'error', message: `${consecutiveLosses} consecutive losses - take a break` });
    }
    
    // Check emotional state
    if (todayTrades.length > 0) {
      const avgEmotion = todayTrades.reduce((s, t) => s + (t.emotional_state || 5), 0) / todayTrades.length;
      if (riskSettings.emotions_threshold && avgEmotion < riskSettings.emotions_threshold) {
        violations.push({ type: 'warning', message: 'Emotional state too low' });
      }
    }
  }
  
  const canTrade = violations.filter(v => v.type === 'error').length === 0;

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[#c0c0c0] text-sm font-medium">Risk Status</h3>
        <div className={cn(
          "px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1",
          canTrade ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
        )}>
          {canTrade ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
          {canTrade ? "Can Trade" : "Stop Trading"}
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-3 bg-[#151515] rounded-lg">
          <p className="text-[#666] text-xs">Trades Today</p>
          <p className="text-[#c0c0c0] text-lg font-bold">{todayTrades.length}</p>
          {riskSettings?.max_trades_per_day && (
            <p className="text-[#666] text-xs">/ {riskSettings.max_trades_per_day}</p>
          )}
        </div>
        <div className="text-center p-3 bg-[#151515] rounded-lg">
          <p className="text-[#666] text-xs">Daily PNL</p>
          <p className={cn(
            "text-lg font-bold",
            todayPnl >= 0 ? "text-emerald-400" : "text-red-400"
          )}>
            ${todayPnl.toFixed(0)}
          </p>
        </div>
        <div className="text-center p-3 bg-[#151515] rounded-lg">
          <p className="text-[#666] text-xs">Daily R</p>
          <p className={cn(
            "text-lg font-bold",
            todayR >= 0 ? "text-emerald-400" : "text-red-400"
          )}>
            {todayR.toFixed(1)}R
          </p>
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