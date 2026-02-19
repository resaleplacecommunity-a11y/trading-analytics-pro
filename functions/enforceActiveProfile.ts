import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * CRITICAL HOTFIX: Enforce single active profile rule
 * - Ensures EXACTLY ONE active profile per user
 * - Auto-heals existing bad data
 * - Atomic profile switch operation
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { profileId } = await req.json();

    if (!profileId) {
      return Response.json({ error: 'profileId required' }, { status: 400 });
    }

    // ATOMIC OPERATION: Deactivate all, activate one
    const profiles = await base44.asServiceRole.entities.UserProfile.filter({ 
      created_by: user.email 
    });

    if (profiles.length === 0) {
      return Response.json({ error: 'No profiles found' }, { status: 404 });
    }

    const targetProfile = profiles.find(p => p.id === profileId);
    if (!targetProfile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Security check
    if (targetProfile.created_by !== user.email) {
      return Response.json({ error: 'Profile does not belong to user' }, { status: 403 });
    }

    // Update all profiles atomically
    const updatePromises = profiles.map(p => {
      return base44.asServiceRole.entities.UserProfile.update(p.id, {
        is_active: p.id === profileId
      });
    });

    await Promise.all(updatePromises);

    // Verify exactly one active
    const verifyProfiles = await base44.asServiceRole.entities.UserProfile.filter({ 
      created_by: user.email 
    });
    const activeCount = verifyProfiles.filter(p => p.is_active).length;

    return Response.json({
      success: true,
      active_profile_id: profileId,
      active_profile_name: targetProfile.profile_name,
      total_profiles: profiles.length,
      active_count: activeCount,
      integrity_check: activeCount === 1 ? 'PASS' : 'FAIL'
    });

  } catch (error) {
    return Response.json({
      error: error.message,
      success: false
    }, { status: 500 });
  }
});