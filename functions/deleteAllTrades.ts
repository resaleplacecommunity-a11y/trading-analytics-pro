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

    // Count total trades first
    let totalCount = 0;
    let skip = 0;
    const batchSize = 1000;
    
    // Fetch all trade IDs in batches
    let allTradeIds = [];
    while (true) {
      const batch = await base44.asServiceRole.entities.Trade.filter({
        created_by: user.email,
        profile_id: activeProfile.id
      }, '-created_date', batchSize, skip);
      
      if (batch.length === 0) break;
      allTradeIds = allTradeIds.concat(batch.map(t => t.id));
      skip += batch.length;
      
      if (batch.length < batchSize) break;
    }

    totalCount = allTradeIds.length;

    // Delete in small batches to avoid rate limit
    const deleteBatchSize = 50;
    let deletedCount = 0;
    
    for (let i = 0; i < allTradeIds.length; i += deleteBatchSize) {
      const batch = allTradeIds.slice(i, i + deleteBatchSize);
      const results = await Promise.allSettled(
        batch.map(id => base44.asServiceRole.entities.Trade.delete(id))
      );
      
      deletedCount += results.filter(r => r.status === 'fulfilled').length;
      
      // Delay between batches
      if (i + deleteBatchSize < allTradeIds.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return Response.json({
      success: true,
      total_found: totalCount,
      deleted_count: deletedCount
    });
  } catch (error) {
    console.error('Delete all trades error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});