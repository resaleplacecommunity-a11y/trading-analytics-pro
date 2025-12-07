import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { createHmac } from 'node:crypto';

Deno.serve(async (req) => {
  try {
    console.log('=== Sync started ===');
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      console.log('User not authenticated');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('User:', user.email);

    // Get API settings
    const apiSettings = await base44.asServiceRole.entities.ApiSettings.filter({
      created_by: user.email,
      is_active: true
    }, '-created_date', 1);

    console.log('API Settings found:', apiSettings.length);

    if (!apiSettings || apiSettings.length === 0) {
      return Response.json({ error: 'API не подключен' }, { status: 400 });
    }

    const settings = apiSettings[0];
    const apiKey = settings.api_key;
    const apiSecret = settings.api_secret;

    console.log('API Key:', apiKey ? 'exists' : 'missing');
    console.log('API Secret:', apiSecret ? 'exists' : 'missing');

    // Get existing trades to avoid duplicates
    const existingTrades = await base44.asServiceRole.entities.Trade.filter({
      created_by: user.email
    });

    const existingTradeKeys = new Set(
      existingTrades.map(t => `${t.coin}_${new Date(t.date).getTime()}`)
    );

    // Use Bybit testnet (demo account)
    const baseUrl = 'https://api-testnet.bybit.com';
    
    console.log('Fetching from Bybit testnet...');
    
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

      console.log(`Fetching closed positions page ${pageCount + 1}...`);

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

      console.log('HTTP Status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Bybit HTTP error:', response.status, errorText.substring(0, 500));
        return Response.json({ 
          error: 'Ошибка Bybit API', 
          details: `HTTP ${response.status}: ${errorText.substring(0, 200)}`
        }, { status: 400 });
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        const rawText = await response.text();
        console.error('JSON parse error. Raw response:', rawText.substring(0, 500));
        return Response.json({ 
          error: 'Ошибка парсинга ответа Bybit', 
          details: `Not JSON: ${rawText.substring(0, 200)}`
        }, { status: 400 });
      }

      console.log('Bybit response:', JSON.stringify(data, null, 2));

      if (data.retCode !== 0) {
        console.error('Bybit API error:', data.retMsg);
        return Response.json({ 
          error: 'Ошибка Bybit API', 
          details: data.retMsg 
        }, { status: 400 });
      }

      const list = data.result?.list || [];
      allClosedPnl = allClosedPnl.concat(list);
      console.log(`Found ${list.length} closed positions on page ${pageCount + 1}`);

      // Check if there's more data
      cursor = data.result?.nextPageCursor || '';
      hasMoreData = cursor !== '' && list.length > 0;
      pageCount++;
    }

    console.log(`Total closed positions: ${allClosedPnl.length}`);

    // Fetch open positions
    console.log('Fetching open positions...');
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

    console.log('Open positions HTTP Status:', openPositionsResponse.status);

    if (!openPositionsResponse.ok) {
      const errorText = await openPositionsResponse.text();
      console.error('Open positions HTTP error:', errorText.substring(0, 500));
    }

    let openPositionsData;
    try {
      openPositionsData = await openPositionsResponse.json();
    } catch (jsonError) {
      const rawText = await openPositionsResponse.text();
      console.error('Open positions JSON parse error. Raw:', rawText.substring(0, 500));
      openPositionsData = { retCode: -1, result: { list: [] } };
    }

    console.log('Open positions response:', JSON.stringify(openPositionsData, null, 2));
    
    const openPositions = openPositionsData.retCode === 0 ? (openPositionsData.result?.list || []) : [];
    console.log(`Found ${openPositions.length} open positions`);

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
    console.log(`Inserting ${allNewTrades.length} new trades...`);
    
    if (allNewTrades.length > 0) {
      await base44.asServiceRole.entities.Trade.bulkCreate(allNewTrades);
      console.log('Trades inserted successfully');
    }

    // Update last sync time
    await base44.asServiceRole.entities.ApiSettings.update(settings.id, {
      last_sync: new Date().toISOString()
    });

    console.log('=== Sync completed ===');

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