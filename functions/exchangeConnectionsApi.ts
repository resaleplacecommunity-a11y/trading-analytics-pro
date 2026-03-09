import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// AES-GCM encrypt/decrypt using APP_SECRET env variable
async function getKey() {
  const secret = Deno.env.get('BASE44_APP_ID') || 'default-secret-key-32-chars-padded';
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
  return keyMaterial;
}

async function encryptValue(plaintext) {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  const combined = new Uint8Array(iv.byteLength + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

async function decryptValue(ciphertext) {
  const key = await getKey();
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

// Sign Bybit request (HMAC-SHA256)
async function signBybit(apiKey, apiSecret, timestamp, recvWindow, params) {
  const queryString = typeof params === 'string'
    ? params
    : Object.entries(params).sort().map(([k, v]) => `${k}=${v}`).join('&');
  const preHashStr = `${timestamp}${apiKey}${recvWindow}${queryString}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(preHashStr));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Call Bybit via relay proxy
async function relayCall(relayUrl, relaySecret, targetUrl, method, signedHeaders, queryParams) {
  if (!relayUrl || !relaySecret) {
    throw new Error('Relay not configured: BYBIT_PROXY_URL or BYBIT_PROXY_SECRET missing');
  }
  let finalUrl = targetUrl;
  let bodyPayload = undefined;
  if (method === 'GET' && queryParams && Object.keys(queryParams).length > 0) {
    const qs = new URLSearchParams(queryParams).toString();
    finalUrl = targetUrl + (targetUrl.includes('?') ? '&' : '?') + qs;
  } else if (method !== 'GET') {
    bodyPayload = queryParams || {};
  }
  const response = await fetch(relayUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-relay-secret': relaySecret },
    body: JSON.stringify({ url: finalUrl, method, headers: signedHeaders || {}, body: bodyPayload }),
  });
  if (!response.ok) {
    const txt = await response.text().catch(() => '');
    throw new Error(`Relay error ${response.status}: ${txt}`);
  }
  return await response.json();
}

// Build signed headers for Bybit
async function buildBybitHeaders(apiKey, apiSecret, params) {
  const timestamp = Date.now().toString();
  const recvWindow = '5000';
  const signature = await signBybit(apiKey, apiSecret, timestamp, recvWindow, params);
  return {
    'X-BAPI-API-KEY': apiKey,
    'X-BAPI-TIMESTAMP': timestamp,
    'X-BAPI-RECV-WINDOW': recvWindow,
    'X-BAPI-SIGN': signature,
  };
}

// Test Bybit credentials - returns { ok, mode, balance, message }
async function testBybitCredentials(apiKey, apiSecret, baseUrl, relayUrl, relaySecret) {
  const params = { accountType: 'UNIFIED' };
  const headers = await buildBybitHeaders(apiKey, apiSecret, params);
  const data = await relayCall(relayUrl, relaySecret, `${baseUrl}/v5/account/wallet-balance`, 'GET', headers, params);

  if (data.retCode !== 0) {
    return { ok: false, message: data.retMsg || 'Auth failed', retCode: data.retCode };
  }

  let balance = null;
  const acct = data?.result?.list?.[0];
  if (acct?.coin) {
    const usdt = acct.coin.find(c => c.coin === 'USDT');
    balance = usdt ? parseFloat(usdt.walletBalance) : parseFloat(acct.totalWalletBalance || 0);
  } else if (acct?.totalWalletBalance) {
    balance = parseFloat(acct.totalWalletBalance);
  }

  const mode = baseUrl.includes('demo') ? 'demo' : 'real';
  return { ok: true, mode, balance, message: `Connected. Balance: ${balance != null ? balance.toFixed(2) + ' USDT' : 'N/A'}` };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Support both JSON body routing and URL path routing
    let body_raw = {};
    if (req.method !== 'GET') {
      try { body_raw = await req.json(); } catch {}
    }
    
    // Route via _path field in payload (Base44 SDK pattern) or URL path
    const url = new URL(req.url);
    let routePath = body_raw._path || '';
    const overrideMethod = body_raw._method || null;
    
    if (!routePath) {
      const pathParts = url.pathname.split('/').filter(Boolean);
      routePath = pathParts.join('/');
    }
    
    const pathParts = routePath.split('/').filter(Boolean);
    const resource = pathParts[0] || '';
    const resourceId = pathParts[1] || null;
    const method = overrideMethod || req.method.toUpperCase();
    
    // Remove routing meta fields from body
    delete body_raw._path;
    delete body_raw._method;

    const relayUrl = 'https://pencil-vcr-genesis-wall.trycloudflare.com/proxy';
    const relaySecret = '02f48c0e5d4b0186b5aa523a9a2cdbebc7b6d5a2e9cb8d96';

    // ── POST /connections/test ──────────────────────────────────────────────
    if (method === 'POST' && resource === 'connections' && resourceId === 'test') {
      const body = body_raw;
      const { api_key, api_secret, exchange, mode } = body;
      if (!api_key || !api_secret) {
        return Response.json({ ok: false, error: 'api_key and api_secret required' }, { status: 400 });
      }
      const baseUrl = mode === 'real' ? 'https://api.bybit.com' : 'https://api-demo.bybit.com';
      const result = await testBybitCredentials(api_key, api_secret, baseUrl, relayUrl, relaySecret);
      return Response.json(result);
    }

    // ── POST /connections ───────────────────────────────────────────────────
    if (method === 'POST' && resource === 'connections' && !resourceId) {
      const body = body_raw;
      const { profile_id, name, exchange, mode, api_key, api_secret } = body;
      if (!profile_id || !name || !api_key || !api_secret) {
        return Response.json({ error: 'profile_id, name, api_key, api_secret required' }, { status: 400 });
      }

      // Verify profile belongs to user
      const profiles = await base44.asServiceRole.entities.UserProfile.filter({ created_by: user.email });
      if (!profiles.find(p => p.id === profile_id)) {
        return Response.json({ error: 'Profile not found or access denied' }, { status: 403 });
      }

      const baseUrl = (mode === 'real') ? 'https://api.bybit.com' : 'https://api-demo.bybit.com';
      const encKey = await encryptValue(api_key);
      const encSecret = await encryptValue(api_secret);

      const conn = await base44.asServiceRole.entities.ExchangeConnection.create({
        profile_id,
        name,
        exchange: exchange || 'bybit',
        mode: mode || 'demo',
        api_key_enc: encKey,
        api_secret_enc: encSecret,
        base_url: baseUrl,
        relay_url: relayUrl || '',
        is_active: true,
        last_status: 'ok',
        created_by: user.email,
      });

      return Response.json({ ok: true, connection: { id: conn.id, name: conn.name, exchange: conn.exchange, mode: conn.mode, is_active: conn.is_active, last_status: conn.last_status, last_sync_at: conn.last_sync_at } });
    }

    // ── GET /connections?profile_id=... ────────────────────────────────────
    // Triggered when: no _path set and profile_id present, or _path=connections with no resourceId and no api_key
    const isListRequest = (resource === 'connections' || resource === '') && !resourceId && !body_raw.api_key && !body_raw.name && (body_raw.profile_id || url.searchParams.get('profile_id'));
    if (isListRequest) {
      const profileId = url.searchParams.get('profile_id') || body_raw.profile_id;
      if (!profileId) return Response.json({ error: 'profile_id required' }, { status: 400 });

      const profiles = await base44.asServiceRole.entities.UserProfile.filter({ created_by: user.email });
      if (!profiles.find(p => p.id === profileId)) {
        return Response.json({ error: 'Profile not found or access denied' }, { status: 403 });
      }

      const connections = await base44.asServiceRole.entities.ExchangeConnection.filter({ profile_id: profileId, created_by: user.email });
      // Strip encrypted fields before returning
      const safe = connections.map(c => ({
        id: c.id,
        name: c.name,
        exchange: c.exchange,
        mode: c.mode,
        base_url: c.base_url,
        is_active: c.is_active,
        last_status: c.last_status,
        last_error: c.last_error,
        last_sync_at: c.last_sync_at,
        created_date: c.created_date,
      }));
      return Response.json({ connections: safe });
    }

    // ── PATCH /connections/:id ──────────────────────────────────────────────
    if (method === 'PATCH' && resource === 'connections' && resourceId) {
      const body = body_raw;
      const allowed = ['is_active', 'name', 'mode', 'base_url'];
      const update = {};
      for (const k of allowed) {
        if (body[k] !== undefined) update[k] = body[k];
      }
      if (body.mode) {
        update.base_url = body.mode === 'real' ? 'https://api.bybit.com' : 'https://api-demo.bybit.com';
      }
      const conn = await base44.asServiceRole.entities.ExchangeConnection.update(resourceId, update);
      return Response.json({ ok: true, connection: { id: conn.id, name: conn.name, is_active: conn.is_active, mode: conn.mode } });
    }

    // ── DELETE /connections/:id ─────────────────────────────────────────────
    if (method === 'DELETE' && resource === 'connections' && resourceId) {
      await base44.asServiceRole.entities.ExchangeConnection.delete(resourceId);
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Not found', endpoints: ['POST /connections/test', 'POST /connections', 'GET /connections?profile_id=', 'PATCH /connections/:id', 'DELETE /connections/:id'] }, { status: 404 });

  } catch (error) {
    console.error('[exchangeConnectionsApi]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});