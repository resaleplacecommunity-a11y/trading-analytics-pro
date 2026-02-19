import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Relay proxy call - all Bybit API calls go through this
async function relayCall(url, method, headers, body) {
  const relayUrl = Deno.env.get('BYBIT_PROXY_URL');
  const relaySecret = Deno.env.get('BYBIT_PROXY_SECRET');

  if (!relayUrl || !relaySecret) {
    throw new Error('BYBIT_PROXY_URL or BYBIT_PROXY_SECRET not configured');
  }

  const response = await fetch(relayUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-relay-secret': relaySecret,
    },
    body: JSON.stringify({
      url,
      method,
      headers: headers || {},
      body: body || {},
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Relay failed: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

Deno.serve(async (req) => {
  const notifications = [];
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ 
        error: 'Unauthorized',
        notifications: ['❌ Authentication failed. Please log in again.']
      }, { status: 401 });
    }

    // Get active profile ID
    const profiles = await base44.asServiceRole.entities.UserProfile.filter({ 
      created_by: user.email,
      is_active: true 
    });
    
    if (!profiles.length) {
      return Response.json({ 
        error: 'No active profile',
        notifications: ['⚠️ No active trading profile found. Create a profile in Settings.']
      }, { status: 400 });
    }
    
    const activeProfileId = profiles[0].id;

    // Validate relay config
    const relayUrl = Deno.env.get('BYBIT_PROXY_URL');
    const relaySecret = Deno.env.get('BYBIT_PROXY_SECRET');
    
    if (!relayUrl || !relaySecret) {
      return Response.json({ 
        error: 'Relay not configured',
        notifications: ['❌ Bybit relay proxy not configured. Contact support.']
      }, { status: 500 });
    }

    // Get or create API settings (global, not profile-scoped)
    let apiSettings = await base44.asServiceRole.entities.ApiSettings.list();
    let settings = apiSettings[0];

    if (!settings) {
      settings = await base44.asServiceRole.entities.ApiSettings.create({
        exchange: 'bybit',
        bybit_sync_initialized: false,
      });
    }

    // Get balance via relay
    let currentBalance = null;
    try {
      const balanceData = await relayCall(
        'https://api-demo.bybit.com/v5/account/wallet-balance',
        'GET',
        { 'X-Account-Type': 'UNIFIED' },
        { accountType: 'UNIFIED' }
      );
      
      if (balanceData?.result?.list?.[0]) {
        const account = balanceData.result.list[0];
        if (account.coin) {
          const usdtCoin = account.coin.find(c => c.coin === 'USDT');
          if (usdtCoin?.walletBalance) {
            currentBalance = parseFloat(usdtCoin.walletBalance);
          }
        }
        if (currentBalance === null && account.totalWalletBalance) {
          currentBalance = parseFloat(account.totalWalletBalance);
        }
      }
      notifications.push(`✅ Account authorized. Balance: ${currentBalance ? currentBalance.toFixed(2) + ' USDT' : 'N/A'}`);
    } catch (e) {
      notifications.push(`⚠️ Failed to fetch balance: ${e.message}. Continuing without balance data.`);
    }

    let openUpserted = 0;
    let closedUpserted = 0;

    // FIRST INITIALIZATION
    if (!settings.bybit_sync_initialized) {
      // Step 1: Get server time via relay
      let serverTimeMs = Date.now();
      try {
        const timeData = await relayCall(
          'https://api-demo.bybit.com/v5/market/time',
          'GET',
          {},
          {}
        );
        if (timeData?.result?.timeNano) {
          serverTimeMs = Math.floor(parseInt(timeData.result.timeNano) / 1000000);
        }
        notifications.push(`✅ Server time synced: ${new Date(serverTimeMs).toISOString()}`);
      } catch (e) {
        notifications.push(`⚠️ Server time sync failed: ${e.message}. Using local time.`);
      }

      // Step 2: Import current OPEN positions
      try {
        const positionsData = await relayCall(
          'https://api-demo.bybit.com/v5/position/list',
          'GET',
          {},
          { category: 'linear', settleCoin: 'USDT' }
        );

        if (positionsData?.result?.list) {
          for (const pos of positionsData.result.list) {
            if (parseFloat(pos.size || 0) > 0) {
              await upsertOpenPosition(base44, pos, currentBalance, activeProfileId);
              openUpserted++;
            }
          }
          notifications.push(`✅ Imported ${openUpserted} open positions to profile ${profiles[0].profile_name}`);
        }
      } catch (e) {
        notifications.push(`❌ Failed to import open positions: ${e.message}. Check API permissions.`);
      }

      // Step 3: Set cursor to NOW (don't import history)
      await base44.asServiceRole.entities.ApiSettings.update(settings.id, {
        bybit_sync_initialized: true,
        closed_baseline_ms: serverTimeMs,
        exec_baseline_ms: serverTimeMs,
        last_sync: new Date().toISOString(),
      });

      return Response.json({
        success: true,
        initialized: true,
        balance: currentBalance,
        openPositions: openUpserted,
        closedTrades: 0,
        message: 'Initial sync complete. Current open positions imported.',
        notifications,
      });
    }

    // SUBSEQUENT SYNCS - incremental updates
    let skippedPositions = 0;
    let insertedClosed = 0;
    let updatedClosed = 0;
    let skippedClosed = 0;
    
    // (a) Update current OPEN positions
    try {
      const positionsData = await relayCall(
        'https://api-demo.bybit.com/v5/position/list',
        'GET',
        {},
        { category: 'linear', settleCoin: 'USDT' }
      );

      if (positionsData?.result?.list) {
        for (const pos of positionsData.result.list) {
          if (parseFloat(pos.size || 0) > 0) {
            const result = await upsertOpenPosition(base44, pos, currentBalance, activeProfileId);
            if (result === 'upserted') openUpserted++;
            else skippedPositions++;
          }
        }
        notifications.push(`✅ Synced ${openUpserted} open positions (${skippedPositions} unchanged)`);
      }
    } catch (e) {
      notifications.push(`❌ Failed to sync open positions: ${e.message}. Next step: Check network and retry.`);
    }

    // (b) Get new executions (optional for detailed tracking)
    let newExecBaseline = settings.exec_baseline_ms || Date.now();
    try {
      const execData = await relayCall(
        'https://api-demo.bybit.com/v5/execution/list',
        'GET',
        {},
        { 
          category: 'linear',
          startTime: settings.exec_baseline_ms,
          limit: 100
        }
      );

      if (execData?.result?.list) {
        for (const exec of execData.result.list) {
          const execTime = parseInt(exec.execTime || exec.createdTime || 0);
          if (execTime > newExecBaseline) {
            newExecBaseline = execTime;
          }
        }
        notifications.push(`📊 Tracked ${execData.result.list.length} executions`);
      }
    } catch (e) {
      notifications.push(`⚠️ Execution tracking failed: ${e.message}. Not critical, continuing.`);
    }

    // (c) Get new closed trades with pagination
    let newClosedBaseline = settings.closed_baseline_ms || Date.now();
    try {
      let cursor = null;
      let hasMorePages = true;
      
      while (hasMorePages) {
        const params = {
          category: 'linear',
          startTime: settings.closed_baseline_ms,
          limit: 100,
        };
        
        if (cursor) {
          params.cursor = cursor;
        }
        
        const closedData = await relayCall(
          'https://api-demo.bybit.com/v5/position/closed-pnl',
          'GET',
          {},
          params
        );

        if (closedData?.result?.list) {
          for (const closed of closedData.result.list) {
            const result = await upsertClosedTrade(base44, closed, currentBalance, activeProfileId);
            if (result === 'inserted') insertedClosed++;
            else if (result === 'updated') updatedClosed++;
            else skippedClosed++;
            
            const closedTime = parseInt(closed.updatedTime || closed.createdTime || 0);
            if (closedTime > newClosedBaseline) {
              newClosedBaseline = closedTime;
            }
          }
        }
        
        cursor = closedData?.result?.nextPageCursor || null;
        hasMorePages = !!cursor && closedData?.result?.list?.length > 0;
      }
      
      closedUpserted = insertedClosed + updatedClosed;
      notifications.push(`✅ Synced ${closedUpserted} closed trades (${insertedClosed} new, ${updatedClosed} updated, ${skippedClosed} skipped)`);
    } catch (e) {
      notifications.push(`❌ Failed to sync closed trades: ${e.message}. Next step: Verify API read permissions.`);
    }

    // Update cursors
    await base44.asServiceRole.entities.ApiSettings.update(settings.id, {
      closed_baseline_ms: newClosedBaseline,
      exec_baseline_ms: newExecBaseline,
      last_sync: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      balance: currentBalance,
      openPositions: openUpserted,
      closedTrades: closedUpserted,
      inserted: insertedClosed,
      updated: updatedClosed,
      skipped: skippedClosed,
      message: 'Sync complete',
      notifications,
    });

  } catch (error) {
    const errorNotification = `❌ SYNC FAILED: ${error.message}. Next step: ${getNextStep(error.message)}`;
    
    return Response.json({
      error: error.message || 'Internal server error',
      success: false,
      notifications: [errorNotification, ...notifications],
    }, { status: 500 });
  }
});

