import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const lang = user.preferred_language || 'ru';
    const userTz = user.preferred_timezone || 'UTC';
    
    const now = new Date();
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
    const weekStartStr = currentWeekStart.toLocaleDateString('en-CA', { timeZone: userTz });

    // Check if WeeklyOutlook exists for current week
    const outlooks = await base44.entities.WeeklyOutlook.filter({
      week_start: weekStartStr
    }, '-created_date', 1);

    const currentWeekOutlook = outlooks[0];
    const isIncomplete = !currentWeekOutlook || currentWeekOutlook.status !== 'completed';
    
    if (!isIncomplete) {
      return Response.json({ status: 'complete', message: 'Market outlook is complete' });
    }

    // Check if notification already exists for this week
    const existingNotifications = await base44.entities.Notification.filter({
      type: 'market_outlook'
    }, '-created_date', 10);

    const weekNotificationExists = existingNotifications.some(n => 
      n.message.includes(weekStartStr) || 
      (n.created_date >= weekStartStr && n.type === 'market_outlook')
    );

    if (weekNotificationExists) {
      return Response.json({ status: 'already_notified', message: 'Notification already exists for this week' });
    }
    
    // Additional check - delete any duplicates that might exist
    const duplicateNotifications = existingNotifications.filter(n => 
      n.message.includes(weekStartStr) || 
      (n.created_date >= weekStartStr && n.type === 'market_outlook')
    );
    
    if (duplicateNotifications.length > 0) {
      // Keep only the first one, delete the rest
      for (let i = 1; i < duplicateNotifications.length; i++) {
        await base44.asServiceRole.entities.Notification.delete(duplicateNotifications[i].id);
      }
      return Response.json({ status: 'already_notified', cleaned: duplicateNotifications.length - 1 });
    }

    // Create notification (only once per week)
    const title = lang === 'ru' 
      ? '📊 Заполните прогноз на неделю'
      : '📊 Fill in weekly outlook';
    
    const message = lang === 'ru'
      ? `Не забудьте заполнить прогноз на неделю ${weekStartStr}. Подготовка — ключ к успеху.`
      : `Don't forget to fill in the outlook for week ${weekStartStr}. Preparation is key to success.`;

    await base44.entities.Notification.create({
      title: title,
      message: message,
      source_page: 'MarketOutlook',
      link_to: '/MarketOutlook',
      type: 'market_outlook',
      is_read: false,
      is_closed: false
    });

    return Response.json({ status: 'created', week_start: weekStartStr });
  } catch (error) {
    console.error('Error in checkMarketOutlookNotification:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});