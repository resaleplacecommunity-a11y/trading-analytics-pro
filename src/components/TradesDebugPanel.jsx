import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export default function TradesDebugPanel({ trades, paginatedCount, filters, activeProfileId }) {
  const [expanded, setExpanded] = useState(false);

  const openTrades = trades.filter(t => !t.close_price);
  const closedTrades = trades.filter(t => t.close_price);

  // Get unique test_run_ids
  const testRunIds = [...new Set(trades.map(t => t.test_run_id).filter(Boolean))];

  return (
    <div className="bg-[#0d0d0d] border border-amber-500/30 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#111] transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="w-3 h-3 text-amber-400" /> : <ChevronRight className="w-3 h-3 text-amber-400" />}
          <span className="text-xs text-amber-400 font-semibold">🔧 Debug: Trade Counts</span>
        </div>
        <span className="text-xs text-[#666]">
          O:{openTrades.length} C:{closedTrades.length} Total:{trades.length}
        </span>
      </button>
      
      {expanded && (
        <div className="px-3 pb-3 space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#111] rounded p-2">
              <div className="text-[#666] mb-1">OPEN Trades</div>
              <div className="text-amber-400 font-bold text-lg">{openTrades.length}</div>
              <div className="text-[10px] text-[#666]">rendered: {paginatedCount.open || openTrades.length}</div>
            </div>
            
            <div className="bg-[#111] rounded p-2">
              <div className="text-[#666] mb-1">CLOSED Trades</div>
              <div className="text-emerald-400 font-bold text-lg">{closedTrades.length}</div>
              <div className="text-[10px] text-[#666]">rendered: {paginatedCount.closed || closedTrades.length}</div>
            </div>
          </div>

          <div className="bg-[#111] rounded p-2 space-y-1">
            <div className="text-[#666] font-semibold mb-1">Active Filters:</div>
            <div className="text-[10px] space-y-0.5">
              <div className="flex justify-between">
                <span className="text-[#888]">Profile ID:</span>
                <span className="text-[#c0c0c0] font-mono">{activeProfileId || 'none'}</span>
              </div>
              {filters?.test_run_id && (
                <div className="flex justify-between">
                  <span className="text-[#888]">Test Run ID:</span>
                  <span className="text-emerald-400 font-mono text-[9px]">{filters.test_run_id}</span>
                </div>
              )}
              {filters?.dateFrom && (
                <div className="flex justify-between">
                  <span className="text-[#888]">Date From:</span>
                  <span className="text-[#c0c0c0]">{filters.dateFrom.toLocaleDateString()}</span>
                </div>
              )}
              {filters?.dateTo && (
                <div className="flex justify-between">
                  <span className="text-[#888]">Date To:</span>
                  <span className="text-[#c0c0c0]">{filters.dateTo.toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>

          {testRunIds.length > 0 && (
            <div className="bg-[#111] rounded p-2">
              <div className="text-[#666] font-semibold mb-1">Test Run IDs in dataset:</div>
              <div className="text-[10px] space-y-0.5 max-h-20 overflow-y-auto">
                {testRunIds.map((id, i) => (
                  <div key={i} className="text-[#888] font-mono">{id}</div>
                ))}
              </div>
            </div>
          )}

          <div className="text-[9px] text-amber-400/70 italic">
            ℹ️ If rendered count ≠ total count, pagination is active
          </div>
        </div>
      )}
    </div>
  );
}