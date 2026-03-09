import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// AES-GCM decrypt
async function getKey() {
  const secret = Deno.env.get('BASE44_APP_ID') || 'default-secret-key-32-chars-padded';
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
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

// HMAC-SHA256 sign for Bybit
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

async function relayCall(relayUrl, relaySecret, targetUrl, method, headers, params) {
  const response = await fetch(relayUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-relay-secret': relaySecret },
    body: JSON.stringify({ url: targetUrl, method, headers: headers || {}, body: params || {} }),
  });
  if (!response.ok) {
    const txt = await response.text().catch(() => '');
    throw new Error(`Relay error ${response.status}: ${txt}`);
  }
  return await response.json();
}

Deno.serve(async (req) => {
  const logs = [];

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { connection_id } = body;
    if (!connection_id) return Response.json({ error: 'connection_id required' }, { status: 400 });

    // Load connection
    const connections = await base44.asServiceRole.entities.ExchangeConnection.filter({ id: connection_id });
    const conn = connections[0];
    if (!conn) return Response.json({ error: 'Connection not found' }, { status: 404 });
    if (conn.created_by !== user.email) return Response.json({ error: 'Access denied' }, { status: 403 });

    const profileId = conn.profile_id;
    const relayUrl = 'https://pencil-vcr-genesis-wall.trycloudflare.com/proxy';
    const relaySecret = Deno.env.get('BYBIT_PROXY_SECRET');
    const baseUrl = conn.base_url;

    if (!relayUrl || !relaySecret) {
      await base44.asServiceRole.entities.ExchangeConnection.update(connection_id, {
        last_status: 'error',
        last_error: 'Relay not configured',
      });
      return Response.json({ error: 'Relay not configured' }, { status: 500 });
    }

    // Decrypt keys
    const apiKey = await decryptValue(conn.api_key_enc);
    const apiSecret = await decryptValue(conn.api_secret_enc);

    // Mark as syncing
    await base44.asServiceRole.entities.ExchangeConnection.update(connection_id, { last_status: 'syncing' });

    // ── Fetch balance ──────────────────────────────────────────────────────
    let currentBalance = null;
    try {
      const params = { accountType: 'UNIFIED' };
      const headers = await buildHeaders(apiKey, apiSecret, params);
      const data = await relayCall(relayUrl, relaySecret, `${baseUrl}/v5/account/wallet-balance`, 'GET', headers, params);
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
      logs.push(`⚠️ Balance fetch failed: ${e.message}`);
    }

    // ── Cursor for incremental sync ────────────────────────────────────────
    const cursorMs = conn.sync_cursor_ms || 0;
    let newCursorMs = cursorMs;

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    // ── Sync open positions ────────────────────────────────────────────────
    try {
      const params = { category: 'linear', settleCoin: 'USDT' };
      const headers = await buildHeaders(apiKey, apiSecret, params);
      const data = await relayCall(relayUrl, relaySecret, `${baseUrl}/v5/position/list`, 'GET', headers, params);
      if (data.retCode === 0 && data?.result?.list) {
        for (const pos of data.result.list) {
          if (parseFloat(pos.size || 0) <= 0) continue;
          await upsertOpenPosition(base44, pos, currentBalance, profileId);
        }
        logs.push(`✅ Open positions synced: ${data.result.list.filter(p => parseFloat(p.size) > 0).length}`);
      }
    } catch (e) {
      logs.push(`❌ Open positions failed: ${e.message}`);
    }

    // ── Sync closed PnL (paginated) ────────────────────────────────────────
    try {
      let cursor = null;
      let hasMore = true;
      while (hasMore) {
        const params = { category: 'linear', limit: 100 };
        if (cursorMs > 0) params.startTime = cursorMs;
        if (cursor) params.cursor = cursor;

        const headers = await buildHeaders(apiKey, apiSecret, params);
        const data = await relayCall(relayUrl, relaySecret, `${baseUrl}/v5/position/closed-pnl`, 'GET', headers, params);

        if (data.retCode !== 0) {
          logs.push(`❌ Closed PnL error: ${data.retMsg}`);
          break;
        }

        const list = data?.result?.list || [];
        for (const closed of list) {
          const result = await upsertClosedTrade(base44, closed, currentBalance, profileId);
          if (result === 'inserted') inserted++;
          else if (result === 'updated') updated++;
          else skipped++;

          const t = parseInt(closed.updatedTime || closed.createdTime || 0);
          if (t > newCursorMs) newCursorMs = t;
        }

        cursor = data?.result?.nextPageCursor || null;
        hasMore = !!cursor && list.length > 0;
      }
      logs.push(`✅ Closed trades: ${inserted} new, ${updated} updated, ${skipped} skipped`);
    } catch (e) {
      logs.push(`❌ Closed trades sync failed: ${e.message}`);
    }

    // ── Clean junk external_ids ────────────────────────────────────────────
    try {
      const junkyPrefixes = ['open_', 'test_sync_'];
      const allTrades = await base44.asServiceRole.entities.Trade.filter({ profile_id: profileId });
      let cleaned = 0;
      for (const t of allTrades) {
        if (t.external_id && junkyPrefixes.some(p => t.external_id.startsWith(p))) {
          await base44.asServiceRole.entities.Trade.delete(t.id);
          cleaned++;
        }
      }
      if (cleaned > 0) logs.push(`🧹 Cleaned ${cleaned} junk records`);
    } catch (e) {
      logs.push(`⚠️ Cleanup failed: ${e.message}`);
    }

    // ── Update connection status ───────────────────────────────────────────
    await base44.asServiceRole.entities.ExchangeConnection.update(connection_id, {
      last_status: 'ok',
      last_error: null,
      last_sync_at: new Date().toISOString(),
      sync_cursor_ms: newCursorMs > 0 ? newCursorMs : cursorMs,
    });

    return Response.json({
      ok: true,
      balance: currentBalance,
      inserted,
      updated,
      skipped,
      logs,
    });

  } catch (error) {
    console.error('[syncExchangeConnection]', error);
    return Response.json({ error: error.message, logs }, { status: 500 });
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────

async function upsertOpenPosition(base44, pos, currentBalance, profileId) {
  const symbol = pos.symbol;
  const side = pos.side;
  const posIdx = pos.positionIdx || 0;
  const externalId = `BYBIT:OPEN:${symbol}:${side}:${posIdx}`;

  const existing = await base44.asServiceRole.entities.Trade.filter({ external_id: externalId, profile_id: profileId });

  const direction = side === 'Buy' ? 'Long' : 'Short';
  const entryPrice = parseFloat(pos.avgPrice || pos.entryPrice || 0);
  const size = parseFloat(pos.size || 0);
  const markPrice = parseFloat(pos.markPrice || entryPrice);
  const positionSizeUsd = size * markPrice;
  const stopPrice = parseFloat(pos.stopLoss || 0) || null;
  const riskUsd = stopPrice && entryPrice > 0 ? (Math.abs(entryPrice - stopPrice) / entryPrice) * positionSizeUsd : 0;

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
    date_open: pos.createdTime ? new Date(parseInt(pos.createdTime)).toISOString() : new Date().toISOString(),
    date: pos.createdTime ? new Date(parseInt(pos.createdTime)).toISOString() : new Date().toISOString(),
    close_price: null,
    account_balance_at_entry: currentBalance || 100000,
  };

  if (existing.length > 0) {
    await base44.asServiceRole.entities.Trade.update(existing[0].id, data);
  } else {
    await base44.asServiceRole.entities.Trade.create(data);
  }
}

async function upsertClosedTrade(base44, closed, currentBalance, profileId) {
  const symbol = closed.symbol;
  const side = closed.side;
  const orderId = closed.orderId || (closed.updatedTime + '_' + symbol);
  const externalId = `BYBIT:CLOSED:${symbol}:${side}:${orderId}`;

  const existing = await base44.asServiceRole.entities.Trade.filter({ external_id: externalId, profile_id: profileId });

  const direction = side === 'Buy' ? 'Long' : 'Short';
  const avgExitPrice = parseFloat(closed.avgExitPrice || closed.avgPrice || 0);
  const avgEntryPrice = parseFloat(closed.avgEntryPrice || 0);
  const closedSize = parseFloat(closed.closedSize || closed.qty || 0);
  const closedPnl = parseFloat(closed.closedPnl || 0);
  const positionSizeUsd = closedSize * avgEntryPrice;

  const data = {
    profile_id: profileId,
    external_id: externalId,
    import_source: 'bybit',
    coin: symbol,
    direction,
    entry_price: avgEntryPrice,
    original_entry_price: avgEntryPrice,
    position_size: positionSizeUsd,
    close_price: avgExitPrice,
    pnl_usd: closedPnl,
    realized_pnl_usd: closedPnl,
    pnl_percent_of_balance: currentBalance ? (closedPnl / currentBalance) * 100 : 0,
    date_open: closed.createdTime ? new Date(parseInt(closed.createdTime)).toISOString() : new Date().toISOString(),
    date: closed.createdTime ? new Date(parseInt(closed.createdTime)).toISOString() : new Date().toISOString(),
    date_close: closed.updatedTime ? new Date(parseInt(closed.updatedTime)).toISOString() : new Date().toISOString(),
    account_balance_at_entry: currentBalance || 100000,
  };

  if (existing.length > 0) {
    await base44.asServiceRole.entities.Trade.update(existing[0].id, data);
    return 'updated';
  } else {
    await base44.asServiceRole.entities.Trade.create(data);
    return 'inserted';
  }
}