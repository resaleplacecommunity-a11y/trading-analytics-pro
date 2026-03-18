import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * ONE-TIME REPAIR MIGRATION
 * Fixes all profile integrity violations across all users
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin-only
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const report = {
      users_scanned: 0,
      profiles_fixed: 0,
      users_skipped: 0,
      multi_active_fixed: 0,
      zero_active_fixed: 0,
      orphaned_cleaned: 0,
      owner_fixed: 0,
      reasons: []
    };

    // Get all profiles
    const allProfiles = await base44.asServiceRole.entities.UserProfile.list('-created_date', 5000);
    const profilesByOwner = {};

    // Group by owner
    allProfiles.forEach(profile => {
      const owner = profile.created_by;
      if (!owner) {
        report.orphaned_cleaned++;
        report.reasons.push(`Orphaned profile ${profile.id} (no owner) - SKIP for safety`);
        return;
      }
      if (!profilesByOwner[owner]) {
        profilesByOwner[owner] = [];
      }
      profilesByOwner[owner].push(profile);
    });

    report.users_scanned = Object.keys(profilesByOwner).length;

    // Fix each user's profiles
    for (const [owner, profiles] of Object.entries(profilesByOwner)) {
      const activeProfiles = profiles.filter(p => p.is_active);

      // Check profile limit (max 5)
      if (profiles.length > 5) {
        report.reasons.push(`User ${owner} has ${profiles.length} profiles (>5 limit). Manual review needed.`);
      }

      // Fix multi-active
      if (activeProfiles.length > 1) {
        report.multi_active_fixed++;
        const mostRecent = activeProfiles.sort((a, b) => 
          new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date)
        )[0];
        
        for (const profile of activeProfiles) {
          if (profile.id !== mostRecent.id) {
            await base44.asServiceRole.entities.UserProfile.update(profile.id, { is_active: false });
            report.profiles_fixed++;
            report.reasons.push(`Deactivated duplicate active profile ${profile.id} for ${owner}`);
          }
        }
        report.reasons.push(`Fixed multi-active for ${owner}: kept ${mostRecent.id} (${mostRecent.profile_name})`);
      }

      // Fix zero-active
      if (activeProfiles.length === 0 && profiles.length > 0) {
        report.zero_active_fixed++;
        const mostRecent = profiles.sort((a, b) => 
          new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date)
        )[0];
        
        await base44.asServiceRole.entities.UserProfile.update(mostRecent.id, { is_active: true });
        report.profiles_fixed++;
        report.reasons.push(`Activated profile ${mostRecent.id} (${mostRecent.profile_name}) for ${owner} (was zero-active)`);
      }
    }

    // Summary
    console.log('[repairProfileIntegrity] Report:', JSON.stringify(report, null, 2));

    return Response.json({
      success: true,
      report
    });

  } catch (error) {
    console.error('[repairProfileIntegrity] Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});