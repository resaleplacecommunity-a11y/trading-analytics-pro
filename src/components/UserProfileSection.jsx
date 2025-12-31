import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, ChevronDown, Check, Settings, ChevronRight } from 'lucide-react';
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
    <div className="relative">
      {/* Compact Single Row */}
      <div className="flex items-center gap-2">
        {/* User Avatar - Left */}
        <Link
          to={createPageUrl('Settings')}
          className="flex-shrink-0"
        >
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 flex items-center justify-center overflow-hidden hover:border-violet-500/50 transition-all cursor-pointer">
            {user?.profile_image ? (
              <img src={user.profile_image} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-4 h-4 text-violet-400" />
            )}
          </div>
        </Link>

        {/* Trading Profile - Right with Expandable */}
        {activeProfile && (
          <button
            onClick={() => setShowProfileSelector(!showProfileSelector)}
            className="flex-1 flex items-center gap-2 bg-[#1a1a1a] hover:bg-[#1f1f1f] rounded-lg p-2 border border-[#2a2a2a] hover:border-emerald-500/30 transition-all min-w-0"
          >
            <div className="w-7 h-7 rounded-md overflow-hidden border border-emerald-500/30 flex-shrink-0">
              <img src={activeProfile.profile_image} alt="" className="w-full h-full object-cover" />
            </div>
            <span className="text-[#c0c0c0] text-sm font-medium flex-1 text-left truncate">
              {activeProfile.profile_name}
            </span>
            <ChevronRight className={cn(
              "w-3.5 h-3.5 text-[#888] transition-transform flex-shrink-0",
              showProfileSelector && "rotate-90"
            )} />
          </button>
        )}
      </div>

      {/* Profile Selector Modal */}
      {showProfileSelector && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#1a1a1a] rounded-xl border-2 border-emerald-500/50 p-4 shadow-2xl z-50">
          <p className="text-[#888] text-xs mb-3">
            {lang === 'ru' ? 'Выберите профиль:' : 'Select profile:'}
          </p>
          <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-hide pr-1">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                onClick={() => switchProfileMutation.mutate(profile.id)}
                disabled={switchProfileMutation.isLoading}
                className={cn(
                  "w-full flex items-center gap-2 p-2.5 rounded-lg transition-all",
                  profile.is_active
                    ? "bg-emerald-500/20 border-2 border-emerald-500/50"
                    : "bg-[#111] border border-[#2a2a2a] hover:border-emerald-500/30 hover:bg-[#151515]"
                )}
              >
                <div className="w-9 h-9 rounded-md overflow-hidden border border-[#2a2a2a] flex-shrink-0">
                  <img src={profile.profile_image} alt="" className="w-full h-full object-cover" />
                </div>
                <span className="text-[#c0c0c0] text-sm flex-1 text-left truncate">
                  {profile.profile_name}
                </span>
                {profile.is_active && <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
              </button>
            ))}
          </div>
          <Link
            to={createPageUrl('Settings')}
            onClick={() => setShowProfileSelector(false)}
            className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/50 text-violet-400 transition-all mt-3"
          >
            <Settings className="w-4 h-4" />
            <span className="text-sm font-medium">
              {lang === 'ru' ? 'Управление профилями' : 'Manage Profiles'}
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}