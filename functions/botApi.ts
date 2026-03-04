import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Helper: validate token and return owner user + profile
async function validateToken(base44, token) {
  const tokens = await base44.asServiceRole.entities.BotApiToken.filter({ token, is_active: true });
  if (!tokens || tokens.length === 0) return null;
  const t = tokens[0];
  // Update last_used_at
  await base44.asServiceRole.entities.BotApiToken.update(t.id, { last_used_at: new Date().toISOString() });
  return t;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const url = new URL(req.url);
  const path = url.pathname.replace(/.*\/botApi/, '') || '/';

  // All requests must have Authorization: Bearer <token>
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!token) {
    return Response.json({ error: 'Missing Authorization token' }, { status: 401 });
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
      import_source: 'bot',
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