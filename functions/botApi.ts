import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── Rate limiting ──────────────────────────────────────────────────────────────

const rateLimits = new Map();

function checkRateLimit(key, max = 10, windowMs = 60000) {
  const now = Date.now();
  const r = rateLimits.get(key);
  if (!r || now > r.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (r.count >= max) return false;
  r.count++;
  return true;
}

// ── Token validation (OPTIMIZED) ───────────────────────────────────────────────

async function validateToken(base44, rawToken) {
  let hash = null;
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawToken));
    hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {}

  // Query by hash first (new tokens)
  const byHash = await base44.asServiceRole.entities.BotApiToken.filter({ 
    token_hash: hash, 
    is_active: true 
  }, '-created_date', 1);

  let t = byHash[0] || null;

  // Fallback to plaintext (legacy tokens)
  if (!t) {
    const byPlaintext = await base44.asServiceRole.entities.BotApiToken.filter({ 
      token: rawToken, 
      is_active: true 
    }, '-created_date', 1);
    t = byPlaintext[0] || null;
  }

  if (!t) return null;

  // Check expiry
  if (t.expires_at && new Date(t.expires_at) < new Date()) return null;

  // Update last_used_at async
  base44.asServiceRole.entities.BotApiToken.update(t.id, { last_used_at: new Date().toISOString() }).catch(() => {});
  return t;
}

// Helper: get created_by email from token owner
async function getOwnerEmail(base44, apiToken) {
  // created_by is the email of the user who created the token
  return apiToken.created_by || null;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const url = new URL(req.url);
  const path = url.pathname.replace(/.*\/botApi/, '') || '/';

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!token) {
    return Response.json({ error: 'Missing Authorization token' }, { status: 401 });
  }

  // Rate limit: 30 requests per minute per token
  const rateLimitKey = `botApi:${token.slice(0, 12)}`;
  if (!checkRateLimit(rateLimitKey, 30, 60000)) {
    return Response.json({ error: 'RATE_LIMITED: Too many requests. Wait 1 minute.' }, { status: 429 });
  }

  const apiToken = await validateToken(base44, token);
  if (!apiToken) {
    return Response.json({ error: 'Invalid or inactive token' }, { status: 401 });
  }

  const permissions = JSON.parse(apiToken.permissions || '["read","trade"]');
  const profileId = apiToken.profile_id;

  // ── GET /trades  — список открытых сделок
  if (req.method === 'GET' && path === '/trades') {
    const filter = profileId ? { profile_id: profileId } : {};
    const trades = await base44.asServiceRole.entities.Trade.filter(filter, '-date_open', 100);
    return Response.json({ trades });
  }

  // ── GET /trades/open
  if (req.method === 'GET' && path === '/trades/open') {
    const filter = profileId ? { profile_id: profileId } : {};
    const all = await base44.asServiceRole.entities.Trade.filter(filter, '-date_open', 100);
    const open = all.filter(t => !t.close_price);
    return Response.json({ trades: open });
  }

  // ── GET /trades/closed
  if (req.method === 'GET' && path === '/trades/closed') {
    const filter = profileId ? { profile_id: profileId } : {};
    const all = await base44.asServiceRole.entities.Trade.filter(filter, '-date_close', 100);
    const closed = all.filter(t => !!t.close_price);
    return Response.json({ trades: closed });
  }

  // ── GET /stats  — базовая статистика
  if (req.method === 'GET' && path === '/stats') {
    const filter = profileId ? { profile_id: profileId } : {};
    const all = await base44.asServiceRole.entities.Trade.filter(filter, '-date_open', 1000);
    const closed = all.filter(t => !!t.close_price);
    const open = all.filter(t => !t.close_price);
    const totalPnl = closed.reduce((s, t) => s + (t.pnl_usd || 0), 0);
    const wins = closed.filter(t => (t.pnl_usd || 0) > 0).length;
    return Response.json({
      total_trades: closed.length,
      open_trades: open.length,
      total_pnl_usd: totalPnl,
      winrate: closed.length > 0 ? Math.round((wins / closed.length) * 100) : 0,
    });
  }

  // ── POST /trades  — открыть новую сделку
  if (req.method === 'POST' && path === '/trades') {
    if (!permissions.includes('trade')) {
      return Response.json({ error: 'No trade permission' }, { status: 403 });
    }
    const body = await req.json();
    const { coin, direction, entry_price, position_size, stop_price, take_price, strategy_tag } = body;

    if (!coin || !direction || !entry_price || !position_size) {
      return Response.json({ error: 'Missing required fields: coin, direction, entry_price, position_size' }, { status: 400 });
    }

    const ownerEmail = await getOwnerEmail(base44, apiToken);

    const trade = await base44.asServiceRole.entities.Trade.create({
      profile_id: profileId,
      coin,
      direction,
      entry_price: Number(entry_price),
      position_size: Number(position_size),
      stop_price: stop_price ? Number(stop_price) : undefined,
      take_price: take_price ? Number(take_price) : undefined,
      strategy_tag: strategy_tag || 'bot',
      date_open: new Date().toISOString(),
      date: new Date().toISOString(),
      import_source: 'bot',
      created_by: ownerEmail,
    });

    return Response.json({ trade }, { status: 201 });
  }

  // ── PATCH /trades/:id  — обновить сделку (стоп, тейк, etc.)
  if (req.method === 'PATCH' && path.startsWith('/trades/')) {
    if (!permissions.includes('trade')) {
      return Response.json({ error: 'No trade permission' }, { status: 403 });
    }
    const tradeId = path.replace('/trades/', '');
    const body = await req.json();
    const updated = await base44.asServiceRole.entities.Trade.update(tradeId, body);
    return Response.json({ trade: updated });
  }

  // ── POST /trades/:id/close  — закрыть сделку
  if (req.method === 'POST' && path.match(/^\/trades\/.+\/close$/)) {
    if (!permissions.includes('trade')) {
      return Response.json({ error: 'No trade permission' }, { status: 403 });
    }
    const tradeId = path.replace('/trades/', '').replace('/close', '');
    const body = await req.json();
    const { close_price, pnl_usd } = body;

    if (!close_price) {
      return Response.json({ error: 'Missing close_price' }, { status: 400 });
    }

    const updated = await base44.asServiceRole.entities.Trade.update(tradeId, {
      close_price: Number(close_price),
      date_close: new Date().toISOString(),
      pnl_usd: pnl_usd !== undefined ? Number(pnl_usd) : undefined,
    });

    return Response.json({ trade: updated });
  }

  return Response.json({ error: 'Not found', available_endpoints: [
    'GET /trades',
    'GET /trades/open',
    'GET /trades/closed',
    'GET /stats',
    'POST /trades',
    'PATCH /trades/:id',
    'POST /trades/:id/close',
  ]}, { status: 404 });
});