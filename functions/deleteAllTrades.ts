import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * DELETE ALL TRADES (ACTIVE PROFILE ONLY)
 * Transaction-safe, retry-safe with verification
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ 
        error: 'Unauthorized',
        error_code: 'AUTH_REQUIRED',
        next_step: 'Please log in'
      }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    const { profile_id, test_run_id, scope = 'all' } = payload;

    // Get active profile - STRICT ownership check
    let targetProfileId = profile_id;
    if (!targetProfileId) {
      const profiles = await base44.entities.UserProfile.filter({ 
        created_by: user.email, 
        is_active: true 
      });
      
      if (profiles.length === 0) {
        return Response.json({ 
          error: 'No active profile found',
          error_code: 'NO_ACTIVE_PROFILE',
          next_step: 'Activate a profile in Settings'
        }, { status: 400 });
      }
      
      if (profiles.length > 1) {
        return Response.json({ 
          error: 'Multiple active profiles detected',
          error_code: 'INTEGRITY_VIOLATION',
          next_step: 'Contact support - profile integrity issue'
        }, { status: 500 });
      }
      
      targetProfileId = profiles[0].id;
    } else {
      // Verify ownership if profile_id is provided
      const targetProfile = await base44.entities.UserProfile.filter({
        id: targetProfileId,
        created_by: user.email
      });
      
      if (targetProfile.length === 0) {
        return Response.json({
          error: 'Profile not found or access denied',
          error_code: 'PROFILE_NOT_FOUND',
          next_step: 'Check profile ID and permissions'
        }, { status: 404 });
      }
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

    const success = deletedCount === totalToDelete && remainingCheck.length === 0;

    return Response.json({
      success,
      before_count: totalToDelete,
      deleted_count: deletedCount,
      after_count: remainingCheck.length,
      profile_id: targetProfileId,
      scope,
      test_run_id: test_run_id || null,
      verification: success ? 'PASS' : 'FAIL'
    });
  } catch (error) {
    console.error('[deleteAllTrades] Error:', error);
    return Response.json({ 
      error: error.message,
      error_code: 'DELETION_FAILED',
      next_step: 'Check profile status and retry',
      stack: error.stack
    }, { status: 500 });
  }
});