import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, ChevronDown, Plus, Check } from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function UserProfileSection() {
  const [expanded, setExpanded] = useState(false);
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
      setExpanded(false);
      toast.success(lang === 'ru' ? 'Профиль переключён' : 'Profile switched');
    },
  });

  const getPlanColor = (plan) => {
    if (plan === 'GOD') return 'from-purple-500 to-violet-500';
    if (plan === 'BOSS') return 'from-amber-500 to-orange-500';
    return 'from-cyan-500 to-blue-500';
  };

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full bg-gradient-to-br from-[#1a1a1a] to-[#151515] rounded-xl p-4 hover:from-[#1f1f1f] hover:to-[#1a1a1a] transition-all border border-[#2a2a2a] hover:border-[#3a3a3a]"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 border-2 border-violet-500/30 flex items-center justify-center overflow-hidden">
            {user?.profile_image ? (
              <img src={user.profile_image} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-5 h-5 text-violet-400" />
            )}
          </div>
          <div className="flex-1 text-left">
            <p className="text-[#c0c0c0] font-medium text-sm truncate">{user?.full_name || 'User'}</p>
            <div className={cn("text-xs font-bold bg-gradient-to-r bg-clip-text text-transparent", getPlanColor(currentPlan.plan_type))}>
              {currentPlan.plan_type} Plan
            </div>
          </div>
          <ChevronDown className={cn("w-4 h-4 text-[#888] transition-transform", expanded && "rotate-180")} />
        </div>

        {activeProfile && (
          <div className="flex items-center gap-2 pt-2 border-t border-[#2a2a2a]">
            <div className="w-6 h-6 rounded-md overflow-hidden border border-emerald-500/30 flex-shrink-0">
              <img src={activeProfile.profile_image} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[#888] text-xs truncate">{activeProfile.profile_name}</p>
            </div>
          </div>
        )}
      </button>

      {expanded && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#1a1a1a] rounded-xl border-2 border-[#2a2a2a] p-4 shadow-2xl z-50">
          <div className="mb-3">
            <p className="text-[#888] text-xs mb-2">
              {lang === 'ru' ? 'Торговые профили:' : 'Trading Profiles:'}
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
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
          </div>

          <button
            onClick={() => {
              setExpanded(false);
              window.location.href = '/Settings';
            }}
            className="w-full flex items-center justify-center gap-2 p-2 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/50 text-violet-400 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">
              {lang === 'ru' ? 'Добавить профиль' : 'Add Profile'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}