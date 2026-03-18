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

  const finalRelayUrl = relayUrl.endsWith('/proxy') ? relayUrl : relayUrl + '/proxy';
  return { relayUrl: finalRelayUrl, relaySecret, timeout: 20000 };
}

// ── Crypto helpers ─────────────────────────────────────────────────────────────

async function getKey() {
  const secret = Deno.env.get('BASE44_APP_ID') || 'default-secret-key-32-chars-padded';
  return crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
  );
}

async function encryptValue(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
  const combined = new Uint8Array(iv.byteLength + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

async function decryptValue(ciphertext: string): Promise<string> {
  const key = await getKey();
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: combined.slice(0, 12) }, key, combined.slice(12));
  return new TextDecoder().decode(decrypted);
}

// ── HMAC helpers ───────────────────────────────────────────────────────────────

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacBase64(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

// ── Exchange domain allowlist ──────────────────────────────────────────────────

const ALLOWED_EXCHANGE_DOMAINS = [
  'api.bybit.com', 'api-demo.bybit.com',
  'api.binance.com', 'fapi.binance.com', 'testnet.binancefuture.com',
  'www.okx.com', 'aws.okx.com',
  'api.bitget.com',
  'api.kucoin.com', 'api-futures.kucoin.com',
  'api.gateio.ws',
  'api.mexc.com', 'contract.mexc.com',
  'open-api.bingx.com',
];

// ── Base URLs per exchange+mode ────────────────────────────────────────────────

function getBaseUrl(exchange: string, mode: string): string {
  switch (exchange) {
    case 'bybit':   return mode === 'real' ? 'https://api.bybit.com' : 'https://api-demo.bybit.com';
    case 'binance': return mode === 'real' ? 'https://fapi.binance.com' : 'https://testnet.binancefuture.com';
    case 'bingx':   return 'https://open-api.bingx.com'; // real only
    case 'okx':     return 'https://www.okx.com'; // same host, demo via header
    case 'mexc':    return 'https://api.mexc.com'; // real only (spot v3)
    case 'bitget':  return 'https://api.bitget.com'; // same host, demo via productType
    default:        return 'https://api.bybit.com';
  }
}

// ── Relay call ─────────────────────────────────────────────────────────────────

async function relayCall(targetUrl: string, method: string, signedHeaders: Record<string, string>, params?: Record<string, unknown>) {
  const hostname = new URL(targetUrl).hostname;
  if (!ALLOWED_EXCHANGE_DOMAINS.includes(hostname)) {
    throw new Error(`CONFIG_ERROR: Exchange domain not in allowlist: ${hostname}`);
  }

  const { relayUrl, relaySecret, timeout } = getRelayConfig();

  let finalUrl = targetUrl;
  let bodyPayload: unknown = undefined;
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

// ── Auth helpers ───────────────────────────────────────────────────────────────

async function sha256hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function resolveAuth(base44: unknown, authHeader: string) {
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

// ── Request normalizer ─────────────────────────────────────────────────────────

async function normalizeRequest(req: Request) {
  let httpUrl: URL;
  try { httpUrl = new URL(req.url); } catch { httpUrl = new URL('http://localhost/'); }

  let raw: Record<string, unknown> = {};
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

  let rawPath = (raw._path ?? raw.path ?? raw.route ?? raw.endpoint ?? '') as string;
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
    (raw._auth ? `Bearer ${(raw._auth as string).replace(/^Bearer\s+/i, '')}` : '') || '';

  const body = { ...raw };
  for (const k of ['_method', '_path', '_auth', 'method', 'httpMethod', 'path', 'route', 'endpoint']) delete body[k];

  const query = new URLSearchParams(httpUrl.search);
  return { method, resource: segments[0] || '', resourceId: segments[1] || null, query, body, authHeader };
}

// ══════════════════════════════════════════════════════════════════════════════
// ── PER-EXCHANGE: Signing helpers ─────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// ── Bybit ──────────────────────────────────────────────────────────────────────

async function buildBybitHeaders(apiKey: string, apiSecret: string, params: Record<string, unknown>) {
  const timestamp = Date.now().toString();
  const recvWindow = '5000';
  const queryString = Object.entries(params).sort().map(([k, v]) => `${k}=${v}`).join('&');
  const preHash = `${timestamp}${apiKey}${recvWindow}${queryString}`;
  const signature = await hmacHex(apiSecret, preHash);
  return {
    'X-BAPI-API-KEY': apiKey,
    'X-BAPI-TIMESTAMP': timestamp,
    'X-BAPI-RECV-WINDOW': recvWindow,
    'X-BAPI-SIGN': signature,
  };
}

// ── Binance / MEXC (Binance-compatible) ───────────────────────────────────────

async function buildBinanceLikeParams(apiKey: string, apiSecret: string, params: Record<string, unknown>) {
  const timestamp = Date.now().toString();
  const recvWindow = '5000';
  const allParams: Record<string, unknown> = { ...params, timestamp, recvWindow };
  const queryString = new URLSearchParams(
    Object.fromEntries(Object.entries(allParams).map(([k, v]) => [k, String(v)]))
  ).toString();
  const signature = await hmacHex(apiSecret, queryString);
  return {
    queryParams: { ...allParams, signature },
    headers: { 'X-MBX-APIKEY': apiKey },
  };
}

async function buildMEXCParams(apiKey: string, apiSecret: string, params: Record<string, unknown>) {
  const timestamp = Date.now().toString();
  const recvWindow = '5000';
  const allParams: Record<string, unknown> = { ...params, timestamp, recvWindow };
  const queryString = new URLSearchParams(
    Object.fromEntries(Object.entries(allParams).map(([k, v]) => [k, String(v)]))
  ).toString();
  const signature = await hmacHex(apiSecret, queryString);
  return {
    queryParams: { ...allParams, signature },
    headers: { 'X-MEXC-APIKEY': apiKey },
  };
}

// ── BingX ──────────────────────────────────────────────────────────────────────

async function buildBingXParams(apiKey: string, apiSecret: string, params: Record<string, unknown> = {}) {
  const timestamp = Date.now().toString();
  const allParams: Record<string, unknown> = { ...params, timestamp };
  // Sort keys alphabetically and build query string
  const queryString = Object.keys(allParams).sort()
    .map(k => `${k}=${allParams[k]}`).join('&');
  const signature = await hmacHex(apiSecret, queryString);
  return {
    queryParams: { ...allParams, signature },
    headers: { 'X-BX-APIKEY': apiKey },
  };
}

// ── OKX ────────────────────────────────────────────────────────────────────────

async function buildOKXHeaders(apiKey: string, apiSecret: string, passphrase: string, method: string, path: string, body: string = '', isDemo: boolean = false) {
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z');
  const preHash = `${timestamp}${method.toUpperCase()}${path}${body}`;
  const signature = await hmacBase64(apiSecret, preHash);
  const headers: Record<string, string> = {
    'OK-ACCESS-KEY': apiKey,
    'OK-ACCESS-SIGN': signature,
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': passphrase,
    'Content-Type': 'application/json',
  };
  if (isDemo) headers['x-simulated-trading'] = '1';
  return headers;
}

// ── Bitget ─────────────────────────────────────────────────────────────────────
// Prehash: timestamp + method + path + "?" + queryString  (for GET with query)

async function buildBitgetHeaders(apiKey: string, apiSecret: string, passphrase: string, method: string, path: string, queryString: string = '', body: string = '') {
  const timestamp = Date.now().toString();
  // For GET: prehash includes ?queryString if present
  const pathWithQuery = queryString ? `${path}?${queryString}` : path;
  const preHash = `${timestamp}${method.toUpperCase()}${pathWithQuery}${body}`;
  const signature = await hmacBase64(apiSecret, preHash);
  return {
    'ACCESS-KEY': apiKey,
    'ACCESS-SIGN': signature,
    'ACCESS-TIMESTAMP': timestamp,
    'ACCESS-PASSPHRASE': passphrase,
    'Content-Type': 'application/json',
    'locale': 'en-US',
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ── PER-EXCHANGE: Test credentials ────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

async function testBybitCredentials(apiKey: string, apiSecret: string, baseUrl: string) {
  const params = { accountType: 'UNIFIED' };
  const headers = await buildBybitHeaders(apiKey, apiSecret, params);
  const data = await relayCall(`${baseUrl}/v5/account/wallet-balance`, 'GET', headers, params);
  if (data.retCode !== 0) return { ok: false, message: data.retMsg || 'Auth failed', retCode: data.retCode };

  let balance: number | null = null;
  const acct = data?.result?.list?.[0];
  if (acct?.coin) {
    const usdt = acct.coin.find((c: Record<string, unknown>) => c.coin === 'USDT');
    balance = usdt ? parseFloat(usdt.walletBalance as string) : parseFloat(acct.totalWalletBalance || 0);
  } else if (acct?.totalWalletBalance) {
    balance = parseFloat(acct.totalWalletBalance);
  }
  return { ok: true, mode: baseUrl.includes('demo') ? 'demo' : 'real', balance, message: `Connected. Balance: ${balance != null ? balance.toFixed(2) + ' USDT' : 'N/A'}` };
}

async function testBinanceCredentials(apiKey: string, apiSecret: string, baseUrl: string) {
  const { queryParams, headers } = await buildBinanceLikeParams(apiKey, apiSecret, {});
  // Use /fapi/v2/balance — lighter than /account
  const data = await relayCall(`${baseUrl}/fapi/v2/balance`, 'GET', headers, queryParams);

  if (Array.isArray(data)) {
    // Success: array of asset balances
    const usdt = data.find((a: Record<string, unknown>) => a.asset === 'USDT');
    const balance = usdt ? parseFloat(usdt.balance as string) : null;
    return { ok: true, mode: baseUrl.includes('testnet') ? 'demo' : 'real', balance, message: `Connected. Balance: ${balance != null ? balance.toFixed(2) + ' USDT' : 'N/A'}` };
  }
  if (data?.code) {
    return { ok: false, message: data.msg || `Error ${data.code}`, code: data.code };
  }
  return { ok: false, message: 'Unexpected response' };
}

async function testBingXCredentials(apiKey: string, apiSecret: string) {
  const { queryParams, headers } = await buildBingXParams(apiKey, apiSecret, {});
  const data = await relayCall(`https://open-api.bingx.com/openApi/swap/v2/user/balance`, 'GET', headers, queryParams);

  if (data?.code === 0 && data?.data) {
    const balance = parseFloat(data.data?.balance?.balance ?? data.data?.availableMargin ?? 0);
    return { ok: true, mode: 'real', balance, message: `Connected. Balance: ${balance.toFixed(2)} USDT` };
  }
  return { ok: false, message: data?.msg || `Error ${data?.code}`, code: data?.code };
}

async function testOKXCredentials(apiKey: string, apiSecret: string, passphrase: string, isDemo: boolean) {
  const path = '/api/v5/account/balance';
  const headers = await buildOKXHeaders(apiKey, apiSecret, passphrase, 'GET', path, '', isDemo);
  const data = await relayCall(`https://www.okx.com${path}`, 'GET', headers, {});

  if (data?.code === '0' && data?.data?.length > 0) {
    const details = data.data[0]?.details || [];
    const usdt = details.find((d: Record<string, unknown>) => d.ccy === 'USDT');
    const balance = usdt ? parseFloat(usdt.eq as string) : null;
    return { ok: true, mode: isDemo ? 'demo' : 'real', balance, message: `Connected. Balance: ${balance != null ? balance.toFixed(2) + ' USDT' : 'N/A'}` };
  }
  return { ok: false, message: data?.msg || `Error ${data?.code}`, code: data?.code };
}

async function testMEXCCredentials(apiKey: string, apiSecret: string) {
  const { queryParams, headers } = await buildMEXCParams(apiKey, apiSecret, {});
  // MEXC spot v3 - futures via contract.mexc.com has different auth
  const data = await relayCall(`https://api.mexc.com/api/v3/account`, 'GET', headers, queryParams);

  if (data?.balances) {
    // Spot account - find USDT
    const usdt = data.balances.find((b: Record<string, unknown>) => b.asset === 'USDT');
    const balance = usdt ? parseFloat(usdt.free as string) : null;
    return { ok: true, mode: 'real', balance, message: `Connected. Balance: ${balance != null ? balance.toFixed(2) + ' USDT' : 'N/A'}` };
  }
  if (data?.code) {
    return { ok: false, message: data.msg || `Error ${data.code}`, code: data.code };
  }
  return { ok: false, message: 'Unexpected response' };
}

async function testBitgetCredentials(apiKey: string, apiSecret: string, passphrase: string) {
  const path = '/api/v2/mix/account/accounts';
  const queryString = 'productType=USDT-FUTURES';
  const headers = await buildBitgetHeaders(apiKey, apiSecret, passphrase, 'GET', path, queryString);
  const data = await relayCall(`https://api.bitget.com${path}?${queryString}`, 'GET', headers, {});

  if (data?.code === '00000' && data?.data) {
    const accounts = Array.isArray(data.data) ? data.data : [];
    const usdt = accounts.find((a: Record<string, unknown>) => a.marginCoin === 'USDT') || accounts[0];
    const balance = usdt ? parseFloat(usdt.available as string ?? usdt.equity as string ?? 0) : null;
    return { ok: true, mode: 'real', balance, message: `Connected. Balance: ${balance != null ? balance.toFixed(2) + ' USDT' : 'N/A'}` };
  }
  return { ok: false, message: data?.msg || `Error ${data?.code}`, code: data?.code };
}

// ── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { method, resource, resourceId, query, body, authHeader } = await normalizeRequest(req);

    const auth = await resolveAuth(base44, authHeader);
    if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const getUserProfiles = async () => {
      return auth.profiles || await base44.asServiceRole.entities.UserProfile.filter({ created_by: auth.email });
    };

    // ── POST /connections/test ──────────────────────────────────────────────
    if (method === 'POST' && resource === 'connections' && resourceId === 'test') {
      const { api_key, api_secret, api_passphrase, mode, exchange = 'bybit' } = body as Record<string, string>;
      if (!api_key || !api_secret) return Response.json({ ok: false, error: 'api_key and api_secret required' }, { status: 400 });

      let result: Record<string, unknown>;
      switch (exchange) {
        case 'bybit': {
          const baseUrl = mode === 'real' ? 'https://api.bybit.com' : 'https://api-demo.bybit.com';
          result = await testBybitCredentials(api_key, api_secret, baseUrl);
          break;
        }
        case 'binance': {
          const baseUrl = mode === 'real' ? 'https://fapi.binance.com' : 'https://testnet.binancefuture.com';
          result = await testBinanceCredentials(api_key, api_secret, baseUrl);
          break;
        }
        case 'bingx': {
          result = await testBingXCredentials(api_key, api_secret);
          break;
        }
        case 'okx': {
          if (!api_passphrase) return Response.json({ ok: false, error: 'OKX requires passphrase' }, { status: 400 });
          result = await testOKXCredentials(api_key, api_secret, api_passphrase, mode !== 'real');
          break;
        }
        case 'mexc': {
          result = await testMEXCCredentials(api_key, api_secret);
          break;
        }
        case 'bitget': {
          if (!api_passphrase) return Response.json({ ok: false, error: 'Bitget requires passphrase' }, { status: 400 });
          result = await testBitgetCredentials(api_key, api_secret, api_passphrase);
          break;
        }
        default:
          return Response.json({ ok: false, error: `Unknown exchange: ${exchange}` }, { status: 400 });
      }
      return Response.json(result);
    }

    // ── POST /connections — create ─────────────────────────────────────────
    if (method === 'POST' && resource === 'connections' && !resourceId) {
      const { profile_id: bodyProfileId, name, exchange = 'bybit', mode = 'demo', api_key, api_secret, api_passphrase, import_history = true, history_limit = 500 } = body as Record<string, unknown>;
      if (!name || !api_key || !api_secret) return Response.json({ error: 'name, api_key, api_secret required' }, { status: 400 });

      const profiles = await getUserProfiles();
      if (!profiles.length) return Response.json({ error: 'No profiles found' }, { status: 404 });

      let profile_id = bodyProfileId as string;
      if (!profile_id) {
        profile_id = (profiles.find((p: Record<string, unknown>) => p.is_active) || profiles[0]).id;
      } else if (!profiles.find((p: Record<string, unknown>) => p.id === profile_id)) {
        return Response.json({ error: 'Profile not found or access denied' }, { status: 403 });
      }

      const baseUrl = getBaseUrl(exchange as string, mode as string);
      const nowMs = Date.now();
      const importHistoryBool = import_history !== false;

      const connData: Record<string, unknown> = {
        profile_id,
        name,
        exchange,
        mode,
        api_key_enc: await encryptValue(api_key as string),
        api_secret_enc: await encryptValue(api_secret as string),
        base_url: baseUrl,
        relay_url: getRelayConfig().relayUrl,
        is_active: true,
        last_status: 'ok',
        created_by: auth.email,
        import_history: importHistoryBool,
        history_limit: Math.max(100, Math.min(1000, Number(history_limit || 500))),
        connected_at_ms: nowMs,
        initial_sync_done: false,
        sync_cursor_ms: importHistoryBool ? 0 : nowMs,
      };

      // Save passphrase for OKX and Bitget
      if (api_passphrase && (exchange === 'okx' || exchange === 'bitget')) {
        connData.api_passphrase_enc = await encryptValue(api_passphrase as string);
      }

      const conn = await base44.asServiceRole.entities.ExchangeConnection.create(connData);

      return Response.json({ ok: true, connection: { id: conn.id, name: conn.name, exchange: conn.exchange, mode: conn.mode, is_active: conn.is_active, last_status: conn.last_status, import_history: conn.import_history, history_limit: conn.history_limit } });
    }

    // ── GET /connections?profile_id= ───────────────────────────────────────
    if (resource === 'connections' && !resourceId && (method === 'GET' || (method === 'POST' && (body as Record<string, unknown>).profile_id && !(body as Record<string, unknown>).api_key && !(body as Record<string, unknown>).name))) {
      const profileId = query.get('profile_id') || (body as Record<string, unknown>).profile_id || auth.profileId;
      if (!profileId) return Response.json({ error: 'profile_id required' }, { status: 400 });

      const profiles = await getUserProfiles();
      if (!profiles.find((p: Record<string, unknown>) => p.id === profileId)) return Response.json({ error: 'Profile not found or access denied' }, { status: 403 });

      const connections = await base44.asServiceRole.entities.ExchangeConnection.filter({ profile_id: profileId });
      return Response.json({
        connections: connections.map((c: Record<string, unknown>) => ({
          id: c.id, name: c.name, exchange: c.exchange, mode: c.mode, base_url: c.base_url,
          is_active: c.is_active, last_status: c.last_status, last_error: c.last_error,
          last_sync_at: c.last_sync_at, created_date: c.created_date,
          import_history: c.import_history, history_limit: c.history_limit,
          connected_at_ms: c.connected_at_ms, current_balance: c.current_balance,
          current_equity: c.current_equity ?? null,
        }))
      });
    }

    // ── PATCH /connections/:id ─────────────────────────────────────────────
    if (method === 'PATCH' && resource === 'connections' && resourceId) {
      const bodyR = body as Record<string, unknown>;
      const allowed = ['is_active', 'name', 'mode', 'base_url'];
      const update: Record<string, unknown> = {};
      for (const k of allowed) { if (bodyR[k] !== undefined) update[k] = bodyR[k]; }
      // When mode changes, auto-update base_url
      if (bodyR.mode) {
        const conns = await base44.asServiceRole.entities.ExchangeConnection.filter({ id: resourceId });
        const conn = conns[0];
        if (conn) update.base_url = getBaseUrl(conn.exchange || 'bybit', bodyR.mode as string);
      }
      const conn = await base44.asServiceRole.entities.ExchangeConnection.update(resourceId, update);
      return Response.json({ ok: true, connection: { id: conn.id, name: conn.name, is_active: conn.is_active, mode: conn.mode } });
    }

    // ── DELETE /connections/:id ────────────────────────────────────────────
    if (method === 'DELETE' && resource === 'connections' && resourceId) {
      const connsToDelete = await base44.asServiceRole.entities.ExchangeConnection.filter({ id: resourceId });
      const connToDelete = connsToDelete[0];

      if (connToDelete?.profile_id) {
        try {
          const openTrades = await base44.asServiceRole.entities.Trade.filter({ profile_id: connToDelete.profile_id });
          const exchangeOpenTrades = openTrades.filter(
            (t: Record<string, unknown>) => {
              const eid = t.external_id as string;
              return eid && (
                eid.startsWith('BYBIT:OPEN:') ||
                eid.startsWith('BINANCE:OPEN:') ||
                eid.startsWith('BINGX:OPEN:') ||
                eid.startsWith('OKX:OPEN:') ||
                eid.startsWith('MEXC:OPEN:') ||
                eid.startsWith('BITGET:OPEN:')
              ) && !t.close_price;
            }
          );
          await Promise.all(exchangeOpenTrades.map((t: Record<string, unknown>) =>
            base44.asServiceRole.entities.Trade.delete(t.id)
          ));
        } catch (_e) {
          // Non-fatal
        }
      }

      await base44.asServiceRole.entities.ExchangeConnection.delete(resourceId);
      return Response.json({ ok: true, cleaned_open_positions: true });
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
