import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * REPAIR FUNCTION: Fix profile auto-spawn regression
 * 
 * ACTIONS:
 * 1. Stop auto-spawn on load (already fixed in EnsureUserProfile)
 * 2. Detect duplicate auto-created profiles (multiple "Main Profile")
 * 3. Keep user-created profiles intact
 * 4. Report findings to user
 * 
 * SAFE: Does NOT delete any profiles - only reports
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[repairProfiles] Running integrity check for ${user.email}`);

    // Fetch all user profiles
    const allProfiles = await base44.asServiceRole.entities.UserProfile.filter({
      created_by: user.email
    }, '-created_date', 50);

    console.log(`[repairProfiles] Found ${allProfiles.length} total profiles`);

    // Detect candidates for auto-created duplicates
    // Heuristic: "Main Profile" name, default image, created_date very recent
    const suspectedAutoCreated = allProfiles.filter(p => 
      p.profile_name === 'Main Profile' &&
      p.profile_image === 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69349b30698117be30e537d8/d941b1ccb_.jpg'
    );

    const userManualProfiles = allProfiles.filter(p => 
      p.profile_name !== 'Main Profile' ||
      p.profile_image !== 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69349b30698117be30e537d8/d941b1ccb_.jpg'
    );

    // Ensure exactly one active profile
    const activeProfiles = allProfiles.filter(p => p.is_active);
    
    let fixedActiveCount = false;
    if (activeProfiles.length !== 1) {
      console.log(`[repairProfiles] Active count violation: ${activeProfiles.length}`);
      
      // Invoke heal function
      try {
        await base44.functions.invoke('healProfileIntegrity', {});
        fixedActiveCount = true;
      } catch (error) {
        console.error('[repairProfiles] Heal failed:', error);
      }
    }

    return Response.json({
      success: true,
      user_email: user.email,
      total_profiles: allProfiles.length,
      suspected_auto_created: suspectedAutoCreated.length,
      user_manual_profiles: userManualProfiles.length,
      active_profiles_count: activeProfiles.length,
      fixed_active_count: fixedActiveCount,
      profiles_list: allProfiles.map(p => ({
        id: p.id,
        name: p.profile_name,
        is_active: p.is_active,
        created_date: p.created_date,
        is_suspected_duplicate: p.profile_name === 'Main Profile' &&
          p.profile_image === 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69349b30698117be30e537d8/d941b1ccb_.jpg'
      })),
      message: suspectedAutoCreated.length > 0
        ? `Found ${suspectedAutoCreated.length} suspected auto-created duplicates. User manual profiles preserved.`
        : 'All profiles appear to be user-created. No duplicates detected.'
    });

  } catch (error) {
    console.error('[repairProfiles] Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});