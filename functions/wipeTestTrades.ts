import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { test_run_id } = await req.json();

    // Get active profile
    const profiles = await base44.entities.UserProfile.filter({ created_by: user.email }, '-created_date', 10);
    const activeProfile = profiles.find(p => p.is_active);

    if (!activeProfile) {
      return Response.json({ error: 'No active profile found' }, { status: 400 });
    }

    // Find all seed trades (fetch in batches)
    let allSeedTrades = [];
    let skip = 0;
    const batchSize = 1000;
    
    while (true) {
      const query = test_run_id ? {
        created_by: user.email,
        profile_id: activeProfile.id,
        import_source: 'seed',
        test_run_id
      } : {
        created_by: user.email,
        profile_id: activeProfile.id,
        import_source: 'seed'
      };
      
      const batch = await base44.asServiceRole.entities.Trade.filter(query, '-created_date', batchSize, skip);
      
      if (batch.length === 0) break;
      allSeedTrades = allSeedTrades.concat(batch);
      skip += batch.length;
      
      if (batch.length < batchSize) break;
    }

    // Delete all seed trades in small batches to avoid rate limit
    const deleteBatchSize = 10;
    let deletedCount = 0;
    
    for (let i = 0; i < allSeedTrades.length; i += deleteBatchSize) {
      const batch = allSeedTrades.slice(i, i + deleteBatchSize);
      const results = await Promise.allSettled(
        batch.map(trade => base44.asServiceRole.entities.Trade.delete(trade.id))
      );
      
      // Count successful deletions (ignore already deleted trades)
      deletedCount += results.filter(r => r.status === 'fulfilled').length;
      
      // Delay between batches
      if (i + deleteBatchSize < allSeedTrades.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    return Response.json({
      success: true,
      deleted_count: allSeedTrades.length,
      test_run_id: test_run_id || 'all'
    });
  } catch (error) {
    console.error('Wipe test trades error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});