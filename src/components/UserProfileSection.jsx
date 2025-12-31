import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, ChevronDown, Check, Settings, TrendingUp } from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function UserProfileSection() {
  const [showProfileSelector, setShowProfileSelector] = useState(false);
  const queryClient = useQueryClient();
  const lang = localStorage.getItem('tradingpro_lang') || 'ru';

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => base44.entities.SubscriptionPlan.list('-created_date', 1),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['userProfiles'],
    queryFn: () => base44.entities.UserProfile.list('-created_date', 10),
  });

  const currentPlan = subscriptions[0] || { plan_type: 'NORMIS' };
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
      window.location.reload();
    },
  });

  const getPlanName = (planType) => {
    if (lang === 'ru') {
      if (planType === 'NORMIS') return 'Базовый';
      if (planType === 'BOSS') return 'BOSS';
      if (planType === 'GOD') return 'GOD';
    }
    return planType;
  };

  return (
    <div className="relative space-y-2">
      {/* Trading Profile - Top */}
      {activeProfile && (
        <div className="relative">
          <button
            onClick={() => setShowProfileSelector(!showProfileSelector)}
            className="w-full bg-gradient-to-br from-[#1a1a1a] to-[#151515] rounded-xl p-3 border border-emerald-500/30 hover:border-emerald-500/50 transition-all"
          >
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-[#888] text-xs font-medium">
                {lang === 'ru' ? 'Торговый профиль' : 'Trading Profile'}
              </span>
              <ChevronDown className={cn("w-3 h-3 text-[#888] transition-transform ml-auto", showProfileSelector && "rotate-180")} />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md overflow-hidden border border-emerald-500/30 flex-shrink-0">
                <img src={activeProfile.profile_image} alt="" className="w-full h-full object-cover" />
              </div>
              <p className="text-[#c0c0c0] text-sm font-medium truncate flex-1">{activeProfile.profile_name}</p>
            </div>
          </button>

          {showProfileSelector && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#1a1a1a] rounded-xl border-2 border-emerald-500/50 p-4 shadow-2xl z-50">
              <p className="text-[#888] text-xs mb-2">
                {lang === 'ru' ? 'Выберите профиль:' : 'Select profile:'}
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {profiles.map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => switchProfileMutation.mutate(profile.id)}
                    className={cn(
                      "w-full flex items-center gap-2 p-2 rounded-lg transition-all",
                      profile.is_active
                        ? "bg-emerald-500/20 border-2 border-emerald-500/50"
                        : "bg-[#111] border border-[#2a2a2a] hover:border-emerald-500/30"
                    )}
                  >
                    <div className="w-8 h-8 rounded-md overflow-hidden border border-[#2a2a2a] flex-shrink-0">
                      <img src={profile.profile_image} alt="" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[#c0c0c0] text-sm flex-1 text-left truncate">
                      {profile.profile_name}
                    </span>
                    {profile.is_active && <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  setShowProfileSelector(false);
                  window.location.href = '/Settings';
                }}
                className="w-full flex items-center justify-center gap-2 p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-400 transition-all mt-3"
              >
                <Settings className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {lang === 'ru' ? 'Управление профилями' : 'Manage Profiles'}
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* User Profile - Bottom */}
      <button
        onClick={() => window.location.href = '/Settings'}
        className="w-full bg-gradient-to-br from-[#1a1a1a] to-[#151515] rounded-xl p-3 hover:from-[#1f1f1f] hover:to-[#1a1a1a] transition-all border border-[#2a2a2a] hover:border-violet-500/30"
      >
        <div className="flex items-center gap-2 mb-1">
          <User className="w-4 h-4 text-violet-400" />
          <span className="text-[#888] text-xs font-medium">
            {lang === 'ru' ? 'Пользователь' : 'User'}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 flex items-center justify-center overflow-hidden flex-shrink-0">
            {user?.profile_image ? (
              <img src={user.profile_image} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-4 h-4 text-violet-400" />
            )}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-[#c0c0c0] font-medium text-sm truncate">{user?.full_name || 'User'}</p>
            <p className="text-[#666] text-xs">
              {getPlanName(currentPlan.plan_type)}
            </p>
          </div>
        </div>
      </button>
    </div>
  );
}