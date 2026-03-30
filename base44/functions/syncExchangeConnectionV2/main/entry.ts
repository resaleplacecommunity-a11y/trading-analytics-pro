import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// SDK compat helper: .filter() may return array or {results:[]} depending on version
function ensureArray(result) {
  if (Array.isArray(result)) return result;
  if (result?.results) return result.results;
  if (result?.items) return result.items;
  return [];
}

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

// ── HMAC helpers ───────────────────────────────────────────────────────────────

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

// ── Exchange domain allowlist ──────────────────────────────────────────────────

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

// ── Relay call ─────────────────────────────────────────────────────────────────

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

// ── Auth resolution ────────────────────────────────────────────────────────────

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

// ══════════════════════════════════════════════════════════════════════════════
// ── SIGNING HELPERS ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

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

async function buildMEXCParams(apiKey, apiSecret, params) {
  const timestamp = Date.now().toString();
  const recvWindow = '5000';
  const allParams = { ...params, timestamp, recvWindow };
  const queryString = new URLSearchParams(
    Object.fromEntries(Object.entries(allParams).map(([k, v]) => [k, String(v)]))
  ).toString();
  const signature = await hmacHex(apiSecret, queryString);
  return {
    queryParams: { ...allParams, signature },
    headers: { 'X-MEXC-APIKEY': apiKey },
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

// ══════════════════════════════════════════════════════════════════════════════
// ── BYBIT SYNC ────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// Normalize BYBIT:POS keys to 4 decimal places to prevent duplicates from precision drift
function normalizeExtId(eid) {
  if (!eid || !eid.startsWith('BYBIT:POS:')) return eid;
  const parts = eid.split(':');
  // Format: BYBIT:POS:SYMBOL:SIDE:POSIDX:PRICE
  if (parts.length >= 6) {
    const price = parseFloat(parts[5]);
    if (!isNaN(price)) parts[5] = price.toFixed(4);
  }
  return parts.join(':');
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
  // Format: BYBIT:POS:SYMBOL:SIDE:POSIDX:PRICE[:TIMESTAMP...]
  if (parts.length >= 6) {
    const price = parseFloat(parts[5]);
    if (!isNaN(price)) parts[5] = price.toFixed(4);
  }
  return parts.join(':');
}

async function syncBybit(base44, conn, apiKey, apiSecret, options, logs) {
  const { importHistory, historyLimit, isInitialSync, historyLimitMode, historyLimitN } = options;
  let { effectiveCursorMs } = options;
  const profileId = conn.profile_id;
  const baseUrl = conn.base_url;

  // Step 0: Prefetch existing trades
  const allExistingTrades0Raw = await base44.asServiceRole.entities.Trade.filter(
    { profile_id: profileId }, '-date_open', 2000
  );
  // SDK compat: .filter() may return array or {results:[]} depending on SDK version
  const allExistingTrades0 = Array.isArray(allExistingTrades0Raw) ? allExistingTrades0Raw : (allExistingTrades0Raw?.results || allExistingTrades0Raw?.items || []);
  // Migration: remove old BYBIT:CLOSED:* keys
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

      // Cursor-based pagination (page 1 without cursor always works)
      let cursor = null;
      let pageCount = 0;
      while (pageCount < 50) {
        const p = { category: 'linear', limit: 100 };
        if (cursor) p.cursor = cursor;
        const h = await buildBybitHeaders(apiKey, apiSecret, p);
        const data = await relayCall(`${baseUrl}/v5/position/closed-pnl`, 'GET', h, p);
        if (data.retCode !== 0) {
          if (cursor) {
            logs.push(`⚠️ Cursor error on page ${pageCount}, stopping sweep`);
            break;
          }
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
        // Bybit returns cursor with URL-encoded chars (%3A, %2C). Decode them so that:
        // 1. buildBybitHeaders signs with decoded value (: and ,)
        // 2. URLSearchParams re-encodes to %3A/%2C (single encode) in the URL
        // Without decode: signing has %3A, URL has %253A (double-encoded) → HMAC mismatch
        cursor = rawCursor ? decodeURIComponent(rawCursor) : null;
        if (!cursor || list.length < 100) break;
        pageCount++;
        await new Promise(r => setTimeout(r, 200));
      }

      logs.push(`📥 History sweep done: ${allClosedPnl.length} trades`);
    } else {
      // Incremental sync
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
        const ct = pos.createdTime ? parseInt(pos.createdTime) : 0;
        const ut = pos.updatedTime ? parseInt(pos.updatedTime) : 0;
        const twoYearsAgo = Date.now() - 2 * 365 * 24 * 3600 * 1000;
        const createdMs = (ct > twoYearsAgo && ct > 0) ? ct : ((ut > twoYearsAgo && ut > 0) ? ut : (ct || ut || 0));
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

  // Build existing trades map
  const allExistingTrades = oldFormat.length > 0
    ? ensureArray(await base44.asServiceRole.entities.Trade.filter({ profile_id: profileId }, '-date_open', 2000))
    : allExistingTrades0.filter(t => !t.external_id?.startsWith('BYBIT:CLOSED:'));

  // FIX 1: ARCHITECTURE: NO PURGE on force_reimport.
  // TAP DB is source of truth. We only UPSERT (update existing or insert new).
  if (isInitialSync) {
    logs.push(`🔄 upsert-only mode v3 active`);
  }

  const existingByKey = new Map();
  for (const t of allExistingTrades) {
    if (!t.external_id) continue;
    // Store under original key
    if (!existingByKey.has(t.external_id)) existingByKey.set(t.external_id, []);
    existingByKey.get(t.external_id).push(t);
    // Also store under normalized (toFixed(4)) key so old toFixed(6) records are found
    const normalizedId = normalizeExternalId(t.external_id);
    if (normalizedId !== t.external_id) {
      if (!existingByKey.has(normalizedId)) existingByKey.set(normalizedId, []);
      existingByKey.get(normalizedId).push(t);
    }
  }

  // Build snapshot of open records
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

  // Secondary index: coin+dir+day → date_open from closed records
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

    const openTrade = ((existingByKey.get(group.openKey) || [])
      .find(t => !t.close_price)) || null;
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

    // FIX 2: Priority for open time — added prevClosedRecord.date_open as priority #3
    // 1. savedOpenDateMs: date_open from existing open trade record
    // 2. openRecordEntryMatches: date_open from DB snapshot/openTrade
    // 3. prevClosedDateMs: already stored date_open from previous sync (fixes STBL/TAO case)
    // 4. closedFallbackDateMs: date_open from another closed record of same coin+dir+day
    // 5. earliestOpenTime: from closed-pnl createdTime (unreliable)
    // 6. fallback: 1 min before close
    const prevClosedDateMs = prevClosedRecord?.date_open
      ? new Date(String(prevClosedRecord.date_open)).getTime()
      : 0;
    const savedOpenDateMs = openDateByKey.has(group.openKey)
      ? new Date(openDateByKey.get(group.openKey)).getTime()
      : 0;
    const openTimeMs = (savedOpenDateMs > 0 && savedOpenDateMs < closeTimeMs)
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
    if (!computedRiskUsd && originalStop && originalEntry > 0 && positionSizeUsd > 0) {
      const stopDist = Math.abs(originalEntry - originalStop) / originalEntry;
      if (stopDist > 0.0005) computedRiskUsd = stopDist * positionSizeUsd;
    }

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
      entry_price: group.avgEntryPrice,
      original_entry_price: originalEntry,
      position_size: positionSizeUsd,
      stop_price: finalStopPrice,
      original_stop_price: originalStop,
      take_price: finalTakePrice,
      risk_usd: computedRiskUsd,
      original_risk_usd: snapRisk ?? liveRisk ?? computedRiskUsd,
      rr_ratio: rrRatio,
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

      const entryPriceMatches = liveEntry > 0
        ? Math.abs(liveEntry - group.avgEntryPrice) / (group.avgEntryPrice || 1) < 0.005
        : false;

      const liveCreatedKnown = liveCreatedMs > 0;
      const liveOpenedBeforeClose = liveCreatedMs <= latestCloseTime + 5000;
      const entryCloseEnough = liveEntry > 0
        ? Math.abs(liveEntry - group.avgEntryPrice) / (group.avgEntryPrice || 1) < 0.15
        : true;
      const samePosition = liveCreatedKnown && liveOpenedBeforeClose && entryCloseEnough;

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

    // FIX 1: upsert-only, no special insert-only path for isInitialSync
    const existing = (existingByKey.get(key) || []);
    if (existing.length > 0) {
      const existingRecord = existing[0];
      const updateData = { ...tradeData };
      delete updateData.date_open;
      delete updateData.date;
      if (existingRecord.stop_price != null) delete updateData.stop_price;
      if (existingRecord.original_stop_price != null) delete updateData.original_stop_price;
      else if (updateData.stop_price != null) updateData.original_stop_price = updateData.stop_price; // first stop seen → save as original
      if (existingRecord.take_price != null) delete updateData.take_price;
      if (existingRecord.original_entry_price != null) delete updateData.original_entry_price;
      if (existingRecord.original_risk_usd != null) delete updateData.original_risk_usd;
      if (existingRecord.account_balance_at_entry != null) delete updateData.account_balance_at_entry;
      toUpdate.push({ id: existingRecord.id, data: updateData });
      for (let i = 1; i < existing.length; i++) toDelete.push(existing[i].id);
    } else {
      // Only insert trades not already processed (cursor guard for incremental)
      const tradeCloseTime = latestCloseTime || parseInt(String(group.orders[0]?.updatedTime || 0));
      if (!isInitialSync && effectiveCursorMs > 0 && tradeCloseTime < effectiveCursorMs) {
        // Skip
      } else {
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

  // Step 6: Dedup — remove stale closed trades whose external_id doesn't match current groups
  // This cleans up orphans from older grouping algorithms (V1 vs V2 key differences)
  // GUARD: only dedup if we actually got data from exchange (prevents wiping on API failure)
  if (isInitialSync && closedGroups.size > 0) {
    const currentGroupKeys = new Set([...closedGroups.keys()]);
    const staleIds = [];
    for (const t of allExistingTrades) {
      const eid = t.external_id;
      if (!eid) continue;
      // Only target bybit closed trades (BYBIT:POS:*), skip open records (BYBIT:OPEN:*)
      if (!eid.startsWith('BYBIT:POS:')) continue;
      // If this external_id is NOT in current groups → it's from an older grouping → stale
      if (!currentGroupKeys.has(eid)) {
        staleIds.push(t.id);
      }
    }
    if (staleIds.length > 0) {
      for (let i = 0; i < staleIds.length; i += BATCH) {
        const batch = staleIds.slice(i, i + BATCH);
        await Promise.all(batch.map(id => base44.asServiceRole.entities.Trade.delete(id)));
      }
      logs.push(`🧹 Dedup: removed ${staleIds.length} stale trades from older sync`);
    }
  }

  // Build partial data for open positions
  const partialDataByOpenKey = new Map();
  for (const [, group] of closedGroups) {
    if (liveOpenKeys.has(group.openKey) && !forceResetOpenKeys.has(group.openKey)) {
      const existing = partialDataByOpenKey.get(group.openKey);
      partialDataByOpenKey.set(group.openKey, {
        realized_pnl_usd: (existing?.realized_pnl_usd || 0) + group.orders.reduce((s, o) => s + parseFloat(o.closedPnl || '0'), 0),
        partial_closes: JSON.stringify(group.orders.map(o => ({
          order_id: o.orderId,
          size: parseFloat(o.closedSize || o.qty || '0'),
          price: parseFloat(o.avgExitPrice || o.avgPrice || '0'),
          pnl_usd: parseFloat(o.closedPnl || '0'),
          timestamp: new Date(parseInt(o.updatedTime || o.createdTime || '0')).toISOString(),
        }))),
      });
    }
  }

  // Upsert open positions
  for (const pos of openUpserts) {
    const openKey = makeBybitOpenKey(pos.symbol, pos.side, pos.positionIdx ?? 0);
    const partialData = partialDataByOpenKey.get(openKey);
    await upsertGenericOpenPosition(base44, {
      external_id: makeBybitOpenKey(pos.symbol, pos.side, pos.positionIdx ?? 0),
      symbol: pos.symbol,
      direction: pos.side === 'Buy' ? 'Long' : 'Short',
      entry_price: parseFloat(pos.avgPrice || pos.entryPrice || 0),
      size: parseFloat(pos.size || 0),
      mark_price: parseFloat(pos.markPrice || pos.avgPrice || pos.entryPrice || 0),
      stop_price: parseFloat(pos.stopLoss || 0) || null,
      take_price: parseFloat(pos.takeProfit || 0) || null,
      unrealized_pnl: parseFloat(pos.unrealisedPnl || 0),
      created_ms: (() => {
        const ct = pos.createdTime ? parseInt(pos.createdTime) : 0;
        const ut = pos.updatedTime ? parseInt(pos.updatedTime) : 0;
        const twoYearsAgo = Date.now() - 2 * 365 * 24 * 3600 * 1000;
        const now = Date.now();
        const tenMinMs = 10 * 60 * 1000;
        const ctValid = ct > twoYearsAgo && ct > 0;
        const utValid = ut > twoYearsAgo && ut > 0;
        if (ctValid && utValid && ct < ut && (now - ut) < tenMinMs && (ut - ct) > tenMinMs) return ut;
        if (!ctValid && utValid) return ut;
        if (ctValid) return ct;
        return 0;
      })(),
      import_source: 'bybit',
      realized_pnl_usd: partialData?.realized_pnl_usd ?? null,
      partial_closes_json: partialData?.partial_closes ?? null,
      force_reset_open: forceResetOpenKeys.has(openKey),
    }, currentBalance, profileId, existingByKey);
  }

  // Remove stale OPEN records
  let staleCleaned = 0;
  for (const [key, trades] of existingByKey) {
    if (key.startsWith('BYBIT:OPEN:') && !liveOpenKeys.has(key)) {
      for (const ot of trades) {
        if (!ot.close_price && !ot.date_close) {
          await base44.asServiceRole.entities.Trade.delete(ot.id);
          staleCleaned++;
        }
      }
    }
  }
  if (staleCleaned > 0) logs.push(`🧹 Removed ${staleCleaned} stale OPEN record(s)`);

  // DEDUP: remove duplicate open positions (race condition guard)
  // Re-read fresh from DB and deduplicate by external_id
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
        // Keep oldest (first created), delete the rest
        group.sort((a, b) => new Date(String(a.created_date || '0')).getTime() - new Date(String(b.created_date || '0')).getTime());
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

  return { currentBalance, currentEquity, inserted: toInsert.length, updated: toUpdate.length, newCursorMs };
}

// ══════════════════════════════════════════════════════════════════════════════
// ── BINANCE FUTURES SYNC ──────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

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
  } catch (e) {
    logs.push(`⚠️ Balance failed: ${e.message}`);
  }

  const closedTrades = [];
  let newCursorMs = effectiveCursorMs;
  try {
    const params = { limit: 1000 };
    if (!importHistory || effectiveCursorMs > 0) params.startTime = effectiveCursorMs || options.connectedAtMs;
    const { queryParams, headers } = await buildBinanceLikeParams(apiKey, apiSecret, params);
    const data = await relayCall(`${baseUrl}/fapi/v1/userTrades`, 'GET', headers, queryParams);
    if (Array.isArray(data)) {
      closedTrades.push(...data);
      for (const t of data) {
        const ts = parseInt(t.time || 0);
        if (ts > newCursorMs) newCursorMs = ts;
      }
    }
    if (isInitialSync && importHistory && closedTrades.length > historyLimit) closedTrades.length = historyLimit;
    logs.push(`📥 Closed trades: ${closedTrades.length}`);
  } catch (e) {
    logs.push(`❌ Closed trades failed: ${e.message}`);
  }

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
  } catch (e) {
    logs.push(`❌ Open positions failed: ${e.message}`);
  }

  const allExistingTrades = ensureArray(await base44.asServiceRole.entities.Trade.filter({ profile_id: profileId }, '-date_open', 2000));
  const existingByKey = new Map();
  for (const t of allExistingTrades) {
    if (!t.external_id) continue;
    // Store under original key
    if (!existingByKey.has(t.external_id)) existingByKey.set(t.external_id, []);
    existingByKey.get(t.external_id).push(t);
    // Also store under normalized (toFixed(4)) key so old toFixed(6) records are found
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

  const toInsert = [];
  const toUpdate = [];

  for (const [key, fills] of orderGroups) {
    const firstFill = fills[0];
    const totalPnl = fills.reduce((s, f) => s + parseFloat(f.realizedPnl || '0'), 0);
    if (totalPnl === 0 && fills.length === 1) continue;

    const totalQty = fills.reduce((s, f) => s + parseFloat(f.qty || '0'), 0);
    const weightedPrice = fills.reduce((s, f) => s + parseFloat(f.price || '0') * parseFloat(f.qty || '0'), 0) / totalQty;
    const closeTime = parseInt(firstFill.time || '0');

    const positionSide = firstFill.positionSide || '';
    const isBuyer = firstFill.buyer;
    const direction = positionSide === 'LONG' ? 'Long'
      : positionSide === 'SHORT' ? 'Short'
      : (!isBuyer ? 'Long' : 'Short');

    const tradeData = {
      profile_id: profileId,
      external_id: key,
      import_source: 'binance',
      coin: firstFill.symbol,
      direction,
      entry_price: weightedPrice,
      original_entry_price: weightedPrice,
      position_size: totalQty * weightedPrice,
      close_price: weightedPrice,
      pnl_usd: totalPnl,
      realized_pnl_usd: totalPnl,
      pnl_percent_of_balance: currentBalance ? (totalPnl / currentBalance) * 100 : 0,
      date_open: new Date(closeTime - 60000).toISOString(),
      date: new Date(closeTime - 60000).toISOString(),
      date_close: new Date(closeTime).toISOString(),
      account_balance_at_entry: currentBalance || 100000,
      actual_duration_minutes: 1,
    };

    const existing = existingByKey.get(key) || [];
    if (existing.length > 0) {
      toUpdate.push({ id: existing[0].id, data: tradeData });
    } else {
      toInsert.push(tradeData);
    }
  }

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
  logs.push(`✅ Closed trades: ${toInsert.length} new, ${toUpdate.length} updated`);

  for (const pos of openPositions) {
    const posAmt = parseFloat(pos.positionAmt || 0);
    const side = posAmt > 0 ? 'Long' : 'Short';
    await upsertGenericOpenPosition(base44, {
      external_id: `BINANCE:OPEN:${pos.symbol}:${side}`,
      symbol: pos.symbol,
      direction: side,
      entry_price: parseFloat(pos.entryPrice || 0),
      size: Math.abs(posAmt),
      mark_price: parseFloat(pos.markPrice || pos.entryPrice || 0),
      stop_price: null,
      take_price: null,
      unrealized_pnl: parseFloat(pos.unRealizedProfit || 0),
      created_ms: 0,
      import_source: 'binance',
    }, currentBalance, profileId, existingByKey);
  }

  let staleCleaned = 0;
  for (const t of allExistingTrades) {
    if (t.external_id?.startsWith('BINANCE:OPEN:') && !t.close_price && !liveOpenKeys.has(t.external_id)) {
      await base44.asServiceRole.entities.Trade.delete(t.id);
      staleCleaned++;
    }
  }
  if (staleCleaned > 0) logs.push(`🧹 Removed ${staleCleaned} stale OPEN record(s)`);

  return { currentBalance, currentEquity: currentBalance, inserted: toInsert.length, updated: toUpdate.length, newCursorMs };
}

// ══════════════════════════════════════════════════════════════════════════════
// ── GENERIC OPEN POSITION UPSERT ──────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

async function upsertGenericOpenPosition(base44, pos, currentBalance, profileId, existingByKey) {
  const positionSizeUsd = pos.size * (pos.mark_price || pos.entry_price);
  const riskUsd = (pos.stop_price && pos.entry_price > 0)
    ? (Math.abs(pos.entry_price - pos.stop_price) / pos.entry_price) * positionSizeUsd
    : 0;

  const openDateIso = (pos.created_ms > 0 && pos.created_ms < Date.now())
    ? new Date(pos.created_ms).toISOString()
    : new Date().toISOString();
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
    realized_pnl_usd: 0,
    partial_closes: pos.partial_closes_json ?? null,
  };

  // FRESH DB query — always re-read before upsert to prevent race condition duplicates
  const freshExisting = ensureArray(await base44.asServiceRole.entities.Trade.filter(
    { external_id: pos.external_id, profile_id: profileId }, '-date_open', 20
  ));
  // Merge with cached map (take whichever has more data)
  const existing = freshExisting.length > 0 ? freshExisting : (existingByKey.get(pos.external_id) || []);
  const allExistingOpen = existing.filter((t) => !t.close_price);
  
  // Immediately dedup if multiple open records found (race condition cleanup)
  if (allExistingOpen.length > 1) {
    const sorted = [...allExistingOpen].sort((a, b) =>
      new Date(String(a.created_date || '0')).getTime() - new Date(String(b.created_date || '0')).getTime()
    ); // Keep OLDEST (first created), delete rest
    for (let i = 1; i < sorted.length; i++) {
      await base44.asServiceRole.entities.Trade.delete(sorted[i].id);
    }
    // Keep only the oldest
    allExistingOpen.splice(0, allExistingOpen.length, sorted[0]);
  }

  const canonicalOpen = allExistingOpen.sort((a, b) =>
    new Date(String(b.date_open || '0')).getTime() - new Date(String(a.date_open || '0')).getTime()
  )[0] || null;

  if (canonicalOpen) {
    const existingEntryPrice = Number(canonicalOpen.entry_price || 0);
    const entryPriceChanged = existingEntryPrice > 0 &&
      Math.abs(existingEntryPrice - pos.entry_price) / (pos.entry_price || 1) > 0.005;

    if (pos.force_reset_open || entryPriceChanged) {
      await base44.asServiceRole.entities.Trade.delete(canonicalOpen.id);
      await base44.asServiceRole.entities.Trade.create(data);
    } else {
      // FIX 3: Same position — preserve date_open and original fields (TAP DB is source of truth)
      const updateData = { ...data };
      delete updateData.date_open;
      delete updateData.date;
      delete updateData.actual_duration_minutes;
      // TAP DB is source of truth: never overwrite original_* fields once set
      if (canonicalOpen.original_stop_price != null) delete updateData.original_stop_price;
      else if (updateData.stop_price != null) updateData.original_stop_price = updateData.stop_price; // first time stop is seen → save as original
      if (canonicalOpen.original_entry_price != null) delete updateData.original_entry_price;
      if (canonicalOpen.original_risk_usd != null) delete updateData.original_risk_usd;
      if (canonicalOpen.account_balance_at_entry != null) delete updateData.account_balance_at_entry;
      // Never carry Bybit's session-level realizedPnl for open positions — it bleeds from
      // previous closed positions on the same symbol. Always keep 0 for open trades.
      updateData.realized_pnl_usd = 0;
      updateData.partial_closes = pos.partial_closes_json ?? null;
      await base44.asServiceRole.entities.Trade.update(canonicalOpen.id, updateData);
    }
  } else {
    await base44.asServiceRole.entities.Trade.create(data);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ── MAIN HANDLER ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  const logs = [];

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
        sync_cursor_ms: cutoff_override_ms,
        import_history: false,
        initial_sync_done: false,
      });
      const updatedConns = ensureArray(await base44.asServiceRole.entities.ExchangeConnection.filter({ id: connection_id }));
      if (updatedConns[0]) conn = updatedConns[0];
    }

    if (force_reimport) {
      await base44.asServiceRole.entities.ExchangeConnection.update(connection_id, {
        initial_sync_done: false,
        sync_cursor_ms: 0,
      });
      const updatedConns = ensureArray(await base44.asServiceRole.entities.ExchangeConnection.filter({ id: connection_id }));
      if (updatedConns[0]) conn = updatedConns[0];
      logs.push(`🔄 Force reimport requested — resetting sync state (upsert-only, no purge)`);
    }

    const apiKey = await decryptValue(conn.api_key_enc);
    const apiSecret = await decryptValue(conn.api_secret_enc);
    const apiPassphrase = conn.api_passphrase_enc
      ? await decryptValue(conn.api_passphrase_enc)
      : '';

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
      importHistory,
      historyLimit: historyLimitOverride ?? historyLimitN,
      connectedAtMs,
      isInitialSync,
      effectiveCursorMs,
      historyLimitMode: !!historyLimitMode,
      historyLimitN: historyLimitOverride,
    };

    logs.push(`🔄 Syncing exchange: ${exchangeName} | mode: ${conn.mode} [syncExchangeConnectionV2]`);

    let result;

    switch (exchangeName) {
      case 'bybit':
        result = await syncBybit(base44, conn, apiKey, apiSecret, syncOptions, logs);
        break;
      case 'binance':
        result = await syncBinance(base44, conn, apiKey, apiSecret, syncOptions, logs);
        break;
      default:
        return Response.json({ error: `Exchange ${exchangeName} not yet supported in V2. Use syncExchangeConnection for other exchanges.`, logs }, { status: 400 });
    }

    await base44.asServiceRole.entities.ExchangeConnection.update(connection_id, {
      last_status: 'ok',
      last_error: null,
      last_sync_at: new Date().toISOString(),
      sync_cursor_ms: result.newCursorMs > 0 ? result.newCursorMs : effectiveCursorMs,
      initial_sync_done: !isInitialSync || (result.inserted + result.updated) >= 0,
      ...(result.currentBalance != null ? { current_balance: result.currentBalance } : {}),
      ...(result.currentEquity != null ? { current_equity: result.currentEquity } : {}),
    });

    return Response.json({
      ok: true,
      exchange: exchangeName,
      balance: result.currentBalance,
      inserted: result.inserted,
      updated: result.updated,
      skipped: 0,
      logs,
    });

  } catch (error) {
    console.error('[syncExchangeConnectionV2]', error);
    return Response.json({ error: error.message, logs }, { status: 500 });
  }
});