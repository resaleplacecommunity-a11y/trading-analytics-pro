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
  ChevronDown
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { cn } from "@/lib/utils";
import LanguageSwitcher from './components/LanguageSwitcher';
import UserProfileSection from './components/UserProfileSection';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { startOfWeek } from 'date-fns';
import NotificationPanel from './components/NotificationPanel';
import NotificationToast from './components/NotificationToast';
import DailyReminderNotification from './components/DailyReminderNotification';
import TestNotificationsRunner from './components/TestNotificationsRunner';
import EnsureUserProfile from './components/EnsureUserProfile';

const useTranslation = () => {
  const [lang, setLang] = useState(localStorage.getItem('tradingpro_lang') || 'ru');
  
  useEffect(() => {
    const handleChange = () => setLang(localStorage.getItem('tradingpro_lang') || 'ru');
    window.addEventListener('languagechange', handleChange);
    return () => window.removeEventListener('languagechange', handleChange);
  }, []);
  
  const t = (key) => {
    const translations = {
      ru: {
        dashboard: 'Дашборд',
        trades: 'Сделки',
        analyticsHub: 'Аналитика',
        terminal: 'Терминал',
        settings: 'Настройки',
        inProcess: 'В работе',
        tradingPro: 'Trading Pro',
        analyticsSystem: 'Система Аналитики'
      },
      en: {
        dashboard: 'Dashboard',
        trades: 'Trades',
        analyticsHub: 'Analytics',
        terminal: 'Terminal',
        settings: 'Settings',
        inProcess: 'In Process',
        tradingPro: 'Trading Pro',
        analyticsSystem: 'Analytics System'
      }
    };
    return translations[lang]?.[key] || key;
  };
  
  return { t, lang };
};

