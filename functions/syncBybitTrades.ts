import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { createHmac } from 'node:crypto';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get API settings
    const apiSettings = await base44.asServiceRole.entities.ApiSettings.filter({
      created_by: user.email,
      is_active: true
    }, '-created_date', 1);

    if (!apiSettings || apiSettings.length === 0) {
      return Response.json({ error: 'API не подключен' }, { status: 400 });
    }

    const settings = apiSettings[0];
    const apiKey = settings.api_key;
    const apiSecret = settings.api_secret;

    // Get existing trades to avoid duplicates
    const existingTrades = await base44.asServiceRole.entities.Trade.filter({
      created_by: user.email
    });

    const existingTradeKeys = new Set(
      existingTrades.map(t => `${t.coin}_${new Date(t.date).getTime()}`)
    );

    // Use Bybit testnet (demo account)
    const baseUrl = 'https://api-testnet.bybit.com';
    
    // Fetch all closed positions with pagination
    const category = 'linear';
    const limit = '50';
    let allClosedPnl = [];
    let hasMoreData = true;
    let cursor = '';
    let pageCount = 0;

    // Fetch all pages of closed positions
    while (hasMoreData && pageCount < 50) {
      const timestamp = Date.now().toString();
      const recvWindow = '5000';
      
      const queryString = cursor 
        ? `category=${category}&limit=${limit}&cursor=${cursor}`
        : `category=${category}&limit=${limit}`;
      
      const signaturePayload = timestamp + apiKey + recvWindow + queryString;
      const signature = createHmac('sha256', apiSecret).update(signaturePayload).digest('hex');

      const response = await fetch(`${baseUrl}/v5/position/closed-pnl?${queryString}`, {
        method: 'GET',
        headers: {
          'X-BAPI-API-KEY': apiKey,
          'X-BAPI-SIGN': signature,
          'X-BAPI-SIGN-TYPE': '2',
          'X-BAPI-TIMESTAMP': timestamp,
          'X-BAPI-RECV-WINDOW': recvWindow,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.retCode !== 0) {
        return Response.json({ 
          error: 'Ошибка Bybit API', 
          details: data.retMsg 
        }, { status: 400 });
      }

      const list = data.result?.list || [];
      allClosedPnl = allClosedPnl.concat(list);

      // Check if there's more data
      cursor = data.result?.nextPageCursor || '';
      hasMoreData = cursor !== '' && list.length > 0;
      pageCount++;
    }

    // Fetch open positions
    const timestampOpen = Date.now().toString();
    const recvWindowOpen = '5000';
    const queryStringOpen = `category=${category}&settleCoin=USDT`;
    const signaturePayloadOpen = timestampOpen + apiKey + recvWindowOpen + queryStringOpen;
    const signatureOpen = createHmac('sha256', apiSecret).update(signaturePayloadOpen).digest('hex');

    const openPositionsResponse = await fetch(`${baseUrl}/v5/position/list?${queryStringOpen}`, {
      method: 'GET',
      headers: {
        'X-BAPI-API-KEY': apiKey,
        'X-BAPI-SIGN': signatureOpen,
        'X-BAPI-SIGN-TYPE': '2',
        'X-BAPI-TIMESTAMP': timestampOpen,
        'X-BAPI-RECV-WINDOW': recvWindowOpen,
        'Content-Type': 'application/json'
      }
    });

    const openPositionsData = await openPositionsResponse.json();
    const openPositions = openPositionsData.retCode === 0 ? (openPositionsData.result?.list || []) : [];

    // Parse and insert new trades
    const newTrades = [];

    for (const position of allClosedPnl) {
      const coin = position.symbol.replace('USDT', '');
      const tradeTime = new Date(parseInt(position.createdTime));
      const tradeKey = `${coin}_${tradeTime.getTime()}`;

      // Skip if already exists
      if (existingTradeKeys.has(tradeKey)) continue;

      const isLong = position.side === 'Buy';
      const entryPrice = parseFloat(position.avgEntryPrice);
      const exitPrice = parseFloat(position.avgExitPrice);
      const positionSize = Math.abs(parseFloat(position.closedSize)) * entryPrice;
      const pnl = parseFloat(position.closedPnl);
      const pnlPercent = (pnl / positionSize) * 100;

      // Calculate stop/take (estimated from position data)
      const stopPercent = 2;
      const stopUsd = positionSize * (stopPercent / 100);
      const stopPrice = isLong 
        ? entryPrice * (1 - stopPercent / 100)
        : entryPrice * (1 + stopPercent / 100);

      const takePercent = 6;
      const takeUsd = positionSize * (takePercent / 100);
      const takePrice = isLong
        ? entryPrice * (1 + takePercent / 100)
        : entryPrice * (1 - takePercent / 100);

      const rrRatio = takePercent / stopPercent;
      const rMultiple = pnl / stopUsd;

      newTrades.push({
        date: tradeTime.toISOString(),
        coin: coin,
        direction: isLong ? 'Long' : 'Short',
        entry_price: entryPrice,
        close_price: exitPrice,
        position_size: positionSize,
        stop_price: stopPrice,
        take_price: takePrice,
        stop_percent: stopPercent,
        stop_usd: stopUsd,
        take_percent: takePercent,
        take_usd: takeUsd,
        rr_ratio: rrRatio,
        pnl_usd: pnl,
        pnl_percent: pnlPercent,
        r_multiple: rMultiple,
        status: 'closed',
        rule_compliance: true,
        emotional_state: 5,
        confidence_level: 5,
        strategy_tag: 'Bybit Auto',
        entry_reason: 'Автоматический импорт с Bybit'
      });
    }

    // Parse open positions as trades with status 'open'
    const openTrades = [];
    for (const position of openPositions) {
      // Skip positions with no size
      if (parseFloat(position.size) === 0) continue;

      const coin = position.symbol.replace('USDT', '');
      const tradeTime = new Date(parseInt(position.createdTime));
      const tradeKey = `${coin}_${tradeTime.getTime()}`;

      // Skip if already exists
      if (existingTradeKeys.has(tradeKey)) continue;

      const isLong = position.side === 'Buy';
      const entryPrice = parseFloat(position.avgPrice);
      const positionSize = Math.abs(parseFloat(position.size)) * entryPrice;
      const stopPrice = parseFloat(position.stopLoss) || 0;
      const takePrice = parseFloat(position.takeProfit) || 0;

      // Calculate metrics
      let stopPercent = 0, stopUsd = 0;
      if (stopPrice > 0) {
        stopPercent = isLong ? ((entryPrice - stopPrice) / entryPrice) * 100 : ((stopPrice - entryPrice) / entryPrice) * 100;
        stopUsd = (stopPercent / 100) * positionSize;
      }

      let takePercent = 0, takeUsd = 0, rrRatio = 0;
      if (takePrice > 0) {
        takePercent = isLong ? ((takePrice - entryPrice) / entryPrice) * 100 : ((entryPrice - takePrice) / entryPrice) * 100;
        takeUsd = (takePercent / 100) * positionSize;
        rrRatio = stopPercent !== 0 ? Math.abs(takePercent / stopPercent) : 0;
      }

      const unrealizedPnl = parseFloat(position.unrealisedPnl) || 0;
      const pnlPercent = (unrealizedPnl / positionSize) * 100;
      const rMultiple = stopUsd !== 0 ? (unrealizedPnl / stopUsd) : 0;

      openTrades.push({
        date: tradeTime.toISOString(),
        coin: coin,
        direction: isLong ? 'Long' : 'Short',
        entry_price: entryPrice,
        position_size: positionSize,
        stop_price: stopPrice,
        take_price: takePrice,
        stop_percent: stopPercent,
        stop_usd: stopUsd,
        take_percent: takePercent,
        take_usd: takeUsd,
        rr_ratio: rrRatio,
        pnl_usd: unrealizedPnl,
        pnl_percent: pnlPercent,
        r_multiple: rMultiple,
        status: 'open',
        rule_compliance: true,
        emotional_state: 5,
        confidence_level: 5,
        strategy_tag: 'Bybit Auto',
        entry_reason: 'Автоматический импорт с Bybit (открытая позиция)'
      });
    }

    // Insert new trades (closed + open)
    const allNewTrades = [...newTrades, ...openTrades];
    if (allNewTrades.length > 0) {
      await base44.asServiceRole.entities.Trade.bulkCreate(allNewTrades);
    }

    // Update last sync time
    await base44.asServiceRole.entities.ApiSettings.update(settings.id, {
      last_sync: new Date().toISOString()
    });

    return Response.json({
      success: true,
      imported: allNewTrades.length,
      closed_trades: newTrades.length,
      open_positions: openTrades.length,
      total_fetched: allClosedPnl.length + openPositions.length,
      message: `✅ Синхронизация завершена!\n📊 Импортировано: ${allNewTrades.length} сделок\n📈 Закрытые: ${newTrades.length}\n🔄 Открытые: ${openTrades.length}`
    });

  } catch (error) {
    console.error('Sync error:', error);
    return Response.json({ 
      error: 'Ошибка синхронизации', 
      details: error.message 
    }, { status: 500 });
  }
});