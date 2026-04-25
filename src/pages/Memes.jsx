import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  ExternalLink, RefreshCw, Settings, Search, ChevronDown, ChevronUp,
  TrendingUp, Users, Droplets, Clock, Star, AlertCircle, CheckCircle2,
  Gem, Copy, X, BarChart2, Zap, Send,
} from 'lucide-react';
import { toast } from 'sonner';
const MEMES_API = 'https://dash.tradinganalyticspro.com/memes-api';

// ── API helper — прямой вызов (CORS настроен на сервере) ──────────────────────
async function memesCall(path, { method = 'GET', body, params } = {}) {
  const url = `${MEMES_API}${path}${params ? `?${params}` : ''}`;
  const opts = { method };
  if (body) {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Design tokens — metallic silver / liquid glass ────────────────────────────
const T = {
  t4: '#e2ecff',          // bright chrome-white
  t3: '#b8d4f0',          // steel blue
  t2: '#7eb8d4',          // ocean steel
  t1: '#6b7a8f',          // dark slate
  glow4: 'rgba(226,236,255,0.45)',
  glow3: 'rgba(184,212,240,0.38)',
  glow2: 'rgba(126,184,212,0.3)',
  glow1: 'rgba(107,122,143,0.25)',
};

const glassCard = {
  background: 'rgba(18,22,30,0.72)',
  border: '1px solid rgba(255,255,255,0.12)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius: '16px',
};
const glassCardTier4 = {
  ...glassCard,
  background: 'rgba(22,28,42,0.82)',
  border: '1px solid rgba(226,236,255,0.40)',
  boxShadow: `0 0 32px ${T.glow4}, 0 6px 28px rgba(0,0,0,0.55)`,
};
const glassCardTier3 = {
  ...glassCard,
  background: 'rgba(18,26,38,0.78)',
  border: '1px solid rgba(184,212,240,0.32)',
  boxShadow: `0 0 20px ${T.glow3}, 0 4px 22px rgba(0,0,0,0.48)`,
};
const glassCardTier2 = {
  ...glassCard,
  background: 'rgba(16,22,32,0.76)',
  border: '1px solid rgba(126,184,212,0.24)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.42)',
};
const glassCardTier1 = {
  ...glassCard,
  background: 'rgba(14,18,26,0.74)',
  boxShadow: '0 4px 16px rgba(0,0,0,0.38)',
};
const glassPanel = {
  background: 'rgba(14,18,26,0.70)',
  border: '1px solid rgba(255,255,255,0.10)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  borderRadius: '14px',
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function getScoreStyle(score) {
  if (score >= 100) return { color: T.t4, glow: T.glow4, emoji: '💎💎💎', label: 'Топ',      card: glassCardTier4 };
  if (score >= 80)  return { color: T.t3, glow: T.glow3, emoji: '💎💎',   label: 'Сильный',  card: glassCardTier3 };
  if (score >= 65)  return { color: T.t2, glow: T.glow2, emoji: '💎',     label: 'Хороший',  card: glassCardTier2 };
  return                   { color: T.t1, glow: T.glow1, emoji: '⬡',     label: 'Слабый',   card: glassCardTier1 };
}

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60)    return `${Math.floor(diff)}с назад`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}м назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}ч назад`;
  return `${Math.floor(diff / 86400)}д назад`;
}

function formatMoney(n) {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

function formatPrice(p) {
  if (p == null) return '—';
  if (p < 0.000001) return p.toExponential(3);
  if (p < 0.0001)   return p.toFixed(7);
  if (p < 0.01)     return p.toFixed(6);
  if (p < 1)        return p.toFixed(4);
  return p.toFixed(2);
}

function shortAddr(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// B7: guard against non-strings
function isSignalPositive(s) {
  if (typeof s !== 'string') return true;
  return !s.includes('⚠️') && !s.includes('❌') && !s.includes('🚫');
}

// B4: detect chain from signal metadata or address format
function detectChain(addr, chainHint) {
  if (chainHint) return String(chainHint).toLowerCase().replace('ethereum', 'eth').replace('solana', 'sol');
  if (!addr) return 'eth';
  if (!addr.startsWith('0x')) return 'sol';
  return 'eth';
}

// B3: Russian plural
function pluralSig(n) {
  if (n % 10 === 1 && n % 100 !== 11) return `${n} сигнал`;
  if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return `${n} сигнала`;
  return `${n} сигналов`;
}

// ── Score bar ────────────────────────────────────────────────────────────────
function ScoreBar({ score }) {
  const style = getScoreStyle(score);
  const pct = Math.min((score / 150) * 100, 100);
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <div
          className="h-1.5 rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${style.color}60, ${style.color})`,
            boxShadow: `0 0 6px ${style.glow}`,
          }}
        />
      </div>
      <span className="text-xs font-bold tabular-nums" style={{ color: style.color, minWidth: '34px', textAlign: 'right' }}>
        {score}<span className="text-[10px] opacity-50">/150</span>
      </span>
    </div>
  );
}

