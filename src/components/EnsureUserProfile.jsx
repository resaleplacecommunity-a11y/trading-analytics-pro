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

      // User loaded, check for profiles
      if (profiles.length === 0 && !isCreating) {
        console.log('EnsureUserProfile: No profiles found, creating default...');
        setIsCreating(true);

        try {
          const randomNames = ['Phoenix', 'Dragon', 'Tiger', 'Wolf', 'Eagle', 'Lion', 'Falcon'];
          const randomName = randomNames[Math.floor(Math.random() * randomNames.length)];
          const randomNumber = Math.floor(Math.random() * 999);
          const profileName = `${randomName} ${randomNumber}`;

          await base44.entities.UserProfile.create({
            profile_name: profileName,
            profile_image: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69349b30698117be30e537d8/d941b1ccb_.jpg',
            is_active: true,
            starting_balance: 10000,
            open_commission: 0.05,
            close_commission: 0.05,
          });

          console.log('EnsureUserProfile: Profile created successfully');
          await refetchProfiles();
        } catch (error) {
          console.error('EnsureUserProfile: Failed to create profile:', error);
        } finally {
          setIsCreating(false);
          setIsChecking(false);
        }
      } else if (profiles.length > 0) {
        // Profiles exist, ensure one is active
        const hasActive = profiles.some(p => p.is_active);
        if (!hasActive && !isCreating) {
          console.log('EnsureUserProfile: No active profile, activating first...');
          setIsCreating(true);
          try {
            await base44.entities.UserProfile.update(profiles[0].id, { is_active: true });
            await refetchProfiles();
          } catch (error) {
            console.error('EnsureUserProfile: Failed to activate profile:', error);
          } finally {
            setIsCreating(false);
          }
        }
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