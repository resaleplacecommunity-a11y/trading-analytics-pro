import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Plus, Download } from 'lucide-react';

import TradeTable from '../components/trades/TradeTable';
import TradeForm from '../components/trades/TradeForm';
import CloseTradeModal from '../components/trades/CloseTradeModal';

export default function Trades() {
  const [showForm, setShowForm] = useState(false);
  const [closingTrade, setClosingTrade] = useState(null);

  const queryClient = useQueryClient();

  const { data: trades = [], isLoading } = useQuery({
    queryKey: ['trades'],
    queryFn: () => base44.entities.Trade.list('-date', 1000),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Trade.create(data),
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
    createMutation.mutate(data);
  };

  const handleUpdate = (updatedTrade) => {
    updateMutation.mutate({ id: updatedTrade.id, data: updatedTrade });
  };

  const handleDelete = (trade) => {
    if (confirm('Are you sure you want to delete this trade?')) {
      deleteMutation.mutate(trade.id);
    }
  };

  const handleClosePosition = (updatedTrade) => {
    updateMutation.mutate({ id: updatedTrade.id, data: updatedTrade });
    setClosingTrade(null);
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
      t.pnl_percent_of_balance || t.pnl_percent || 0,
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

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#c0c0c0]">Trades Journal</h1>
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

      {/* Table with integrated filters */}
      {isLoading ? (
        <div className="text-center py-12 text-[#666]">
          Loading trades...
        </div>
      ) : (
        <TradeTable
          trades={trades}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onClosePosition={setClosingTrade}
          onMoveStopToBE={handleMoveStopToBE}
        />
      )}

      {/* Modals */}
      {showForm && (
        <TradeForm 
          onSubmit={handleSave}
          onClose={() => setShowForm(false)}
        />
      )}

      {closingTrade && (
        <CloseTradeModal
          trade={closingTrade}
          onClose={() => setClosingTrade(null)}
          onConfirm={handleClosePosition}
        />
      )}
    </div>
  );
}