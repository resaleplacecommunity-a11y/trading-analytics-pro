import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';

/**
 * CRITICAL: Component ensures every user has a trading profile
 * Automatically creates one if missing
 */
export default function EnsureUserProfile({ children }) {
  const [isChecking, setIsChecking] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 30 * 60 * 1000,
    cacheTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: profiles = [], refetch: refetchProfiles } = useQuery({
    queryKey: ['userProfiles', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.UserProfile.filter({ created_by: user.email }, '-created_date', 10);
    },
    enabled: !!user?.email,
    staleTime: 10 * 60 * 1000,
    cacheTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

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
            await base44.functions.invoke('healProfileIntegrity', {});
            refetchProfiles();
          } catch (error) {
            console.error('EnsureUserProfile: Auto-heal failed:', error);
          }
        }
        
        setIsChecking(false);
      } else if (!isCreating) {
        // Global lock via sessionStorage to prevent double-creation on re-renders
        const lockKey = `tap_profile_creating_${user.email}`;
        if (sessionStorage.getItem(lockKey)) {
          console.log('EnsureUserProfile: Creation already in progress (global lock), skipping.');
          setTimeout(() => refetchProfiles(), 2000);
          return;
        }
        sessionStorage.setItem(lockKey, '1');

        // AUTO-CREATE profile from email username
        console.log('EnsureUserProfile: No profiles found. Auto-creating...');
        setIsCreating(true);
        try {
          // Double-check from DB before creating (avoid race condition)
          const freshCheck = await base44.entities.UserProfile.filter({ created_by: user.email }, '-created_date', 1);
          if (freshCheck.length > 0) {
            console.log('EnsureUserProfile: Profile already exists (race condition avoided).');
            await refetchProfiles();
            return;
          }
          const profileName = user.email.split('@')[0];
          await base44.entities.UserProfile.create({
            profile_name: profileName,
            is_active: true,
            starting_balance: 10000,
            created_by: user.email,
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
    }

    ensureProfile();
  }, [user, profiles, isCreating, refetchProfiles]);

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