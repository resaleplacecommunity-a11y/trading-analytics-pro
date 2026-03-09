/**
 * tradingApiV2 — Production-ready multi-profile Trading API
 *
 * Auth:   Authorization: Bearer tpro_<token>
 * Routes: all passed via _path + _method in payload (Base44 SDK pattern)
 *         or via real URL path when called externally
 *
 * Endpoints:
 *   GET    /health
 *   GET    /profiles
 *   POST   /profiles
 *   PATCH  /profiles/:id
 *   GET    /trades?profile_id=&status=open|closed&limit=&offset=
 *   POST   /trades
 *   PATCH  /trades/:id
 *   POST   /trades/:id/close
 *   GET    /stats?profile_id=
 *   POST   /connections/test
 *   POST   /connections/sync
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ─── Crypto helpers ───────────────────────────────────────────────────────────

async function sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function err(code, message, status) {
  return Response.json({ ok: false, error: { code, message } }, { status });
}

// ─── Token resolution ─────────────────────────────────────────────────────────

/**
 * Resolves tpro_ bearer token → { tokenRecord, profileId, scope }
 * Returns null if invalid/expired/inactive
 */
async function resolveToken(base44, authHeader) {
  const raw = (authHeader || '').replace(/^Bearer\s+/i, '').trim();
  if (!raw) return null;

  const hash = await sha256hex(raw);

  // Load all active tokens and match by hash or plaintext (backward-compat)
  // We can't filter by token_hash directly (SDK limitation), so load all and match in-memory
  const allTokens = await base44.asServiceRole.entities.BotApiToken.list('-created_date', 200);

  let matched = allTokens.find(tok => tok.is_active && tok.token_hash === hash);

  // Backward-compat: old tokens stored plaintext
  if (!matched) {
    matched = allTokens.find(tok => tok.is_active && tok.token === raw);
  }

  if (!matched) return null;

  const t = matched;

  // Check expiry
  if (t.expires_at && new Date(t.expires_at) < new Date()) return null;

  // Update last_used_at async (don't await to keep latency low)
  base44.asServiceRole.entities.BotApiToken.update(t.id, { last_used_at: new Date().toISOString() }).catch(() => {});

  return {
    tokenRecord: t,
    profileId: t.profile_id,
    scope: t.scope || 'write',
    // backward-compat permissions array
    permissions: (() => {
      try { return JSON.parse(t.permissions || '[]'); } catch { return []; }
    })(),
  };
}

// ─── Profile ownership check ──────────────────────────────────────────────────

async function verifyProfileOwner(base44, profileId, ownerEmail) {
  const profiles = await base44.asServiceRole.entities.UserProfile.filter({ created_by: ownerEmail });
  return profiles.some(p => p.id === profileId);
}

// ─── Risk metrics ─────────────────────────────────────────────────────────────

async function computeRiskMetrics(base44, profileId) {
  // Load risk settings for this profile
  const rsList = await base44.asServiceRole.entities.RiskSettings.filter({ profile_id: profileId });
  const rs = rsList[0] || {};

  const overallDdLimit = rs.overall_dd_limit ?? 10;
  const dailyDdLimit = rs.daily_dd_limit ?? 5;
  const targetReturn = rs.target_return ?? 20;
  const riskBase = rs.risk_base ?? 1;
  const riskAfterLossStreak = rs.risk_after_loss_streak ?? 0.5;
  const lossStreakThreshold = rs.loss_streak_threshold ?? 3;

  // Load profile for starting balance
  const profiles = await base44.asServiceRole.entities.UserProfile.filter({ id: profileId });
  const profile = profiles[0] || {};
  const startingBalance = profile.starting_balance || 10000;

  // Load all closed trades for this profile
  const allTrades = await base44.asServiceRole.entities.Trade.filter({ profile_id: profileId }, '-date_close', 1000);
  const closed = allTrades.filter(t => !!t.close_price || !!t.date_close);

  // Total PnL
  const totalPnl = closed.reduce((s, t) => s + (t.pnl_usd || 0), 0);
  const currentBalance = startingBalance + totalPnl;
  const overallDdPercent = startingBalance > 0 ? ((startingBalance - currentBalance) / startingBalance) * 100 : 0;

  // Daily PnL (today UTC)
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTrades = closed.filter(t => {
    const closeDate = (t.date_close || t.date || '').slice(0, 10);
    return closeDate === todayStr;
  });
  const dailyPnl = todayTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
  const dailyDdPercent = currentBalance > 0 ? (Math.abs(Math.min(dailyPnl, 0)) / currentBalance) * 100 : 0;

  // Loss streak
  const sorted = [...closed].sort((a, b) => new Date(b.date_close || b.date) - new Date(a.date_close || a.date));
  let lossStreak = 0;
  for (const t of sorted) {
    if ((t.pnl_usd || 0) < 0) lossStreak++;
    else break;
  }

  const ddLock = overallDdPercent >= overallDdLimit || dailyDdPercent >= dailyDdLimit;

  return {
    starting_balance: startingBalance,
    current_balance: Math.round(currentBalance * 100) / 100,
    total_pnl_usd: Math.round(totalPnl * 100) / 100,
    overall_dd_percent: Math.round(overallDdPercent * 100) / 100,
    daily_pnl_usd: Math.round(dailyPnl * 100) / 100,
    daily_dd_percent: Math.round(dailyDdPercent * 100) / 100,
    dd_lock: ddLock,
    loss_streak: lossStreak,
    settings: {
      overall_dd_limit: overallDdLimit,
      daily_dd_limit: dailyDdLimit,
      target_return: targetReturn,
      risk_base: riskBase,
      risk_after_loss_streak: riskAfterLossStreak,
      loss_streak_threshold: lossStreakThreshold,
      effective_risk: lossStreak >= lossStreakThreshold ? riskAfterLossStreak : riskBase,
    },
  };
}

