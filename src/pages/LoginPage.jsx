import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import tapLogo from '@/assets/tap-logo.png';

export default function LoginPage() {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState('main'); // main | email | signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef(null);

  // Emerald accent — matches TAP app color scheme
  const ACCENT = '#10b981';
  const ACCENT_GLOW = 'rgba(16,185,129,0.25)';
  const ACCENT_DIM = 'rgba(16,185,129,0.12)';
  const ACCENT_BORDER = 'rgba(16,185,129,0.2)';

  useEffect(() => {
    setMounted(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const draw = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.strokeStyle = 'rgba(16,185,129,0.035)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 60) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 60) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }
    };
    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, []);

  const handleGoogle = () => {
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
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await base44.auth.register({ email, password });
      window.location.href = '/';
    } catch (err) {
      setError(err?.message || 'Registration failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: '11px 14px',
    color: '#fff',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };

  const labelStyle = {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    letterSpacing: '0.06em',
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
      {/* Grid canvas */}
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

      {/* Blob 1 — top left */}
      <div style={{
        position: 'absolute', width: 700, height: 700, top: '-20%', left: '-15%',
        background: `radial-gradient(circle, ${ACCENT_DIM} 0%, transparent 70%)`,
        filter: 'blur(90px)', animation: 'blob1 12s ease-in-out infinite alternate',
      }} />
      {/* Blob 2 — bottom right */}
      <div style={{
        position: 'absolute', width: 500, height: 500, bottom: '-15%', right: '0%',
        background: `radial-gradient(circle, rgba(16,185,129,0.07) 0%, transparent 70%)`,
        filter: 'blur(110px)', animation: 'blob2 16s ease-in-out infinite alternate',
      }} />

      {/* Main card */}
      <div style={{
        position: 'relative', zIndex: 10, width: '100%', maxWidth: 440, margin: '0 16px',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.65s ease, transform 0.65s ease',
      }}>

        {/* ── Brand ── */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          {/* Logo */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <img
              src={tapLogo}
              alt="TAP Logo"
              style={{ width: 64, height: 64, objectFit: 'contain', filter: 'drop-shadow(0 0 12px rgba(16,185,129,0.3))' }}
            />
          </div>

          {/* App name */}
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#fff', marginBottom: 8 }}>
            TAP
          </div>

          {/* Slogan */}
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: ACCENT, marginBottom: 8 }}>
            AI Trading Mentor
          </div>

          {/* Tagline */}
          <p style={{ color: 'rgba(255,255,255,0.32)', fontSize: 12.5, lineHeight: 1.6, letterSpacing: '0.01em' }}>
            Master Your Edge. Grow Your Capital.<br />Trade Smarter.
          </p>
        </div>

        {/* ── Login box ── */}
        <div style={{
          background: 'rgba(255,255,255,0.025)',
          border: `1px solid ${ACCENT_BORDER}`,
          borderRadius: 20,
          padding: '28px 26px',
          backdropFilter: 'blur(24px)',
        }}>

          {/* ── MAIN mode ── */}
          {mode === 'main' && (
            <>
              {/* Google */}
              <button
                onClick={handleGoogle}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                  padding: '13px 20px', background: ACCENT, color: '#fff', border: 'none',
                  borderRadius: 12, fontSize: 14, fontWeight: 700, letterSpacing: '0.04em',
                  textTransform: 'uppercase', cursor: 'pointer',
                  boxShadow: `0 0 28px ${ACCENT_GLOW}`, transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = `0 0 44px rgba(16,185,129,0.45)`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = `0 0 28px ${ACCENT_GLOW}`; }}
              >
                <svg width="19" height="19" viewBox="0 0 24 24">
                  <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="rgba(255,255,255,0.8)" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="rgba(255,255,255,0.6)" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="rgba(255,255,255,0.9)" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              {/* OR divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
                <span style={{ color: 'rgba(255,255,255,0.22)', fontSize: 11, letterSpacing: '0.06em' }}>OR</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
              </div>

              {/* Sign In with Email */}
              <button
                onClick={() => setMode('email')}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  padding: '12px 20px', background: 'transparent', color: 'rgba(255,255,255,0.65)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 13,
                  fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', marginBottom: 10,
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT_BORDER; e.currentTarget.style.color = ACCENT; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                Sign In with Email
              </button>

              {/* Sign Up */}
              <button
                onClick={() => setMode('signup')}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  padding: '12px 20px', background: 'transparent', color: 'rgba(255,255,255,0.65)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 13,
                  fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT_BORDER; e.currentTarget.style.color = ACCENT; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <line x1="19" y1="8" x2="19" y2="14"/>
                  <line x1="22" y1="11" x2="16" y2="11"/>
                </svg>
                Create Account
              </button>
            </>
          )}

          {/* ── EMAIL LOGIN mode ── */}
          {mode === 'email' && (
            <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <button type="button" onClick={() => { setMode('main'); setError(''); }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', textAlign: 'left', fontSize: 12, padding: 0, marginBottom: 2 }}>
                ← Back
              </button>
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder="you@example.com" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = `${ACCENT}66`}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
              <div>
                <label style={labelStyle}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="••••••••" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = `${ACCENT}66`}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
              {error && <p style={{ color: '#f87171', fontSize: 13, margin: 0 }}>{error}</p>}
              <button type="submit" disabled={loading}
                style={{
                  width: '100%', padding: '13px', background: ACCENT, color: '#fff',
                  border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700,
                  letterSpacing: '0.04em', textTransform: 'uppercase',
                  cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                  boxShadow: `0 0 20px ${ACCENT_GLOW}`,
                }}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
              <button type="button" onClick={() => { setMode('signup'); setError(''); }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 12, padding: 0, textAlign: 'center' }}>
                Don't have an account? <span style={{ color: ACCENT }}>Sign up</span>
              </button>
            </form>
          )}

          {/* ── SIGN UP mode ── */}
          {mode === 'signup' && (
            <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <button type="button" onClick={() => { setMode('main'); setError(''); }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', textAlign: 'left', fontSize: 12, padding: 0, marginBottom: 2 }}>
                ← Back
              </button>
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder="you@example.com" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = `${ACCENT}66`}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
              <div>
                <label style={labelStyle}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="Min. 8 characters" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = `${ACCENT}66`}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
              {error && <p style={{ color: '#f87171', fontSize: 13, margin: 0 }}>{error}</p>}
              <button type="submit" disabled={loading}
                style={{
                  width: '100%', padding: '13px', background: ACCENT, color: '#fff',
                  border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700,
                  letterSpacing: '0.04em', textTransform: 'uppercase',
                  cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                  boxShadow: `0 0 20px ${ACCENT_GLOW}`,
                }}
              >
                {loading ? 'Creating...' : 'Create Account'}
              </button>
              <button type="button" onClick={() => { setMode('email'); setError(''); }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 12, padding: 0, textAlign: 'center' }}>
                Already have an account? <span style={{ color: ACCENT }}>Sign in</span>
              </button>
            </form>
          )}

          <p style={{ textAlign: 'center', marginTop: 18, color: 'rgba(255,255,255,0.15)', fontSize: 11, lineHeight: 1.5 }}>
            By continuing you agree to{' '}
            <span style={{ color: `${ACCENT}80` }}>TAP Terms of Service</span>
          </p>
        </div>

        {/* ── Stats strip ── */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 36, marginTop: 26 }}>
          {[['Free Beta', 'Access'], ['AI-powered', 'Analysis'], ['Multi-exchange', 'Support']].map(([v, l]) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: ACCENT, letterSpacing: '-0.01em' }}>{v}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes blob1 { 0% { transform: translate(0,0) scale(1); } 100% { transform: translate(50px,35px) scale(1.12); } }
        @keyframes blob2 { 0% { transform: translate(0,0) scale(1); } 100% { transform: translate(-40px,-25px) scale(1.08); } }
        input::placeholder { color: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
}
