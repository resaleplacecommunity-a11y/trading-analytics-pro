import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── Crypto helpers ─────────────────────────────────────────────────────────────

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

async function buildHeaders(apiKey, apiSecret, params) {
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

async function bybitCall(targetUrl, method, signedHeaders, params) {
  const bridgeBase = (Deno.env.get('BYBIT_BRIDGE_URL') || Deno.env.get('BYBIT_PROXY_URL') || '').replace(/\/+$/, '');
  const relaySecret = Deno.env.get('BYBIT_PROXY_SECRET') || '';

  let finalUrl = targetUrl;
  let bodyPayload = undefined;
  if (method === 'GET' && params && Object.keys(params).length > 0) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
    ).toString();
    finalUrl = targetUrl + (targetUrl.includes('?') ? '&' : '?') + qs;
  } else if (method !== 'GET' && params) {
    bodyPayload = params;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${bridgeBase}/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-relay-secret': relaySecret },
      body: JSON.stringify({ url: finalUrl, method, headers: signedHeaders || {}, body: bodyPayload }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const txt = await response.text().catch(() => '');
      throw new Error(`Relay error ${response.status}: ${txt}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

// ── Logical key helpers ────────────────────────────────────────────────────────
//
// OPEN trade key  : BYBIT:OPEN:{symbol}:{side}:{posIdx}
// CLOSED trade key: BYBIT:TRADE:{symbol}:{side}:{posIdx}:{avgEntryPrice}
//
// Bybit's /v5/position/closed-pnl returns one row per CLOSE ORDER.
// All close orders for the same position share the SAME avgEntryPrice
// (the running average entry price of that position).
// Using avgEntryPrice as part of the key groups all partial fills into one record
// and distinguishes consecutive positions in the same symbol/side slot.

function makeOpenKey(symbol, side, posIdx) {
  return `BYBIT:OPEN:${symbol}:${side}:${posIdx}`;
}

function makeTradeKey(symbol, side, posIdx, avgEntryPrice) {
  // Use toFixed(8) for consistent representation across syncs (avoids float drift)
  const price = Number(avgEntryPrice || 0).toFixed(8);
  return `BYBIT:TRADE:${symbol}:${side}:${posIdx}:${price}`;
}

// ── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const logs = [];

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { connection_id, cutoff_override_ms, history_limit } = body;
    if (!connection_id) return Response.json({ error: 'connection_id required' }, { status: 400 });

    // Load connection FIRST (must be before any reference to conn)
    let connections = await base44.asServiceRole.entities.ExchangeConnection.filter({ id: connection_id });
    let conn = connections[0];
    if (!conn) return Response.json({ error: 'Connection not found' }, { status: 404 });

    // Verify ownership via profile
    const userProfiles = await base44.asServiceRole.entities.UserProfile.filter({ created_by: user.email });
    if (!userProfiles.find(p => p.id === conn.profile_id)) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    // ── Fast path: cutoff_override_ms = set cursor and run normal sync ─────────
    // This is the "skip history" mode: set sync_cursor_ms = now, then proceed
    // so balance + open positions still get synced, but no historical closed PnL
    if (cutoff_override_ms) {
      await base44.asServiceRole.entities.ExchangeConnection.update(connection_id, {
        sync_cursor_ms: cutoff_override_ms,
        import_history: false,
        initial_sync_done: false, // let it run normal sync below with new cursor
      });
      // Reload conn so subsequent logic uses the updated cursor
      const updatedConns = await base44.asServiceRole.entities.ExchangeConnection.filter({ id: connection_id });
      if (updatedConns[0]) conn = updatedConns[0];
    }

    const profileId = conn.profile_id;
    const baseUrl = conn.base_url;

    // Decrypt keys
    const apiKey = await decryptValue(conn.api_key_enc);
    const apiSecret = await decryptValue(conn.api_secret_enc);

    // Mark as syncing
    await base44.asServiceRole.entities.ExchangeConnection.update(connection_id, { last_status: 'syncing' });

    // Import mode behavior
    // - import_history=true  => initial sync can import historical closes (capped by history_limit)
    // - import_history=false => ignore all closes before connection time
    const importHistory = conn.import_history !== false;
    const historyLimit = Math.max(100, Math.min(1000, Number(conn.history_limit || 500)));
    const connectedAtMs = Number(conn.connected_at_ms || Date.now());
    const isInitialSync = !conn.initial_sync_done;

    // ── Step 0: Prefetch all existing trades once ──────────────────────────────
    let effectiveCursorMs = conn.sync_cursor_ms || 0;
    const allExistingTrades0 = await base44.asServiceRole.entities.Trade.filter(
      { profile_id: profileId }, '-date_open', 2000
    );
    // Migration: remove old BYBIT:CLOSED:* keys
    const oldFormat = allExistingTrades0.filter(t => t.external_id?.startsWith('BYBIT:CLOSED:'));
    if (oldFormat.length > 0) {
      await Promise.all(oldFormat.map(t => base44.asServiceRole.entities.Trade.delete(t.id)));
      effectiveCursorMs = 0;
      logs.push(`🔄 Migration: removed ${oldFormat.length} old-format records`);
    }

    if (!importHistory && (!effectiveCursorMs || effectiveCursorMs === 0)) {
      effectiveCursorMs = connectedAtMs;
      logs.push(`⏱️ Import mode: new-only`);
    }

    const historyLimitMode = history_limit && history_limit > 0;
    const historyLimitN = historyLimitMode ? Math.min(parseInt(history_limit), 200) : null;

    // ── Step 1: Balance ────────────────────────────────────────────────────────
    let currentBalance = null;
    try {
      const p = { accountType: 'UNIFIED' };
      const h = await buildHeaders(apiKey, apiSecret, p);
      const data = await bybitCall(`${baseUrl}/v5/account/wallet-balance`, 'GET', h, p);
      if (data.retCode === 0) {
        const acct = data?.result?.list?.[0];
        if (acct?.coin) {
          const usdt = acct.coin.find(c => c.coin === 'USDT');
          currentBalance = usdt ? parseFloat(usdt.walletBalance) : parseFloat(acct.totalWalletBalance || 0);
        } else if (acct?.totalWalletBalance) {
          currentBalance = parseFloat(acct.totalWalletBalance);
        }
      }
      logs.push(`✅ Balance: ${currentBalance != null ? currentBalance.toFixed(2) + ' USDT' : 'N/A'}`);
    } catch (e) {
      logs.push(`⚠️ Balance failed: ${e.message}`);
    }

    // ── Step 2: Closed PnL (up to 2 pages = 200 records per sync) ─────────────
    const allClosedPnl = [];
    let newCursorMs = effectiveCursorMs;
    try {
      const closedPnlParams = { category: 'linear', limit: 100 };
      if (!historyLimitMode && effectiveCursorMs > 0) closedPnlParams.startTime = effectiveCursorMs;

      let cursor = null;
      for (let page = 0; page < 2; page++) {
        const params = { ...closedPnlParams };
        if (cursor) params.cursor = cursor;
        const h = await buildHeaders(apiKey, apiSecret, params);
        const data = await bybitCall(`${baseUrl}/v5/position/closed-pnl`, 'GET', h, params);
        if (data.retCode !== 0) { logs.push(`❌ Closed PnL: ${data.retMsg}`); break; }
        const list = data?.result?.list || [];
        allClosedPnl.push(...list);
        for (const c of list) {
          const t = parseInt(c.updatedTime || c.createdTime || 0);
          if (t > newCursorMs) newCursorMs = t;
        }
        cursor = data?.result?.nextPageCursor || null;
        if (!cursor || list.length === 0) break;
        if (isInitialSync && importHistory && effectiveCursorMs === 0 && allClosedPnl.length >= historyLimit) break;
      }
      if (historyLimitMode && allClosedPnl.length > historyLimitN) allClosedPnl.splice(historyLimitN);
      if (isInitialSync && importHistory && allClosedPnl.length > historyLimit) allClosedPnl.length = historyLimit;
      logs.push(`📥 Closed PnL: ${allClosedPnl.length} records`);
    } catch (e) {
      logs.push(`❌ Closed PnL failed: ${e.message}`);
    }

    // ── Step 5: Open positions ─────────────────────────────────────────────────
    const liveOpenKeys = new Set();
    const openUpserts = [];
    try {
      const p = { category: 'linear', settleCoin: 'USDT' };
      const h = await buildHeaders(apiKey, apiSecret, p);
      const data = await bybitCall(`${baseUrl}/v5/position/list`, 'GET', h, p);
      if (data.retCode === 0 && data?.result?.list) {
        const openPositions = data.result.list.filter(pos => parseFloat(pos.size || 0) > 0);
        for (const pos of openPositions) {
          liveOpenKeys.add(makeOpenKey(pos.symbol, pos.side, pos.positionIdx ?? 0));
          openUpserts.push(pos);
        }
        logs.push(`✅ Open positions: ${openPositions.length}`);
      }
    } catch (e) {
      logs.push(`❌ Open positions failed: ${e.message}`);
    }

    // ── Build existing trades map ──────────────────────────────────────────────
    const allExistingTrades = oldFormat.length > 0
      ? await base44.asServiceRole.entities.Trade.filter({ profile_id: profileId }, '-date_open', 2000)
      : allExistingTrades0.filter(t => !t.external_id?.startsWith('BYBIT:CLOSED:'));
    const existingByKey = new Map();
    for (const t of allExistingTrades) {
      if (!t.external_id) continue;
      if (!existingByKey.has(t.external_id)) existingByKey.set(t.external_id, []);
      existingByKey.get(t.external_id).push(t);
    }

    // ── Step 3: Group close orders by logical trade key ────────────────────────
    const closedGroups = new Map();
    for (const c of allClosedPnl) {
      const posIdx = c.positionIdx ?? 0;
      const key = makeTradeKey(c.symbol, c.side, posIdx, c.avgEntryPrice);
      if (!closedGroups.has(key)) {
        closedGroups.set(key, {
          key,
          symbol: c.symbol,
          side: c.side,
          posIdx,
          avgEntryPrice: parseFloat(c.avgEntryPrice || 0),
          openKey: makeOpenKey(c.symbol, c.side, posIdx),
          orders: [],
        });
      }
      closedGroups.get(key).orders.push(c);
    }
    logs.push(`🔑 Trade groups: ${closedGroups.size} from ${allClosedPnl.length} close records`);

    // ── Step 4: Build upsert operations (pure CPU, no DB) ─────────────────────
    const toInsert = [];
    const toUpdate = [];  // { id, data }
    const toDelete = [];  // ids
    const referencedOpenKeys = new Set();

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
      const direction = group.side === 'Buy' ? 'Long' : 'Short';

      const partialDetails = group.orders.map(o => ({
        order_id: o.orderId,
        size: parseFloat(o.closedSize || o.qty || 0),
        price: parseFloat(o.avgExitPrice || o.avgPrice || 0),
        pnl: parseFloat(o.closedPnl || 0),
        time: o.updatedTime,
      }));

      const openTimeMs = (earliestOpenTime !== Infinity && earliestOpenTime > 0 && earliestOpenTime < latestCloseTime)
        ? earliestOpenTime : Math.max(0, latestCloseTime - 60000);
      const closeTimeMs = latestCloseTime || Date.now();
      const durationMinutes = Math.max(0, Math.floor((closeTimeMs - openTimeMs) / 60000));

      const openTrade = (existingByKey.get(group.openKey) || [])[0] || null;
      const stopPrice = openTrade?.stop_price ?? null;
      const takePrice = openTrade?.take_price ?? null;
      const stopWasHit = stopPrice != null ? Math.abs(avgExitPrice - Number(stopPrice)) <= Math.max(0.0000001, Number(stopPrice) * 0.0015) : false;
      const takeWasHit = takePrice != null ? Math.abs(avgExitPrice - Number(takePrice)) <= Math.max(0.0000001, Number(takePrice) * 0.0015) : false;

      const closeReasons = group.orders.map(o => (o.stopOrderType || o.execType || '')).join(',').toLowerCase();
      const stopPriceFromOrders = group.orders.find(o => parseFloat(o.stopLoss || 0) > 0);
      const takePriceFromOrders = group.orders.find(o => parseFloat(o.takeProfit || 0) > 0);

      const tradeData = {
        profile_id: profileId,
        external_id: key,
        import_source: 'bybit',
        coin: group.symbol,
        direction,
        entry_price: group.avgEntryPrice,
        original_entry_price: group.avgEntryPrice,
        position_size: positionSizeUsd,
        stop_price: stopPrice ?? (stopPriceFromOrders ? parseFloat(stopPriceFromOrders.stopLoss) : null),
        take_price: takePrice ?? (takePriceFromOrders ? parseFloat(takePriceFromOrders.takeProfit) : null),
        stop_loss_was_hit: closeReasons.includes('stoploss') || closeReasons.includes('stop_loss') || stopWasHit,
        take_profit_was_hit: closeReasons.includes('takeprofit') || closeReasons.includes('take_profit') || takeWasHit,
        close_price: avgExitPrice,
        pnl_usd: totalPnl,
        realized_pnl_usd: totalPnl,
        pnl_percent_of_balance: currentBalance ? (totalPnl / currentBalance) * 100 : 0,
        date_open: new Date(openTimeMs).toISOString(),
        date: new Date(openTimeMs).toISOString(),
        date_close: new Date(closeTimeMs).toISOString(),
        account_balance_at_entry: currentBalance || 100000,
        partial_closes: JSON.stringify(partialDetails),
        actual_duration_minutes: durationMinutes,
      };

      const existing = existingByKey.get(key) || [];
      if (existing.length > 0) {
        toUpdate.push({ id: existing[0].id, data: tradeData });
        for (let i = 1; i < existing.length; i++) toDelete.push(existing[i].id);
      } else {
        toInsert.push(tradeData);
      }
      referencedOpenKeys.add(group.openKey);
    }

    // ── Execute DB operations in parallel batches ──────────────────────────────
    const BATCH = 20;

    // Bulk insert
    if (toInsert.length > 0) {
      for (let i = 0; i < toInsert.length; i += BATCH) {
        await base44.asServiceRole.entities.Trade.bulkCreate(toInsert.slice(i, i + BATCH));
      }
    }

    // Parallel updates
    for (let i = 0; i < toUpdate.length; i += BATCH) {
      const batch = toUpdate.slice(i, i + BATCH);
      await Promise.all(batch.map(op => base44.asServiceRole.entities.Trade.update(op.id, op.data)));
    }

    // Parallel deletes
    for (let i = 0; i < toDelete.length; i += BATCH) {
      const batch = toDelete.slice(i, i + BATCH);
      await Promise.all(batch.map(id => base44.asServiceRole.entities.Trade.delete(id)));
    }

    const inserted = toInsert.length;
    const updated = toUpdate.length;
    logs.push(`✅ Closed trades: ${inserted} new, ${updated} updated`);

    // ── Step 5: Upsert open positions (data fetched in parallel above) ────────
    for (const pos of openUpserts) {
      await upsertOpenPosition(base44, pos, currentBalance, profileId, existingByKey);
    }

    // ── Step 6: Remove stale OPEN records (from memory, no extra queries) ─────
    try {
      let staleCleaned = 0;
      for (const openKey of referencedOpenKeys) {
        if (!liveOpenKeys.has(openKey)) {
          const stale = existingByKey.get(openKey) || [];
          for (const ot of stale) {
            await base44.asServiceRole.entities.Trade.delete(ot.id);
            staleCleaned++;
          }
        }
      }
      if (staleCleaned > 0) logs.push(`🧹 Removed ${staleCleaned} stale OPEN record(s)`);
    } catch (e) {
      logs.push(`⚠️ Stale OPEN cleanup failed: ${e.message}`);
    }

    // ── Step 7: Junk cleanup (from memory) ────────────────────────────────────
    try {
      const junkyPrefixes = ['open_', 'test_sync_'];
      let cleaned = 0;
      for (const t of allExistingTrades) {
        if (t.external_id && junkyPrefixes.some(p => t.external_id.startsWith(p))) {
          await base44.asServiceRole.entities.Trade.delete(t.id);
          cleaned++;
        }
      }
      if (cleaned > 0) logs.push(`🧹 Cleaned ${cleaned} junk records`);
    } catch (e) {
      logs.push(`⚠️ Cleanup failed: ${e.message}`);
    }

    // ── Update connection status ───────────────────────────────────────────────
    await base44.asServiceRole.entities.ExchangeConnection.update(connection_id, {
      last_status: 'ok',
      last_error: null,
      last_sync_at: new Date().toISOString(),
      sync_cursor_ms: newCursorMs > 0 ? newCursorMs : effectiveCursorMs,
      initial_sync_done: true,
      ...(currentBalance != null ? { current_balance: currentBalance } : {}),
    });

    return Response.json({
      ok: true,
      balance: currentBalance,
      inserted,
      updated,
      skipped: 0,
      logical_key_field: 'BYBIT:TRADE:{symbol}:{side}:{positionIdx}:{avgEntryPrice_8dp}',
      logs,
    });

  } catch (error) {
    console.error('[syncExchangeConnection]', error);
    return Response.json({ error: error.message, logs }, { status: 500 });
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────────

async function upsertOpenPosition(base44, pos, currentBalance, profileId, existingByKey) {
  const symbol = pos.symbol;
  const side = pos.side;
  const posIdx = pos.positionIdx ?? 0;
  const externalId = `BYBIT:OPEN:${symbol}:${side}:${posIdx}`;

  const existing = existingByKey ? (existingByKey.get(externalId) || []) :
    await base44.asServiceRole.entities.Trade.filter({ external_id: externalId, profile_id: profileId });

  const direction = side === 'Buy' ? 'Long' : 'Short';
  const entryPrice = parseFloat(pos.avgPrice || pos.entryPrice || 0);
  const size = parseFloat(pos.size || 0);
  const markPrice = parseFloat(pos.markPrice || entryPrice);
  const positionSizeUsd = size * markPrice;
  const stopPrice = parseFloat(pos.stopLoss || 0) || null;
  const riskUsd = (stopPrice && entryPrice > 0)
    ? (Math.abs(entryPrice - stopPrice) / entryPrice) * positionSizeUsd
    : 0;

  const createdMs = pos.createdTime ? parseInt(pos.createdTime) : 0;
  const openDateIso = (createdMs > 0 && createdMs < Date.now())
    ? new Date(createdMs).toISOString()
    : new Date().toISOString();
  const durationMinutes = Math.max(0, Math.floor((Date.now() - new Date(openDateIso).getTime()) / 60000));

  const data = {
    profile_id: profileId,
    external_id: externalId,
    import_source: 'bybit',
    coin: symbol,
    direction,
    entry_price: entryPrice,
    original_entry_price: entryPrice,
    position_size: positionSizeUsd,
    stop_price: stopPrice,
    original_stop_price: stopPrice,
    take_price: parseFloat(pos.takeProfit || 0) || null,
    risk_usd: riskUsd,
    original_risk_usd: riskUsd,
    max_risk_usd: riskUsd,
    pnl_usd: parseFloat(pos.unrealisedPnl || 0),
    date_open: openDateIso,
    date: openDateIso,
    close_price: null,
    date_close: null,
    account_balance_at_entry: currentBalance || 100000,
    actual_duration_minutes: durationMinutes,
  };

  if (existing.length > 0) {
    await base44.asServiceRole.entities.Trade.update(existing[0].id, data);
  } else {
    await base44.asServiceRole.entities.Trade.create(data);
  }
}