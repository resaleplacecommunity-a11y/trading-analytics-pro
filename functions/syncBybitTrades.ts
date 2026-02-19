import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function getProxyEndpoint() {
  let url = Deno.env.get('BYBIT_PROXY_URL') || '';
  url = url.replace(/\/+$/, '');
  url = url.replace(/\/proxy$/, '');
  return `${url}/proxy`;
}

async function callProxy(endpoint, proxySecret, body) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Proxy-Secret': proxySecret,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Request failed with status code ${response.status}`);
  }

  return await response.json();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const proxySecret = Deno.env.get('BYBIT_PROXY_SECRET');
    if (!proxySecret) {
      return Response.json({ error: 'Proxy credentials not configured' }, { status: 500 });
    }

    const endpoint = getProxyEndpoint();

    // Get or create API settings
    let apiSettings = await base44.asServiceRole.entities.ApiSettings.list();
    let settings = apiSettings[0];

    if (!settings) {
      settings = await base44.asServiceRole.entities.ApiSettings.create({
        exchange: 'bybit',
        bybit_sync_initialized: false,
      });
    }

    // Get balance first
    let currentBalance = null;
    try {
      const balanceData = await callProxy(endpoint, proxySecret, {
        type: 'get_wallet_balance',
        accountType: 'UNIFIED',
      });
      
      if (balanceData?.result?.list?.[0]) {
        const account = balanceData.result.list[0];
        if (account.coin) {
          const usdtCoin = account.coin.find(c => c.coin === 'USDT');
          if (usdtCoin && usdtCoin.walletBalance) {
            currentBalance = parseFloat(usdtCoin.walletBalance);
          }
        }
        if (currentBalance === null && account.totalWalletBalance) {
          currentBalance = parseFloat(account.totalWalletBalance);
        }
      }
    } catch (e) {
      // Continue without balance
    }

    let openUpserted = 0;
    let closedUpserted = 0;

    // FIRST INITIALIZATION
    if (!settings.bybit_sync_initialized) {
      // Step 1: Get server time to set cursor
      let serverTimeMs = Date.now();
      try {
        const timeData = await callProxy(endpoint, proxySecret, {
          type: 'get_server_time',
        });
        if (timeData.timeNow) {
          serverTimeMs = timeData.timeNow;
        }
      } catch (e) {
        // Use local time
      }

      // Step 2: Import current OPEN positions
      try {
        const positionsData = await callProxy(endpoint, proxySecret, {
          type: 'get_positions',
          category: 'linear',
          settleCoin: 'USDT',
        });

        if (positionsData?.result?.list) {
          for (const pos of positionsData.result.list) {
            if (parseFloat(pos.size || 0) > 0) {
              await upsertOpenPosition(base44, pos, currentBalance);
              openUpserted++;
            }
          }
        }
      } catch (e) {
        // Continue even if positions fail
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
      });
    }

    // SUBSEQUENT SYNCS - incremental updates
    
    // (a) Update current OPEN positions
    try {
      const positionsData = await callProxy(endpoint, proxySecret, {
        type: 'get_positions',
        category: 'linear',
        settleCoin: 'USDT',
      });

      if (positionsData?.result?.list) {
        for (const pos of positionsData.result.list) {
          if (parseFloat(pos.size || 0) > 0) {
            await upsertOpenPosition(base44, pos, currentBalance);
            openUpserted++;
          }
        }
      }
    } catch (e) {
      // Continue
    }

    // (b) Get new executions (optional for detailed tracking)
    let newExecBaseline = settings.exec_baseline_ms || Date.now();
    try {
      const execData = await callProxy(endpoint, proxySecret, {
        type: 'get_executions',
        category: 'linear',
        startTime: settings.exec_baseline_ms,
        limit: 100,
      });

      if (execData?.result?.list) {
        for (const exec of execData.result.list) {
          const execTime = parseInt(exec.execTime || exec.createdTime || 0);
          if (execTime > newExecBaseline) {
            newExecBaseline = execTime;
          }
        }
      }
    } catch (e) {
      // Continue
    }

    // (c) Get new closed trades with pagination
    let newClosedBaseline = settings.closed_baseline_ms || Date.now();
    try {
      let cursor = null;
      let hasMorePages = true;
      
      while (hasMorePages) {
        const requestBody = {
          type: 'get_closed_pnl',
          category: 'linear',
          startTime: settings.closed_baseline_ms,
          limit: 100,
        };
        
        if (cursor) {
          requestBody.cursor = cursor;
        }
        
        const closedData = await callProxy(endpoint, proxySecret, requestBody);

        if (closedData?.result?.list) {
          for (const closed of closedData.result.list) {
            await upsertClosedTrade(base44, closed, currentBalance);
            closedUpserted++;
            
            const closedTime = parseInt(closed.updatedTime || closed.createdTime || 0);
            if (closedTime > newClosedBaseline) {
              newClosedBaseline = closedTime;
            }
          }
        }
        
        // Check for next page
        cursor = closedData?.result?.nextPageCursor || null;
        hasMorePages = !!cursor && closedData?.result?.list?.length > 0;
      }
    } catch (e) {
      // Continue
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
  const symbol = pos.symbol;
  const side = pos.side; // Buy or Sell
  const positionIdx = pos.positionIdx || 0;
  
  const externalId = `BYBIT:OPEN:${symbol}:${side}:${positionIdx}`;
  
  const existing = await base44.asServiceRole.entities.Trade.filter({ external_id: externalId });
  
  const direction = side === 'Buy' ? 'Long' : 'Short';
  const entryPrice = parseFloat(pos.avgPrice || pos.entryPrice || 0);
  const size = parseFloat(pos.size || 0);
  const markPrice = parseFloat(pos.markPrice || entryPrice);
  const positionSizeUsd = size * markPrice;
  
  // Calculate risk properly
  const stopPrice = parseFloat(pos.stopLoss || 0) || null;
  const riskUsd = stopPrice && entryPrice > 0 ? (Math.abs(entryPrice - stopPrice) / entryPrice) * positionSizeUsd : 0;
  
  const tradeData = {
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
  } else {
    await base44.asServiceRole.entities.Trade.create(tradeData);
  }
}

