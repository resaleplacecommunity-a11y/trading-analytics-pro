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

      // AUTO-HEAL on mount (silent integrity fix)
      if (!isCreating) {
        try {
          await base44.functions.invoke('healProfileIntegrity', {});
        } catch (error) {
          console.error('EnsureUserProfile: Auto-heal failed:', error);
        }
      }

      // User loaded, check if profile exists
      if (profiles.length > 0) {
        const activeProfiles = profiles.filter(p => p.is_active);
        
        // Integrity check only - no auto-create on subsequent loads
        if (activeProfiles.length !== 1 && !isCreating) {
          console.warn('EnsureUserProfile: Integrity violation detected, active count =', activeProfiles.length);
        }
        
        setIsChecking(false);
      } else {
        // NO AUTO-CREATE - User must have profile from registration
        // If no profile exists, this is an error state
        console.error('EnsureUserProfile: No profile found for existing user. Migration needed.');
        setIsChecking(false);
      }
    }

    ensureProfile();
  }, [user, profiles, isCreating, refetchProfiles]);

  if (!user || isChecking || isCreating) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-4" />
          <p className="text-[#888]">
            {isCreating ? 'Создание профиля...' : 'Загрузка...'}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}