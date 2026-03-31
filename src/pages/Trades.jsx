import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTradesQuery, tradesQueryKey } from '../components/hooks/useTradesQuery';
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp, Plug, Trash2, MoreHorizontal, Search } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createPageUrl } from '../utils';

import TradeTable from '../components/trades/TradeTable';
import AgentChatModal from '../components/AgentChatModal';
import ManualTradeForm from '../components/trades/ManualTradeForm';
import RiskViolationBanner from '../components/RiskViolationBanner';
import { formatInTimeZone } from 'date-fns-tz';

export default function Trades() {
  const [showAgentChat, setShowAgentChat] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState({});
  const [coinSearch, setCoinSearch] = useState('');
  const deleteTimersRef = useRef({});

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

  const activeProfile = profiles.find(p => p.is_active);

  // Single source of truth: shared hook
  const { data: trades = [], isLoading } = useTradesQuery(activeProfile?.id);

  useEffect(() => {
    return () => {
      Object.values(deleteTimersRef.current).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const visibleTrades = trades.filter(t => !pendingDeleteIds[t.id]);

  const { data: riskSettings } = useQuery({
    queryKey: ['riskSettings', activeProfile?.id],
    queryFn: async () => {
      if (!activeProfile) return null;
      const settings = await base44.entities.RiskSettings.filter({ 
        created_by: user.email,
        profile_id: activeProfile.id 
      }, '-created_date', 1);
      return settings[0] || null;
    },
    enabled: !!activeProfile,
  });

  const { data: tradeTemplates = [] } = useQuery({
    queryKey: ['tradeTemplates'],
    queryFn: async () => {
      if (!activeProfile) return [];
      return base44.entities.TradeTemplates.filter({ profile_id: activeProfile.id }, '-created_date', 1);
    },
    enabled: !!activeProfile
  });
  const currentTemplates = tradeTemplates[0];
  const templates = currentTemplates ? {
    strategies: currentTemplates.strategy_templates ? JSON.parse(currentTemplates.strategy_templates) : [],
    entryReasons: currentTemplates.entry_reason_templates ? JSON.parse(currentTemplates.entry_reason_templates) : []
  } : null;

  // Get current balance from active profile or default
  const startingBalance = activeProfile?.starting_balance || 100000;
  const totalPnl = visibleTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0);

  // Use live exchange balance if available
  const { data: connections = [] } = useQuery({
    queryKey: ['exchangeConnections', activeProfile?.id],
    queryFn: () => base44.entities.ExchangeConnection.filter({ profile_id: activeProfile?.id, is_active: true }),
    enabled: !!activeProfile?.id,
  });
  const activeConnection = connections.find(c => c.is_active);
  const currentBalance = activeConnection?.current_balance ?? (startingBalance + totalPnl);

  const invalidateTrades = () => {
    queryClient.invalidateQueries({ queryKey: tradesQueryKey(activeProfile?.id) });
  };

  const createMutation = useMutation({
    mutationFn: async (data) => {
      return base44.entities.Trade.create({ ...data, profile_id: activeProfile?.id });
    },
    onSuccess: (newTrade) => {
      // Optimistic: add to cache immediately
      queryClient.setQueryData(tradesQueryKey(activeProfile?.id), (old = []) => [newTrade, ...old]);
      invalidateTrades();
      setShowAgentChat(false);
      setShowManualForm(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Trade.update(id, data),
    onMutate: async ({ id, data }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: tradesQueryKey(activeProfile?.id) });
      const prev = queryClient.getQueryData(tradesQueryKey(activeProfile?.id));
      queryClient.setQueryData(tradesQueryKey(activeProfile?.id), (old = []) =>
        old.map(t => t.id === id ? { ...t, ...data } : t)
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(tradesQueryKey(activeProfile?.id), ctx.prev);
    },
    onSettled: () => invalidateTrades(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Trade.delete(id),
    onError: (_err, id) => {
      // Restore if delete failed
      invalidateTrades();
      setPendingDeleteIds(prev => { const n = { ...prev }; delete n[id]; return n; });
      toast.error(lang === 'ru' ? 'Не удалось удалить сделку' : 'Failed to delete trade');
    },
    onSuccess: () => {
      invalidateTrades();
    },
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

  const handleDeleteAllTrades = async () => {
    if (!activeProfile?.id) return;
    setIsDeletingAll(true);
    try {
      // Fetch all trades for this profile in batches and delete
      let allIds = [];
      let skip = 0;
      while (true) {
        const batch = await base44.entities.Trade.filter({ profile_id: activeProfile.id }, '-created_date', 1000, skip);
        if (!batch || batch.length === 0) break;
        allIds = allIds.concat(batch.map(t => t.id));
        skip += batch.length;
        if (batch.length < 1000) break;
      }
      for (const id of allIds) {
        await base44.entities.Trade.delete(id);
      }
      queryClient.setQueryData(tradesQueryKey(activeProfile?.id), []);
      invalidateTrades();
      toast.success(lang === 'ru' ? `Удалено ${allIds.length} сделок` : `Deleted ${allIds.length} trades`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setIsDeletingAll(false);
      setShowDeleteAllConfirm(false);
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

  const handleDeleteTrade = (trade) => {
    if (!trade?.id) return;

    const tradeId = trade.id;
    setPendingDeleteIds(prev => ({ ...prev, [tradeId]: true }));

    const finalizeDelete = () => {
      deleteMutation.mutate(tradeId);
      setPendingDeleteIds(prev => {
        const next = { ...prev };
        delete next[tradeId];
        return next;
      });
      delete deleteTimersRef.current[tradeId];
    };

    const timer = setTimeout(finalizeDelete, 5000);
    deleteTimersRef.current[tradeId] = timer;

    toast(trade.coin ? `${trade.coin} ${trade.direction}` : 'Trade', {
      description: lang === 'ru' ? 'Сделка будет удалена через 5 секунд' : 'Trade will be deleted in 5 seconds',
      action: {
        label: 'Undo',
        onClick: () => {
          clearTimeout(deleteTimersRef.current[tradeId]);
          delete deleteTimersRef.current[tradeId];
          setPendingDeleteIds(prev => {
            const next = { ...prev };
            delete next[tradeId];
            return next;
          });
          toast.success(lang === 'ru' ? 'Удаление отменено' : 'Deletion cancelled');
        }
      }
    });
  };

  // Stats — single source of truth: tradingApiV2 returned array
  const isClosedTrade = (t) => t.close_price != null || t.date_close != null;
  const openTradesArr = visibleTrades.filter((t) => !isClosedTrade(t));
  const closedTradesArr = visibleTrades.filter((t) => isClosedTrade(t));

  const openTrades = openTradesArr.length;
  const totalTrades = visibleTrades.length;
  const closedTradesCount = closedTradesArr.length;
  
  const closedTrades = closedTradesArr;
  const wins = closedTrades.filter((t) => (t.pnl_usd || 0) > 0).length;
  const losses = closedTrades.filter((t) => (t.pnl_usd || 0) < 0).length;
  const winRate = closedTradesCount > 0 ? (wins / closedTradesCount) * 100 : 0;
  const netPnl = closedTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
  const avgR = closedTrades.length > 0
    ? closedTrades.reduce((s, t) => s + (t.r_multiple || 0), 0) / closedTrades.length
    : 0;
  const bestTrade = closedTrades.reduce((best, t) => (t.pnl_usd || 0) > (best?.pnl_usd || 0) ? t : best, null);
  const worstTrade = closedTrades.reduce((worst, t) => (t.pnl_usd || 0) < (worst?.pnl_usd || 0) ? t : worst, null);

  // Check violations
  const userTimezone = user?.preferred_timezone || 'UTC';
  const today = formatInTimeZone(new Date(), userTimezone, 'yyyy-MM-dd');
  
  const todayTrades = visibleTrades.filter(t => {
    const tradeDate = t.date_close || t.date_open || t.date;
    if (!tradeDate) return false;
    try {
      const tradeDateInUserTz = formatInTimeZone(new Date(tradeDate), userTimezone, 'yyyy-MM-dd');
      return tradeDateInUserTz === today;
    } catch {
      return tradeDate.startsWith(today);
    }
  });

  const closedTodayTrades = todayTrades.filter(t => isClosedTrade(t));
  const todayPnlPercent = closedTodayTrades.reduce((s, t) => {
    const balance = t.account_balance_at_entry || startingBalance;
    return s + ((t.pnl_usd || 0) / balance) * 100;
  }, 0);
  const todayR = closedTodayTrades.reduce((s, t) => s + (t.r_multiple || 0), 0);

  const recentTrades = [...visibleTrades].filter(t => isClosedTrade(t)).sort((a, b) => 
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

  // Debug data for visibility
  console.log(`[Trades Page] tradingApiV2: Total=${visibleTrades.length}, Open=${openTradesArr.length}, Closed=${closedTradesArr.length}, Sum=${openTradesArr.length + closedTradesArr.length}`);

  // Helper: format currency compact
  const fmtPnl = (val) => {
    if (val === null || val === undefined) return '—';
    const abs = Math.abs(val);
    const sign = val >= 0 ? '+' : '-';
    if (abs >= 1000) return `${sign}$${Math.round(abs / 1000)}K`;
    return `${sign}$${Math.round(abs)}`;
  };

  // Stat cards definition
  const statCards = [
    {
      label: 'Total',
      value: totalTrades,
      color: 'rgba(192,192,192,0.9)',
    },
    {
      label: 'Win Rate',
      value: `${winRate.toFixed(0)}%`,
      color: winRate >= 50 ? '#10b981' : '#ef4444',
    },
    {
      label: 'Net PnL',
      value: netPnl !== 0 ? fmtPnl(netPnl) : '$0',
      color: netPnl >= 0 ? '#10b981' : '#ef4444',
    },
    {
      label: 'Avg R',
      value: `${avgR >= 0 ? '+' : ''}${avgR.toFixed(1)}R`,
      color: avgR >= 0 ? '#10b981' : '#ef4444',
    },
    {
      label: 'Best',
      value: bestTrade ? fmtPnl(bestTrade.pnl_usd) : '—',
      color: '#10b981',
    },
    {
      label: 'Worst',
      value: worstTrade ? fmtPnl(worstTrade.pnl_usd) : '—',
      color: '#ef4444',
    },
    {
      label: 'Wins',
      value: wins,
      color: '#10b981',
    },
    {
      label: 'Losses',
      value: losses,
      color: '#ef4444',
    },
  ];

  return (
    <div className="space-y-3">

      {/* Header */}
      <div className="rounded-xl p-3 w-fit min-w-[900px] mx-auto" style={{background:"linear-gradient(135deg,rgba(255,255,255,0.06) 0%,rgba(255,255,255,0.02) 50%,rgba(255,255,255,0.04) 100%)",backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",border:"1px solid rgba(255,255,255,0.1)",boxShadow:"0 4px 24px rgba(0,0,0,0.4),0 1px 0 rgba(255,255,255,0.1) inset"}}>
        {/* Title row */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <h1 className="text-xl font-bold text-[#c0c0c0]">Trade Journal</h1>
          <div className="flex gap-2">
            {/* "..." dropdown with Delete All */}
            {visibleTrades.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/10 bg-white/[0.04] text-[#888] hover:bg-white/[0.08] hover:text-[#c0c0c0] h-9 w-9 p-0 rounded-lg"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-[#111] border-[#2a2a2a]">
                  <DropdownMenuItem
                    onClick={() => setShowDeleteAllConfirm(true)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                    {lang === 'ru' ? 'Удалить все' : 'Delete All'} ({visibleTrades.length})
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button
              size="sm"
              onClick={() => setShowAgentChat(true)}
              className="bg-white hover:bg-gray-100 text-black font-semibold h-9 px-4 rounded-lg"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Trade
            </Button>
          </div>
        </div>

        {/* Stats + Search row */}
        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-[#666] uppercase tracking-wide">Total</span>
            <span className="text-[11px] font-semibold text-[#c0c0c0]">{totalTrades}</span>
            <span className="text-[#333]">·</span>
            <span className="text-[11px] text-[#666] uppercase tracking-wide">Open</span>
            <span className="text-[11px] font-semibold text-amber-400">{openTrades}</span>
            <span className="text-[#333]">·</span>
            <span className="text-[11px] text-[#666] uppercase tracking-wide">Closed</span>
            <span className="text-[11px] font-semibold text-[#c0c0c0]">{closedTradesCount}</span>
          </div>

          {/* Coin search — inline */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#666] pointer-events-none" />
            <input
              type="text"
              value={coinSearch}
              onChange={e => setCoinSearch(e.target.value)}
              placeholder="Search by coin..."
              style={{
                width: '100%',
                height: '32px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                paddingLeft: '30px',
                paddingRight: '10px',
                fontSize: '12px',
                color: '#c0c0c0',
                outline: 'none',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.2)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
          </div>
        </div>
      </div>

      {/* Risk Violation Banner */}
      <RiskViolationBanner violations={violations} />

      {/* Table or Empty State */}
      {isLoading ? (
        <div className="text-center py-12 text-[#666]">Loading trades...</div>
      ) : visibleTrades.length === 0 ? (
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
                onClick={() => window.location.href = createPageUrl('Settings')}
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
          trades={visibleTrades}
          onUpdate={handleUpdate}
          onMoveStopToBE={handleMoveStopToBE}
          onDelete={handleDeleteTrade}
          currentBalance={currentBalance}
          coinSearch={coinSearch}
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

      {/* Delete All Confirmation */}
      <AlertDialog open={showDeleteAllConfirm} onOpenChange={setShowDeleteAllConfirm}>
        <AlertDialogContent className="bg-[#111] border border-[#2a2a2a]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#c0c0c0]">
              {lang === 'ru' ? 'Удалить все сделки?' : 'Delete all trades?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#888]">
              {lang === 'ru'
                ? `Будет удалено ${visibleTrades.length} сделок из профиля "${activeProfile?.profile_name}". Это действие нельзя отменить.`
                : `This will permanently delete ${visibleTrades.length} trades from profile "${activeProfile?.profile_name}". This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#1a1a1a] border-[#2a2a2a] text-[#888] hover:bg-[#222]">
              {lang === 'ru' ? 'Отмена' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAllTrades}
              disabled={isDeletingAll}
              className="bg-red-600 hover:bg-red-700 text-white">
              {isDeletingAll
                ? (lang === 'ru' ? 'Удаление...' : 'Deleting...')
                : (lang === 'ru' ? 'Удалить все' : 'Delete All')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

  // Calculate risk from CURRENT stop - NULL if stop missing
  let riskUsd = null;
  let riskPercent = null;
  let plannedRR = null;
  let potentialRewardUsd = null;

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

  // Actual R for closed trades - use ORIGINAL stop - NULL if stop missing
  let pnlUsd = 0;
  let pnlPercent = 0;
  let actualR = null;

  if (close) {
    const priceMove = isLong ? close - entry : entry - close;
    pnlUsd = priceMove / entry * size;
    pnlPercent = pnlUsd / balance * 100;

    // R uses original stop (before BE move) - NULL if missing
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
