import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// SDK compat helper: .filter() may return array or {results:[]} depending on version
function ensureArray(result) {
  if (Array.isArray(result)) return result;
  if (result?.results) return result.results;
  if (result?.items) return result.items;
  return [];
}

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

async function sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getKey() {
  const secret = Deno.env.get('BASE44_APP_ID') || 'default-secret-key-32-chars-padded';
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
  );
}

async function decryptValue(ciphertext) {
  const key = await getKey();
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacBase64(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

const hmacSha256Base64 = hmacBase64;

const ALLOWED_EXCHANGE_DOMAINS = [
  'api.bybit.com', 'api-demo.bybit.com',
  'api.binance.com', 'fapi.binance.com', 'testnet.binancefuture.com',
  'www.okx.com', 'aws.okx.com',
  'api.bitget.com',
  'api.kucoin.com', 'api-futures.kucoin.com',
  'api.gateio.ws',
  'api.mexc.com', 'contract.mexc.com',
  'open-api.bingx.com', 'open-api-vst.bingx.com',
];

async function relayCall(targetUrl, method, signedHeaders, params) {
  const hostname = new URL(targetUrl).hostname;
  if (!ALLOWED_EXCHANGE_DOMAINS.includes(hostname)) {
    throw new Error(`CONFIG_ERROR: Exchange domain not in allowlist: ${hostname}`);
  }
  const { relayUrl, relaySecret, timeout } = getRelayConfig();
  let finalUrl = targetUrl;
  let bodyPayload = undefined;
  if (method === 'GET' && params && Object.keys(params).length > 0) {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))).toString();
    finalUrl += (targetUrl.includes('?') ? '&' : '?') + qs;
  } else if (method !== 'GET' && params) {
    bodyPayload = params;
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(relayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-relay-secret': relaySecret },
      body: JSON.stringify({ url: finalUrl, method, headers: signedHeaders || {}, body: bodyPayload }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      const txt = await response.text().catch(() => '');
      throw new Error(`RELAY_ERROR: ${response.status} ${txt}`);
    }
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') throw new Error('TIMEOUT: Relay request timed out');
    throw error;
  }
}

async function resolveAuth(base44, authHeader) {
  const rawToken = (authHeader || '').replace(/^Bearer\s+/i, '').trim();
  if (rawToken.startsWith('tpro_')) {
    const hash = await sha256hex(rawToken);
    const byHash = ensureArray(await base44.asServiceRole.entities.BotApiToken.filter({ token_hash: hash, is_active: true }, '-created_date', 1));
    let matched = byHash[0] || null;
    if (!matched) {
      const byPlaintext = ensureArray(await base44.asServiceRole.entities.BotApiToken.filter({ token: rawToken, is_active: true }, '-created_date', 1));
      matched = byPlaintext[0] || null;
    }
    if (!matched) return null;
    if (matched.expires_at && new Date(matched.expires_at) < new Date()) return null;
    base44.asServiceRole.entities.BotApiToken.update(matched.id, { last_used_at: new Date().toISOString() }).catch(() => {});
    return { email: matched.created_by, profileId: matched.profile_id, scope: matched.scope || 'write' };
  }
  const sessionUser = await base44.auth.me().catch(() => null);
  if (!sessionUser) return null;
  const profiles = ensureArray(await base44.asServiceRole.entities.UserProfile.filter({ created_by: sessionUser.email }));
  const active = profiles.find(p => p.is_active) || profiles[0];
  return { email: sessionUser.email, profileId: active?.id || null, scope: 'write', profiles };
}

