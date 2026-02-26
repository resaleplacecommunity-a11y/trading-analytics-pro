import { useState, useEffect, useMemo } from 'react';
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
  Bell,
  Link2,
  Lock,
  HelpCircle,
  Instagram,
  MessageCircle,
  Mail,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Check,
  X,
  LogOut,
  Palette,
  Gift,
  List,
  Zap,
  Wrench,
  Shield,
  Target,
  CheckCircle,
  XCircle,
  RefreshCw,
  Plug,
  Plus,
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import TimezoneSettings from '../components/TimezoneSettings';
import RiskSettingsForm from '../components/risk/RiskSettingsForm';
import FocusSettings from '../components/focus/FocusSettings';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { getTradesForActiveProfile, getActiveProfileId, getDataForActiveProfile } from '../components/utils/profileUtils';
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

// Memoized Profiles Section Component
const ProfilesSection = ({ lang, profiles, user, activeProfile, allTrades, showUserImagePicker, setShowUserImagePicker, showProfileImagePicker, setShowProfileImagePicker, generatingImages, setGeneratingImages, generatedImages, setGeneratedImages, editingName, setEditingName, newName, setNewName, updateUserMutation, createProfileMutation, switchProfileMutation, deleteProfileMutation, generateImages, uploadUserImage, getProfileStats, handleScroll }) => {
  return (
    <div className="space-y-6">
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

      {/* Trading Profiles */}
      <div className="bg-[#0d0d0d]/50 rounded-2xl border border-violet-500/20 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Crown className="w-5 h-5 text-violet-400" />
            <h2 className="text-lg font-bold text-[#c0c0c0]">
              {lang === 'ru' ? 'Торговые профили' : 'Trading Profiles'}
            </h2>
          </div>
          <Button 
            size="sm"
            onClick={() => setShowProfileImagePicker(true)}
            className="bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 border border-violet-500/50"
          >
            <Plus className="w-4 h-4 mr-2" />
            {lang === 'ru' ? 'Создать' : 'Create'}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {profiles.map(profile => {
            const stats = getProfileStats(profile.id);
            return (
              <div 
                key={profile.id}
                className={cn(
                  "relative rounded-xl border-2 p-4 transition-all cursor-pointer",
                  profile.is_active
                    ? "bg-gradient-to-br from-violet-500/20 to-purple-500/20 border-violet-500/50"
                    : "bg-[#111] border-[#2a2a2a] hover:border-[#3a3a3a]"
                )}
                onClick={() => {
                  if (!profile.is_active) {
                    switchProfileMutation.mutate(profile.id);
                  }
                }}
              >
                {profile.is_active && (
                  <div className="absolute top-3 right-3">
                    <Crown className="w-4 h-4 text-violet-400" />
                  </div>
                )}
                
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center overflow-hidden">
                    {profile.profile_image ? (
                      <img src={profile.profile_image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Crown className="w-6 h-6 text-violet-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[#c0c0c0] font-medium">{profile.profile_name}</h3>
                    <p className="text-[#666] text-xs">
                      {stats.totalTrades} {lang === 'ru' ? 'сделок' : 'trades'} • 
                      <span className={cn(
                        "ml-1",
                        stats.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"
                      )}>
                        {stats.totalPnl >= 0 ? '+' : ''}{stats.totalPnl.toFixed(0)}$
                      </span>
                    </p>
                  </div>
                </div>

                {profiles.length > 1 && !profile.is_active && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(lang === 'ru' ? 'Удалить профиль?' : 'Delete profile?')) {
                        deleteProfileMutation.mutate(profile.id);
                      }
                    }}
                    className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10"
                  >
                    {lang === 'ru' ? 'Удалить' : 'Delete'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* Profile Image Picker Modal */}
        {showProfileImagePicker && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-start justify-center p-4 pt-20 overflow-y-auto">
            <div className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] p-6 max-w-2xl w-full">
              <h3 className="text-xl font-bold text-[#c0c0c0] mb-4">
                {lang === 'ru' ? 'Создать торговый профиль' : 'Create Trading Profile'}
              </h3>
              
              <div className="space-y-4">
                <Input
                  placeholder={lang === 'ru' ? 'Название профиля' : 'Profile name'}
                  className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
                  id="new-profile-name"
                />

                <div className="grid grid-cols-2 gap-3">
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

                  <Button
                    onClick={() => {
                      const name = document.getElementById('new-profile-name').value.trim();
                      if (!name) {
                        toast.error(lang === 'ru' ? 'Введите название' : 'Enter a name');
                        return;
                      }
                      createProfileMutation.mutate({
                        profile_name: name,
                        is_active: profiles.length === 0,
                      });
                    }}
                    className="w-full bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 border border-violet-500/50"
                  >
                    {lang === 'ru' ? 'Создать без фото' : 'Create without photo'}
                  </Button>
                </div>

                {generatedImages.length > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    {generatedImages.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          const name = document.getElementById('new-profile-name').value.trim();
                          if (!name) {
                            toast.error(lang === 'ru' ? 'Введите название' : 'Enter a name');
                            return;
                          }
                          createProfileMutation.mutate({
                            profile_name: name,
                            profile_image: img,
                            is_active: profiles.length === 0,
                          });
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

    </div>
  );
};

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [lang, setLang] = useState(localStorage.getItem('tradingpro_lang') || 'ru');
  const [activeTab, setActiveTab] = useState('main');
  const [expandedSubscription, setExpandedSubscription] = useState(false);
  const [expandedExchanges, setExpandedExchanges] = useState(false);
  const [expandedNotifications, setExpandedNotifications] = useState(false);
  const [expandedTemplates, setExpandedTemplates] = useState(false);
  const [showBybitModal, setShowBybitModal] = useState(false);
  const [bybitForm, setBybitForm] = useState({ api_key: '', api_secret: '' });
  const [connecting, setConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
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

  useEffect(() => {
    const handleLanguageChange = () => {
      setLang(localStorage.getItem('tradingpro_lang') || 'ru');
    };

    window.addEventListener('languagechange', handleLanguageChange);
    return () => window.removeEventListener('languagechange', handleLanguageChange);
  }, []);

  const changeLanguage = (newLanguage) => {
    if (newLanguage === lang) return;
    localStorage.setItem('tradingpro_lang', newLanguage);
    window.dispatchEvent(new Event('languagechange'));
  };

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

  const { data: apiSettings = [] } = useQuery({
    queryKey: ['apiSettings', activeProfile?.id],
    queryFn: async () => {
      if (!activeProfile || !user) return [];
      return base44.entities.ApiSettings.filter({ 
        created_by: user.email,
        profile_id: activeProfile.id 
      });
    },
    enabled: !!activeProfile && !!user,
    staleTime: 10 * 60 * 1000,
    cacheTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const currentBybitSettings = apiSettings[0];
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

  const handleConnectBybit = async () => {
    if (!bybitForm.api_key || !bybitForm.api_secret) {
      toast.error(lang === 'ru' ? 'Введите оба ключа' : 'Enter both API Key and Secret');
      return;
    }

    if (!activeProfile) {
      toast.error(lang === 'ru' ? 'Нет активного профиля' : 'No active profile found');
      return;
    }

    setConnecting(true);
    setConnectionStatus(null);

    try {
      const { data } = await base44.functions.invoke('connectBybit', {
        apiKey: bybitForm.api_key,
        apiSecret: bybitForm.api_secret,
        environment: 'mainnet'
      });

      console.log('[Settings] Bybit connection response:', data);
      setConnectionStatus(data);

      if (data.ok && data.connected) {
        toast.success(data.message, { duration: 4000 });
        setBybitForm({ api_key: '', api_secret: '' });
        setTimeout(() => {
          setShowBybitModal(false);
          queryClient.invalidateQueries(['apiSettings']);
        }, 1500);
      } else {
        toast.error(data.message, { duration: 8000 });
      }
    } catch (error) {
      console.error('[Settings] Bybit connection error:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
      setConnectionStatus({
        ok: false,
        connected: false,
        message: errorMsg,
        errorCode: 'UNEXPECTED_ERROR',
        nextStep: lang === 'ru' ? 'Попробуйте снова или обратитесь в поддержку' : 'Try again or contact support',
        checkedAt: new Date().toISOString()
      });
      toast.error(errorMsg, { duration: 8000 });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnectBybit = async () => {
    if (!currentBybitSettings) return;
    
    try {
      await base44.entities.ApiSettings.update(currentBybitSettings.id, { 
        is_active: false,
        last_sync: new Date().toISOString()
      });
      queryClient.invalidateQueries(['apiSettings']);
      setConnectionStatus(null);
      toast.success(lang === 'ru' ? 'Отключено' : 'Disconnected');
    } catch (error) {
      toast.error(lang === 'ru' ? 'Ошибка отключения' : 'Failed to disconnect');
    }
  };

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

  const memoizedProfilesSection = useMemo(() => (
    <ProfilesSection 
      lang={lang}
      profiles={profiles}
      user={user}
      activeProfile={activeProfile}
      allTrades={allTrades}
      showUserImagePicker={showUserImagePicker}
      setShowUserImagePicker={setShowUserImagePicker}
      showProfileImagePicker={showProfileImagePicker}
      setShowProfileImagePicker={setShowProfileImagePicker}
      generatingImages={generatingImages}
      setGeneratingImages={setGeneratingImages}
      generatedImages={generatedImages}
      setGeneratedImages={setGeneratedImages}
      editingName={editingName}
      setEditingName={setEditingName}
      newName={newName}
      setNewName={setNewName}
      updateUserMutation={updateUserMutation}
      createProfileMutation={createProfileMutation}
      switchProfileMutation={switchProfileMutation}
      deleteProfileMutation={deleteProfileMutation}
      generateImages={generateImages}
      uploadUserImage={uploadUserImage}
      getProfileStats={getProfileStats}
      handleScroll={handleScroll}
    />
  ), [lang, profiles, user, allTrades, showUserImagePicker, showProfileImagePicker, generatingImages, generatedImages, editingName, newName]);

  return (
    <div className="max-w-6xl mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
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
          <TimezoneSettings compact={true} />

          <div className="flex gap-1 bg-[#1a1a1a] rounded-lg p-1 border border-[#2a2a2a]">
            <button
              onClick={() => {
                changeLanguage('ru');
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
                changeLanguage('en');
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

      {/* Static Profiles Section */}
      {memoizedProfilesSection}

      {/* Tab Navigation + Content Panel - Connected */}
      <div>
        {/* Tab Navigation */}
        <div className="flex gap-2 bg-[#0d0d0d] rounded-t-xl p-1.5 border border-[#2a2a2a] border-b-0">
          <button
            onClick={() => setActiveTab('main')}
            className={cn(
              "flex-1 px-4 py-2.5 rounded-lg font-medium text-sm border border-transparent transition-[background-color,color] focus:outline-none focus-visible:outline-none",
              activeTab === 'main'
                ? "bg-gradient-to-r from-violet-500/20 to-purple-500/20 text-violet-400 border-violet-500/30"
                : "text-[#666] hover:text-[#c0c0c0] hover:bg-[#0d0d0d]"
            )}
          >
            <SettingsIcon className="w-4 h-4 inline mr-2" />
            {lang === 'ru' ? 'Основное' : 'Main'}
          </button>
          <button
            onClick={() => setActiveTab('risk')}
            className={cn(
              "flex-1 px-4 py-2.5 rounded-lg font-medium text-sm border border-transparent transition-[background-color,color] focus:outline-none focus-visible:outline-none",
              activeTab === 'risk'
                ? "bg-gradient-to-r from-red-500/20 to-orange-500/20 text-red-400 border-red-500/30"
                : "text-[#666] hover:text-[#c0c0c0] hover:bg-[#0d0d0d]"
            )}
          >
            <Shield className="w-4 h-4 inline mr-2" />
            {lang === 'ru' ? 'Риск' : 'Risk'}
          </button>
          <button
            onClick={() => setActiveTab('focus')}
            className={cn(
              "flex-1 px-4 py-2.5 rounded-lg font-medium text-sm border border-transparent transition-[background-color,color] focus:outline-none focus-visible:outline-none",
              activeTab === 'focus'
                ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border-cyan-500/30"
                : "text-[#666] hover:text-[#c0c0c0] hover:bg-[#0d0d0d]"
            )}
          >
            <Target className="w-4 h-4 inline mr-2" />
            {lang === 'ru' ? 'Фокус' : 'Focus'}
          </button>
        </div>

        {/* Content Panel */}
        <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-b-xl border-t-0 p-6 min-h-[400px]">
        {activeTab === 'main' && (
          <div className="space-y-6">
            {/* Subscription Plan */}
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

            {/* Account Setup */}
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

            {/* Exchange Integration */}
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
                <div className="px-6 pb-6 pt-2 space-y-4">
                  {/* Bybit Status */}
                  {currentBybitSettings?.is_active && (
                    <div className="bg-[#0d0d0d] border border-emerald-500/30 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="w-6 h-6 text-emerald-400" />
                          <div>
                            <p className="text-emerald-400 font-medium">Bybit {lang === 'ru' ? 'подключен' : 'Connected'}</p>
                            {currentBybitSettings.last_sync && (
                              <p className="text-[#666] text-xs">
                                {lang === 'ru' ? 'Проверено' : 'Checked'}: {new Date(currentBybitSettings.last_sync).toLocaleString('ru-RU', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button 
                          size="sm"
                          variant="outline"
                          onClick={handleDisconnectBybit}
                          className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                        >
                          {lang === 'ru' ? 'Отключить' : 'Disconnect'}
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {EXCHANGES.map((exchange) => (
                      <button
                        key={exchange.id}
                        onClick={() => {
                          if (exchange.id === 'bybit') {
                            setShowBybitModal(true);
                          } else {
                            toast.info(lang === 'ru' ? 'Функция в разработке' : 'Feature in development');
                          }
                        }}
                        className="relative rounded-xl border-2 border-[#2a2a2a] p-6 hover:border-[#3a3a3a] transition-all group bg-[#111]"
                      >
                        {exchange.id === 'bybit' && currentBybitSettings?.is_active && (
                          <div className="absolute top-2 right-2">
                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                          </div>
                        )}
                        <div className={cn("w-12 h-12 rounded-lg bg-gradient-to-br mb-3 mx-auto flex items-center justify-center text-2xl", exchange.color)}>
                          {exchange.logo}
                        </div>
                        <p className="text-[#c0c0c0] font-medium text-center">{exchange.name}</p>
                        <p className="text-[#666] text-xs text-center mt-1">
                          {exchange.id === 'bybit' && currentBybitSettings?.is_active
                            ? (lang === 'ru' ? 'Настроить' : 'Configure')
                            : (lang === 'ru' ? 'Подключить' : 'Connect')
                          }
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Notification Settings */}
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

            {/* Templates */}
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

            {/* Customization & Referral */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          </div>
        )}

        {activeTab === 'risk' && (
          <RiskSettingsForm />
        )}

        {activeTab === 'focus' && (
          <FocusSettings />
        )}
        </div>
      </div>

      {/* Bybit Connection Modal */}
      <Dialog open={showBybitModal} onOpenChange={setShowBybitModal}>
        <DialogContent className="bg-[#1a1a1a] border-[#333] max-w-md [&>button]:text-white [&>button]:hover:text-white">
          <DialogHeader>
            <DialogTitle className="text-[#c0c0c0] text-xl flex items-center gap-2">
              <Plug className="w-5 h-5" />
              {lang === 'ru' ? 'Подключение Bybit' : 'Connect Bybit'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Warning */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-200">
              <p className="font-medium mb-1">{lang === 'ru' ? '⚠️ Важно:' : '⚠️ Important:'}</p>
              <p className="text-xs">
                {lang === 'ru' 
                  ? 'Используйте API ключ только с правами Read-Only. Никогда не давайте права на торговлю или вывод средств.'
                  : 'Use API key with Read-Only permissions only. Never grant trading or withdrawal permissions.'
                }
              </p>
            </div>

            {/* API Key */}
            <div>
              <Label className="text-[#888] text-sm mb-2 block">
                {lang === 'ru' ? 'API Ключ' : 'API Key'}
              </Label>
              <Input
                type="password"
                value={bybitForm.api_key}
                onChange={(e) => setBybitForm({...bybitForm, api_key: e.target.value})}
                placeholder={lang === 'ru' ? 'Введите API Key' : 'Enter API Key'}
                className="bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
              />
            </div>

            {/* API Secret */}
            <div>
              <Label className="text-[#888] text-sm mb-2 block">
                {lang === 'ru' ? 'API Секрет' : 'API Secret'}
              </Label>
              <Input
                type="password"
                value={bybitForm.api_secret}
                onChange={(e) => setBybitForm({...bybitForm, api_secret: e.target.value})}
                placeholder={lang === 'ru' ? 'Введите API Secret' : 'Enter API Secret'}
                className="bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
              />
            </div>

            {/* Connection Status */}
            {connectionStatus && (
              <div className={cn(
                "p-3 rounded-lg border text-xs",
                connectionStatus.ok 
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : "bg-red-500/10 border-red-500/30"
              )}>
                <p className={cn("font-medium", connectionStatus.ok ? "text-emerald-400" : "text-red-400")}>
                  {connectionStatus.message}
                </p>
                {connectionStatus.nextStep && (
                  <p className="text-[#888] mt-1">→ {connectionStatus.nextStep}</p>
                )}
              </div>
            )}

            {/* Connect Button */}
            <Button
              onClick={handleConnectBybit}
              disabled={!bybitForm.api_key || !bybitForm.api_secret || connecting}
              className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black font-semibold h-11"
            >
              {connecting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  {lang === 'ru' ? 'Подключение...' : 'Connecting...'}
                </>
              ) : (
                <>
                  <Plug className="w-4 h-4 mr-2" />
                  {lang === 'ru' ? 'Подключить' : 'Connect'}
                </>
              )}
            </Button>

            {/* Instructions */}
            <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3 text-xs text-[#888] space-y-1">
              <p className="text-[#c0c0c0] font-medium mb-2">
                {lang === 'ru' ? 'Как получить API ключи:' : 'How to get API keys:'}
              </p>
              <p>1. {lang === 'ru' ? 'Войдите в Bybit' : 'Log in to Bybit'}</p>
              <p>2. {lang === 'ru' ? 'Профиль → API Management' : 'Profile → API Management'}</p>
              <p>3. {lang === 'ru' ? 'Создайте новый API ключ' : 'Create new API key'}</p>
              <p>4. {lang === 'ru' ? 'Выберите: Read Only' : 'Select: Read Only'}</p>
              <p>5. {lang === 'ru' ? 'Скопируйте ключи сюда' : 'Copy keys here'}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Support & Social - Always at bottom */}
      <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-2xl border-2 border-[#2a2a2a] p-6">
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