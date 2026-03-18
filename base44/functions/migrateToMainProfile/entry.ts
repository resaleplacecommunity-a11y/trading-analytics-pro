import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get or create MAIN profile
    const profiles = await base44.asServiceRole.entities.UserProfile.list('-created_date', 100);
    let mainProfile = profiles.find(p => p.profile_name === 'MAIN' && p.created_by === user.email);

    if (!mainProfile) {
      // Create MAIN profile
      mainProfile = await base44.asServiceRole.entities.UserProfile.create({
        profile_name: 'MAIN',
        profile_image: 'https://api.dicebear.com/7.x/shapes/svg?seed=main',
        is_active: true,
        starting_balance: 100000
      });
    }

    const mainProfileId = mainProfile.id;

    // Migrate all existing data to MAIN profile
    const [trades, dailyStats, weeklyStats, riskSettings, behaviorLogs, focusGoals, psychProfiles] = await Promise.all([
      base44.asServiceRole.entities.Trade.filter({ created_by: user.email }, '-created_date', 10000),
      base44.asServiceRole.entities.DailyStat.filter({ created_by: user.email }, '-created_date', 10000),
      base44.asServiceRole.entities.WeeklyStat.filter({ created_by: user.email }, '-created_date', 10000),
      base44.asServiceRole.entities.RiskSettings.filter({ created_by: user.email }, '-created_date', 10000),
      base44.asServiceRole.entities.BehaviorLog.filter({ created_by: user.email }, '-created_date', 10000),
      base44.asServiceRole.entities.FocusGoal.filter({ created_by: user.email }, '-created_date', 10000),
      base44.asServiceRole.entities.PsychologyProfile.filter({ created_by: user.email }, '-created_date', 10000)
    ]);

    // Update all entities to have profile_id = mainProfileId
    const updates = [];

    trades.filter(t => !t.profile_id).forEach(t => {
      updates.push(base44.asServiceRole.entities.Trade.update(t.id, { profile_id: mainProfileId }));
    });

    dailyStats.filter(d => !d.profile_id).forEach(d => {
      updates.push(base44.asServiceRole.entities.DailyStat.update(d.id, { profile_id: mainProfileId }));
    });

    weeklyStats.filter(w => !w.profile_id).forEach(w => {
      updates.push(base44.asServiceRole.entities.WeeklyStat.update(w.id, { profile_id: mainProfileId }));
    });

    riskSettings.filter(r => !r.profile_id).forEach(r => {
      updates.push(base44.asServiceRole.entities.RiskSettings.update(r.id, { profile_id: mainProfileId }));
    });

    behaviorLogs.filter(b => !b.profile_id).forEach(b => {
      updates.push(base44.asServiceRole.entities.BehaviorLog.update(b.id, { profile_id: mainProfileId }));
    });

    focusGoals.filter(f => !f.profile_id).forEach(f => {
      updates.push(base44.asServiceRole.entities.FocusGoal.update(f.id, { profile_id: mainProfileId }));
    });

    psychProfiles.filter(p => !p.profile_id).forEach(p => {
      updates.push(base44.asServiceRole.entities.PsychologyProfile.update(p.id, { profile_id: mainProfileId }));
    });

    await Promise.all(updates);

    return Response.json({
      success: true,
      mainProfileId,
      migratedCounts: {
        trades: trades.filter(t => !t.profile_id).length,
        dailyStats: dailyStats.filter(d => !d.profile_id).length,
        weeklyStats: weeklyStats.filter(w => !w.profile_id).length,
        riskSettings: riskSettings.filter(r => !r.profile_id).length,
        behaviorLogs: behaviorLogs.filter(b => !b.profile_id).length,
        focusGoals: focusGoals.filter(f => !f.profile_id).length,
        psychProfiles: psychProfiles.filter(p => !p.profile_id).length
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});