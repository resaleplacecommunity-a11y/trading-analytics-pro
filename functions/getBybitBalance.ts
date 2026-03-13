import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── Exchange domain allowlist ──────────────────────────────────────────────────
const ALLOWED_EXCHANGE_DOMAINS = [
  'api.bybit.com', 'api-demo.bybit.com',
  'api.binance.com', 'fapi.binance.com', 'testnet.binancefuture.com',
  'www.okx.com', 'aws.okx.com',
  'api.bitget.com',
  'api.kucoin.com', 'api-futures.kucoin.com',
  'api.gateio.ws',
  'api.mexc.com',
  'open-api.bingx.com',
];

// ── Crypto helpers ─────────────────────────────────────────────────────────────
async function getKey() {
  const secret = Deno.env.get('BASE44_APP_ID') || 'default-secret-key-32-chars-padded';
  return crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' }, false, ['decrypt']
  );
}

async function decryptValue(ciphertext) {
  const key = await getKey();
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: combined.slice(0, 12) }, key, combined.slice(12)
  );
  return new TextDecoder().decode(decrypted);
}

async function signBybit(apiKey, apiSecret, timestamp, recvWindow, queryStr) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key,
    new TextEncoder().encode(`${timestamp}${apiKey}${recvWindow}${queryStr}`)
  );
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Unified relay call (same protocol as syncExchangeConnection) ───────────────
async function relayCall(targetUrl, method, signedHeaders, params) {
  const hostname = new URL(targetUrl).hostname;
  if (!ALLOWED_EXCHANGE_DOMAINS.includes(hostname)) {
    throw new Error(`Exchange domain not in allowlist: ${hostname}`);
  }

  const bridgeBase = (Deno.env.get('BYBIT_BRIDGE_URL') || Deno.env.get('BYBIT_PROXY_URL') || '').replace(/\/+$/, '');
  const relaySecret = Deno.env.get('BYBIT_PROXY_SECRET') || '';

  if (!bridgeBase) throw new Error('Relay not configured (EXCHANGE_PROXY_URL / BYBIT_BRIDGE_URL missing)');

  let finalUrl = targetUrl;
  if (method === 'GET' && params && Object.keys(params).length > 0) {
    finalUrl += (targetUrl.includes('?') ? '&' : '?') +
      new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))).toString();
  }

  const res = await fetch(`${bridgeBase}/proxy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-relay-secret': relaySecret },
    body: JSON.stringify({ url: finalUrl, method, headers: signedHeaders || {}, body: method !== 'GET' ? params : undefined }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Relay ${res.status}: ${await res.text().catch(() => '')}`);
  return res.json();
}

// ── Main handler ───────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { connection_id } = await req.json().catch(() => ({}));

    // Load connection — by id if provided, else first active for user's active profile
    let conn;
    if (connection_id) {
      const list = await base44.asServiceRole.entities.ExchangeConnection.filter({ id: connection_id });
      conn = list[0];
    } else {
      const profiles = await base44.asServiceRole.entities.UserProfile.filter(
        { created_by: user.email, is_active: true }
      );
      if (profiles.length) {
        const list = await base44.asServiceRole.entities.ExchangeConnection.filter(
          { profile_id: profiles[0].id, is_active: true }
        );
        conn = list[0];
      }
    }

    if (!conn) return Response.json({ error: 'No active exchange connection found', success: false }, { status: 404 });

    // Verify ownership
    const profiles = await base44.asServiceRole.entities.UserProfile.filter({ created_by: user.email });
    if (!profiles.find(p => p.id === conn.profile_id)) {
      return Response.json({ error: 'Access denied', success: false }, { status: 403 });
    }

    const apiKey = await decryptValue(conn.api_key_enc);
    const apiSecret = await decryptValue(conn.api_secret_enc);
    const baseUrl = conn.base_url;

    const timestamp = Date.now().toString();
    const recvWindow = '5000';
    const queryStr = 'accountType=UNIFIED';
    const signature = await signBybit(apiKey, apiSecret, timestamp, recvWindow, queryStr);

    const data = await relayCall(`${baseUrl}/v5/account/wallet-balance`, 'GET', {
      'X-BAPI-API-KEY': apiKey,
      'X-BAPI-TIMESTAMP': timestamp,
      'X-BAPI-RECV-WINDOW': recvWindow,
      'X-BAPI-SIGN': signature,
    }, { accountType: 'UNIFIED' });

    if (data.retCode !== 0) {
      return Response.json({ error: data.retMsg, retCode: data.retCode, success: false }, { status: 400 });
    }

    let balance = null;
    const acct = data?.result?.list?.[0];
    if (acct?.coin) {
      const usdt = acct.coin.find(c => c.coin === 'USDT');
      balance = usdt ? parseFloat(usdt.walletBalance) : parseFloat(acct.totalWalletBalance || 0);
    } else if (acct?.totalWalletBalance) {
      balance = parseFloat(acct.totalWalletBalance);
    }

    // Cache balance on connection record
    await base44.asServiceRole.entities.ExchangeConnection.update(conn.id, { current_balance: balance });

    return Response.json({ success: true, balance });
  } catch (error) {
    return Response.json({ error: error.message, success: false }, { status: 500 });
  }
});