/**
 * BybitBalanceCard — актуальный баланс и equity с биржи.
 * Equity = balance + unrealized PnL открытых позиций (считается из TAP сделок если backend не отдаёт).
 * Обновляется каждые 60s через AutoSyncManager.
 */
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Wallet, TrendingUp, TrendingDown, RefreshCw, Loader2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

const fmt = (v, decimals = 2) => {
  if (v == null || v === '') return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

const fmtCompact = (v) => {
  if (v == null || v === '') return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return '—';
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toFixed(2);
};

export default function BybitBalanceCard({ profileId, lang = 'ru' }) {
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [ready, setReady] = useState(false);

  // Delay render to avoid flash on initial load
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 600);
    return () => clearTimeout(t);
  }, []);

  // Fetch active exchange connection (balance from backend)
  const { data: connection = null, isLoading } = useQuery({
    queryKey: ['activeExchangeConn', profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const res = await base44.functions.invoke('exchangeConnectionsApi', { method: 'GET', path: '/connections', profile_id: profileId });
      const list = res?.data?.connections || [];
      return list.find(c => c.is_active) || null;
    },
    enabled: !!profileId,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  // Fetch open trades to compute equity = balance + sum(unrealized PnL)
  const { data: openTrades = [] } = useQuery({
    queryKey: ['openTradesForEquity', profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const user = await base44.auth.me();
      if (!user) return [];
      const trades = await base44.entities.Trade.filter({
        created_by: user.email,
        profile_id: profileId,
      }, '-date_open', 200);
      // Only open exchange trades
      return trades.filter(t => !t.close_price && (t.external_id || t.import_source === 'bybit'));
    },
    enabled: !!profileId && !!connection,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  if (!ready || (!connection && !isLoading)) return null;
  if (isLoading) {
    return (
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl p-4 animate-pulse">
        <div className="h-4 bg-[#1a1a1a] rounded w-1/2 mb-3" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-8 bg-[#1a1a1a] rounded" />
          <div className="h-8 bg-[#1a1a1a] rounded" />
        </div>
      </div>
    );
  }
  if (!connection) return null;

  const balance = connection.current_balance ?? null;

  // Equity: prefer backend value, fallback to balance + sum of open unrealized PnL
  let equity = connection.current_equity ?? null;
  if (equity == null && balance != null) {
    const unrealizedSum = openTrades.reduce((sum, t) => sum + (parseFloat(t.pnl_usd) || 0), 0);
    equity = balance + unrealizedSum;
  }

  const unrealizedPnl = equity != null && balance != null ? equity - balance : null;
  const openCount = openTrades.length;

  const mode = connection.mode === 'demo'
    ? (lang === 'ru' ? 'DEMO' : 'DEMO')
    : (lang === 'ru' ? 'LIVE' : 'LIVE');

  const modeColor = connection.mode === 'demo' ? 'text-amber-400' : 'text-emerald-400';
  const modeBg = connection.mode === 'demo' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-emerald-500/10 border-emerald-500/20';

  const handleRefresh = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await base44.functions.invoke('syncExchangeConnection', { connection_id: connection.id });
      if (res?.data?.ok) {
        queryClient.invalidateQueries({ queryKey: ['activeExchangeConn', profileId] });
        queryClient.invalidateQueries({ queryKey: ['openTradesForEquity', profileId] });
        queryClient.invalidateQueries({ queryKey: ['trades'] });
        const ins = res.data.inserted ?? 0;
        const upd = res.data.updated ?? 0;
        toast.success(lang === 'ru'
          ? `✅ Обновлено${ins > 0 ? ` +${ins} новых` : ''}${upd > 0 ? `, ${upd} обновлено` : ''}`
          : `✅ Synced${ins > 0 ? ` +${ins} new` : ''}${upd > 0 ? `, ${upd} updated` : ''}`);
      } else {
        toast.error(res?.data?.error || 'Sync failed');
      }
    } catch (e) {
      toast.error(e?.message || 'Error');
    } finally {
      setSyncing(false);
    }
  };

  const equityPositive = unrealizedPnl == null || unrealizedPnl >= 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#1e2a2a] bg-gradient-to-br from-[#0a0f0f] to-[#0d0d0d]">
      {/* Emerald glow top-left */}
      <div className="absolute -top-8 -left-8 w-40 h-40 bg-emerald-500/8 blur-3xl rounded-full pointer-events-none" />
      {/* Subtle grid */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(to right,#10b981 1px,transparent 1px),linear-gradient(to bottom,#10b981 1px,transparent 1px)', backgroundSize: '24px 24px' }} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-[#c0c0c0] tracking-wide">
                {connection.exchange?.toUpperCase() || 'BYBIT'}
              </span>
              <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-md border uppercase tracking-wider', modeBg, modeColor)}>
                {mode}
              </span>
            </div>
            <div className="text-[9px] text-[#444] truncate max-w-[160px] mt-0.5">{connection.name}</div>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={syncing}
          className="w-7 h-7 flex items-center justify-center rounded-xl text-[#444] hover:text-emerald-400 hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/20 transition-all disabled:opacity-30"
          title={lang === 'ru' ? 'Обновить' : 'Refresh'}
        >
          {syncing
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <RefreshCw className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-px mt-3 border-t border-[#1a1a1a]">

        {/* Balance */}
        <div className="px-4 py-3 bg-[#0a0a0a]/40">
          <div className="text-[9px] text-[#444] uppercase tracking-widest mb-1.5 font-medium">
            {lang === 'ru' ? 'Баланс' : 'Balance'}
          </div>
          <div className="text-[15px] font-mono font-bold text-[#e8e8e8] tabular-nums leading-none">
            {balance != null ? `$${fmt(balance)}` : '—'}
          </div>
          <div className="flex items-center gap-1 mt-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
            <span className="text-[9px] text-cyan-500/60">{lang === 'ru' ? 'с биржи' : 'live'}</span>
          </div>
        </div>

        {/* Equity */}
        <div className="px-4 py-3 bg-[#0a0a0a]/40">
          <div className="text-[9px] text-[#444] uppercase tracking-widest mb-1.5 font-medium">Equity</div>
          <div className={cn(
            "text-[15px] font-mono font-bold tabular-nums leading-none",
            equity == null ? "text-[#333]" : equityPositive ? "text-emerald-400" : "text-red-400"
          )}>
            {equity != null ? `$${fmt(equity)}` : '—'}
          </div>

          {unrealizedPnl != null && (
            <div className={cn(
              "flex items-center gap-0.5 mt-1.5 font-mono tabular-nums",
              unrealizedPnl >= 0 ? "text-emerald-500/60" : "text-red-500/60"
            )}>
              {unrealizedPnl >= 0
                ? <TrendingUp className="w-2.5 h-2.5 shrink-0" />
                : <TrendingDown className="w-2.5 h-2.5 shrink-0" />}
              <span className="text-[9px]">
                {unrealizedPnl >= 0 ? '+' : ''}{fmt(unrealizedPnl)} uPnL
              </span>
            </div>
          )}
          {unrealizedPnl == null && (
            <div className="text-[9px] text-[#333] mt-1.5">{lang === 'ru' ? 'нет данных' : 'no data'}</div>
          )}
        </div>
      </div>

      {/* Footer: open positions count */}
      {openCount > 0 && (
        <div className="flex items-center gap-1.5 px-4 py-2 border-t border-[#111]">
          <Zap className="w-2.5 h-2.5 text-emerald-500/50" />
          <span className="text-[9px] text-[#333]">
            {openCount} {lang === 'ru' ? 'открытых позиций' : 'open positions'}
          </span>
        </div>
      )}
    </div>
  );
}
