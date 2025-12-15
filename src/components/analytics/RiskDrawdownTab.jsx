import { AlertTriangle, TrendingDown, Shield } from 'lucide-react';
import { cn } from "@/lib/utils";
import StatsCard from '../dashboard/StatsCard';
import { applyFilters } from './filterUtils';

const formatNumber = (num) => {
  if (num === undefined || num === null || num === '') return '—';
  const n = parseFloat(num);
  if (isNaN(n)) return '—';
  return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
};

export default function RiskDrawdownTab({ trades, filters }) {
  const filtered = applyFilters(trades, filters);
  const closedTrades = filtered.filter(t => t.close_price_final || t.close_price);
  const openTrades = filtered.filter(t => !(t.close_price_final || t.close_price));

  // Current open exposure
  const currentExposure = openTrades.reduce((s, t) => s + (t.position_size || 0), 0);
  
  // Current open risk
  const currentRisk = openTrades.reduce((s, t) => {
    const riskUsd = t.risk_usd || 0;
    return s + riskUsd;
  }, 0);
  const currentRiskPct = (currentRisk / 100000) * 100;

  // Max drawdown calculation
  let maxDD = 0;
  let maxDDPct = 0;
  let peak = 100000;
  let balance = 100000;

  const sortedClosed = [...closedTrades].sort((a, b) => 
    new Date(a.date_close || a.date_open) - new Date(b.date_close || b.date_open)
  );

  sortedClosed.forEach(t => {
    balance += (t.pnl_total_usd || t.pnl_usd || 0);
    if (balance > peak) peak = balance;
    const dd = peak - balance;
    if (dd > maxDD) {
      maxDD = dd;
      maxDDPct = (dd / peak) * 100;
    }
  });

  // Concentration analysis
  const symbolExposure = {};
  const strategyExposure = {};

  openTrades.forEach(t => {
    const symbol = t.coin?.replace('USDT', '') || 'Unknown';
    const strategy = t.strategy_tag || 'No Strategy';
    
    symbolExposure[symbol] = (symbolExposure[symbol] || 0) + (t.position_size || 0);
    strategyExposure[strategy] = (strategyExposure[strategy] || 0) + (t.position_size || 0);
  });

  const topSymbol = Object.entries(symbolExposure).sort((a, b) => b[1] - a[1])[0];
  const topStrategy = Object.entries(strategyExposure).sort((a, b) => b[1] - a[1])[0];

  const topSymbolPct = topSymbol && currentExposure > 0 ? (topSymbol[1] / currentExposure * 100) : 0;
  const topStrategyPct = topStrategy && currentExposure > 0 ? (topStrategy[1] / currentExposure * 100) : 0;

  // Risk violations (example thresholds)
  const MAX_RISK_PER_TRADE = 2; // 2% per trade
  const MAX_TOTAL_RISK = 6; // 6% total open risk

  const overRiskTrades = openTrades.filter(t => {
    const riskPct = t.risk_percent || 0;
    return riskPct > MAX_RISK_PER_TRADE;
  });

  const totalRiskViolation = currentRiskPct > MAX_TOTAL_RISK;

  return (
    <div className="space-y-4 mt-4">
      {/* Exposure Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatsCard 
          title="Open Exposure"
          value={`$${formatNumber(currentExposure)}`}
          subtitle={`${openTrades.length} positions`}
          icon={Shield}
        />
        <StatsCard 
          title="Current Risk"
          value={`$${formatNumber(currentRisk)}`}
          subtitle={`${currentRiskPct.toFixed(2)}%`}
          icon={AlertTriangle}
          valueColor={totalRiskViolation ? 'text-red-400' : 'text-amber-400'}
          className={totalRiskViolation ? 'border-red-500/30' : ''}
        />
        <StatsCard 
          title="Max DD"
          value={maxDD > 0 ? `-$${formatNumber(maxDD)}` : '—'}
          subtitle={maxDDPct > 0 ? `-${maxDDPct.toFixed(2)}%` : '—'}
          icon={TrendingDown}
          valueColor="text-red-400"
        />
        <StatsCard 
          title="Risk Violations"
          value={overRiskTrades.length}
          subtitle={overRiskTrades.length > 0 ? 'trades over limit' : 'Clean'}
          valueColor={overRiskTrades.length > 0 ? 'text-red-400' : 'text-emerald-400'}
        />
      </div>

      {/* Concentration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
          <h3 className="text-[#c0c0c0] text-sm font-medium mb-4">Top Symbol Exposure</h3>
          {topSymbol ? (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-[#c0c0c0] font-medium">{topSymbol[0]}</span>
                <span className="text-lg font-bold text-amber-400">{topSymbolPct.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-[#0d0d0d] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-600"
                  style={{ width: `${topSymbolPct}%` }}
                />
              </div>
              <p className="text-xs text-[#666]">${formatNumber(topSymbol[1])} exposure</p>
            </div>
          ) : (
            <p className="text-[#666] text-sm">No open positions</p>
          )}
        </div>

        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
          <h3 className="text-[#c0c0c0] text-sm font-medium mb-4">Top Strategy Exposure</h3>
          {topStrategy ? (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-[#c0c0c0] font-medium">{topStrategy[0]}</span>
                <span className="text-lg font-bold text-blue-400">{topStrategyPct.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-[#0d0d0d] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
                  style={{ width: `${topStrategyPct}%` }}
                />
              </div>
              <p className="text-xs text-[#666]">${formatNumber(topStrategy[1])} exposure</p>
            </div>
          ) : (
            <p className="text-[#666] text-sm">No open positions</p>
          )}
        </div>
      </div>

      {/* Risk Violations */}
      {(overRiskTrades.length > 0 || totalRiskViolation) && (
        <div className="bg-gradient-to-br from-red-500/20 to-[#0d0d0d] rounded-xl p-5 border border-red-500/40">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <h3 className="text-red-400 text-sm font-medium">Active Risk Violations</h3>
          </div>
          <div className="space-y-2">
            {totalRiskViolation && (
              <div className="bg-[#151515] rounded-lg p-3 border border-red-500/30">
                <p className="text-sm text-red-400 font-semibold">Total risk exceeds limit</p>
                <p className="text-xs text-[#888] mt-1">
                  Current: {currentRiskPct.toFixed(2)}% | Limit: {MAX_TOTAL_RISK}%
                </p>
              </div>
            )}
            {overRiskTrades.map(t => (
              <div key={t.id} className="bg-[#151515] rounded-lg p-3 border border-red-500/20">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#c0c0c0]">{t.coin?.replace('USDT', '')}</span>
                  <span className="text-sm text-red-400 font-bold">{(t.risk_percent || 0).toFixed(2)}%</span>
                </div>
                <p className="text-xs text-[#666] mt-1">Risk limit: {MAX_RISK_PER_TRADE}%</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}