// ─── Trade helpers ────────────────────────────────────────────────────────────

function appendAction(existingJson, action) {
  let arr = [];
  try { arr = JSON.parse(existingJson || '[]'); } catch {}
  arr.push({ ...action, timestamp: new Date().toISOString() });
  return JSON.stringify(arr);
}

function safeTrade(t) {
  return {
    id: t.id,
    profile_id: t.profile_id,
    external_id: t.external_id,
    import_source: t.import_source,
    coin: t.coin,
    direction: t.direction,
    status: t.close_price || t.date_close ? 'closed' : 'open',
    entry_price: t.entry_price,
    stop_price: t.stop_price,
    take_price: t.take_price,
    close_price: t.close_price,
    position_size: t.position_size,
    risk_usd: t.risk_usd || t.original_risk_usd,
    r_multiple: t.r_multiple,
    pnl_usd: t.pnl_usd,
    realized_pnl_usd: t.realized_pnl_usd,
    pnl_percent_of_balance: t.pnl_percent_of_balance,
    date_open: t.date_open || t.date,
    date_close: t.date_close,
    strategy_tag: t.strategy_tag,
    timeframe: t.timeframe,
    entry_reason: t.entry_reason,
    trade_analysis: t.trade_analysis,
    ai_analysis: t.ai_analysis,
    action_history: t.action_history,
    confidence_level: t.confidence_level,
    emotional_state: t.emotional_state,
    rule_compliance: t.rule_compliance,
    plan_followed: t.plan_followed,
    close_comment: t.close_comment,
    screenshot_url: t.screenshot_url,
    violation_tags: t.violation_tags,
    created_date: t.created_date,
    updated_date: t.updated_date,
  };
}

// ─── AES/relay helpers (reused from exchangeConnectionsApi) ──────────────────

async function getEncKey() {
  const secret = Deno.env.get('BASE44_APP_ID') || 'default-secret-key-32-chars-padded';
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
  );
}

async function decryptValue(ciphertext) {
  const key = await getEncKey();
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

async function signBybit(apiKey, apiSecret, timestamp, recvWindow, params) {
  const queryString = typeof params === 'string'
    ? params
    : Object.entries(params).sort().map(([k, v]) => `${k}=${v}`).join('&');
  const preHashStr = `${timestamp}${apiKey}${recvWindow}${queryString}`;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(preHashStr));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function buildBybitHeaders(apiKey, apiSecret, params) {
  const timestamp = Date.now().toString();
  const recvWindow = '5000';
  const signature = await signBybit(apiKey, apiSecret, timestamp, recvWindow, params);
  return { 'X-BAPI-API-KEY': apiKey, 'X-BAPI-TIMESTAMP': timestamp, 'X-BAPI-RECV-WINDOW': recvWindow, 'X-BAPI-SIGN': signature };
}

async function relayCall(relayUrl, relaySecret, targetUrl, method, headers, params) {
  // For GET requests, append params as query string to targetUrl
  let finalUrl = targetUrl;
  let bodyPayload = undefined;
  if (method === 'GET' && params && Object.keys(params).length > 0) {
    const qs = new URLSearchParams(params).toString();
    finalUrl = targetUrl + (targetUrl.includes('?') ? '&' : '?') + qs;
  } else if (method !== 'GET') {
    bodyPayload = params || {};
  }
  const response = await fetch(relayUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-relay-secret': relaySecret },
    body: JSON.stringify({ url: finalUrl, method, headers: headers || {}, body: bodyPayload }),
  });
  if (!response.ok) {
    const txt = await response.text().catch(() => '');
    throw new Error(`Relay error ${response.status}: ${txt}`);
  }
  return await response.json();
}

