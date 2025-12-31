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
    <div className="space-y-3">
      {/* Trading Profile */}
      {activeProfile && (
        <div className="relative">
          <button
            onClick={() => setShowProfileSelector(!showProfileSelector)}
            className="w-full bg-[#111] hover:bg-[#121212] rounded-xl p-3 border border-[#1a1a1a] hover:border-emerald-500/30 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg overflow-hidden border border-emerald-500/30">
                <img src={activeProfile.profile_image} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[#c0c0c0] font-medium text-sm">{activeProfile.profile_name}</p>
                <p className="text-emerald-400 text-xs font-medium">
                  {lang === 'ru' ? 'Активный профиль' : 'Active profile'}
                </p>
              </div>
              <ChevronDown className={cn(
                "w-4 h-4 text-[#666] transition-transform",
                showProfileSelector && "rotate-180"
              )} />
            </div>
          </button>

          {/* Profile Selector Modal */}
          {showProfileSelector && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#111] rounded-xl border border-[#2a2a2a] p-3 shadow-2xl z-50">
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
                      "w-full flex items-center gap-2.5 p-2.5 rounded-lg transition-all",
                      profile.is_active
                        ? "bg-emerald-500/10 border border-emerald-500/30"
                        : "bg-[#0d0d0d] border border-[#1a1a1a] hover:border-[#2a2a2a]"
                    )}
                  >
                    <div className="w-9 h-9 rounded-lg overflow-hidden border border-[#2a2a2a]">
                      <img src={profile.profile_image} alt="" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[#c0c0c0] text-sm font-medium flex-1 text-left">
                      {profile.profile_name}
                    </span>
                    {profile.is_active && <Check className="w-4 h-4 text-emerald-400" />}
                  </button>
                ))}
              </div>
              <Link
                to={createPageUrl('Settings')}
                onClick={() => setShowProfileSelector(false)}
                className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg bg-[#0d0d0d] hover:bg-[#0a0a0a] border border-[#1a1a1a] text-[#888] hover:text-[#c0c0c0] transition-all mt-2"
              >
                <Settings className="w-4 h-4" />
                <span className="text-xs font-medium">
                  {lang === 'ru' ? 'Управление профилями' : 'Manage Profiles'}
                </span>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* User Info */}
      <Link
        to={createPageUrl('Settings')}
        className="block bg-[#111] hover:bg-[#121212] rounded-xl p-3 border border-[#1a1a1a] hover:border-violet-500/30 transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg overflow-hidden border border-violet-500/30">
            {user?.profile_image ? (
              <img src={user.profile_image} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-violet-500/10 flex items-center justify-center">
                <User className="w-5 h-5 text-violet-400" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <p className="text-[#c0c0c0] font-medium text-sm">{user?.full_name || 'User'}</p>
            <p className="text-[#666] text-xs">
              {lang === 'ru' ? 'Профиль пользователя' : 'User Profile'}
            </p>
          </div>
        </div>
      </Link>
    </div>
  );
}