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
    const today = new Date().toLocaleDateString('en-CA', { timeZone: userTz });

    // Get active profile
    const profiles = await base44.entities.UserProfile.filter({ is_active: true }, '-created_date', 1);
    const profile = profiles[0];
    
    if (!profile) {
      return Response.json({ status: 'no_profile', message: 'No active profile' });
    }

    // Get risk settings
    const riskSettings = await base44.entities.RiskSettings.filter({ 
      profile_id: profile.id 
    }, '-created_date', 1);
    const settings = riskSettings[0];
    
    if (!settings) {
      return Response.json({ status: 'no_settings', message: 'No risk settings found' });
    }

    // Get today's trades
    const allTrades = await base44.entities.Trade.filter({ 
      profile_id: profile.id 
    });
    
    const todayTrades = allTrades.filter(t => {
      const tradeDate = new Date(t.date_open || t.date).toLocaleDateString('en-CA', { timeZone: userTz });
      return tradeDate === today;
    });

    const closedTodayTrades = todayTrades.filter(t => t.close_price);
    const openTrades = allTrades.filter(t => !t.close_price);

    // Calculate violations
    const violations = [];
    
    // Daily loss
    const dailyPnl = closedTodayTrades.reduce((sum, t) => sum + (t.pnl_usd || 0), 0);
    const dailyLossPercent = (dailyPnl / profile.starting_balance) * 100;
    
    if (settings.daily_max_loss_percent && dailyLossPercent < -Math.abs(settings.daily_max_loss_percent)) {
      violations.push({
        rule: lang === 'ru' ? 'Дневной лимит убытка' : 'Daily loss limit',
        value: `${dailyLossPercent.toFixed(1)}%`,
        limit: `${settings.daily_max_loss_percent}%`
      });
    }

    // Max trades per day
    if (settings.max_trades_per_day && todayTrades.length > settings.max_trades_per_day) {
      violations.push({
        rule: lang === 'ru' ? 'Макс. сделок в день' : 'Max trades per day',
        value: todayTrades.length,
        limit: settings.max_trades_per_day
      });
    }

    // Total open risk
    const totalOpenRisk = openTrades.reduce((sum, t) => sum + (t.risk_percent || 0), 0);
    if (settings.max_total_open_risk_percent && totalOpenRisk > settings.max_total_open_risk_percent) {
      violations.push({
        rule: lang === 'ru' ? 'Суммарный риск' : 'Total open risk',
        value: `${totalOpenRisk.toFixed(1)}%`,
        limit: `${settings.max_total_open_risk_percent}%`
      });
    }

    if (violations.length === 0) {
      return Response.json({ status: 'no_violations', message: 'No violations detected' });
    }

    // Check if notification already exists for today AND user
    const existingNotifications = await base44.asServiceRole.entities.Notification.filter({
      created_by: user.email,
      type: 'risk_violation'
    }, '-created_date', 10);

    const todayNotificationExists = existingNotifications.some(n => 
      n.created_date.startsWith(today)
    );

    if (todayNotificationExists) {
      return Response.json({ status: 'already_notified', message: 'Notification already exists for today' });
    }

    // Create notification
    const title = lang === 'ru' 
      ? `🚨 Нарушение рисков (${violations.length})`
      : `🚨 Risk Violation (${violations.length})`;
    
    const message = violations.map(v => 
      `${v.rule}: ${v.value} (${lang === 'ru' ? 'лимит' : 'limit'}: ${v.limit})`
    ).join(', ');

    await base44.entities.Notification.create({
      title: title,
      message: message,
      source_page: 'RiskManager',
      link_to: '/RiskManager',
      type: 'risk_violation',
      is_read: false,
      is_closed: false
    });

    return Response.json({ status: 'created', violations: violations });
  } catch (error) {
    console.error('Error in checkRiskViolationNotifications:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});