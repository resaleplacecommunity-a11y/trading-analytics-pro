import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── CENTRALIZED CONFIG ─────────────────────────────────────────────────────────

function getRelayConfig() {
  const relayUrl = (
    Deno.env.get('BYBIT_PROXY_URL') || 
    Deno.env.get('BYBIT_BRIDGE_URL') || 
    ''
  ).replace(/\/+$/, '');

  const relaySecret = Deno.env.get('BYBIT_PROXY_SECRET') || '';

  if (relayUrl.includes('trycloudflare.com') || relayUrl.includes('loca.lt') || relayUrl.includes('ngrok.io')) {
    throw new Error('CONFIG_ERROR: Temporary tunnel URL detected');
  }

  if (!relayUrl || !relaySecret) {
    throw new Error('CONFIG_ERROR: BYBIT_PROXY_URL or BYBIT_PROXY_SECRET not configured');
  }

  return { relayUrl: relayUrl + '/proxy', relaySecret, timeout: 20000 };
}

// ── Crypto helpers ─────────────────────────────────────────────────────────────

async function getKey() {
  const secret = Deno.env.get('BASE44_APP_ID') || 'default-secret-key-32-chars-padded';
  return crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
  );
}

async function encryptValue(plaintext) {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
  const combined = new Uint8Array(iv.byteLength + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

async function decryptValue(ciphertext) {
  const key = await getKey();
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: combined.slice(0, 12) }, key, combined.slice(12));
  return new TextDecoder().decode(decrypted);
}

// ── Bybit signing ──────────────────────────────────────────────────────────────