// ── Signal pill ───────────────────────────────────────────────────────────────
function SignalPill({ signal }) {
  const pos = isSignalPositive(signal);
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full leading-tight"
      style={{
        background: pos ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.10)',
        color:      pos ? '#34d399'                : '#f87171',
        border:    `1px solid ${pos ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.22)'}`,
      }}
    >
      {pos ? <CheckCircle2 className="w-2.5 h-2.5 shrink-0" /> : <AlertCircle className="w-2.5 h-2.5 shrink-0" />}
      {signal}
    </span>
  );
}

// ── Twitter badge ─────────────────────────────────────────────────────────────
function TwitterBadge({ summary }) {
  if (!summary) return null;
  const lower = summary.toLowerCase();
  const bullish = lower.includes('bullish') || lower.includes('бычий') || lower.includes('pump') || lower.includes('moon');
  const bearish = lower.includes('bearish') || lower.includes('медвежий') || lower.includes('dump') || lower.includes('rug');
  const color  = bullish ? '#34d399' : bearish ? '#f87171' : '#999';
  const bg     = bullish ? 'rgba(16,185,129,0.10)' : bearish ? 'rgba(239,68,68,0.10)' : 'rgba(255,255,255,0.05)';
  const border = bullish ? 'rgba(16,185,129,0.25)'  : bearish ? 'rgba(239,68,68,0.22)'  : 'rgba(255,255,255,0.10)';
  return (
    <div
      className="text-[11px] px-3 py-1.5 rounded-lg"
      style={{ background: bg, border: `1px solid ${border}`, color, borderLeft: `3px solid ${color}` }}
    >
      <span className="opacity-60 mr-1.5">🐦</span>{summary}
    </div>
  );
}

// ── KOL mentions ──────────────────────────────────────────────────────────────
function KolTags({ mentions }) {
  if (!mentions?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {mentions.map((kol, i) => (
        <span
          key={i}
          className="text-[11px] px-2 py-0.5 rounded-full font-medium"
          style={{
            background: 'rgba(168,85,247,0.12)',
            border: '1px solid rgba(168,85,247,0.3)',
            color: '#c084fc',
            boxShadow: '0 0 8px rgba(168,85,247,0.15)',
          }}
        >
          ⭐ {kol}
        </span>
      ))}
    </div>
  );
}

// ── Buyer pill ────────────────────────────────────────────────────────────────
function BuyerPill({ buyer }) {
  const addr = buyer.addr || buyer.address || '';
  const cost = buyer.cost || buyer.amount || 0;
  const wr   = buyer.winrate ?? buyer.win_rate ?? null;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full font-mono"
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.10)',
        color: '#aaa',
      }}
    >
      <span className="text-[#666]">{shortAddr(addr)}</span>
      <span className="text-emerald-400 font-semibold">{formatMoney(cost)}</span>
      {wr != null && (
        <span style={{ color: wr >= 60 ? '#34d399' : wr >= 40 ? '#fbbf24' : '#f87171' }}>
          WR:{wr}%
        </span>
      )}
    </span>
  );
}

