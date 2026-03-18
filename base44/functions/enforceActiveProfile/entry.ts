import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * ATOMIC PROFILE SWITCH
 * Enforces exactly 1 active profile per user with integrity check
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ 
        error: 'Unauthorized',
        next_step: 'Please log in'
      }, { status: 401 });
    }

    const { profileId } = await req.json();

    if (!profileId) {
      return Response.json({ 
        error: 'Missing profileId',
        next_step: 'Provide a valid profile ID'
      }, { status: 400 });
    }

    // Verify ownership
    const targetProfile = await base44.entities.UserProfile.filter({ 
      id: profileId, 
      created_by: user.email 
    });

    if (targetProfile.length === 0) {
      return Response.json({ 
        error: 'Profile not found or access denied',
        next_step: 'Check profile ID and permissions',
        error_code: 'PROFILE_NOT_FOUND'
      }, { status: 404 });
    }

    // Get all user profiles
    const allProfiles = await base44.asServiceRole.entities.UserProfile.filter({ 
      created_by: user.email 
    }, '-created_date', 50);

    // ATOMIC SWITCH: Deactivate all, activate target
    const updates = allProfiles.map(profile => {
      const shouldBeActive = profile.id === profileId;
      if (profile.is_active !== shouldBeActive) {
        return base44.asServiceRole.entities.UserProfile.update(profile.id, { 
          is_active: shouldBeActive 
        });
      }
      return null;
    }).filter(Boolean);

    await Promise.all(updates);

    // Integrity check
    const verifyProfiles = await base44.asServiceRole.entities.UserProfile.filter({ 
      created_by: user.email 
    });
    const activeCount = verifyProfiles.filter(p => p.is_active).length;

    const integrityCheck = activeCount === 1 ? 'PASS' : 'FAIL';

    if (integrityCheck === 'FAIL') {
      return Response.json({
        success: false,
        error: `Integrity check failed: ${activeCount} active profiles`,
        integrity_check: 'FAIL',
        active_count: activeCount,
        error_code: 'INTEGRITY_VIOLATION',
        next_step: 'Contact support - critical profile state issue'
      }, { status: 500 });
    }

    const activeProfile = verifyProfiles.find(p => p.is_active);

    return Response.json({
      success: true,
      active_profile_id: activeProfile.id,
      active_profile_name: activeProfile.profile_name,
      total_profiles: verifyProfiles.length,
      active_count: activeCount,
      integrity_check: 'PASS'
    });

  } catch (error) {
    console.error('[enforceActiveProfile] Error:', error);
    return Response.json({ 
      success: false,
      error: error.message,
      error_code: 'INTERNAL_ERROR',
      next_step: 'Retry or contact support',
      stack: error.stack
    }, { status: 500 });
  }
});