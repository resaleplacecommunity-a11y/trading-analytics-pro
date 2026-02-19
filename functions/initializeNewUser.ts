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

const DEFAULT_PROFILE_IMAGE = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69349b30698117be30e537d8/d941b1ccb_.jpg';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    // Get user email from the event
    const userEmail = payload.data?.email || payload.event?.user_email;
    
    if (!userEmail) {
      return Response.json({ error: 'No user email provided' }, { status: 400 });
    }

    // Check if user already has a profile
    const existingProfiles = await base44.asServiceRole.entities.UserProfile.filter({ 
      created_by: userEmail 
    }, '-created_date', 1);

    if (existingProfiles.length > 0) {
      return Response.json({ 
        message: 'User already has profiles',
        skipped: true 
      });
    }

    // Generate random name and avatar
    const randomName = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
    const randomNumber = Math.floor(Math.random() * 999);
    const profileName = `${randomName} ${randomNumber}`;
    
    // Random avatar generator
    const avatarBase = RANDOM_AVATARS[Math.floor(Math.random() * RANDOM_AVATARS.length)];
    const avatarSeed = `${randomName}${randomNumber}`;
    const randomAvatar = `${avatarBase}${avatarSeed}`;

    console.log(`[initializeNewUser] Creating first profile: ${profileName} with avatar: ${randomAvatar}`);

    // Create trading profile using service role
    const newProfile = await base44.asServiceRole.entities.UserProfile.create({
      profile_name: profileName,
      profile_image: randomAvatar,
      is_active: true,
      starting_balance: 10000,
      open_commission: 0.05,
      close_commission: 0.05,
      created_by: userEmail
    });

    return Response.json({ 
      success: true,
      profile: newProfile,
      message: `Created profile: ${profileName}`
    });

  } catch (error) {
    console.error('Error initializing user:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});