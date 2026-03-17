import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

export default function LoginPage() {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState('main'); // main | email
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.strokeStyle = 'rgba(184,255,0,0.04)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 60) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 60) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const handleGoogle = () => {
    // Use loginWithProvider to go directly to Google OAuth without /login page
    base44.auth.loginWithProvider('google', '/');
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      window.location.href = '/';
    } catch (err) {
      setError('Неверный email или пароль');
    } finally {
      setLoading(false);
    }
  };

  const cardStyle = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(184,255,0,0.15)',
    borderRadius: 20,
    padding: '32px 28px',
    backdropFilter: 'blur(20px)',
  };

  const inputStyle = {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10,
    padding: '11px 14px',
    color: '#fff',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle = {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    display: 'block',
    marginBottom: 6,
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#080808',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

      {/* Blob 1 */}
      <div style={{
        position: 'absolute', width: 700, height: 700, top: '-15%', left: '-10%',
        background: 'radial-gradient(circle, rgba(184,255,0,0.13) 0%, transparent 70%)',
        filter: 'blur(80px)', animation: 'blob1 10s ease-in-out infinite alternate',
      }} />
      {/* Blob 2 */}
      <div style={{
        position: 'absolute', width: 500, height: 500, bottom: '-10%', right: '5%',
        background: 'radial-gradient(circle, rgba(184,255,0,0.09) 0%, transparent 70%)',
        filter: 'blur(100px)', animation: 'blob2 14s ease-in-out infinite alternate',
      }} />

      <div style={{
        position: 'relative', zIndex: 10, width: '100%', maxWidth: 440, margin: '0 16px',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 0.7s ease, transform 0.7s ease',
      }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{
              width: 40, height: 40,
              background: 'linear-gradient(135deg, #b8ff00, #6aff00)',
              borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" stroke="#080808" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="16 7 22 7 22 13" stroke="#080808" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#fff' }}>
              Trading Analytics
            </span>
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 900, letterSpacing: '-0.02em', color: '#fff', lineHeight: 1.1, marginBottom: 10 }}>
            ТВОЙ ТОРГОВЫЙ<br />
            <span style={{ color: '#b8ff00' }}>ДАШБОРД</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 14 }}>Аналитика. Дисциплина. Рост.</p>
        </div>

        {/* Login card */}
        <div style={cardStyle}>

          {mode === 'main' && (
            <>
              {/* Google button */}
              <button
                onClick={handleGoogle}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                  padding: '14px 20px', background: '#b8ff00', color: '#080808', border: 'none',
                  borderRadius: 12, fontSize: 15, fontWeight: 800, letterSpacing: '0.04em',
                  textTransform: 'uppercase', cursor: 'pointer',
                  boxShadow: '0 0 32px rgba(184,255,0,0.25)', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 0 48px rgba(184,255,0,0.4)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 0 32px rgba(184,255,0,0.25)'; }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#080808" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="rgba(8,8,8,0.65)" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="rgba(8,8,8,0.45)" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="rgba(8,8,8,0.8)" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Войти через Google
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, letterSpacing: '0.05em' }}>ИЛИ</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              </div>

              {/* Email button */}
              <button
                onClick={() => setMode('email')}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  padding: '13px 20px', background: 'transparent', color: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, fontSize: 14,
                  fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(184,255,0,0.4)'; e.currentTarget.style.color = '#b8ff00'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                Войти по Email
              </button>
            </>
          )}

          {mode === 'email' && (
            <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <button
                type="button"
                onClick={() => { setMode('main'); setError(''); }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', textAlign: 'left', fontSize: 13, padding: 0, marginBottom: 4 }}
              >
                ← Назад
              </button>
              <div>
                <label style={labelStyle}>Email</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder="you@example.com" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'rgba(184,255,0,0.4)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                />
              </div>
              <div>
                <label style={labelStyle}>Пароль</label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="••••••••" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'rgba(184,255,0,0.4)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                />
              </div>
              {error && <p style={{ color: '#ff6b6b', fontSize: 13, margin: 0 }}>{error}</p>}
              <button
                type="submit" disabled={loading}
                style={{
                  width: '100%', padding: '13px', background: '#b8ff00', color: '#080808',
                  border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 800,
                  letterSpacing: '0.04em', textTransform: 'uppercase',
                  cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                  boxShadow: '0 0 24px rgba(184,255,0,0.2)',
                }}
              >
                {loading ? 'Входим...' : 'Войти'}
              </button>
            </form>
          )}

          <p style={{ textAlign: 'center', marginTop: 20, color: 'rgba(255,255,255,0.18)', fontSize: 12, lineHeight: 1.5 }}>
            Продолжая, вы соглашаетесь с условиями использования<br />
            <span style={{ color: 'rgba(184,255,0,0.4)' }}>Trading Analytics Pro</span>
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginTop: 28 }}>
          {[['10k+', 'Трейдеров'], ['$2M+', 'PnL трекинг'], ['99.9%', 'Uptime']].map(([v, l]) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#b8ff00' }}>{v}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes blob1 { 0% { transform: translate(0,0) scale(1); } 100% { transform: translate(60px,40px) scale(1.15); } }
        @keyframes blob2 { 0% { transform: translate(0,0) scale(1); } 100% { transform: translate(-50px,-30px) scale(1.1); } }
        input::placeholder { color: rgba(255,255,255,0.25); }
      `}</style>
    </div>
  );
}
