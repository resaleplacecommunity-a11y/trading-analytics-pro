import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * AUTO-HEAL: Fix multiple active profiles
 * - Finds all users with multiple active profiles
 * - Keeps the most recently updated one active
 * - Deactivates all others
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profiles = await base44.asServiceRole.entities.UserProfile.filter({ 
      created_by: user.email 
    });

    if (profiles.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'No profiles to heal',
        active_count: 0
      });
    }

    const activeProfiles = profiles.filter(p => p.is_active);

    // Check if healing needed
    if (activeProfiles.length === 0) {
      // No active profile - activate the first one
      await base44.asServiceRole.entities.UserProfile.update(profiles[0].id, { 
        is_active: true 
      });
      
      return Response.json({
        success: true,
        healed: true,
        action: 'activated_first',
        active_profile: profiles[0].profile_name,
        active_count: 1
      });
    }

    if (activeProfiles.length === 1) {
      // Already correct
      return Response.json({
        success: true,
        healed: false,
        message: 'Profile integrity already correct',
        active_profile: activeProfiles[0].profile_name,
        active_count: 1
      });
    }

    // MULTIPLE ACTIVE - HEAL BY KEEPING MOST RECENT
    activeProfiles.sort((a, b) => 
      new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date)
    );

    const keepActive = activeProfiles[0];
    const deactivateList = activeProfiles.slice(1);

    // Deactivate all except the most recent
    await Promise.all(
      deactivateList.map(p => 
        base44.asServiceRole.entities.UserProfile.update(p.id, { is_active: false })
      )
    );

    // Verify healing
    const verifyProfiles = await base44.asServiceRole.entities.UserProfile.filter({ 
      created_by: user.email 
    });
    const finalActiveCount = verifyProfiles.filter(p => p.is_active).length;

    return Response.json({
      success: true,
      healed: true,
      action: 'deactivated_duplicates',
      kept_active: keepActive.profile_name,
      deactivated_count: deactivateList.length,
      deactivated_profiles: deactivateList.map(p => p.profile_name),
      active_count_before: activeProfiles.length,
      active_count_after: finalActiveCount,
      integrity_check: finalActiveCount === 1 ? 'PASS' : 'FAIL'
    });

  } catch (error) {
    return Response.json({
      error: error.message,
      success: false
    }, { status: 500 });
  }
});