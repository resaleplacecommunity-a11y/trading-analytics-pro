/**
 * BybitBalanceCard — показывает актуальный баланс и equity с биржи.
 * Equity = balance + unrealized PnL по открытым позициям.
 * Обновляется автоматически (данные тянутся из activeConnection, который рефетчится раз в 60s в AutoSyncManager).
 */
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Wallet, TrendingUp, TrendingDown, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

const fmt = (v, decimals = 2) => {
  if (v == null || v === '') return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

export default function BybitBalanceCard({ profileId, lang = 'ru' }) {
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const { data: connection = null, isLoading } = useQuery({
    queryKey: ['activeExchangeConn', profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const res = await base44.functions.invoke('exchangeConnectionsApi', { profile_id: profileId });
      const list = res?.data?.connections || [];
      return list.find(c => c.is_active) || null;
    },
    enabled: !!profileId,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  if (!connection) return null;

  const balance = connection.current_balance ?? null;
  const equity = connection.current_equity ?? connection.equity ?? null;
  // Unrealized PnL = equity - balance (when both are available)
  const unrealizedPnl = equity != null && balance != null ? equity - balance : null;
  const mode = connection.mode === 'demo'
    ? (lang === 'ru' ? 'ДЕМО' : 'DEMO')
    : (lang === 'ru' ? 'РЕАЛЬНЫЙ' : 'REAL');

  const handleRefresh = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke('syncExchangeConnection', { connection_id: connection.id });
      if (res.data?.ok) {
        queryClient.invalidateQueries({ queryKey: ['activeExchangeConn', profileId] });
        queryClient.invalidateQueries({ queryKey: ['trades'] });
        toast.success(lang === 'ru' ? '✅ Баланс обновлён' : '✅ Balance refreshed');
      } else {
        toast.error(res.data?.error || 'Refresh failed');
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl p-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/5 blur-3xl rounded-full pointer-events-none" />

      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Wallet className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div>
            <div className="text-[10px] text-[#555] uppercase tracking-wider">
              {connection.exchange?.toUpperCase() || 'Bybit'} · {mode}
            </div>
            <div className="text-[9px] text-[#444] truncate max-w-[140px]">{connection.name}</div>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={syncing || isLoading}
          className="w-6 h-6 flex items-center justify-center rounded-lg text-[#555] hover:text-cyan-400 hover:bg-cyan-500/10 transition-all disabled:opacity-40"
          title={lang === 'ru' ? 'Обновить' : 'Refresh'}
        >
          {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Balance */}
        <div>
          <div className="text-[9px] text-[#555] uppercase tracking-wider mb-1">
            {lang === 'ru' ? 'Баланс' : 'Balance'}
          </div>
          <div className="text-lg font-mono font-bold text-[#e0e0e0] tabular-nums">
            {balance != null ? `$${fmt(balance)}` : '—'}
          </div>
          <div className="text-[9px] text-cyan-500/70 mt-0.5">
            {lang === 'ru' ? '● Реальный баланс' : '● Live balance'}
          </div>
        </div>

        {/* Equity */}
        <div>
          <div className="text-[9px] text-[#555] uppercase tracking-wider mb-1">
            Equity
          </div>
          <div className={cn(
            "text-lg font-mono font-bold tabular-nums",
            equity == null ? "text-[#555]" :
            equity >= (balance ?? 0) ? "text-emerald-400" : "text-red-400"
          )}>
            {equity != null ? `$${fmt(equity)}` : '—'}
          </div>
          {unrealizedPnl != null && (
            <div className={cn(
              "text-[9px] mt-0.5 font-mono tabular-nums flex items-center gap-0.5",
              unrealizedPnl >= 0 ? "text-emerald-500/70" : "text-red-500/70"
            )}>
              {unrealizedPnl >= 0
                ? <TrendingUp className="w-2.5 h-2.5" />
                : <TrendingDown className="w-2.5 h-2.5" />}
              {unrealizedPnl >= 0 ? '+' : ''}{fmt(unrealizedPnl)} uPnL
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
