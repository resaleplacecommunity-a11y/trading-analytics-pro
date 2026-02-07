import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Plus, Trash2, TrendingUp, Plug } from 'lucide-react';
import { toast } from 'sonner';
import { createPageUrl } from '../utils';

import TradeTable from '../components/trades/TradeTable';
import AgentChatModal from '../components/AgentChatModal';
import ManualTradeForm from '../components/trades/ManualTradeForm';
import RiskViolationBanner from '../components/RiskViolationBanner';
import TradesDebugPanel from '../components/TradesDebugPanel';
import { formatInTimeZone } from 'date-fns-tz';
import { getTradesForActiveProfile, getActiveProfileId } from '../components/utils/profileUtils';

export default function Trades() {
  const [showAgentChat, setShowAgentChat] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
  const [selectedTradeIds, setSelectedTradeIds] = useState([]);
  const [paginatedCount, setPaginatedCount] = useState({ open: 0, closed: 0 });

  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['userProfiles', user?.email],
    queryFn: async () => {
      if (!user) return [];
      return base44.entities.UserProfile.filter({ created_by: user.email }, '-created_date', 10);
    },
    enabled: !!user,
  });

  const { data: trades = [], isLoading } = useQuery({
    queryKey: ['trades', user?.email],
    queryFn: async () => {
      if (!user) return [];
      const result = await getTradesForActiveProfile();
      // Client-side security filter
      const profileId = await getActiveProfileId();
      return result.filter(t => t.created_by === user.email && t.profile_id === profileId);
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const { data: riskSettings } = useQuery({
    queryKey: ['riskSettings', user?.email, profiles.find(p => p.is_active)?.id],
    queryFn: async () => {
      if (!user) return null;
      const activeProfile = profiles.find(p => p.is_active);
      if (!activeProfile) return null;
      const settings = await base44.entities.RiskSettings.filter({ 
        created_by: user.email,
        profile_id: activeProfile.id 
      }, '-created_date', 1);
      return settings[0] || null;
    },
    enabled: !!user && profiles.length > 0,
  });

  const { data: tradeTemplates = [] } = useQuery({
    queryKey: ['tradeTemplates'],
    queryFn: async () => {
      const activeProfile = profiles.find(p => p.is_active);
      if (!activeProfile) return [];
      return base44.entities.TradeTemplates.filter({ profile_id: activeProfile.id }, '-created_date', 1);
    },
    enabled: profiles.length > 0
  });

  const activeProfile = profiles.find(p => p.is_active);
  const currentTemplates = tradeTemplates[0];
  const templates = currentTemplates ? {
    strategies: currentTemplates.strategy_templates ? JSON.parse(currentTemplates.strategy_templates) : [],
    entryReasons: currentTemplates.entry_reason_templates ? JSON.parse(currentTemplates.entry_reason_templates) : []
  } : null;

  // Get current balance from active profile or default
  const startingBalance = activeProfile?.starting_balance || 100000;
  const totalPnl = trades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
  const currentBalance = startingBalance + totalPnl;

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const profileId = await getActiveProfileId();
      const currentUser = await base44.auth.me();
      return base44.entities.Trade.create({ 
        ...data, 
        profile_id: profileId,
        created_by: currentUser.email
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      queryClient.invalidateQueries({ queryKey: ['riskSettings'] });
      queryClient.invalidateQueries({ queryKey: ['behaviorLogs'] });
      setShowAgentChat(false);
      setShowManualForm(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Trade.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      queryClient.invalidateQueries({ queryKey: ['riskSettings'] });
      queryClient.invalidateQueries({ queryKey: ['behaviorLogs'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Trade.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      queryClient.invalidateQueries({ queryKey: ['riskSettings'] });
      queryClient.invalidateQueries({ queryKey: ['behaviorLogs'] });
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
      await Promise.all(selectedTradeIds.map(id => base44.entities.Trade.delete(id)));
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      queryClient.invalidateQueries({ queryKey: ['riskSettings'] });
      queryClient.invalidateQueries({ queryKey: ['behaviorLogs'] });
      setSelectedTradeIds([]);
      setBulkDeleteMode(false);
      toast.success(`Deleted ${selectedTradeIds.length} trade(s)`);
    }
  };

  const handleDeleteAll = async () => {
    if (confirm(`Delete ALL ${trades.length} trades? This cannot be undone!`)) {
      await Promise.all(trades.map(trade => base44.entities.Trade.delete(trade.id)));
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      queryClient.invalidateQueries({ queryKey: ['riskSettings'] });
      queryClient.invalidateQueries({ queryKey: ['behaviorLogs'] });
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

  // Stats for summary
  const openTrades = trades.filter((t) => !t.close_price).length;
  const closedTradesCount = trades.filter((t) => t.close_price).length;
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
    const balance = t.account_balance_at_entry || startingBalance;
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

  const lang = localStorage.getItem('tradingpro_lang') || 'ru';

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
              <span className="text-[#666]">Closed</span>
              <span className="text-emerald-400 font-bold">{closedTradesCount}</span>
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
            onClick={() => setShowAgentChat(true)}
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

      {/* Debug Panel */}
      <TradesDebugPanel 
        trades={trades}
        paginatedCount={paginatedCount}
        filters={{ test_run_id: null }}
        activeProfileId={activeProfile?.id}
      />

      {/* Table or Empty State */}
      {isLoading ? (
        <div className="text-center py-12 text-[#666]">Loading trades...</div>
      ) : trades.length === 0 ? (
        <div className="bg-gradient-to-br from-emerald-500/5 via-[#0d0d0d]/60 to-cyan-500/5 backdrop-blur-xl rounded-2xl border-2 border-emerald-500/20 p-12">
          <div className="max-w-2xl mx-auto text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center mx-auto mb-6">
              <TrendingUp className="w-10 h-10 text-emerald-400" />
            </div>
            <h3 className="text-2xl font-bold text-[#c0c0c0] mb-3">
              {lang === 'ru' ? 'Добро пожаловать в журнал сделок' : 'Welcome to your trade journal'}
            </h3>
            <p className="text-[#888] text-lg mb-8">
              {lang === 'ru' 
                ? 'Здесь будут храниться все ваши сделки. Начните добавлять сделки вручную или подключите автоматический импорт с биржи.' 
                : 'This is where all your trades will be stored. Start by adding trades manually or connect automatic import from exchange.'}
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button
                onClick={() => setShowManualForm(true)}
                className="bg-gradient-to-r from-emerald-500/90 to-emerald-600/90 text-white hover:from-emerald-500 hover:to-emerald-600 px-6 py-3 text-base h-auto shadow-lg shadow-emerald-500/20"
              >
                <Plus className="w-4 h-4 mr-2" />
                {lang === 'ru' ? 'Добавить сделку' : 'Add Trade'}
              </Button>
              <Button
                onClick={() => window.location.href = createPageUrl('ApiSettings')}
                variant="outline"
                className="bg-[#0a0a0a]/80 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/50 px-6 py-3 text-base h-auto shadow-lg"
              >
                <Plug className="w-4 h-4 mr-2" />
                {lang === 'ru' ? 'Подключить биржу' : 'Connect Exchange'}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <TradeTable
          trades={trades}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onMoveStopToBE={handleMoveStopToBE}
          currentBalance={currentBalance}
          bulkDeleteMode={bulkDeleteMode}
          selectedTradeIds={selectedTradeIds}
          onToggleSelection={toggleTradeSelection}
          onPaginatedCountChange={setPaginatedCount}
        />
      )}

      {/* Agent Chat Modal */}
      {showAgentChat && (
        <AgentChatModal 
          onClose={() => setShowAgentChat(false)}
          onTradeCreated={() => {
            queryClient.invalidateQueries(['trades']);
            setShowAgentChat(false);
          }}
          onAddManually={() => {
            setShowAgentChat(false);
            setShowManualForm(true);
          }}
        />
      )}

      {/* Manual Trade Form */}
      <ManualTradeForm
        isOpen={showManualForm}
        onClose={() => setShowManualForm(false)}
        onSubmit={(data) => {
          handleSave({ ...data, account_balance_at_entry: currentBalance });
        }}
        currentBalance={currentBalance}
        templates={templates}
      />

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