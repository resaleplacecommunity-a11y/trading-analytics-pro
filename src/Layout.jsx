import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import {
  LayoutDashboard,
  LineChart,
  Settings,
  TrendingUp,
  Menu,
  X,
  Zap,
  Bell,
  Check,
  ChevronDown,
  User } from
'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { cn } from "@/lib/utils";
import LanguageSwitcher from './components/LanguageSwitcher';
import WaveDotBackground from './components/WaveDotBackground';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import NotificationPanel from './components/NotificationPanel';
import NotificationToast from './components/NotificationToast';
import DailyReminderNotification from './components/DailyReminderNotification';
import TestNotificationsRunner from './components/TestNotificationsRunner';
import EnsureUserProfile from './components/EnsureUserProfile';
import AutoSyncManager from './components/AutoSyncManager';
import { toast } from 'sonner';

const useTranslation = () => {
  const [lang, setLang] = useState(localStorage.getItem('tradingpro_lang') || 'ru');
  useEffect(() => {
    const handleChange = () => setLang(localStorage.getItem('tradingpro_lang') || 'ru');
    window.addEventListener('languagechange', handleChange);
    return () => window.removeEventListener('languagechange', handleChange);
  }, []);
  const t = (key) => {
    const map = {
      ru: { dashboard: 'Дашборд', trades: 'Сделки', analyticsHub: 'Аналитика', terminal: 'Терминал', settings: 'Настройки', inProcess: 'В работе' },
      en: { dashboard: 'Dashboard', trades: 'Trades', analyticsHub: 'Analytics', terminal: 'Terminal', settings: 'Settings', inProcess: 'In Process' }
    };
    return map[lang]?.[key] || key;
  };
  return { t, lang };
};

// ── Compact profile pill for topbar ──────────────────────────────────────────
function TopBarProfile({ user, lang }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const queryClient = useQueryClient();

  const { data: profiles = [] } = useQuery({
    queryKey: ['userProfiles', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.UserProfile.filter({ created_by: user.email }, '-created_date', 50);
    },
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const activeProfile = profiles.find((p) => p.is_active) || profiles[0];

  const switchMutation = useMutation({
    mutationFn: async (profileId) => {
      const result = await base44.functions.invoke('enforceActiveProfile', { profileId });
      if (!result.data.success) throw new Error(result.data.error || 'Failed');
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['userProfiles', user?.email] });
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      setOpen(false);
      toast.success(lang === 'ru' ? `Профиль "${data.active_profile_name}" активирован` : `Profile "${data.active_profile_name}" activated`);
      setTimeout(() => window.location.reload(), 300);
    },
    onError: (e) => toast.error(e.message)
  });

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {if (ref.current && !ref.current.contains(e.target)) setOpen(false);};
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!activeProfile) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-2 h-9 px-3 rounded-lg border transition-all",
          open ?
          "bg-emerald-500/15 border-emerald-500/40 text-emerald-400" :
          "bg-[#1a1a1a] border-[#2a2a2a] hover:border-emerald-500/30 text-[#c0c0c0]"
        )}>

        {activeProfile.profile_image ?
        <img src={activeProfile.profile_image} alt="" className="w-5 h-5 rounded object-cover shrink-0" /> :

        <div className="w-5 h-5 rounded bg-emerald-500/20 flex items-center justify-center shrink-0">
            <User className="w-3 h-3 text-emerald-400" />
          </div>
        }
        <span className="text-sm font-medium max-w-[120px] truncate hidden sm:block">
          {activeProfile.profile_name}
        </span>
        <ChevronDown className={cn("w-3.5 h-3.5 shrink-0 transition-transform opacity-60", open && "rotate-180")} />
      </button>

      {open &&
      <div className="absolute top-full right-0 mt-2 bg-[#151515] border border-[#2a2a2a] rounded-xl shadow-2xl z-50 p-2" style={{ minWidth: '100%', width: 'max-content', maxWidth: '200px' }}>
          <p className="text-[#555] text-[10px] font-medium uppercase tracking-wider px-2 pb-2">
            {lang === 'ru' ? 'Профили' : 'Profiles'}
          </p>
          <div className="space-y-1 max-h-60 overflow-y-auto scrollbar-hide">
            {profiles.map((p) =>
          <button
            key={p.id}
            onClick={() => !p.is_active && switchMutation.mutate(p.id)}
            disabled={switchMutation.isPending}
            className={cn(
              "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all",
              p.is_active ?
              "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400" :
              "hover:bg-[#1e1e1e] text-[#aaa] border border-transparent"
            )}>

                {p.profile_image ?
            <img src={p.profile_image} alt="" className="w-7 h-7 rounded-md object-cover shrink-0" /> :

            <div className="w-7 h-7 rounded-md bg-[#2a2a2a] flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5 text-[#666]" />
                  </div>
            }
                <span className="text-sm font-medium truncate flex-1">{p.profile_name}</span>
                {p.is_active && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
          )}
          </div>
          <div className="border-t border-[#222] mt-2 pt-2">
            <Link
            to={createPageUrl('Settings')}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[#666] hover:text-[#aaa] hover:bg-[#1e1e1e] transition-all text-sm">

              <Settings className="w-3.5 h-3.5" />
              {lang === 'ru' ? 'Управление профилями' : 'Manage profiles'}
            </Link>
          </div>
        </div>
      }
    </div>);

}

