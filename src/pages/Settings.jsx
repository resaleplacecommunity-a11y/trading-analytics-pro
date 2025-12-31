import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
  Trash2,
  LogOut,
  Palette,
  Gift,
  List
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  const [expandedSubscription, setExpandedSubscription] = useState(false);
  const [expandedExchanges, setExpandedExchanges] = useState(false);
  const [expandedNotifications, setExpandedNotifications] = useState(false);
  const [showUserImagePicker, setShowUserImagePicker] = useState(false);
  const [showProfileImagePicker, setShowProfileImagePicker] = useState(false);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [strategyTemplates, setStrategyTemplates] = useState([]);
  const [entryReasonTemplates, setEntryReasonTemplates] = useState([]);
  const lang = localStorage.getItem('tradingpro_lang') || 'ru';

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['userProfiles'],
    queryFn: () => base44.entities.UserProfile.list('-created_date', 10),
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => base44.entities.SubscriptionPlan.list('-created_date', 1),
  });

  const { data: notificationSettings = [] } = useQuery({
    queryKey: ['notificationSettings'],
    queryFn: () => base44.entities.NotificationSettings.list('-created_date', 1),
  });

  const currentPlan = subscriptions[0] || { plan_type: 'NORMIS' };
  const settings = notificationSettings[0];
  const activeProfile = profiles.find(p => p.is_active) || profiles[0];

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
    mutationFn: (data) => base44.entities.UserProfile.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['userProfiles']);
      setShowProfileImagePicker(false);
      setGeneratedImages([]);
      toast.success(lang === 'ru' ? 'Профиль создан' : 'Profile created');
    },
  });

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
      toast.success(lang === 'ru' ? 'Профиль переключён' : 'Profile switched');
    },
  });

  const deleteProfileMutation = useMutation({
    mutationFn: (profileId) => base44.entities.UserProfile.delete(profileId),
    onSuccess: () => {
      queryClient.invalidateQueries(['userProfiles']);
      toast.success(lang === 'ru' ? 'Профиль удалён' : 'Profile deleted');
    },
  });

  const generateImages = async () => {
    setGeneratingImages(true);
    try {
      const promises = Array(6).fill(null).map(() => 
        base44.integrations.Core.GenerateImage({
          prompt: "minimalist flat icon avatar, simple geometric shapes, professional trader symbol, clean modern design, monochromatic with green accent, abstract minimal, 2D flat design"
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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
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

      {/* User Profile & Trading Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Profile */}
        <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-2xl border-2 border-cyan-500/30 p-6">
          <div className="flex items-center gap-3 mb-6">
            <User className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-[#c0c0c0]">
              {lang === 'ru' ? 'Профиль пользователя' : 'User Profile'}
            </h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative group cursor-pointer" onClick={() => setShowUserImagePicker(true)}>
                <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border-2 border-violet-500/30 flex items-center justify-center overflow-hidden">
                  {user?.profile_image ? (
                    <img src={user.profile_image} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-10 h-10 text-violet-400" />
                  )}
                </div>
                <div className="absolute inset-0 bg-black/60 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Upload className="w-5 h-5 text-white" />
                </div>
              </div>

              <div className="flex-1 space-y-2">
                <div>
                  <Label className="text-[#888] text-xs">{lang === 'ru' ? 'Имя' : 'Name'}</Label>
                  {editingName ? (
                    <div className="flex gap-2 mt-1">
                      <Input 
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] h-8 text-sm" 
                      />
                      <Button size="sm" onClick={() => updateUserMutation.mutate({ full_name: newName })} className="h-8 px-2 bg-emerald-500 hover:bg-emerald-600">
                        <Check className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingName(false)} className="h-8 px-2 bg-[#111] border-[#2a2a2a]">
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <div 
                      onClick={() => { setEditingName(true); setNewName(user?.full_name || ''); }}
                      className="flex items-center gap-2 cursor-pointer group/name mt-1"
                    >
                      <div className="flex-1 bg-[#111] border border-[#2a2a2a] rounded-md px-3 py-1.5 text-[#c0c0c0] text-sm">
                        {user?.full_name || '—'}
                      </div>
                      <Edit2 className="w-3 h-3 text-[#666] group-hover/name:text-cyan-400 transition-colors" />
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-[#888] text-xs">{lang === 'ru' ? 'Email' : 'Email'}</Label>
                  <div className="flex-1 bg-[#111] border border-[#2a2a2a] rounded-md px-3 py-1.5 text-[#888] text-sm mt-1">
                    {user?.email || '—'}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <Button 
                variant="outline" 
                size="sm"
                className="w-full justify-start bg-[#111] border-[#2a2a2a] text-[#c0c0c0] hover:bg-[#1a1a1a] h-9"
                onClick={() => toast.info(lang === 'ru' ? 'Функция в разработке' : 'Feature in development')}
              >
                <Lock className="w-4 h-4 mr-2" />
                {lang === 'ru' ? 'Изменить пароль' : 'Change password'}
              </Button>

              <Button 
                variant="outline" 
                size="sm"
                className="w-full justify-start bg-red-500/10 border-red-500/50 text-red-400 hover:bg-red-500/20 h-9"
                onClick={() => base44.auth.logout('/')}
              >
                <LogOut className="w-4 h-4 mr-2" />
                {lang === 'ru' ? 'Выйти из аккаунта' : 'Log Out'}
              </Button>
            </div>
          </div>

          {/* User Image Picker Modal */}
          {showUserImagePicker && (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
              <div className="bg-[#1a1a1a] rounded-2xl border-2 border-[#2a2a2a] p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <h3 className="text-xl font-bold text-[#c0c0c0] mb-4">
                  {lang === 'ru' ? 'Выберите фото профиля' : 'Choose profile photo'}
                </h3>
                
                <div className="space-y-4">
                  <Button
                    onClick={() => document.getElementById('user-file-upload').click()}
                    className="w-full bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 border border-violet-500/50"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {lang === 'ru' ? 'Загрузить с компьютера' : 'Upload from computer'}
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
                      : (lang === 'ru' ? 'Сгенерировать AI аватары' : 'Generate AI avatars')
                    }
                  </Button>

                  {generatedImages.length > 0 && (
                    <div className="grid grid-cols-3 gap-3 mt-4">
                      {generatedImages.map((img, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            updateUserMutation.mutate({ profile_image: img });
                            setShowUserImagePicker(false);
                            setGeneratedImages([]);
                          }}
                          className="aspect-square rounded-lg overflow-hidden border-2 border-[#2a2a2a] hover:border-violet-500/50 transition-all"
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
        <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-2xl border-2 border-emerald-500/30 p-6">
          <div className="flex items-center justify-between mb-6">
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

          {activeProfile ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border-2 border-emerald-500/30 rounded-xl">
                <div className="w-14 h-14 rounded-lg overflow-hidden border-2 border-emerald-500/50">
                  <img src={activeProfile.profile_image} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <p className="text-[#c0c0c0] font-bold">{activeProfile.profile_name}</p>
                  <p className="text-emerald-400 text-xs font-medium">{lang === 'ru' ? 'Активный профиль' : 'Active profile'}</p>
                </div>
              </div>

              {profiles.length > 1 && (
                <div className="space-y-2">
                  <Label className="text-[#888] text-xs">
                    {lang === 'ru' ? 'Другие профили:' : 'Other profiles:'}
                  </Label>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {profiles.filter(p => !p.is_active).map((profile) => (
                      <div key={profile.id} className="relative group flex-shrink-0">
                        <button
                          onClick={() => switchProfileMutation.mutate(profile.id)}
                          className="w-20 p-2 rounded-lg bg-[#111] border border-[#2a2a2a] hover:border-emerald-500/50 transition-all"
                        >
                          <div className="w-full aspect-square rounded-lg overflow-hidden mb-1">
                            <img src={profile.profile_image} alt="" className="w-full h-full object-cover" />
                          </div>
                          <p className="text-[#888] text-xs truncate">{profile.profile_name}</p>
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(lang === 'ru' ? 'Удалить профиль?' : 'Delete profile?')) {
                              deleteProfileMutation.mutate(profile.id);
                            }
                          }}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[#666] text-sm text-center py-8">
              {lang === 'ru' ? 'Создайте свой первый торговый профиль' : 'Create your first trading profile'}
            </p>
          )}

          {/* Profile Image Picker Modal */}
          {showProfileImagePicker && (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
              <div className="bg-[#1a1a1a] rounded-2xl border-2 border-[#2a2a2a] p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <h3 className="text-xl font-bold text-[#c0c0c0] mb-4">
                  {lang === 'ru' ? 'Создать торговый профиль' : 'Create trading profile'}
                </h3>
                
                <Input
                  placeholder={lang === 'ru' ? 'Название профиля' : 'Profile name'}
                  className="bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0] mb-4"
                  id="profile-name-input"
                />

                <div className="space-y-4">
                  <Button
                    onClick={() => document.getElementById('profile-file-upload').click()}
                    className="w-full bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 border border-violet-500/50"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {lang === 'ru' ? 'Загрузить с компьютера' : 'Upload from computer'}
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
                      : (lang === 'ru' ? 'Сгенерировать AI аватары' : 'Generate AI avatars')
                    }
                  </Button>

                  {generatedImages.length > 0 && (
                    <div className="grid grid-cols-3 gap-3 mt-4">
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
                          className="aspect-square rounded-lg overflow-hidden border-2 border-[#2a2a2a] hover:border-emerald-500/50 transition-all"
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

      {/* Templates for Strategy and Entry Reason */}
      <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-2xl border-2 border-[#2a2a2a] p-6">
        <div className="flex items-center gap-3 mb-4">
          <List className="w-5 h-5 text-blue-400" />
          <h2 className="text-xl font-bold text-[#c0c0c0]">
            {lang === 'ru' ? 'Шаблоны для сделок' : 'Trade Templates'}
          </h2>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-[#888] text-xs mb-2 block">{lang === 'ru' ? 'Шаблоны стратегий' : 'Strategy Templates'}</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {strategyTemplates.map((template, index) => (
                <span key={index} className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                  {template}
                  <button onClick={() => setStrategyTemplates(strategyTemplates.filter((_, i) => i !== index))} className="text-blue-200 hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <Input 
              placeholder={lang === 'ru' ? 'Добавить стратегию (Enter для сохранения)' : 'Add strategy (Enter to save)'}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target.value.trim() !== '') {
                  setStrategyTemplates([...strategyTemplates, e.target.value.trim()]);
                  e.target.value = '';
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
                  <button onClick={() => setEntryReasonTemplates(entryReasonTemplates.filter((_, i) => i !== index))} className="text-green-200 hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <Input 
              placeholder={lang === 'ru' ? 'Добавить причину входа (Enter для сохранения)' : 'Add entry reason (Enter to save)'}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target.value.trim() !== '') {
                  setEntryReasonTemplates([...entryReasonTemplates, e.target.value.trim()]);
                  e.target.value = '';
                }
              }}
              className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] h-9"
            />
          </div>
        </div>
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

      {/* Support & Social */}
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