import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Plus, Download } from 'lucide-react';
import { cn } from "@/lib/utils";

import TradeRowCard from '../components/trades/TradeRowCard';
import TradeForm from '../components/trades/TradeForm';
import TradeDetailModalNew from '../components/trades/TradeDetailModalNew';
import TradeFiltersNew from '../components/trades/TradeFiltersNew';
import CloseTradeModal from '../components/trades/CloseTradeModal';

export default function Trades() {
  const [showForm, setShowForm] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [closingTrade, setClosingTrade] = useState(null);
  const [statusTab, setStatusTab] = useState('all'); // all, open, closed
  const [filters, setFilters] = useState({
    direction: 'all',
    strategy: 'all',
    coin: 'all',
    timeframe: 'all',
    result: 'all',
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
  const timeframes = [...new Set(trades.map(t => t.timeframe).filter(Boolean))];

  // Apply filters
  let filteredTrades = trades.filter(trade => {
    // Status tab filter
    if (statusTab === 'open' && trade.status !== 'open' && trade.status !== 'partially_closed') return false;
    if (statusTab === 'closed' && trade.status !== 'closed') return false;

    // Direction
    if (filters.direction !== 'all' && trade.direction !== filters.direction) return false;
    
    // Strategy
    if (filters.strategy !== 'all' && trade.strategy_tag !== filters.strategy) return false;
    
    // Coin
    if (filters.coin !== 'all' && trade.coin !== filters.coin) return false;
    
    // Timeframe
    if (filters.timeframe !== 'all' && trade.timeframe !== filters.timeframe) return false;
    
    // Result (for closed trades only)
    if (filters.result !== 'all' && trade.status === 'closed') {
      const pnl = trade.pnl_usd || 0;
      if (filters.result === 'winning' && pnl <= 0) return false;
      if (filters.result === 'losing' && pnl >= 0) return false;
      if (filters.result === 'breakeven' && Math.abs(pnl) > 1) return false;
    }
    
    // Rule compliance
    if (filters.ruleCompliance !== 'all') {
      const compliance = filters.ruleCompliance === 'true';
      if (trade.rule_compliance !== compliance) return false;
    }
    
    // Date range
    const tradeDate = new Date(trade.date_open || trade.date);
    if (filters.dateFrom && tradeDate < new Date(filters.dateFrom)) return false;
    if (filters.dateTo && tradeDate > new Date(filters.dateTo + 'T23:59:59')) return false;
    
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

  const handleClosePosition = (updatedTrade) => {
    updateMutation.mutate({ id: updatedTrade.id, data: updatedTrade });
    setClosingTrade(null);
  };

  const handleMoveStopToBE = (trade) => {
    if (confirm(`Move stop loss to break-even for ${trade.coin}?`)) {
      const updatedTrade = {
        ...trade,
        stop_price: trade.entry_price,
        original_stop_price: trade.original_stop_price || trade.stop_price
      };
      updateMutation.mutate({ id: trade.id, data: updatedTrade });
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
  const allTrades = trades.filter(t => {
    const tradeDate = new Date(t.date_open || t.date);
    if (filters.dateFrom && tradeDate < new Date(filters.dateFrom)) return false;
    if (filters.dateTo && tradeDate > new Date(filters.dateTo + 'T23:59:59')) return false;
    return true;
  });
  
  const totalTrades = allTrades.length;
  const openTrades = allTrades.filter(t => t.status === 'open' || t.status === 'partially_closed').length;
  const closedTrades = allTrades.filter(t => t.status === 'closed').length;
  
  // Metrics for currently filtered trades
  const longTrades = filteredTrades.filter(t => t.direction === 'Long').length;
  const shortTrades = filteredTrades.filter(t => t.direction === 'Short').length;
  
  // W/L based on closed trades only
  const closedFiltered = filteredTrades.filter(t => t.status === 'closed');
  const wins = closedFiltered.filter(t => (t.pnl_usd || 0) > 0).length;
  const losses = closedFiltered.filter(t => (t.pnl_usd || 0) < 0).length;
  
  // PNL for all filtered (including open for unrealized)
  const totalPnl = filteredTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
  const totalPnlPercent = filteredTrades.reduce((s, t) => s + (t.pnl_percent_of_balance || t.pnl_percent || 0), 0);
  
  // Avg R for closed only
  const avgR = closedFiltered.length > 0 
    ? closedFiltered.reduce((s, t) => s + (t.r_multiple || 0), 0) / closedFiltered.length
    : 0;

  return (
    <div className="space-y-4">
      {/* Header with Tabs and Metrics */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        {/* Left: Status Tabs */}
        <div>
          <h1 className="text-2xl font-bold text-[#c0c0c0] mb-3">Trades</h1>
          <div className="flex gap-2 bg-[#151515] rounded-lg p-1 border border-[#2a2a2a]">
            <Button
              size="sm"
              variant={statusTab === 'all' ? 'default' : 'ghost'}
              onClick={() => setStatusTab('all')}
              className={cn(
                "h-9 px-4",
                statusTab === 'all' 
                  ? "bg-[#c0c0c0] text-black" 
                  : "text-[#888] hover:text-[#c0c0c0]"
              )}
            >
              All Trades ({totalTrades})
            </Button>
            <Button
              size="sm"
              variant={statusTab === 'open' ? 'default' : 'ghost'}
              onClick={() => setStatusTab('open')}
              className={cn(
                "h-9 px-4",
                statusTab === 'open' 
                  ? "bg-amber-500 text-white" 
                  : "text-[#888] hover:text-[#c0c0c0]"
              )}
            >
              Open ({openTrades})
            </Button>
            <Button
              size="sm"
              variant={statusTab === 'closed' ? 'default' : 'ghost'}
              onClick={() => setStatusTab('closed')}
              className={cn(
                "h-9 px-4",
                statusTab === 'closed' 
                  ? "bg-gray-500 text-white" 
                  : "text-[#888] hover:text-[#c0c0c0]"
              )}
            >
              Closed ({closedTrades})
            </Button>
          </div>
        </div>

        {/* Right: Compact Metrics & Actions */}
        <div className="flex items-start gap-4">
          <div className="bg-[#151515] rounded-lg p-3 border border-[#2a2a2a]">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <div>
                <span className="text-[#666]">L/S: </span>
                <span className="text-emerald-400 font-medium">{longTrades}</span>
                <span className="text-[#666]"> / </span>
                <span className="text-red-400 font-medium">{shortTrades}</span>
              </div>
              <div>
                <span className="text-[#666]">W/L: </span>
                <span className="text-emerald-400 font-medium">{wins}</span>
                <span className="text-[#666]"> / </span>
                <span className="text-red-400 font-medium">{losses}</span>
              </div>
              <div>
                <span className="text-[#666]">PNL $: </span>
                <span className={totalPnl >= 0 ? "text-emerald-400 font-medium" : "text-red-400 font-medium"}>
                  {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[#666]">PNL %: </span>
                <span className={totalPnlPercent >= 0 ? "text-emerald-400 font-medium" : "text-red-400 font-medium"}>
                  {totalPnlPercent >= 0 ? '+' : ''}{totalPnlPercent.toFixed(2)}%
                </span>
              </div>
              {closedFiltered.length > 0 && (
                <div className="col-span-2">
                  <span className="text-[#666]">Avg R: </span>
                  <span className={avgR >= 0 ? "text-emerald-400 font-medium" : "text-red-400 font-medium"}>
                    {avgR.toFixed(2)}R
                  </span>
                </div>
              )}
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
      </div>

      {/* Filters */}
      <TradeFiltersNew 
        filters={filters}
        setFilters={setFilters}
        strategies={strategies}
        coins={coins}
        timeframes={timeframes}
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
              onClosePosition={setClosingTrade}
              onMoveStopToBE={handleMoveStopToBE}
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