export default function Layout({ children, currentPageName }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const { t, lang } = useTranslation();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 30 * 60 * 1000
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.Notification.filter({ created_by: user.email, is_closed: false }, '-created_date', 10);
    },
    enabled: !!user?.email,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const navItems = [
  { name: t('dashboard'), page: 'Dashboard', icon: LayoutDashboard },
  { name: t('trades'), page: 'Trades', icon: TrendingUp },
  { name: t('analyticsHub'), page: 'AnalyticsHub', icon: LineChart },
  { name: t('terminal'), page: 'Terminal', icon: Zap }];


  const devToolsEmails = ['resaleplacecommunity@gmail.com', 'roman.dev.ff@gmail.com'];
  if (user && devToolsEmails.includes(user.email)) {
    navItems.push({ name: '🔧 Dev', page: 'DevTools', icon: Zap });
  }

  // Shared square button style
  const squareBtn = "w-9 h-9 flex items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] hover:bg-[#222] hover:border-[#333] transition-all shrink-0";

  return (
    <EnsureUserProfile>
      <div className="min-h-screen bg-[#0a0a0a]">

        {/* ── TOP NAV BAR ─────────────────────────────────────────────── */}
        <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-white/10" style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(255,255,255,0.03) 100%)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          boxShadow: '0 4px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.2)'
        }}>
          <div className="flex items-center h-full px-4 gap-3 max-w-[1600px] mx-auto">

            {/* Logo — bigger, name TAP */}
            <Link to={createPageUrl('Dashboard')} className="flex items-center gap-0.5 shrink-0 mr-3">
              <img
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69349b30698117be30e537d8/b2ce75263_IMAGE2025-12-2922_38_16-Photoroom.png"
                alt="Logo"
                className="object-contain hidden sm:block"
                style={{ height: '52px', width: 'auto' }}
              />
              <span className="text-[#c0c0c0] font-extrabold text-xl tracking-wider hidden sm:block leading-none">
                TAP
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1 flex-1">
              {navItems.map((item) => {
                const isActive = currentPageName === item.page;
                return (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
                      isActive ?
                      "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25" :
                      "text-[#666] hover:text-[#aaa] hover:bg-[#1a1a1a]"
                    )}>

                    <span>{item.name}</span>
                  </Link>);

              })}

              <Link
                to={createPageUrl('InProcess')}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ml-1",
                  currentPageName === 'InProcess' ?
                  "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                  "text-[#555] hover:text-[#888] border border-[#222] hover:border-[#333]"
                )}>

                <Zap className="w-3 h-3" />
                {t('inProcess')}
              </Link>
            </nav>

            {/* ── Right side ── */}
            <div className="flex items-center gap-2 ml-auto shrink-0">

              {/* Active trading profile — not square, pill style */}
              {user && <TopBarProfile user={user} lang={lang} />}

              {/* Notifications — square */}
              <button
                onClick={() => setNotificationPanelOpen(true)}
                className={cn(squareBtn, "relative")}>

                <Bell style={{ width: '16px', height: '16px' }} className="text-[#888]" />
                {unreadCount > 0 &&
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-violet-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold animate-pulse">
                    {unreadCount}
                  </span>
                }
              </button>

              {/* Language — square wrapper */}
              <div className={squareBtn} style={{ padding: 0, overflow: 'hidden' }}>
                <LanguageSwitcher square />
              </div>

              {/* Settings — square */}
              <Link to={createPageUrl('Settings')} className={cn(squareBtn, currentPageName === 'Settings' && "bg-[#222] border-emerald-500/30")}>
                <Settings style={{ width: '16px', height: '16px' }} className={currentPageName === 'Settings' ? "text-emerald-400" : "text-[#888]"} />
              </Link>

              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className={cn(squareBtn, "md:hidden")}>

                {mobileMenuOpen ? <X className="w-4 h-4 text-[#c0c0c0]" /> : <Menu className="w-4 h-4 text-[#c0c0c0]" />}
              </button>
            </div>
          </div>
        </header>

        {/* ── MOBILE MENU ───────────────────────────────────────────────── */}
        {mobileMenuOpen &&
        <div className="fixed inset-0 z-40 pt-14 bg-[#0f0f0f]/98 backdrop-blur-xl md:hidden">
            <nav className="p-4 space-y-1">
              {navItems.map((item) => {
              const isActive = currentPageName === item.page;
              return (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3.5 rounded-xl text-base font-medium transition-colors",
                    isActive ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25" : "text-[#888] hover:bg-[#1a1a1a] hover:text-[#c0c0c0]"
                  )}>

                    <item.icon className="w-5 h-5" />
                    {item.name}
                  </Link>);

            })}
              <Link
              to={createPageUrl('InProcess')}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-base font-medium text-[#666] hover:bg-[#1a1a1a] hover:text-[#888] transition-colors">

                <Zap className="w-5 h-5" />
                {t('inProcess')}
              </Link>
              <Link
              to={createPageUrl('Settings')}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-base font-medium text-[#666] hover:bg-[#1a1a1a] hover:text-[#888] transition-colors">

                <Settings className="w-5 h-5" />
                {t('settings')}
              </Link>
            </nav>
          </div>
        }

        {/* ── BACKGROUND ────────────────────────────────────────────────── */}
        <WaveDotBackground />

        {/* ── MAIN CONTENT ──────────────────────────────────────────────── */}
        <main className="pt-14 min-h-screen relative z-10">
          <div className="p-4 lg:p-6">
            {children}
          </div>
        </main>

        <NotificationPanel open={notificationPanelOpen} onOpenChange={setNotificationPanelOpen} />
        <NotificationToast onOpenPanel={() => setNotificationPanelOpen(true)} />
        <DailyReminderNotification />
        <TestNotificationsRunner />
        <AutoSyncManager />
      </div>
    </EnsureUserProfile>);

}