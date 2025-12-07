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
    });

    if (!apiSettings || apiSettings.length === 0) {
      return Response.json({ error: 'API не подключен' }, { status: 400 });
    }

    const settings = apiSettings[0];
    const apiKey = settings.api_key;
    const apiSecret = settings.api_secret;

    // Bybit API endpoint
    const timestamp = Date.now().toString();
    const recvWindow = '5000';
    
    // Get existing trades to avoid duplicates
    const existingTrades = await base44.asServiceRole.entities.Trade.filter({
      created_by: user.email
    });

    const existingTradeKeys = new Set(
      existingTrades.map(t => `${t.coin}_${new Date(t.date).getTime()}`)
    );

    // Fetch all closed positions with pagination
    const category = 'linear'; // USDT perpetuals
    const limit = '100';
    let cursor = '';
    let allClosedPnl = [];
    let hasMoreData = true;

    // Fetch all pages
    while (hasMoreData) {
      const queryString = cursor 
        ? `category=${category}&limit=${limit}&cursor=${cursor}`
        : `category=${category}&limit=${limit}`;
      
      const signaturePayload = timestamp + apiKey + recvWindow + queryString;
      const signature = createHmac('sha256', apiSecret).update(signaturePayload).digest('hex');

      const response = await fetch(`https://api.bybit.com/v5/position/closed-pnl?${queryString}`, {
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

      // Safety limit to prevent infinite loops
      if (allClosedPnl.length >= 500) break;
    }

    // Parse and insert new trades
    const newTrades = [];
    const closedPnlList = allClosedPnl;

    for (const position of closedPnlList) {
      const coin = position.symbol.replace('USDT', ''); // Remove USDT suffix
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

      // Calculate stop/take (estimated from position data if available)
      const stopPercent = 2; // Default 2% risk
      const stopUsd = positionSize * (stopPercent / 100);
      const stopPrice = isLong 
        ? entryPrice * (1 - stopPercent / 100)
        : entryPrice * (1 + stopPercent / 100);

      const takePercent = 6; // Default 6% target
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

    // Insert new trades
    if (newTrades.length > 0) {
      await base44.asServiceRole.entities.Trade.bulkCreate(newTrades);
    }

    // Update last sync time
    await base44.asServiceRole.entities.ApiSettings.update(settings.id, {
      last_sync: new Date().toISOString()
    });

    return Response.json({
      success: true,
      imported: newTrades.length,
      message: `Импортировано ${newTrades.length} новых сделок`
    });

  } catch (error) {
    console.error('Sync error:', error);
    return Response.json({ 
      error: 'Ошибка синхронизации', 
      details: error.message 
    }, { status: 500 });
  }
});