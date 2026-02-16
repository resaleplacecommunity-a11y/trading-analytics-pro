import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { profile_id, test_run_id, scope = 'all' } = await req.json().catch(() => ({}));

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

    console.log(`[deleteAllTrades] Starting deletion for profile ${targetProfileId}, scope: ${scope}, test_run_id: ${test_run_id || 'all'}`);

    // Build filter
    const filter = {
      created_by: user.email,
      profile_id: targetProfileId
    };

    if (scope === 'test_only') {
      filter.import_source = 'seed';
    }

    if (test_run_id) {
      filter.test_run_id = test_run_id;
    }

    // Fetch ALL trade IDs matching filter (no limit)
    let allTradeIds = [];
    let skip = 0;
    const batchSize = 2000;
    
    while (true) {
      const batch = await base44.asServiceRole.entities.Trade.filter(
        filter,
        '-created_date',
        batchSize,
        skip
      );
      
      if (batch.length === 0) break;
      allTradeIds = allTradeIds.concat(batch.map(t => t.id));
      skip += batch.length;
      console.log(`[deleteAllTrades] Fetched ${allTradeIds.length} IDs so far...`);
      
      if (batch.length < batchSize) break;
    }

    const totalToDelete = allTradeIds.length;
    console.log(`[deleteAllTrades] Found ${totalToDelete} trades to delete`);

    if (totalToDelete === 0) {
      return Response.json({
        success: true,
        total_found: 0,
        deleted_count: 0,
        remaining_count: 0
      });
    }

    // Delete in batches with aggressive parallelization
    const deleteBatchSize = 100;
    let deletedCount = 0;
    
    for (let i = 0; i < allTradeIds.length; i += deleteBatchSize) {
      const batch = allTradeIds.slice(i, i + deleteBatchSize);
      const results = await Promise.allSettled(
        batch.map(id => base44.asServiceRole.entities.Trade.delete(id))
      );
      
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      deletedCount += succeeded;
      
      console.log(`[deleteAllTrades] Deleted ${deletedCount}/${totalToDelete} (${Math.round(deletedCount/totalToDelete*100)}%)`);
      
      // Small delay to avoid rate limits
      if (i + deleteBatchSize < allTradeIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Verify remaining count
    const remainingCheck = await base44.asServiceRole.entities.Trade.filter(
      filter,
      '-created_date',
      10
    );

    console.log(`[deleteAllTrades] Completed: deleted ${deletedCount}/${totalToDelete}, remaining: ${remainingCheck.length > 0 ? 'SOME' : '0'}`);

    return Response.json({
      success: true,
      total_found: totalToDelete,
      deleted_count: deletedCount,
      remaining_count: remainingCheck.length,
      profile_id: targetProfileId,
      scope,
      test_run_id: test_run_id || null
    });
  } catch (error) {
    console.error('[deleteAllTrades] Error:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});