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

    const lang = user.preferred_language || 'en';
    const userTz = user.preferred_timezone || 'UTC';
    
    // Calculate current week start using date-fns
    const now = new Date();
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekStartStr = formatInTimeZone(currentWeekStart, userTz, 'yyyy-MM-dd');

    // Check if WeeklyOutlook exists for current week and is completed
    const outlooks = await base44.entities.WeeklyOutlook.filter({
      week_start: weekStartStr
    }, '-created_date', 1);

    const currentWeekOutlook = outlooks[0];
    const isIncomplete = !currentWeekOutlook || currentWeekOutlook.status !== 'completed';
    
    if (!isIncomplete) {
      return Response.json({ status: 'complete', message: 'Market outlook is complete for this week' });
    }

    // Fetch ALL existing market outlook notifications
    const allMarketOutlookNotifications = await base44.entities.Notification.list();
    const marketOutlookNotifications = allMarketOutlookNotifications.filter(n => n.type === 'market_outlook');

    // Determine which notifications belong to the current week
    const notificationsForCurrentWeek = marketOutlookNotifications.filter(n => {
      const notificationCreatedDate = new Date(n.created_date);
      const notificationWeekStart = startOfWeek(notificationCreatedDate, { weekStartsOn: 1 });
      const notificationWeekStartStr = formatInTimeZone(notificationWeekStart, userTz, 'yyyy-MM-dd');
      return notificationWeekStartStr === weekStartStr;
    });

    // Delete ALL market outlook notifications for the current week
    for (const notif of notificationsForCurrentWeek) {
      await base44.asServiceRole.entities.Notification.delete(notif.id);
    }
    
    // Create ONE new notification for the current week
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

    return Response.json({ 
      status: 'created', 
      week_start: weekStartStr,
      deleted_duplicates: notificationsForCurrentWeek.length
    });
  } catch (error) {
    console.error('Error in checkMarketOutlookNotification:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});