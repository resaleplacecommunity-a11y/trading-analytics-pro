import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all market_outlook notifications
    const allNotifications = await base44.entities.Notification.filter({
      type: 'market_outlook'
    }, '-created_date', 50);

    const userTz = user.preferred_timezone || 'UTC';
    const now = new Date();
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
    const weekStartStr = currentWeekStart.toLocaleDateString('en-CA', { timeZone: userTz });

    // Group by week
    const notificationsByWeek = {};
    allNotifications.forEach(n => {
      const weekKey = n.created_date.substring(0, 10); // YYYY-MM-DD
      if (!notificationsByWeek[weekKey]) {
        notificationsByWeek[weekKey] = [];
      }
      notificationsByWeek[weekKey].push(n);
    });

    let deletedCount = 0;

    // For each week, keep only the oldest notification, delete the rest
    for (const week in notificationsByWeek) {
      const notifications = notificationsByWeek[week];
      if (notifications.length > 1) {
        // Sort by created_date ascending
        notifications.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
        
        // Delete all except the first one
        for (let i = 1; i < notifications.length; i++) {
          await base44.entities.Notification.delete(notifications[i].id);
          deletedCount++;
        }
      }
    }

    return Response.json({ 
      status: 'success', 
      deleted_count: deletedCount,
      weeks_processed: Object.keys(notificationsByWeek).length
    });
  } catch (error) {
    console.error('Error in cleanupDuplicateNotifications:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});