// ── Buyers section (UX3: show overflow with toggle) ───────────────────────────
function BuyersList({ buyers }) {
  const [showAll, setShowAll] = useState(false);
  if (!buyers?.length) return null;
  const LIMIT = 3;
  const shown  = showAll ? buyers : buyers.slice(0, LIMIT);
  const hidden = buyers.length - LIMIT;
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {shown.map((b, i) => <BuyerPill key={i} buyer={b} />)}
      {!showAll && hidden > 0 && (
        <button
          className="text-[11px] px-2 py-0.5 rounded-full transition-colors"
          style={{ color: T.t2, background: `${T.t2}12`, border: `1px solid ${T.t2}30` }}
          onClick={() => setShowAll(true)}
        >
          +{hidden}
        </button>
      )}
      {showAll && buyers.length > LIMIT && (
        <button
          className="text-[11px] px-2 py-0.5 rounded-full transition-colors"
          style={{ color: '#555', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          onClick={() => setShowAll(false)}
        >
          свернуть
        </button>
      )}
    </div>
  );
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="p-4 flex flex-col gap-3" style={{ ...glassCard, minHeight: '260px' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 flex flex-col gap-2">
          <div className="h-6 w-24 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.07)' }} />
          <div className="h-1.5 w-full rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
        </div>
        <div className="w-14 h-12 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-5 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
        ))}
      </div>
      <div className="h-8 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
      <div className="flex gap-1.5 flex-wrap">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-5 w-20 rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
        ))}
      </div>
    </div>
  );
}

