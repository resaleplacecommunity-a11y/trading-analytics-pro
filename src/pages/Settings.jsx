import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Settings as SettingsIcon, 
  User, 
  Crown, 
  Upload, 
  Plus,
  Bell,
  Link2,
  Lock,
  HelpCircle,
  Instagram,
  MessageCircle,
  Mail,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Check,
  Edit2,
  X,
  LogOut,
  Palette,
  Gift,
  List,
  Zap,
  ChevronLeft,
  Trash2,
  Wrench,
  Shield,
  Target,
  Brain
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import TimezoneSettings from '../components/TimezoneSettings';
import RiskSettingsForm from '../components/risk/RiskSettingsForm';
import GoalSetup from '../components/focus/GoalSetup';
import GoalSummary from '../components/focus/GoalSummary';
import ProgressBarsWithHistory from '../components/focus/ProgressBarsWithHistory';
import GoalDecomposition from '../components/focus/GoalDecomposition';
import TraderStrategyGeneratorEditable from '../components/focus/TraderStrategyGeneratorEditable';
import StrategyPlaceholder from '../components/focus/StrategyPlaceholder';
import PsychologyProfile from '../components/focus/PsychologyProfile';
import WeeklyReflection from '../components/focus/WeeklyReflection';
import WeeklyScore from '../components/focus/WeeklyScore';
import TriggerLibrary from '../components/focus/TriggerLibrary';
import PsychologyInsights from '../components/focus/PsychologyInsights';
import { getTradesForActiveProfile, getActiveProfileId, getDataForActiveProfile } from '../components/utils/profileUtils';
import { getTodayPnl } from '../components/utils/dateUtils';
import { formatInTimeZone } from 'date-fns-tz';
import { startOfWeek, differenceInDays } from 'date-fns';

const EXCHANGES = [
  { id: 'bybit', name: 'Bybit', color: 'from-amber-500 to-orange-500', logo: '🟡' },
  { id: 'binance', name: 'Binance', color: 'from-yellow-500 to-amber-500', logo: '🟨' },
  { id: 'bingx', name: 'BingX', color: 'from-blue-500 to-cyan-500', logo: '🔵' },
  { id: 'okx', name: 'OKX', color: 'from-slate-500 to-gray-500', logo: '⚫' },
  { id: 'mexc', name: 'MEXC', color: 'from-emerald-500 to-green-500', logo: '🟢' },
  { id: 'bitget', name: 'Bitget', color: 'from-indigo-500 to-purple-500', logo: '🟣' }
];

const PLAN_BENEFITS_RU = {
  NORMIS: ['Базовая аналитика', 'До 100 сделок/месяц', 'Стандартная поддержка'],
  BOSS: ['Расширенная аналитика', 'До 500 сделок/месяц', 'AI ассистент', 'Приоритетная поддержка'],
  GOD: ['Безлимитные сделки', 'Полный AI функционал', 'VIP поддержка', 'Ранний доступ к фичам']
};

