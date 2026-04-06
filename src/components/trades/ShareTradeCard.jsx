import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Zap } from 'lucide-react';

const formatPrice = (price) => {
  if (price === undefined || price === null || price === '') return '—';
  const p = parseFloat(price);
  if (isNaN(p)) return '—';
  if (Math.abs(p) >= 1) {
    const str = p.toPrecision(4);
    return `$${parseFloat(str)}`;
  }
  const str = p.toFixed(20);
  const match = str.match(/\.0*([1-9]\d{0,3})/);
  if (match) {
    const zeros = str.indexOf(match[1]) - str.indexOf('.') - 1;
    return `$${p.toFixed(zeros + 4).replace(/0+$/, '')}`;
  }
  return `$${p.toFixed(4).replace(/\.?0+$/, '')}`;
};

const formatNum = (num) => {
  if (num === undefined || num === null || num === '') return '—';
  const n = parseFloat(num);
  if (isNaN(n)) return '—';
  return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
};

// Sparkline-like chart bars (decorative, based on pnl sign and r multiple)
const MiniChart = ({ isWin, rMultiple }) => {
  const bars = isWin
    ? [30, 45, 35, 55, 48, 62, 58, 75, 70, 88, 82, 100]
    : [100, 85, 90, 70, 75, 58, 65, 45, 52, 35, 25, 18];
  const color = isWin ? '#10b981' : '#ef4444';
  return (
    <svg width="120" height="36" viewBox="0 0 120 36" fill="none">
      {bars.map((h, i) => (
        <rect
          key={i}
          x={i * 10 + 1}
          y={36 - (h * 0.32)}
          width={7}
          height={h * 0.32}
          rx={2}
          fill={color}
          opacity={0.15 + (i / bars.length) * 0.6}
        />
      ))}
      {/* line over bars */}
      <polyline
        points={bars.map((h, i) => `${i * 10 + 4.5},${36 - h * 0.32}`).join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
    </svg>
  );
};

export default function ShareTradeCard({ trade, isOpen }) {
  const isLong = trade.direction === 'Long';
  const pnl = parseFloat(trade.pnl_usd) || 0;
  const pnlPercent = parseFloat(trade.pnl_percent_of_balance) || 0;
  const rMultiple = parseFloat(trade.r_multiple) || 0;
  const isWin = pnl >= 0;

  const coin = (trade.coin || '').replace('USDT', '').replace('PERP', '');

  const accent = isWin ? '#10b981' : '#ef4444';
  const accentMid = isWin ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)';
  const accentLow = isWin ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)';
  const accentBorder = isWin ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)';

  const closeDate = trade.date_close || trade.date_open || trade.date;
  const dateStr = closeDate
    ? new Date(closeDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  const hitSL = trade.stop_loss_was_hit === true;
  const hitTP = trade.take_profit_was_hit === true;
  const outcome = hitSL ? 'HIT SL' : hitTP ? 'HIT TP' : isWin ? 'WIN' : 'LOSS';
  const outcomeColor = isWin ? accent : '#ef4444';

  const riskUsd = trade.risk_usd ? `$${Math.round(trade.risk_usd)}` : '—';
  const duration = trade.actual_duration_minutes
    ? trade.actual_duration_minutes >= 60
      ? `${Math.floor(trade.actual_duration_minutes / 60)}h ${trade.actual_duration_minutes % 60}m`
      : `${trade.actual_duration_minutes}m`
    : '—';

  return (
    <div
      style={{
        width: 600,
        height: 600,
        background: '#080808',
        fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* === BACKGROUND LAYERS === */}

      {/* Subtle grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)`,
        backgroundSize: '40px 40px',
      }} />

      {/* Top-right diagonal glow */}
      <div style={{
        position: 'absolute',
        top: -120, right: -80,
        width: 420, height: 420,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${isWin ? 'rgba(16,185,129,0.22)' : 'rgba(239,68,68,0.22)'} 0%, transparent 70%)`,
      }} />

      {/* Bottom glow */}
      <div style={{
        position: 'absolute',
        bottom: -60, left: '50%', transform: 'translateX(-50%)',
        width: 500, height: 200,
        background: `radial-gradient(ellipse, ${isWin ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'} 0%, transparent 70%)`,
      }} />

      {/* Noise/grain via subtle dots */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)`,
        backgroundSize: '18px 18px',
      }} />

      {/* === HEADER === */}
      <div style={{
        position: 'relative', zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '24px 32px 0',
      }}>
        {/* Logo + brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69349b30698117be30e537d8/d941b1ccb_.jpg"
            alt="TAP"
            style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 8, filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.25))' }}
          />
          <div>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 800, letterSpacing: '0.06em', lineHeight: 1 }}>TRADING</div>
            <div style={{ color: accent, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', lineHeight: 1.2 }}>ANALYTICS PRO</div>
          </div>
        </div>

        {/* Date + outcome pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ color: '#666', fontSize: 12, fontWeight: 500 }}>{dateStr}</div>
          <div style={{
            background: accentMid,
            border: `1px solid ${accentBorder}`,
            borderRadius: 20,
            padding: '4px 14px',
            color: outcomeColor,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.1em',
          }}>
            {outcome}
          </div>
        </div>
      </div>

      {/* === COIN + DIRECTION === */}
      <div style={{
        position: 'relative', zIndex: 10,
        padding: '20px 32px 0',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
          <div style={{
            fontSize: 76,
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: '-0.03em',
            lineHeight: 0.9,
            textShadow: `0 0 60px ${isWin ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`,
          }}>
            {coin}
          </div>
          <div style={{ paddingBottom: 8 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: accentMid,
              border: `1.5px solid ${accentBorder}`,
              borderRadius: 10,
              padding: '6px 12px',
            }}>
              <span style={{ fontSize: 14, color: accent }}>
                {isLong ? '▲' : '▼'}
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: accent, letterSpacing: '0.08em' }}>
                {trade.direction?.toUpperCase()}
              </span>
            </div>
            <div style={{ marginTop: 4, fontSize: 11, color: '#555', textAlign: 'center', letterSpacing: '0.05em' }}>
              {trade.timeframe || '—'}
            </div>
          </div>
        </div>

        {/* Mini chart */}
        <div style={{ paddingBottom: 12, opacity: 0.8 }}>
          <MiniChart isWin={isWin} rMultiple={rMultiple} />
        </div>
      </div>

      {/* === DIVIDER === */}
      <div style={{
        position: 'relative', zIndex: 10,
        margin: '16px 32px',
        height: 1,
        background: `linear-gradient(90deg, transparent, ${accentBorder}, transparent)`,
      }} />

      {/* === PRICES ROW === */}
      <div style={{
        position: 'relative', zIndex: 10,
        padding: '0 32px',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr 1fr',
        gap: 12,
      }}>
        {[
          { label: 'ENTRY', value: formatPrice(trade.entry_price) },
          { label: 'CLOSE', value: formatPrice(trade.close_price) },
          { label: 'DURATION', value: duration },
          { label: 'RISK', value: riskUsd },
        ].map(({ label, value }) => (
          <div key={label} style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10,
            padding: '10px 12px',
          }}>
            <div style={{ fontSize: 9, color: '#555', fontWeight: 700, letterSpacing: '0.14em', marginBottom: 5 }}>{label}</div>
            <div style={{ fontSize: 16, color: '#ccc', fontWeight: 800 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* === MAIN PNL BLOCK === */}
      <div style={{
        position: 'relative', zIndex: 10,
        margin: '16px 32px 0',
        background: `linear-gradient(135deg, ${accentMid} 0%, ${accentLow} 60%, rgba(0,0,0,0.2) 100%)`,
        border: `1.5px solid ${accentBorder}`,
        borderRadius: 18,
        padding: '24px 28px',
        boxShadow: `0 0 40px ${isWin ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)'}`,
        overflow: 'hidden',
      }}>
        {/* Glow inside card */}
        <div style={{
          position: 'absolute', top: -40, right: -40,
          width: 200, height: 200,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${isWin ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'} 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1px 1fr 1px 1fr' }}>
          {/* PNL $ */}
          <div style={{ textAlign: 'center', padding: '0 8px' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '0.15em', marginBottom: 8 }}>PNL</div>
            <div style={{
              fontSize: pnl !== 0 && Math.abs(pnl) >= 1000 ? 34 : 38,
              fontWeight: 900,
              color: accent,
              letterSpacing: '-0.02em',
              lineHeight: 1,
              textShadow: `0 0 30px ${accent}80`,
            }}>
              {pnl >= 0 ? '+' : '−'}${formatNum(Math.abs(pnl))}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>USD</div>
          </div>

          {/* Divider */}
          <div style={{ background: 'rgba(255,255,255,0.08)', margin: '8px 0' }} />

          {/* PNL % */}
          <div style={{ textAlign: 'center', padding: '0 8px' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '0.15em', marginBottom: 8 }}>RETURN</div>
            <div style={{
              fontSize: 38, fontWeight: 900, color: accent,
              letterSpacing: '-0.02em', lineHeight: 1,
              textShadow: `0 0 30px ${accent}80`,
            }}>
              {pnlPercent >= 0 ? '+' : '−'}{Math.abs(pnlPercent).toFixed(1)}%
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>OF BALANCE</div>
          </div>

          {/* Divider */}
          <div style={{ background: 'rgba(255,255,255,0.08)', margin: '8px 0' }} />

          {/* R Multiple */}
          <div style={{ textAlign: 'center', padding: '0 8px' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '0.15em', marginBottom: 8 }}>R MULTIPLE</div>
            <div style={{
              fontSize: 38, fontWeight: 900, color: accent,
              letterSpacing: '-0.02em', lineHeight: 1,
              textShadow: `0 0 30px ${accent}80`,
            }}>
              {rMultiple >= 0 ? '+' : '−'}{Math.abs(rMultiple).toFixed(1)}R
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>RISK/REWARD</div>
          </div>
        </div>
      </div>

      {/* === STRATEGY TAG (if any) === */}
      {trade.strategy_tag && (
        <div style={{
          position: 'relative', zIndex: 10,
          margin: '12px 32px 0',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: '5px 12px',
            fontSize: 11, color: '#888', fontWeight: 600, letterSpacing: '0.08em',
          }}>
            ⚡ {trade.strategy_tag}
          </div>
        </div>
      )}

      {/* === FOOTER === */}
      <div style={{
        position: 'relative', zIndex: 10,
        marginTop: 'auto',
        padding: '14px 32px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 11, color: '#444', fontWeight: 500, letterSpacing: '0.06em' }}>
          tradinganalyticspro.com
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent, boxShadow: `0 0 8px ${accent}` }} />
          <div style={{ fontSize: 11, color: '#444', fontWeight: 500 }}>
            {isOpen ? 'Open Position' : 'Closed Trade'}
          </div>
        </div>
      </div>
    </div>
  );
}