async function upsertClosedTrade(base44, closed, currentBalance) {
  const symbol = closed.symbol;
  const side = closed.side;
  const closedTime = closed.updatedTime || closed.createdTime;
  
  const externalId = `BYBIT:CLOSED:${symbol}:${side}:${closedTime}`;
  
  const existing = await base44.asServiceRole.entities.Trade.filter({ external_id: externalId });
  
  const direction = side === 'Buy' ? 'Long' : 'Short';
  const avgExitPrice = parseFloat(closed.avgExitPrice || closed.avgPrice || 0);
  const avgEntryPrice = parseFloat(closed.avgEntryPrice || 0);
  const closedSize = parseFloat(closed.closedSize || closed.qty || 0);
  const closedPnl = parseFloat(closed.closedPnl || 0);
  
  const tradeData = {
    external_id: externalId,
    coin: symbol,
    direction: direction,
    entry_price: avgEntryPrice,
    position_size: closedSize * avgEntryPrice,
    close_price: avgExitPrice,
    pnl_usd: closedPnl,
    pnl_percent_of_balance: currentBalance ? (closedPnl / currentBalance) * 100 : 0,
    date_open: closed.createdTime ? new Date(parseInt(closed.createdTime)).toISOString() : new Date().toISOString(),
    date: closed.createdTime ? new Date(parseInt(closed.createdTime)).toISOString() : new Date().toISOString(),
    date_close: closed.updatedTime ? new Date(parseInt(closed.updatedTime)).toISOString() : new Date().toISOString(),
    account_balance_at_entry: currentBalance || 100000,
  };

  if (existing.length > 0) {
    await base44.asServiceRole.entities.Trade.update(existing[0].id, tradeData);
  } else {
    await base44.asServiceRole.entities.Trade.create(tradeData);
  }
}