// ─── Request normalizer ───────────────────────────────────────────────────────

/**
 * Normalizes any incoming request (SDK proxy or direct HTTP) into:
 *   { method, resource, resourceId, subAction, query, body, authHeader }
 *
 * Accepted payload aliases:
 *   method  : _method | method | httpMethod
 *   path    : _path   | path   | route | endpoint | url
 *   auth    : _auth   (fallback when Authorization header absent)
 */
async function normalizeRequest(req) {
  // Safe URL parse — external calls may have relative or unusual req.url
  let httpUrl;
  try { httpUrl = new URL(req.url); } catch { httpUrl = new URL('http://localhost/'); }

  // Read body for any method that might carry JSON
  let raw = {};
  try {
    const ct = req.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      raw = await req.json();
    } else {
      // Try anyway — some bots forget content-type, GET requests may carry body
      const text = await req.text();
      if (text && text.trim().startsWith('{')) raw = JSON.parse(text);
    }
  } catch { /* non-JSON body → ignore */ }

  // ── Resolve METHOD ──────────────────────────────────────────────────────
  const methodOverride = raw._method ?? raw.method ?? raw.httpMethod ?? null;
  const method = (methodOverride || req.method).toUpperCase().trim();

  // ── Resolve PATH ────────────────────────────────────────────────────────
  let rawPath = raw._path ?? raw.path ?? raw.route ?? raw.endpoint ?? raw.url ?? '';

  // Strip any full URL prefix (http://host/...) if bot sent full URL as path
  if (rawPath.startsWith('http')) {
    try { rawPath = new URL(rawPath).pathname + new URL(rawPath).search; } catch {}
  }

  // If no path in body, derive from actual URL pathname
  if (!rawPath) {
    const parts = httpUrl.pathname.split('/').filter(Boolean);
    const fnIdx = parts.findIndex(p => p === 'tradingApiV2');
    rawPath = fnIdx >= 0
      ? '/' + parts.slice(fnIdx + 1).join('/')
      : '/' + parts.join('/');
  }

  // ── Parse inline query string from path (e.g. "/trades?status=open") ───
  const qMark = rawPath.indexOf('?');
  let pathOnly = rawPath;
  const inlineQuery = new URLSearchParams();
  if (qMark >= 0) {
    pathOnly = rawPath.slice(0, qMark);
    new URLSearchParams(rawPath.slice(qMark + 1)).forEach((v, k) => inlineQuery.set(k, v));
  }

  // Merge: URL searchParams < inline path params < body params (body wins for query-style fields)
  const query = new URLSearchParams(httpUrl.search);
  inlineQuery.forEach((v, k) => query.set(k, v));

  // Normalize path to leading-slash, no trailing slash
  const normalizedPath = '/' + pathOnly.replace(/^\/+/, '').replace(/\/+$/, '');

  // ── Route segments ──────────────────────────────────────────────────────
  const segments = normalizedPath.split('/').filter(Boolean);
  const resource    = segments[0] || '';
  const resourceId  = segments[1] || null;
  const subAction   = segments[2] || null;

  // ── Auth header ─────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization') || (raw._auth ? `Bearer ${raw._auth.replace(/^Bearer\s+/i, '')}` : '') || '';

  // ── Clean body (remove routing meta-keys) ───────────────────────────────
  const body = { ...raw };
  for (const k of ['_method', '_path', '_auth', 'method', 'httpMethod', 'path', 'route', 'endpoint', 'url']) {
    delete body[k];
  }

  return { method, resource, resourceId, subAction, query, body, authHeader, normalizedPath };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { method, resource, resourceId, subAction, query, body: body_raw, authHeader, normalizedPath } =
      await normalizeRequest(req);

    // ── _debug mode: return routing diagnostics (no auth required) ─────────
    const rawBodyForDebug = { ...body_raw };
    if (rawBodyForDebug._debug) {
      return Response.json({
        ok: true,
        debug: true,
        parsed: { method, resource, resourceId, subAction, normalizedPath },
        query: Object.fromEntries(query),
        timestamp: new Date().toISOString(),
      });
    }

    // ── GET /health — no auth required ────────────────────────────────────
    if (resource === 'health' || (resource === '' && method === 'GET')) {
      return Response.json({
        ok: true,
        service: 'tradingApiV2',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
      });
    }

    // ── Auth: bot token (tpro_*) OR user session (frontend SDK call) ────────
    let auth = null;
    const rawToken = (authHeader || '').replace(/^Bearer\s+/i, '').trim();

    if (rawToken.startsWith('tpro_')) {
      // Bot API token auth
      auth = await resolveToken(base44, authHeader);
      if (!auth) return err('INVALID_TOKEN', 'Token is invalid, inactive, or expired', 401);
    } else {
      // Frontend SDK call — use authenticated user session
      const sessionUser = await base44.auth.me().catch(() => null);
      if (!sessionUser) return err('UNAUTHORIZED', 'No authenticated session. Use tpro_ bot token or log in.', 401);
      const userProfiles = await base44.asServiceRole.entities.UserProfile.filter({ created_by: sessionUser.email });
      const activeProf = userProfiles.find(p => p.is_active) || userProfiles[0];
      if (!activeProf) return err('NOT_FOUND', 'No active profile found for this user', 404);
      auth = {
        profileId: activeProf.id,
        scope: 'write',
        tokenRecord: { created_by: sessionUser.email },
        permissions: [],
      };
    }

    const { profileId: tokenProfileId, scope } = auth;

    // Helper: verify caller can access a given profile
    const canAccessProfile = (pid) => {
      if (!pid) return false;
      if (scope === 'admin') return true; // admin tokens can access any owned profile (checked below)
      return pid === tokenProfileId;
    };

    // ── GET /profiles ──────────────────────────────────────────────────────
    if (resource === 'profiles' && method === 'GET' && !resourceId) {
      const user = await base44.auth.me().catch(() => null);
      const email = user?.email || auth.tokenRecord.created_by;
      if (!email) return err('UNAUTHORIZED', 'Cannot determine profile owner', 403);
      const profiles = await base44.asServiceRole.entities.UserProfile.filter({ created_by: email });
      const filtered = scope === 'admin' ? profiles : profiles.filter(p => p.id === tokenProfileId);
      return Response.json({ ok: true, profiles: filtered.map(p => ({
        id: p.id, profile_name: p.profile_name, is_active: p.is_active,
        starting_balance: p.starting_balance, created_date: p.created_date,
      }))});
    }

    // ── POST /profiles ─────────────────────────────────────────────────────
    if (resource === 'profiles' && method === 'POST' && !resourceId) {
      if (scope !== 'admin') return err('FORBIDDEN', 'Admin scope required to create profiles', 403);
      const user = await base44.auth.me().catch(() => null);
      const email = user?.email || auth.tokenRecord.created_by;
      const { profile_name, starting_balance } = body_raw;
      if (!profile_name) return err('VALIDATION', 'profile_name is required', 400);
      const profile = await base44.asServiceRole.entities.UserProfile.create({
        profile_name, starting_balance: starting_balance || 10000, is_active: false, created_by: email,
      });
      return Response.json({ ok: true, profile }, { status: 201 });
    }

    // ── PATCH /profiles/:id ────────────────────────────────────────────────
    if (resource === 'profiles' && method === 'PATCH' && resourceId) {
      if (!canAccessProfile(resourceId)) return err('FORBIDDEN', 'Access denied to this profile', 403);
      const allowed = ['profile_name', 'starting_balance', 'open_commission', 'close_commission'];
      const update = {};
      for (const k of allowed) { if (body_raw[k] !== undefined) update[k] = body_raw[k]; }
      const profile = await base44.asServiceRole.entities.UserProfile.update(resourceId, update);
      return Response.json({ ok: true, profile });
    }

    // ── GET /trades ────────────────────────────────────────────────────────
    if (resource === 'trades' && method === 'GET' && !resourceId) {
      try {
        const qProfileId = query.get('profile_id') || body_raw.profile_id || tokenProfileId;
        if (!canAccessProfile(qProfileId)) return err('FORBIDDEN', 'Access denied to this profile', 403);

        // Robustly parse _query object (may be plain object or JSON string from SDK)
        let inlineQ = {};
        if (body_raw._query) {
          if (typeof body_raw._query === 'object') inlineQ = body_raw._query;
          else if (typeof body_raw._query === 'string') {
            try { inlineQ = JSON.parse(body_raw._query); } catch {}
          }
        }

        // Status: check URL query > inline _query > body > default 'all', case-insensitive
        const rawStatus = (
          query.get('status') || inlineQ.status || body_raw.status || 'all'
        ).toLowerCase().trim();

        // Pagination (applied AFTER filtering, so we must fetch ALL first)
        const limitRaw = query.get('limit') ?? inlineQ.limit ?? body_raw.limit ?? 100;
        const offsetRaw = query.get('offset') ?? inlineQ.offset ?? body_raw.offset ?? 0;
        const limit = Math.min(parseInt(String(limitRaw), 10) || 100, 2000);
        const offset = parseInt(String(offsetRaw), 10) || 0;

        // Fetch ALL trades for profile in batches
        let allTrades = [];
        let batchSkip = 0;
        const BATCH = 1000;
        while (true) {
          const batch = await base44.asServiceRole.entities.Trade.filter(
            { profile_id: qProfileId }, '-date_open', BATCH, batchSkip
          );
          if (!batch || batch.length === 0) break;
          allTrades = allTrades.concat(batch);
          batchSkip += batch.length;
          if (batch.length < BATCH) break;
        }

        // Apply status filter BEFORE pagination
        let filtered = allTrades;
        if (rawStatus === 'open') {
          filtered = allTrades.filter(t => !t.close_price && !t.date_close);
        } else if (rawStatus === 'closed') {
          filtered = allTrades.filter(t => !!t.close_price || !!t.date_close);
        }

        const totalFiltered = filtered.length;
        const paginated = filtered.slice(offset, offset + limit);

        console.log(`[GET /trades] profile=${qProfileId} status=${rawStatus} all=${allTrades.length} filtered=${totalFiltered} returned=${paginated.length}`);

        return Response.json({ ok: true, total: totalFiltered, trades: paginated.map(safeTrade) });
      } catch (e) {
        console.error('[GET /trades]', e.message, e.stack);
        return Response.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e.message, handler: 'GET /trades' } }, { status: 500 });
      }
    }

    // ── POST /trades — create open trade ──────────────────────────────────
    if (resource === 'trades' && method === 'POST' && !resourceId) {
      if (scope === 'read') return err('FORBIDDEN', 'Write scope required', 403);

      const {
        profile_id: bodyProfileId, external_id, coin, direction, entry_price, position_size,
        stop_price, take_price, strategy_tag, timeframe, entry_reason, risk_usd,
        date_open, confidence_level, emotional_state, rule_compliance, plan_followed, screenshot_url,
      } = body_raw;

      const targetProfileId = bodyProfileId || tokenProfileId;
      if (!canAccessProfile(targetProfileId)) return err('FORBIDDEN', 'Access denied to this profile', 403);

      // Validate required fields
      if (!coin || !direction || entry_price == null || position_size == null) {
        return err('VALIDATION', 'Required: coin, direction, entry_price, position_size', 400);
      }
      if (!['Long', 'Short'].includes(direction)) {
        return err('VALIDATION', 'direction must be "Long" or "Short"', 400);
      }

      // Dedup by external_id
      if (external_id) {
        const existing = await base44.asServiceRole.entities.Trade.filter({ external_id, profile_id: targetProfileId });
        if (existing.length > 0) {
          return Response.json({ ok: true, trade: safeTrade(existing[0]), duplicate: true }, { status: 200 });
        }
      }

      const openDate = date_open ? new Date(date_open).toISOString() : new Date().toISOString();
      const trade = await base44.asServiceRole.entities.Trade.create({
        profile_id: targetProfileId,
        external_id: external_id || null,
        import_source: 'api_v2',
        coin,
        direction,
        entry_price: Number(entry_price),
        original_entry_price: Number(entry_price),
        position_size: Number(position_size),
        stop_price: stop_price != null ? Number(stop_price) : null,
        original_stop_price: stop_price != null ? Number(stop_price) : null,
        take_price: take_price != null ? Number(take_price) : null,
        risk_usd: risk_usd != null ? Number(risk_usd) : null,
        original_risk_usd: risk_usd != null ? Number(risk_usd) : null,
        strategy_tag: strategy_tag || null,
        timeframe: timeframe || null,
        entry_reason: entry_reason || null,
        confidence_level: confidence_level ?? 0,
        emotional_state: emotional_state ?? null,
        rule_compliance: rule_compliance ?? null,
        plan_followed: plan_followed ?? null,
        screenshot_url: screenshot_url || null,
        date_open: openDate,
        date: openDate,
        action_history: JSON.stringify([{ type: 'open', timestamp: openDate }]),
      });

      return Response.json({ ok: true, trade: safeTrade(trade) }, { status: 201 });
    }

    // ── PATCH /trades/:id — update SL/TP/BE/notes/actions ─────────────────
    if (resource === 'trades' && method === 'PATCH' && resourceId && !subAction) {
      if (scope === 'read') return err('FORBIDDEN', 'Write scope required', 403);

      // Load and verify ownership
      const existing = await base44.asServiceRole.entities.Trade.filter({ id: resourceId });
      const trade = existing[0];
      if (!trade) return err('NOT_FOUND', `Trade ${resourceId} not found`, 404);
      if (!canAccessProfile(trade.profile_id)) return err('FORBIDDEN', 'Access denied to this trade', 403);

      const {
        stop_price, take_price, entry_price, position_size, strategy_tag, timeframe,
        entry_reason, trade_analysis, ai_analysis, confidence_level, emotional_state,
        rule_compliance, plan_followed, screenshot_url, violation_tags, close_comment,
        action_type, action_note,
      } = body_raw;

      const update = {};
      if (stop_price != null)       update.stop_price = Number(stop_price);
      if (take_price != null)       update.take_price = Number(take_price);
      if (entry_price != null)      update.entry_price = Number(entry_price);
      if (position_size != null)    update.position_size = Number(position_size);
      if (strategy_tag !== undefined) update.strategy_tag = strategy_tag;
      if (timeframe !== undefined)  update.timeframe = timeframe;
      if (entry_reason !== undefined) update.entry_reason = entry_reason;
      if (trade_analysis !== undefined) update.trade_analysis = trade_analysis;
      if (ai_analysis !== undefined) update.ai_analysis = ai_analysis;
      if (confidence_level != null) update.confidence_level = Number(confidence_level);
      if (emotional_state != null)  update.emotional_state = Number(emotional_state);
      if (rule_compliance != null)  update.rule_compliance = Boolean(rule_compliance);
      if (plan_followed != null)    update.plan_followed = Boolean(plan_followed);
      if (screenshot_url !== undefined) update.screenshot_url = screenshot_url;
      if (violation_tags !== undefined) update.violation_tags = violation_tags;
      if (close_comment !== undefined) update.close_comment = close_comment;

      // Log action in action_history
      if (action_type) {
        update.action_history = appendAction(trade.action_history, {
          type: action_type,
          note: action_note || null,
          stop_price: stop_price || null,
          take_price: take_price || null,
        });
      } else if (Object.keys(update).length > 0) {
        // Auto-detect action type
        const autoType = stop_price != null ? 'sl_update' : take_price != null ? 'tp_update' : 'edit';
        update.action_history = appendAction(trade.action_history, { type: autoType });
      }

      const updated = await base44.asServiceRole.entities.Trade.update(resourceId, update);
      return Response.json({ ok: true, trade: safeTrade(updated) });
    }

    // ── POST /trades/:id/close ─────────────────────────────────────────────
    if (resource === 'trades' && method === 'POST' && resourceId && subAction === 'close') {
      if (scope === 'read') return err('FORBIDDEN', 'Write scope required', 403);

      const existing = await base44.asServiceRole.entities.Trade.filter({ id: resourceId });
      const trade = existing[0];
      if (!trade) return err('NOT_FOUND', `Trade ${resourceId} not found`, 404);
      if (!canAccessProfile(trade.profile_id)) return err('FORBIDDEN', 'Access denied to this trade', 403);
      if (trade.close_price || trade.date_close) return err('CONFLICT', 'Trade is already closed', 409);

      const {
        close_price, pnl_usd, pnl_percent_of_balance, r_multiple, realized_pnl_usd,
        date_close, trade_analysis, ai_analysis, close_comment, rule_compliance,
        plan_followed, emotional_state, violation_tags, partial_closes,
      } = body_raw;

      if (close_price == null) return err('VALIDATION', 'close_price is required', 400);

      const closeDate = date_close ? new Date(date_close).toISOString() : new Date().toISOString();

      // Compute r_multiple if not provided
      let rMult = r_multiple != null ? Number(r_multiple) : null;
      if (rMult == null && trade.original_risk_usd && trade.original_risk_usd > 0 && pnl_usd != null) {
        rMult = Math.round((Number(pnl_usd) / trade.original_risk_usd) * 100) / 100;
      }

      const actionHistory = appendAction(trade.action_history, {
        type: 'close',
        close_price: Number(close_price),
        pnl_usd: pnl_usd != null ? Number(pnl_usd) : null,
        r_multiple: rMult,
        note: close_comment || null,
      });

      const updated = await base44.asServiceRole.entities.Trade.update(resourceId, {
        close_price: Number(close_price),
        date_close: closeDate,
        pnl_usd: pnl_usd != null ? Number(pnl_usd) : null,
        realized_pnl_usd: realized_pnl_usd != null ? Number(realized_pnl_usd) : (pnl_usd != null ? Number(pnl_usd) : null),
        pnl_percent_of_balance: pnl_percent_of_balance != null ? Number(pnl_percent_of_balance) : null,
        r_multiple: rMult,
        trade_analysis: trade_analysis || trade.trade_analysis || null,
        ai_analysis: ai_analysis || trade.ai_analysis || null,
        close_comment: close_comment || null,
        rule_compliance: rule_compliance != null ? Boolean(rule_compliance) : trade.rule_compliance,
        plan_followed: plan_followed != null ? Boolean(plan_followed) : trade.plan_followed,
        emotional_state: emotional_state != null ? Number(emotional_state) : trade.emotional_state,
        violation_tags: violation_tags || trade.violation_tags || null,
        partial_closes: partial_closes ? JSON.stringify(partial_closes) : trade.partial_closes,
        action_history: actionHistory,
      });

      return Response.json({ ok: true, trade: safeTrade(updated) });
    }

    // ── DELETE /trades/:id ────────────────────────────────────────────────
    if (resource === 'trades' && method === 'DELETE' && resourceId && !subAction) {
      if (scope === 'read') return err('FORBIDDEN', 'Write scope required', 403);
      const existing = await base44.asServiceRole.entities.Trade.filter({ id: resourceId });
      const trade = existing[0];
      if (!trade) return err('NOT_FOUND', `Trade ${resourceId} not found`, 404);
      if (!canAccessProfile(trade.profile_id)) return err('FORBIDDEN', 'Access denied to this trade', 403);
      await base44.asServiceRole.entities.Trade.delete(resourceId);
      return Response.json({ ok: true, deleted_id: resourceId });
    }

    // ── POST /maintenance/prune-phase ─────────────────────────────────────
    if (resource === 'maintenance' && resourceId === 'prune-phase' && method === 'POST') {
      if (scope === 'read') return err('FORBIDDEN', 'Write scope required', 403);
      const {
        start_at,
        dry_run = false,
        keep_open = false,
        keep_external_prefixes = [],
      } = body_raw;

      if (!start_at) return err('VALIDATION', 'start_at (ISO8601) is required', 400);
      const cutoff = new Date(start_at);
      if (isNaN(cutoff.getTime())) return err('VALIDATION', 'start_at is not a valid ISO8601 date', 400);

      // Load all trades for this profile (up to 2000)
      const all = await base44.asServiceRole.entities.Trade.filter({ profile_id: tokenProfileId }, '-date_open', 2000);

      const candidates = all.filter(t => {
        const openDate = new Date(t.date_open || t.date || 0);
        return openDate < cutoff;
      });

      const toDelete = [];
      const kept = [];

      for (const t of candidates) {
        const isOpen = !t.close_price && !t.date_close;
        if (keep_open && isOpen) { kept.push({ id: t.id, reason: 'keep_open' }); continue; }

        const extId = t.external_id || '';
        const prefixMatch = keep_external_prefixes.length > 0 && keep_external_prefixes.some(p => extId.startsWith(p));
        if (prefixMatch) { kept.push({ id: t.id, reason: 'keep_prefix', external_id: extId }); continue; }

        toDelete.push(t);
      }

      if (!dry_run) {
        // Delete in sequence (SDK doesn't support bulk delete)
        for (const t of toDelete) {
          await base44.asServiceRole.entities.Trade.delete(t.id);
        }
      }

      return Response.json({
        ok: true,
        dry_run: !!dry_run,
        profile_id: tokenProfileId,
        cutoff: cutoff.toISOString(),
        found: candidates.length,
        deleted: dry_run ? 0 : toDelete.length,
        would_delete: dry_run ? toDelete.length : undefined,
        kept: kept.length,
        sample_deleted_ids: toDelete.slice(0, 10).map(t => t.id),
        kept_details: kept.slice(0, 10),
      });
    }

    // ── GET /stats?profile_id= ─────────────────────────────────────────────
    if (resource === 'stats' && method === 'GET') {
      try {
        const qProfileId = query.get('profile_id') || body_raw.profile_id || tokenProfileId;
        if (!canAccessProfile(qProfileId)) return err('FORBIDDEN', 'Access denied to this profile', 403);

        const all = await base44.asServiceRole.entities.Trade.filter({ profile_id: qProfileId }, '-date_open', 1000);
        const closed = all.filter(t => !!t.close_price || !!t.date_close);
        const open = all.filter(t => !t.close_price && !t.date_close);

        const totalPnl = closed.reduce((s, t) => s + (t.pnl_usd || 0), 0);
        const wins = closed.filter(t => (t.pnl_usd || 0) > 0);
        const losses = closed.filter(t => (t.pnl_usd || 0) < 0);
        const totalR = closed.reduce((s, t) => s + (t.r_multiple || 0), 0);
        const avgR = closed.length > 0 ? totalR / closed.length : 0;
        const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + (t.pnl_usd || 0), 0) / wins.length : 0;
        const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + (t.pnl_usd || 0), 0) / losses.length : 0;
        const totalWinPnl = wins.reduce((s, t) => s + (t.pnl_usd || 0), 0);
        const totalLossPnl = losses.reduce((s, t) => s + (t.pnl_usd || 0), 0);
        const profitFactor = losses.length > 0 && Math.abs(totalLossPnl) > 0
          ? Math.abs(totalWinPnl / totalLossPnl)
          : null;

        const risk = await computeRiskMetrics(base44, qProfileId);

        return Response.json({
          ok: true,
          profile_id: qProfileId,
          trades: {
            total_closed: closed.length,
            total_open: open.length,
            total_pnl_usd: Math.round(totalPnl * 100) / 100,
            winrate_percent: closed.length > 0 ? Math.round((wins.length / closed.length) * 100) : 0,
            avg_r: Math.round(avgR * 100) / 100,
            avg_win_usd: Math.round(avgWin * 100) / 100,
            avg_loss_usd: Math.round(avgLoss * 100) / 100,
            profit_factor: profitFactor != null ? Math.round(profitFactor * 100) / 100 : null,
          },
          risk,
        });
      } catch (e) {
        console.error('[GET /stats]', e.message, e.stack);
        return Response.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e.message, handler: 'GET /stats' } }, { status: 500 });
      }
    }

    // ── POST /connections/test ─────────────────────────────────────────────
    if (resource === 'connections' && resourceId === 'test' && method === 'POST') {
      const { api_key, api_secret, exchange, mode } = body_raw;
      if (!api_key || !api_secret) return err('VALIDATION', 'api_key and api_secret required', 400);

      const baseUrl = mode === 'real' ? 'https://api.bybit.com' : 'https://api-demo.bybit.com';
      const relayUrl = 'https://pencil-vcr-genesis-wall.trycloudflare.com/proxy';
      const relaySecret = '02f48c0e5d4b0186b5aa523a9a2cdbebc7b6d5a2e9cb8d96';

      if (!relaySecret) return err('CONFIG', 'Relay secret not configured', 500);

      const params = { accountType: 'UNIFIED' };
      const headers = await buildBybitHeaders(api_key, api_secret, params);
      const data = await relayCall(relayUrl, relaySecret, `${baseUrl}/v5/account/wallet-balance`, 'GET', headers, params);

      if (data.retCode !== 0) {
        return Response.json({ ok: false, message: data.retMsg || 'Auth failed', retCode: data.retCode });
      }

      let balance = null;
      const acct = data?.result?.list?.[0];
      if (acct?.coin) {
        const usdt = acct.coin.find(c => c.coin === 'USDT');
        balance = usdt ? parseFloat(usdt.walletBalance) : parseFloat(acct.totalWalletBalance || 0);
      } else if (acct?.totalWalletBalance) {
        balance = parseFloat(acct.totalWalletBalance);
      }

      return Response.json({ ok: true, mode: mode || 'demo', balance, message: `Connected. Balance: ${balance != null ? balance.toFixed(2) + ' USDT' : 'N/A'}` });
    }

    // ── POST /connections/sync ─────────────────────────────────────────────
    if (resource === 'connections' && resourceId === 'sync' && method === 'POST') {
      if (scope === 'read') return err('FORBIDDEN', 'Write scope required', 403);
      const { connection_id } = body_raw;
      if (!connection_id) return err('VALIDATION', 'connection_id required', 400);

      // Delegate to syncExchangeConnection function
      const syncRes = await base44.functions.invoke('syncExchangeConnection', { connection_id });
      return Response.json({ ok: true, ...syncRes.data });
    }

    // ── 404 ────────────────────────────────────────────────────────────────
    return Response.json({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Endpoint not found' },
      endpoints: [
        'GET  /health',
        'GET  /profiles',
        'POST /profiles',
        'PATCH /profiles/:id',
        'GET  /trades?profile_id=&status=open|closed&limit=&offset=',
        'POST /trades',
        'PATCH /trades/:id',
        'POST /trades/:id/close',
        'GET  /stats?profile_id=',
        'DELETE /trades/:id',
        'POST /maintenance/prune-phase',
        'POST /connections/test',
        'POST /connections/sync',
      ],
    }, { status: 404 });

  } catch (error) {
    console.error('[tradingApiV2]', error.message);
    return Response.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
});