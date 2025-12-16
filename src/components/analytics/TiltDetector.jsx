import { useMemo } from 'react';
import { AlertTriangle, TrendingUp, Clock } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function TiltDetector({ trades }) {
  const tiltSignals = useMemo(() => {
    const closed = trades.filter(t => t.close_price).sort((a, b) => 
      new Date(a.date_close || a.date) - new Date(b.date_close || b.date)
    );

    const signals = [];

    // Detect losing streaks
    let currentStreak = 0;
    let maxLosingStreak = 0;
    closed.forEach(t => {
      if ((t.pnl_usd || 0) < 0) {
        currentStreak++;
        maxLosingStreak = Math.max(maxLosingStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    });

    if (maxLosingStreak >= 3) {
      signals.push({
        type: 'streak',
        severity: maxLosingStreak >= 5 ? 'high' : 'medium',
        title: 'Losing Streak Detected',
        description: `Max losing streak: ${maxLosingStreak} trades in a row`,
        icon: AlertTriangle
      });
    }

    // Detect risk escalation (last 5 trades)
    const recent5 = closed.slice(-5);
    if (recent5.length === 5) {
      const avgRisk = recent5.reduce((s, t) => s + (t.risk_percent || 0), 0) / 5;
      if (avgRisk > 2.5) {
        signals.push({
          type: 'risk',
          severity: avgRisk > 3.5 ? 'high' : 'medium',
          title: 'Risk Escalation',
          description: `Average risk in last 5 trades: ${avgRisk.toFixed(1)}%`,
          icon: TrendingUp
        });
      }
    }

    // Detect overtrading (>5 trades in a day)
    const dayMap = {};
    closed.forEach(t => {
      const day = new Date(t.date_close || t.date).toISOString().split('T')[0];
      dayMap[day] = (dayMap[day] || 0) + 1;
    });
    const maxTradesPerDay = Math.max(...Object.values(dayMap));
    if (maxTradesPerDay > 5) {
      signals.push({
        type: 'frequency',
        severity: maxTradesPerDay > 8 ? 'high' : 'medium',
        title: 'Overtrading Detected',
        description: `Max trades in a day: ${maxTradesPerDay}`,
        icon: Clock
      });
    }

    return signals;
  }, [trades]);

  if (tiltSignals.length === 0) {
    return (
      <div className="backdrop-blur-md bg-gradient-to-br from-emerald-500/10 via-[#1a1a1a] to-emerald-500/5 rounded-xl border border-emerald-500/30 p-6 mb-6">
        <h3 className="text-lg font-bold text-emerald-400 mb-2">✓ Discipline Status: Good</h3>
        <p className="text-sm text-[#888]">No tilt signals detected. Keep it up!</p>
      </div>
    );
  }

  return (
    <div className="backdrop-blur-md bg-gradient-to-br from-amber-500/10 via-[#1a1a1a] to-red-500/10 rounded-xl border border-amber-500/30 p-6 mb-6">
      <h3 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5" />
        Tilt Detector
      </h3>
      <div className="space-y-3">
        {tiltSignals.map((signal, i) => (
          <div 
            key={i}
            className={cn(
              "flex items-start gap-3 p-4 rounded-lg",
              signal.severity === 'high' ? "bg-red-500/20 border border-red-500/50" : "bg-amber-500/20 border border-amber-500/50"
            )}
          >
            <signal.icon className={cn(
              "w-5 h-5 mt-0.5",
              signal.severity === 'high' ? "text-red-400" : "text-amber-400"
            )} />
            <div>
              <div className={cn(
                "font-medium mb-1",
                signal.severity === 'high' ? "text-red-400" : "text-amber-400"
              )}>
                {signal.title}
              </div>
              <div className="text-sm text-[#888]">{signal.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}