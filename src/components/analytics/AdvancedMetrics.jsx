import StatsCard from '../dashboard/StatsCard';
import { TrendingUp, Percent, Calculator, Shield, Target, BarChart3, Brain, Activity } from 'lucide-react';

export default function AdvancedMetrics({ trades }) {
  // Calculate advanced metrics
  const wins = trades.filter(t => (t.pnl_usd || 0) > 0);
  const losses = trades.filter(t => (t.pnl_usd || 0) < 0);
  
  const winrate = trades.length > 0 ? (wins.length / trades.length * 100).toFixed(1) : 0;
  
  const totalWins = wins.reduce((s, t) => s + (t.pnl_usd || 0), 0);
  const totalLosses = Math.abs(losses.reduce((s, t) => s + (t.pnl_usd || 0), 0));
  const profitFactor = totalLosses > 0 ? (totalWins / totalLosses).toFixed(2) : totalWins > 0 ? '∞' : '0';
  
  const avgWin = wins.length > 0 ? totalWins / wins.length : 0;
  const avgLoss = losses.length > 0 ? totalLosses / losses.length : 0;
  const expectancy = trades.length > 0 ? 
    ((winrate / 100) * avgWin) - ((1 - winrate / 100) * avgLoss) : 0;
  
  const avgR = trades.length > 0 ? 
    trades.reduce((s, t) => s + (t.r_multiple || 0), 0) / trades.length : 0;
  
  // Max Drawdown calculation
  let peak = 0;
  let maxDD = 0;
  let running = 0;
  trades.forEach(t => {
    running += (t.pnl_usd || 0);
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > maxDD) maxDD = dd;
  });
  
  // Streaks
  let currentStreak = 0;
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let tempStreak = 0;
  let lastWin = null;
  
  [...trades].sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(t => {
    const isWin = (t.pnl_usd || 0) > 0;
    if (lastWin === null) {
      tempStreak = 1;
      lastWin = isWin;
    } else if (isWin === lastWin) {
      tempStreak++;
    } else {
      if (lastWin && tempStreak > maxWinStreak) maxWinStreak = tempStreak;
      if (!lastWin && tempStreak > maxLossStreak) maxLossStreak = tempStreak;
      tempStreak = 1;
      lastWin = isWin;
    }
    currentStreak = tempStreak;
  });
  
  // Rule compliance
  const ruleCompliant = trades.filter(t => t.rule_compliance).length;
  const ruleComplianceRate = trades.length > 0 ? (ruleCompliant / trades.length * 100).toFixed(1) : 0;
  
  // Emotional impact score
  const emotionCorrelation = trades.filter(t => t.emotional_state && t.pnl_usd).reduce((acc, t) => {
    if ((t.pnl_usd > 0 && t.emotional_state >= 7) || (t.pnl_usd < 0 && t.emotional_state < 5)) {
      return acc + 1;
    }
    return acc;
  }, 0);
  const emotionalImpact = trades.length > 0 ? (emotionCorrelation / trades.length * 100).toFixed(0) : 0;

  // Discipline Index (composite score)
  const disciplineIndex = (
    (parseFloat(ruleComplianceRate) * 0.4) +
    (parseFloat(winrate) * 0.3) +
    (avgR > 0 ? Math.min(avgR * 10, 30) : 0)
  ).toFixed(0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatsCard 
        title="Winrate" 
        value={`${winrate}%`}
        subtitle={`${wins.length}W / ${losses.length}L`}
        icon={Percent}
      />
      <StatsCard 
        title="Profit Factor" 
        value={profitFactor}
        subtitle={profitFactor >= 1.5 ? 'Good' : 'Needs work'}
        icon={TrendingUp}
      />
      <StatsCard 
        title="Expectancy" 
        value={`$${expectancy.toFixed(2)}`}
        subtitle="Per trade"
        icon={Calculator}
      />
      <StatsCard 
        title="Avg R" 
        value={`${avgR.toFixed(2)}R`}
        icon={Target}
      />
      <StatsCard 
        title="Max Drawdown" 
        value={`$${maxDD.toFixed(2)}`}
        icon={Activity}
      />
      <StatsCard 
        title="Win Streak" 
        value={maxWinStreak}
        subtitle={`Loss streak: ${maxLossStreak}`}
        icon={BarChart3}
      />
      <StatsCard 
        title="Discipline" 
        value={`${ruleComplianceRate}%`}
        subtitle="Rule compliance"
        icon={Shield}
      />
      <StatsCard 
        title="Discipline Index" 
        value={`${disciplineIndex}/100`}
        icon={Brain}
      />
    </div>
  );
}