// ── Signal card ───────────────────────────────────────────────────────────────
function SignalCard({ signal }) {
  const score    = signal.score ?? 0;
  const style    = getScoreStyle(score);
  const [expanded, setExpanded] = useState(false);

  const symbol      = signal.symbol || '???';
  const name        = signal.name || '';
  const liq         = signal.liq ?? signal.liquidity;
  const mc          = signal.mc ?? signal.market_cap ?? signal.mcap;
  const vol         = signal.vol24h ?? signal.volume_24h ?? signal.volume;
  const price       = signal.price ?? signal.current_price ?? null;
  const rating      = signal.rating ?? signal.token_rating ?? null;
  const holders     = signal.holders;
  const ageH        = signal.ageHours ?? signal.age_hours;
  const smCount     = signal.smBuyersCount ?? signal.sm_buyers_count ?? 0;
  const totalCost   = signal.totalCost ?? signal.total_cost;
  const minHoursAgo = signal.minHoursAgo ?? signal.min_hours_ago;
  const buyers      = signal.buyers ?? [];
  const signals     = signal.signals ?? [];
  const twitterS    = signal.twitterSummary ?? signal.twitter_summary;
  const kols        = signal.kolMentions ?? signal.kol_mentions ?? [];
  const tokenAddr   = signal.tokenAddr ?? signal.token_addr ?? signal.address ?? '';
  const chainHint   = signal.chain ?? signal.network ?? null;
  const chain       = detectChain(tokenAddr, chainHint);
  const gmgnLink    = `https://gmgn.ai/${chain}/token/${tokenAddr}`;
  const timestamp   = signal.timestamp ?? signal.created_at;
  const onChainScore = signal.onChainScore ?? signal.on_chain_score ?? null;
  const twitterScore = signal.twitterScore ?? signal.twitter_score ?? null;
  const smBonus      = signal.smBonus ?? signal.sm_bonus ?? null;
  const twitterUser  = signal.link?.twitter_username ?? null;
  const telegramLink = signal.link?.telegram ?? null;
  const website      = signal.link?.website ?? null;

  const posSignals  = signals.filter(isSignalPositive);
  const negSignals  = signals.filter(s => !isSignalPositive(s));
  const shownPos    = expanded ? posSignals : posSignals.slice(0, 3);
  const shownNeg    = expanded ? negSignals : negSignals.slice(0, 2);
  const hiddenCount = (posSignals.length + negSignals.length) - (shownPos.length + shownNeg.length);

  function copyAddr(e) {
    e.stopPropagation();
    if (!tokenAddr) { toast.error('Адрес недоступен'); return; }
    navigator.clipboard.writeText(tokenAddr)
      .then(() => toast.success('Адрес скопирован'))
      .catch(() => toast.error('Ошибка копирования'));
  }

  return (
    <div className="p-4 flex flex-col gap-3 transition-all duration-300" style={style.card}>

      {/* Header: symbol + score badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[24px] font-extrabold tracking-tight text-white leading-tight truncate">{symbol}</span>
            {name && <span className="text-xs text-[#555] truncate max-w-[120px]">{name}</span>}
            {/* MF9: rating badge */}
            {rating != null && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: `${style.color}18`, border: `1px solid ${style.color}35`, color: style.color }}
              >
                ★ {typeof rating === 'number' ? rating.toFixed(1) : rating}
              </span>
            )}
          </div>
          <ScoreBar score={score} />
        </div>
        <div
          className="shrink-0 flex flex-col items-center px-2.5 py-2 rounded-xl"
          style={{ background: `${style.color}14`, border: `1px solid ${style.color}38` }}
        >
          <span className="text-xl leading-none">{style.emoji}</span>
          <span className="text-[10px] font-bold mt-1" style={{ color: style.color }}>{style.label}</span>
        </div>
      </div>

      {/* Score breakdown */}
      {(onChainScore != null || twitterScore != null || smBonus != null) && (
        <div className="flex items-center gap-2 flex-wrap text-[10px]">
          {onChainScore != null && (
            <span className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)' }}>
              ⛓ {onChainScore}
            </span>
          )}
          {twitterScore != null && (
            <span className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(29,161,242,0.1)', color: '#38bdf8', border: '1px solid rgba(29,161,242,0.2)' }}>
              🐦 {twitterScore}
            </span>
          )}
          {smBonus != null && (
            <span className="px-1.5 py-0.5 rounded" style={{ background: `${T.t2}18`, color: T.t2, border: `1px solid ${T.t2}35` }}>
              🧠 +{smBonus}
            </span>
          )}
        </div>
      )}

      {/* Metrics grid: Liq / MC / Vol / Holders / Price */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        <div className="flex items-center gap-1.5">
          <Droplets className="w-3 h-3 text-blue-400 shrink-0" />
          <span className="text-[#555]">Liq:</span>
          <span className="text-[#ccc] font-semibold">{formatMoney(liq)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <BarChart2 className="w-3 h-3 text-yellow-400 shrink-0" />
          <span className="text-[#555]">MC:</span>
          <span className="text-[#ccc] font-semibold">{formatMoney(mc)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3 text-emerald-400 shrink-0" />
          <span className="text-[#555]">Vol:</span>
          <span className="text-[#ccc] font-semibold">{formatMoney(vol)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Users className="w-3 h-3 text-purple-400 shrink-0" />
          <span className="text-[#555]">Holders:</span>
          <span className="text-[#ccc] font-semibold">{holders ?? '—'}</span>
        </div>
        {/* MF8: price */}
        {price != null && (
          <div className="flex items-center gap-1.5 col-span-2">
            <Gem className="w-3 h-3 shrink-0" style={{ color: T.t2 }} />
            <span className="text-[#555]">Цена:</span>
            <span className="font-semibold" style={{ color: T.t3 }}>${formatPrice(price)}</span>
          </div>
        )}
      </div>

      {/* SM section */}
      {smCount > 0 && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
          style={{ background: `${T.t2}0d`, border: `1px solid ${T.t2}28` }}
        >
          <span className="text-base">🧠</span>
          <span style={{ color: T.t2 }}>
            {smCount} SM купили
            {totalCost != null && <> · <span className="text-emerald-400 font-semibold">{formatMoney(totalCost)} вложено</span></>}
            {minHoursAgo != null && <span className="text-[#666]"> · {minHoursAgo}ч назад</span>}
          </span>
        </div>
      )}

      {/* Buyers list (UX3: overflow) */}
      <BuyersList buyers={buyers} />

      {/* Signals list (collapsible) */}
      {signals.length > 0 && (
        <div>
          <button
            className="flex items-center gap-1 text-[11px] transition-colors mb-1.5 select-none"
            style={{ color: '#555' }}
            onMouseEnter={e => e.currentTarget.style.color = '#888'}
            onMouseLeave={e => e.currentTarget.style.color = '#555'}
            onClick={() => setExpanded(p => !p)}
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Сигналы ({signals.length})
          </button>
          <div className="flex flex-wrap gap-1.5">
            {shownPos.map((s, i) => <SignalPill key={i} signal={s} />)}
            {shownNeg.map((s, i) => <SignalPill key={`n${i}`} signal={s} />)}
            {!expanded && hiddenCount > 0 && (
              <span
                className="text-[11px] px-2 py-0.5 rounded-full cursor-pointer"
                style={{ color: '#555', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                onClick={() => setExpanded(true)}
              >
                +{hiddenCount}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Twitter summary */}
      <TwitterBadge summary={twitterS} />

      {/* KOL mentions */}
      <KolTags mentions={kols} />

      {/* Footer */}
      <div
        className="flex items-center justify-between pt-2 gap-2 flex-wrap"
        style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center gap-2 text-[11px] text-[#444]">
          {ageH != null && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {ageH < 24 ? `${Number(ageH).toFixed(1)}ч` : `${(ageH / 24).toFixed(1)}д`}
            </span>
          )}
          {timestamp && <span>{timeAgo(timestamp)}</span>}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* UX1: copy button with label */}
          <button
            onClick={copyAddr}
            title="Копировать контракт"
            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg transition-all active:scale-95"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: '#666' }}
          >
            <Copy className="w-3 h-3" />
            Контракт
          </button>
          {/* MF4: Telegram link */}
          {telegramLink && (
            <a
              href={telegramLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg transition-all hover:scale-105 active:scale-95"
              style={{ background: 'rgba(0,136,204,0.12)', border: '1px solid rgba(0,136,204,0.28)', color: '#29b6f6' }}
            >
              <Send className="w-3 h-3" />
            </a>
          )}
          {twitterUser && (
            <a
              href={`https://twitter.com/${twitterUser}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg transition-all hover:scale-105 active:scale-95"
              style={{ background: 'rgba(29,161,242,0.10)', border: '1px solid rgba(29,161,242,0.22)', color: '#38bdf8' }}
            >
              🐦
            </a>
          )}
          {website && (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg transition-all hover:scale-105 active:scale-95"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: '#888' }}
            >
              🌐
            </a>
          )}
          <a
            href={gmgnLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-lg transition-all hover:scale-105 active:scale-95"
            style={{ background: `${style.color}14`, border: `1px solid ${style.color}32`, color: style.color }}
          >
            <ExternalLink className="w-3 h-3" />
            GMGN
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Settings panel (B5: click-outside via ref) ────────────────────────────────
function SettingsPanel({ open, onClose }) {
  const panelRef = useRef(null);

  // B5: close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  const { data: serverSettings } = useQuery({
    queryKey: ['memes-settings'],
    queryFn: () => memesCall('/settings').catch(() => ({})),
    staleTime: 60_000,
    enabled: open,
  });

  const [local, setLocal] = useState({
    min_score:      70,
    min_liquidity:  10000,
    min_volume:     5000,
    fresh_hours:    12,
    min_sm_wallets: 2,
  });

  useEffect(() => {
    if (serverSettings && Object.keys(serverSettings).length) {
      setLocal(prev => ({ ...prev, ...serverSettings }));
    }
  }, [serverSettings]);

  const saveMutation = useMutation({
    mutationFn: () => memesCall('/settings', { method: 'POST', body: local }),
    onSuccess: () => toast.success('Настройки сохранены'),
    onError:   () => toast.error('Ошибка сохранения'),
  });

  if (!open) return null;

  const SliderRow = ({ label, field, min, max, step = 1, prefix = '', suffix = '' }) => (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-[#888]">{label}</span>
        <span className="text-xs font-bold text-white tabular-nums">
          {prefix}{field === 'min_liquidity' || field === 'min_volume' ? formatMoney(local[field]).replace('$', '') : local[field]}{suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={local[field]}
        onChange={e => setLocal(prev => ({ ...prev, [field]: Number(e.target.value) }))}
        className="w-full cursor-pointer"
        style={{ height: '4px', accentColor: T.t2 }}
      />
      <div className="flex justify-between text-[10px] text-[#333] mt-0.5">
        <span>{prefix}{min}{suffix}</span>
        <span>{prefix}{max}{suffix}</span>
      </div>
    </div>
  );

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 z-50 w-80 p-4 flex flex-col gap-4"
      style={{ ...glassPanel, boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-white">Настройки бота</span>
        <button
          onClick={onClose}
          className="p-1 rounded-lg transition-colors"
          style={{ color: '#555' }}
          onMouseEnter={e => e.currentTarget.style.color = '#aaa'}
          onMouseLeave={e => e.currentTarget.style.color = '#555'}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <SliderRow label="Минимальный скор"  field="min_score"      min={50}  max={150}    />
      <SliderRow label="Мин. ликвидность"  field="min_liquidity"  min={0}   max={500000} step={5000}  prefix="$" />
      <SliderRow label="Мин. объём"        field="min_volume"     min={0}   max={1000000} step={10000} prefix="$" />
      <SliderRow label="Свежесть (часов)"  field="fresh_hours"    min={1}   max={72}     suffix="ч" />
      <SliderRow label="Мин. SM кошельков" field="min_sm_wallets" min={1}   max={10}     />

      <button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="w-full py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50"
        style={{
          background: saveMutation.isError
            ? 'linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(239,68,68,0.12) 100%)'
            : saveMutation.isSuccess
            ? 'linear-gradient(135deg, rgba(16,185,129,0.25) 0%, rgba(16,185,129,0.15) 100%)'
            : `linear-gradient(135deg, ${T.t2}30 0%, ${T.t3}22 100%)`,
          border: saveMutation.isError
            ? '1px solid rgba(239,68,68,0.35)'
            : saveMutation.isSuccess
            ? '1px solid rgba(16,185,129,0.4)'
            : `1px solid ${T.t2}48`,
          color: saveMutation.isError ? '#f87171' : saveMutation.isSuccess ? '#34d399' : T.t3,
        }}
      >
        {saveMutation.isPending
          ? 'Сохраняю...'
          : saveMutation.isError
          ? 'Ошибка — повторить'
          : saveMutation.isSuccess
          ? 'Сохранено ✓'
          : 'Сохранить настройки'}
      </button>
    </div>
  );
}

// ── Stat pill ─────────────────────────────────────────────────────────────────
function StatPill({ icon: Icon, label, value, color = '#aaa' }) {
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
    >
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0" style={{ color }} />}
      <span className="text-[#555]">{label}</span>
      <span className="font-bold tabular-nums" style={{ color }}>{value}</span>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ filtered }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-5">
      <div className="relative">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: `${T.t2}14`, border: `1px solid ${T.t2}35` }}
        >
          <Gem className="w-9 h-9 opacity-40" style={{ color: T.t2, animation: 'pulse 2.2s ease-in-out infinite' }} />
        </div>
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: `radial-gradient(circle, ${T.t2}18 0%, transparent 70%)`, animation: 'ping 2.5s cubic-bezier(0,0,0.2,1) infinite' }}
        />
      </div>
      <div className="text-center">
        <p className="text-base font-semibold text-[#555] mb-1">
          {filtered ? 'Нет сигналов по фильтрам' : 'Ждём сигналов...'}
        </p>
        <p className="text-sm text-[#333]">
          {filtered ? 'Попробуйте снизить минимальный скор или сбросить фильтры' : 'Бот мониторит smart money кошельки'}
        </p>
        {!filtered && <p className="text-xs text-[#2a2a2a] mt-1">Сигналы появятся когда крупные игроки зайдут в мем</p>}
      </div>
    </div>
  );
}

// ── Error state ───────────────────────────────────────────────────────────────
function ErrorState({ onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
      >
        <AlertCircle className="w-7 h-7 text-red-400 opacity-70" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-[#555] mb-1">Нет связи с ботом</p>
        <p className="text-xs text-[#333]">Проверьте подключение и попробуйте снова</p>
      </div>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 text-xs px-4 py-2 rounded-xl transition-all active:scale-95"
        style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Повторить
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Memes() {
  const [search,       setSearch]       = useState('');
  const [minScore,     setMinScore]     = useState(70);
  const [sortBy,       setSortBy]       = useState('score');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [secAgo,       setSecAgo]       = useState(0);

  const prevCountRef = useRef(null);

  // Signals query
  const {
    data:         signalsRaw = [],
    isLoading:    signalsLoading,
    isError:      signalsError,
    refetch:      refetchSignals,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['memes-signals'],
    queryFn:  () =>
      memesCall('/signals')
        .then(d => Array.isArray(d) ? d : (d.signals ?? d.data ?? [])),
    refetchInterval: 30_000,
    staleTime:       15_000,
    retry:           2,
  });

  // Stats query
  const { data: stats = {} } = useQuery({
    queryKey: ['memes-stats'],
    queryFn:  () => memesCall('/stats').catch(() => ({})),
    refetchInterval: 30_000,
    staleTime:       15_000,
  });

  // "X sec ago" ticker
  useEffect(() => {
    if (!dataUpdatedAt) return;
    const tick = () => setSecAgo(Math.round((Date.now() - dataUpdatedAt) / 1000));
    tick();
    const id = setInterval(tick, 5_000);
    return () => clearInterval(id);
  }, [dataUpdatedAt]);

  // New-signal toast (B3: correct Russian plural)
  useEffect(() => {
    if (!signalsRaw.length) return;
    if (prevCountRef.current === null) { prevCountRef.current = signalsRaw.length; return; }
    const diff = signalsRaw.length - prevCountRef.current;
    if (diff > 0) toast.success(`💎 +${pluralSig(diff)}!`);
    prevCountRef.current = signalsRaw.length;
  }, [signalsRaw.length]);

  // Filter + sort
  const signals = signalsRaw
    .filter(s => {
      const score = s.score ?? 0;
      if (score < minScore) return false;
      if (search) {
        const q   = search.toLowerCase();
        const sym = (s.symbol || '').toLowerCase();
        const nm  = (s.name   || '').toLowerCase();
        if (!sym.includes(q) && !nm.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'score')     return (b.score ?? 0) - (a.score ?? 0);
      if (sortBy === 'time')      return new Date(b.timestamp ?? b.created_at ?? 0) - new Date(a.timestamp ?? a.created_at ?? 0);
      if (sortBy === 'volume')    return (b.vol24h ?? b.volume_24h ?? 0) - (a.vol24h ?? a.volume_24h ?? 0);
      if (sortBy === 'freshness') return (a.minHoursAgo ?? a.min_hours_ago ?? 999) - (b.minHoursAgo ?? b.min_hours_ago ?? 999);
      return 0;
    });

  // Stats
  const totalSignals = stats.total ?? signalsRaw.length;
  const last24h = stats.last_24h ?? signalsRaw.filter(s => {
    const ts = s.timestamp ?? s.created_at;
    return ts && Date.now() - new Date(ts).getTime() < 86_400_000;
  }).length;
  const last1h = stats.last_1h ?? signalsRaw.filter(s => {
    const ts = s.timestamp ?? s.created_at;
    return ts && Date.now() - new Date(ts).getTime() < 3_600_000;
  }).length;
  const avgScore = stats.avg_score ?? (
    signalsRaw.length
      ? Math.round(signalsRaw.reduce((a, s) => a + (s.score ?? 0), 0) / signalsRaw.length)
      : 0
  );

  const isStale = secAgo > 600;
  const activeFilters = (search ? 1 : 0) + (minScore !== 70 ? 1 : 0);

  const resetFilters = useCallback(() => {
    setSearch('');
    setMinScore(70);
    setSortBy('score');
  }, []);

  return (
    <div className="max-w-[1400px] mx-auto pb-16" style={{ minHeight: '100vh' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1
              className="text-3xl font-extrabold tracking-tight"
              style={{
                background: 'linear-gradient(135deg, #7a8499 0%, #c0c8d8 45%, #e8edf5 75%, #b8d4f0 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              💎 MEMES
            </h1>
            <p className="text-sm text-[#555] mt-0.5">Smart Money Signals · Ethereum memecoins</p>
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
              {dataUpdatedAt
                ? `Обновлено ${secAgo < 60 ? `${secAgo}с` : `${Math.round(secAgo / 60)}м`} назад`
                : 'Загрузка...'}
            </div>

            <button
              onClick={() => refetchSignals()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all active:scale-95"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: '#666' }}
            >
              <RefreshCw className={`w-3 h-3 ${signalsLoading ? 'animate-spin' : ''}`} />
              Обновить
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex flex-wrap gap-2">
          <StatPill icon={Gem}   label="Всего"     value={totalSignals} color={T.t3} />
          <StatPill icon={Clock} label="24ч"       value={last24h}      color={T.t2} />
          <StatPill icon={Zap}   label="1ч"        value={last1h}       color="#34d399" />
          <StatPill icon={Star}  label="Avg score" value={avgScore}     color="#c084fc" />
          {dataUpdatedAt && (
            <StatPill
              label="Обновлено"
              value={new Date(dataUpdatedAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
              color="#666"
            />
          )}
          {signalsError && (
            <span
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-red-400"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              Нет связи с ботом
            </span>
          )}
        </div>
      </div>

      {/* ── Filter/sort controls ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 p-3 mb-6" style={glassPanel}>

        {/* Search */}
        <div className="relative" style={{ flex: '1 1 160px' }}>
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: '#444' }} />
          <input
            type="text"
            placeholder="Поиск по символу..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-transparent text-sm text-white placeholder-[#333] pl-8 pr-3 py-1.5 rounded-lg outline-none"
            style={{ border: '1px solid rgba(255,255,255,0.10)', fontSize: '13px' }}
          />
          {search && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2"
              onClick={() => setSearch('')}
            >
              <X className="w-3.5 h-3.5" style={{ color: '#444' }} />
            </button>
          )}
        </div>

        {/* Min score slider */}
        <div className="flex items-center gap-2" style={{ flex: '1 1 200px' }}>
          <span className="text-xs text-[#555] shrink-0 whitespace-nowrap">Мин. скор:</span>
          <input
            type="range"
            min={50}
            max={150}
            value={minScore}
            onChange={e => setMinScore(Number(e.target.value))}
            className="flex-1 cursor-pointer"
            style={{ height: '4px', accentColor: T.t2 }}
          />
          <span
            className="text-xs font-bold tabular-nums px-2 py-0.5 rounded"
            style={{
              color: getScoreStyle(minScore).color,
              background: `${getScoreStyle(minScore).color}15`,
              minWidth: '34px',
              textAlign: 'center',
            }}
          >
            {minScore}
          </span>
        </div>

        {/* Sort buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { key: 'score',     label: 'Score ↓'  },
            { key: 'time',      label: 'Новые'     },
            { key: 'volume',    label: 'Volume ↓'  },
            { key: 'freshness', label: 'Свежие'    },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              className="text-xs px-2.5 py-1 rounded-lg transition-all"
              style={sortBy === opt.key
                ? { background: `${T.t2}22`, border: `1px solid ${T.t2}40`, color: T.t3 }
                : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#555' }
              }
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Active filters badge + reset */}
        <div className="flex items-center gap-2 shrink-0">
          {activeFilters > 0 && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${T.t2}22`, border: `1px solid ${T.t2}38`, color: T.t2 }}
            >
              {activeFilters} фильтр{activeFilters > 1 ? 'а' : ''}
            </span>
          )}
          {activeFilters > 0 && (
            <button
              onClick={resetFilters}
              className="text-xs px-2.5 py-1 rounded-lg transition-all active:scale-95"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#555' }}
            >
              Сбросить
            </button>
          )}
        </div>

        {/* Results count */}
        <span
          className="text-xs font-bold px-2.5 py-1 rounded-lg shrink-0 ml-auto"
          style={{ background: `${T.t2}14`, border: `1px solid ${T.t2}28`, color: T.t2 }}
        >
          Показано {signals.length} из {signalsRaw.length}
        </span>

        {/* Settings toggle */}
        <div className="relative shrink-0">
          <button
            onClick={() => setSettingsOpen(p => !p)}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all"
            style={settingsOpen
              ? { background: `${T.t2}20`, border: `1px solid ${T.t2}40`, color: T.t3 }
              : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#555' }
            }
          >
            <Settings className="w-3.5 h-3.5" />
            Бот
          </button>
          <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </div>
      </div>

      {/* ── Signals content ──────────────────────────────────────────────────── */}
      {(
        signalsLoading && signalsRaw.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : signalsError && signalsRaw.length === 0 ? (
          <ErrorState onRetry={refetchSignals} />
        ) : signals.length === 0 ? (
          <EmptyState filtered={signalsRaw.length > 0} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {signals.map((signal, i) => (
              <div
                key={signal.id ?? signal.tokenAddr ?? signal.symbol ?? i}
                style={{ animation: `fadeSlideIn ${0.12 + Math.min(i, 10) * 0.03}s ease both` }}
              >
                <SignalCard signal={signal} />
              </div>
            ))}
          </div>
        )
      )}

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
