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

    // Find seed trades
    let seedTrades;
    if (test_run_id) {
      seedTrades = await base44.entities.Trade.filter({
        created_by: user.email,
        profile_id: activeProfile.id,
        import_source: 'seed',
        test_run_id
      }, '-created_date', 10000);
    } else {
      seedTrades = await base44.entities.Trade.filter({
        created_by: user.email,
        profile_id: activeProfile.id,
        import_source: 'seed'
      }, '-created_date', 10000);
    }

    // Delete all seed trades
    await Promise.all(seedTrades.map(trade => base44.entities.Trade.delete(trade.id)));

    return Response.json({
      success: true,
      deleted_count: seedTrades.length,
      test_run_id: test_run_id || 'all'
    });
  } catch (error) {
    console.error('Wipe test trades error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});