async function buildBybitHeaders(apiKey, apiSecret, params) {
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

async function buildBinanceLikeParams(apiKey, apiSecret, params) {
  const timestamp = Date.now().toString();
  const recvWindow = '5000';
  const allParams = { ...params, timestamp, recvWindow };
  const queryString = new URLSearchParams(
    Object.fromEntries(Object.entries(allParams).map(([k, v]) => [k, String(v)]))
  ).toString();
  const signature = await hmacHex(apiSecret, queryString);
  return {
    queryParams: { ...allParams, signature },
    headers: { 'X-MBX-APIKEY': apiKey },
  };
}

async function buildBingXParams(apiKey, apiSecret, params = {}) {
  const timestamp = Date.now().toString();
  const allParams = { ...params, timestamp };
  const queryString = Object.keys(allParams).sort()
    .map(k => `${k}=${allParams[k]}`).join('&');
  const signature = await hmacHex(apiSecret, queryString);
  return {
    queryParams: { ...allParams, signature },
    headers: { 'X-BX-APIKEY': apiKey },
  };
}

async function buildOKXHeaders(apiKey, apiSecret, passphrase, method, path, body = '', isDemo = false) {
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z');
  const preHash = `${timestamp}${method.toUpperCase()}${path}${body}`;
  const signature = await hmacBase64(apiSecret, preHash);
  const headers = {
    'OK-ACCESS-KEY': apiKey,
    'OK-ACCESS-SIGN': signature,
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': passphrase,
    'Content-Type': 'application/json',
  };
  if (isDemo) headers['x-simulated-trading'] = '1';
  return headers;
}

async function buildBitgetHeaders(apiKey, apiSecret, passphrase, method, path, queryString = '', body = '') {
  const timestamp = Date.now().toString();
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

async function buildMEXCHeaders(apiKey, apiSecret, requestParam = '') {
  const ts = Date.now().toString();
  const signStr = apiKey + ts + requestParam;
  const sig = await hmacHex(apiSecret, signStr);
  return {
    headers: { 'ApiKey': apiKey, 'Request-Time': ts, 'Signature': sig, 'Content-Type': 'application/json' },
    ts,
  };
}

// Smart field parsers
function parseSL(obj) {
  const val = obj?.stopLoss ?? obj?.stopLossPrice ?? obj?.stop_loss ?? obj?.sl ?? obj?.stopPrice ?? obj?.liqPrice;
  const n = parseFloat(val || '0');
  return n > 0 ? n : null;
}
function parseTP(obj) {
  const val = obj?.takeProfit ?? obj?.takeProfitPrice ?? obj?.take_profit ?? obj?.tp ?? obj?.profitPrice;
  const n = parseFloat(val || '0');
  return n > 0 ? n : null;
}
function parsePnl(obj) {
  const val = obj?.profit ?? obj?.realizedPnl ?? obj?.closedPnl ?? obj?.pnl ?? obj?.achievedProfits ?? obj?.netProfit ?? '0';
  return parseFloat(val || '0');
}
function parseQty(obj) {
  const val = obj?.volume ?? obj?.qty ?? obj?.sz ?? obj?.size ?? obj?.positionAmt ?? obj?.total ?? obj?.vol ?? '0';
  return Math.abs(parseFloat(val || '0'));
}
function parsePrice(obj) {
  const val = obj?.price ?? obj?.avgPrice ?? obj?.avgPx ?? obj?.dealAvgPrice ?? obj?.openPriceAvg ?? obj?.entryPrice ?? obj?.openAvgPrice ?? '0';
  return parseFloat(val || '0');
}
function parseTimestamp(obj) {
  const val = obj?.createTime ?? obj?.time ?? obj?.cTime ?? obj?.uTime ?? obj?.updateTime ?? obj?.openTime ?? obj?.timestamp ?? '0';
  return parseInt(val || '0');
}

function resolveDirection(raw) {
  if (!raw && raw !== 0) return 'Long';
  const s = String(raw).toLowerCase().trim();
  if (raw === 1 || raw === '1') return 'Long';
  if (raw === 2 || raw === '2') return 'Short';
  if (!isNaN(Number(raw))) return Number(raw) > 0 ? 'Long' : 'Short';
  if (s.includes('long') || s === 'buy' || s === 'b' || s === 'bid' || s === 'open_long' || s === 'close_short') return 'Long';
  if (s.includes('short') || s === 'sell' || s === 's' || s === 'ask' || s === 'open_short' || s === 'close_long') return 'Short';
  return 'Long';
}

function makeBybitOpenKey(symbol, side, posIdx) {
  return `BYBIT:OPEN:${symbol}:${side}:${posIdx}`;
}

function makeBybitPositionKey(symbol, side, posIdx, avgEntryPrice) {
  const price = Number(avgEntryPrice || 0).toFixed(4);
  return `BYBIT:POS:${symbol}:${side}:${posIdx}:${price}`;
}

function normalizeExternalId(eid) {
  if (!eid || !eid.startsWith('BYBIT:POS:')) return eid;
  const parts = eid.split(':');
  if (parts.length >= 6) {
    const price = parseFloat(parts[5]);
    if (!isNaN(price)) parts[5] = price.toFixed(4);
  }
  return parts.join(':');
}

// ── GENERIC OPEN POSITION UPSERT ──────────────────────────────────────────────
// Note: partialDataByOpenKey is set in syncBybit scope; passed implicitly via closure in some calls.
// For non-Bybit exchanges, it's undefined and handled gracefully.

async function upsertGenericOpenPosition(base44, pos, currentBalance, profileId, existingByKey, partialDataByOpenKey) {
  // FIX 3: Use entry_price (not mark_price) for position size calculation
  const positionSizeUsd = pos.size * pos.entry_price;

  // FIX 3: null when no stop; preserve original_risk_usd when stop is at breakeven
  const isBEStop = pos.stop_price && pos.entry_price > 0
    && Math.abs(pos.stop_price - pos.entry_price) / pos.entry_price < 0.001;
  const riskUsd = (pos.stop_price && pos.stop_price > 0 && pos.entry_price > 0 && !isBEStop)
    ? (Math.abs(pos.entry_price - pos.stop_price) / pos.entry_price) * positionSizeUsd
    : null;

  // FIX 1: Use ONLY createdTime (pos.created_ms) for date_open — already set in callsites
  const openDateIso = (pos.created_ms > 0 && pos.created_ms < Date.now())
    ? new Date(pos.created_ms).toISOString()
    : new Date().toISOString();
  const tapFirstSeenMs = Date.now();
  const durationMinutes = Math.max(0, Math.floor((Date.now() - new Date(openDateIso).getTime()) / 60000));

  const data = {
    profile_id: profileId,
    external_id: pos.external_id,
    import_source: pos.import_source,
    coin: pos.symbol,
    direction: pos.direction,
    entry_price: pos.entry_price,
    original_entry_price: pos.entry_price,
    position_size: positionSizeUsd,
    stop_price: pos.stop_price,
    original_stop_price: pos.stop_price,
    take_price: pos.take_price,
    risk_usd: riskUsd,
    original_risk_usd: riskUsd,
    max_risk_usd: riskUsd,
    pnl_usd: pos.unrealized_pnl,
    date_open: openDateIso,
    date: openDateIso,
    close_price: null,
    date_close: null,
    account_balance_at_entry: currentBalance || 100000,
    actual_duration_minutes: durationMinutes,
    realized_pnl_usd: parseFloat(pos.realized_pnl_usd || '0'),
    partial_closes: pos.partial_closes_json ?? null,
    tap_first_seen_ms: tapFirstSeenMs,
  };

  const freshExisting = ensureArray(await base44.asServiceRole.entities.Trade.filter(
    { external_id: pos.external_id, profile_id: profileId }, '-date_open', 20
  ));
  const existing = freshExisting.length > 0 ? freshExisting : (existingByKey.get(pos.external_id) || []);
  const allExistingOpen = existing.filter((t) => !t.close_price);
  
  if (allExistingOpen.length > 1) {
    const sorted = [...allExistingOpen].sort((a, b) =>
      new Date(String(a.created_date || '0')).getTime() - new Date(String(b.created_date || '0')).getTime()
    );
    for (let i = 1; i < sorted.length; i++) {
      await base44.asServiceRole.entities.Trade.delete(sorted[i].id);
    }
    allExistingOpen.splice(0, allExistingOpen.length, sorted[0]);
  }

  const canonicalOpen = allExistingOpen.sort((a, b) =>
    new Date(String(b.date_open || '0')).getTime() - new Date(String(a.date_open || '0')).getTime()
  )[0] || null;

  if (canonicalOpen) {
    const updateData = { ...data };

    // FIX 1: Update date_open only if createdTime differs by >1h from stored value
    if (pos.created_ms > 0 && canonicalOpen.date_open) {
      const storedMs = new Date(String(canonicalOpen.date_open)).getTime();
      if (Math.abs(pos.created_ms - storedMs) > 3600000) {
        updateData.date_open = new Date(pos.created_ms).toISOString();
        updateData.date = updateData.date_open;
      } else {
        delete updateData.date_open;
        delete updateData.date;
      }
    } else {
      delete updateData.date_open;
      delete updateData.date;
    }
    delete updateData.actual_duration_minutes;
    delete updateData.tap_first_seen_ms;
    if (canonicalOpen.account_balance_at_entry != null) delete updateData.account_balance_at_entry;
    if (canonicalOpen.original_entry_price != null) delete updateData.original_entry_price;
    if (canonicalOpen.original_risk_usd != null) delete updateData.original_risk_usd;
    // FIX 3: preserve original_risk_usd when stop is at breakeven
    if (isBEStop) delete updateData.risk_usd;
    if (canonicalOpen.original_stop_price != null) delete updateData.original_stop_price;
    else if (updateData.stop_price != null) updateData.original_stop_price = updateData.stop_price;

    const partialData = partialDataByOpenKey ? (partialDataByOpenKey.get ? partialDataByOpenKey.get(pos.external_id) : null) : null;
    updateData.realized_pnl_usd = partialData?.realized_pnl_usd ?? 0;
    updateData.partial_closes = pos.partial_closes_json ?? null;
    if (pos.take_price != null) updateData.take_price = pos.take_price;
    if (pos.take_price_grid != null) updateData.take_price_grid = pos.take_price_grid;

    await base44.asServiceRole.entities.Trade.update(canonicalOpen.id, updateData);
  } else {
    await base44.asServiceRole.entities.Trade.create(data);
  }
}

// ── BYBIT SYNC ────────────────────────────────────────────────────────────────

async function syncBybit(base44, conn, apiKey, apiSecret, options, logs) {
  const { importHistory, historyLimit, isInitialSync, historyLimitMode, historyLimitN } = options;
  let { effectiveCursorMs } = options;
  const profileId = conn.profile_id;
  const baseUrl = conn.base_url;

  const allExistingTrades0Raw = await base44.asServiceRole.entities.Trade.filter(
    { profile_id: profileId }, '-date_open', 2000
  );
  const allExistingTrades0 = Array.isArray(allExistingTrades0Raw) ? allExistingTrades0Raw : (allExistingTrades0Raw?.results || allExistingTrades0Raw?.items || []);
  const oldFormat = allExistingTrades0.filter(t => t.external_id?.startsWith('BYBIT:CLOSED:'));
  if (oldFormat.length > 0) {
    await Promise.all(oldFormat.map(t => base44.asServiceRole.entities.Trade.delete(t.id)));
    effectiveCursorMs = 0;
    logs.push(`🔄 Migration: removed ${oldFormat.length} old-format records`);
  }

  // Step 1: Balance + Equity
  let currentBalance = null;
  let currentEquity = null;
  try {
    const p = { accountType: 'UNIFIED' };
    const h = await buildBybitHeaders(apiKey, apiSecret, p);
    const data = await relayCall(`${baseUrl}/v5/account/wallet-balance`, 'GET', h, p);
    if (data.retCode === 0) {
      const acct = data?.result?.list?.[0];
      if (acct?.coin) {
        const usdt = acct.coin.find(c => c.coin === 'USDT');
        currentBalance = usdt ? parseFloat(usdt.walletBalance) : parseFloat(acct.totalWalletBalance || 0);
      } else if (acct?.totalWalletBalance) {
        currentBalance = parseFloat(acct.totalWalletBalance);
      }
      if (acct?.totalEquity != null && acct.totalEquity !== '') {
        currentEquity = parseFloat(acct.totalEquity);
      } else if (acct?.coin) {
        const usdt = acct.coin.find(c => c.coin === 'USDT');
        if (usdt?.equity != null) currentEquity = parseFloat(usdt.equity);
      }
      if (currentEquity == null && currentBalance != null) currentEquity = currentBalance;
    }
    logs.push(`✅ Balance: ${currentBalance != null ? currentBalance.toFixed(2) + ' USDT' : 'N/A'} | Equity: ${currentEquity != null ? currentEquity.toFixed(2) + ' USDT' : 'N/A'}`);
  } catch (e) {
    logs.push(`⚠️ Balance failed: ${e.message}`);
  }

  // Step 1b: Transfer history
  let transferHistory = [];
  try {
    const wp = { withdrawType: '0', limit: '50', coin: 'USDT' };
    const wh = await buildBybitHeaders(apiKey, apiSecret, wp);
    const wd = await relayCall(`${baseUrl}/v5/asset/withdraw/query-record`, 'GET', wh, wp);
    if (wd.retCode === 0 && wd?.result?.rows) {
      for (const r of wd.result.rows) {
        if (r.status === 'success' || r.status === 'completed') {
          transferHistory.push({
            type: 'withdrawal',
            amount: parseFloat(r.amount || '0'),
            date: new Date(parseInt(r.createTime || '0')).toISOString().split('T')[0],
          });
        }
      }
    }
    const dp = { transferType: '0', limit: '50', coin: 'USDT' };
    const dh = await buildBybitHeaders(apiKey, apiSecret, dp);
    const dd = await relayCall(`${baseUrl}/v5/asset/deposit/query-record`, 'GET', dh, dp);
    if (dd.retCode === 0 && dd?.result?.rows) {
      for (const r of dd.result.rows) {
        if (r.status === 3 || r.status === '3') {
          transferHistory.push({
            type: 'deposit',
            amount: parseFloat(r.amount || '0'),
            date: new Date(parseInt(r.createTime || '0')).toISOString().split('T')[0],
          });
        }
      }
    }
    if (transferHistory.length > 0) logs.push(`💸 Transfers: ${transferHistory.length} records`);
  } catch (e) { /* Silently ignore */ }

  // Step 2: Closed PnL
  const allClosedPnl = [];
  let newCursorMs = effectiveCursorMs;
  try {
    if (isInitialSync && importHistory && effectiveCursorMs === 0) {
      const lookbackDays = (historyLimit >= 7 && historyLimit <= 365) ? historyLimit : 90;
      const now = Date.now();
      const cutoffMs = now - lookbackDays * 24 * 3600 * 1000;
      logs.push(`📅 Bybit history sweep: ${lookbackDays} days (${new Date(cutoffMs).toISOString().slice(0,10)} → now)`);
      const seenIds = new Set();
      let cursor = null;
      let pageCount = 0;
      while (pageCount < 50) {
        const p = { category: 'linear', limit: 100 };
        if (cursor) p.cursor = cursor;
        const h = await buildBybitHeaders(apiKey, apiSecret, p);
        const data = await relayCall(`${baseUrl}/v5/position/closed-pnl`, 'GET', h, p);
        if (data.retCode !== 0) {
          if (cursor) { logs.push(`⚠️ Cursor error on page ${pageCount}, stopping sweep`); break; }
          logs.push(`❌ Closed PnL page ${pageCount}: ${data.retMsg}`);
          break;
        }
        const list = data?.result?.list || [];
        if (list.length === 0) break;
        for (const c of list) {
          const t = parseInt(c.updatedTime || c.createdTime || '0');
          if (t > 0 && t < cutoffMs) continue;
          const id = c.orderId || `${c.symbol}_${t}`;
          if (!seenIds.has(id)) {
            seenIds.add(id);
            allClosedPnl.push(c);
            if (t > newCursorMs) newCursorMs = t;
          }
        }
        const rawCursor = data?.result?.nextPageCursor || null;
        cursor = rawCursor ? decodeURIComponent(rawCursor) : null;
        if (!cursor || list.length < 100) break;
        pageCount++;
        await new Promise(r => setTimeout(r, 200));
      }
      logs.push(`📥 History sweep done: ${allClosedPnl.length} trades`);
    } else {
      const closedPnlParams = { category: 'linear', limit: 100 };
      const h = await buildBybitHeaders(apiKey, apiSecret, closedPnlParams);
      const data = await relayCall(`${baseUrl}/v5/position/closed-pnl`, 'GET', h, closedPnlParams);
      if (data.retCode !== 0) {
        logs.push(`❌ Closed PnL: ${data.retMsg}`);
      } else {
        const list = data?.result?.list || [];
        allClosedPnl.push(...list);
        for (const c of list) {
          const t = parseInt(c.updatedTime || c.createdTime || 0);
          if (t > newCursorMs) newCursorMs = t;
        }
      }
    }
    logs.push(`📥 Closed PnL: ${allClosedPnl.length} records`);
  } catch (e) {
    logs.push(`❌ Closed PnL failed: ${e.message}`);
  }

  // Step 2b: Order history for SL/TP
  const orderSlTpBySymbol = new Map();
  try {
    const allOrderHistory = [];
    let ohCursor = null;
    let ohPages = 0;
    while (ohPages < 10) {
      const p = { category: 'linear', limit: 100 };
      if (ohCursor) p.cursor = ohCursor;
      const h = await buildBybitHeaders(apiKey, apiSecret, p);
      const data = await relayCall(`${baseUrl}/v5/order/history`, 'GET', h, p);
      if (data.retCode !== 0) break;
      const list = data?.result?.list || [];
      if (list.length === 0) break;
      allOrderHistory.push(...list);
      ohCursor = data?.result?.nextPageCursor || null;
      if (!ohCursor || list.length < 100) break;
      ohPages++;
      await new Promise(r => setTimeout(r, 100));
    }
    for (const order of allOrderHistory) {
      const sym = order.symbol;
      const sl = parseFloat(order.stopLoss || '0') || null;
      const tp = parseFloat(order.takeProfit || '0') || null;
      if ((sl || tp) && !orderSlTpBySymbol.has(sym)) {
        orderSlTpBySymbol.set(sym, { stopLoss: sl, takeProfit: tp });
      }
    }
    logs.push(`📋 Order history: ${allOrderHistory.length} orders, ${orderSlTpBySymbol.size} symbols with SL/TP`);
  } catch (e) {
    logs.push(`⚠️ Order history failed: ${e.message}`);
  }

  // Step 2c: Open orders (grid TP)
  const openOrderTpBySymbol = new Map();
  const openOrderGridBySymbol = new Map();
  try {
    const p = { category: 'linear', limit: 50 };
    const h = await buildBybitHeaders(apiKey, apiSecret, p);
    const data = await relayCall(`${baseUrl}/v5/order/realtime`, 'GET', h, p);
    const orders = data?.result?.list || [];
    const gridMap = {};
    for (const o of orders) {
      if (o.orderType === 'Limit' && o.reduceOnly) {
        const price = parseFloat(o.price || '0');
        const sym = o.symbol;
        if (price > 0) {
          if (!gridMap[sym]) gridMap[sym] = [];
          gridMap[sym].push(price);
          const isBuyLimit = o.side === 'Buy';
          const existing = openOrderTpBySymbol.get(sym);
          if (existing === undefined) {
            openOrderTpBySymbol.set(sym, price);
          } else if (isBuyLimit && price > existing) {
            openOrderTpBySymbol.set(sym, price);
          } else if (!isBuyLimit && price < existing) {
            openOrderTpBySymbol.set(sym, price);
          }
        }
      }
    }
    for (const [sym, prices] of Object.entries(gridMap)) {
      prices.sort((a, b) => a - b);
      openOrderGridBySymbol.set(sym, JSON.stringify(prices));
    }
    if (openOrderTpBySymbol.size > 0) logs.push(`📋 Grid TP: ${[...openOrderTpBySymbol.entries()].map(([s,p]) => `${s}=${p}`).join(', ')}`);
  } catch (e) {
    logs.push(`⚠️ Open orders failed: ${e.message}`);
  }

  // Step 3: Open positions
  const liveOpenKeys = new Set();
  const openUpserts = [];
  const liveOpenMetaByKey = new Map();
  try {
    const p = { category: 'linear', settleCoin: 'USDT' };
    const h = await buildBybitHeaders(apiKey, apiSecret, p);
    const data = await relayCall(`${baseUrl}/v5/position/list`, 'GET', h, p);
    if (data.retCode === 0 && data?.result?.list) {
      const openPositions = data.result.list.filter(pos => parseFloat(pos.size || '0') > 0);
      for (const pos of openPositions) {
        const openKey = makeBybitOpenKey(pos.symbol, pos.side, pos.positionIdx ?? 0);
        liveOpenKeys.add(openKey);
        openUpserts.push(pos);
        // FIX 1: Use ONLY createdTime from /v5/position/list — NOT updatedTime
        const ct = pos.createdTime ? parseInt(pos.createdTime) : 0;
        const twoYearsAgo = Date.now() - 2 * 365 * 24 * 3600 * 1000;
        const createdMs = (ct > twoYearsAgo && ct > 0) ? ct : 0;
        liveOpenMetaByKey.set(openKey, {
          entryPrice: parseFloat(pos.avgPrice || pos.entryPrice || '0'),
          createdMs,
        });
      }
      logs.push(`✅ Open positions: ${openPositions.length}`);
    }
  } catch (e) {
    logs.push(`❌ Open positions failed: ${e.message}`);
  }

  const allExistingTrades = oldFormat.length > 0
    ? ensureArray(await base44.asServiceRole.entities.Trade.filter({ profile_id: profileId }, '-date_open', 2000))
    : allExistingTrades0.filter(t => !t.external_id?.startsWith('BYBIT:CLOSED:'));

  if (isInitialSync) { logs.push(`🔄 upsert-only mode v3 active`); }

  const existingByKey = new Map();
  for (const t of allExistingTrades) {
    if (!t.external_id) continue;
    if (!existingByKey.has(t.external_id)) existingByKey.set(t.external_id, []);
    existingByKey.get(t.external_id).push(t);
    const normalizedId = normalizeExternalId(t.external_id);
    if (normalizedId !== t.external_id) {
      if (!existingByKey.has(normalizedId)) existingByKey.set(normalizedId, []);
      existingByKey.get(normalizedId).push(t);
    }
  }

  const openSnapshotByKey = new Map();
  for (const t of allExistingTrades) {
    const eid = t.external_id;
    if (eid?.startsWith('BYBIT:OPEN:') && !t.close_price && t.date_open) {
      if (!openSnapshotByKey.has(eid)) {
        openSnapshotByKey.set(eid, {
          date_open: t.date_open,
          stop_price: t.stop_price != null ? Number(t.stop_price) : null,
          original_stop_price: t.original_stop_price != null ? Number(t.original_stop_price) : null,
          original_risk_usd: t.original_risk_usd != null ? Number(t.original_risk_usd) : null,
          original_entry_price: t.original_entry_price != null ? Number(t.original_entry_price) : null,
          account_balance_at_entry: t.account_balance_at_entry != null ? Number(t.account_balance_at_entry) : null,
        });
      }
    }
  }
  const openDateByKey = new Map(
    [...openSnapshotByKey.entries()].map(([k, v]) => [k, v.date_open])
  );

  const closedDateOpenByOpenKey = new Map();
  for (const t of allExistingTrades) {
    const eid = t.external_id;
    if (eid?.startsWith('BYBIT:POS:') && t.close_price && t.date_open) {
      const dateOpen = t.date_open;
      const coin = t.coin || '';
      const dir = (t.direction || '').toLowerCase();
      const dayKey = dateOpen ? dateOpen.slice(0, 10) : '';
      if (coin && dayKey) {
        const lookupKey = `${coin}:${dir}:${dayKey}`;
        const existing = closedDateOpenByOpenKey.get(lookupKey);
        if (!existing || dateOpen < existing) {
          closedDateOpenByOpenKey.set(lookupKey, dateOpen);
        }
      }
    }
  }

  // Step 4: Group close orders
  const closedGroups = new Map();
  const groupOrder = [];

  const sortedClosedPnl = [...allClosedPnl].sort((a, b) => {
    const ta = parseInt(a.updatedTime || a.createdTime || '0');
    const tb = parseInt(b.updatedTime || b.createdTime || '0');
    return ta - tb;
  });

  for (const c of sortedClosedPnl) {
    const posIdx = c.positionIdx ?? 0;
    const baseKey = makeBybitPositionKey(c.symbol, c.side, posIdx, c.avgEntryPrice);
    const cTime = parseInt(c.updatedTime || c.createdTime || '0');
    const openSide = c.side === 'Buy' ? 'Sell' : 'Buy';

    let targetKey = null;
    for (let i = groupOrder.length - 1; i >= 0; i--) {
      const gKey = groupOrder[i];
      const g = closedGroups.get(gKey);
      if (g.baseKey !== baseKey) continue;
      targetKey = gKey;
      break;
    }

    if (targetKey === null) {
      const newKey = cTime > 0 ? `${baseKey}:${cTime}` : baseKey;
      const uniqueKey = closedGroups.has(newKey) ? `${newKey}_${Math.random().toString(36).slice(2, 6)}` : newKey;
      closedGroups.set(uniqueKey, { key: uniqueKey, baseKey, symbol: c.symbol, side: c.side, posIdx, avgEntryPrice: parseFloat(c.avgEntryPrice || '0'), openKey: makeBybitOpenKey(c.symbol, openSide, posIdx), orders: [] });
      groupOrder.push(uniqueKey);
      targetKey = uniqueKey;
    }
    closedGroups.get(targetKey).orders.push(c);
  }
  logs.push(`🔑 Trade groups: ${closedGroups.size} (merged) from ${allClosedPnl.length} close records`);

  // Step 5: Build upsert ops
  const toInsert = [];
  const toUpdate = [];
  const toDelete = [];
  const referencedOpenKeys = new Set();
  const forceResetOpenKeys = new Set();

  for (const [key, group] of closedGroups) {
    let totalClosedSize = 0, totalPnl = 0, weightedExitSum = 0;
    let latestCloseTime = 0, earliestOpenTime = Infinity;

    for (const order of group.orders) {
      const size = parseFloat(order.closedSize || order.qty || 0);
      // FIX 2: avgExitPrice → close_price, avgEntryPrice → entry_price (correct mapping)
      const exitPrice = parseFloat(order.avgExitPrice || order.avgPrice || 0);
      const pnl = parseFloat(order.closedPnl || 0);
      const closeTime = parseInt(order.updatedTime || order.createdTime || 0);
      const openTime = parseInt(order.createdTime || 0);
      totalClosedSize += size;
      totalPnl += pnl;
      weightedExitSum += exitPrice * size;
      if (closeTime > latestCloseTime) latestCloseTime = closeTime;
      if (openTime > 0 && openTime < earliestOpenTime) earliestOpenTime = openTime;
    }

    const avgExitPrice = totalClosedSize > 0 ? weightedExitSum / totalClosedSize : 0;
    const positionSizeUsd = totalClosedSize * group.avgEntryPrice;
    const direction = group.side === 'Buy' ? 'Short' : 'Long';

    const partialDetails = group.orders.map(o => ({
      order_id: o.orderId,
      size: parseFloat(o.closedSize || o.qty || 0),
      price: parseFloat(o.avgExitPrice || o.avgPrice || 0),
      pnl_usd: parseFloat(o.closedPnl || 0),
      timestamp: new Date(parseInt(o.updatedTime || o.createdTime || Date.now())).toISOString(),
    }));

    const openTrade = ((existingByKey.get(group.openKey) || []).find(t => !t.close_price)) || null;
    const existingClosedRecord = existingByKey.get(key) || [];
    const prevClosedRecord = existingClosedRecord.find(t => t.close_price) || null;
    const openSnap = openSnapshotByKey.get(group.openKey) || null;

    const closeTimeMs = latestCloseTime || Date.now();
    const snapDateStr = openSnap?.date_open || (openTrade?.date_open ? String(openTrade.date_open) : null);
    const openRecordDateMs = snapDateStr ? new Date(snapDateStr).getTime() : 0;
    const openRecordEntryMatches = openRecordDateMs > 0;

    const closeDay = new Date(closeTimeMs).toISOString().slice(0, 10);
    const dirForLookup = (group.side === 'Buy' ? 'short' : 'long');
    const closedLookupKey = `${group.symbol}:${dirForLookup}:${closeDay}`;
    const closedFallbackDateStr = closedDateOpenByOpenKey.get(closedLookupKey) || null;
    const closedFallbackDateMs = closedFallbackDateStr ? new Date(closedFallbackDateStr).getTime() : 0;

    const prevClosedDateMs = prevClosedRecord?.date_open
      ? new Date(String(prevClosedRecord.date_open)).getTime()
      : 0;
    const openTradeForKey = (existingByKey.get(group.openKey) || []).find(t => !t.close_price) || null;
    const tapFirstSeenMs = openTradeForKey?.tap_first_seen_ms || 0;
    const savedOpenDateMs = tapFirstSeenMs > 0
      ? tapFirstSeenMs
      : (openDateByKey.has(group.openKey)
        ? new Date(openDateByKey.get(group.openKey)).getTime()
        : 0);
    const openTimeMs = (savedOpenDateMs > 0 && savedOpenDateMs < closeTimeMs && (closeTimeMs - savedOpenDateMs) < 30 * 24 * 3600 * 1000)
      ? savedOpenDateMs
      : ((openRecordEntryMatches && openRecordDateMs > 0 && openRecordDateMs < closeTimeMs)
        ? openRecordDateMs
        : ((prevClosedDateMs > 0 && prevClosedDateMs < closeTimeMs)
          ? prevClosedDateMs
          : ((closedFallbackDateMs > 0 && closedFallbackDateMs < closeTimeMs)
            ? closedFallbackDateMs
            : ((earliestOpenTime !== Infinity && earliestOpenTime > 0 && earliestOpenTime < closeTimeMs)
              ? earliestOpenTime
              : Math.max(0, closeTimeMs - 60000)))));
    const durationMinutes = Math.max(0, Math.floor((closeTimeMs - openTimeMs) / 60000));

    const prevClosedStop = prevClosedRecord?.stop_price != null ? Number(prevClosedRecord.stop_price) : null;
    const prevClosedTake = prevClosedRecord?.take_price != null ? Number(prevClosedRecord.take_price) : null;
    const prevOrigStop = prevClosedRecord?.original_stop_price != null ? Number(prevClosedRecord.original_stop_price) : null;
    const prevOrigEntry = prevClosedRecord?.original_entry_price != null ? Number(prevClosedRecord.original_entry_price) : null;
    const prevOrigRisk = prevClosedRecord?.original_risk_usd != null ? Number(prevClosedRecord.original_risk_usd) : null;
    const prevBalEntry = prevClosedRecord?.account_balance_at_entry != null ? Number(prevClosedRecord.account_balance_at_entry) : null;

    const takePrice = openSnap ? null : (openTrade?.take_price ?? prevClosedTake ?? null);
    const snapStop = openSnap?.stop_price ?? openSnap?.original_stop_price ?? null;
    const liveStop = openTrade?.stop_price != null ? Number(openTrade.stop_price) : null;
    const stopPriceFromOrders = group.orders.find(o => parseFloat(o.stopLoss || '0') > 0);
    const takePriceFromOrders = group.orders.find(o => parseFloat(o.takeProfit || '0') > 0);
    const orderHistory = orderSlTpBySymbol.get(group.symbol);

    const finalStopPrice = snapStop ?? prevClosedStop ?? liveStop
      ?? (stopPriceFromOrders ? parseFloat(stopPriceFromOrders.stopLoss) : null)
      ?? orderHistory?.stopLoss ?? null;
    const finalTakePrice = takePrice ?? prevClosedTake ?? (openTrade?.take_price != null ? Number(openTrade.take_price) : null)
      ?? (takePriceFromOrders ? parseFloat(takePriceFromOrders.takeProfit) : null)
      ?? orderHistory?.takeProfit ?? null;

    const stopWasHit = finalStopPrice != null ? Math.abs(avgExitPrice - Number(finalStopPrice)) <= Math.max(0.0000001, Number(finalStopPrice) * 0.0015) : false;
    const takeWasHit = finalTakePrice != null ? Math.abs(avgExitPrice - Number(finalTakePrice)) <= Math.max(0.0000001, Number(finalTakePrice) * 0.0015) : false;
    const closeReasons = group.orders.map(o => (o.stopOrderType || o.execType || '')).join(',').toLowerCase();

    const originalStop = openSnap?.original_stop_price
      ?? prevOrigStop ?? (openTrade?.original_stop_price != null ? Number(openTrade.original_stop_price) : null)
      ?? finalStopPrice;
    const originalEntry = openSnap?.original_entry_price
      ?? prevOrigEntry ?? (openTrade?.original_entry_price != null ? Number(openTrade.original_entry_price) : null)
      ?? group.avgEntryPrice;

    const snapRisk = openSnap?.original_risk_usd ?? null;
    const liveRisk = openTrade?.original_risk_usd != null ? Number(openTrade.original_risk_usd) : (openTrade?.risk_usd != null ? Number(openTrade.risk_usd) : null);
    let computedRiskUsd = snapRisk ?? prevOrigRisk ?? liveRisk;
    // FIX 3: Calculate risk_usd from original entry/stop — always use formula when available.
    // This is more reliable than cached values (which may have been set with wrong stop at entry time).
    if (originalStop && originalEntry > 0 && positionSizeUsd > 0) {
      const stopDist = Math.abs(originalEntry - originalStop) / originalEntry;
      if (stopDist > 0.0005) {
        const formulaRisk = stopDist * positionSizeUsd;
        // Use formula if: no cached value, OR cached value differs by >20% from formula (sign of stale data)
        if (!computedRiskUsd || Math.abs(formulaRisk - computedRiskUsd) / formulaRisk > 0.20) {
          computedRiskUsd = formulaRisk;
        }
      }
    }
    // FIX 3: null (not 0) if no valid stop
    if (!computedRiskUsd) computedRiskUsd = null;

    const rrRatio = computedRiskUsd && computedRiskUsd > 0 && totalPnl !== 0
      ? totalPnl / computedRiskUsd
      : null;

    const balanceAtEntry = openSnap?.account_balance_at_entry
      ?? prevBalEntry
      ?? (openTrade?.account_balance_at_entry != null ? Number(openTrade.account_balance_at_entry) : null)
      ?? (currentBalance || 100000);

    const tradeData = {
      profile_id: profileId,
      external_id: key,
      import_source: 'bybit',
      coin: group.symbol,
      direction,
      // FIX 2: avgEntryPrice → entry_price, avgExitPrice → close_price (correct mapping)
      entry_price: group.avgEntryPrice,
      original_entry_price: originalEntry,
      position_size: positionSizeUsd,
      stop_price: finalStopPrice,
      original_stop_price: originalStop,
      take_price: finalTakePrice,
      risk_usd: computedRiskUsd,
      original_risk_usd: computedRiskUsd,
      // rr_ratio = planned reward/risk (take distance / stop distance); r_multiple = actual PnL / risk
      rr_ratio: (() => {
        if (!finalTakePrice || !originalStop || !originalEntry || originalEntry <= 0) return rrRatio;
        const rewardDist = Math.abs(finalTakePrice - originalEntry);
        const riskDist = Math.abs(originalEntry - originalStop);
        return riskDist > 0 ? rewardDist / riskDist : rrRatio;
      })(),
      r_multiple: rrRatio,
      stop_loss_was_hit: closeReasons.includes('stoploss') || closeReasons.includes('stop_loss') || stopWasHit,
      take_profit_was_hit: closeReasons.includes('takeprofit') || closeReasons.includes('take_profit') || takeWasHit,
      close_price: avgExitPrice,
      pnl_usd: totalPnl,
      realized_pnl_usd: totalPnl,
      pnl_percent_of_balance: balanceAtEntry > 0 ? (totalPnl / balanceAtEntry) * 100 : 0,
      date_open: new Date(openTimeMs).toISOString(),
      date: new Date(openTimeMs).toISOString(),
      date_close: new Date(closeTimeMs).toISOString(),
      account_balance_at_entry: balanceAtEntry,
      partial_closes: JSON.stringify(partialDetails),
      actual_duration_minutes: durationMinutes,
    };

    if (liveOpenKeys.has(group.openKey)) {
      const liveMeta = liveOpenMetaByKey.get(group.openKey);
      const liveEntry = liveMeta?.entryPrice || 0;
      const liveCreatedMs = liveMeta?.createdMs || 0;
      const liveCreatedKnown = liveCreatedMs > 0;
      const liveOpenedBeforeClose = liveCreatedMs < latestCloseTime;
      const entryCloseEnough = liveEntry > 0
        ? Math.abs(liveEntry - group.avgEntryPrice) / (group.avgEntryPrice || 1) < 0.005
        : false;
      const samePosition = liveCreatedKnown && liveOpenedBeforeClose && entryCloseEnough;
      const entryPriceMatches = entryCloseEnough;

      if (samePosition) {
        const openRecord = (existingByKey.get(group.openKey) || []).find(t => !t.close_price) || null;
        if (openRecord) {
          toUpdate.push({ id: openRecord.id, data: {
            realized_pnl_usd: totalPnl,
            partial_closes: JSON.stringify(partialDetails),
          }});
          referencedOpenKeys.add(group.openKey);
          logs.push(`✅ ${group.symbol}: partial close merged (liveCreated=${liveCreatedMs}, close=${latestCloseTime})`);
          continue;
        }
      }

      forceResetOpenKeys.add(group.openKey);
      logs.push(`ℹ️ ${group.symbol}: new cycle (entryMatch=${entryPriceMatches}, liveCreatedKnown=${liveCreatedKnown}, liveOpenedBefore=${liveOpenedBeforeClose})`);
    }

    const existing = (existingByKey.get(key) || []);
    if (existing.length > 0) {
      const existingRecord = existing[0];
      const updateData = { ...tradeData };
      delete updateData.date_open;
      delete updateData.date;
      // FIX 4: Don't overwrite with invalid prices
      if (group.avgEntryPrice <= 0) delete updateData.entry_price;
      if (avgExitPrice <= 0) delete updateData.close_price;
      if (existingRecord.stop_price != null) delete updateData.stop_price;
      if (existingRecord.original_stop_price != null) delete updateData.original_stop_price;
      else if (updateData.stop_price != null) updateData.original_stop_price = updateData.stop_price;
      if (existingRecord.take_price != null) delete updateData.take_price;
      if (existingRecord.original_entry_price != null) delete updateData.original_entry_price;
      if (existingRecord.original_risk_usd != null) delete updateData.original_risk_usd;
      if (existingRecord.account_balance_at_entry != null) delete updateData.account_balance_at_entry;
      // Safety: don't overwrite Bybit realized PnL if already set
      toUpdate.push({ id: existingRecord.id, data: updateData });
      for (let i = 1; i < existing.length; i++) toDelete.push(existing[i].id);
    } else {
      // FIX 4: Skip trades with invalid prices — do NOT store price=0 as fallback
      if (group.avgEntryPrice <= 0 || avgExitPrice <= 0) {
        logs.push(`⚠️ Skip ${group.symbol}: invalid prices (entry=${group.avgEntryPrice}, exit=${avgExitPrice})`);
      } else {
        // Always insert new records — cursor skip caused trades to be silently missed when
        // different syncs produced different grouping keys for the same symbol.
        toInsert.push(tradeData);
      }
    }

    referencedOpenKeys.add(group.openKey);
  }

  // Execute DB ops
  const BATCH = 20;
  if (toInsert.length > 0) {
    for (let i = 0; i < toInsert.length; i += BATCH) {
      await base44.asServiceRole.entities.Trade.bulkCreate(toInsert.slice(i, i + BATCH));
    }
  }
  for (let i = 0; i < toUpdate.length; i += BATCH) {
    const batch = toUpdate.slice(i, i + BATCH);
    await Promise.all(batch.map(op => base44.asServiceRole.entities.Trade.update(op.id, op.data)));
  }
  for (let i = 0; i < toDelete.length; i += BATCH) {
    const batch = toDelete.slice(i, i + BATCH);
    await Promise.all(batch.map(id => base44.asServiceRole.entities.Trade.delete(id)));
  }
  logs.push(`✅ Closed trades: ${toInsert.length} new, ${toUpdate.length} updated`);

  // Step 6: Dedup stale closed trades
  if (isInitialSync && closedGroups.size > 0) {
    const currentGroupKeys = new Set([...closedGroups.keys()]);
    const staleIds = [];
    for (const t of allExistingTrades) {
      const eid = t.external_id;
      if (!eid || !eid.startsWith('BYBIT:POS:')) continue;
      if (!currentGroupKeys.has(eid)) staleIds.push(t.id);
    }
    if (staleIds.length > 0) {
      for (let i = 0; i < staleIds.length; i += BATCH) {
        await Promise.all(staleIds.slice(i, i + BATCH).map(id => base44.asServiceRole.entities.Trade.delete(id)));
      }
      logs.push(`🧹 Dedup: removed ${staleIds.length} stale trades from older sync`);
    }
  }

  // Build partial data for open positions
  const partialDataByOpenKey = new Map();
  for (const [, group] of closedGroups) {
    if (liveOpenKeys.has(group.openKey) && !forceResetOpenKeys.has(group.openKey)) {
      const tapOpenMs = openDateByKey.has(group.openKey)
        ? new Date(openDateByKey.get(group.openKey)).getTime()
        : 0;
      const liveCreatedMs = liveOpenMetaByKey.get(group.openKey)?.createdMs || 0;
      const lowerBoundMs = Math.max(tapOpenMs, liveCreatedMs);
      const validOrders = (lowerBoundMs > 0
        ? group.orders.filter(o => parseInt(o.updatedTime || o.createdTime || '0') > lowerBoundMs)
        : group.orders
      ).filter(o => parseFloat(o.closedSize || '0') > 0);
      if (validOrders.length === 0) continue;
      const existing = partialDataByOpenKey.get(group.openKey);
      const existingPartials = existing?.partial_closes_arr || [];
      const newPartials = validOrders.map(o => ({
        order_id: o.orderId,
        size: parseFloat(o.closedSize || o.qty || '0'),
        price: parseFloat(o.avgExitPrice || o.avgPrice || '0'),
        pnl_usd: parseFloat(o.closedPnl || '0'),
        timestamp: new Date(parseInt(o.updatedTime || o.createdTime || '0')).toISOString(),
      }));
      const mergedPartials = [...existingPartials, ...newPartials].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      partialDataByOpenKey.set(group.openKey, {
        realized_pnl_usd: (existing?.realized_pnl_usd || 0) + validOrders.reduce((s, o) => s + parseFloat(o.closedPnl || '0'), 0),
        partial_closes_arr: mergedPartials,
        partial_closes: JSON.stringify(mergedPartials),
      });
    }
  }

  // Build last-close-time per symbol to detect stale Bybit createdTime.
  // Bybit does NOT reset createdTime when a position is re-opened after a full close.
  const lastCloseTimeBySymbol = new Map<string, number>();
  for (const t of allExistingTrades) {
    if (t.external_id?.startsWith('BYBIT:POS:') && t.close_price && t.date_close && t.coin) {
      const closeMs = new Date(String(t.date_close)).getTime();
      const prev = lastCloseTimeBySymbol.get(t.coin) || 0;
      if (closeMs > prev) lastCloseTimeBySymbol.set(t.coin, closeMs);
    }
  }

  // Upsert open positions
  for (const pos of openUpserts) {
    const openKey = makeBybitOpenKey(pos.symbol, pos.side, pos.positionIdx ?? 0);
    const partialData = partialDataByOpenKey.get(openKey);
    // FIX 1: Use pos.createdTime for created_ms, but correct for Bybit's stale createdTime bug.
    // If createdTime predates the last close for this symbol, the position was re-opened.
    // In that case, prefer updatedTime (actual re-open time) or Date.now() as fallback.
    const ct = pos.createdTime ? parseInt(pos.createdTime) : 0;
    const ut = pos.updatedTime ? parseInt(pos.updatedTime) : 0;
    const twoYearsAgo = Date.now() - 2 * 365 * 24 * 3600 * 1000;
    const ctValid = ct > twoYearsAgo && ct > 0;
    const utValid = ut > twoYearsAgo && ut > 0;
    const lastCloseMs = lastCloseTimeBySymbol.get(pos.symbol) || 0;
    let createdMsForUpsert: number;
    if (ctValid && lastCloseMs > 0 && ct < lastCloseMs) {
      // createdTime is stale — use updatedTime if it's after the last close, else now
      createdMsForUpsert = (utValid && ut >= lastCloseMs) ? ut : Date.now();
    } else {
      createdMsForUpsert = ctValid ? ct : 0;
    }

    await upsertGenericOpenPosition(base44, {
      external_id: makeBybitOpenKey(pos.symbol, pos.side, pos.positionIdx ?? 0),
      symbol: pos.symbol,
      direction: pos.side === 'Buy' ? 'Long' : 'Short',
      entry_price: parseFloat(pos.avgPrice || pos.entryPrice || 0),
      size: parseFloat(pos.size || 0),
      mark_price: parseFloat(pos.markPrice || pos.avgPrice || pos.entryPrice || 0),
      stop_price: parseFloat(pos.stopLoss || 0) || null,
      take_price: parseFloat(pos.takeProfit || 0) || openOrderTpBySymbol.get(pos.symbol) || null,
      take_price_grid: openOrderGridBySymbol.get(pos.symbol) || null,
      unrealized_pnl: parseFloat(pos.unrealisedPnl || 0),
      realized_pnl_usd: 0,
      created_ms: createdMsForUpsert,
      import_source: 'bybit',
      partial_closes_json: partialData?.partial_closes ?? null,
      force_reset_open: forceResetOpenKeys.has(openKey),
    }, currentBalance, profileId, existingByKey, partialDataByOpenKey);
  }

  // FIX 5: Ghost positions — auto-close instead of hard delete where possible
  let staleCleaned = 0;
  let ghostClosed = 0;
  if (openUpserts !== undefined) {
    for (const [key, trades] of existingByKey) {
      if (key.startsWith('BYBIT:OPEN:') && !liveOpenKeys.has(key)) {
        for (const ot of trades) {
          // If a proper BYBIT:POS: record exists for this position, delete the stale OPEN record (even if already ghost-closed)
          if (referencedOpenKeys.has(key)) {
            await base44.asServiceRole.entities.Trade.delete(ot.id);
            staleCleaned++;
            continue;
          }
          if (!ot.close_price && !ot.date_close) {
            const sym = ot.coin || '';
            const relevantClose = allClosedPnl
              .filter(c => c.symbol === sym)
              .sort((a, b) => parseInt(b.updatedTime || b.createdTime || '0') - parseInt(a.updatedTime || a.createdTime || '0'))[0];
            const closePrice = relevantClose
              ? parseFloat(relevantClose.avgExitPrice || relevantClose.avgPrice || '0')
              : 0;
            const closePnl = relevantClose ? parseFloat(relevantClose.closedPnl || '0') : null;
            if (closePrice > 0) {
              await base44.asServiceRole.entities.Trade.update(ot.id, {
                close_price: closePrice,
                date_close: new Date(parseInt(relevantClose.updatedTime || relevantClose.createdTime || Date.now())).toISOString(),
                pnl_usd: closePnl,
                realized_pnl_usd: closePnl,
              });
              ghostClosed++;
            } else {
              await base44.asServiceRole.entities.Trade.delete(ot.id);
              staleCleaned++;
            }
          }
        }
      }
    }
  }
  if (staleCleaned > 0) logs.push(`🧹 Removed ${staleCleaned} stale OPEN record(s)`);
  if (ghostClosed > 0) logs.push(`🔄 Auto-closed ${ghostClosed} ghost position(s)`);

  // DEDUP open positions
  try {
    const freshOpen = ensureArray(await base44.asServiceRole.entities.Trade.filter(
      { profile_id: profileId }, '-date_open', 500
    )).filter((t) => !t.close_price && !t.date_close && t.external_id?.startsWith('BYBIT:OPEN:'));
    const openByExtId = new Map();
    for (const t of freshOpen) {
      const eid = t.external_id;
      if (!openByExtId.has(eid)) openByExtId.set(eid, []);
      openByExtId.get(eid).push(t);
    }
    let dedupCount = 0;
    for (const [eid, group] of openByExtId) {
      if (group.length > 1) {
        group.sort((a, b) => {
          if (a.tap_first_seen_ms && !b.tap_first_seen_ms) return -1;
          if (!a.tap_first_seen_ms && b.tap_first_seen_ms) return 1;
          return new Date(String(a.created_date || '0')).getTime() - new Date(String(b.created_date || '0')).getTime();
        });
        for (let i = 1; i < group.length; i++) {
          await base44.asServiceRole.entities.Trade.delete(group[i].id);
          dedupCount++;
        }
      }
    }
    if (dedupCount > 0) logs.push(`🔧 Dedup: removed ${dedupCount} duplicate open position(s)`);
  } catch (dedupErr) {
    logs.push(`⚠️ Dedup error: ${dedupErr.message}`);
  }

  // Junk cleanup
  const junkyPrefixes = ['open_', 'test_sync_'];
  let junkCleaned = 0;
  for (const t of allExistingTrades) {
    if (t.external_id && junkyPrefixes.some(p => t.external_id.startsWith(p))) {
      await base44.asServiceRole.entities.Trade.delete(t.id);
      junkCleaned++;
    }
  }
  if (junkCleaned > 0) logs.push(`🧹 Cleaned ${junkCleaned} junk records`);

  // Step: Funding fee sync
  // Fetch SETTLEMENT entries from Bybit transaction log and store as Trade records
  // so that sum(all trade pnl_usd) = walletBalance - startingBalance
  let fundingInserted = 0;
  try {
    const fundingStartMs = effectiveCursorMs > 0 ? effectiveCursorMs : (Date.now() - historyLimit * 24 * 3600 * 1000);
    const existingFundingKeys = new Set(
      allExistingTrades.filter(t => t.external_id?.startsWith('BYBIT:FUNDING:')).map(t => t.external_id)
    );
    const fundingToInsert = [];
    let fundingCursor = null;
    let fundingPage = 0;

    while (fundingPage < 10) {
      const fp = {
        accountType: 'UNIFIED',
        type: 'SETTLEMENT',
        coin: 'USDT',
        limit: '200',
        startTime: String(Math.floor(fundingStartMs)),
        ...(fundingCursor ? { cursor: fundingCursor } : {}),
      };
      const fh = await buildBybitHeaders(apiKey, apiSecret, fp);
      const fd = await relayCall(`${baseUrl}/v5/account/transaction-log`, 'GET', fh, fp);
      if (fd.retCode !== 0) break;
      const entries = fd.result?.list || [];
      if (entries.length === 0) break;

      for (const entry of entries) {
        const ts = parseInt(entry.transactionTime || '0');
        const amount = parseFloat(entry.change || entry.funding || entry.cashFlow || '0');
        const symbol = entry.symbol || 'USDT';
        const extId = `BYBIT:FUNDING:${ts}:${symbol}`;
        if (existingFundingKeys.has(extId)) continue;
        if (amount === 0) continue;
        fundingToInsert.push({
          profile_id: profileId,
          external_id: extId,
          import_source: 'bybit',
          coin: symbol,
          direction: 'Long',
          pnl_usd: amount,
          realized_pnl_usd: amount,
          risk_usd: 0,
          original_risk_usd: 0,
          r_multiple: 0,
          entry_reason: 'FUNDING_FEE',
          date_open: new Date(ts).toISOString(),
          date: new Date(ts).toISOString(),
          date_close: new Date(ts).toISOString(),
        });
      }

      fundingCursor = fd.result?.nextPageCursor;
      if (!fundingCursor || entries.length < 200) break;
      fundingPage++;
    }

    if (fundingToInsert.length > 0) {
      for (let i = 0; i < fundingToInsert.length; i += BATCH) {
        await base44.asServiceRole.entities.Trade.bulkCreate(fundingToInsert.slice(i, i + BATCH));
      }
      fundingInserted = fundingToInsert.length;
    }
    logs.push(`💸 Funding fees: ${fundingInserted} new records`);
  } catch (e) {
    logs.push(`⚠️ Funding sync failed: ${e.message}`);
  }

  return { currentBalance, currentEquity, inserted: toInsert.length, updated: toUpdate.length, newCursorMs, transferHistory };
}

// ── BINANCE FUTURES SYNC ──────────────────────────────────────────────────────

async function syncBinance(base44, conn, apiKey, apiSecret, options, logs) {
  const { importHistory, historyLimit, isInitialSync, effectiveCursorMs } = options;
  const profileId = conn.profile_id;
  const baseUrl = conn.base_url;
  let currentBalance = null;
  try {
    const { queryParams, headers } = await buildBinanceLikeParams(apiKey, apiSecret, {});
    const data = await relayCall(`${baseUrl}/fapi/v2/balance`, 'GET', headers, queryParams);
    if (Array.isArray(data)) {
      const usdt = data.find(a => a.asset === 'USDT');
      currentBalance = usdt ? parseFloat(usdt.balance) : null;
    }
    logs.push(`✅ Balance: ${currentBalance != null ? currentBalance.toFixed(2) + ' USDT' : 'N/A'}`);
  } catch (e) { logs.push(`⚠️ Balance failed: ${e.message}`); }

  const closedTrades = [];
  let newCursorMs = effectiveCursorMs;
  try {
    const params = { incomeType: 'REALIZED_PNL', limit: 1000 };
    if (effectiveCursorMs > 0) params.startTime = effectiveCursorMs;
    else if (importHistory) params.startTime = Date.now() - (historyLimit || 90) * 24 * 3600 * 1000;
    const { queryParams, headers } = await buildBinanceLikeParams(apiKey, apiSecret, params);
    const data = await relayCall(`${baseUrl}/fapi/v1/income`, 'GET', headers, queryParams);
    if (Array.isArray(data)) {
      closedTrades.push(...data);
      for (const t of data) { const ts = parseInt(t.time || 0); if (ts > newCursorMs) newCursorMs = ts; }
    }
    logs.push(`📥 Income history: ${closedTrades.length}`);
  } catch (e) { logs.push(`❌ Income history failed: ${e.message}`); }

  const liveOpenKeys = new Set();
  const openPositions = [];
  try {
    const { queryParams, headers } = await buildBinanceLikeParams(apiKey, apiSecret, {});
    const data = await relayCall(`${baseUrl}/fapi/v2/positionRisk`, 'GET', headers, queryParams);
    if (Array.isArray(data)) {
      for (const pos of data) {
        if (parseFloat(pos.positionAmt || 0) !== 0) {
          openPositions.push(pos);
          const side = parseFloat(pos.positionAmt) > 0 ? 'Long' : 'Short';
          liveOpenKeys.add(`BINANCE:OPEN:${pos.symbol}:${side}`);
        }
      }
    }
    logs.push(`✅ Open positions: ${openPositions.length}`);
  } catch (e) { logs.push(`❌ Open positions failed: ${e.message}`); }

  const allExistingTrades = ensureArray(await base44.asServiceRole.entities.Trade.filter({ profile_id: profileId }, '-date_open', 2000));
  const existingByKey = new Map();
  for (const t of allExistingTrades) {
    if (!t.external_id) continue;
    if (!existingByKey.has(t.external_id)) existingByKey.set(t.external_id, []);
    existingByKey.get(t.external_id).push(t);
    const normalizedId = normalizeExternalId(t.external_id);
    if (normalizedId !== t.external_id) {
      if (!existingByKey.has(normalizedId)) existingByKey.set(normalizedId, []);
      existingByKey.get(normalizedId).push(t);
    }
  }

  const orderGroups = new Map();
  for (const t of closedTrades) {
    const key = `BINANCE:TRADE:${t.symbol}:${t.orderId}`;
    if (!orderGroups.has(key)) orderGroups.set(key, []);
    orderGroups.get(key).push(t);
  }

  const toInsert = [], toUpdate = [];
  for (const [key, fills] of orderGroups) {
    const firstFill = fills[0];
    const totalPnl = fills.reduce((s, f) => s + parseFloat(f.realizedPnl || '0'), 0);
    if (totalPnl === 0 && fills.length === 1) continue;
    const totalQty = fills.reduce((s, f) => s + parseFloat(f.qty || '0'), 0);
    const weightedPrice = fills.reduce((s, f) => s + parseFloat(f.price || '0') * parseFloat(f.qty || '0'), 0) / totalQty;
    const closeTime = parseInt(firstFill.time || '0');
    const positionSide = firstFill.positionSide || '';
    const isBuyer = firstFill.buyer;
    const direction = positionSide === 'LONG' ? 'Long' : positionSide === 'SHORT' ? 'Short' : (!isBuyer ? 'Long' : 'Short');
    const tradeData = {
      profile_id: profileId, external_id: key, import_source: 'binance', coin: firstFill.symbol, direction,
      entry_price: weightedPrice, original_entry_price: weightedPrice, position_size: totalQty * weightedPrice,
      close_price: weightedPrice, pnl_usd: totalPnl, realized_pnl_usd: totalPnl,
      pnl_percent_of_balance: currentBalance ? (totalPnl / currentBalance) * 100 : 0,
      date_open: new Date(closeTime - 60000).toISOString(), date: new Date(closeTime - 60000).toISOString(),
      date_close: new Date(closeTime).toISOString(), account_balance_at_entry: currentBalance || 100000,
      actual_duration_minutes: 1,
    };
    const existing = existingByKey.get(key) || [];
    if (existing.length > 0) toUpdate.push({ id: existing[0].id, data: tradeData });
    else toInsert.push(tradeData);
  }

  const BATCH = 20;
  if (toInsert.length > 0) for (let i = 0; i < toInsert.length; i += BATCH) await base44.asServiceRole.entities.Trade.bulkCreate(toInsert.slice(i, i + BATCH));
  for (let i = 0; i < toUpdate.length; i += BATCH) await Promise.all(toUpdate.slice(i, i + BATCH).map(op => base44.asServiceRole.entities.Trade.update(op.id, op.data)));
  logs.push(`✅ Closed trades: ${toInsert.length} new, ${toUpdate.length} updated`);

  for (const pos of openPositions) {
    const posAmt = parseFloat(pos.positionAmt || 0);
    const side = posAmt > 0 ? 'Long' : 'Short';
    await upsertGenericOpenPosition(base44, {
      external_id: `BINANCE:OPEN:${pos.symbol}:${side}`, symbol: pos.symbol, direction: side,
      entry_price: parseFloat(pos.entryPrice || 0), size: Math.abs(posAmt),
      mark_price: parseFloat(pos.markPrice || pos.entryPrice || 0),
      stop_price: null, take_price: null, unrealized_pnl: parseFloat(pos.unRealizedProfit || 0),
      created_ms: 0, import_source: 'binance', partial_closes_json: null, force_reset_open: false,
    }, currentBalance, profileId, existingByKey, null);
  }

  let staleCleaned = 0;
  for (const t of allExistingTrades) {
    if (t.external_id?.startsWith('BINANCE:OPEN:') && !t.close_price && !liveOpenKeys.has(t.external_id)) {
      await base44.asServiceRole.entities.Trade.delete(t.id); staleCleaned++;
    }
  }
  if (staleCleaned > 0) logs.push(`🧹 Removed ${staleCleaned} stale OPEN record(s)`);

  return { currentBalance, currentEquity: currentBalance, inserted: toInsert.length, updated: toUpdate.length, newCursorMs };
}

// ── HYPERLIQUID SYNC ──────────────────────────────────────────────────────────

async function hlPost(payload) {
  const response = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`HL API error: ${response.status}`);
  return response.json();
}

async function syncHyperliquid(base44, conn, walletAddress, options, logs) {
  const { effectiveCursorMs } = options;
  const profileId = conn.profile_id;
  let currentBalance = null;
  let newCursorMs = effectiveCursorMs;

  let accountState = {};
  try {
    accountState = await hlPost({ type: 'clearinghouseState', user: walletAddress });
    currentBalance = parseFloat(accountState?.marginSummary?.accountValue || '0') || null;
    logs.push(`✅ Balance: ${currentBalance?.toFixed(2)} USD`);
  } catch(e) { logs.push(`⚠️ Account state: ${e.message}`); }

  const allExistingTrades = ensureArray(await base44.asServiceRole.entities.Trade.filter({ profile_id: profileId }, '-date_open', 2000));
  const existingByKey = new Map();
  for (const t of allExistingTrades) {
    const k = t.external_id;
    if (k) { if (!existingByKey.has(k)) existingByKey.set(k, []); existingByKey.get(k).push(t); }
  }

  const toInsert = [], toUpdate = [];
  try {
    const fills = await hlPost({ type: 'userFills', user: walletAddress });
    const filteredFills = Array.isArray(fills)
      ? fills.filter(f => effectiveCursorMs > 0 ? parseInt(f.time || '0') > effectiveCursorMs : true)
      : [];
    logs.push(`📥 Fills: ${filteredFills.length}`);
    const groups = new Map();
    for (const f of filteredFills) {
      const ts = parseInt(f.time || '0');
      if (ts > newCursorMs) newCursorMs = ts;
      const direction = f.side === 'B' ? 'Long' : 'Short';
      const key = `HL:FILL:${f.coin}:${direction}:${f.oid || ts}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(f);
    }
    for (const [key, fills] of groups) {
      const first = fills[0];
      const totalPnl = fills.reduce((s, f) => s + parseFloat(f.closedPnl || '0'), 0);
      const totalSz = fills.reduce((s, f) => s + parseFloat(f.sz || '0'), 0);
      const avgPx = fills.reduce((s, f) => s + parseFloat(f.px || '0') * parseFloat(f.sz || '0'), 0) / (totalSz || 1);
      const ts = parseInt(first.time || '0');
      const direction = first.side === 'B' ? 'Long' : 'Short';
      const tradeData = {
        profile_id: profileId, external_id: key, import_source: 'hyperliquid',
        coin: `${first.coin}-PERP`, direction, entry_price: avgPx, original_entry_price: avgPx,
        position_size: totalSz * avgPx, close_price: avgPx, pnl_usd: totalPnl, realized_pnl_usd: totalPnl,
        pnl_percent_of_balance: currentBalance ? (totalPnl / currentBalance) * 100 : 0,
        date_open: new Date(ts - 60000).toISOString(), date: new Date(ts - 60000).toISOString(),
        date_close: new Date(ts).toISOString(), account_balance_at_entry: currentBalance || 10000,
        actual_duration_minutes: 1,
      };
      const existing = existingByKey.get(key) || [];
      if (existing.length > 0) toUpdate.push({ id: existing[0].id, data: tradeData });
      else toInsert.push(tradeData);
    }
  } catch(e) { logs.push(`❌ Fills: ${e.message}`); }

  const liveOpenKeys = new Set();
  try {
    const positions = accountState?.assetPositions || [];
    for (const p of positions) {
      const pos = p.position;
      if (!pos || parseFloat(pos.szi || '0') === 0) continue;
      const direction = parseFloat(pos.szi) > 0 ? 'Long' : 'Short';
      const openKey = `HL:OPEN:${pos.coin}:${direction}`;
      liveOpenKeys.add(openKey);
      await upsertGenericOpenPosition(base44, {
        external_id: openKey, symbol: `${pos.coin}-PERP`, direction,
        entry_price: parseFloat(pos.entryPx || '0'), size: Math.abs(parseFloat(pos.szi || '0')),
        mark_price: parseFloat(pos.entryPx || '0'), stop_price: null, take_price: null,
        unrealized_pnl: parseFloat(pos.unrealizedPnl || '0'), realized_pnl_usd: 0,
        created_ms: 0, import_source: 'hyperliquid', partial_closes_json: null, force_reset_open: false,
      }, currentBalance, profileId, existingByKey, null);
    }
    logs.push(`✅ Open positions: ${liveOpenKeys.size}`);
  } catch(e) { logs.push(`❌ Open positions: ${e.message}`); }

  for (const t of allExistingTrades) {
    if (t.external_id?.startsWith('HL:OPEN:') && !t.close_price && !liveOpenKeys.has(t.external_id)) {
      await base44.asServiceRole.entities.Trade.delete(t.id);
    }
  }

  const BATCH = 20;
  if (toInsert.length > 0) for (let i = 0; i < toInsert.length; i += BATCH) await base44.asServiceRole.entities.Trade.bulkCreate(toInsert.slice(i, i+BATCH));
  for (let i = 0; i < toUpdate.length; i += BATCH) await Promise.all(toUpdate.slice(i, i+BATCH).map(op => base44.asServiceRole.entities.Trade.update(op.id, op.data)));
  logs.push(`✅ Trades: ${toInsert.length} new, ${toUpdate.length} updated`);

  return { currentBalance, currentEquity: currentBalance, inserted: toInsert.length, updated: toUpdate.length, newCursorMs };
}

// ── BINGX SYNC ────────────────────────────────────────────────────────────────

async function syncBingX(base44, conn, apiKey, apiSecret, options, logs) {
  const { importHistory, historyLimit, effectiveCursorMs } = options;
  const profileId = conn.profile_id;
  const baseUrl = conn.base_url || 'https://open-api.bingx.com';
  let currentBalance = null;
  let newCursorMs = effectiveCursorMs;

  try {
    const { headers, queryParams } = await buildBingXParams(apiKey, apiSecret, {});
    const d = await relayCall(`${baseUrl}/openApi/swap/v2/user/balance`, 'GET', headers, queryParams);
    currentBalance = parseFloat(d?.data?.balance?.equity || d?.data?.balance?.balance || '0') || null;
    logs.push(`✅ Balance: ${currentBalance?.toFixed(2)} USDT`);
  } catch(e) { logs.push(`⚠️ Balance: ${e.message}`); }

  const allExistingTrades = ensureArray(await base44.asServiceRole.entities.Trade.filter({ profile_id: profileId }, '-date_open', 2000));
  const existingByKey = new Map();
  for (const t of allExistingTrades) {
    const k = t.external_id;
    if (k) { if (!existingByKey.has(k)) existingByKey.set(k, []); existingByKey.get(k).push(t); }
  }

  const toInsert = [], toUpdate = [];
  try {
    const params = {};
    if (effectiveCursorMs > 0) params.startTs = effectiveCursorMs;
    else if (importHistory) params.startTs = Date.now() - (historyLimit || 90) * 24 * 3600 * 1000;
    params.limit = 100;
    const { headers, queryParams } = await buildBingXParams(apiKey, apiSecret, params);
    const d = await relayCall(`${baseUrl}/openApi/swap/v2/trade/fillHistory`, 'GET', headers, queryParams);
    const fills = d?.data?.fill_history_orders || d?.data?.fill_history || d?.data?.trades || [];
    logs.push(`📥 Fill history: ${fills.length}`);
    const groups = new Map();
    for (const f of fills) {
      const oid = f.orderId || f.tradeId;
      if (!groups.has(oid)) groups.set(oid, []);
      groups.get(oid).push(f);
    }
    for (const [oid, fills] of groups) {
      const first = fills[0];
      const totalPnl = fills.reduce((s, f) => s + parsePnl(f), 0);
      const totalQty = fills.reduce((s, f) => s + parseQty(f), 0);
      const avgPrice = fills.reduce((s, f) => s + parsePrice(f) * parseQty(f), 0) / (totalQty || 1);
      const ts = parseTimestamp(first);
      if (ts > newCursorMs) newCursorMs = ts;
      const direction = resolveDirection(first.side || first.positionSide || first.posSide);
      const key = `BINGX:POS:${first.symbol}:${direction}:${avgPrice.toFixed(4)}`;
      const tradeData = {
        profile_id: profileId, external_id: key, import_source: 'bingx', coin: first.symbol, direction,
        entry_price: avgPrice, original_entry_price: avgPrice, position_size: totalQty * avgPrice,
        close_price: avgPrice, pnl_usd: totalPnl, realized_pnl_usd: totalPnl,
        pnl_percent_of_balance: currentBalance ? (totalPnl / currentBalance) * 100 : 0,
        date_open: new Date(ts - 60000).toISOString(), date: new Date(ts - 60000).toISOString(),
        date_close: new Date(ts).toISOString(), account_balance_at_entry: currentBalance || 100000,
        actual_duration_minutes: 1,
      };
      const existing = existingByKey.get(key) || [];
      if (existing.length > 0) toUpdate.push({ id: existing[0].id, data: tradeData });
      else toInsert.push(tradeData);
    }
  } catch(e) { logs.push(`❌ Fill history: ${e.message}`); }

  const liveOpenKeys = new Set();
  try {
    const { headers, queryParams } = await buildBingXParams(apiKey, apiSecret, {});
    const d = await relayCall(`${baseUrl}/openApi/swap/v2/user/positions`, 'GET', headers, queryParams);
    const positions = d?.data || [];
    for (const pos of positions) {
      if (parseFloat(pos.positionAmt || pos.volume || '0') === 0) continue;
      const direction = parseFloat(pos.positionAmt || pos.volume || '0') > 0 ? 'Long' : 'Short';
      const openKey = `BINGX:OPEN:${pos.symbol}:${direction}`;
      liveOpenKeys.add(openKey);
      await upsertGenericOpenPosition(base44, {
        external_id: openKey, symbol: pos.symbol, direction,
        entry_price: parseFloat(pos.avgPrice || pos.entryPrice || 0),
        size: Math.abs(parseFloat(pos.positionAmt || pos.volume || '0')),
        mark_price: parseFloat(pos.markPrice || pos.avgPrice || 0),
        stop_price: parseSL(pos), take_price: parseTP(pos),
        unrealized_pnl: parseFloat(pos.unrealizedProfit || pos.unrealisedPnl || pos.unRealizedProfit || '0'),
        realized_pnl_usd: parseFloat(pos.realisedProfit || pos.realizedProfit || '0'),
        created_ms: 0, import_source: 'bingx', partial_closes_json: null, force_reset_open: false,
      }, currentBalance, profileId, existingByKey, null);
    }
    logs.push(`✅ Open positions: ${positions.length}`);
  } catch(e) { logs.push(`❌ Open positions: ${e.message}`); }

  for (const t of allExistingTrades) {
    if (t.external_id?.startsWith('BINGX:OPEN:') && !t.close_price && !liveOpenKeys.has(t.external_id)) {
      await base44.asServiceRole.entities.Trade.delete(t.id);
    }
  }

  const BATCH = 20;
  if (toInsert.length > 0) for (let i = 0; i < toInsert.length; i += BATCH) await base44.asServiceRole.entities.Trade.bulkCreate(toInsert.slice(i, i+BATCH));
  for (let i = 0; i < toUpdate.length; i += BATCH) await Promise.all(toUpdate.slice(i, i+BATCH).map(op => base44.asServiceRole.entities.Trade.update(op.id, op.data)));
  logs.push(`✅ Trades: ${toInsert.length} new, ${toUpdate.length} updated`);

  return { currentBalance, currentEquity: currentBalance, inserted: toInsert.length, updated: toUpdate.length, newCursorMs };
}

// ── OKX SYNC ──────────────────────────────────────────────────────────────────

async function syncOKX(base44, conn, apiKey, apiSecret, passphrase, options, logs) {
  const { importHistory, historyLimit, effectiveCursorMs } = options;
  const profileId = conn.profile_id;
  const baseUrl = conn.base_url || 'https://www.okx.com';
  let currentBalance = null;
  let newCursorMs = effectiveCursorMs;

  try {
    const path = '/api/v5/account/balance?ccy=USDT';
    const h = await buildOKXHeaders(apiKey, apiSecret, passphrase, 'GET', path);
    const d = await relayCall(`${baseUrl}${path}`, 'GET', h, {});
    const details = d?.data?.[0]?.details || [];
    const usdt = details.find(c => c.ccy === 'USDT');
    currentBalance = usdt ? parseFloat(usdt.eq) : null;
    logs.push(`✅ Balance: ${currentBalance?.toFixed(2)} USDT`);
  } catch(e) { logs.push(`⚠️ Balance: ${e.message}`); }

  const allExistingTradesOkx = ensureArray(await base44.asServiceRole.entities.Trade.filter({ profile_id: profileId }, '-date_open', 2000));
  const existingByKey = new Map();
  for (const t of allExistingTradesOkx) {
    const k = t.external_id;
    if (k) { if (!existingByKey.has(k)) existingByKey.set(k, []); existingByKey.get(k).push(t); }
  }
  // FIX: same stale-cTime correction as Bybit — detect re-opened positions
  const okxLastCloseBySymbol = new Map<string, number>();
  for (const t of allExistingTrades) {
    if (t.external_id?.startsWith('OKX:POS:') && t.close_price && t.date_close && t.coin) {
      const ms = new Date(String(t.date_close)).getTime();
      if (ms > (okxLastCloseBySymbol.get(t.coin) || 0)) okxLastCloseBySymbol.set(t.coin, ms);
    }
  }

  const toInsert = [], toUpdate = [];
  try {
    const after = effectiveCursorMs > 0 ? `&after=${effectiveCursorMs}` : '';
    const path = `/api/v5/trade/orders-history-archive?instType=SWAP&limit=100${after}`;
    const h = await buildOKXHeaders(apiKey, apiSecret, passphrase, 'GET', path);
    const d = await relayCall(`${baseUrl}${path}`, 'GET', h, {});
    const orders = d?.data || [];
    logs.push(`📥 Closed orders: ${orders.length}`);
    for (const o of orders) {
      if (o.state !== 'filled') continue;
      const ts = parseInt(o.uTime || o.cTime || '0');
      if (ts > newCursorMs) newCursorMs = ts;
      const pnl = parseFloat(o.pnl || '0');
      const avgPx = parseFloat(o.avgPx || '0');
      const sz = parseFloat(o.sz || '0');
      const direction = o.posSide && o.posSide !== 'net' ? resolveDirection(o.posSide) : resolveDirection(o.side === 'buy' ? (o.posSide === 'short' ? 'Short' : 'Long') : 'Short');
      const key = `OKX:POS:${o.instId}:${direction}:${o.ordId}`;
      const tradeData = {
        profile_id: profileId, external_id: key, import_source: 'okx', coin: o.instId, direction,
        entry_price: avgPx, original_entry_price: avgPx, position_size: sz * avgPx, close_price: avgPx,
        pnl_usd: pnl, realized_pnl_usd: pnl, pnl_percent_of_balance: currentBalance ? (pnl / currentBalance) * 100 : 0,
        date_open: new Date(parseInt(o.cTime || ts) - 60000).toISOString(), date: new Date(parseInt(o.cTime || ts) - 60000).toISOString(),
        date_close: new Date(ts).toISOString(), account_balance_at_entry: currentBalance || 100000,
        actual_duration_minutes: Math.max(1, Math.floor((ts - parseInt(o.cTime || ts)) / 60000)),
      };
      const existing = existingByKey.get(key) || [];
      if (existing.length > 0) toUpdate.push({ id: existing[0].id, data: tradeData });
      else toInsert.push(tradeData);
    }
  } catch(e) { logs.push(`❌ Closed orders: ${e.message}`); }

  const liveOpenKeys = new Set();
  try {
    const path = '/api/v5/account/positions?instType=SWAP';
    const h = await buildOKXHeaders(apiKey, apiSecret, passphrase, 'GET', path);
    const d = await relayCall(`${baseUrl}${path}`, 'GET', h, {});
    for (const pos of (d?.data || [])) {
      if (parseFloat(pos.pos || '0') === 0) continue;
      const direction = pos.posSide === 'net' ? resolveDirection(pos.pos) : resolveDirection(pos.posSide);
      const openKey = `OKX:OPEN:${pos.instId}:${direction}`;
      liveOpenKeys.add(openKey);
      await upsertGenericOpenPosition(base44, {
        external_id: openKey, symbol: pos.instId, direction, entry_price: parseFloat(pos.avgPx || '0'),
        size: Math.abs(parseFloat(pos.pos || '0')), mark_price: parseFloat(pos.markPx || pos.avgPx || '0'),
        stop_price: parseFloat(pos.stopLoss || '0') || null, take_price: parseFloat(pos.takeProfit || '0') || null,
        unrealized_pnl: parseFloat(pos.upl || '0'), realized_pnl_usd: parseFloat(pos.realizedPnl || '0'),
        created_ms: (() => { const ct = parseInt(pos.cTime || '0'); const ut = parseInt(pos.uTime || '0'); const lastClose = okxLastCloseBySymbol.get(pos.instId) || 0; if (ct > 0 && lastClose > 0 && ct < lastClose) return (ut > lastClose ? ut : Date.now()); return ct || ut || 0; })(), import_source: 'okx', partial_closes_json: null, force_reset_open: false,
      }, currentBalance, profileId, existingByKey, null);
    }
    logs.push(`✅ Open positions: ${liveOpenKeys.size}`);
  } catch(e) { logs.push(`❌ Open positions: ${e.message}`); }

  for (const t of allExistingTradesOkx) {
    if (t.external_id?.startsWith('OKX:OPEN:') && !t.close_price && !liveOpenKeys.has(t.external_id)) {
      await base44.asServiceRole.entities.Trade.delete(t.id);
    }
  }

  const BATCH = 20;
  if (toInsert.length > 0) for (let i = 0; i < toInsert.length; i += BATCH) await base44.asServiceRole.entities.Trade.bulkCreate(toInsert.slice(i, i+BATCH));
  for (let i = 0; i < toUpdate.length; i += BATCH) await Promise.all(toUpdate.slice(i, i+BATCH).map(op => base44.asServiceRole.entities.Trade.update(op.id, op.data)));
  logs.push(`✅ Trades: ${toInsert.length} new, ${toUpdate.length} updated`);

  return { currentBalance, currentEquity: currentBalance, inserted: toInsert.length, updated: toUpdate.length, newCursorMs };
}

// ── BITGET SYNC ───────────────────────────────────────────────────────────────

async function syncBitget(base44, conn, apiKey, apiSecret, passphrase, options, logs) {
  const { importHistory, historyLimit, effectiveCursorMs } = options;
  const profileId = conn.profile_id;
  const baseUrl = conn.base_url || 'https://api.bitget.com';
  let currentBalance = null;
  let newCursorMs = effectiveCursorMs;

  try {
    const path = '/api/v2/mix/account/accounts?productType=USDT-FUTURES';
    const h = await buildBitgetHeaders(apiKey, apiSecret, passphrase, 'GET', path);
    const d = await relayCall(`${baseUrl}${path}`, 'GET', h, {});
    const accs = d?.data || [];
    const usdt = accs.find(a => a.marginCoin === 'USDT');
    currentBalance = usdt ? parseFloat(usdt.equity || usdt.available) : null;
    logs.push(`✅ Balance: ${currentBalance?.toFixed(2)} USDT`);
  } catch(e) { logs.push(`⚠️ Balance: ${e.message}`); }

  const allExistingTradesBitget = ensureArray(await base44.asServiceRole.entities.Trade.filter({ profile_id: profileId }, '-date_open', 2000));
  const existingByKey = new Map();
  for (const t of allExistingTradesBitget) {
    const k = t.external_id;
    if (k) { if (!existingByKey.has(k)) existingByKey.set(k, []); existingByKey.get(k).push(t); }
  }
  // FIX: stale-cTime correction for re-opened positions (same as Bybit/OKX)
  const bitgetLastCloseBySymbol = new Map<string, number>();
  for (const t of allExistingTradesBitget) {
    if (t.external_id?.startsWith('BITGET:POS:') && t.close_price && t.date_close && t.coin) {
      const ms = new Date(String(t.date_close)).getTime();
      if (ms > (bitgetLastCloseBySymbol.get(t.coin) || 0)) bitgetLastCloseBySymbol.set(t.coin, ms);
    }
  }

  const toInsert = [], toUpdate = [];
  try {
    const startTime = effectiveCursorMs > 0 ? effectiveCursorMs : Date.now() - (historyLimit || 90) * 24 * 3600 * 1000;
    const path = `/api/v2/mix/position/history-position?productType=USDT-FUTURES&startTime=${startTime}&limit=100`;
    const h = await buildBitgetHeaders(apiKey, apiSecret, passphrase, 'GET', path);
    const d = await relayCall(`${baseUrl}${path}`, 'GET', h, {});
    const positions = d?.data?.list || d?.data || [];
    logs.push(`📥 Closed positions: ${positions.length}`);
    for (const p of positions) {
      const ts = parseInt(p.cTime || p.uTime || '0');
      if (ts > newCursorMs) newCursorMs = ts;
      const pnl = parsePnl(p);
      const avgEntry = parsePrice(p);
      const direction = resolveDirection(p.holdSide || p.side);
      const key = `BITGET:POS:${p.symbol}:${direction}:${p.orderId || ts}`;
      const tradeData = {
        profile_id: profileId, external_id: key, import_source: 'bitget', coin: p.symbol, direction,
        entry_price: avgEntry, original_entry_price: avgEntry,
        position_size: parseFloat(p.openTotalPos || '0') * avgEntry,
        close_price: parseFloat(p.closePriceAvg || avgEntry.toString()),
        pnl_usd: pnl, realized_pnl_usd: pnl, pnl_percent_of_balance: currentBalance ? (pnl / currentBalance) * 100 : 0,
        date_open: new Date(parseInt(p.openTime || ts)).toISOString(), date: new Date(parseInt(p.openTime || ts)).toISOString(),
        date_close: new Date(ts).toISOString(), account_balance_at_entry: currentBalance || 100000,
        actual_duration_minutes: Math.max(1, Math.floor((ts - parseInt(p.openTime || ts)) / 60000)),
      };
      const existing = existingByKey.get(key) || [];
      if (existing.length > 0) toUpdate.push({ id: existing[0].id, data: tradeData });
      else toInsert.push(tradeData);
    }
  } catch(e) { logs.push(`❌ Closed positions: ${e.message}`); }

  const liveOpenKeys = new Set();
  try {
    const path = '/api/v2/mix/position/all-position?productType=USDT-FUTURES&marginCoin=USDT';
    const h = await buildBitgetHeaders(apiKey, apiSecret, passphrase, 'GET', path);
    const d = await relayCall(`${baseUrl}${path}`, 'GET', h, {});
    for (const pos of (d?.data || [])) {
      if (parseFloat(pos.total || '0') === 0) continue;
      const direction = resolveDirection(pos.holdSide);
      const openKey = `BITGET:OPEN:${pos.symbol}:${direction}`;
      liveOpenKeys.add(openKey);
      await upsertGenericOpenPosition(base44, {
        external_id: openKey, symbol: pos.symbol, direction,
        entry_price: parseFloat(pos.openPriceAvg || '0'), size: parseFloat(pos.total || '0'),
        mark_price: parseFloat(pos.markPrice || pos.openPriceAvg || '0'),
        stop_price: parseSL(pos), take_price: parseTP(pos),
        unrealized_pnl: parseFloat(pos.unrealizedPL || '0'),
        realized_pnl_usd: parseFloat(pos.achievedProfits || '0'),
        created_ms: (() => { const ct = parseInt(pos.cTime || '0'); const ut = parseInt(pos.uTime || pos.mTime || '0'); const lastClose = bitgetLastCloseBySymbol.get(pos.symbol) || 0; if (ct > 0 && lastClose > 0 && ct < lastClose) return (ut > lastClose ? ut : Date.now()); return ct || ut || 0; })(), import_source: 'bitget', partial_closes_json: null, force_reset_open: false,
      }, currentBalance, profileId, existingByKey, null);
    }
    logs.push(`✅ Open positions: ${liveOpenKeys.size}`);
  } catch(e) { logs.push(`❌ Open positions: ${e.message}`); }

  for (const t of allExistingTradesBitget) {
    if (t.external_id?.startsWith('BITGET:OPEN:') && !t.close_price && !liveOpenKeys.has(t.external_id)) {
      await base44.asServiceRole.entities.Trade.delete(t.id);
    }
  }

  const BATCH = 20;
  if (toInsert.length > 0) for (let i = 0; i < toInsert.length; i += BATCH) await base44.asServiceRole.entities.Trade.bulkCreate(toInsert.slice(i, i+BATCH));
  for (let i = 0; i < toUpdate.length; i += BATCH) await Promise.all(toUpdate.slice(i, i+BATCH).map(op => base44.asServiceRole.entities.Trade.update(op.id, op.data)));
  logs.push(`✅ Trades: ${toInsert.length} new, ${toUpdate.length} updated`);

  return { currentBalance, currentEquity: currentBalance, inserted: toInsert.length, updated: toUpdate.length, newCursorMs };
}

// ── MEXC SYNC ─────────────────────────────────────────────────────────────────

async function syncMEXC(base44, conn, apiKey, apiSecret, options, logs) {
  const { importHistory, historyLimit, effectiveCursorMs } = options;
  const profileId = conn.profile_id;
  const baseUrl = conn.base_url || 'https://contract.mexc.com';
  let currentBalance = null;
  let newCursorMs = effectiveCursorMs;

  try {
    const { headers } = await buildMEXCHeaders(apiKey, apiSecret, '');
    const d = await relayCall(`${baseUrl}/api/v1/private/account/assets`, 'GET', headers, {});
    const assets = d?.data || [];
    const usdt = Array.isArray(assets) ? assets.find(a => a.currency === 'USDT') : null;
    currentBalance = usdt ? parseFloat(usdt.equity || usdt.availableBalance || '0') : null;
    logs.push(`✅ Balance: ${currentBalance?.toFixed(2)} USDT`);
  } catch(e) { logs.push(`⚠️ Balance: ${e.message}`); }

  const allExistingTrades = ensureArray(await base44.asServiceRole.entities.Trade.filter({ profile_id: profileId }, '-date_open', 2000));
  const existingByKey = new Map();
  for (const t of allExistingTrades) {
    const k = t.external_id;
    if (k) { if (!existingByKey.has(k)) existingByKey.set(k, []); existingByKey.get(k).push(t); }
  }

  const toInsert = [], toUpdate = [];
  try {
    const startTime = effectiveCursorMs > 0 ? effectiveCursorMs : Date.now() - (historyLimit || 90) * 24 * 3600 * 1000;
    const reqParam = `start_time=${startTime}&page_size=100`;
    const { headers } = await buildMEXCHeaders(apiKey, apiSecret, reqParam);
    const d = await relayCall(`${baseUrl}/api/v1/private/order/list/history_orders?${reqParam}`, 'GET', headers, {});
    const orders = d?.data?.resultList || d?.data || [];
    logs.push(`📥 Order history: ${orders.length}`);
    for (const o of orders) {
      if (o.state !== 'FILLED') continue;
      const ts = parseInt(o.updateTime || o.createTime || '0');
      if (ts > newCursorMs) newCursorMs = ts;
      const pnl = parsePnl(o);
      const avgPx = parseFloat(o.dealAvgPrice || o.price || '0');
      const qty = parseFloat(o.dealVol || o.vol || '0');
      const direction = resolveDirection(o.side || o.openType);
      const key = `MEXC:POS:${o.symbol}:${direction}:${o.orderId || ts}`;
      const tradeData = {
        profile_id: profileId, external_id: key, import_source: 'mexc', coin: o.symbol, direction,
        entry_price: avgPx, original_entry_price: avgPx, position_size: qty * avgPx, close_price: avgPx,
        pnl_usd: pnl, realized_pnl_usd: pnl, pnl_percent_of_balance: currentBalance ? (pnl / currentBalance) * 100 : 0,
        date_open: new Date(parseInt(o.createTime || ts)).toISOString(), date: new Date(parseInt(o.createTime || ts)).toISOString(),
        date_close: new Date(ts).toISOString(), account_balance_at_entry: currentBalance || 100000,
        actual_duration_minutes: 1,
      };
      const existing = existingByKey.get(key) || [];
      if (existing.length > 0) toUpdate.push({ id: existing[0].id, data: tradeData });
      else toInsert.push(tradeData);
    }
  } catch(e) { logs.push(`❌ Order history: ${e.message}`); }

  const liveOpenKeys = new Set();
  try {
    const { headers } = await buildMEXCHeaders(apiKey, apiSecret, '');
    const d = await relayCall(`${baseUrl}/api/v1/private/position/open_positions`, 'GET', headers, {});
    for (const pos of (d?.data || [])) {
      if (parseFloat(pos.vol || '0') === 0) continue;
      const direction = resolveDirection(pos.positionType || pos.holdSide || pos.side);
      const openKey = `MEXC:OPEN:${pos.symbol}:${direction}`;
      liveOpenKeys.add(openKey);
      await upsertGenericOpenPosition(base44, {
        external_id: openKey, symbol: pos.symbol, direction,
        entry_price: parseFloat(pos.openAvgPrice || '0'), size: parseFloat(pos.vol || '0'),
        mark_price: parseFloat(pos.closeAvgPrice || pos.openAvgPrice || '0'),
        stop_price: null, take_price: null,
        unrealized_pnl: parseFloat(pos.unrealizedValue || '0'),
        realized_pnl_usd: parseFloat(pos.realised || '0'),
        created_ms: 0, import_source: 'mexc', partial_closes_json: null, force_reset_open: false,
      }, currentBalance, profileId, existingByKey, null);
    }
    logs.push(`✅ Open positions: ${liveOpenKeys.size}`);
  } catch(e) { logs.push(`❌ Open positions: ${e.message}`); }

  for (const t of allExistingTrades) {
    if (t.external_id?.startsWith('MEXC:OPEN:') && !t.close_price && !liveOpenKeys.has(t.external_id)) {
      await base44.asServiceRole.entities.Trade.delete(t.id);
    }
  }

  const BATCH = 20;
  if (toInsert.length > 0) for (let i = 0; i < toInsert.length; i += BATCH) await base44.asServiceRole.entities.Trade.bulkCreate(toInsert.slice(i, i+BATCH));
  for (let i = 0; i < toUpdate.length; i += BATCH) await Promise.all(toUpdate.slice(i, i+BATCH).map(op => base44.asServiceRole.entities.Trade.update(op.id, op.data)));
  logs.push(`✅ Trades: ${toInsert.length} new, ${toUpdate.length} updated`);

  return { currentBalance, currentEquity: currentBalance, inserted: toInsert.length, updated: toUpdate.length, newCursorMs };
}

// ── MAIN HANDLER ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const logs = [];
  let transferHistory = [];

  try {
    const base44 = createClientFromRequest(req);
    const authHeader = req.headers.get('authorization') || '';
    const auth = await resolveAuth(base44, authHeader);
    if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { connection_id, cutoff_override_ms, history_limit, force_reimport } = body;
    if (!connection_id) return Response.json({ error: 'connection_id required' }, { status: 400 });

    let connections = ensureArray(await base44.asServiceRole.entities.ExchangeConnection.filter({ id: connection_id }));
    let conn = connections[0];
    if (!conn) return Response.json({ error: 'Connection not found' }, { status: 404 });

    const userProfiles = auth.profiles || ensureArray(await base44.asServiceRole.entities.UserProfile.filter({ created_by: auth.email }));
    if (!userProfiles.find(p => p.id === conn.profile_id)) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    if (cutoff_override_ms) {
      await base44.asServiceRole.entities.ExchangeConnection.update(connection_id, {
        sync_cursor_ms: cutoff_override_ms, import_history: false, initial_sync_done: false,
      });
      const updatedConns = ensureArray(await base44.asServiceRole.entities.ExchangeConnection.filter({ id: connection_id }));
      if (updatedConns[0]) conn = updatedConns[0];
    }

    if (force_reimport) {
      await base44.asServiceRole.entities.ExchangeConnection.update(connection_id, {
        initial_sync_done: false, sync_cursor_ms: 0, import_history: true,
      });
      const updatedConns = ensureArray(await base44.asServiceRole.entities.ExchangeConnection.filter({ id: connection_id }));
      if (updatedConns[0]) conn = updatedConns[0];
      logs.push(`🔄 Force reimport requested — resetting sync state (upsert-only, no purge)`);
    }

    const apiKey = await decryptValue(conn.api_key_enc);
    const apiSecret = await decryptValue(conn.api_secret_enc);
    const apiPassphrase = conn.api_passphrase_enc ? await decryptValue(conn.api_passphrase_enc) : '';

    await base44.asServiceRole.entities.ExchangeConnection.update(connection_id, { last_status: 'syncing' });

    const importHistory = conn.import_history !== false;
    const connectedAtMs = Number(conn.connected_at_ms || Date.now());
    const isInitialSync = !conn.initial_sync_done;
    const exchangeName = conn.exchange || 'bybit';

    const rawHistoryLimit = Number(conn.history_limit || (exchangeName === 'bybit' ? 90 : 500));
    const historyLimitN = exchangeName === 'bybit'
      ? Math.max(7, Math.min(365, rawHistoryLimit))
      : Math.max(100, Math.min(2000, rawHistoryLimit));

    const historyLimitMode = history_limit && history_limit > 0;
    const historyLimitOverride = historyLimitMode
      ? (exchangeName === 'bybit' ? Math.min(parseInt(history_limit), 365) : Math.min(parseInt(history_limit), 2000))
      : null;

    let effectiveCursorMs = conn.sync_cursor_ms || 0;
    if (!importHistory && (!effectiveCursorMs || effectiveCursorMs === 0)) {
      effectiveCursorMs = connectedAtMs;
      logs.push(`⏱️ Import mode: new-only`);
    }

    logs.push(`📅 History limit: ${historyLimitOverride ?? historyLimitN} ${exchangeName === 'bybit' ? 'days' : 'trades'}`);

    const syncOptions = {
      importHistory, historyLimit: historyLimitOverride ?? historyLimitN,
      connectedAtMs, isInitialSync, effectiveCursorMs,
      historyLimitMode: !!historyLimitMode, historyLimitN: historyLimitOverride,
    };

    logs.push(`🔄 Syncing exchange: ${exchangeName} | mode: ${conn.mode} [syncExchangeConnectionV2]`);

    let result;
    switch (exchangeName) {
      case 'bybit':
        result = await syncBybit(base44, conn, apiKey, apiSecret, syncOptions, logs);
        if (result.transferHistory) transferHistory = result.transferHistory;
        break;
      case 'binance':
        result = await syncBinance(base44, conn, apiKey, apiSecret, syncOptions, logs);
        break;
      case 'hyperliquid':
        result = await syncHyperliquid(base44, conn, apiKey, syncOptions, logs);
        break;
      case 'bingx':
        result = await syncBingX(base44, conn, apiKey, apiSecret, syncOptions, logs);
        break;
      case 'okx':
        result = await syncOKX(base44, conn, apiKey, apiSecret, apiPassphrase, syncOptions, logs);
        break;
      case 'bitget':
        result = await syncBitget(base44, conn, apiKey, apiSecret, apiPassphrase, syncOptions, logs);
        break;
      case 'mexc':
        result = await syncMEXC(base44, conn, apiKey, apiSecret, syncOptions, logs);
        break;
      default:
        return Response.json({ error: `Exchange ${exchangeName} not yet supported in V2.`, logs }, { status: 400 });
    }

    await base44.asServiceRole.entities.ExchangeConnection.update(connection_id, {
      last_status: 'ok',
      last_error: null,
      last_sync_at: new Date().toISOString(),
      sync_cursor_ms: result.newCursorMs > 0 ? result.newCursorMs : effectiveCursorMs,
      initial_sync_done: !isInitialSync || (result.inserted + result.updated) >= 0,
      ...(result.currentBalance != null ? { current_balance: result.currentBalance } : {}),
      ...(result.currentEquity != null ? { current_equity: result.currentEquity } : {}),
      ...(transferHistory.length > 0 ? { transfer_history: JSON.stringify(transferHistory) } : {}),
    });

    if (isInitialSync && result.currentBalance != null && result.currentBalance > 0) {
      try {
        const profiles = ensureArray(await base44.asServiceRole.entities.UserProfile.filter({ id: conn.profile_id }));
        const profile = profiles[0];
        if (profile && (!profile.starting_balance || profile.starting_balance === 100000)) {
          await base44.asServiceRole.entities.UserProfile.update(profile.id, { starting_balance: result.currentBalance });
          logs.push(`✅ starting_balance set to ${result.currentBalance.toFixed(2)} from first sync`);
        }
      } catch(e) { logs.push(`⚠️ Could not set starting_balance: ${e.message}`); }
    }

    return Response.json({
      ok: true, exchange: exchangeName, balance: result.currentBalance,
      inserted: result.inserted, updated: result.updated, skipped: 0, logs,
    });

  } catch (error) {
    console.error('[syncExchangeConnectionV2]', error);
    return Response.json({ error: error.message, logs }, { status: 500 });
  }
});