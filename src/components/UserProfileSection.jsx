import { useState } from 'react';
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
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['userProfiles'],
    queryFn: () => base44.entities.UserProfile.list('-created_date', 10),
  });

  const activeProfile = profiles.find(p => p.is_active) || profiles[0];

  const switchProfileMutation = useMutation({
    mutationFn: async (profileId) => {
      await Promise.all(
        profiles.map(p => 
          base44.entities.UserProfile.update(p.id, { is_active: p.id === profileId })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['userProfiles']);
      queryClient.invalidateQueries(['trades']);
      setShowProfileSelector(false);
      toast.success(lang === 'ru' ? 'Профиль переключён' : 'Profile switched');
      setTimeout(() => window.location.reload(), 300);
    },
  });

  return (
    <div className="space-y-2">
      {/* Trading Profile - Top */}
      {activeProfile && (
        <div className="relative">
          <button
            onClick={() => setShowProfileSelector(!showProfileSelector)}
            className="w-full bg-[#0d0d0d]/80 hover:bg-[#111]/80 rounded-lg p-3 border border-[#1a1a1a] hover:border-emerald-500/20 transition-all"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg overflow-hidden border border-[#2a2a2a] flex-shrink-0">
                <img src={activeProfile.profile_image} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-[#c0c0c0] font-medium text-sm truncate">
                  {activeProfile.profile_name}
                </p>
                <p className="text-[#666] text-xs">
                  {lang === 'ru' ? 'Торговый профиль' : 'Trading Profile'}
                </p>
              </div>
              <ChevronDown className={cn(
                "w-3.5 h-3.5 text-[#666] transition-transform flex-shrink-0",
                showProfileSelector && "rotate-180"
              )} />
            </div>
          </button>

          {/* Profile Selector Modal */}
          {showProfileSelector && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#0d0d0d] rounded-xl border border-[#2a2a2a] p-3 shadow-2xl z-50">
              <p className="text-[#666] text-xs mb-2 font-medium">
                {lang === 'ru' ? 'Выберите профиль:' : 'Select profile:'}
              </p>
              <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-hide">
                {profiles.map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => switchProfileMutation.mutate(profile.id)}
                    disabled={switchProfileMutation.isLoading}
                    className={cn(
                      "w-full flex items-center gap-2.5 p-2 rounded-lg transition-all",
                      profile.is_active
                        ? "bg-emerald-500/10 border border-emerald-500/30"
                        : "bg-[#111] border border-[#1a1a1a] hover:border-[#2a2a2a] hover:bg-[#121212]"
                    )}
                  >
                    <div className="w-8 h-8 rounded-md overflow-hidden border border-[#2a2a2a] flex-shrink-0">
                      <img src={profile.profile_image} alt="" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[#c0c0c0] text-sm font-medium flex-1 text-left truncate">
                      {profile.profile_name}
                    </span>
                    {profile.is_active && <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
                  </button>
                ))}
              </div>
              <Link
                to={createPageUrl('Settings')}
                onClick={() => setShowProfileSelector(false)}
                className="w-full flex items-center justify-center gap-2 p-2 rounded-lg bg-[#111] hover:bg-[#121212] border border-[#1a1a1a] text-[#888] hover:text-[#c0c0c0] transition-all mt-2"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">
                  {lang === 'ru' ? 'Управление профилями' : 'Manage Profiles'}
                </span>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* User Profile - Bottom */}
      <Link
        to={createPageUrl('Settings')}
        className="block bg-[#0d0d0d]/60 hover:bg-[#111]/60 rounded-lg p-2 border border-[#1a1a1a] hover:border-violet-500/15 transition-all"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md overflow-hidden border border-[#2a2a2a] flex-shrink-0">
            {user?.profile_image ? (
              <img src={user.profile_image} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-violet-500/10 flex items-center justify-center">
                <User className="w-3 h-3 text-violet-400/70" />
              </div>
            )}
          </div>
          <span className="text-[#666] text-xs font-medium truncate flex-1">
            {user?.full_name || 'User'}
          </span>
        </div>
      </Link>
    </div>
  );
}