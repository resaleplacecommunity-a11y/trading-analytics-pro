import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { profile_id } = await req.json().catch(() => ({}));

    // Get active profile if not specified
    let targetProfileId = profile_id;
    if (!targetProfileId) {
      const profiles = await base44.entities.UserProfile.filter({ created_by: user.email }, '-created_date', 10);
      const activeProfile = profiles.find(p => p.is_active);
      if (!activeProfile) {
        return Response.json({ error: 'No active profile found' }, { status: 400 });
      }
      targetProfileId = activeProfile.id;
    }

    console.log(`[getTradeCounts] Counting for profile ${targetProfileId}`);

    // Count all trades by fetching in large batches
    let totalCount = 0;
    let openCount = 0;
    let closedCount = 0;
    let skip = 0;
    const batchSize = 2000;
    
    while (true) {
      const batch = await base44.asServiceRole.entities.Trade.filter({
        created_by: user.email,
        profile_id: targetProfileId
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
      console.log(`[getTradeCounts] Counted ${totalCount} so far...`);
      
      if (batch.length < batchSize) break;
    }

    console.log(`[getTradeCounts] Final: ${totalCount} total (${openCount} open, ${closedCount} closed)`);

    return Response.json({
      success: true,
      profile_id: targetProfileId,
      total: totalCount,
      open: openCount,
      closed: closedCount
    });
  } catch (error) {
    console.error('[getTradeCounts] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});