function getNextStep(errorMsg) {
  if (errorMsg.includes('Unauthorized') || errorMsg.includes('401')) {
    return 'Check API credentials in Settings → API tab';
  }
  if (errorMsg.includes('Relay failed') || errorMsg.includes('relay')) {
    return 'Contact support - relay proxy error';
  }
  if (errorMsg.includes('profile')) {
    return 'Activate a trading profile in Settings';
  }
  if (errorMsg.includes('timeout') || errorMsg.includes('network')) {
    return 'Check internet connection and retry';
  }
  return 'Retry sync or contact support';
}

async function upsertOpenPosition(base44, pos, currentBalance, profileId) {
  const symbol = pos.symbol;
  const side = pos.side; // Buy or Sell
  const positionIdx = pos.positionIdx || 0;
  
  const externalId = `BYBIT:OPEN:${symbol}:${side}:${positionIdx}`;
  
  // STRICT PROFILE SCOPING - only query trades for this profile
  const existing = await base44.asServiceRole.entities.Trade.filter({ 
    external_id: externalId,
    profile_id: profileId
  });
  
  const direction = side === 'Buy' ? 'Long' : 'Short';
  const entryPrice = parseFloat(pos.avgPrice || pos.entryPrice || 0);
  const size = parseFloat(pos.size || 0);
  const markPrice = parseFloat(pos.markPrice || entryPrice);
  const positionSizeUsd = size * markPrice;
  
  // Calculate risk properly
  const stopPrice = parseFloat(pos.stopLoss || 0) || null;
  const riskUsd = stopPrice && entryPrice > 0 ? (Math.abs(entryPrice - stopPrice) / entryPrice) * positionSizeUsd : 0;
  
  const tradeData = {
    profile_id: profileId,
    external_id: externalId,
    coin: symbol,
    direction: direction,
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
    await base44.asServiceRole.entities.Trade.update(existing[0].id, tradeData);
    return 'upserted';
  } else {
    await base44.asServiceRole.entities.Trade.create(tradeData);
    return 'upserted';
  }
}