async function signBybit(apiKey, apiSecret, timestamp, recvWindow, params) {
  const queryString = typeof params === 'string'
    ? params
    : Object.entries(params).sort().map(([k, v]) => `${k}=${v}`).join('&');
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}${apiKey}${recvWindow}${queryString}`));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function buildBybitHeaders(apiKey, apiSecret, params) {
  const timestamp = Date.now().toString();
  const recvWindow = '5000';
  const signature = await signBybit(apiKey, apiSecret, timestamp, recvWindow, params);
  return { 'X-BAPI-API-KEY': apiKey, 'X-BAPI-TIMESTAMP': timestamp, 'X-BAPI-RECV-WINDOW': recvWindow, 'X-BAPI-SIGN': signature };
}

// ── Exchange domain allowlist ──────────────────────────────────────────────────

const ALLOWED_EXCHANGE_DOMAINS = [
  'api.bybit.com', 'api-demo.bybit.com',
  'api.binance.com', 'fapi.binance.com', 'testnet.binancefuture.com',
  'www.okx.com', 'aws.okx.com',
  'api.bitget.com',
  'api.kucoin.com', 'api-futures.kucoin.com',
  'api.gateio.ws', 'api.mexc.com', 'open-api.bingx.com',
];

// ── Relay call ─────────────────────────────────────────────────────────────────

async function relayCall(targetUrl, method, signedHeaders, params) {
  const hostname = new URL(targetUrl).hostname;
  if (!ALLOWED_EXCHANGE_DOMAINS.includes(hostname)) {
    throw new Error(`CONFIG_ERROR: Exchange domain not in allowlist: ${hostname}`);
  }

  const { relayUrl, relaySecret, timeout } = getRelayConfig();

  let finalUrl = targetUrl;
  let bodyPayload;
  if (method === 'GET' && params && Object.keys(params).length > 0) {
    finalUrl += (targetUrl.includes('?') ? '&' : '?') +
      new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))).toString();
  } else if (method !== 'GET' && params) {
    bodyPayload = params;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(relayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-relay-secret': relaySecret },
      body: JSON.stringify({ url: finalUrl, method, headers: signedHeaders || {}, body: bodyPayload }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`RELAY_ERROR: ${res.status} ${txt}`);
    }
    return res.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') throw new Error('TIMEOUT: Relay request timed out');
    throw error;
  }
}

// ── Auth helpers (same dual-auth pattern as tradingApiV2) ─────────────────────

async function sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Returns { email, profileId, scope, profiles? } or null if unauthorized.
 * OPTIMIZED: Uses targeted query instead of loading all 200 tokens
 */
async function resolveAuth(base44, authHeader) {
  const rawToken = (authHeader || '').replace(/^Bearer\s+/i, '').trim();

  if (rawToken.startsWith('tpro_')) {
    const hash = await sha256hex(rawToken);
    const byHash = await base44.asServiceRole.entities.BotApiToken.filter({ token_hash: hash, is_active: true }, '-created_date', 1);
    let matched = byHash[0] || null;
    if (!matched) {
      const byPlaintext = await base44.asServiceRole.entities.BotApiToken.filter({ token: rawToken, is_active: true }, '-created_date', 1);
      matched = byPlaintext[0] || null;
    }
    if (!matched) return null;
    if (matched.expires_at && new Date(matched.expires_at) < new Date()) return null;
    base44.asServiceRole.entities.BotApiToken.update(matched.id, { last_used_at: new Date().toISOString() }).catch(() => {});
    return { email: matched.created_by, profileId: matched.profile_id, scope: matched.scope || 'write' };
  }

  const sessionUser = await base44.auth.me().catch(() => null);
  if (!sessionUser) return null;
  const profiles = await base44.asServiceRole.entities.UserProfile.filter({ created_by: sessionUser.email });
  const active = profiles.find(p => p.is_active) || profiles[0];
  return { email: sessionUser.email, profileId: active?.id || null, scope: 'write', profiles };
}

// ── Request normalizer (ported from tradingApiV2) ──────────────────────────────

async function normalizeRequest(req) {
  let httpUrl;
  try { httpUrl = new URL(req.url); } catch { httpUrl = new URL('http://localhost/'); }

  let raw = {};
  try {
    const ct = req.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      raw = await req.json();
    } else {
      const text = await req.text();
      if (text && text.trim().startsWith('{')) raw = JSON.parse(text);
    }
  } catch {}

  const method = ((raw._method ?? raw.method ?? raw.httpMethod ?? null) || req.method).toUpperCase();

  let rawPath = raw._path ?? raw.path ?? raw.route ?? raw.endpoint ?? '';
  if (rawPath.startsWith('http')) {
    try { rawPath = new URL(rawPath).pathname; } catch {}
  }
  if (!rawPath) {
    const parts = httpUrl.pathname.split('/').filter(Boolean);
    const fnIdx = parts.findIndex(p => p === 'exchangeConnectionsApi');
    rawPath = fnIdx >= 0 ? '/' + parts.slice(fnIdx + 1).join('/') : '/' + parts.join('/');
  }

  const pathOnly = rawPath.split('?')[0];
  const normalizedPath = '/' + pathOnly.replace(/^\/+/, '').replace(/\/+$/, '');
  const segments = normalizedPath.split('/').filter(Boolean);

  const authHeader = req.headers.get('authorization') ||
    (raw._auth ? `Bearer ${raw._auth.replace(/^Bearer\s+/i, '')}` : '') || '';

  const body = { ...raw };
  for (const k of ['_method', '_path', '_auth', 'method', 'httpMethod', 'path', 'route', 'endpoint']) delete body[k];

  const query = new URLSearchParams(httpUrl.search);
  return { method, resource: segments[0] || '', resourceId: segments[1] || null, query, body, authHeader };
}

// ── Test credentials ───────────────────────────────────────────────────────────

async function testBybitCredentials(apiKey, apiSecret, baseUrl) {
  const params = { accountType: 'UNIFIED' };
  const headers = await buildBybitHeaders(apiKey, apiSecret, params);
  const data = await relayCall(`${baseUrl}/v5/account/wallet-balance`, 'GET', headers, params);
  if (data.retCode !== 0) return { ok: false, message: data.retMsg || 'Auth failed', retCode: data.retCode };

  let balance = null;
  const acct = data?.result?.list?.[0];
  if (acct?.coin) {
    const usdt = acct.coin.find(c => c.coin === 'USDT');
    balance = usdt ? parseFloat(usdt.walletBalance) : parseFloat(acct.totalWalletBalance || 0);
  } else if (acct?.totalWalletBalance) {
    balance = parseFloat(acct.totalWalletBalance);
  }
  return { ok: true, mode: baseUrl.includes('demo') ? 'demo' : 'real', balance, message: `Connected. Balance: ${balance != null ? balance.toFixed(2) + ' USDT' : 'N/A'}` };
}

// ── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { method, resource, resourceId, query, body, authHeader } = await normalizeRequest(req);

    // Auth required for all endpoints
    const auth = await resolveAuth(base44, authHeader);
    if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Helper to get user profiles
    const getUserProfiles = async () => {
      return auth.profiles || await base44.asServiceRole.entities.UserProfile.filter({ created_by: auth.email });
    };

    // ── POST /connections/test ──────────────────────────────────────────────
    if (method === 'POST' && resource === 'connections' && resourceId === 'test') {
      const { api_key, api_secret, mode } = body;
      if (!api_key || !api_secret) return Response.json({ ok: false, error: 'api_key and api_secret required' }, { status: 400 });
      const baseUrl = mode === 'real' ? 'https://api.bybit.com' : 'https://api-demo.bybit.com';
      const result = await testBybitCredentials(api_key, api_secret, baseUrl);
      return Response.json(result);
    }

    // ── POST /connections — create ─────────────────────────────────────────
    if (method === 'POST' && resource === 'connections' && !resourceId) {
      const { profile_id: bodyProfileId, name, exchange, mode, api_key, api_secret, import_history = true, history_limit = 500 } = body;
      if (!name || !api_key || !api_secret) return Response.json({ error: 'name, api_key, api_secret required' }, { status: 400 });

      const profiles = await getUserProfiles();
      if (!profiles.length) return Response.json({ error: 'No profiles found' }, { status: 404 });

      let profile_id = bodyProfileId;
      if (!profile_id) {
        profile_id = (profiles.find(p => p.is_active) || profiles[0]).id;
      } else if (!profiles.find(p => p.id === profile_id)) {
        return Response.json({ error: 'Profile not found or access denied' }, { status: 403 });
      }

      const baseUrl = (mode === 'real') ? 'https://api.bybit.com' : 'https://api-demo.bybit.com';
      const nowMs = Date.now();
      const importHistory = import_history !== false;
      const conn = await base44.asServiceRole.entities.ExchangeConnection.create({
        profile_id,
        name,
        exchange: exchange || 'bybit',
        mode: mode || 'demo',
        api_key_enc: await encryptValue(api_key),
        api_secret_enc: await encryptValue(api_secret),
        base_url: baseUrl,
        relay_url: getRelayConfig().relayUrl,
        is_active: true,
        last_status: 'ok',
        created_by: auth.email,
        import_history: importHistory,
        history_limit: Math.max(100, Math.min(1000, Number(history_limit || 500))),
        connected_at_ms: nowMs,
        initial_sync_done: false,
        sync_cursor_ms: importHistory ? 0 : nowMs,
      });

      return Response.json({ ok: true, connection: { id: conn.id, name: conn.name, exchange: conn.exchange, mode: conn.mode, is_active: conn.is_active, last_status: conn.last_status, import_history: conn.import_history, history_limit: conn.history_limit } });
    }

    // ── GET /connections?profile_id= ───────────────────────────────────────
    if (resource === 'connections' && !resourceId && (method === 'GET' || (method === 'POST' && body.profile_id && !body.api_key && !body.name))) {
      const profileId = query.get('profile_id') || body.profile_id || auth.profileId;
      if (!profileId) return Response.json({ error: 'profile_id required' }, { status: 400 });

      const profiles = await getUserProfiles();
      if (!profiles.find(p => p.id === profileId)) return Response.json({ error: 'Profile not found or access denied' }, { status: 403 });

      const connections = await base44.asServiceRole.entities.ExchangeConnection.filter({ profile_id: profileId });
      return Response.json({
        connections: connections.map(c => ({
          id: c.id, name: c.name, exchange: c.exchange, mode: c.mode, base_url: c.base_url,
          is_active: c.is_active, last_status: c.last_status, last_error: c.last_error,
          last_sync_at: c.last_sync_at, created_date: c.created_date,
          import_history: c.import_history, history_limit: c.history_limit,
          connected_at_ms: c.connected_at_ms, current_balance: c.current_balance,
        }))
      });
    }

    // ── PATCH /connections/:id ─────────────────────────────────────────────
    if (method === 'PATCH' && resource === 'connections' && resourceId) {
      const allowed = ['is_active', 'name', 'mode', 'base_url'];
      const update = {};
      for (const k of allowed) { if (body[k] !== undefined) update[k] = body[k]; }
      if (body.mode) update.base_url = body.mode === 'real' ? 'https://api.bybit.com' : 'https://api-demo.bybit.com';
      const conn = await base44.asServiceRole.entities.ExchangeConnection.update(resourceId, update);
      return Response.json({ ok: true, connection: { id: conn.id, name: conn.name, is_active: conn.is_active, mode: conn.mode } });
    }

    // ── DELETE /connections/:id ────────────────────────────────────────────
    if (method === 'DELETE' && resource === 'connections' && resourceId) {
      await base44.asServiceRole.entities.ExchangeConnection.delete(resourceId);
      return Response.json({ ok: true });
    }

    return Response.json({
      error: 'Not found',
      endpoints: ['POST /connections/test', 'POST /connections', 'GET /connections?profile_id=', 'PATCH /connections/:id', 'DELETE /connections/:id']
    }, { status: 404 });

  } catch (error) {
    console.error('[exchangeConnectionsApi]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});