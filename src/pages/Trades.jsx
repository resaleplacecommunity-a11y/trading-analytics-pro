import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Plus, Download } from 'lucide-react';

import TradeRowCard from '../components/trades/TradeRowCard';
import TradeForm from '../components/trades/TradeForm';
import TradeDetailModalNew from '../components/trades/TradeDetailModalNew';
import TradeFiltersNew from '../components/trades/TradeFiltersNew';

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
    ruleCompliance: 'all',
    sortBy: 'latest'
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
  let filteredTrades = trades.filter(trade => {
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
    return true;
  });

  // Apply sorting
  filteredTrades = [...filteredTrades].sort((a, b) => {
    switch (filters.sortBy) {
      case 'best_percent':
        return (b.pnl_percent || 0) - (a.pnl_percent || 0);
      case 'worst_percent':
        return (a.pnl_percent || 0) - (b.pnl_percent || 0);
      case 'best_usd':
        return (b.pnl_usd || 0) - (a.pnl_usd || 0);
      case 'worst_usd':
        return (a.pnl_usd || 0) - (b.pnl_usd || 0);
      case 'latest':
      default:
        return new Date(b.date) - new Date(a.date);
    }
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
  const totalTrades = filteredTrades.length;
  const openTrades = filteredTrades.filter(t => t.status === 'open').length;
  const longTrades = filteredTrades.filter(t => t.direction === 'Long').length;
  const shortTrades = filteredTrades.filter(t => t.direction === 'Short').length;
  const wins = filteredTrades.filter(t => (t.pnl_usd || 0) > 0).length;
  const losses = filteredTrades.filter(t => (t.pnl_usd || 0) < 0).length;
  const totalPnl = filteredTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
  const totalPnlPercent = filteredTrades.reduce((s, t) => s + (t.pnl_percent || 0), 0);
  const totalR = filteredTrades.reduce((s, t) => s + (t.r_multiple || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#c0c0c0] mb-2">Trades</h1>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs">
            <div>
              <span className="text-[#666]">Total: </span>
              <span className="text-[#c0c0c0] font-medium">{totalTrades}</span>
            </div>
            <div>
              <span className="text-[#666]">Open: </span>
              <span className="text-amber-400 font-medium">{openTrades}</span>
            </div>
            <div>
              <span className="text-[#666]">L/S: </span>
              <span className="text-emerald-400 font-medium">{longTrades}</span>
              <span className="text-[#666]">/</span>
              <span className="text-red-400 font-medium">{shortTrades}</span>
            </div>
            <div>
              <span className="text-[#666]">W/L: </span>
              <span className="text-emerald-400 font-medium">{wins}</span>
              <span className="text-[#666]">/</span>
              <span className="text-red-400 font-medium">{losses}</span>
            </div>
            <div>
              <span className="text-[#666]">PNL: </span>
              <span className={totalPnl >= 0 ? "text-emerald-400 font-medium" : "text-red-400 font-medium"}>
                ${totalPnl.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-[#666]">PNL%: </span>
              <span className={totalPnlPercent >= 0 ? "text-emerald-400 font-medium" : "text-red-400 font-medium"}>
                {totalPnlPercent.toFixed(2)}%
              </span>
            </div>
            <div>
              <span className="text-[#666]">R: </span>
              <span className={totalR >= 0 ? "text-emerald-400 font-medium" : "text-red-400 font-medium"}>
                {totalR.toFixed(1)}R
              </span>
            </div>
          </div>
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
      <TradeFiltersNew 
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
        <div className="space-y-2">
          {filteredTrades.map(trade => (
            <TradeRowCard 
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
        <TradeDetailModalNew
          trade={selectedTrade}
          onClose={() => setSelectedTrade(null)}
          onSave={(data) => updateMutation.mutate({ id: selectedTrade.id, data })}
          onDelete={handleDelete}
          allStrategies={strategies}
        />
      )}
    </div>
  );
}