export default function Layout({ children, currentPageName }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const { t, lang } = useTranslation();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 30 * 60 * 1000,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.Notification.filter({ 
        created_by: user.email, 
        is_closed: false 
      }, '-created_date', 10);
    },
    enabled: !!user?.email,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const navItems = [
    { name: t('dashboard'), page: 'Dashboard', icon: LayoutDashboard },
    { name: t('trades'), page: 'Trades', icon: TrendingUp },
    { name: t('analyticsHub'), page: 'AnalyticsHub', icon: LineChart },
    { name: t('terminal'), page: 'Terminal', icon: Zap },
    { name: t('settings'), page: 'Settings', icon: Settings },
  ];

  const devToolsEmails = ['resaleplacecommunity@gmail.com', 'roman.dev.ff@gmail.com'];
  if (user && devToolsEmails.includes(user.email)) {
    navItems.push({ name: '🔧 DevTools', page: 'DevTools', icon: Zap });
  }

  return (
    <EnsureUserProfile>
      <div className="min-h-screen bg-[#0a0a0a]">

        {/* ── TOP NAV BAR ─────────────────────────────────────────────── */}
        <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-[#0f0f0f]/95 backdrop-blur-xl border-b border-[#1e1e1e]">
          <div className="flex items-center h-full px-4 gap-3 max-w-[1600px] mx-auto">

            {/* Logo */}
            <Link to={createPageUrl('Dashboard')} className="flex items-center gap-2.5 shrink-0 mr-2">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69349b30698117be30e537d8/d941b1ccb_.jpg" 
                alt="Logo" 
                className="w-7 h-7 object-contain rounded-md"
              />
              <span className="text-[#c0c0c0] font-bold text-sm hidden sm:block tracking-wide">
                Trading<span className="text-emerald-400">Pro</span>
              </span>
            </Link>

            {/* Desktop nav items */}
            <nav className="hidden md:flex items-center gap-1 flex-1">
              {navItems.map(item => {
                const isActive = currentPageName === item.page;
                return (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                        : "text-[#666] hover:text-[#aaa] hover:bg-[#1a1a1a]"
                    )}
                  >
                    <item.icon className={cn("w-4 h-4 shrink-0", isActive ? "text-emerald-400" : "")} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}

              {/* In Process pill */}
              <Link
                to={createPageUrl('InProcess')}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ml-1",
                  currentPageName === 'InProcess'
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "text-[#555] hover:text-[#888] border border-[#222] hover:border-[#333]"
                )}
              >
                <Zap className="w-3 h-3" />
                {t('inProcess')}
              </Link>
            </nav>

            {/* Right side controls */}
            <div className="flex items-center gap-2 ml-auto shrink-0">
              <LanguageSwitcher />

              {/* Notification bell */}
              <button
                onClick={() => setNotificationPanelOpen(true)}
                className="relative p-2 rounded-lg hover:bg-[#1a1a1a] transition-colors"
              >
                <Bell className="w-4.5 h-4.5 text-[#888]" style={{ width: '18px', height: '18px' }} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-gradient-to-br from-violet-500 to-violet-600 text-white text-[10px] rounded-full flex items-center justify-center font-bold shadow-lg shadow-violet-500/40 animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* User profile — desktop */}
              <div className="hidden sm:block">
                <UserProfileSection compact />
              </div>

              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg hover:bg-[#1a1a1a] transition-colors"
              >
                {mobileMenuOpen
                  ? <X className="w-5 h-5 text-[#c0c0c0]" />
                  : <Menu className="w-5 h-5 text-[#c0c0c0]" />}
              </button>
            </div>
          </div>
        </header>

        {/* ── MOBILE DROPDOWN MENU ──────────────────────────────────────── */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 pt-14 bg-[#0f0f0f]/98 backdrop-blur-xl md:hidden">
            <nav className="p-4 space-y-1">
              {navItems.map(item => {
                const isActive = currentPageName === item.page;
                return (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3.5 rounded-xl text-base font-medium transition-colors",
                      isActive
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                        : "text-[#888] hover:bg-[#1a1a1a] hover:text-[#c0c0c0]"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.name}
                  </Link>
                );
              })}
              <Link
                to={createPageUrl('InProcess')}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3.5 rounded-xl text-base font-medium transition-colors",
                  currentPageName === 'InProcess'
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "text-[#666] hover:bg-[#1a1a1a] hover:text-[#888]"
                )}
              >
                <Zap className="w-5 h-5" />
                {t('inProcess')}
              </Link>

              <div className="pt-4 border-t border-[#1e1e1e]">
                <UserProfileSection />
              </div>
            </nav>
          </div>
        )}

        {/* ── BACKGROUND ────────────────────────────────────────────────── */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#0d120d] to-[#0a0f0a]" />
          <div className="absolute inset-0 top-0 h-[30%] opacity-[0.1]" style={{
            backgroundImage: `linear-gradient(to right,rgba(220,220,220,.5) 1px,transparent 1px),linear-gradient(to bottom,rgba(220,220,220,.5) 1px,transparent 1px)`,
            backgroundSize: '80px 80px'
          }} />
          <div className="absolute inset-0 top-[30%] h-[40%] opacity-[0.13]" style={{
            backgroundImage: `linear-gradient(to right,rgba(100,180,140,.6) 1px,transparent 1px),linear-gradient(to bottom,rgba(100,180,140,.6) 1px,transparent 1px)`,
            backgroundSize: '80px 80px'
          }} />
          <div className="absolute inset-0 top-[70%] h-[30%] opacity-[0.16]" style={{
            backgroundImage: `linear-gradient(to right,rgba(16,185,129,.8) 1px,transparent 1px),linear-gradient(to bottom,rgba(16,185,129,.8) 1px,transparent 1px)`,
            backgroundSize: '80px 80px'
          }} />
          <div className="absolute bottom-0 left-0 right-0 h-[60vh] bg-gradient-to-t from-emerald-500/18 via-emerald-500/8 to-transparent blur-2xl" />
          <div className="absolute bottom-[5%] left-[10%] w-[900px] h-[900px] bg-gradient-radial from-emerald-400/20 via-emerald-500/10 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '7s' }} />
          <div className="absolute bottom-[8%] right-[15%] w-[850px] h-[850px] bg-gradient-radial from-green-400/18 via-emerald-500/9 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '9s', animationDelay: '3s' }} />
          <div className="absolute top-[10%] right-[20%] w-[800px] h-[800px] bg-gradient-radial from-white/6 via-[#c0c0c0]/3 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
        </div>

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
      </div>
    </EnsureUserProfile>
  );
}