async function upsertClosedTrade(base44, closed, currentBalance, profileId) {
  const symbol = closed.symbol;
  const side = closed.side;
  const closedTime = closed.updatedTime || closed.createdTime;
  
  const externalId = `BYBIT:CLOSED:${symbol}:${side}:${closedTime}`;
  
  // STRICT PROFILE SCOPING - only query trades for this profile
  const existing = await base44.asServiceRole.entities.Trade.filter({ 
    external_id: externalId,
    profile_id: profileId
  });
  
  const direction = side === 'Buy' ? 'Long' : 'Short';
  const avgExitPrice = parseFloat(closed.avgExitPrice || closed.avgPrice || 0);
  const avgEntryPrice = parseFloat(closed.avgEntryPrice || 0);
  const closedSize = parseFloat(closed.closedSize || closed.qty || 0);
  const closedPnl = parseFloat(closed.closedPnl || 0);
  
  const positionSizeUsd = closedSize * avgEntryPrice;
  const riskUsd = positionSizeUsd * 0.02; // Default 2% if no stop provided
  const rMultiple = riskUsd > 0 ? closedPnl / riskUsd : 0;
  
  const tradeData = {
    profile_id: profileId,
    external_id: externalId,
    coin: symbol,
    direction: direction,
    entry_price: avgEntryPrice,
    original_entry_price: avgEntryPrice,
    position_size: positionSizeUsd,
    close_price: avgExitPrice,
    pnl_usd: closedPnl,
    realized_pnl_usd: closedPnl,
    risk_usd: riskUsd,
    original_risk_usd: riskUsd,
    max_risk_usd: riskUsd,
    r_multiple: rMultiple,
    pnl_percent_of_balance: currentBalance ? (closedPnl / currentBalance) * 100 : 0,
    date_open: closed.createdTime ? new Date(parseInt(closed.createdTime)).toISOString() : new Date().toISOString(),
    date: closed.createdTime ? new Date(parseInt(closed.createdTime)).toISOString() : new Date().toISOString(),
    date_close: closed.updatedTime ? new Date(parseInt(closed.updatedTime)).toISOString() : new Date().toISOString(),
    account_balance_at_entry: currentBalance || 100000,
  };

  if (existing.length > 0) {
    await base44.asServiceRole.entities.Trade.update(existing[0].id, tradeData);
    return 'updated';
  } else {
    await base44.asServiceRole.entities.Trade.create(tradeData);
    return 'inserted';
  }
}