import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const proxyUrl = Deno.env.get('BYBIT_PROXY_URL');
    const proxySecret = Deno.env.get('BYBIT_PROXY_SECRET');

    if (!proxyUrl || !proxySecret) {
      return Response.json({ error: 'Proxy credentials not configured' }, { status: 500 });
    }

    // Get or create API settings
    let apiSettings = await base44.asServiceRole.entities.ApiSettings.list();
    let settings = apiSettings[0];

    if (!settings) {
      settings = await base44.asServiceRole.entities.ApiSettings.create({
        exchange: 'bybit',
        bybit_sync_initialized: false,
      });
    }

    // Call proxy
    const response = await fetch(`${proxyUrl}/proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Proxy-Secret': proxySecret,
      },
      body: JSON.stringify({
        type: 'sync_journal',
        accountType: 'UNIFIED',
        category: 'linear',
        limit: 100,
        includeExecutions: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return Response.json({
        error: errorData.detail || 'Proxy request failed',
        status: response.status,
      }, { status: response.status });
    }

    const data = await response.json();
    const normalized = data.normalized || {};

    const now = Date.now();
    let updatedBalance = null;
    let openUpserted = 0;
    let closedUpserted = 0;

    // Update balance
    if (normalized.balance) {
      updatedBalance = normalized.balance.totalEquity || normalized.balance.walletBalance || null;
    }

    // First initialization
    if (!settings.bybit_sync_initialized) {
      // Set baselines to NOW
      await base44.asServiceRole.entities.ApiSettings.update(settings.id, {
        bybit_sync_initialized: true,
        closed_baseline_ms: now,
        exec_baseline_ms: now,
        last_sync: new Date().toISOString(),
      });

      // Process ONLY open positions (don't import closed history)
      if (normalized.open && Array.isArray(normalized.open)) {
        for (const pos of normalized.open) {
          await upsertOpenPosition(base44, pos, updatedBalance);
          openUpserted++;
        }
      }

      return Response.json({
        success: true,
        initialized: true,
        balance: updatedBalance,
        openPositions: openUpserted,
        closedTrades: 0,
        message: 'Initial sync complete. Only open positions imported.',
      });
    }

    // Subsequent syncs - process new closed trades
    if (normalized.open && Array.isArray(normalized.open)) {
      for (const pos of normalized.open) {
        await upsertOpenPosition(base44, pos, updatedBalance);
        openUpserted++;
      }
    }

    let newClosedBaselineMs = settings.closed_baseline_ms || now;

    if (normalized.closed && Array.isArray(normalized.closed)) {
      for (const closed of normalized.closed) {
        const closedAtMs = closed.closedAtMs || 0;
        
        // Only import trades AFTER baseline
        if (closedAtMs > (settings.closed_baseline_ms || 0)) {
          await upsertClosedTrade(base44, closed, updatedBalance);
          closedUpserted++;
          
          if (closedAtMs > newClosedBaselineMs) {
            newClosedBaselineMs = closedAtMs;
          }
        }
      }
    }

    // Update baselines and last_sync
    await base44.asServiceRole.entities.ApiSettings.update(settings.id, {
      closed_baseline_ms: newClosedBaselineMs,
      last_sync: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      balance: updatedBalance,
      openPositions: openUpserted,
      closedTrades: closedUpserted,
      message: 'Sync complete',
    });

  } catch (error) {
    return Response.json({
      error: error.message || 'Internal server error',
      success: false,
    }, { status: 500 });
  }
});

async function upsertOpenPosition(base44, pos, currentBalance) {
  const externalId = `BYBIT:OPEN:${pos.coin}:${pos.direction}`;
  
  // Try to find existing trade by external_id
  const existing = await base44.asServiceRole.entities.Trade.filter({ external_id: externalId });
  
  const tradeData = {
    external_id: externalId,
    coin: pos.coin,
    direction: pos.direction === 'Long' ? 'Long' : 'Short',
    entry_price: pos.entryPrice,
    position_size: pos.positionSizeUsd,
    stop_price: pos.stopLoss || null,
    take_price: pos.takeProfit || null,
    pnl_usd: pos.pnlUsd || 0,
    date_open: pos.openedAtMs ? new Date(pos.openedAtMs).toISOString() : new Date().toISOString(),
    date: pos.openedAtMs ? new Date(pos.openedAtMs).toISOString() : new Date().toISOString(),
    close_price: null,
    account_balance_at_entry: currentBalance || 100000,
  };

  if (existing.length > 0) {
    await base44.asServiceRole.entities.Trade.update(existing[0].id, tradeData);
  } else {
    await base44.asServiceRole.entities.Trade.create(tradeData);
  }
}

async function upsertClosedTrade(base44, closed, currentBalance) {
  // Build external_id
  let externalId = `BYBIT:CLOSED:${closed.coin}:${closed.direction}:${closed.closedAtMs}:${closed.entryPrice}:${closed.closePrice}`;
  
  // Try to find existing trade
  const existing = await base44.asServiceRole.entities.Trade.filter({ external_id: externalId });
  
  const tradeData = {
    external_id: externalId,
    coin: closed.coin,
    direction: closed.direction === 'Long' ? 'Long' : 'Short',
    entry_price: closed.entryPrice,
    position_size: closed.positionSizeUsd,
    stop_price: closed.stopLoss || null,
    take_price: closed.takeProfit || null,
    close_price: closed.closePrice,
    pnl_usd: closed.pnlUsd || 0,
    pnl_percent_of_balance: closed.pnlPct || 0,
    r_multiple: closed.rMultiple || null,
    date_open: closed.openedAtMs ? new Date(closed.openedAtMs).toISOString() : new Date().toISOString(),
    date: closed.openedAtMs ? new Date(closed.openedAtMs).toISOString() : new Date().toISOString(),
    date_close: closed.closedAtMs ? new Date(closed.closedAtMs).toISOString() : new Date().toISOString(),
    account_balance_at_entry: currentBalance || 100000,
  };

  if (existing.length > 0) {
    await base44.asServiceRole.entities.Trade.update(existing[0].id, tradeData);
  } else {
    await base44.asServiceRole.entities.Trade.create(tradeData);
  }
}