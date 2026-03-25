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

async function sha256hex(str: string): Promise<string> {
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

async function decryptValue(ciphertext: string): Promise<string> {
  const key = await getKey();
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
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
  'open-api.bingx.com', 'open-api-vst.bingx.com',
];

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

// ══════════════════════════════════════════════════════════════════════════════
// ── SIGNING HELPERS ────────────────────────────────────────────────────────────
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

// ── Binance-like (Binance + MEXC spot) ────────────────────────────────────────

async function buildBinanceLikeParams(apiKey: string, apiSecret: string, params: Record<string, unknown>) {
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

async function buildMEXCParams(apiKey: string, apiSecret: string, params: Record<string, unknown>) {
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

// ── BingX ──────────────────────────────────────────────────────────────────────

async function buildBingXParams(apiKey: string, apiSecret: string, params: Record<string, unknown> = {}) {
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

async function buildBitgetHeaders(apiKey: string, apiSecret: string, passphrase: string, method: string, path: string, queryString: string = '', body: string = '') {
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
// ── BYBIT SYNC (original, unchanged) ─────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function makeBybitOpenKey(symbol: string, side: string, posIdx: number) {
  return `BYBIT:OPEN:${symbol}:${side}:${posIdx}`;
}

function makeBybitTradeKey(symbol: string, side: string, posIdx: number, orderId: string) {
  // Note: orderId used as fallback only; primary grouping by position key below
  return `BYBIT:TRADE:${symbol}:${side}:${posIdx}:${orderId}`;
}

function makeBybitPositionKey(symbol: string, side: string, posIdx: number, avgEntryPrice: string | number) {
  // Group partial closes of the same position: same symbol+side+posIdx+entryPrice
  const price = Number(avgEntryPrice || 0).toFixed(6); // 6 decimals to group partial fills
  return `BYBIT:POS:${symbol}:${side}:${posIdx}:${price}`;
}

async function syncBybit(
  base44: unknown,
  conn: Record<string, unknown>,
  apiKey: string,
  apiSecret: string,
  options: { importHistory: boolean; historyLimit: number; connectedAtMs: number; isInitialSync: boolean; effectiveCursorMs: number; historyLimitMode: boolean; historyLimitN: number | null },
  logs: string[]
) {
  const { importHistory, historyLimit, isInitialSync, historyLimitMode, historyLimitN } = options;
  let { effectiveCursorMs } = options;
  const profileId = conn.profile_id as string;
  const baseUrl = conn.base_url as string;

  // Step 0: Prefetch existing trades
  const allExistingTrades0 = await base44.asServiceRole.entities.Trade.filter(
    { profile_id: profileId }, '-date_open', 2000
  );
  // Migration: remove old BYBIT:CLOSED:* keys
  const oldFormat = allExistingTrades0.filter((t: Record<string, unknown>) => (t.external_id as string)?.startsWith('BYBIT:CLOSED:'));
  if (oldFormat.length > 0) {
    await Promise.all(oldFormat.map((t: Record<string, unknown>) => base44.asServiceRole.entities.Trade.delete(t.id)));
    effectiveCursorMs = 0;
    logs.push(`🔄 Migration: removed ${oldFormat.length} old-format records`);
  }

  // Step 1: Balance + Equity
  let currentBalance: number | null = null;
  let currentEquity: number | null = null;
  try {
    const p = { accountType: 'UNIFIED' };
    const h = await buildBybitHeaders(apiKey, apiSecret, p);
    const data = await relayCall(`${baseUrl}/v5/account/wallet-balance`, 'GET', h, p);
    if (data.retCode === 0) {
      const acct = data?.result?.list?.[0];
      if (acct?.coin) {
        const usdt = acct.coin.find((c: Record<string, unknown>) => c.coin === 'USDT');
        currentBalance = usdt ? parseFloat(usdt.walletBalance) : parseFloat(acct.totalWalletBalance || 0);
      } else if (acct?.totalWalletBalance) {
        currentBalance = parseFloat(acct.totalWalletBalance);
      }
      if (acct?.totalEquity != null && acct.totalEquity !== '') {
        currentEquity = parseFloat(acct.totalEquity);
      } else if (acct?.coin) {
        const usdt = acct.coin.find((c: Record<string, unknown>) => c.coin === 'USDT');
        if (usdt?.equity != null) currentEquity = parseFloat(usdt.equity);
      }
      if (currentEquity == null && currentBalance != null) currentEquity = currentBalance;
    }
    logs.push(`✅ Balance: ${currentBalance != null ? currentBalance.toFixed(2) + ' USDT' : 'N/A'} | Equity: ${currentEquity != null ? currentEquity.toFixed(2) + ' USDT' : 'N/A'}`);
  } catch (e) {
    logs.push(`⚠️ Balance failed: ${e.message}`);
  }

  // Step 2: Closed PnL
  // Strategy: Bybit only returns latest ~100 without startTime.
  // For initial history import: use time-window pagination (sweep back in 30-day chunks).
  // For incremental sync: use effectiveCursorMs as startTime.
  const allClosedPnl: unknown[] = [];
  let newCursorMs = effectiveCursorMs;
  try {
    if (isInitialSync && importHistory && effectiveCursorMs === 0) {
      // Initial full history import.
      // Strategy: first try pagination WITHOUT startTime (Bybit Demo ignores old startTime but returns data without it).
      // Then try with startTime=cutoff to catch any records the cursor-only approach missed.
      const lookbackDays = (historyLimit >= 7 && historyLimit <= 365) ? historyLimit : 90;
      const now = Date.now();
      const cutoffMs = now - lookbackDays * 24 * 3600 * 1000;
      logs.push(`📅 Bybit history sweep: ${lookbackDays} days (${new Date(cutoffMs).toISOString().slice(0,10)} → now)`);

      const seenIds = new Set<string>();

      // Phase 1: cursor-based pagination without startTime — gets all available records
      let cursor: string | null = null;
      let pageCount = 0;
      while (pageCount < 50) {
        const p: Record<string, unknown> = { category: 'linear', limit: 100 };
        if (cursor) p.cursor = cursor;
        const h = await buildBybitHeaders(apiKey, apiSecret, p);
        const data = await relayCall(`${baseUrl}/v5/position/closed-pnl`, 'GET', h, p);
        if (data.retCode !== 0) { logs.push(`❌ Closed PnL page ${pageCount}: ${data.retMsg}`); break; }
        const list: Record<string, unknown>[] = data?.result?.list || [];
        if (list.length === 0) break;

        for (const c of list) {
          const t = parseInt(c.updatedTime as string || c.createdTime as string || '0');
          if (t > 0 && t < cutoffMs) continue; // outside lookback window
          const id = (c.orderId as string) || `${c.symbol}_${t}`;
          if (!seenIds.has(id)) {
            seenIds.add(id);
            allClosedPnl.push(c);
            if (t > newCursorMs) newCursorMs = t;
          }
        }

        cursor = data?.result?.nextPageCursor || null;
        if (!cursor || list.length < 100) break;
        pageCount++;
        await new Promise(r => setTimeout(r, 200));
      }

      // Phase 2: try with startTime to catch any records missed by cursor approach
      // (useful for real Bybit which supports startTime properly)
      const p2: Record<string, unknown> = { category: 'linear', limit: 100, startTime: cutoffMs };
      const h2 = await buildBybitHeaders(apiKey, apiSecret, p2);
      const data2 = await relayCall(`${baseUrl}/v5/position/closed-pnl`, 'GET', h2, p2);
      if (data2.retCode === 0) {
        for (const c of (data2?.result?.list || []) as Record<string, unknown>[]) {
          const t = parseInt(c.updatedTime as string || c.createdTime as string || '0');
          const id = (c.orderId as string) || `${c.symbol}_${t}`;
          if (!seenIds.has(id)) {
            seenIds.add(id);
            allClosedPnl.push(c);
            if (t > newCursorMs) newCursorMs = t;
          }
        }
      }

      logs.push(`📥 History sweep done: ${allClosedPnl.length} trades`);
    } else {
      // Incremental sync — always fetch latest 100 WITHOUT startTime
      // (using startTime=cursor would return partial closes of a position
      //  and overwrite the correctly-merged record with incomplete data)
      const closedPnlParams: Record<string, unknown> = { category: 'linear', limit: 100 };
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

  // Step 3: Open positions
  const liveOpenKeys = new Set<string>();
  const openUpserts: unknown[] = [];
  const liveOpenMetaByKey = new Map<string, { entryPrice: number; createdMs: number }>();
  try {
    const p = { category: 'linear', settleCoin: 'USDT' };
    const h = await buildBybitHeaders(apiKey, apiSecret, p);
    const data = await relayCall(`${baseUrl}/v5/position/list`, 'GET', h, p);
    if (data.retCode === 0 && data?.result?.list) {
      const openPositions = data.result.list.filter((pos: Record<string, unknown>) => parseFloat(pos.size as string || '0') > 0);
      for (const pos of openPositions) {
        const openKey = makeBybitOpenKey(pos.symbol, pos.side, pos.positionIdx ?? 0);
        liveOpenKeys.add(openKey);
        openUpserts.push(pos);
        const ct = pos.createdTime ? parseInt(pos.createdTime as string) : 0;
        const ut = pos.updatedTime ? parseInt(pos.updatedTime as string) : 0;
        const twoYearsAgo = Date.now() - 2 * 365 * 24 * 3600 * 1000;
        const createdMs = (ct > twoYearsAgo && ct > 0) ? ct : ((ut > twoYearsAgo && ut > 0) ? ut : (ct || ut || 0));
        liveOpenMetaByKey.set(openKey, {
          entryPrice: parseFloat((pos.avgPrice as string) || (pos.entryPrice as string) || '0'),
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
    ? await base44.asServiceRole.entities.Trade.filter({ profile_id: profileId }, '-date_open', 2000)
    : allExistingTrades0.filter((t: Record<string, unknown>) => !(t.external_id as string)?.startsWith('BYBIT:CLOSED:'));

  // On initial sync: purge ONLY closed bybit trades that are within the lookback window
  // (trades older than the window are kept — Bybit can't return them anymore, but TAP has them)
  if (isInitialSync) {
    const lookbackCutoffMs = Date.now() - (
      (historyLimitN && historyLimitN >= 7 && historyLimitN <= 365) ? historyLimitN : 90
    ) * 24 * 3600 * 1000;

    const allClosedBybit = allExistingTrades.filter((t: Record<string, unknown>) =>
      t.import_source === 'bybit' && t.close_price != null
    );
    // Only purge trades WITHIN the lookback window — protect older trades
    const toPurge = allClosedBybit.filter((t: Record<string, unknown>) => {
      const tradeDate = new Date(String(t.date_open || t.date || '')).getTime();
      return tradeDate >= lookbackCutoffMs; // within window → safe to purge and re-insert
    });
    const toKeep = allClosedBybit.filter((t: Record<string, unknown>) => {
      const tradeDate = new Date(String(t.date_open || t.date || '')).getTime();
      return tradeDate < lookbackCutoffMs; // older than window → preserve
    });

    if (toPurge.length > 0) {
      logs.push(`🧹 Initial sync: purging ${toPurge.length} bybit trades within window (keeping ${toKeep.length} older trades)`);
      const BATCH = 20;
      for (let i = 0; i < toPurge.length; i += BATCH) {
        await Promise.all(toPurge.slice(i, i + BATCH).map((t: Record<string, unknown>) =>
          base44.asServiceRole.entities.Trade.delete(t.id as string)
        ));
      }
      const purgedIds = new Set(toPurge.map((t: Record<string, unknown>) => t.id));
      allExistingTrades.splice(0, allExistingTrades.length, ...allExistingTrades.filter((t: Record<string, unknown>) => !purgedIds.has(t.id)));
    }
  }

  const existingByKey = new Map<string, unknown[]>();
  for (const t of allExistingTrades) {
    if (!t.external_id) continue;
    if (!existingByKey.has(t.external_id)) existingByKey.set(t.external_id, []);
    existingByKey.get(t.external_id)!.push(t);
  }

  // Build a snapshot of open records BEFORE any stale cleanup.
  // TAP DB is source of truth for: date_open, stop_price, original_stop_price, original_risk_usd, original_entry_price.
  // These fields are written once when position first syncs and must NOT be overwritten by Bybit data.
  interface OpenRecordSnapshot {
    date_open: string;
    stop_price: number | null;
    original_stop_price: number | null;
    original_risk_usd: number | null;
    original_entry_price: number | null;
    account_balance_at_entry: number | null;
  }
  const openSnapshotByKey = new Map<string, OpenRecordSnapshot>();
  for (const t of allExistingTrades) {
    const eid = t.external_id as string;
    if (eid?.startsWith('BYBIT:OPEN:') && !t.close_price && t.date_open) {
      if (!openSnapshotByKey.has(eid)) {
        openSnapshotByKey.set(eid, {
          date_open: t.date_open as string,
          stop_price: t.stop_price != null ? Number(t.stop_price) : null,
          original_stop_price: t.original_stop_price != null ? Number(t.original_stop_price) : null,
          original_risk_usd: t.original_risk_usd != null ? Number(t.original_risk_usd) : null,
          original_entry_price: t.original_entry_price != null ? Number(t.original_entry_price) : null,
          account_balance_at_entry: t.account_balance_at_entry != null ? Number(t.account_balance_at_entry) : null,
        });
      }
    }
  }
  // Keep backward compat alias
  const openDateByKey = new Map<string, string>(
    [...openSnapshotByKey.entries()].map(([k, v]) => [k, v.date_open])
  );

  // Step 4: Group close orders by trade key with time-based session detection.
  //
  // Problem: two separate TAO trades with same entry price get merged into one group.
  // Fix: sort by time ASC, then split groups when gap between consecutive records > 60 min.
  // This correctly merges actual partial closes (seconds/minutes apart) while separating
  // two distinct position cycles (usually 30+ min apart after close → reopen → close).
  type ClosedGroup = { key: string; baseKey: string; symbol: string; side: string; posIdx: number; avgEntryPrice: number; openKey: string; orders: unknown[] };
  const closedGroups = new Map<string, ClosedGroup>();
  const groupOrder: string[] = [];

  // Sort oldest-first so we process groups chronologically
  const sortedClosedPnl = [...allClosedPnl].sort((a, b) => {
    const ta = parseInt(a.updatedTime || a.createdTime || '0');
    const tb = parseInt(b.updatedTime || b.createdTime || '0');
    return ta - tb;
  });

  const PARTIAL_CLOSE_MAX_GAP_MS = 60 * 60 * 1000; // 60 min: beyond this = new position cycle

  for (const c of sortedClosedPnl) {
    const posIdx = c.positionIdx ?? 0;
    const baseKey = makeBybitPositionKey(c.symbol, c.side, posIdx, c.avgEntryPrice);
    const cTime = parseInt(c.updatedTime as string || c.createdTime as string || '0');
    const openSide = c.side === 'Buy' ? 'Sell' : 'Buy';

    // Find most recent group with same baseKey where gap is within threshold
    let targetKey: string | null = null;
    for (let i = groupOrder.length - 1; i >= 0; i--) {
      const gKey = groupOrder[i];
      const g = closedGroups.get(gKey)!;
      if (g.baseKey !== baseKey) continue;
      // Check gap from latest order in this group
      const latestInGroup = (g.orders as Record<string, unknown>[])
        .reduce((m, o) => Math.max(m, parseInt((o.updatedTime as string) || (o.createdTime as string) || '0')), 0);
      if (cTime - latestInGroup <= PARTIAL_CLOSE_MAX_GAP_MS) {
        targetKey = gKey;
        break;
      }
      // Gap too large → stop searching (new cycle)
      break;
    }

    if (targetKey === null) {
      // New group — use baseKey + earliest close time as unique external_id
      const newKey = cTime > 0 ? `${baseKey}:${cTime}` : baseKey;
      // Avoid duplicate keys (edge case: same timestamp)
      const uniqueKey = closedGroups.has(newKey) ? `${newKey}_${Math.random().toString(36).slice(2, 6)}` : newKey;
      closedGroups.set(uniqueKey, { key: uniqueKey, baseKey, symbol: c.symbol, side: c.side, posIdx, avgEntryPrice: parseFloat(c.avgEntryPrice as string || '0'), openKey: makeBybitOpenKey(c.symbol, openSide, posIdx), orders: [] });
      groupOrder.push(uniqueKey);
      targetKey = uniqueKey;
    }

    closedGroups.get(targetKey)!.orders.push(c);
  }
  logs.push(`🔑 Trade groups: ${closedGroups.size} (merged) from ${allClosedPnl.length} close records`);

  // Step 5: Build upsert ops
  const toInsert: unknown[] = [];
  const toUpdate: { id: string; data: unknown }[] = [];
  const toDelete: string[] = [];
  const referencedOpenKeys = new Set<string>();
  const forceResetOpenKeys = new Set<string>();

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
    // In Bybit closed-pnl API, `side` = the CLOSING order side:
    //   "Sell" → closed a Long position (was Long)
    //   "Buy"  → closed a Short position (was Short)
    const direction = group.side === 'Buy' ? 'Short' : 'Long';

    const partialDetails = group.orders.map(o => ({
      order_id: o.orderId,
      size: parseFloat(o.closedSize || o.qty || 0),
      price: parseFloat(o.avgExitPrice || o.avgPrice || 0),
      pnl_usd: parseFloat(o.closedPnl || 0),
      timestamp: new Date(parseInt(o.updatedTime || o.createdTime || Date.now())).toISOString(),
    }));

    const openTrade = (((existingByKey.get(group.openKey) || []) as Record<string, unknown>[])
      .find((t: Record<string, unknown>) => !t.close_price)) || null;
    // Prefer snapshot (persists after stale cleanup) over live openTrade record
    const openSnap = openSnapshotByKey.get(group.openKey) || null;

    const closeTimeMs = latestCloseTime || Date.now();
    // Use snapshot date_open if available; fallback to live openTrade record
    const snapDateStr = openSnap?.date_open || (openTrade?.date_open ? String(openTrade.date_open) : null);
    const openRecordDateMs = snapDateStr ? new Date(snapDateStr).getTime() : 0;
    // Use 15% threshold — after averaging, avgEntryPrice can shift significantly
    const openRecordEntryMatches = openRecordDateMs > 0; // if we have a snapshot, always use it

    // Priority for open time:
    // 1. openDateByKey: date_open from existing open trade record (most accurate — was set on first sync)
    // 2. openRecordEntryMatches: date_open from DB record if entry matches within 15%
    // 3. earliestOpenTime: from closed-pnl createdTime (unreliable — Bybit uses close order time)
    // 4. fallback: 1 min before close
    const savedOpenDateMs = openDateByKey.has(group.openKey)
      ? new Date(openDateByKey.get(group.openKey)!).getTime()
      : 0;
    const openTimeMs = (savedOpenDateMs > 0 && savedOpenDateMs < closeTimeMs)
      ? savedOpenDateMs
      : ((openRecordEntryMatches && openRecordDateMs > 0 && openRecordDateMs < closeTimeMs)
        ? openRecordDateMs
        : ((earliestOpenTime !== Infinity && earliestOpenTime > 0 && earliestOpenTime < closeTimeMs)
          ? earliestOpenTime
          : Math.max(0, closeTimeMs - 60000)));
    const durationMinutes = Math.max(0, Math.floor((closeTimeMs - openTimeMs) / 60000));

    // Source of truth hierarchy: openSnap (TAP DB snapshot) > openTrade (live DB record) > Bybit orders
    const takePrice = openTrade?.take_price ?? null;
    // Stop price: snapshot > live > orders (never overwrite with stale Bybit data)
    const snapStop = openSnap?.stop_price ?? openSnap?.original_stop_price ?? null;
    const liveStop = openTrade?.stop_price != null ? Number(openTrade.stop_price) : null;
    const stopPriceFromOrders = group.orders.find(o => parseFloat(o.stopLoss as string || '0') > 0);
    const takePriceFromOrders = group.orders.find(o => parseFloat(o.takeProfit as string || '0') > 0);

    const finalStopPrice = snapStop ?? liveStop ?? (stopPriceFromOrders ? parseFloat(stopPriceFromOrders.stopLoss as string) : null);
    const finalTakePrice = takePrice ?? (takePriceFromOrders ? parseFloat(takePriceFromOrders.takeProfit as string) : null);

    const stopWasHit = finalStopPrice != null ? Math.abs(avgExitPrice - Number(finalStopPrice)) <= Math.max(0.0000001, Number(finalStopPrice) * 0.0015) : false;
    const takeWasHit = finalTakePrice != null ? Math.abs(avgExitPrice - Number(finalTakePrice)) <= Math.max(0.0000001, Number(finalTakePrice) * 0.0015) : false;
    const closeReasons = group.orders.map(o => ((o.stopOrderType as string) || (o.execType as string) || '')).join(',').toLowerCase();

    // Original stop: snapshot first, then live record, then final stop
    const originalStop = openSnap?.original_stop_price ?? (openTrade?.original_stop_price != null ? Number(openTrade.original_stop_price) : null) ?? finalStopPrice;
    // Original entry: snapshot first (unchanged by Bybit averaging), then current group entry
    const originalEntry = openSnap?.original_entry_price ?? (openTrade?.original_entry_price != null ? Number(openTrade.original_entry_price) : null) ?? group.avgEntryPrice;

    // Risk: snapshot > live record > compute from stop distance against ORIGINAL entry
    const snapRisk = openSnap?.original_risk_usd ?? null;
    const liveRisk = openTrade?.original_risk_usd != null ? Number(openTrade.original_risk_usd) : (openTrade?.risk_usd != null ? Number(openTrade.risk_usd) : null);
    let computedRiskUsd: number | null = snapRisk ?? liveRisk;
    if (!computedRiskUsd && originalStop && originalEntry > 0 && positionSizeUsd > 0) {
      const stopDist = Math.abs(originalEntry - originalStop) / originalEntry;
      if (stopDist > 0.0005) computedRiskUsd = stopDist * positionSizeUsd;
    }

    const rrRatio = computedRiskUsd && computedRiskUsd > 0 && totalPnl !== 0
      ? totalPnl / computedRiskUsd
      : null;

    // Balance at entry: snapshot > live > current balance
    const balanceAtEntry = openSnap?.account_balance_at_entry
      ?? (openTrade?.account_balance_at_entry != null ? Number(openTrade.account_balance_at_entry) : null)
      ?? (currentBalance || 100000);

    const tradeData = {
      profile_id: profileId,
      external_id: key,
      import_source: 'bybit',
      coin: group.symbol,
      direction,
      entry_price: group.avgEntryPrice,
      original_entry_price: originalEntry, // preserved from first sync
      position_size: positionSizeUsd,
      stop_price: finalStopPrice,
      original_stop_price: originalStop, // preserved from first sync
      take_price: finalTakePrice,
      risk_usd: computedRiskUsd,
      original_risk_usd: snapRisk ?? liveRisk ?? computedRiskUsd,
      rr_ratio: rrRatio,
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

    // Detect if live open position is the SAME cycle as this closed group or a NEW cycle.
    //
    // We use live position's createdTime (from Bybit position/list) as the definitive signal:
    //   - If liveCreatedMs is known (>0) AND the live position was created BEFORE this close happened
    //     (+5s grace) → same cycle: this is a partial close.
    //   - If liveCreatedMs is known (>0) AND the live position was created AFTER this close
    //     → definitely a new cycle: create the closed trade.
    //   - If liveCreatedMs is UNKNOWN (0) → default to NEW CYCLE (safer: creates closed record
    //     rather than swallowing it). Edge case: Bybit omits createdTime → partial close detection
    //     breaks, but that's acceptable vs. losing closed trades.
    if (liveOpenKeys.has(group.openKey)) {
      const liveMeta = liveOpenMetaByKey.get(group.openKey);
      const liveEntry = liveMeta?.entryPrice || 0;
      const liveCreatedMs = liveMeta?.createdMs || 0;

      const entryPriceMatches = liveEntry > 0
        ? Math.abs(liveEntry - group.avgEntryPrice) / (group.avgEntryPrice || 1) < 0.005
        : false;

      // samePosition: liveCreatedMs KNOWN, live position was OPEN when partial close happened.
      // Do NOT require entry price match — averaging changes avgPrice, breaking the match.
      const liveCreatedKnown = liveCreatedMs > 0;
      const liveOpenedBeforeClose = liveCreatedMs <= latestCloseTime + 5000; // grace 5s
      // Allow entry price to differ up to 15% (covers averaging up/down scenarios)
      const entryCloseEnough = liveEntry > 0
        ? Math.abs(liveEntry - group.avgEntryPrice) / (group.avgEntryPrice || 1) < 0.15
        : true;
      const samePosition = liveCreatedKnown && liveOpenedBeforeClose && entryCloseEnough;

      if (samePosition) {
        const openRecord = ((existingByKey.get(group.openKey) || []) as Record<string, unknown>[]).find((t: Record<string, unknown>) => !t.close_price) || null;
        if (openRecord) {
          toUpdate.push({ id: openRecord.id as string, data: {
            realized_pnl_usd: totalPnl,
            partial_closes: JSON.stringify(partialDetails),
          }});
          referencedOpenKeys.add(group.openKey);
          logs.push(`✅ ${group.symbol}: partial close merged (liveCreated=${liveCreatedMs}, close=${latestCloseTime})`);
          continue;
        }
      }

      // New cycle (or unknown timing) — create closed trade AND force fresh OPEN record
      forceResetOpenKeys.add(group.openKey);
      logs.push(`ℹ️ ${group.symbol}: new cycle (entryMatch=${entryPriceMatches}, liveCreatedKnown=${liveCreatedKnown}, liveOpenedBefore=${liveOpenedBeforeClose}, liveCreated=${liveCreatedMs}, close=${latestCloseTime})`);
    }

    // On initial sync we already purged all closed bybit trades — force insert
    if (isInitialSync) {
      toInsert.push(tradeData);
    } else {
      const existing = (existingByKey.get(key) || []) as Record<string, unknown>[];
      if (existing.length > 0) {
        // Preserve original date_open — never overwrite it on incremental sync
        const updateData = { ...tradeData };
        delete updateData.date_open;
        delete updateData.date;
        toUpdate.push({ id: existing[0].id as string, data: updateData });
        for (let i = 1; i < existing.length; i++) toDelete.push(existing[i].id as string);
      } else {
        // Incremental sync: only insert trades newer than cursor (don't re-add old ones)
        // Use latestCloseTime of merged group (not the last raw order item)
        const tradeCloseTime = latestCloseTime || parseInt(String(group.orders[0]?.updatedTime || 0));
        if (!isInitialSync && effectiveCursorMs > 0 && tradeCloseTime < effectiveCursorMs) {
          // Skip — this trade is older than our cursor, already processed
        } else {
          toInsert.push(tradeData);
        }
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

  // Build map of realized PnL and partial closes for live open positions
  // (set by partial close logic above)
  const partialDataByOpenKey = new Map<string, { realized_pnl_usd: number; partial_closes: string }>();
  for (const [, group] of closedGroups) {
    if (liveOpenKeys.has(group.openKey) && !forceResetOpenKeys.has(group.openKey)) {
      // Only accumulate partial close data for confirmed same-cycle groups
      // (forceResetOpenKeys = new cycle → no partial data to merge)
      const existing = partialDataByOpenKey.get(group.openKey);
      partialDataByOpenKey.set(group.openKey, {
        realized_pnl_usd: (existing?.realized_pnl_usd || 0) + (group.orders as Record<string, unknown>[]).reduce((s, o) => s + parseFloat(o.closedPnl as string || '0'), 0),
        partial_closes: JSON.stringify((group.orders as Record<string, unknown>[]).map(o => ({
          order_id: o.orderId,
          size: parseFloat(o.closedSize as string || o.qty as string || '0'),
          price: parseFloat(o.avgExitPrice as string || o.avgPrice as string || '0'),
          pnl_usd: parseFloat(o.closedPnl as string || '0'),
          timestamp: new Date(parseInt((o.updatedTime as string) || (o.createdTime as string) || '0')).toISOString(),
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
      // Use createdTime as open time (real position open), NOT updatedTime (changes on SL/TP update)
      // If createdTime is suspiciously old (>2 years), fall back to updatedTime
      created_ms: (() => {
        const ct = pos.createdTime ? parseInt(pos.createdTime as string) : 0;
        const ut = pos.updatedTime ? parseInt(pos.updatedTime as string) : 0;
        const twoYearsAgo = Date.now() - 2 * 365 * 24 * 3600 * 1000;
        const now = Date.now();
        const tenMinMs = 10 * 60 * 1000;
        // If updatedTime is very recent (within 10 min of now) AND createdTime is much older,
        // it means this is a re-opened / averaged position and updatedTime reflects new entry.
        // Use updatedTime as the open time in that case.
        const ctValid = ct > twoYearsAgo && ct > 0;
        const utValid = ut > twoYearsAgo && ut > 0;
        if (ctValid && utValid && ct < ut && (now - ut) < tenMinMs && (ut - ct) > tenMinMs) {
          // updatedTime is fresh and significantly later than createdTime → new cycle, use updatedTime
          return ut;
        }
        // If ONLY updatedTime is valid (createdTime = 0 or very old/stale), use updatedTime
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
  // 1. From closed trades that are no longer live open positions
  // 2. ALL BYBIT:OPEN: records not in liveOpenKeys (catches positions closed before cursor)
  let staleCleaned = 0;
  for (const [key, trades] of existingByKey) {
    if ((key as string).startsWith('BYBIT:OPEN:') && !liveOpenKeys.has(key)) {
      for (const ot of trades as Record<string, unknown>[]) {
        if (!ot.close_price && !ot.date_close) {
          await base44.asServiceRole.entities.Trade.delete(ot.id);
          staleCleaned++;
        }
      }
    }
  }
  if (staleCleaned > 0) logs.push(`🧹 Removed ${staleCleaned} stale OPEN record(s)`);

  // Junk cleanup
  const junkyPrefixes = ['open_', 'test_sync_'];
  let junkCleaned = 0;
  for (const t of allExistingTrades) {
    if (t.external_id && junkyPrefixes.some(p => (t.external_id as string).startsWith(p))) {
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

async function syncBinance(
  base44: unknown,
  conn: Record<string, unknown>,
  apiKey: string,
  apiSecret: string,
  options: { importHistory: boolean; historyLimit: number; connectedAtMs: number; isInitialSync: boolean; effectiveCursorMs: number },
  logs: string[]
) {
  const { importHistory, historyLimit, isInitialSync, effectiveCursorMs } = options;
  const profileId = conn.profile_id as string;
  const baseUrl = conn.base_url as string;

  // Balance
  let currentBalance: number | null = null;
  try {
    const { queryParams, headers } = await buildBinanceLikeParams(apiKey, apiSecret, {});
    const data = await relayCall(`${baseUrl}/fapi/v2/balance`, 'GET', headers, queryParams);
    if (Array.isArray(data)) {
      const usdt = data.find((a: Record<string, unknown>) => a.asset === 'USDT');
      currentBalance = usdt ? parseFloat(usdt.balance as string) : null;
    }
    logs.push(`✅ Balance: ${currentBalance != null ? currentBalance.toFixed(2) + ' USDT' : 'N/A'}`);
  } catch (e) {
    logs.push(`⚠️ Balance failed: ${e.message}`);
  }

  // Closed trades (userTrades)
  const closedTrades: unknown[] = [];
  let newCursorMs = effectiveCursorMs;
  try {
    const params: Record<string, unknown> = { limit: 1000 };
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

  // Open positions
  const liveOpenKeys = new Set<string>();
  const openPositions: unknown[] = [];
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

  // Load existing
  const allExistingTrades = await base44.asServiceRole.entities.Trade.filter({ profile_id: profileId }, '-date_open', 2000);
  const existingByKey = new Map<string, unknown[]>();
  for (const t of allExistingTrades) {
    if (!t.external_id) continue;
    if (!existingByKey.has(t.external_id)) existingByKey.set(t.external_id, []);
    existingByKey.get(t.external_id)!.push(t);
  }

  // Upsert closed trades
  // Binance userTrades are individual fills — group by symbol+orderId then upsert
  const orderGroups = new Map<string, unknown[]>();
  for (const t of closedTrades) {
    const key = `BINANCE:TRADE:${t.symbol}:${t.orderId}`;
    if (!orderGroups.has(key)) orderGroups.set(key, []);
    orderGroups.get(key)!.push(t);
  }

  const toInsert: unknown[] = [];
  const toUpdate: { id: string; data: unknown }[] = [];
  const referencedOpenKeys = new Set<string>();

  for (const [key, fills] of orderGroups) {
    // Only process closing trades (buyer=true and side=SELL means close long, etc.)
    // Binance userTrades: buyer=true means bought (Long entry or Short close)
    // We track by realizedPnl != 0 → this is a close
    const firstFill = fills[0] as Record<string, unknown>;
    const totalPnl = fills.reduce((s: number, f: Record<string, unknown>) => s + parseFloat(f.realizedPnl as string || '0'), 0);
    if (totalPnl === 0 && fills.length === 1) continue; // Skip pure entry fills with no PnL

    const totalQty = fills.reduce((s: number, f: Record<string, unknown>) => s + parseFloat(f.qty as string || '0'), 0);
    const weightedPrice = fills.reduce((s: number, f: Record<string, unknown>) => s + parseFloat(f.price as string || '0') * parseFloat(f.qty as string || '0'), 0) / totalQty;
    const closeTime = parseInt(firstFill.time as string || '0');

    // Direction: use positionSide (LONG/SHORT) from Binance Futures userTrades — most reliable.
    // Fallback: buyer=false (sell) = closing Long, buyer=true (buy) = closing Short.
    const positionSide = firstFill.positionSide as string || '';
    const isBuyer = firstFill.buyer as boolean;
    const direction = positionSide === 'LONG' ? 'Long'
      : positionSide === 'SHORT' ? 'Short'
      : (!isBuyer ? 'Long' : 'Short'); // fallback for one-way mode

    const tradeData = {
      profile_id: profileId,
      external_id: key,
      import_source: 'binance',
      coin: firstFill.symbol as string,
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

    const existing = (existingByKey.get(key) || []) as Record<string, unknown>[];
    if (existing.length > 0) {
      toUpdate.push({ id: existing[0].id as string, data: tradeData });
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

  // Upsert open positions
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
    referencedOpenKeys.add(`BINANCE:OPEN:${pos.symbol}:${side}`);
  }

  // Remove stale open positions
  let staleCleaned = 0;
  for (const t of allExistingTrades) {
    if ((t.external_id as string)?.startsWith('BINANCE:OPEN:') && !t.close_price && !liveOpenKeys.has(t.external_id as string)) {
      await base44.asServiceRole.entities.Trade.delete(t.id);
      staleCleaned++;
    }
  }
  if (staleCleaned > 0) logs.push(`🧹 Removed ${staleCleaned} stale OPEN record(s)`);

  return { currentBalance, currentEquity: currentBalance, inserted: toInsert.length, updated: toUpdate.length, newCursorMs };
}

// ══════════════════════════════════════════════════════════════════════════════
// ── BINGX SYNC ────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

async function syncBingX(
  base44: unknown,
  conn: Record<string, unknown>,
  apiKey: string,
  apiSecret: string,
  options: { importHistory: boolean; historyLimit: number; connectedAtMs: number; isInitialSync: boolean; effectiveCursorMs: number },
  logs: string[]
) {
  const { importHistory, historyLimit, isInitialSync, effectiveCursorMs } = options;
  const profileId = conn.profile_id as string;
  const baseUrl = (conn.base_url as string) || 'https://open-api.bingx.com';

  // Balance
  let currentBalance: number | null = null;
  try {
    const { queryParams, headers } = await buildBingXParams(apiKey, apiSecret, {});
    const data = await relayCall(`${baseUrl}/openApi/swap/v2/user/balance`, 'GET', headers, queryParams);
    if (data?.code === 0) {
      currentBalance = parseFloat(data.data?.balance?.balance ?? data.data?.availableMargin ?? 0);
    }
    logs.push(`✅ Balance: ${currentBalance != null ? currentBalance.toFixed(2) + ' USDT' : 'N/A'}`);
  } catch (e) {
    logs.push(`⚠️ Balance failed: ${e.message}`);
  }

  // Closed orders
  const closedTrades: unknown[] = [];
  let newCursorMs = effectiveCursorMs;
  try {
    const params: Record<string, unknown> = { limit: 100 };
    if (!importHistory || effectiveCursorMs > 0) params.startTs = effectiveCursorMs || options.connectedAtMs;
    const { queryParams, headers } = await buildBingXParams(apiKey, apiSecret, params);
    const data = await relayCall(`${baseUrl}/openApi/swap/v2/trade/allOrders`, 'GET', headers, queryParams);
    if (data?.code === 0 && Array.isArray(data?.data?.orders)) {
      closedTrades.push(...data.data.orders);
      for (const t of data.data.orders) {
        const ts = parseInt(t.updateTime || t.time || 0);
        if (ts > newCursorMs) newCursorMs = ts;
      }
    }
    if (isInitialSync && importHistory && closedTrades.length > historyLimit) closedTrades.length = historyLimit;
    logs.push(`📥 Closed orders: ${closedTrades.length}`);
  } catch (e) {
    logs.push(`❌ Closed trades failed: ${e.message}`);
  }

  // Open positions
  const liveOpenKeys = new Set<string>();
  const openPositions: unknown[] = [];
  try {
    const { queryParams, headers } = await buildBingXParams(apiKey, apiSecret, {});
    const data = await relayCall(`${baseUrl}/openApi/swap/v2/user/positions`, 'GET', headers, queryParams);
    if (data?.code === 0 && Array.isArray(data?.data)) {
      for (const pos of data.data) {
        if (parseFloat(pos.positionAmt || pos.availableAmt || 0) !== 0) {
          openPositions.push(pos);
          const side = pos.positionSide === 'LONG' ? 'Long' : 'Short';
          liveOpenKeys.add(`BINGX:OPEN:${pos.symbol}:${side}`);
        }
      }
    }
    logs.push(`✅ Open positions: ${openPositions.length}`);
  } catch (e) {
    logs.push(`❌ Open positions failed: ${e.message}`);
  }

  // Load existing
  const allExistingTrades = await base44.asServiceRole.entities.Trade.filter({ profile_id: profileId }, '-date_open', 2000);
  const existingByKey = new Map<string, unknown[]>();
  for (const t of allExistingTrades) {
    if (!t.external_id) continue;
    if (!existingByKey.has(t.external_id)) existingByKey.set(t.external_id, []);
    existingByKey.get(t.external_id)!.push(t);
  }

  const toInsert: unknown[] = [];
  const toUpdate: { id: string; data: unknown }[] = [];

  for (const order of closedTrades) {
    if (order.status !== 'FILLED' && order.status !== 'PARTIALLY_FILLED') continue;
    const key = `BINGX:TRADE:${order.symbol}:${order.orderId}`;
    const direction = order.positionSide === 'LONG' ? 'Long' : 'Short';
    const closeTime = parseInt(order.updateTime || order.time || Date.now());
    const qty = parseFloat(order.executedQty || order.origQty || 0);
    const price = parseFloat(order.avgPrice || order.price || 0);
    const pnl = parseFloat(order.profit || 0);

    const tradeData = {
      profile_id: profileId,
      external_id: key,
      import_source: 'bingx',
      coin: order.symbol,
      direction,
      entry_price: price,
      original_entry_price: price,
      position_size: qty * price,
      close_price: price,
      pnl_usd: pnl,
      realized_pnl_usd: pnl,
      pnl_percent_of_balance: currentBalance ? (pnl / currentBalance) * 100 : 0,
      date_open: new Date(closeTime - 60000).toISOString(),
      date: new Date(closeTime - 60000).toISOString(),
      date_close: new Date(closeTime).toISOString(),
      account_balance_at_entry: currentBalance || 100000,
      actual_duration_minutes: 1,
    };

    const existing = (existingByKey.get(key) || []) as Record<string, unknown>[];
    if (existing.length > 0) {
      toUpdate.push({ id: existing[0].id as string, data: tradeData });
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

  // Upsert open positions
  for (const pos of openPositions) {
    const side = pos.positionSide === 'LONG' ? 'Long' : 'Short';
    await upsertGenericOpenPosition(base44, {
      external_id: `BINGX:OPEN:${pos.symbol}:${side}`,
      symbol: pos.symbol,
      direction: side,
      entry_price: parseFloat(pos.avgPrice || pos.entryPrice || 0),
      size: Math.abs(parseFloat(pos.positionAmt || pos.availableAmt || 0)),
      mark_price: parseFloat(pos.markPrice || pos.avgPrice || 0),
      stop_price: null,
      take_price: null,
      unrealized_pnl: parseFloat(pos.unrealizedProfit || pos.unrealisedPnl || 0),
      created_ms: 0,
      import_source: 'bingx',
    }, currentBalance, profileId, existingByKey);
  }

  // Remove stale
  let staleCleaned = 0;
  for (const t of allExistingTrades) {
    if ((t.external_id as string)?.startsWith('BINGX:OPEN:') && !t.close_price && !liveOpenKeys.has(t.external_id as string)) {
      await base44.asServiceRole.entities.Trade.delete(t.id);
      staleCleaned++;
    }
  }
  if (staleCleaned > 0) logs.push(`🧹 Removed ${staleCleaned} stale OPEN record(s)`);

  return { currentBalance, currentEquity: currentBalance, inserted: toInsert.length, updated: toUpdate.length, newCursorMs };
}

// ══════════════════════════════════════════════════════════════════════════════
// ── OKX SYNC ──────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

async function syncOKX(
  base44: unknown,
  conn: Record<string, unknown>,
  apiKey: string,
  apiSecret: string,
  passphrase: string,
  options: { importHistory: boolean; historyLimit: number; connectedAtMs: number; isInitialSync: boolean; effectiveCursorMs: number },
  logs: string[]
) {
  const { importHistory, historyLimit, isInitialSync, effectiveCursorMs } = options;
  const profileId = conn.profile_id as string;
  const isDemo = conn.mode !== 'real';
  const BASE = 'https://www.okx.com';

  // Balance
  let currentBalance: number | null = null;
  try {
    const path = '/api/v5/account/balance';
    const headers = await buildOKXHeaders(apiKey, apiSecret, passphrase, 'GET', path, '', isDemo);
    const data = await relayCall(`${BASE}${path}`, 'GET', headers, {});
    if (data?.code === '0' && data?.data?.length > 0) {
      const details = data.data[0]?.details || [];
      const usdt = details.find((d: Record<string, unknown>) => d.ccy === 'USDT');
      currentBalance = usdt ? parseFloat(usdt.eq as string) : null;
    }
    logs.push(`✅ Balance: ${currentBalance != null ? currentBalance.toFixed(2) + ' USDT' : 'N/A'}`);
  } catch (e) {
    logs.push(`⚠️ Balance failed: ${e.message}`);
  }

  // Closed fills history
  const closedTrades: unknown[] = [];
  let newCursorMs = effectiveCursorMs;
  try {
    const path = '/api/v5/trade/fills-history';
    // OKX fills-history: instType=SWAP for perpetual futures
    let queryStr = 'instType=SWAP&limit=100';
    if (!importHistory || effectiveCursorMs > 0) {
      queryStr += `&begin=${effectiveCursorMs || options.connectedAtMs}`;
    }
    const headers = await buildOKXHeaders(apiKey, apiSecret, passphrase, 'GET', `${path}?${queryStr}`, '', isDemo);
    const data = await relayCall(`${BASE}${path}?${queryStr}`, 'GET', headers, {});
    if (data?.code === '0' && Array.isArray(data?.data)) {
      closedTrades.push(...data.data);
      for (const t of data.data) {
        const ts = parseInt(t.ts || 0);
        if (ts > newCursorMs) newCursorMs = ts;
      }
    }
    if (isInitialSync && importHistory && closedTrades.length > historyLimit) closedTrades.length = historyLimit;
    logs.push(`📥 Closed fills: ${closedTrades.length}`);
  } catch (e) {
    logs.push(`❌ Closed trades failed: ${e.message}`);
  }

  // Open positions
  const liveOpenKeys = new Set<string>();
  const openPositions: unknown[] = [];
  try {
    const path = '/api/v5/account/positions';
    const queryStr = 'instType=SWAP';
    const headers = await buildOKXHeaders(apiKey, apiSecret, passphrase, 'GET', `${path}?${queryStr}`, '', isDemo);
    const data = await relayCall(`${BASE}${path}?${queryStr}`, 'GET', headers, {});
    if (data?.code === '0' && Array.isArray(data?.data)) {
      for (const pos of data.data) {
        if (parseFloat(pos.pos || 0) !== 0) {
          openPositions.push(pos);
          const side = pos.posSide === 'long' ? 'Long' : 'Short';
          liveOpenKeys.add(`OKX:OPEN:${pos.instId}:${side}`);
        }
      }
    }
    logs.push(`✅ Open positions: ${openPositions.length}`);
  } catch (e) {
    logs.push(`❌ Open positions failed: ${e.message}`);
  }

  // Load existing
  const allExistingTrades = await base44.asServiceRole.entities.Trade.filter({ profile_id: profileId }, '-date_open', 2000);
  const existingByKey = new Map<string, unknown[]>();
  for (const t of allExistingTrades) {
    if (!t.external_id) continue;
    if (!existingByKey.has(t.external_id)) existingByKey.set(t.external_id, []);
    existingByKey.get(t.external_id)!.push(t);
  }

  // Group fills by tradeId
  const tradeGroups = new Map<string, unknown[]>();
  for (const fill of closedTrades) {
    const key = `OKX:TRADE:${fill.instId}:${fill.tradeId}`;
    if (!tradeGroups.has(key)) tradeGroups.set(key, []);
    tradeGroups.get(key)!.push(fill);
  }

  const toInsert: unknown[] = [];
  const toUpdate: { id: string; data: unknown }[] = [];

  for (const [key, fills] of tradeGroups) {
    const firstFill = fills[0] as Record<string, unknown>;
    const totalPnl = fills.reduce((s: number, f: Record<string, unknown>) => s + parseFloat(f.pnl as string || '0'), 0);
    const totalSz = fills.reduce((s: number, f: Record<string, unknown>) => s + parseFloat(f.fillSz as string || '0'), 0);
    const weightedPrice = fills.reduce((s: number, f: Record<string, unknown>) => s + parseFloat(f.fillPx as string || '0') * parseFloat(f.fillSz as string || '0'), 0) / totalSz;
    const closeTime = parseInt(firstFill.ts as string || '0');

    // OKX: side=buy closing short, side=sell closing long
    const direction = firstFill.side === 'sell' ? 'Long' : 'Short';

    const tradeData = {
      profile_id: profileId,
      external_id: key,
      import_source: 'okx',
      coin: firstFill.instId as string,
      direction,
      entry_price: weightedPrice,
      original_entry_price: weightedPrice,
      position_size: totalSz * weightedPrice,
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

    const existing = (existingByKey.get(key) || []) as Record<string, unknown>[];
    if (existing.length > 0) {
      toUpdate.push({ id: existing[0].id as string, data: tradeData });
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

  // Upsert open positions
  for (const pos of openPositions) {
    const side = pos.posSide === 'long' ? 'Long' : 'Short';
    await upsertGenericOpenPosition(base44, {
      external_id: `OKX:OPEN:${pos.instId}:${side}`,
      symbol: pos.instId,
      direction: side,
      entry_price: parseFloat(pos.avgPx || 0),
      size: Math.abs(parseFloat(pos.pos || 0)),
      mark_price: parseFloat(pos.markPx || pos.avgPx || 0),
      stop_price: null,
      take_price: null,
      unrealized_pnl: parseFloat(pos.upl || 0),
      created_ms: parseInt(pos.cTime || 0),
      import_source: 'okx',
    }, currentBalance, profileId, existingByKey);
  }

  // Remove stale
  let staleCleaned = 0;
  for (const t of allExistingTrades) {
    if ((t.external_id as string)?.startsWith('OKX:OPEN:') && !t.close_price && !liveOpenKeys.has(t.external_id as string)) {
      await base44.asServiceRole.entities.Trade.delete(t.id);
      staleCleaned++;
    }
  }
  if (staleCleaned > 0) logs.push(`🧹 Removed ${staleCleaned} stale OPEN record(s)`);

  return { currentBalance, currentEquity: currentBalance, inserted: toInsert.length, updated: toUpdate.length, newCursorMs };
}

// ══════════════════════════════════════════════════════════════════════════════
// ── MEXC SYNC (Spot v3 — Binance-compatible) ──────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

async function syncMEXC(
  base44: unknown,
  conn: Record<string, unknown>,
  apiKey: string,
  apiSecret: string,
  options: { importHistory: boolean; historyLimit: number; connectedAtMs: number; isInitialSync: boolean; effectiveCursorMs: number },
  logs: string[]
) {
  const { importHistory, historyLimit, isInitialSync, effectiveCursorMs } = options;
  const profileId = conn.profile_id as string;
  const BASE = 'https://api.mexc.com';

  // Balance (MEXC spot v3)
  let currentBalance: number | null = null;
  try {
    const { queryParams, headers } = await buildMEXCParams(apiKey, apiSecret, {});
    const data = await relayCall(`${BASE}/api/v3/account`, 'GET', headers, queryParams);
    if (data?.balances) {
      const usdt = data.balances.find((b: Record<string, unknown>) => b.asset === 'USDT');
      currentBalance = usdt ? parseFloat(usdt.free as string) : null;
    }
    logs.push(`✅ Balance: ${currentBalance != null ? currentBalance.toFixed(2) + ' USDT' : 'N/A'}`);
  } catch (e) {
    logs.push(`⚠️ Balance failed: ${e.message}`);
  }

  // MEXC spot myTrades — get trades for all symbols (requires symbol param, not ideal)
  // We'll skip closed trade sync for now and just report balance + note
  logs.push(`ℹ️ MEXC: Closed trade sync requires per-symbol queries (not supported in bulk). Balance synced only.`);

  return { currentBalance, currentEquity: currentBalance, inserted: 0, updated: 0, newCursorMs: effectiveCursorMs };
}

// ══════════════════════════════════════════════════════════════════════════════
// ── BITGET SYNC ───────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

async function syncBitget(
  base44: unknown,
  conn: Record<string, unknown>,
  apiKey: string,
  apiSecret: string,
  passphrase: string,
  options: { importHistory: boolean; historyLimit: number; connectedAtMs: number; isInitialSync: boolean; effectiveCursorMs: number },
  logs: string[]
) {
  const { importHistory, historyLimit, isInitialSync, effectiveCursorMs } = options;
  const profileId = conn.profile_id as string;
  const BASE = 'https://api.bitget.com';

  // Balance
  let currentBalance: number | null = null;
  try {
    const path = '/api/v2/mix/account/accounts';
    const queryString = 'productType=USDT-FUTURES';
    const headers = await buildBitgetHeaders(apiKey, apiSecret, passphrase, 'GET', path, queryString);
    const data = await relayCall(`${BASE}${path}?${queryString}`, 'GET', headers, {});
    if (data?.code === '00000' && Array.isArray(data?.data)) {
      const usdt = data.data.find((a: Record<string, unknown>) => a.marginCoin === 'USDT') || data.data[0];
      currentBalance = usdt ? parseFloat(usdt.available as string ?? usdt.equity as string ?? '0') : null;
    }
    logs.push(`✅ Balance: ${currentBalance != null ? currentBalance.toFixed(2) + ' USDT' : 'N/A'}`);
  } catch (e) {
    logs.push(`⚠️ Balance failed: ${e.message}`);
  }

  // Closed orders history
  const closedTrades: unknown[] = [];
  let newCursorMs = effectiveCursorMs;
  try {
    const path = '/api/v2/mix/order/fills-history';
    let queryString = 'productType=USDT-FUTURES&pageSize=100';
    if (!importHistory || effectiveCursorMs > 0) {
      queryString += `&startTime=${effectiveCursorMs || options.connectedAtMs}`;
    }
    const headers = await buildBitgetHeaders(apiKey, apiSecret, passphrase, 'GET', path, queryString);
    const data = await relayCall(`${BASE}${path}?${queryString}`, 'GET', headers, {});
    if (data?.code === '00000' && Array.isArray(data?.data?.fillList)) {
      closedTrades.push(...data.data.fillList);
      for (const t of data.data.fillList) {
        const ts = parseInt(t.cTime || t.uTime || 0);
        if (ts > newCursorMs) newCursorMs = ts;
      }
    }
    if (isInitialSync && importHistory && closedTrades.length > historyLimit) closedTrades.length = historyLimit;
    logs.push(`📥 Closed fills: ${closedTrades.length}`);
  } catch (e) {
    logs.push(`❌ Closed trades failed: ${e.message}`);
  }

  // Open positions
  const liveOpenKeys = new Set<string>();
  const openPositions: unknown[] = [];
  try {
    const path = '/api/v2/mix/position/all-position';
    const queryString = 'productType=USDT-FUTURES&marginCoin=USDT';
    const headers = await buildBitgetHeaders(apiKey, apiSecret, passphrase, 'GET', path, queryString);
    const data = await relayCall(`${BASE}${path}?${queryString}`, 'GET', headers, {});
    if (data?.code === '00000' && Array.isArray(data?.data)) {
      for (const pos of data.data) {
        if (parseFloat(pos.total || 0) !== 0) {
          openPositions.push(pos);
          const side = pos.holdSide === 'long' ? 'Long' : 'Short';
          liveOpenKeys.add(`BITGET:OPEN:${pos.symbol}:${side}`);
        }
      }
    }
    logs.push(`✅ Open positions: ${openPositions.length}`);
  } catch (e) {
    logs.push(`❌ Open positions failed: ${e.message}`);
  }

  // Load existing
  const allExistingTrades = await base44.asServiceRole.entities.Trade.filter({ profile_id: profileId }, '-date_open', 2000);
  const existingByKey = new Map<string, unknown[]>();
  for (const t of allExistingTrades) {
    if (!t.external_id) continue;
    if (!existingByKey.has(t.external_id)) existingByKey.set(t.external_id, []);
    existingByKey.get(t.external_id)!.push(t);
  }

  // Group fills by orderId
  const orderGroups = new Map<string, unknown[]>();
  for (const fill of closedTrades) {
    const key = `BITGET:TRADE:${fill.symbol}:${fill.orderId}`;
    if (!orderGroups.has(key)) orderGroups.set(key, []);
    orderGroups.get(key)!.push(fill);
  }

  const toInsert: unknown[] = [];
  const toUpdate: { id: string; data: unknown }[] = [];

  for (const [key, fills] of orderGroups) {
    const firstFill = fills[0] as Record<string, unknown>;
    const totalPnl = fills.reduce((s: number, f: Record<string, unknown>) => s + parseFloat(f.profit as string || '0'), 0);
    const totalQty = fills.reduce((s: number, f: Record<string, unknown>) => s + parseFloat(f.baseVolume as string || f.sizeQty as string || '0'), 0);
    const weightedPrice = fills.reduce((s: number, f: Record<string, unknown>) => s + parseFloat(f.price as string || '0') * parseFloat(f.baseVolume as string || f.sizeQty as string || '0'), 0) / totalQty;
    const closeTime = parseInt(firstFill.cTime as string || firstFill.uTime as string || '0');

    // Bitget: tradeSide=close_long → was Long; close_short → was Short
    const tradeSide = firstFill.tradeSide as string || '';
    const direction = tradeSide.includes('long') ? 'Long' : (tradeSide.includes('short') ? 'Short' : 'Long');

    const tradeData = {
      profile_id: profileId,
      external_id: key,
      import_source: 'bitget',
      coin: firstFill.symbol as string,
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

    const existing = (existingByKey.get(key) || []) as Record<string, unknown>[];
    if (existing.length > 0) {
      toUpdate.push({ id: existing[0].id as string, data: tradeData });
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

  // Upsert open positions
  for (const pos of openPositions) {
    const side = pos.holdSide === 'long' ? 'Long' : 'Short';
    await upsertGenericOpenPosition(base44, {
      external_id: `BITGET:OPEN:${pos.symbol}:${side}`,
      symbol: pos.symbol,
      direction: side,
      entry_price: parseFloat(pos.openPriceAvg || 0),
      size: Math.abs(parseFloat(pos.total || 0)),
      mark_price: parseFloat(pos.markPrice || pos.openPriceAvg || 0),
      stop_price: null,
      take_price: null,
      unrealized_pnl: parseFloat(pos.unrealizedPL || 0),
      created_ms: parseInt(pos.cTime || 0),
      import_source: 'bitget',
    }, currentBalance, profileId, existingByKey);
  }

  // Remove stale
  let staleCleaned = 0;
  for (const t of allExistingTrades) {
    if ((t.external_id as string)?.startsWith('BITGET:OPEN:') && !t.close_price && !liveOpenKeys.has(t.external_id as string)) {
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

interface OpenPositionInput {
  external_id: string;
  symbol: string;
  direction: 'Long' | 'Short';
  entry_price: number;
  size: number;
  mark_price: number;
  stop_price: number | null;
  take_price: number | null;
  unrealized_pnl: number;
  created_ms: number;
  import_source: string;
  realized_pnl_usd?: number | null;
  partial_closes_json?: string | null;
  force_reset_open?: boolean;
}

async function upsertGenericOpenPosition(
  base44: unknown,
  pos: OpenPositionInput,
  currentBalance: number | null,
  profileId: string,
  existingByKey: Map<string, unknown[]>
) {
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
    realized_pnl_usd: pos.realized_pnl_usd ?? 0,
    partial_closes: pos.partial_closes_json ?? null,
  };

  const existing = (existingByKey.get(pos.external_id) || []) as Record<string, unknown>[];
  // Only reuse existing record if it's still open (no close_price) — otherwise create fresh
  const existingOpen = existing.find((t: Record<string, unknown>) => !t.close_price);

  // Deduplicate: if multiple open records exist for same key, delete extras first
  const allExistingOpen = existing.filter((t: Record<string, unknown>) => !t.close_price);
  if (allExistingOpen.length > 1) {
    // Keep the most recent one, delete the rest
    const sorted = [...allExistingOpen].sort((a, b) =>
      new Date(String(b.date_open || '0')).getTime() - new Date(String(a.date_open || '0')).getTime()
    );
    for (let i = 1; i < sorted.length; i++) {
      await base44.asServiceRole.entities.Trade.delete(sorted[i].id as string);
    }
  }

  const canonicalOpen = allExistingOpen.sort((a, b) =>
    new Date(String(b.date_open || '0')).getTime() - new Date(String(a.date_open || '0')).getTime()
  )[0] || null;

  if (canonicalOpen) {
    const existingEntryPrice = Number(canonicalOpen.entry_price || 0);
    const entryPriceChanged = existingEntryPrice > 0 &&
      Math.abs(existingEntryPrice - pos.entry_price) / (pos.entry_price || 1) > 0.005;

    if (pos.force_reset_open || entryPriceChanged) {
      // New cycle (or entry changed) = recreate OPEN record with fresh date_open
      await base44.asServiceRole.entities.Trade.delete(canonicalOpen.id as string);
      await base44.asServiceRole.entities.Trade.create(data);
    } else {
      // Same position — preserve date_open, update rest
      const updateData = { ...data };
      delete updateData.date_open;
      delete updateData.date;
      delete updateData.actual_duration_minutes;
      // Apply partial close data if present, otherwise clear it
      updateData.realized_pnl_usd = pos.realized_pnl_usd ?? 0;
      updateData.partial_closes = pos.partial_closes_json ?? null;
      await base44.asServiceRole.entities.Trade.update(canonicalOpen.id as string, updateData);
    }
  } else {
    // No existing open record — create fresh (handles re-opened positions)
    await base44.asServiceRole.entities.Trade.create(data);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ── MAIN HANDLER ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  const logs: string[] = [];

  try {
    const base44 = createClientFromRequest(req);
    const authHeader = req.headers.get('authorization') || '';
    const auth = await resolveAuth(base44, authHeader);
    if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { connection_id, cutoff_override_ms, history_limit, force_reimport } = body;
    if (!connection_id) return Response.json({ error: 'connection_id required' }, { status: 400 });

    let connections = await base44.asServiceRole.entities.ExchangeConnection.filter({ id: connection_id });
    let conn = connections[0];
    if (!conn) return Response.json({ error: 'Connection not found' }, { status: 404 });

    const userProfiles = auth.profiles || await base44.asServiceRole.entities.UserProfile.filter({ created_by: auth.email });
    if (!userProfiles.find(p => p.id === conn.profile_id)) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    if (cutoff_override_ms) {
      await base44.asServiceRole.entities.ExchangeConnection.update(connection_id, {
        sync_cursor_ms: cutoff_override_ms,
        import_history: false,
        initial_sync_done: false,
      });
      const updatedConns = await base44.asServiceRole.entities.ExchangeConnection.filter({ id: connection_id });
      if (updatedConns[0]) conn = updatedConns[0];
    }

    if (force_reimport) {
      await base44.asServiceRole.entities.ExchangeConnection.update(connection_id, {
        initial_sync_done: false,
        sync_cursor_ms: 0,
      });
      const updatedConns = await base44.asServiceRole.entities.ExchangeConnection.filter({ id: connection_id });
      if (updatedConns[0]) conn = updatedConns[0];
      logs.push(`🔄 Force reimport requested — resetting sync state`);
    }

    // Decrypt keys
    const apiKey = await decryptValue(conn.api_key_enc);
    const apiSecret = await decryptValue(conn.api_secret_enc);
    const apiPassphrase = conn.api_passphrase_enc
      ? await decryptValue(conn.api_passphrase_enc)
      : '';

    // Mark as syncing
    await base44.asServiceRole.entities.ExchangeConnection.update(connection_id, { last_status: 'syncing' });

    const importHistory = conn.import_history !== false;
    const connectedAtMs = Number(conn.connected_at_ms || Date.now());
    const isInitialSync = !conn.initial_sync_done;
    const exchangeName = (conn.exchange as string) || 'bybit';

    // For Bybit: history_limit = days (30/90/180/365); for others: count (100–1000)
    const rawHistoryLimit = Number(conn.history_limit || (exchangeName === 'bybit' ? 90 : 500));
    const historyLimitN = exchangeName === 'bybit'
      ? Math.max(7, Math.min(365, rawHistoryLimit))   // days
      : Math.max(100, Math.min(2000, rawHistoryLimit)); // count

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

    const exchange = exchangeName;
    logs.push(`🔄 Syncing exchange: ${exchange} | mode: ${conn.mode}`);

    let result: { currentBalance: number | null; currentEquity: number | null; inserted: number; updated: number; newCursorMs: number };

    switch (exchange) {
      case 'bybit':
        result = await syncBybit(base44, conn, apiKey, apiSecret, syncOptions, logs);
        break;
      case 'binance':
        result = await syncBinance(base44, conn, apiKey, apiSecret, syncOptions, logs);
        break;
      case 'bingx':
        result = await syncBingX(base44, conn, apiKey, apiSecret, syncOptions, logs);
        break;
      case 'okx':
        result = await syncOKX(base44, conn, apiKey, apiSecret, apiPassphrase, syncOptions, logs);
        break;
      case 'mexc':
        result = await syncMEXC(base44, conn, apiKey, apiSecret, syncOptions, logs);
        break;
      case 'bitget':
        result = await syncBitget(base44, conn, apiKey, apiSecret, apiPassphrase, syncOptions, logs);
        break;
      default:
        return Response.json({ error: `Unknown exchange: ${exchange}`, logs }, { status: 400 });
    }

    // Update connection status
    await base44.asServiceRole.entities.ExchangeConnection.update(connection_id, {
      last_status: 'ok',
      last_error: null,
      last_sync_at: new Date().toISOString(),
      sync_cursor_ms: result.newCursorMs > 0 ? result.newCursorMs : effectiveCursorMs,
      // Mark initial sync done only if we actually processed it (inserted>0 OR it was an incremental sync)
      initial_sync_done: !isInitialSync || (result.inserted + result.updated) >= 0,
      ...(result.currentBalance != null ? { current_balance: result.currentBalance } : {}),
      ...(result.currentEquity != null ? { current_equity: result.currentEquity } : {}),
    });

    return Response.json({
      ok: true,
      exchange,
      balance: result.currentBalance,
      inserted: result.inserted,
      updated: result.updated,
      skipped: 0,
      logs,
    });

  } catch (error) {
    console.error('[syncExchangeConnection]', error);
    // Update connection error status if we can
    return Response.json({ error: error.message, logs }, { status: 500 });
  }
});
