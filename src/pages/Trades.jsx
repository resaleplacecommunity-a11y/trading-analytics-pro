import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import TradeTable from '../components/trades/TradeTable';
import TradeAssistantModal from '../components/trades/TradeAssistantModal';
import ManualTradeForm from '../components/trades/ManualTradeForm';

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

  // Get current balance from all closed trades (realized PNL only)
  const closedTrades = trades.filter(t => t.close_price_final || t.close_price);
  const totalPnl = closedTrades.reduce((s, t) => s + (t.pnl_total_usd || t.pnl_usd || 0), 0);
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
    
    // Create entries array
    const entries = [{
      price: parseFloat(data.entry_price) || 0,
      size_usd: parseFloat(data.position_size) || 0,
      timestamp: now
    }];
    
    // Create initial stop history
    const stopHistory = data.stop_price ? [{
      stop_price: parseFloat(data.stop_price),
      timestamp: now
    }] : [];
    
    // Calculate initial risk
    const entryPrice = parseFloat(data.entry_price) || 0;
    const stopPrice = parseFloat(data.stop_price) || 0;
    const size = parseFloat(data.position_size) || 0;
    const sign = data.direction === 'Long' ? 1 : -1;
    
    const initialRiskUsd = stopPrice > 0 ? 
      Math.abs(entryPrice - stopPrice) / entryPrice * size : 0;
    
    const tradeData = {
      ...data,
      status: 'OPEN',
      date_open: data.date_open || now,
      date: data.date || now,
      balance_entry: data.account_balance_at_entry || currentBalance,
      account_balance_at_entry: data.account_balance_at_entry || currentBalance,
      entries: JSON.stringify(entries),
      stop_history: JSON.stringify(stopHistory),
      stop_price_current: stopPrice,
      initial_risk_usd: initialRiskUsd,
      max_risk_usd: initialRiskUsd,
      max_risk_pct: (initialRiskUsd / currentBalance) * 100
    };
    createMutation.mutate(tradeData);
  };

  const handleUpdate = (id, updatedData) => {
    updateMutation.mutate({ id, data: updatedData });
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
  const openTrades = trades.filter((t) => !(t.close_price_final || t.close_price)).length;
  const totalTrades = trades.length;
  const longTrades = trades.filter((t) => t.direction === 'Long').length;
  const shortTrades = trades.filter((t) => t.direction === 'Short').length;
  const closed = trades.filter((t) => t.close_price_final || t.close_price);
  const wins = closed.filter((t) => (t.pnl_total_usd || t.pnl_usd || 0) > 0).length;
  const losses = closed.filter((t) => (t.pnl_total_usd || t.pnl_usd || 0) < 0).length;

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
          {bulkDeleteMode &&
          <Button
            size="sm"
            variant="destructive"
            onClick={handleDeleteAll}
            className="h-8 px-3 bg-red-600 hover:bg-red-700">

              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Delete All
            </Button>
          }
          <Button
            size="sm"
            onClick={() => setShowAssistant(true)}
            className="bg-white hover:bg-gray-100 text-black font-semibold h-8 px-4">

            <Plus className="w-4 h-4 mr-1.5" />
            New Trade
          </Button>
          <Button
            size="sm"
            variant={bulkDeleteMode ? "secondary" : "ghost"}
            onClick={() => {
              setBulkDeleteMode(!bulkDeleteMode);
              setSelectedTradeIds([]);
            }} className="bg-rose-600 text-[#ffffff] p-0 text-xs font-medium opacity-50 rounded-lg inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground h-8 w-8">


            <Trash2 className="w-4 h-4" />
          </Button>
          {bulkDeleteMode && selectedTradeIds.length > 0 &&
          <Button
            size="sm"
            variant="destructive"
            onClick={handleBulkDelete}
            className="h-8 px-3">

              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Delete ({selectedTradeIds.length})
            </Button>
          }
        </div>
      </div>

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