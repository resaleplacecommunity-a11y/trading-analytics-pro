import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Settings as SettingsIcon, 
  User, 
  Crown, 
  Upload, 
  Plus,
  Bell,
  Link2,
  Mail,
  Lock,
  HelpCircle,
  Instagram,
  MessageCircle,
  DollarSign,
  TrendingUp,
  Palette
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PLAN_BENEFITS = {
  NORMIS: ['Базовая аналитика', 'До 100 сделок/месяц', 'Стандартная поддержка'],
  BOSS: ['Расширенная аналитика', 'До 500 сделок/месяц', 'AI ассистент', 'Приоритетная поддержка'],
  GOD: ['Безлимитные сделки', 'Полный AI функционал', 'VIP поддержка', 'Ранний доступ к фичам']
};

const PROFILE_IMAGES = [
  'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=200',
  'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=200',
  'https://images.unsplash.com/photo-1642790595397-7047dc98fa72?w=200',
  'https://images.unsplash.com/photo-1535320903710-d993d3d77d29?w=200',
  'https://images.unsplash.com/photo-1642543348745-03609c6e9223?w=200',
  'https://images.unsplash.com/photo-1605792657660-596af9009e82?w=200'
];

const EXCHANGES = [
  { id: 'bybit', name: 'Bybit', color: 'from-amber-500 to-orange-500' },
  { id: 'binance', name: 'Binance', color: 'from-yellow-500 to-amber-500' },
  { id: 'bingx', name: 'BingX', color: 'from-blue-500 to-cyan-500' },
  { id: 'okx', name: 'OKX', color: 'from-slate-500 to-gray-500' },
  { id: 'mexc', name: 'MEXC', color: 'from-emerald-500 to-green-500' },
  { id: 'bitget', name: 'Bitget', color: 'from-indigo-500 to-purple-500' }
];

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [selectedImage, setSelectedImage] = useState(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
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

  const updateSettingsMutation = useMutation({
    mutationFn: (data) => {
      if (settings?.id) {
        return base44.entities.NotificationSettings.update(settings.id, data);
      }
      return base44.entities.NotificationSettings.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['notificationSettings']);
      toast.success(lang === 'ru' ? 'Настройки сохранены' : 'Settings saved');
    },
  });

  const createProfileMutation = useMutation({
    mutationFn: (data) => base44.entities.UserProfile.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['userProfiles']);
      setShowImagePicker(false);
      toast.success(lang === 'ru' ? 'Профиль создан' : 'Profile created');
    },
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
          <SettingsIcon className="w-6 h-6 text-violet-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-[#c0c0c0]">
            {lang === 'ru' ? 'Настройки' : 'Settings'}
          </h1>
          <p className="text-[#666] text-sm">
            {lang === 'ru' ? 'Управление аккаунтом и приложением' : 'Manage your account and app'}
          </p>
        </div>
      </div>

      {/* User Profile */}
      <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-2xl border-2 border-[#2a2a2a] p-6">
        <div className="flex items-center gap-4 mb-6">
          <User className="w-5 h-5 text-cyan-400" />
          <h2 className="text-xl font-bold text-[#c0c0c0]">
            {lang === 'ru' ? 'Профиль пользователя' : 'User Profile'}
          </h2>
        </div>

        <div className="flex items-start gap-6">
          <div className="relative group">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border-2 border-violet-500/30 flex items-center justify-center overflow-hidden">
              {user?.profile_image ? (
                <img src={user.profile_image} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-violet-400" />
              )}
            </div>
            <button className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Upload className="w-6 h-6 text-white" />
            </button>
          </div>

          <div className="flex-1 space-y-4">
            <div>
              <Label className="text-[#888] text-xs mb-2">
                {lang === 'ru' ? 'Полное имя' : 'Full Name'}
              </Label>
              <Input 
                value={user?.full_name || ''} 
                readOnly
                className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]" 
              />
            </div>
            <div>
              <Label className="text-[#888] text-xs mb-2">
                {lang === 'ru' ? 'Email' : 'Email'}
              </Label>
              <Input 
                value={user?.email || ''} 
                readOnly
                className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]" 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Plan */}
      <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-2xl border-2 border-[#2a2a2a] p-6">
        <div className="flex items-center gap-4 mb-6">
          <Crown className="w-5 h-5 text-amber-400" />
          <h2 className="text-xl font-bold text-[#c0c0c0]">
            {lang === 'ru' ? 'Тарифный план' : 'Subscription Plan'}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['NORMIS', 'BOSS', 'GOD'].map((plan) => (
            <div
              key={plan}
              className={cn(
                "relative rounded-xl border-2 p-6 transition-all cursor-pointer",
                currentPlan.plan_type === plan
                  ? plan === 'GOD' 
                    ? "bg-gradient-to-br from-purple-500/20 to-violet-500/20 border-purple-500/50"
                    : plan === 'BOSS'
                    ? "bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-500/50"
                    : "bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-cyan-500/50"
                  : "bg-[#111] border-[#2a2a2a] hover:border-[#3a3a3a]"
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
                {PLAN_BENEFITS[plan].map((benefit, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-emerald-400">•</span>
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>

              {currentPlan.plan_type !== plan && (
                <Button className="w-full mt-4 bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 border border-violet-500/50">
                  {lang === 'ru' ? 'Выбрать' : 'Select'}
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Trading Profiles */}
      <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-2xl border-2 border-[#2a2a2a] p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-bold text-[#c0c0c0]">
              {lang === 'ru' ? 'Торговые профили' : 'Trading Profiles'}
            </h2>
          </div>
          <Button
            onClick={() => setShowImagePicker(true)}
            size="sm"
            className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/50"
          >
            <Plus className="w-4 h-4 mr-2" />
            {lang === 'ru' ? 'Добавить' : 'Add'}
          </Button>
        </div>

        {showImagePicker && (
          <div className="mb-6 p-4 bg-[#111] rounded-xl border border-[#2a2a2a]">
            <Label className="text-[#888] text-sm mb-3 block">
              {lang === 'ru' ? 'Выберите аватар профиля' : 'Choose profile avatar'}
            </Label>
            <div className="grid grid-cols-6 gap-3 mb-4">
              {PROFILE_IMAGES.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(img)}
                  className={cn(
                    "w-16 h-16 rounded-lg overflow-hidden border-2 transition-all",
                    selectedImage === img ? "border-violet-500 scale-110" : "border-[#2a2a2a] hover:border-[#3a3a3a]"
                  )}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
            <Input
              placeholder={lang === 'ru' ? 'Название профиля' : 'Profile name'}
              className="bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0] mb-3"
              id="profile-name"
            />
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  const name = document.getElementById('profile-name').value;
                  if (!name) {
                    toast.error(lang === 'ru' ? 'Введите название' : 'Enter name');
                    return;
                  }
                  createProfileMutation.mutate({
                    profile_name: name,
                    profile_image: selectedImage || PROFILE_IMAGES[0],
                    is_active: profiles.length === 0
                  });
                }}
                className="flex-1 bg-violet-500 hover:bg-violet-600"
              >
                {lang === 'ru' ? 'Создать' : 'Create'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowImagePicker(false)}
                className="bg-[#111] border-[#2a2a2a]"
              >
                {lang === 'ru' ? 'Отмена' : 'Cancel'}
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className={cn(
                "relative rounded-xl border-2 p-4 transition-all cursor-pointer",
                profile.is_active
                  ? "bg-violet-500/20 border-violet-500/50"
                  : "bg-[#111] border-[#2a2a2a] hover:border-[#3a3a3a]"
              )}
            >
              <div className="w-12 h-12 rounded-lg overflow-hidden mb-2 border-2 border-[#2a2a2a]">
                <img src={profile.profile_image} alt="" className="w-full h-full object-cover" />
              </div>
              <p className="text-[#c0c0c0] font-medium text-sm truncate">{profile.profile_name}</p>
              {profile.is_active && (
                <span className="text-xs text-violet-400 mt-1 block">
                  {lang === 'ru' ? 'Активный' : 'Active'}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Exchange Integration */}
      <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-2xl border-2 border-[#2a2a2a] p-6">
        <div className="flex items-center gap-4 mb-6">
          <Link2 className="w-5 h-5 text-blue-400" />
          <h2 className="text-xl font-bold text-[#c0c0c0]">
            {lang === 'ru' ? 'Интеграция с биржами' : 'Exchange Integration'}
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {EXCHANGES.map((exchange) => (
            <button
              key={exchange.id}
              className="relative rounded-xl border-2 border-[#2a2a2a] p-6 hover:border-[#3a3a3a] transition-all group bg-[#111]"
            >
              <div className={cn("w-12 h-12 rounded-lg bg-gradient-to-br mb-3 mx-auto", exchange.color)} />
              <p className="text-[#c0c0c0] font-medium text-center">{exchange.name}</p>
              <p className="text-[#666] text-xs text-center mt-1">
                {lang === 'ru' ? 'Нажмите для подключения' : 'Click to connect'}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Trading Settings */}
      <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-2xl border-2 border-[#2a2a2a] p-6">
        <div className="flex items-center gap-4 mb-6">
          <DollarSign className="w-5 h-5 text-emerald-400" />
          <h2 className="text-xl font-bold text-[#c0c0c0]">
            {lang === 'ru' ? 'Торговые настройки' : 'Trading Settings'}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label className="text-[#888] text-xs mb-2">
              {lang === 'ru' ? 'Стартовый баланс ($)' : 'Starting Balance ($)'}
            </Label>
            <Input
              type="number"
              placeholder="10000"
              className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
            />
          </div>

          <div>
            <Label className="text-[#888] text-xs mb-2">
              {lang === 'ru' ? 'Комиссия на открытие (%)' : 'Open Commission (%)'}
            </Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.05"
              defaultValue="0.05"
              className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
            />
          </div>

          <div>
            <Label className="text-[#888] text-xs mb-2">
              {lang === 'ru' ? 'Комиссия на закрытие (%)' : 'Close Commission (%)'}
            </Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.05"
              defaultValue="0.05"
              className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
            />
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-2xl border-2 border-[#2a2a2a] p-6">
        <div className="flex items-center gap-4 mb-6">
          <Bell className="w-5 h-5 text-violet-400" />
          <h2 className="text-xl font-bold text-[#c0c0c0]">
            {lang === 'ru' ? 'Настройки уведомлений' : 'Notification Settings'}
          </h2>
        </div>

        <div className="space-y-4">
          {[
            { key: 'incomplete_trade_enabled', label: lang === 'ru' ? 'Незаполненные сделки' : 'Incomplete trades' },
            { key: 'risk_violation_enabled', label: lang === 'ru' ? 'Нарушение рисков' : 'Risk violations' },
            { key: 'goal_achieved_enabled', label: lang === 'ru' ? 'Достижение целей' : 'Goals achieved' },
            { key: 'market_outlook_enabled', label: lang === 'ru' ? 'Незаполненный прогноз' : 'Missing market outlook' },
            { key: 'sound_enabled', label: lang === 'ru' ? 'Звуковые уведомления' : 'Sound notifications' },
            { key: 'email_notifications', label: lang === 'ru' ? 'Email уведомления' : 'Email notifications' }
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between p-4 bg-[#111] rounded-lg border border-[#2a2a2a]">
              <span className="text-[#c0c0c0]">{label}</span>
              <Switch
                checked={settings?.[key] ?? true}
                onCheckedChange={(checked) => {
                  updateSettingsMutation.mutate({
                    ...settings,
                    [key]: checked
                  });
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Account Security */}
      <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-2xl border-2 border-[#2a2a2a] p-6">
        <div className="flex items-center gap-4 mb-6">
          <Lock className="w-5 h-5 text-red-400" />
          <h2 className="text-xl font-bold text-[#c0c0c0]">
            {lang === 'ru' ? 'Безопасность' : 'Security'}
          </h2>
        </div>

        <div className="space-y-3">
          <Button variant="outline" className="w-full justify-start bg-[#111] border-[#2a2a2a] text-[#888]">
            <Mail className="w-4 h-4 mr-2" />
            {lang === 'ru' ? 'Изменить email' : 'Change email'}
          </Button>
          <Button variant="outline" className="w-full justify-start bg-[#111] border-[#2a2a2a] text-[#888]">
            <Lock className="w-4 h-4 mr-2" />
            {lang === 'ru' ? 'Изменить пароль' : 'Change password'}
          </Button>
        </div>
      </div>

      {/* Customization */}
      <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-2xl border-2 border-violet-500/30 p-6">
        <div className="flex items-center gap-4 mb-4">
          <Palette className="w-5 h-5 text-violet-400" />
          <h2 className="text-xl font-bold text-[#c0c0c0]">
            {lang === 'ru' ? 'Кастомизация страниц' : 'Page Customization'}
          </h2>
        </div>
        <p className="text-[#666] text-sm mb-4">
          {lang === 'ru' 
            ? 'Настройте отображение страниц под себя. Скоро добавим эту функцию!'
            : 'Customize page layouts for your needs. Coming soon!'
          }
        </p>
        <Button disabled className="bg-violet-500/20 text-violet-400 border border-violet-500/50">
          {lang === 'ru' ? 'Скоро' : 'Coming Soon'}
        </Button>
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
          <Button variant="outline" className="bg-[#111] border-[#2a2a2a] hover:border-cyan-500/50">
            <MessageCircle className="w-4 h-4 mr-2" />
            Telegram
          </Button>
          <Button variant="outline" className="bg-[#111] border-[#2a2a2a] hover:border-pink-500/50">
            <Instagram className="w-4 h-4 mr-2" />
            Instagram
          </Button>
          <Button variant="outline" className="bg-[#111] border-[#2a2a2a] hover:border-blue-500/50">
            X
          </Button>
          <Button variant="outline" className="bg-[#111] border-[#2a2a2a] hover:border-emerald-500/50">
            <Mail className="w-4 h-4 mr-2" />
            Email
          </Button>
        </div>
      </div>
    </div>
  );
}