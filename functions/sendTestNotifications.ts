import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { formatInTimeZone } from 'npm:date-fns-tz@3.2.0';
import { startOfWeek } from 'npm:date-fns@3.6.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const lang = user.preferred_language || 'ru';
    const userTz = user.preferred_timezone || 'UTC';
    const notifications = [];

    // Get existing notifications and DELETE them for clean test
    const existingNotifications = await base44.entities.Notification.filter({ is_closed: false }, '-created_date', 100);
    
    // Delete all existing test notifications
    for (const notif of existingNotifications) {
      await base44.asServiceRole.entities.Notification.delete(notif.id);
    }

    // 1. Daily Reminder
    const dailyReminder = await base44.entities.Notification.create({
        title: lang === 'ru' ? '🌅 Ежедневное Напоминание' : '🌅 Daily Reminder',
        message: lang === 'ru' 
          ? 'Помни дисциплину. Лучший трейдер — тот, кто соблюдает свои правила.'
          : 'Remember discipline. The best trader is one who follows their rules.',
        source_page: 'Dashboard',
        link_to: '/Dashboard',
        type: 'other',
        is_read: false,
        is_closed: false
      });
      notifications.push(dailyReminder);

    // 2. Incomplete Trade
    const incompleteTrade = await base44.entities.Notification.create({
        title: lang === 'ru' ? '⚠️ Незаполненная сделка: BTCUSDT' : '⚠️ Incomplete Trade: BTCUSDT',
        message: lang === 'ru'
          ? 'Заполните причину входа, стратегию и загрузите скриншот для полного анализа.'
          : 'Fill in entry reason, strategy, and upload screenshot for complete analysis.',
        source_page: 'Trades',
        link_to: '/Trades',
        type: 'incomplete_trade',
        is_read: false,
        is_closed: false
      });
      notifications.push(incompleteTrade);

    // 3. Risk Violation
    const riskViolation = await base44.entities.Notification.create({
        title: lang === 'ru' ? '🚨 Нарушение рисков (2)' : '🚨 Risk Violation (2)',
        message: lang === 'ru'
          ? 'Макс. сделок в день: 5 (лимит: 3), Суммарный риск: 12.5% (лимит: 10%)'
          : 'Max trades per day: 5 (limit: 3), Total open risk: 12.5% (limit: 10%)',
        source_page: 'RiskManager',
        link_to: '/RiskManager',
        type: 'risk_violation',
        is_read: false,
        is_closed: false
      });
      notifications.push(riskViolation);

    // 4. Goal Achievement
    const goalAchievement = await base44.entities.Notification.create({
        title: lang === 'ru' ? '🎯 Недельная цель достигнута!' : '🎯 Weekly goal achieved!',
        message: lang === 'ru'
          ? 'Поздравляем! Вы достигли важного рубежа в своей торговле.'
          : 'Congratulations! You have reached an important milestone in your trading.',
        source_page: 'Focus',
        link_to: '/Focus',
        type: 'goal_achieved',
        is_read: false,
        is_closed: false
      });
      notifications.push(goalAchievement);

    // 5. Market Outlook
    const marketOutlook = await base44.entities.Notification.create({
        title: lang === 'ru' ? '📊 Заполните прогноз на неделю' : '📊 Fill in weekly outlook',
        message: lang === 'ru'
          ? 'Не забудьте заполнить прогноз на неделю. Подготовка — ключ к успеху.'
          : 'Don\'t forget to fill in the outlook for the week. Preparation is key to success.',
        source_page: 'MarketOutlook',
        link_to: '/MarketOutlook',
        type: 'market_outlook',
        is_read: false,
        is_closed: false
      });
      notifications.push(marketOutlook);

    return Response.json({ 
      status: 'success', 
      created_count: notifications.length,
      notifications: notifications.map(n => ({ id: n.id, type: n.type, title: n.title }))
    });
  } catch (error) {
    console.error('Error in sendTestNotifications:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});