const PLAN_BENEFITS_EN = {
  NORMIS: ['Basic analytics', 'Up to 100 trades/month', 'Standard support'],
  BOSS: ['Advanced analytics', 'Up to 500 trades/month', 'AI assistant', 'Priority support'],
  GOD: ['Unlimited trades', 'Full AI features', 'VIP support', 'Early access to features']
};

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('main');
  const [expandedSubscription, setExpandedSubscription] = useState(false);
  const [expandedExchanges, setExpandedExchanges] = useState(false);
  const [expandedNotifications, setExpandedNotifications] = useState(false);
  const [expandedTemplates, setExpandedTemplates] = useState(false);
  const [expandedAccountSetup, setExpandedAccountSetup] = useState(false);
  const [showUserImagePicker, setShowUserImagePicker] = useState(false);
  const [showProfileImagePicker, setShowProfileImagePicker] = useState(false);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [strategyTemplates, setStrategyTemplates] = useState([]);
  const [entryReasonTemplates, setEntryReasonTemplates] = useState([]);
  const [migrating, setMigrating] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);
  const lang = localStorage.getItem('tradingpro_lang') || 'ru';

  // Parse URL params for tab
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab && ['main', 'risk', 'focus'].includes(tab)) {
      setActiveTab(tab);
    }
  }, []);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 30 * 60 * 1000,
    cacheTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['userProfiles', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const userProfiles = await base44.entities.UserProfile.filter({ created_by: user.email }, '-created_date', 10);
      
      // SECURITY: Ensure we only return profiles that belong to current user
      if (userProfiles.length === 0) {
        console.log('Settings: No profiles found, will auto-create');
        return [];
      }
      
      // SECURITY: Double-check all profiles belong to this user
      const validProfiles = userProfiles.filter(p => p.created_by === user.email);
      if (validProfiles.length !== userProfiles.length) {
        console.error('SECURITY: Found profiles not belonging to user!');
      }
      
      return validProfiles;
    },
    enabled: !!user?.email,
    staleTime: 10 * 60 * 1000,
    cacheTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['subscriptions', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.SubscriptionPlan.filter({ created_by: user.email }, '-created_date', 1);
    },
    enabled: !!user?.email,
    staleTime: 30 * 60 * 1000,
    cacheTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: notificationSettings = [] } = useQuery({
    queryKey: ['notificationSettings', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.NotificationSettings.filter({ created_by: user.email }, '-created_date', 1);
    },
    enabled: !!user?.email,
    staleTime: 30 * 60 * 1000,
    cacheTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: allTrades = [] } = useQuery({
    queryKey: ['allTrades', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const userProfiles = await base44.entities.UserProfile.filter({ created_by: user.email }, '-created_date', 10);
      const profileIds = userProfiles.map(p => p.id);
      if (profileIds.length === 0) return [];
      
      // Get all trades for all user's profiles
      const allTradesPromises = profileIds.map(id => 
        base44.entities.Trade.filter({ profile_id: id }, '-date', 1000)
      );
      const tradesArrays = await Promise.all(allTradesPromises);
      return tradesArrays.flat();
    },
    enabled: !!user?.email,
    staleTime: 10 * 60 * 1000,
    cacheTime: 15 * 60 * 1000,
  });

  const { data: tradeTemplates = [] } = useQuery({
    queryKey: ['tradeTemplates', user?.email, profiles.find(p => p.is_active)?.id],
    queryFn: async () => {
      const activeProfile = profiles.find(p => p.is_active);
      if (!activeProfile) return [];
      return base44.entities.TradeTemplates.filter({ profile_id: activeProfile.id }, '-created_date', 1);
    },
    enabled: !!user?.email && profiles.length > 0,
    staleTime: 10 * 60 * 1000,
    cacheTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: trades = [] } = useQuery({
    queryKey: ['trades', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return getTradesForActiveProfile();
    },
    enabled: !!user?.email && activeTab === 'focus',
    staleTime: 10 * 60 * 1000,
  });

  const { data: goals = [] } = useQuery({
    queryKey: ['focusGoals', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return getDataForActiveProfile('FocusGoal', '-created_at', 10);
    },
    enabled: !!user?.email && activeTab === 'focus',
    staleTime: 10 * 60 * 1000,
  });

  const { data: psychologyProfiles = [] } = useQuery({
    queryKey: ['psychologyProfiles', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return getDataForActiveProfile('PsychologyProfile', '-created_date', 20);
    },
    enabled: !!user?.email && activeTab === 'focus',
    staleTime: 10 * 60 * 1000,
  });

  const currentPlan = subscriptions[0] || { plan_type: 'NORMIS' };
  const settings = notificationSettings[0];
  const activeProfile = profiles.find(p => p.is_active) || profiles[0];
  const currentTemplates = tradeTemplates[0];
  const activeGoal = goals.find(g => g.is_active);
  const latestPsychologyProfile = psychologyProfiles[0];
  const userTimezone = user?.preferred_timezone || 'UTC';
  
  const closedTrades = trades.filter(t => t.close_price);
  const openTrades = trades.filter(t => !t.close_price);
  
  let totalEarned = closedTrades.reduce((sum, t) => sum + (t.pnl_usd || 0), 0);
  openTrades.forEach(t => {
    if (t.realized_pnl_usd) {
      totalEarned += t.realized_pnl_usd;
    }
  });

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekStartStr = formatInTimeZone(weekStart, userTimezone, 'yyyy-MM-dd');
  const currentWeekReflection = psychologyProfiles.find(p => p.week_start === weekStartStr);

  useEffect(() => {
    if (currentTemplates) {
      try {
        const strategies = currentTemplates.strategy_templates ? JSON.parse(currentTemplates.strategy_templates) : [];
        const reasons = currentTemplates.entry_reason_templates ? JSON.parse(currentTemplates.entry_reason_templates) : [];
        setStrategyTemplates(strategies);
        setEntryReasonTemplates(reasons);
      } catch (e) {
        console.error('Failed to parse templates', e);
      }
    }
  }, [currentTemplates]);

  const [scrollPosition, setScrollPosition] = useState(0);
  const scrollContainerRef = useState(null)[0];

  const getProfileStats = (profileId) => {
    const profileTrades = allTrades.filter(t => t.profile_id === profileId && t.close_price);
    const totalTrades = profileTrades.length;
    const totalPnl = profileTrades.reduce((sum, t) => sum + (t.pnl_usd || 0), 0);
    return { totalTrades, totalPnl };
  };

  const handleScroll = (direction) => {
    const container = document.getElementById('profiles-scroll');
    if (!container) return;
    const scrollAmount = 200;
    if (direction === 'left') {
      container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    } else {
      container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const updateUserMutation = useMutation({
    mutationFn: (data) => base44.auth.updateMe(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['currentUser']);
      setEditingName(false);
      toast.success(lang === 'ru' ? 'Профиль обновлён' : 'Profile updated');
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (data) => {
      if (settings?.id) {
        return base44.entities.NotificationSettings.update(settings.id, data);
      }
      return base44.entities.NotificationSettings.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['notificationSettings']);
    },
  });

  const createProfileMutation = useMutation({
    mutationFn: async (data) => {
      // If creating an active profile, deactivate all others first
      if (data.is_active) {
        for (const p of profiles) {
          if (p.is_active) {
            await base44.entities.UserProfile.update(p.id, { is_active: false });
          }
        }
      }
      return base44.entities.UserProfile.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['userProfiles']);
      queryClient.invalidateQueries(['trades']);
      setShowProfileImagePicker(false);
      setGeneratedImages([]);
      toast.success(lang === 'ru' ? 'Профиль создан' : 'Profile created');
      setTimeout(() => window.location.reload(), 500);
    },
  });

  const switchProfileMutation = useMutation({
    mutationFn: async (profileId) => {
      // CRITICAL: First deactivate ALL profiles, then activate only selected one
      for (const p of profiles) {
        if (p.is_active && p.id !== profileId) {
          await base44.entities.UserProfile.update(p.id, { is_active: false });
        }
      }
      await base44.entities.UserProfile.update(profileId, { is_active: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['userProfiles']);
      queryClient.invalidateQueries(['trades']);
      toast.success(lang === 'ru' ? 'Профиль переключён' : 'Profile switched');
      setTimeout(() => window.location.reload(), 500);
    },
  });

  const deleteProfileMutation = useMutation({
    mutationFn: (profileId) => base44.entities.UserProfile.delete(profileId),
    onSuccess: () => {
      queryClient.invalidateQueries(['userProfiles']);
      toast.success(lang === 'ru' ? 'Профиль удалён' : 'Profile deleted');
    },
  });

  const handleMigrateToMain = async () => {
    setMigrating(true);
    try {
      const response = await base44.functions.invoke('migrateToMainProfile', {});
      toast.success(lang === 'ru' 
        ? `Миграция завершена! Перенесено: ${response.data.migratedCounts.trades} сделок`
        : `Migration complete! Migrated: ${response.data.migratedCounts.trades} trades`
      );
      queryClient.invalidateQueries(['userProfiles']);
      queryClient.invalidateQueries(['trades']);
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error("Migration error:", error);
      toast.error(lang === 'ru' ? 'Ошибка миграции' : 'Migration error');
    } finally {
      setMigrating(false);
    }
  };

  const generateImages = async () => {
    setGeneratingImages(true);
    try {
      const promises = Array(6).fill(null).map(() => 
        base44.integrations.Core.GenerateImage({
          prompt: "minimalist flat icon avatar on dark black background, simple geometric shapes, professional trader symbol, clean modern design, monochromatic with green accent, abstract minimal, 2D flat design, dark theme"
        })
      );
      const results = await Promise.all(promises);
      setGeneratedImages(results.map(r => r.url));
    } catch (error) {
      toast.error(lang === 'ru' ? 'Ошибка генерации' : 'Generation error');
    } finally {
      setGeneratingImages(false);
    }
  };

  const uploadUserImage = async (file) => {
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await updateUserMutation.mutateAsync({ profile_image: file_url });
      setShowUserImagePicker(false);
      setGeneratedImages([]);
    } catch (error) {
      toast.error(lang === 'ru' ? 'Ошибка загрузки' : 'Upload error');
    }
  };

  const saveGoalMutation = useMutation({
    mutationFn: async (data) => {
      const profileId = await getActiveProfileId();
      const currentUser = await base44.auth.me();
      const tz = currentUser?.preferred_timezone || 'UTC';
      
      if (data.target_date && !data.time_horizon_days) {
        const days = differenceInDays(new Date(data.target_date), new Date());
        data.time_horizon_days = Math.max(1, days);
      }

      if (activeGoal?.id && !editingGoal) {
        await base44.entities.FocusGoal.update(activeGoal.id, { is_active: false });
      }

      if (editingGoal && activeGoal?.id) {
        return base44.entities.FocusGoal.update(activeGoal.id, {
          ...data,
          profile_id: profileId,
          is_active: true
        });
      }

      const startingCapital = data.mode === 'personal' 
        ? (data.current_capital_usd || 0) 
        : (data.prop_account_size_usd || 0);

      return base44.entities.FocusGoal.create({
        ...data,
        profile_id: profileId,
        created_by: currentUser.email,
        is_active: true,
        created_at: new Date().toISOString(),
        start_date: formatInTimeZone(new Date(), tz, 'yyyy-MM-dd'),
        starting_capital_usd: startingCapital
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['focusGoals']);
      setEditingGoal(false);
      toast.success(lang === 'ru' ? 'Цель сохранена' : 'Goal saved');
    },
  });

  const saveReflectionMutation = useMutation({
    mutationFn: async (data) => {
      const profileId = await getActiveProfileId();
      const currentUser = await base44.auth.me();
      if (currentWeekReflection?.id) {
        return base44.entities.PsychologyProfile.update(currentWeekReflection.id, { ...data, profile_id: profileId });
      }
      return base44.entities.PsychologyProfile.create({
        ...data,
        profile_id: profileId,
        created_by: currentUser.email,
        week_start: weekStartStr
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['psychologyProfiles']);
      toast.success(lang === 'ru' ? 'Рефлексия сохранена' : 'Reflection saved');
    },
  });

  const savePsychologyProfileMutation = useMutation({
    mutationFn: async (data) => {
      const profileId = await getActiveProfileId();
      const currentUser = await base44.auth.me();
      if (latestPsychologyProfile?.id && !data.week_start) {
        return base44.entities.PsychologyProfile.update(latestPsychologyProfile.id, { ...data, profile_id: profileId });
      }
      return base44.entities.PsychologyProfile.create({ 
        ...data, 
        profile_id: profileId,
        created_by: currentUser.email
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['psychologyProfiles']);
      toast.success(lang === 'ru' ? 'Профиль сохранён' : 'Profile saved');
    },
  });

  const handleStrategyUpdate = (newStrategy) => {
    if (!activeGoal) return;
    saveGoalMutation.mutate({
      ...activeGoal,
      trades_per_day: newStrategy.tradesPerDay,
      winrate: newStrategy.winrate,
      rr_ratio: newStrategy.rrRatio,
      risk_per_trade: newStrategy.riskPerTrade,
      is_active: true
    });
  };

  const adjustGoal = (additionalDays) => {
    if (!activeGoal) return;
    const newDays = (activeGoal.time_horizon_days || 180) + additionalDays;
    saveGoalMutation.mutate({
      ...activeGoal,
      time_horizon_days: newDays,
      is_active: true
    });
  };

  const handleStrategySelect = (strategy) => {
    if (!activeGoal) return;
    
    const strategyParams = {
      conservative: { trades_per_day: 2, winrate: 50, rr_ratio: 3, risk_per_trade: 1.5 },
      risky: { trades_per_day: 3, winrate: 55, rr_ratio: 2.5, risk_per_trade: 2 },
      aggressive: { trades_per_day: 5, winrate: 60, rr_ratio: 2, risk_per_trade: 3 }
    };

    saveGoalMutation.mutate({
      ...activeGoal,
      ...strategyParams[strategy],
      is_active: true
    });
  };

  useEffect(() => {
    if (activeGoal && !editingGoal && Math.abs(totalEarned - (activeGoal.earned || 0)) > 1) {
      const timeoutId = setTimeout(() => {
        saveGoalMutation.mutate({
          ...activeGoal,
          earned: totalEarned,
          is_active: true
        });
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [totalEarned, activeGoal, editingGoal]);

  return (
    <div className="max-w-6xl mx-auto h-screen flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between pb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
            <SettingsIcon className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-[#c0c0c0]">
              {lang === 'ru' ? 'Настройки' : 'Settings'}
            </h1>
            <p className="text-[#888] text-sm">
              {lang === 'ru' ? 'Управление аккаунтом и приложением' : 'Manage your account and app'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Timezone Selector */}
          <TimezoneSettings compact={true} />

          {/* Language Switcher */}
          <div className="flex gap-1 bg-[#1a1a1a] rounded-lg p-1 border border-[#2a2a2a]">
            <button
              onClick={() => {
                localStorage.setItem('tradingpro_lang', 'ru');
                location.reload();
              }}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                lang === 'ru'
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "text-[#666] hover:text-[#888]"
              )}
            >
              🇷🇺
            </button>
            <button
              onClick={() => {
                localStorage.setItem('tradingpro_lang', 'en');
                location.reload();
              }}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                lang === 'en'
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "text-[#666] hover:text-[#888]"
              )}
            >
              🇬🇧
            </button>
          </div>

          {/* Migration Button */}
          {!profiles.find(p => p.profile_name === 'MAIN') && (
            <Button
              onClick={handleMigrateToMain}
              disabled={migrating}
              className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/50"
            >
              <Zap className="w-4 h-4 mr-2" />
              {migrating 
                ? (lang === 'ru' ? 'Миграция...' : 'Migrating...') 
                : (lang === 'ru' ? 'Создать MAIN профиль' : 'Create MAIN Profile')
              }
            </Button>
          )}
        </div>
      </div>

      {/* Static Profiles Section - Always on top */}
      <div className="flex-shrink-0 space-y-6 pb-6">

      {/* User Profile & Trading Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Profile */}
        <div className="bg-[#0d0d0d]/50 rounded-2xl border border-cyan-500/20 p-6">
          <div className="flex items-center gap-3 mb-6">
            <User className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-[#c0c0c0]">
              {lang === 'ru' ? 'Профиль пользователя' : 'User Profile'}
            </h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative group cursor-pointer" onClick={() => setShowUserImagePicker(true)}>
                <div className="w-[88px] h-[88px] rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 flex items-center justify-center overflow-hidden hover:border-cyan-500/50 transition-colors">
                  {user?.profile_image ? (
                    <img src={user.profile_image} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-10 h-10 text-cyan-400" />
                  )}
                </div>
                <div className="absolute inset-0 bg-black/60 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Upload className="w-5 h-5 text-white" />
                </div>
              </div>

              <div className="flex-1 space-y-2">
                {editingName ? (
                  <div className="flex gap-2">
                    <Input 
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="bg-[#0a0a0a] border-[#2a2a2a] text-[#c0c0c0] h-10 text-sm" 
                      placeholder={lang === 'ru' ? 'Имя' : 'Name'}
                      autoFocus
                    />
                    <Button size="sm" onClick={() => updateUserMutation.mutate({ full_name: newName })} className="h-10 px-3 bg-emerald-500 hover:bg-emerald-600">
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingName(false)} className="h-10 px-3 bg-[#111] border-[#2a2a2a]">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div 
                    onClick={() => { setEditingName(true); setNewName(user?.full_name || ''); }}
                    className="cursor-pointer"
                  >
                    <Input
                      value={user?.full_name || ''}
                      placeholder={lang === 'ru' ? 'Имя' : 'Name'}
                      className="bg-[#0a0a0a] border-[#2a2a2a] text-[#c0c0c0] h-10 text-sm cursor-pointer hover:border-cyan-500/30 transition-colors"
                      readOnly
                    />
                  </div>
                )}

                <Input
                  value={user?.email || ''}
                  placeholder="Email"
                  className="bg-[#0a0a0a] border-[#2a2a2a] text-[#888] h-10 text-sm cursor-not-allowed"
                  readOnly
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                disabled
                className="flex-1 justify-center bg-[#0a0a0a] border-[#2a2a2a] text-[#666] cursor-not-allowed h-9"
                title={lang === 'ru' ? 'Функция в разработке' : 'Feature in development'}
              >
                <Lock className="w-4 h-4 mr-2" />
                {lang === 'ru' ? 'Изменить пароль' : 'Change password'}
              </Button>

              <Button 
                variant="outline" 
                size="sm"
                className="w-20 justify-center bg-red-500/10 border-red-500/50 text-red-400 hover:bg-red-500/20 h-9"
                onClick={() => base44.auth.logout('/')}
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* User Image Picker Modal */}
          {showUserImagePicker && (
            <div className="fixed inset-0 bg-black/90 z-50 flex items-start justify-center p-4 pt-20 overflow-y-auto">
              <div className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] p-6 max-w-2xl w-full">
                <h3 className="text-xl font-bold text-[#c0c0c0] mb-4">
                  {lang === 'ru' ? 'Выберите фото профиля' : 'Choose profile photo'}
                </h3>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={() => document.getElementById('user-file-upload').click()}
                      className="w-full bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 border border-violet-500/50"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {lang === 'ru' ? 'Загрузить' : 'Upload'}
                    </Button>
                    <input 
                      id="user-file-upload" 
                      type="file" 
                      accept="image/*" 
                      className="hidden"
                      onChange={(e) => e.target.files[0] && uploadUserImage(e.target.files[0])}
                    />

                    <Button
                      onClick={generateImages}
                      disabled={generatingImages}
                      className="w-full bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/50"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      {generatingImages 
                        ? (lang === 'ru' ? 'Генерация...' : 'Generating...') 
                        : (lang === 'ru' ? 'Сгенерировать' : 'Generate')
                      }
                    </Button>
                  </div>

                  {generatedImages.length > 0 && (
                    <div className="grid grid-cols-3 gap-3">
                      {generatedImages.map((img, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            updateUserMutation.mutate({ profile_image: img });
                            setShowUserImagePicker(false);
                            setGeneratedImages([]);
                          }}
                          className="aspect-square rounded-lg overflow-hidden border-2 border-[#2a2a2a] hover:border-violet-500/50 transition-all bg-[#0a0a0a]"
                        >
                          <img src={img} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}

                  <Button
                    variant="outline"
                    onClick={() => { setShowUserImagePicker(false); setGeneratedImages([]); }}
                    className="w-full bg-[#111] border-[#2a2a2a] text-[#888]"
                  >
                    {lang === 'ru' ? 'Отмена' : 'Cancel'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Trading Profile */}
        <div className="bg-[#0d0d0d]/50 rounded-2xl border border-emerald-500/20 overflow-hidden h-full">
          <div className="flex items-center justify-between px-6 py-4 border-b border-emerald-500/10">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-[#c0c0c0]">
                {lang === 'ru' ? 'Торговые профили' : 'Trading Profiles'}
              </h2>
            </div>
            <Button
              onClick={() => setShowProfileImagePicker(true)}
              size="sm"
              className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/50 h-8"
            >
              <Plus className="w-4 h-4 mr-1" />
              {lang === 'ru' ? 'Добавить' : 'Add'}
            </Button>
          </div>

          {profiles.length > 0 ? (
            <div className="relative" style={{ height: 'calc(100% - 65px)' }}>
              {/* Scroll Buttons */}
              {profiles.length > 3 && (
                <>
                  <button
                    onClick={() => handleScroll('left')}
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-[#1a1a1a]/90 border border-emerald-500/30 rounded-full flex items-center justify-center hover:bg-emerald-500/20 transition-all"
                  >
                    <ChevronLeft className="w-4 h-4 text-emerald-400" />
                  </button>
                  <button
                    onClick={() => handleScroll('right')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-[#1a1a1a]/90 border border-emerald-500/30 rounded-full flex items-center justify-center hover:bg-emerald-500/20 transition-all"
                  >
                    <ChevronRight className="w-4 h-4 text-emerald-400" />
                  </button>
                </>
              )}

              {/* Profiles Horizontal Scroll */}
              <div 
                id="profiles-scroll"
                className="flex gap-3 p-4 h-full overflow-x-auto scrollbar-hide"
              >
                {profiles.sort((a, b) => b.is_active - a.is_active).map((profile) => {
                  const stats = getProfileStats(profile.id);
                  const isActive = profile.is_active;
                  
                  return (
                    <div
                      key={profile.id}
                      className="relative group flex-shrink-0 transition-all"
                      style={{ 
                        width: profiles.length === 1 ? '100%' : profiles.length === 2 ? 'calc(50% - 6px)' : profiles.length === 3 ? 'calc(33.33% - 8px)' : '200px'
                      }}
                    >
                      <button
                        onClick={() => !isActive && switchProfileMutation.mutate(profile.id)}
                        className={cn(
                          "w-full h-full rounded-xl border p-3 flex flex-col transition-all",
                          isActive 
                            ? "bg-emerald-500/10 border-emerald-500/40 cursor-default" 
                            : "bg-[#0a0a0a] border-[#2a2a2a] hover:border-emerald-500/50 cursor-pointer"
                        )}
                      >
                        <div className="flex items-center gap-2.5 mb-2">
                          <div className={cn(
                            "w-12 h-12 rounded-lg overflow-hidden border flex-shrink-0",
                            isActive ? "border-emerald-500/50" : "border-[#2a2a2a]"
                          )}>
                            <img src={profile.profile_image} alt="" className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <p className="text-[#c0c0c0] font-bold text-xs truncate">{profile.profile_name}</p>
                            {isActive && (
                              <p className="text-emerald-400 text-[9px] font-medium mt-0.5">
                                {lang === 'ru' ? 'Активный' : 'Active'}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex-1" />

                        <div className="space-y-1 pt-2 border-t border-[#2a2a2a]">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] text-[#666]">{lang === 'ru' ? 'Сделок' : 'Trades'}</span>
                            <span className="text-[10px] text-[#c0c0c0] font-semibold">{stats.totalTrades}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] text-[#666]">PNL</span>
                            <span className={cn(
                              "text-[11px] font-bold",
                              stats.totalPnl > 0 ? "text-emerald-400" : stats.totalPnl < 0 ? "text-red-400" : "text-[#888]"
                            )}>
                              {stats.totalPnl >= 0 ? '+' : ''}{stats.totalPnl.toFixed(0)}$
                            </span>
                          </div>
                        </div>
                      </button>

                      {!isActive && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(lang === 'ru' ? 'Удалить профиль?' : 'Delete profile?')) {
                              deleteProfileMutation.mutate(profile.id);
                            }
                          }}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-xl z-10"
                        >
                          <Trash2 className="w-3 h-3 text-white" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center" style={{ height: 'calc(100% - 65px)' }}>
              <p className="text-[#666] text-sm">
                {lang === 'ru' ? 'Создайте свой первый торговый профиль' : 'Create your first trading profile'}
              </p>
            </div>
          )}

          {/* Profile Image Picker Modal */}
          {showProfileImagePicker && (
            <div className="fixed inset-0 bg-black/90 z-50 flex items-start justify-center p-4 pt-20 overflow-y-auto">
              <div className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] p-6 max-w-2xl w-full">
                <h3 className="text-xl font-bold text-[#c0c0c0] mb-4">
                  {lang === 'ru' ? 'Создать торговый профиль' : 'Create trading profile'}
                </h3>
                
                <Input
                  placeholder={lang === 'ru' ? 'Название профиля' : 'Profile name'}
                  className="bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0] mb-4"
                  id="profile-name-input"
                />

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={() => document.getElementById('profile-file-upload').click()}
                      className="w-full bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 border border-violet-500/50"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {lang === 'ru' ? 'Загрузить' : 'Upload'}
                    </Button>
                    <input 
                      id="profile-file-upload" 
                      type="file" 
                      accept="image/*" 
                      className="hidden"
                      onChange={async (e) => {
                        if (e.target.files[0]) {
                          const name = document.getElementById('profile-name-input').value;
                          if (!name) {
                            toast.error(lang === 'ru' ? 'Введите название' : 'Enter name');
                            return;
                          }
                          try {
                            const { file_url } = await base44.integrations.Core.UploadFile({ file: e.target.files[0] });
                            createProfileMutation.mutate({
                              profile_name: name,
                              profile_image: file_url,
                              is_active: profiles.length === 0
                            });
                          } catch (error) {
                            toast.error(lang === 'ru' ? 'Ошибка загрузки' : 'Upload error');
                          }
                        }
                      }}
                    />

                    <Button
                      onClick={generateImages}
                      disabled={generatingImages}
                      className="w-full bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/50"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      {generatingImages 
                        ? (lang === 'ru' ? 'Генерация...' : 'Generating...') 
                        : (lang === 'ru' ? 'Сгенерировать' : 'Generate')
                      }
                    </Button>
                  </div>

                  {generatedImages.length > 0 && (
                    <div className="grid grid-cols-3 gap-3">
                      {generatedImages.map((img, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            const name = document.getElementById('profile-name-input').value;
                            if (!name) {
                              toast.error(lang === 'ru' ? 'Введите название' : 'Enter name');
                              return;
                            }
                            createProfileMutation.mutate({
                              profile_name: name,
                              profile_image: img,
                              is_active: profiles.length === 0
                            });
                          }}
                          className="aspect-square rounded-lg overflow-hidden border-2 border-[#2a2a2a] hover:border-emerald-500/50 transition-all bg-[#0a0a0a]"
                        >
                          <img src={img} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}

                  <Button
                    variant="outline"
                    onClick={() => { setShowProfileImagePicker(false); setGeneratedImages([]); }}
                    className="w-full bg-[#111] border-[#2a2a2a] text-[#888]"
                  >
                    {lang === 'ru' ? 'Отмена' : 'Cancel'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Subscription Plan - Collapsed */}
      <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-2xl border-2 border-amber-500/30 overflow-hidden">
        <button
          onClick={() => setExpandedSubscription(!expandedSubscription)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#1a1a1a]/50 transition-colors"
        >
          <div className="flex items-center gap-4">
            <Crown className="w-5 h-5 text-amber-400" />
            <span className="text-[#c0c0c0] font-medium">
              {lang === 'ru' ? 'Тарифный план' : 'Subscription Plan'}: 
              <span className="ml-2 text-amber-400 font-bold">{currentPlan.plan_type}</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[#888] text-sm">
              {currentPlan.expires_at 
                ? `${lang === 'ru' ? 'До' : 'Until'}: ${new Date(currentPlan.expires_at).toLocaleDateString()}`
                : (lang === 'ru' ? 'Активна' : 'Active')
              }
            </span>
            {expandedSubscription ? <ChevronDown className="w-5 h-5 text-[#888]" /> : <ChevronRight className="w-5 h-5 text-[#888]" />}
          </div>
        </button>

        {expandedSubscription && (
          <div className="px-6 pb-6 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['NORMIS', 'BOSS', 'GOD'].map((plan) => {
                const benefits = lang === 'ru' ? PLAN_BENEFITS_RU[plan] : PLAN_BENEFITS_EN[plan];
                return (
                  <div
                    key={plan}
                    className={cn(
                      "relative rounded-xl border-2 p-6 transition-all",
                      currentPlan.plan_type === plan
                        ? plan === 'GOD' 
                          ? "bg-gradient-to-br from-purple-500/20 to-violet-500/20 border-purple-500/50"
                          : plan === 'BOSS'
                          ? "bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-500/50"
                          : "bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-cyan-500/50"
                        : "bg-[#111] border-[#2a2a2a] hover:border-[#3a3a3a] cursor-pointer"
                    )}
                  >
                    {currentPlan.plan_type === plan && (
                      <div className="absolute top-3 right-3">
                        <Crown className="w-5 h-5 text-amber-400" />
                      </div>
                    )}
                    
                    <h3 className={cn(
                      "text-2xl font-bold mb-2",
                      plan === 'GOD' ? "text-purple-400" : plan === 'BOSS' ? "text-amber-400" : "text-cyan-400"
                    )}>
                      {plan}
                    </h3>
                    
                    <ul className="space-y-2 text-[#888] text-sm">
                      {benefits.map((benefit, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-emerald-400">•</span>
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Account Setup - Collapsed */}
      <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-2xl border-2 border-emerald-500/30 overflow-hidden">
        <button
          onClick={() => setExpandedAccountSetup(!expandedAccountSetup)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#1a1a1a]/50 transition-colors"
        >
          <div className="flex items-center gap-4">
            <Wrench className="w-5 h-5 text-emerald-400" />
            <span className="text-[#c0c0c0] font-medium">
              {lang === 'ru' ? 'Настроить аккаунт' : 'Account Setup'}
              <span className="text-[#666] text-sm font-normal ml-2">
                ({lang === 'ru' ? 'если вы не подключились к бирже' : 'if not connected to exchange'})
              </span>
            </span>
          </div>
          {expandedAccountSetup ? <ChevronDown className="w-5 h-5 text-[#888]" /> : <ChevronRight className="w-5 h-5 text-[#888]" />}
        </button>

        {expandedAccountSetup && (
          <div className="px-6 pb-6 pt-2">
            <div className="space-y-4">
              <div>
                <Label className="text-[#888]">{lang === 'ru' ? 'Стартовый капитал ($)' : 'Starting Capital ($)'}</Label>
                <Input 
                  type="number"
                  value={activeProfile?.starting_balance || ''}
                  onChange={(e) => {
                    if (activeProfile) {
                      base44.entities.UserProfile.update(activeProfile.id, { starting_balance: parseFloat(e.target.value) || 0 })
                        .then(() => {
                          queryClient.invalidateQueries(['userProfiles']);
                          toast.success(lang === 'ru' ? 'Сохранено' : 'Saved');
                        });
                    }
                  }}
                  className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] mt-1"
                  placeholder={lang === 'ru' ? 'Например: 10000' : 'Example: 10000'}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-[#888]">{lang === 'ru' ? 'Комиссия на открытие (%)' : 'Open Commission (%)'}</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={activeProfile?.open_commission || 0.05}
                    onChange={(e) => {
                      if (activeProfile) {
                        base44.entities.UserProfile.update(activeProfile.id, { open_commission: parseFloat(e.target.value) || 0.05 })
                          .then(() => {
                            queryClient.invalidateQueries(['userProfiles']);
                            toast.success(lang === 'ru' ? 'Сохранено' : 'Saved');
                          });
                      }
                    }}
                    className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] mt-1"
                    placeholder="0.05"
                  />
                </div>
                <div>
                  <Label className="text-[#888]">{lang === 'ru' ? 'Комиссия на закрытие (%)' : 'Close Commission (%)'}</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={activeProfile?.close_commission || 0.05}
                    onChange={(e) => {
                      if (activeProfile) {
                        base44.entities.UserProfile.update(activeProfile.id, { close_commission: parseFloat(e.target.value) || 0.05 })
                          .then(() => {
                            queryClient.invalidateQueries(['userProfiles']);
                            toast.success(lang === 'ru' ? 'Сохранено' : 'Saved');
                          });
                      }
                    }}
                    className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] mt-1"
                    placeholder="0.05"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Exchange Integration - Collapsed */}
      <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-2xl border-2 border-[#2a2a2a] overflow-hidden">
        <button
          onClick={() => setExpandedExchanges(!expandedExchanges)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#1a1a1a]/50 transition-colors"
        >
          <div className="flex items-center gap-4">
            <Link2 className="w-5 h-5 text-blue-400" />
            <span className="text-[#c0c0c0] font-medium">
              {lang === 'ru' ? 'Подключение к биржам' : 'Exchange Connection'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[#888] text-sm">
              {lang === 'ru' ? 'Не подключено' : 'Not connected'}
            </span>
            {expandedExchanges ? <ChevronDown className="w-5 h-5 text-[#888]" /> : <ChevronRight className="w-5 h-5 text-[#888]" />}
          </div>
        </button>

        {expandedExchanges && (
          <div className="px-6 pb-6 pt-2">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {EXCHANGES.map((exchange) => (
                <button
                  key={exchange.id}
                  onClick={() => toast.info(lang === 'ru' ? 'Функция в разработке' : 'Feature in development')}
                  className="relative rounded-xl border-2 border-[#2a2a2a] p-6 hover:border-[#3a3a3a] transition-all group bg-[#111]"
                >
                  <div className={cn("w-12 h-12 rounded-lg bg-gradient-to-br mb-3 mx-auto flex items-center justify-center text-2xl", exchange.color)}>
                    {exchange.logo}
                  </div>
                  <p className="text-[#c0c0c0] font-medium text-center">{exchange.name}</p>
                  <p className="text-[#666] text-xs text-center mt-1">
                    {lang === 'ru' ? 'Нажмите для подключения' : 'Click to connect'}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Notification Settings - Collapsed */}
      <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-2xl border-2 border-[#2a2a2a] overflow-hidden">
        <button
          onClick={() => setExpandedNotifications(!expandedNotifications)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#1a1a1a]/50 transition-colors"
        >
          <div className="flex items-center gap-4">
            <Bell className="w-5 h-5 text-violet-400" />
            <span className="text-[#c0c0c0] font-medium">
              {lang === 'ru' ? 'Настройки уведомлений' : 'Notification Settings'}
            </span>
          </div>
          {expandedNotifications ? <ChevronDown className="w-5 h-5 text-[#888]" /> : <ChevronRight className="w-5 h-5 text-[#888]" />}
        </button>

        {expandedNotifications && (
          <div className="px-6 pb-6 pt-2">
            <div className="space-y-3">
              {[
                { key: 'incomplete_trade_enabled', label: lang === 'ru' ? 'Незаполненные сделки' : 'Incomplete trades' },
                { key: 'risk_violation_enabled', label: lang === 'ru' ? 'Нарушение рисков' : 'Risk violations' },
                { key: 'goal_achieved_enabled', label: lang === 'ru' ? 'Достижение целей' : 'Goals achieved' },
                { key: 'market_outlook_enabled', label: lang === 'ru' ? 'Незаполненный прогноз' : 'Missing market outlook' },
                { key: 'sound_enabled', label: lang === 'ru' ? 'Звуковые уведомления' : 'Sound notifications' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between p-3 bg-[#111] rounded-lg border border-[#2a2a2a]">
                  <span className="text-[#c0c0c0] text-sm">{label}</span>
                  <Switch
                    checked={settings?.[key] ?? true}
                    onCheckedChange={(checked) => {
                      queryClient.setQueryData(['notificationSettings'], (old) => {
                        if (!old || old.length === 0) return [{ [key]: checked }];
                        return [{ ...old[0], [key]: checked }];
                      });
                      updateSettingsMutation.mutate({
                        ...settings,
                        [key]: checked
                      });
                    }}
                    className={cn(
                      "data-[state=checked]:bg-emerald-500",
                      "data-[state=unchecked]:bg-[#2a2a2a]"
                    )}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Templates for Strategy and Entry Reason - Collapsed */}
      <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-2xl border-2 border-[#2a2a2a] overflow-hidden">
        <button
          onClick={() => setExpandedTemplates(!expandedTemplates)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#1a1a1a]/50 transition-colors"
        >
          <div className="flex items-center gap-4">
            <List className="w-5 h-5 text-blue-400" />
            <span className="text-[#c0c0c0] font-medium">
              {lang === 'ru' ? 'Шаблоны для сделок' : 'Trade Templates'}
            </span>
          </div>
          {expandedTemplates ? <ChevronDown className="w-5 h-5 text-[#888]" /> : <ChevronRight className="w-5 h-5 text-[#888]" />}
        </button>

        {expandedTemplates && (
          <div className="px-6 pb-6 pt-2">
            <div className="space-y-4">
              <div>
                <Label className="text-[#888] text-xs mb-2 block">{lang === 'ru' ? 'Шаблоны стратегий' : 'Strategy Templates'}</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {strategyTemplates.map((template, index) => (
                    <span key={index} className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                      {template}
                      <button onClick={async () => {
                        const newTemplates = strategyTemplates.filter((_, i) => i !== index);
                        setStrategyTemplates(newTemplates);
                        const profileId = activeProfile?.id;
                        if (!profileId) return;
                        const data = {
                          profile_id: profileId,
                          strategy_templates: JSON.stringify(newTemplates),
                          entry_reason_templates: JSON.stringify(entryReasonTemplates)
                        };
                        if (currentTemplates?.id) {
                          await base44.entities.TradeTemplates.update(currentTemplates.id, data);
                        } else {
                          await base44.entities.TradeTemplates.create(data);
                        }
                        queryClient.invalidateQueries(['tradeTemplates']);
                        toast.success(lang === 'ru' ? 'Шаблон удалён' : 'Template removed');
                      }} className="text-blue-200 hover:text-white">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <Input 
                  placeholder={lang === 'ru' ? 'Добавить стратегию (Enter для сохранения)' : 'Add strategy (Enter to save)'}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && e.target.value.trim() !== '') {
                      const newTemplates = [...strategyTemplates, e.target.value.trim()];
                      setStrategyTemplates(newTemplates);
                      e.target.value = '';
                      const profileId = activeProfile?.id;
                      if (!profileId) return;
                      const data = {
                        profile_id: profileId,
                        strategy_templates: JSON.stringify(newTemplates),
                        entry_reason_templates: JSON.stringify(entryReasonTemplates)
                      };
                      if (currentTemplates?.id) {
                        await base44.entities.TradeTemplates.update(currentTemplates.id, data);
                      } else {
                        await base44.entities.TradeTemplates.create(data);
                      }
                      queryClient.invalidateQueries(['tradeTemplates']);
                      toast.success(lang === 'ru' ? 'Шаблон добавлен' : 'Template added');
                    }
                  }}
                  className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] h-9"
                />
              </div>

              <div>
                <Label className="text-[#888] text-xs mb-2 block">{lang === 'ru' ? 'Шаблоны причин входа' : 'Entry Reason Templates'}</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {entryReasonTemplates.map((template, index) => (
                    <span key={index} className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                      {template}
                      <button onClick={async () => {
                        const newTemplates = entryReasonTemplates.filter((_, i) => i !== index);
                        setEntryReasonTemplates(newTemplates);
                        const profileId = activeProfile?.id;
                        if (!profileId) return;
                        const data = {
                          profile_id: profileId,
                          strategy_templates: JSON.stringify(strategyTemplates),
                          entry_reason_templates: JSON.stringify(newTemplates)
                        };
                        if (currentTemplates?.id) {
                          await base44.entities.TradeTemplates.update(currentTemplates.id, data);
                        } else {
                          await base44.entities.TradeTemplates.create(data);
                        }
                        queryClient.invalidateQueries(['tradeTemplates']);
                        toast.success(lang === 'ru' ? 'Шаблон удалён' : 'Template removed');
                      }} className="text-green-200 hover:text-white">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <Input 
                  placeholder={lang === 'ru' ? 'Добавить причину входа (Enter для сохранения)' : 'Add entry reason (Enter to save)'}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && e.target.value.trim() !== '') {
                      const newTemplates = [...entryReasonTemplates, e.target.value.trim()];
                      setEntryReasonTemplates(newTemplates);
                      e.target.value = '';
                      const profileId = activeProfile?.id;
                      if (!profileId) return;
                      const data = {
                        profile_id: profileId,
                        strategy_templates: JSON.stringify(strategyTemplates),
                        entry_reason_templates: JSON.stringify(newTemplates)
                      };
                      if (currentTemplates?.id) {
                        await base44.entities.TradeTemplates.update(currentTemplates.id, data);
                      } else {
                        await base44.entities.TradeTemplates.create(data);
                      }
                      queryClient.invalidateQueries(['tradeTemplates']);
                      toast.success(lang === 'ru' ? 'Шаблон добавлен' : 'Template added');
                    }
                  }}
                  className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] h-9"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Customization & Referral Link */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customization */}
        <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-2xl border-2 border-violet-500/30 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Palette className="w-5 h-5 text-violet-400" />
            <h2 className="text-lg font-bold text-[#c0c0c0]">
              {lang === 'ru' ? 'Кастомизация' : 'Customization'}
            </h2>
          </div>
          <p className="text-[#888] text-sm mb-4">
            {lang === 'ru' 
              ? 'Настройте блоки страниц под себя'
              : 'Customize page blocks for your needs'
            }
          </p>
          <Button disabled className="bg-violet-500/20 text-violet-400 border border-violet-500/50 cursor-not-allowed w-full">
            {lang === 'ru' ? 'Скоро' : 'Coming Soon'}
          </Button>
        </div>

        {/* Referral Link */}
        <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-2xl border-2 border-green-500/30 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Gift className="w-5 h-5 text-green-400" />
            <h2 className="text-lg font-bold text-[#c0c0c0]">
              {lang === 'ru' ? 'Реферальная программа' : 'Referral Program'}
            </h2>
          </div>
          <p className="text-[#888] text-sm mb-4">
            {lang === 'ru' 
              ? 'Приглашайте друзей и получайте бонусы'
              : 'Invite friends and earn bonuses'
            }
          </p>
          <Button disabled className="bg-green-500/20 text-green-400 border border-green-500/50 cursor-not-allowed w-full">
            {lang === 'ru' ? 'Скоро' : 'Coming Soon'}
          </Button>
        </div>
      </div>

          </>
          )}

          {/* Risk Tab Content */}
          {activeTab === 'risk' && (
            <RiskSettingsForm />
          )}

          {/* Focus Tab Content */}
          {activeTab === 'focus' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              {activeGoal && !editingGoal ? (
                <GoalSummary goal={activeGoal} totalEarned={totalEarned} onEdit={() => setEditingGoal(true)} />
              ) : (
                <GoalSetup
                  goal={editingGoal ? activeGoal : null}
                  onSave={(data) => saveGoalMutation.mutate(data)}
                />
              )}
            </div>

            <div>
              {activeGoal && !editingGoal ? (
                <TraderStrategyGeneratorEditable
                  goal={activeGoal}
                  trades={trades}
                  onStrategyUpdate={handleStrategyUpdate}
                />
              ) : (
                <StrategyPlaceholder />
              )}
            </div>
          </div>

          {activeGoal && !editingGoal && (
            <GoalDecomposition 
              goal={activeGoal} 
              onAdjust={adjustGoal}
              onStrategySelect={handleStrategySelect}
            />
          )}

          {activeGoal && !editingGoal && (
            <ProgressBarsWithHistory 
              goal={activeGoal} 
              trades={trades}
              userTimezone={userTimezone}
            />
          )}

          <div className="pt-8 border-t-2 border-[#1a1a1a]">
            <div className="flex items-center gap-2 mb-6">
              <Brain className="w-6 h-6 text-cyan-400" />
              <h2 className="text-xl font-bold text-[#c0c0c0]">
                {lang === 'ru' ? 'Психология' : 'Psychology'}
              </h2>
            </div>

            <div className="space-y-6">
              <PsychologyProfile
                profile={latestPsychologyProfile}
                onSave={(data) => savePsychologyProfileMutation.mutate(data)}
              />

              <TriggerLibrary
                profile={latestPsychologyProfile}
                onSave={(data) => savePsychologyProfileMutation.mutate(data)}
                trades={trades}
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <WeeklyReflection
                  reflection={currentWeekReflection}
                  onSave={(data) => saveReflectionMutation.mutate(data)}
                  psychologyProfile={latestPsychologyProfile?.psychology_issues}
                />

                <WeeklyScore
                  reflection={currentWeekReflection}
                  onUpdate={(data) => saveReflectionMutation.mutate(data)}
                />
              </div>

              <PsychologyInsights
                trades={trades}
                profiles={psychologyProfiles}
                userTimezone={userTimezone}
              />
            </div>
          </div>
          </div>
          )}
        </div>
      </div>

      {/* Support & Social - Always visible at bottom */}
      <div className="flex-shrink-0 bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-2xl border-2 border-[#2a2a2a] p-6 mt-6">
        <div className="flex items-center gap-4 mb-6">
          <HelpCircle className="w-5 h-5 text-cyan-400" />
          <h2 className="text-xl font-bold text-[#c0c0c0]">
            {lang === 'ru' ? 'Поддержка и контакты' : 'Support & Contacts'}
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Button 
            variant="outline" 
            className="bg-[#111] border-[#2a2a2a] hover:border-cyan-500/50 text-[#c0c0c0]"
            onClick={() => window.open('https://t.me/tradingpro', '_blank')}
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Telegram
          </Button>
          <Button 
            variant="outline" 
            className="bg-[#111] border-[#2a2a2a] hover:border-pink-500/50 text-[#c0c0c0]"
            onClick={() => window.open('https://instagram.com/tradingpro', '_blank')}
          >
            <Instagram className="w-4 h-4 mr-2" />
            Instagram
          </Button>
          <Button 
            variant="outline" 
            className="bg-[#111] border-[#2a2a2a] hover:border-blue-500/50 text-[#c0c0c0]"
            onClick={() => window.open('https://x.com/tradingpro', '_blank')}
          >
            X
          </Button>
          <Button 
            variant="outline" 
            className="bg-[#111] border-[#2a2a2a] hover:border-emerald-500/50 text-[#c0c0c0]"
            onClick={() => window.location.href = 'mailto:support@tradingpro.com'}
          >
            <Mail className="w-4 h-4 mr-2" />
            Email
          </Button>
        </div>
      </div>
    </div>
  );
}