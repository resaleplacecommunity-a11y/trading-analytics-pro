import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get active profile
    const profiles = await base44.entities.UserProfile.filter({ created_by: user.email }, '-created_date', 10);
    const activeProfile = profiles.find(p => p.is_active);

    if (!activeProfile) {
      return Response.json({ error: 'No active profile found' }, { status: 400 });
    }

    // Count all trades by fetching in batches
    let totalCount = 0;
    let openCount = 0;
    let closedCount = 0;
    let skip = 0;
    const batchSize = 1000;
    
    while (true) {
      const batch = await base44.asServiceRole.entities.Trade.filter({
        created_by: user.email,
        profile_id: activeProfile.id
      }, '-created_date', batchSize, skip);
      
      if (batch.length === 0) break;
      
      totalCount += batch.length;
      
      // Count open/closed
      batch.forEach(t => {
        if (t.close_price != null || t.date_close != null) {
          closedCount++;
        } else {
          openCount++;
        }
      });
      
      skip += batch.length;
      
      if (batch.length < batchSize) break;
    }

    return Response.json({
      success: true,
      profile_id: activeProfile.id,
      total: totalCount,
      open: openCount,
      closed: closedCount
    });
  } catch (error) {
    console.error('Get trade counts error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});