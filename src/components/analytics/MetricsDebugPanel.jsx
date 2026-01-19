import { useState } from 'react';
import { Bug, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function MetricsDebugPanel({ metrics, trades, userTimezone }) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedMetric, setExpandedMetric] = useState(null);

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        size="sm"
        className="fixed bottom-4 right-4 z-50 bg-[#1a1a1a] border-amber-500/30 hover:border-amber-500/50"
      >
        <Bug className="w-4 h-4 mr-2 text-amber-400" />
        Debug Metrics
      </Button>
    );
  }

  const debugData = {
    'Net PNL': {
      definition: 'Sum of pnl_usd from all CLOSED trades only',
      filters: 'trades.filter(t => t.close_price)',
      tradeIds: trades.filter(t => t.close_price).map(t => t.id),
      intermediate: {
        closedCount: trades.filter(t => t.close_price).length,
        sumPnl: trades.filter(t => t.close_price).reduce((s, t) => s + (t.pnl_usd || 0), 0)
      },
      formula: 'sum(pnl_usd) for closed trades',
      result: metrics.netPnlUsd
    },
    'Winrate': {
      definition: 'Wins / (Wins + Losses), excluding Breakeven. BE = |pnl| <= $0.5 OR |pnl%| <= 0.01%',
      filters: 'Wins: pnl > $0.5 AND pnl% > 0.01%. Losses: pnl < -$0.5 AND pnl% > 0.01%',
      tradeIds: trades.filter(t => t.close_price).map(t => ({
        id: t.id,
        pnl: t.pnl_usd,
        type: Math.abs(t.pnl_usd || 0) <= 0.5 ? 'BE' : (t.pnl_usd || 0) > 0.5 ? 'WIN' : 'LOSS'
      })),
      intermediate: {
        wins: metrics.wins,
        losses: metrics.losses,
        breakevens: metrics.breakevens
      },
      formula: 'wins / (wins + losses) * 100',
      result: metrics.winrate
    },
    'Avg R': {
      definition: 'Average R-multiple for CLOSED trades with valid original_risk_usd > 0',
      filters: 'trades.filter(t => t.close_price && t.original_risk_usd != null && t.original_risk_usd > 0)',
      tradeIds: trades.filter(t => t.close_price && t.original_risk_usd).map(t => ({
        id: t.id,
        r_multiple: t.r_multiple,
        original_risk: t.original_risk_usd
      })),
      intermediate: {
        tradesWithR: trades.filter(t => t.close_price && t.original_risk_usd).length,
        sumR: trades.filter(t => t.close_price && t.original_risk_usd).reduce((s, t) => s + (t.r_multiple || 0), 0)
      },
      formula: 'sum(r_multiple) / count(trades_with_valid_risk)',
      result: metrics.avgR
    },
    'Profit Factor': {
      definition: 'Gross Profit / Gross Loss (wins sum / losses sum absolute)',
      filters: 'Same as Winrate (exclude BE)',
      tradeIds: trades.filter(t => t.close_price).map(t => ({
        id: t.id,
        pnl: t.pnl_usd,
        contributes: Math.abs(t.pnl_usd || 0) > 0.5 ? ((t.pnl_usd || 0) > 0 ? 'PROFIT' : 'LOSS') : 'EXCLUDED'
      })),
      intermediate: {
        grossProfit: metrics.grossProfit,
        grossLoss: metrics.grossLoss
      },
      formula: 'grossProfit / grossLoss',
      result: metrics.profitFactor
    },
    'Max Drawdown': {
      definition: 'Maximum % drop from peak equity. Equity curve built from CLOSED trades only, chronologically by date_close',
      filters: 'trades.filter(t => t.close_price).sort((a,b) => date_close)',
      tradeIds: trades.filter(t => t.close_price).sort((a, b) => 
        new Date(a.date_close || a.date) - new Date(b.date_close || b.date)
      ).map(t => ({
        id: t.id,
        date_close: t.date_close,
        pnl: t.pnl_usd
      })),
      intermediate: {
        peakEquity: Math.max(...(metrics.equityCurve || []).map(p => p.equity || 0)),
        lowestEquity: Math.min(...(metrics.equityCurve || []).map(p => p.equity || 0))
      },
      formula: 'max((equity - peak) / peak * 100) across all points',
      result: `${metrics.maxDrawdown?.percent?.toFixed(2)}% ($${metrics.maxDrawdown?.usd?.toFixed(0)})`
    },
    'Today Trades': {
      definition: `Trades OPENED today in user timezone (${userTimezone}). Today = getTodayInUserTz(${userTimezone})`,
      filters: 'parseTradeDateToUserTz(date_open, tz) === today',
      tradeIds: trades.filter(t => {
        const { getTodayInUserTz, parseTradeDateToUserTz } = require('../utils/dateUtils');
        const today = getTodayInUserTz(userTimezone);
        const tradeDate = parseTradeDateToUserTz(t.date_open || t.date, userTimezone);
        return tradeDate === today;
      }).map(t => ({ id: t.id, date_open: t.date_open })),
      intermediate: {
        today: (() => {
          const { getTodayInUserTz } = require('../utils/dateUtils');
          return getTodayInUserTz(userTimezone);
        })()
      },
      formula: 'count(trades with date_open in today)',
      result: '(see Risk Manager)'
    },
    'Revenge Trading': {
      definition: 'Trades opened within 30 minutes AFTER closing a losing trade. Delta = trade.date_open - last_loss.date_close',
      filters: 'For each trade: find last closed loss before it, check if 0 < delta <= 30min',
      tradeIds: [],
      intermediate: {
        algorithm: '1) Sort by date_open. 2) For each trade T: find last loss before T.date_open. 3) If (T.date_open - loss.date_close) <= 30min → revenge'
      },
      formula: 'count(trades matching condition)',
      result: '(see Psychology Insights)'
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[600px] max-h-[80vh] overflow-y-auto bg-[#0a0a0a] border-2 border-amber-500/50 rounded-xl shadow-2xl">
      <div className="sticky top-0 bg-[#111] border-b border-amber-500/30 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bug className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold text-[#c0c0c0]">Metrics Debug Panel</h3>
        </div>
        <Button
          onClick={() => setIsOpen(false)}
          variant="ghost"
          size="sm"
          className="text-[#888] hover:text-[#c0c0c0]"
        >
          Close
        </Button>
      </div>

      <div className="p-4 space-y-2">
        {Object.entries(debugData).map(([metricName, data]) => (
          <div key={metricName} className="bg-[#111] rounded-lg border border-[#2a2a2a]">
            <button
              onClick={() => setExpandedMetric(expandedMetric === metricName ? null : metricName)}
              className="w-full p-4 flex items-center justify-between hover:bg-[#1a1a1a] transition-colors"
            >
              <div className="flex items-center gap-2">
                {expandedMetric === metricName ? (
                  <ChevronDown className="w-4 h-4 text-amber-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[#666]" />
                )}
                <span className="font-medium text-[#c0c0c0]">{metricName}</span>
              </div>
              <span className="text-amber-400 font-mono text-sm">{data.result}</span>
            </button>

            {expandedMetric === metricName && (
              <div className="p-4 pt-0 space-y-3 text-xs">
                <div>
                  <div className="text-[#888] font-medium mb-1">Definition:</div>
                  <div className="text-[#c0c0c0] bg-[#0a0a0a] p-2 rounded">{data.definition}</div>
                </div>

                <div>
                  <div className="text-[#888] font-medium mb-1">Filters/Conditions:</div>
                  <div className="text-[#c0c0c0] bg-[#0a0a0a] p-2 rounded font-mono">{data.filters}</div>
                </div>

                <div>
                  <div className="text-[#888] font-medium mb-1">Intermediate Values:</div>
                  <div className="text-[#c0c0c0] bg-[#0a0a0a] p-2 rounded font-mono">
                    {JSON.stringify(data.intermediate, null, 2)}
                  </div>
                </div>

                <div>
                  <div className="text-[#888] font-medium mb-1">Formula:</div>
                  <div className="text-amber-400 bg-[#0a0a0a] p-2 rounded font-mono">{data.formula}</div>
                </div>

                <div>
                  <div className="text-[#888] font-medium mb-1">Trade IDs (first 10):</div>
                  <div className="text-[#666] bg-[#0a0a0a] p-2 rounded max-h-40 overflow-y-auto">
                    {Array.isArray(data.tradeIds) ? (
                      data.tradeIds.slice(0, 10).map((item, i) => (
                        <div key={i} className="font-mono text-xs mb-1">
                          {typeof item === 'object' ? JSON.stringify(item) : item}
                        </div>
                      ))
                    ) : (
                      <div className="text-[#888]">N/A</div>
                    )}
                    {data.tradeIds.length > 10 && (
                      <div className="text-[#888] mt-2">...and {data.tradeIds.length - 10} more</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}