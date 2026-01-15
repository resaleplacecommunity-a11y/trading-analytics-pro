import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { trade_id, is_closed } = await req.json();
    
    if (!trade_id) {
      return Response.json({ error: 'trade_id required' }, { status: 400 });
    }

    const trade = await base44.entities.Trade.get(trade_id);
    if (!trade) {
      return Response.json({ error: 'Trade not found' }, { status: 404 });
    }

    const lang = user.preferred_language || 'ru';
    const userTz = user.preferred_timezone || 'UTC';
    
    // Check if incomplete
    const isIncomplete = !trade.entry_reason || !trade.screenshot_url || !trade.strategy_tag;
    
    if (!isIncomplete) {
      return Response.json({ status: 'complete', message: 'Trade is complete' });
    }

    // Check if notification already exists for this trade
    const existingNotifications = await base44.entities.Notification.filter({
      trade_id: trade_id,
      type: 'incomplete_trade'
    }, '-created_date', 1);

    if (existingNotifications.length > 0) {
      return Response.json({ status: 'already_notified', message: 'Notification already exists for this trade' });
    }

    // Create notification
    const title = lang === 'ru' 
      ? `⚠️ Незаполненная сделка: ${trade.coin}`
      : `⚠️ Incomplete Trade: ${trade.coin}`;
    
    const message = lang === 'ru'
      ? 'Заполните причину входа, стратегию и загрузите скриншот для полного анализа.'
      : 'Fill in entry reason, strategy, and upload screenshot for complete analysis.';

    await base44.entities.Notification.create({
      title: title,
      message: message,
      source_page: 'Trades',
      link_to: '/Trades',
      type: 'incomplete_trade',
      trade_id: trade_id,
      is_read: false,
      is_closed: false
    });

    return Response.json({ status: 'created', message: 'Notification created successfully' });
  } catch (error) {
    console.error('Error in checkIncompleteTradeNotifications:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});