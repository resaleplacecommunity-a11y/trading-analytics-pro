import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { goal_id, achievement_type } = await req.json();
    
    if (!goal_id || !achievement_type) {
      return Response.json({ error: 'goal_id and achievement_type required' }, { status: 400 });
    }

    const lang = user.preferred_language || 'ru';

    // Check if notification already exists for this goal and achievement type
    const existingNotifications = await base44.entities.Notification.filter({
      type: 'goal_achieved'
    }, '-created_date', 10);

    const alreadyNotified = existingNotifications.some(n => 
      n.message.includes(goal_id) && n.message.includes(achievement_type)
    );

    if (alreadyNotified) {
      return Response.json({ status: 'already_notified', message: 'Notification already exists for this goal achievement' });
    }

    // Create notification
    const achievementTitles = {
      daily: lang === 'ru' ? 'Дневная цель достигнута!' : 'Daily goal achieved!',
      weekly: lang === 'ru' ? 'Недельная цель достигнута!' : 'Weekly goal achieved!',
      monthly: lang === 'ru' ? 'Месячная цель достигнута!' : 'Monthly goal achieved!',
      total: lang === 'ru' ? '🎯 Основная цель достигнута!' : '🎯 Main goal achieved!'
    };

    const title = achievementTitles[achievement_type] || achievementTitles.daily;
    
    const message = lang === 'ru'
      ? 'Поздравляем! Вы достигли важного рубежа в своей торговле.'
      : 'Congratulations! You have reached an important milestone in your trading.';

    await base44.entities.Notification.create({
      title: title,
      message: `${message} [${goal_id}:${achievement_type}]`,
      source_page: 'Focus',
      link_to: '/Focus',
      type: 'goal_achieved',
      is_read: false,
      is_closed: false
    });

    return Response.json({ status: 'created', achievement_type: achievement_type });
  } catch (error) {
    console.error('Error in checkGoalAchievementNotifications:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});