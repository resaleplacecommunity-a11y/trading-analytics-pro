import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, ChevronDown, Check, Settings } from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';

export default function UserProfileSection() {
  const [showProfileSelector, setShowProfileSelector] = useState(false);
  const queryClient = useQueryClient();
  const lang = localStorage.getItem('tradingpro_lang') || 'ru';

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['userProfiles', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const userProfiles = await base44.entities.UserProfile.filter({ created_by: user.email }, '-created_date', 10);
      console.log('Loaded profiles for user:', user.email, userProfiles);
      return userProfiles;
    },
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    cacheTime: 0,
  });

  const activeProfile = profiles.find(p => p.is_active) || profiles[0];
  
  // CRITICAL: Security check - ensure active profile belongs to current user
  useEffect(() => {
    if (activeProfile && user?.email) {
      if (activeProfile.created_by !== user.email) {
        console.error('SECURITY VIOLATION: Profile does not belong to user!', {
          profileId: activeProfile.id,
          profileOwner: activeProfile.created_by,
          currentUser: user.email
        });
        // Force reload to clear corrupted state
        queryClient.clear();
        window.location.reload();
      }
    }
  }, [activeProfile, user, queryClient]);

  const switchProfileMutation = useMutation({
    mutationFn: async (profileId) => {
      if (!user?.email) return;
      
      // CRITICAL: First deactivate ALL profiles, then activate only selected one
      const userProfiles = await base44.entities.UserProfile.filter({ created_by: user.email }, '-created_date', 10);
      for (const p of userProfiles) {
        if (p.is_active && p.id !== profileId) {
          await base44.entities.UserProfile.update(p.id, { is_active: false });
        }
      }
      await base44.entities.UserProfile.update(profileId, { is_active: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfiles', user?.email] });
      queryClient.invalidateQueries({ queryKey: ['trades', user?.email] });
      queryClient.invalidateQueries({ queryKey: ['riskSettings', user?.email] });
      queryClient.invalidateQueries({ queryKey: ['behaviorLogs', user?.email] });
      setShowProfileSelector(false);
      toast.success(lang === 'ru' ? 'Профиль переключён' : 'Profile switched');
      setTimeout(() => window.location.reload(), 300);
    },
  });

  return (
    <div className="space-y-2">
      {/* Trading Profile - Top (Larger) */}
      {activeProfile && (
        <div className="relative">
          <button
            onClick={() => setShowProfileSelector(!showProfileSelector)}
            className="w-full bg-[#1a1a1a]/60 hover:bg-[#1a1a1a] rounded-xl p-3 border border-emerald-500/20 hover:border-emerald-500/40 transition-all"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-lg overflow-hidden border border-emerald-500/30 flex-shrink-0">
                <img src={activeProfile.profile_image} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-[#c0c0c0] font-semibold text-sm truncate">
                  {activeProfile.profile_name}
                </p>
                <p className="text-emerald-400/80 text-xs">
                  {lang === 'ru' ? 'Торговый профиль' : 'Trading Profile'}
                </p>
              </div>
              <ChevronDown className={cn(
                "w-3.5 h-3.5 text-emerald-400/60 transition-transform flex-shrink-0",
                showProfileSelector && "rotate-180"
              )} />
            </div>
          </button>

          {/* Profile Selector Modal */}
          {showProfileSelector && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#1a1a1a] rounded-xl border-2 border-emerald-500/40 p-4 shadow-2xl z-50">
              <p className="text-[#888] text-xs mb-3 font-medium">
                {lang === 'ru' ? 'Выберите профиль:' : 'Select profile:'}
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-hide pr-1">
                {profiles.map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => switchProfileMutation.mutate(profile.id)}
                    disabled={switchProfileMutation.isLoading}
                    className={cn(
                      "w-full flex items-center gap-3 p-2.5 rounded-lg transition-all",
                      profile.is_active
                        ? "bg-emerald-500/20 border border-emerald-500/50"
                        : "bg-[#111] border border-[#2a2a2a] hover:border-emerald-500/30 hover:bg-[#151515]"
                    )}
                  >
                    <div className="w-9 h-9 rounded-md overflow-hidden border border-[#2a2a2a] flex-shrink-0">
                      <img src={profile.profile_image} alt="" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[#c0c0c0] text-sm font-medium flex-1 text-left truncate">
                      {profile.profile_name}
                    </span>
                    {profile.is_active && <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                  </button>
                ))}
              </div>
              <Link
                to={createPageUrl('Settings')}
                onClick={() => setShowProfileSelector(false)}
                className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 text-violet-400/90 transition-all mt-3"
              >
                <Settings className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {lang === 'ru' ? 'Управление профилями' : 'Manage Profiles'}
                </span>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* User Profile - Bottom (Smaller) */}
      <Link
        to={createPageUrl('Settings')}
        className="block bg-[#1a1a1a]/40 hover:bg-[#1a1a1a]/60 rounded-lg p-2 border border-violet-500/15 hover:border-violet-500/30 transition-all"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md overflow-hidden border border-violet-500/25 flex-shrink-0">
            {user?.profile_image ? (
              <img src={user.profile_image} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-violet-500/15 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-violet-400/70" />
              </div>
            )}
          </div>
          <span className="text-[#888] text-xs font-medium truncate flex-1">
            {user?.full_name || 'User'}
          </span>
        </div>
      </Link>

      {/* Technical System Footer */}
      <div className="text-center pt-2 pb-1">
        <p className="text-[#444] text-[9px] font-mono tracking-wide opacity-40">
          TAP SYSTEM // 2026 • v.1.0
        </p>
      </div>
    </div>
  );
}