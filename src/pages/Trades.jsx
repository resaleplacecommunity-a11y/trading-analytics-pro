import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Plus, Download } from 'lucide-react';

import TradeTable from '../components/trades/TradeTable';
import TradeForm from '../components/trades/TradeForm';

export default function Trades() {
  const [showForm, setShowForm] = useState(false);

  const queryClient = useQueryClient();

  const { data: trades = [], isLoading } = useQuery({
    queryKey: ['trades'],
    queryFn: () => base44.entities.Trade.list('-date', 1000),
  });

  // Get current balance from all trades
  const totalPnl = trades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
  const currentBalance = 100000 + totalPnl;

  const createMutation = useMutation({
    mutationFn: (data) => {
      // Auto-calculate metrics before save
      const calculated = calculateTradeMetrics(data, currentBalance);
      return base44.entities.Trade.create({ ...data, ...calculated });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['trades']);
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Trade.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['trades']);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Trade.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['trades']);
    },
  });

  const handleSave = (data) => {
    // Set current time for new trades in Moscow timezone
    const now = new Date();
    const moscowOffset = 3 * 60; // UTC+3 in minutes
    const localOffset = now.getTimezoneOffset();
    const moscowTime = new Date(now.getTime() + (moscowOffset + localOffset) * 60 * 1000);
    const moscowISO = moscowTime.toISOString();
    
    const tradeData = {
      ...data,
      date_open: data.date_open || moscowISO,
      date: data.date || moscowISO,
      account_balance_at_entry: data.account_balance_at_entry || currentBalance
    };
    createMutation.mutate(tradeData);
  };

  const handleUpdate = (updatedTrade) => {
    // Recalculate metrics with current balance
    const calculated = calculateTradeMetrics(updatedTrade, currentBalance);
    updateMutation.mutate({ id: updatedTrade.id, data: { ...updatedTrade, ...calculated } });
  };

  const handleDelete = (trade) => {
    if (confirm('Delete this trade?')) {
      deleteMutation.mutate(trade.id);
    }
  };

  const handleMoveStopToBE = (trade) => {
    const updatedTrade = {
      ...trade,
      stop_price: trade.entry_price,
      original_stop_price: trade.original_stop_price || trade.stop_price
    };
    updateMutation.mutate({ id: trade.id, data: updatedTrade });
  };

  const exportCSV = () => {
    const headers = ['Date', 'Coin', 'Direction', 'Entry', 'Stop', 'Take', 'Close', 'Size', 'PNL $', 'PNL %', 'R', 'Strategy'];
    const rows = trades.map(t => [
      new Date(t.date).toISOString().split('T')[0],
      t.coin?.replace('USDT', ''),
      t.direction,
      t.entry_price,
      t.stop_price,
      t.take_price,
      t.close_price || '',
      t.position_size,
      t.pnl_usd || 0,
      t.pnl_percent_of_balance || 0,
      t.r_multiple || 0,
      t.strategy_tag || ''
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trades_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Stats for summary
  const openTrades = trades.filter(t => !t.close_price).length;
  const totalTrades = trades.length;
  const longTrades = trades.filter(t => t.direction === 'Long').length;
  const shortTrades = trades.filter(t => t.direction === 'Short').length;
  const closedTrades = trades.filter(t => t.close_price);
  const wins = closedTrades.filter(t => (t.pnl_usd || 0) > 0).length;
  const losses = closedTrades.filter(t => (t.pnl_usd || 0) < 0).length;

  return (
    <div className="space-y-3">
      {/* Header with Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold text-[#c0c0c0]">Trade Journal</h1>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[#666]">Open</span>
              <span className="text-amber-400 font-bold">{openTrades}</span>
              <span className="text-[#666]">/</span>
              <span className="text-[#888]">{totalTrades}</span>
            </div>
            <div className="h-3 w-px bg-[#2a2a2a]" />
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-400 font-bold">L: {longTrades}</span>
              <span className="text-[#666]">/</span>
              <span className="text-red-400 font-bold">S: {shortTrades}</span>
            </div>
            <div className="h-3 w-px bg-[#2a2a2a]" />
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-400 font-bold">W: {wins}</span>
              <span className="text-[#666]">/</span>
              <span className="text-red-400 font-bold">L: {losses}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            size="sm"
            variant="outline"
            onClick={exportCSV}
            className="border-[#2a2a2a] text-[#888] h-7"
          >
            <Download className="w-3 h-3 mr-1" />
            Export
          </Button>
          <Button 
            size="sm"
            onClick={() => setShowForm(true)}
            className="bg-[#c0c0c0] text-black hover:bg-[#a0a0a0] h-7"
          >
            <Plus className="w-3 h-3 mr-1" />
            New Trade
          </Button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-[#666]">Loading trades...</div>
      ) : (
        <TradeTable
          trades={trades}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onMoveStopToBE={handleMoveStopToBE}
          currentBalance={currentBalance}
        />
      )}

      {/* Form Modal */}
      {showForm && (
        <TradeForm 
          onSubmit={handleSave}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

// Helper function
function calculateTradeMetrics(trade, currentBalance) {
  const isLong = trade.direction === 'Long';
  const entry = parseFloat(trade.entry_price) || 0;
  const stop = parseFloat(trade.stop_price) || 0;
  const originalStop = parseFloat(trade.original_stop_price) || stop;
  const take = parseFloat(trade.take_price) || 0;
  const size = parseFloat(trade.position_size) || 0;
  const close = parseFloat(trade.close_price) || 0;
  const balance = parseFloat(trade.account_balance_at_entry) || currentBalance || 100000;

  if (!entry || !size) return { account_balance_at_entry: balance };

  // Calculate risk from CURRENT stop
  let riskUsd = 0;
  let riskPercent = 0;
  let plannedRR = 0;
  let potentialRewardUsd = 0;
  
  if (stop) {
    const stopDistance = Math.abs(entry - stop);
    riskUsd = (stopDistance / entry) * size;
    riskPercent = (riskUsd / balance) * 100;
    
    // Planned RR based on current stop and take
    if (take) {
      const takeDistance = Math.abs(take - entry);
      potentialRewardUsd = (takeDistance / entry) * size;
      plannedRR = riskUsd !== 0 ? potentialRewardUsd / riskUsd : 0;
    }
  }

  // Actual R for closed trades - use ORIGINAL stop
  let pnlUsd = 0;
  let pnlPercent = 0;
  let actualR = 0;

  if (close) {
    const priceMove = isLong ? (close - entry) : (entry - close);
    pnlUsd = (priceMove / entry) * size;
    pnlPercent = (pnlUsd / balance) * 100;
    
    // R uses original stop (before BE move)
    if (originalStop) {
      const originalStopDistance = Math.abs(entry - originalStop);
      const originalRiskUsd = (originalStopDistance / entry) * size;
      actualR = originalRiskUsd !== 0 ? pnlUsd / originalRiskUsd : 0;
    }
  }

  return {
    risk_usd: riskUsd,
    risk_percent: riskPercent,
    rr_ratio: plannedRR,
    potential_reward_usd: potentialRewardUsd,
    pnl_usd: pnlUsd,
    pnl_percent_of_balance: pnlPercent,
    r_multiple: actualR,
    account_balance_at_entry: balance
  };
}