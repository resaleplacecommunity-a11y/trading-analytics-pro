import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const RANDOM_NAMES = [
  'Phoenix', 'Dragon', 'Tiger', 'Wolf', 'Eagle',
  'Lion', 'Falcon', 'Panther', 'Shark', 'Bear',
  'Hawk', 'Cobra', 'Viper', 'Thunder', 'Storm',
  'Blaze', 'Shadow', 'Ghost', 'Ninja', 'Samurai'
];

const RANDOM_AVATARS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=',
  'https://api.dicebear.com/7.x/bottts/svg?seed=',
  'https://api.dicebear.com/7.x/personas/svg?seed=',
  'https://api.dicebear.com/7.x/lorelei/svg?seed='
];

/**
 * CREATE NEW TRADING PROFILE
 * Enforces max 5 profiles per user
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

    const { profile_name, make_active } = await req.json();

    if (!profile_name || !profile_name.trim()) {
      return Response.json({ 
        error: 'Profile name is required',
        next_step: 'Enter a valid profile name',
        error_code: 'VALIDATION_ERROR'
      }, { status: 400 });
    }

    // Check limit (max 5)
    const existingProfiles = await base44.entities.UserProfile.filter({ 
      created_by: user.email 
    });

    if (existingProfiles.length >= 5) {
      return Response.json({ 
        error: 'Profile limit reached',
        error_code: 'PROFILE_LIMIT_REACHED',
        next_step: 'Delete an existing profile before creating a new one',
        current_count: existingProfiles.length,
        max_allowed: 5
      }, { status: 400 });
    }

    // Generate random avatar
    const avatarBase = RANDOM_AVATARS[Math.floor(Math.random() * RANDOM_AVATARS.length)];
    const avatarSeed = `${profile_name}${Date.now()}`;
    const randomAvatar = `${avatarBase}${avatarSeed}`;

    // Create profile (inactive by default)
    const newProfile = await base44.entities.UserProfile.create({
      profile_name: profile_name.trim(),
      profile_image: randomAvatar,
      is_active: false, // Start inactive
      starting_balance: 10000,
      open_commission: 0.05,
      close_commission: 0.05
    });

    // If make_active, switch to it
    if (make_active) {
      await base44.functions.invoke('enforceActiveProfile', { 
        profileId: newProfile.id 
      });
    }

    return Response.json({
      success: true,
      profile: newProfile,
      message: `Profile "${profile_name}" created successfully`
    });

  } catch (error) {
    console.error('[createTradingProfile] Error:', error);
    return Response.json({ 
      error: error.message,
      error_code: 'INTERNAL_ERROR',
      next_step: 'Retry or contact support',
      stack: error.stack
    }, { status: 500 });
  }
});