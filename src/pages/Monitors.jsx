import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, RefreshCw, ExternalLink, Wifi, WifiOff,
  Bot, Eye, Clock, Radio, Server,
  ChevronDown, ChevronUp, AlertCircle,
} from 'lucide-react';

const MEMES_API = 'https://dash.tradinganalyticspro.com/memes-api';

async function apiGet(path) {
  const res = await fetch(`${MEMES_API}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { throw new Error(`Invalid JSON from ${path}`); }
}

// ── Design tokens — emerald green / liquid glass (mirrored from Memes.jsx) ──
const T = {
  t4: '#d4f5e0',
  t3: '#7ed4a4',
  t2: '#4ab87a',
  t1: '#2d7a52',
  glow4: 'rgba(212,245,224,0.45)',
  glow3: 'rgba(126,212,164,0.38)',
  glow2: 'rgba(74,184,122,0.3)',
  glow1: 'rgba(45,122,82,0.25)',
};

const glassCard = {
  background: 'rgba(18,22,30,0.72)',
  border: '1px solid rgba(255,255,255,0.12)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius: '16px',
};
const glassPanel = {
  background: 'rgba(14,18,26,0.70)',
  border: '1px solid rgba(255,255,255,0.10)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  borderRadius: '14px',
};
const glassCardTier4 = {
  ...glassCard,
  background: 'rgba(16,28,22,0.82)',
  border: '1px solid rgba(212,245,224,0.40)',
  boxShadow: `0 0 32px ${T.glow4}, 0 6px 28px rgba(0,0,0,0.55)`,
};
const glassCardTier3 = {
  ...glassCard,
  background: 'rgba(14,26,20,0.78)',
  border: '1px solid rgba(126,212,164,0.32)',
  boxShadow: `0 0 20px ${T.glow3}, 0 4px 22px rgba(0,0,0,0.48)`,
};
const glassCardTier2 = {
  ...glassCard,
  background: 'rgba(14,22,18,0.76)',
  border: '1px solid rgba(74,184,122,0.24)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.42)',
};
const glassCardTier1 = {
  ...glassCard,
  background: 'rgba(14,18,26,0.74)',
  boxShadow: '0 4px 16px rgba(0,0,0,0.38)',
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function getScoreStyle(score) {
  if (score >= 100) return { color: T.t4, glow: T.glow4, card: glassCardTier4 };
  if (score >= 80)  return { color: T.t3, glow: T.glow3, card: glassCardTier3 };
  if (score >= 65)  return { color: T.t2, glow: T.glow2, card: glassCardTier2 };
  return                   { color: T.t1, glow: T.glow1, card: glassCardTier1 };
}

function formatMoney(n) {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

function dexChain(chain) {
  if (chain === 'sol' || chain === 'solana') return 'solana';
  if (chain === 'bsc') return 'bsc';
  return 'ethereum';
}

function detectChain(addr, chainHint) {
  if (chainHint) return String(chainHint).toLowerCase().replace('ethereum', 'eth').replace('solana', 'sol');
  if (!addr) return 'eth';
  if (!addr.startsWith('0x')) return 'sol';
  return 'eth';
}

function shortAddr(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ── Service status card ───────────────────────────────────────────────────────
function ServiceCard({ icon: Icon, title, active, detail, subDetail }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all"
      style={active
        ? { background: 'rgba(74,184,122,0.10)', border: `1px solid ${T.t2}45`, boxShadow: `0 0 18px ${T.glow2}` }
        : { background: 'rgba(18,22,30,0.72)', border: '1px solid rgba(255,255,255,0.08)' }
      }
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={active
          ? { background: `${T.t2}22`, border: `1px solid ${T.t2}40` }
          : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }
        }
      >
        <Icon className="w-4 h-4" style={{ color: active ? T.t3 : '#555' }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: active ? T.t4 : '#555' }}>{title}</span>
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={active
              ? { background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.35)', color: '#34d399' }
              : { background: 'rgba(100,100,100,0.12)', border: '1px solid rgba(100,100,100,0.2)', color: '#555' }
            }
          >
            {active ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
        {detail && <p className="text-xs text-[#555] mt-0.5 truncate">{detail}</p>}
        {subDetail && <p className="text-[11px] text-[#444] truncate">{subDetail}</p>}
      </div>
      <div className="shrink-0">
        {active
          ? <Wifi className="w-4 h-4" style={{ color: T.t2 }} />
          : <WifiOff className="w-4 h-4 text-[#444]" />
        }
      </div>
    </div>
  );
}

// ── Compact signal row ────────────────────────────────────────────────────────
function CompactSignalRow({ signal }) {
  const [expanded, setExpanded] = useState(false);
  const score     = signal.score ?? 0;
  const style     = getScoreStyle(score);
  const symbol    = signal.symbol || '???';
  const mc        = signal.mc ?? signal.market_cap ?? signal.mcap;
  const liq       = signal.liq ?? signal.liquidity;
  const smCount   = signal.smBuyersCount ?? signal.sm_buyers_count ?? 0;
  const tokenAddr = signal.tokenAddr ?? signal.token_addr ?? signal.address ?? '';
  const chainHint = signal.chain ?? signal.network ?? null;
  const chain     = detectChain(tokenAddr, chainHint);
  const dexLink   = tokenAddr ? `https://dexscreener.com/${dexChain(chain)}/${tokenAddr}` : null;
  const signals   = signal.signals ?? [];

  return (
    <div
      className="rounded-xl transition-all"
      style={style.card}
    >
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
        onClick={() => setExpanded(p => !p)}
      >
        {/* Score badge */}
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-lg tabular-nums shrink-0"
          style={{ background: `${style.color}18`, border: `1px solid ${style.color}35`, color: style.color, minWidth: '36px', textAlign: 'center' }}
        >
          {score}
        </span>

        {/* Symbol */}
        <span className="text-sm font-bold text-white shrink-0">{symbol}</span>

        {/* Separator */}
        <span className="text-[#333] shrink-0">|</span>

        {/* MC */}
        <span className="text-xs text-[#555] shrink-0">MC:</span>
        <span className="text-xs font-semibold text-[#aaa] shrink-0">{formatMoney(mc)}</span>

        <span className="text-[#333] shrink-0">|</span>

        {/* Liq */}
        <span className="text-xs text-[#555] shrink-0">Liq:</span>
        <span className="text-xs font-semibold text-[#aaa] shrink-0">{formatMoney(liq)}</span>

        <span className="text-[#333] shrink-0">|</span>

        {/* SM */}
        <span className="text-xs text-[#555] shrink-0">SM:</span>
        <span className="text-xs font-semibold shrink-0" style={{ color: smCount > 0 ? T.t3 : '#555' }}>{smCount}</span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* DexScreener */}
        {dexLink && (
          <a
            href={dexLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg transition-all hover:scale-105 active:scale-95 shrink-0"
            style={{ background: `${style.color}14`, border: `1px solid ${style.color}32`, color: style.color }}
          >
            <ExternalLink className="w-3 h-3" />
            DEX
          </a>
        )}

        {/* Expand toggle */}
        {signals.length > 0 && (
          <button
            className="shrink-0 p-0.5 rounded"
            style={{ color: '#444' }}
            onClick={e => { e.stopPropagation(); setExpanded(p => !p); }}
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Expanded signals */}
      {expanded && signals.length > 0 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5">
          {signals.map((s, i) => (
            <span
              key={i}
              className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: '#888' }}
            >
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Wallet pool list ──────────────────────────────────────────────────────────
function WalletPoolList({ wallets }) {
  const [showAll, setShowAll] = useState(false);
  if (!wallets?.length) {
    return <p className="text-sm text-[#444] py-4 text-center">Пул пуст или недоступен</p>;
  }
  const LIMIT = 10;
  const shown  = showAll ? wallets : wallets.slice(0, LIMIT);
  const hidden = wallets.length - LIMIT;

  return (
    <div className="flex flex-col gap-1.5">
      {shown.map((w, i) => {
        const addr    = typeof w === 'string' ? w : (w.address || w.addr || '');
        const wr      = typeof w === 'object' ? (w.winrate ?? w.win_rate ?? null) : null;
        const wrPct   = wr != null ? (wr > 0 && wr <= 1 ? Math.round(wr * 100) : Math.round(wr)) : null;
        return (
          <div
            key={i}
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-mono"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <span className="text-[#333] tabular-nums w-5 text-right shrink-0">{i + 1}</span>
            <span className="flex-1 text-[#666] truncate">{addr}</span>
            {addr && (
              <a
                href={`https://debank.com/profile/${addr}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-[10px] px-1.5 py-0.5 rounded transition-all hover:scale-105"
                style={{ background: `${T.t2}12`, border: `1px solid ${T.t2}28`, color: T.t2 }}
              >
                DeBank
              </a>
            )}
            {wrPct != null && (
              <span
                className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded"
                style={{ color: wrPct >= 60 ? '#34d399' : wrPct >= 40 ? '#fbbf24' : '#f87171' }}
              >
                {wrPct}%
              </span>
            )}
          </div>
        );
      })}
      {!showAll && hidden > 0 && (
        <button
          className="text-xs px-3 py-1.5 rounded-xl mt-1 transition-all"
          style={{ background: `${T.t2}12`, border: `1px solid ${T.t2}28`, color: T.t2 }}
          onClick={() => setShowAll(true)}
        >
          Показать ещё {hidden} кошельков
        </button>
      )}
      {showAll && wallets.length > LIMIT && (
        <button
          className="text-xs px-3 py-1.5 rounded-xl mt-1 transition-all"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#555' }}
          onClick={() => setShowAll(false)}
        >
          Свернуть
        </button>
      )}
    </div>
  );
}

// ── Skeleton rows ─────────────────────────────────────────────────────────────
function SkeletonRows({ count = 5 }) {
  return (
    <div className="flex flex-col gap-2">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="h-10 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
      ))}
    </div>
  );
}

// ── Chain tab button ─────────────────────────────────────────────────────────
function ChainTab({ chain, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="px-5 py-2 rounded-xl text-sm font-bold transition-all"
      style={active
        ? { background: `${T.t2}22`, border: `1px solid ${T.t2}45`, color: T.t4, boxShadow: `0 0 14px ${T.glow2}` }
        : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#555' }
      }
    >
      {chain === 'eth' ? 'ETH' : 'SOL'}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Monitors() {
  const [chain, setChain] = useState('eth');

  // Health query
  const {
    data: health = {},
    isLoading: healthLoading,
    refetch: refetchHealth,
    dataUpdatedAt: healthUpdatedAt,
  } = useQuery({
    queryKey: ['monitors-health'],
    queryFn:  () => apiGet('/health').catch(() => ({})),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  // Signals query (refetches when chain changes)
  const {
    data: signalsData = {},
    isLoading: signalsLoading,
    isError:   signalsError,
    refetch:   refetchSignals,
    dataUpdatedAt: signalsUpdatedAt,
  } = useQuery({
    queryKey: ['monitors-signals', chain],
    queryFn:  () => apiGet(`/signals?chain=${chain}`).then(d => Array.isArray(d) ? { signals: d } : d),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  // Wallet pool query
  const {
    data: walletPoolData = {},
    isLoading: poolLoading,
    refetch: refetchPool,
  } = useQuery({
    queryKey: ['monitors-wallet-pool'],
    queryFn:  () => apiGet('/wallet-pool').catch(() => ({})),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const [secAgo, setSecAgo] = useState(0);
  useEffect(() => {
    if (!signalsUpdatedAt) return;
    const tick = () => setSecAgo(Math.round((Date.now() - signalsUpdatedAt) / 1000));
    tick();
    const id = setInterval(tick, 5_000);
    return () => clearInterval(id);
  }, [signalsUpdatedAt]);

  const signals     = signalsData.signals ?? (Array.isArray(signalsData) ? signalsData : []);
  const walletPool  = walletPoolData.wallets ?? walletPoolData.pool ?? (Array.isArray(walletPoolData) ? walletPoolData : []);
  const isStale     = secAgo > 600;

  // Parse health data
  const ethBot     = health.signalBot?.eth    ?? {};
  const solBot     = health.signalBot?.sol    ?? {};
  const walletMon  = health.walletMonitor     ?? {};
  const walletHunt = health.walletHunter      ?? {};
  const apiStatus  = health.memesApi          ?? {};

  function handleRefresh() {
    refetchHealth();
    refetchSignals();
    refetchPool();
  }

  return (
    <div className="max-w-[1400px] mx-auto pb-16" style={{ minHeight: '100vh' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1
            className="text-3xl font-extrabold tracking-tight"
            style={{
              background: 'linear-gradient(135deg, #2d7a52 0%, #4ab87a 45%, #7ed4a4 75%, #d4f5e0 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            МОНИТОРИНГ
          </h1>
          <p className="text-sm text-[#555] mt-0.5">Статус ботов · Сигналы · Пул кошельков</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Live indicator */}
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: isStale ? '#f87171' : '#34d399' }}>
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background: isStale ? '#f87171' : '#34d399',
                boxShadow: `0 0 6px ${isStale ? '#f8717160' : '#34d39960'}`,
                animation: isStale ? 'none' : 'pulse 2s ease-in-out infinite',
              }}
            />
            {signalsUpdatedAt
              ? `${secAgo < 60 ? `${secAgo}с` : `${Math.round(secAgo / 60)}м`} назад`
              : 'Загрузка...'}
          </div>

          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all active:scale-95"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: '#666' }}
          >
            <RefreshCw className={`w-3 h-3 ${(signalsLoading || healthLoading) ? 'animate-spin' : ''}`} />
            Обновить
          </button>
        </div>
      </div>

      {/* ── Services status block ───────────────────────────────────────────── */}
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#444] mb-3">Статус сервисов</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          <ServiceCard
            icon={Bot}
            title="Signal Bot ETH"
            active={ethBot.active ?? false}
            detail={ethBot.lastSignal ? `Последний сигнал: ${ethBot.lastSignal}` : undefined}
            subDetail={ethBot.count != null ? `Сигналов: ${ethBot.count}` : undefined}
          />
          <ServiceCard
            icon={Bot}
            title="Signal Bot SOL"
            active={solBot.active ?? false}
            detail={solBot.lastSignal ? `Последний сигнал: ${solBot.lastSignal}` : undefined}
            subDetail={solBot.count != null ? `Сигналов: ${solBot.count}` : undefined}
          />
          <ServiceCard
            icon={Eye}
            title="Wallet Monitor"
            active={walletMon.active ?? false}
            detail={walletMon.walletsCount != null ? `Кошельков в пуле: ${walletMon.walletsCount}` : undefined}
          />
          <ServiceCard
            icon={Clock}
            title="Wallet Hunter"
            active={walletHunt.active ?? false}
            detail={walletHunt.lastRun ? `Последний прогон: ${walletHunt.lastRun}` : undefined}
          />
          <ServiceCard
            icon={Server}
            title="Memes API"
            active={apiStatus.active ?? !healthLoading}
          />
        </div>
      </div>

      {/* ── Chain tabs ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-5">
        <ChainTab chain="eth" active={chain === 'eth'} onClick={() => setChain('eth')} />
        <ChainTab chain="sol" active={chain === 'sol'} onClick={() => setChain('sol')} />
        <span className="text-xs text-[#444] ml-2">
          {signals.length > 0 ? `${signals.length} сигналов` : ''}
        </span>
      </div>

      {/* ── Two-column layout: Signals + Wallet Pool ────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Signals column (2/3 width) */}
        <div className="xl:col-span-2">
          <div className="p-4" style={glassPanel}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4" style={{ color: T.t2 }} />
                <span className="text-sm font-bold" style={{ color: T.t4 }}>
                  Сигналы {chain.toUpperCase()}
                </span>
              </div>
              {signals.length > 0 && (
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-lg"
                  style={{ background: `${T.t2}14`, border: `1px solid ${T.t2}28`, color: T.t2 }}
                >
                  {signals.length}
                </span>
              )}
            </div>

            {signalsLoading && signals.length === 0 ? (
              <SkeletonRows count={6} />
            ) : signalsError && signals.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10">
                <AlertCircle className="w-8 h-8 text-red-400 opacity-60" />
                <p className="text-sm text-[#555]">Нет связи с API</p>
                <button
                  onClick={refetchSignals}
                  className="text-xs px-3 py-1.5 rounded-xl transition-all"
                  style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.22)', color: '#f87171' }}
                >
                  Повторить
                </button>
              </div>
            ) : signals.length === 0 ? (
              <p className="text-sm text-[#444] py-8 text-center">Сигналов нет</p>
            ) : (
              <div className="flex flex-col gap-2">
                {signals.map((signal, i) => (
                  <div
                    key={`${signal.id || signal.tokenAddr || signal.symbol || 'sig'}-${i}`}
                    style={{ animation: `fadeSlideIn ${0.06 + Math.min(i, 15) * 0.02}s ease both` }}
                  >
                    <CompactSignalRow signal={signal} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Wallet pool column (1/3 width) */}
        <div>
          <div className="p-4" style={glassPanel}>
            <div className="flex items-center gap-2 mb-4">
              <Eye className="w-4 h-4" style={{ color: T.t2 }} />
              <span className="text-sm font-bold" style={{ color: T.t4 }}>Пул кошельков</span>
              {walletPool.length > 0 && (
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-lg ml-auto"
                  style={{ background: `${T.t2}14`, border: `1px solid ${T.t2}28`, color: T.t2 }}
                >
                  {walletPool.length}
                </span>
              )}
            </div>

            {poolLoading ? (
              <SkeletonRows count={4} />
            ) : (
              <WalletPoolList wallets={walletPool} />
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
