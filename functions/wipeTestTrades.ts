import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { test_run_id } = await req.json().catch(() => ({}));

    // Get active profile
    const profiles = await base44.asServiceRole.entities.UserProfile.filter({ 
      created_by: user.email 
    }, '-created_date', 10);
    const activeProfile = profiles.find(p => p.is_active);

    if (!activeProfile) {
      return Response.json({ error: 'No active profile found' }, { status: 400 });
    }

    console.log(`[wipeTestTrades] Deleting test trades for profile ${activeProfile.id}`);

    // Build filter
    const filter = {
      created_by: user.email,
      profile_id: activeProfile.id,
      import_source: 'seed'
    };

    if (test_run_id) {
      filter.test_run_id = test_run_id;
    }

    // Fetch ALL test trade IDs (no limit)
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
      console.log(`[wipeTestTrades] Fetched ${allTradeIds.length} test trade IDs...`);
      
      if (batch.length < batchSize) break;
    }

    const totalToDelete = allTradeIds.length;
    console.log(`[wipeTestTrades] Found ${totalToDelete} test trades to delete`);

    if (totalToDelete === 0) {
      return Response.json({
        success: true,
        total_found: 0,
        deleted_count: 0,
        remaining_count: 0
      });
    }

    // Delete in batches
    const deleteBatchSize = 100;
    let deletedCount = 0;
    
    for (let i = 0; i < allTradeIds.length; i += deleteBatchSize) {
      const batch = allTradeIds.slice(i, i + deleteBatchSize);
      const results = await Promise.allSettled(
        batch.map(id => base44.asServiceRole.entities.Trade.delete(id))
      );
      
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      deletedCount += succeeded;
      
      console.log(`[wipeTestTrades] Deleted ${deletedCount}/${totalToDelete}`);
      
      if (i + deleteBatchSize < allTradeIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Verify remaining count with full query
    let remainingCount = 0;
    skip = 0;
    
    while (true) {
      const batch = await base44.asServiceRole.entities.Trade.filter(
        filter,
        '-created_date',
        1000,
        skip
      );
      
      if (batch.length === 0) break;
      remainingCount += batch.length;
      skip += batch.length;
      
      if (batch.length < 1000) break;
    }

    console.log(`[wipeTestTrades] Completed: deleted ${deletedCount}/${totalToDelete}, remaining: ${remainingCount}`);

    return Response.json({
      success: remainingCount === 0,
      total_found: totalToDelete,
      deleted_count: deletedCount,
      remaining_count: remainingCount,
      profile_id: activeProfile.id,
      test_run_id: test_run_id || 'all'
    });
  } catch (error) {
    console.error('[wipeTestTrades] Error:', error);
    return Response.json({ 
      error: error.message, 
      success: false 
    }, { status: 500 });
  }
});