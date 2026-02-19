import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * VERIFY TRADE COUNT
 * Runtime verification for DevTools
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
    const { profile_id, test_run_id } = payload;

    // Get active profile
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

    const activeProfile = profiles[0];
    const targetProfileId = profile_id || activeProfile.id;

    // Count trades with dual filters
    const filter = {
      created_by: user.email,
      profile_id: targetProfileId
    };

    if (test_run_id) {
      filter.test_run_id = test_run_id;
    }

    // Batch count for accuracy
    let totalCount = 0;
    let openCount = 0;
    let closedCount = 0;
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

      totalCount += batch.length;
      batch.forEach(t => {
        if (t.close_price !== null && t.close_price !== undefined) {
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
      profile_id: targetProfileId,
      profile_name: activeProfile.profile_name,
      total_count: totalCount,
      open_count: openCount,
      closed_count: closedCount,
      test_run_id: test_run_id || null,
      consistency_check: (openCount + closedCount) === totalCount ? 'PASS' : 'FAIL'
    });

  } catch (error) {
    console.error('[verifyTradeCount] Error:', error);
    return Response.json({ 
      error: error.message,
      error_code: 'VERIFICATION_FAILED',
      next_step: 'Check profile status and retry',
      stack: error.stack
    }, { status: 500 });
  }
});