import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import TradeTable from '../components/trades/TradeTable';
import TradeAssistantModal from '../components/trades/TradeAssistantModal';
import ManualTradeForm from '../components/trades/ManualTradeForm';
import RiskViolationBanner from '../components/RiskViolationBanner';
import { formatInTimeZone } from 'date-fns-tz';

export default function Trades() {
  const [showAssistant, setShowAssistant] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
  const [selectedTradeIds, setSelectedTradeIds] = useState([]);

  const queryClient = useQueryClient();

  const { data: trades = [], isLoading } = useQuery({
    queryKey: ['trades'],
    queryFn: () => base44.entities.Trade.list('-date', 1000)
  });

  const { data: riskSettings } = useQuery({
    queryKey: ['riskSettings'],
    queryFn: async () => {
      const settings = await base44.entities.RiskSettings.list();
      return settings[0] || null;
    },
  });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // Get current balance from all trades
  const totalPnl = trades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
  const currentBalance = 100000 + totalPnl;

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Trade.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['trades']);
      setShowAssistant(false);
      setShowManualForm(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Trade.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['trades']);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Trade.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['trades']);
    }
  });

  const handleSave = (data) => {
    // Set current time for new trades
    const now = new Date().toISOString();
    const calculated = calculateTradeMetrics(data, currentBalance);
    const tradeData = {
      ...data,
      ...calculated,
      date_open: data.date_open || now,
      date: data.date || now,
      account_balance_at_entry: data.account_balance_at_entry || currentBalance
    };
    createMutation.mutate(tradeData);
  };

  const handleUpdate = (id, updatedData) => {
    const calculated = calculateTradeMetrics(updatedData, currentBalance);
    updateMutation.mutate({ id, data: { ...updatedData, ...calculated } });
  };

  const handleDelete = (trade) => {
    if (confirm('Delete this trade?')) {
      deleteMutation.mutate(trade.id);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTradeIds.length === 0) return;
    if (confirm(`Delete ${selectedTradeIds.length} trade(s)?`)) {
      for (const id of selectedTradeIds) {
        await base44.entities.Trade.delete(id);
      }
      queryClient.invalidateQueries(['trades']);
      setSelectedTradeIds([]);
      setBulkDeleteMode(false);
      toast.success(`Deleted ${selectedTradeIds.length} trade(s)`);
    }
  };

  const handleDeleteAll = async () => {
    if (confirm(`Delete ALL ${trades.length} trades? This cannot be undone!`)) {
      for (const trade of trades) {
        await base44.entities.Trade.delete(trade.id);
      }
      queryClient.invalidateQueries(['trades']);
      setSelectedTradeIds([]);
      setBulkDeleteMode(false);
      toast.success('All trades deleted');
    }
  };

  const toggleTradeSelection = (tradeId) => {
    setSelectedTradeIds((prev) =>
    prev.includes(tradeId) ?
    prev.filter((id) => id !== tradeId) :
    [...prev, tradeId]
    );
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
    const rows = trades.map((t) => [
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
    t.strategy_tag || '']
    );

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trades_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Stats for summary
  const openTrades = trades.filter((t) => !t.close_price).length;
  const totalTrades = trades.length;
  const longTrades = trades.filter((t) => t.direction === 'Long').length;
  const shortTrades = trades.filter((t) => t.direction === 'Short').length;
  const closedTrades = trades.filter((t) => t.close_price);
  const wins = closedTrades.filter((t) => (t.pnl_usd || 0) > 0).length;
  const losses = closedTrades.filter((t) => (t.pnl_usd || 0) < 0).length;

  // Check violations
  const userTimezone = user?.preferred_timezone || 'UTC';
  const today = formatInTimeZone(new Date(), userTimezone, 'yyyy-MM-dd');
  
  const todayTrades = trades.filter(t => {
    const tradeDate = t.date_close || t.date_open || t.date;
    if (!tradeDate) return false;
    try {
      const tradeDateInUserTz = formatInTimeZone(new Date(tradeDate), userTimezone, 'yyyy-MM-dd');
      return tradeDateInUserTz === today;
    } catch {
      return tradeDate.startsWith(today);
    }
  });

  const closedTodayTrades = todayTrades.filter(t => t.close_price);
  const todayPnlPercent = closedTodayTrades.reduce((s, t) => {
    const balance = t.account_balance_at_entry || 100000;
    return s + ((t.pnl_usd || 0) / balance) * 100;
  }, 0);
  const todayR = closedTodayTrades.reduce((s, t) => s + (t.r_multiple || 0), 0);

  const recentTrades = [...trades].filter(t => t.close_price).sort((a, b) => 
    new Date(b.date_close || b.date) - new Date(a.date_close || a.date)
  ).slice(0, 10);
  const consecutiveLosses = recentTrades.findIndex(t => (t.pnl_usd || 0) >= 0);
  const lossStreak = consecutiveLosses === -1 ? Math.min(recentTrades.length, riskSettings?.max_consecutive_losses || 3) : consecutiveLosses;

  const violations = [];
  if (riskSettings) {
    if (riskSettings.daily_max_loss_percent && todayPnlPercent < -riskSettings.daily_max_loss_percent) {
      violations.push({
        rule: 'Daily Loss Limit',
        value: `${todayPnlPercent.toFixed(2)}%`,
        limit: `${riskSettings.daily_max_loss_percent}%`,
      });
    }
    if (riskSettings.daily_max_r && todayR < -riskSettings.daily_max_r) {
      violations.push({
        rule: 'Daily R Loss',
        value: `${todayR.toFixed(2)}R`,
        limit: `${riskSettings.daily_max_r}R`,
      });
    }
    if (riskSettings.max_trades_per_day && todayTrades.length >= riskSettings.max_trades_per_day) {
      violations.push({
        rule: 'Max Trades',
        value: `${todayTrades.length}`,
        limit: `${riskSettings.max_trades_per_day}`,
      });
    }
    if (lossStreak >= (riskSettings.max_consecutive_losses || 3)) {
      violations.push({
        rule: 'Loss Streak',
        value: `${lossStreak} losses`,
        limit: `${riskSettings.max_consecutive_losses}`,
      });
    }
  }

  return (
    <div className="space-y-3">
      {/* Header with Summary */}
      <div className="flex items-center justify-between backdrop-blur-sm bg-[#0d0d0d]/50 border border-[#2a2a2a]/50 rounded-lg p-3">
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
            onClick={() => setShowAssistant(true)}
            className="bg-white hover:bg-gray-100 text-black font-semibold h-8 px-4">
            <Plus className="w-4 h-4 mr-1.5" />
            New Trade
          </Button>

          {bulkDeleteMode ? (
            <>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDeleteAll}
                className="h-8 px-3 bg-red-600 hover:bg-red-700">
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Delete All
              </Button>

              {selectedTradeIds.length > 0 && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleBulkDelete}
                  className="h-8 px-3">
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Delete ({selectedTradeIds.length})
                </Button>
              )}
            </>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setBulkDeleteMode(true);
                setSelectedTradeIds([]);
              }}
              className="bg-rose-700 text-slate-50 p-0 text-xs font-medium opacity-70 rounded-xl h-8 w-8 hover:bg-rose-600">
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Risk Violation Banner */}
      <RiskViolationBanner violations={violations} />

      {/* Table */}
      {isLoading ?
      <div className="text-center py-12 text-[#666]">Loading trades...</div> :

      <TradeTable
        trades={trades}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onMoveStopToBE={handleMoveStopToBE}
        currentBalance={currentBalance}
        bulkDeleteMode={bulkDeleteMode}
        selectedTradeIds={selectedTradeIds}
        onToggleSelection={toggleTradeSelection} />

      }

      {/* AI Assistant Modal */}
      <TradeAssistantModal
        isOpen={showAssistant}
        onClose={() => setShowAssistant(false)}
        onAddManually={() => {
          setShowAssistant(false);
          setShowManualForm(true);
        }} />


      {/* Manual Trade Form */}
      <ManualTradeForm
        isOpen={showManualForm}
        onClose={() => setShowManualForm(false)}
        onSubmit={(data) => {
          handleSave({ ...data, account_balance_at_entry: currentBalance });
        }}
        currentBalance={currentBalance} />

    </div>);

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
    riskUsd = stopDistance / entry * size;
    riskPercent = riskUsd / balance * 100;

    // Planned RR based on current stop and take
    if (take) {
      const takeDistance = Math.abs(take - entry);
      potentialRewardUsd = takeDistance / entry * size;
      plannedRR = riskUsd !== 0 ? potentialRewardUsd / riskUsd : 0;
    }
  }

  // Actual R for closed trades - use ORIGINAL stop
  let pnlUsd = 0;
  let pnlPercent = 0;
  let actualR = 0;

  if (close) {
    const priceMove = isLong ? close - entry : entry - close;
    pnlUsd = priceMove / entry * size;
    pnlPercent = pnlUsd / balance * 100;

    // R uses original stop (before BE move)
    if (originalStop) {
      const originalStopDistance = Math.abs(entry - originalStop);
      const originalRiskUsd = originalStopDistance / entry * size;
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