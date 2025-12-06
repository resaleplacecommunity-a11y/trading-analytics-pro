import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Plus, Download } from 'lucide-react';

import TradeCard from '../components/trades/TradeCard';
import TradeForm from '../components/trades/TradeForm';
import TradeDetailModal from '../components/trades/TradeDetailModal';
import TradeFilters from '../components/trades/TradeFilters';

export default function Trades() {
  const [showForm, setShowForm] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    direction: 'all',
    strategy: 'all',
    coin: 'all',
    dateFrom: '',
    dateTo: '',
    minR: '',
    maxR: '',
    ruleCompliance: 'all'
  });

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
      setShowForm(false);
      setEditingTrade(null);
      setSelectedTrade(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Trade.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['trades']);
      setSelectedTrade(null);
    },
  });

  // Get unique values for filters
  const strategies = [...new Set(trades.map(t => t.strategy_tag).filter(Boolean))];
  const coins = [...new Set(trades.map(t => t.coin).filter(Boolean))];

  // Apply filters
  const filteredTrades = trades.filter(trade => {
    if (filters.search) {
      const search = filters.search.toLowerCase();
      if (!trade.coin?.toLowerCase().includes(search) && 
          !trade.strategy_tag?.toLowerCase().includes(search)) {
        return false;
      }
    }
    if (filters.direction !== 'all' && trade.direction !== filters.direction) return false;
    if (filters.strategy !== 'all' && trade.strategy_tag !== filters.strategy) return false;
    if (filters.coin !== 'all' && trade.coin !== filters.coin) return false;
    if (filters.ruleCompliance !== 'all') {
      const compliance = filters.ruleCompliance === 'true';
      if (trade.rule_compliance !== compliance) return false;
    }
    if (filters.dateFrom && new Date(trade.date) < new Date(filters.dateFrom)) return false;
    if (filters.dateTo && new Date(trade.date) > new Date(filters.dateTo + 'T23:59:59')) return false;
    if (filters.minR && (trade.r_multiple || 0) < parseFloat(filters.minR)) return false;
    if (filters.maxR && (trade.r_multiple || 0) > parseFloat(filters.maxR)) return false;
    return true;
  });

  const handleSave = (data) => {
    if (editingTrade) {
      updateMutation.mutate({ id: editingTrade.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (trade) => {
    setEditingTrade(trade);
    setSelectedTrade(null);
    setShowForm(true);
  };

  const handleDelete = (trade) => {
    if (confirm('Are you sure you want to delete this trade?')) {
      deleteMutation.mutate(trade.id);
    }
  };

  const exportCSV = () => {
    const headers = ['Date', 'Coin', 'Direction', 'Entry', 'Close', 'PNL $', 'PNL %', 'R Multiple', 'Strategy'];
    const rows = filteredTrades.map(t => [
      t.date,
      t.coin,
      t.direction,
      t.entry_price,
      t.close_price,
      t.pnl_usd,
      t.pnl_percent,
      t.r_multiple,
      t.strategy_tag
    ]);
    
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trades.csv';
    a.click();
  };

  // Stats for filtered trades
  const totalPnl = filteredTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
  const totalR = filteredTrades.reduce((s, t) => s + (t.r_multiple || 0), 0);
  const wins = filteredTrades.filter(t => (t.pnl_usd || 0) > 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#c0c0c0]">Trades</h1>
          <p className="text-[#666] text-sm">
            {filteredTrades.length} trades • 
            <span className={totalPnl >= 0 ? " text-emerald-400" : " text-red-400"}>
              {' '}${totalPnl.toFixed(2)}
            </span> • 
            <span className={totalR >= 0 ? " text-emerald-400" : " text-red-400"}>
              {' '}{totalR.toFixed(1)}R
            </span> • 
            {' '}{wins}W / {filteredTrades.length - wins}L
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={exportCSV}
            className="border-[#2a2a2a] text-[#888]"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button 
            onClick={() => { setEditingTrade(null); setShowForm(true); }}
            className="bg-[#c0c0c0] text-black hover:bg-[#a0a0a0]"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Trade
          </Button>
        </div>
      </div>

      {/* Filters */}
      <TradeFilters 
        filters={filters}
        setFilters={setFilters}
        strategies={strategies}
        coins={coins}
      />

      {/* Trade List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-[#c0c0c0] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredTrades.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredTrades.map(trade => (
            <TradeCard 
              key={trade.id} 
              trade={trade} 
              onClick={setSelectedTrade}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-[#666]">No trades found</p>
          <Button 
            onClick={() => setShowForm(true)}
            className="mt-4 bg-[#c0c0c0] text-black hover:bg-[#a0a0a0]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add First Trade
          </Button>
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <TradeForm 
          trade={editingTrade}
          onSubmit={handleSave}
          onClose={() => { setShowForm(false); setEditingTrade(null); }}
        />
      )}

      {selectedTrade && (
        <TradeDetailModal
          trade={selectedTrade}
          onClose={() => setSelectedTrade(null)}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}