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
    const profiles = await base44.entities.UserProfile.filter({ created_by: user.email }, '-created_date', 10);
    const activeProfile = profiles.find(p => p.is_active);

    if (!activeProfile) {
      return Response.json({ error: 'No active profile found' }, { status: 400 });
    }

    // Use deleteAllTrades with test scope
    const deleteParams = {
      profile_id: activeProfile.id,
      scope: 'test_only',
      test_run_id: test_run_id || null
    };

    const response = await base44.functions.invoke('deleteAllTrades', deleteParams);

    return Response.json(response.data);
  } catch (error) {
    console.error('[wipeTestTrades] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});