import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { User } from '@/api/auth';
import { UserProfile } from '@/api/db';
import { invoke } from '@/api/functions';
import { Loader2 } from 'lucide-react';

/**
 * CRITICAL: Component ensures every user has a trading profile
 * Automatically creates one if missing
 */
export default function EnsureUserProfile({ children }) {
  const [isChecking, setIsChecking] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const createAttemptsRef = useRef(0);
  const timeoutRef = useRef(null);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => User.me(),
    staleTime: 30 * 60 * 1000,
    cacheTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: profiles = [], refetch: refetchProfiles } = useQuery({
    queryKey: ['userProfiles', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return UserProfile.filter({ created_by: user.email }, '-created_date', 10);
    },
    enabled: !!user?.email,
    staleTime: 10 * 60 * 1000,
    cacheTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Safety timeout — never block the UI for more than 8s
  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      console.warn('EnsureUserProfile: Timeout hit — showing app anyway');
      setIsChecking(false);
    }, 8000);
    return () => clearTimeout(timeoutRef.current);
  }, []);

  // Extracted function to create a default profile — called from multiple places
  async function createDefaultProfile(userEmail) {
    // Stop retrying after 3 failed attempts
    if (createAttemptsRef.current >= 3) {
      console.warn('EnsureUserProfile: Max attempts reached — showing app without profile');
      setIsChecking(false);
      return;
    }
    createAttemptsRef.current += 1;
    const lockKey = `tap_profile_creating_${userEmail}`;
    if (sessionStorage.getItem(lockKey)) {
      console.log('EnsureUserProfile: Creation already in progress (global lock), skipping.');
      setTimeout(() => refetchProfiles(), 2000);
      return;
    }
    sessionStorage.setItem(lockKey, '1');
    setIsCreating(true);
    try {
      // Double-check from DB before creating (avoid race condition)
      const freshCheck = await UserProfile.filter({ created_by: userEmail }, '-created_date', 1);
      if (freshCheck.length > 0) {
        console.log('EnsureUserProfile: Profile already exists (race condition avoided).');
        await refetchProfiles();
        return;
      }
      const profileName = userEmail.split('@')[0];
      console.log('EnsureUserProfile: Auto-creating profile for', userEmail);
      await UserProfile.create({
        profile_name: profileName,
        is_active: true,
        starting_balance: 10000,
        created_by: userEmail,
      });
      await refetchProfiles();
    } catch (error) {
      console.error('EnsureUserProfile: Auto-create failed:', error);
    } finally {
      sessionStorage.removeItem(lockKey);
      setIsCreating(false);
      setIsChecking(false);
    }
  }

  useEffect(() => {
    async function ensureProfile() {
      if (!user?.email) {
        setIsChecking(true);
        return;
      }

      // Wait for profiles to load before checking
      if (profiles === undefined) {
        setIsChecking(true);
        return;
      }

      // User loaded, check if profile exists
      if (profiles.length > 0) {
        const activeProfiles = profiles.filter(p => p.is_active);
        
        // Integrity check only - no auto-create on subsequent loads
        if (activeProfiles.length !== 1 && !isCreating) {
          console.warn('EnsureUserProfile: Integrity violation detected, active count =', activeProfiles.length);
          
          // AUTO-HEAL silently
          try {
            await invoke('healProfileIntegrity', {});
            refetchProfiles();
          } catch (error) {
            console.error('EnsureUserProfile: Auto-heal failed:', error);
          }
        }
        
        setIsChecking(false);
      } else if (!isCreating) {
        await createDefaultProfile(user.email);
      }
    }

    ensureProfile();
  }, [user, profiles, isCreating, refetchProfiles]);

  // SAFETY NET: If profiles loaded as empty and we're not already creating — trigger creation
  // This handles the case where isChecking was already false when profiles became empty
  useEffect(() => {
    if (user?.email && profiles !== undefined && profiles.length === 0 && !isCreating && !isChecking) {
      console.log('EnsureUserProfile: Safety net triggered — profiles empty, not creating. Triggering creation.');
      createDefaultProfile(user.email);
    }
  }, [user, profiles, isCreating, isChecking]);

  if (!user || isChecking) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  // isCreating — создаём профиль в фоне, не блокируем экран
  return <>{children}</>;
}