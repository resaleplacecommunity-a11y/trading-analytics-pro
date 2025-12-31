import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { 
  LayoutDashboard, 
  LineChart, 
  CalendarDays,
  Shield, 
  Brain,
  Settings,
  TrendingUp,
  Menu,
  X,
  FileText,
  TrendingDown,
  Plug,
  Target,
  Zap,
  Bell
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from "@/lib/utils";
import LanguageSwitcher from './components/LanguageSwitcher';
import DailyReminder from './components/DailyReminder';
import NotificationPanel from './components/NotificationPanel';
import NotificationToast from './components/NotificationToast';
import UserProfileSection from './components/UserProfileSection';
import MarketOutlookNotificationChecker from './components/MarketOutlookNotificationChecker';
import PageNotificationMarker from './components/PageNotificationMarker';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { startOfWeek, endOfWeek } from 'date-fns';

// Translation helper
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
        weekly: 'Неделя',
        risk: 'Риск',
        behavior: 'Поведение',
        notes: 'Заметки',
        marketOutlook: 'Прогноз',
        apiSettings: 'API',
        settings: 'Настройки',
        tradingPro: 'Trading Pro',
        analyticsSystem: 'Система Аналитики'
      },
      en: {
        dashboard: 'Dashboard',
        trades: 'Trades',
        weekly: 'Weekly',
        risk: 'Risk',
        behavior: 'Behavior',
        notes: 'Notes',
        marketOutlook: 'Market Outlook',
        apiSettings: 'API Settings',
        settings: 'Settings',
        tradingPro: 'Trading Pro',
        analyticsSystem: 'Analytics System'
      }
    };
    return translations[lang]?.[key] || key;
  };
  
  return { t };
};

export default function Layout({ children, currentPageName }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const { t } = useTranslation();

  // Check if Market Outlook needs reminder
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: weeklyOutlooks = [] } = useQuery({
    queryKey: ['weeklyOutlooks'],
    queryFn: () => base44.entities.WeeklyOutlook.list('-week_start', 50),
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => base44.entities.Notification.filter({ is_closed: false }, '-created_date', 50),
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['notificationSettings'],
    queryFn: () => base44.entities.NotificationSettings.list('-created_date', 1),
  });

  const userSettings = settings[0] || {
    incomplete_trade_enabled: true,
    risk_violation_enabled: true,
    goal_achieved_enabled: true,
    market_outlook_enabled: true
  };

  const unreadNotifications = notifications.filter(n => !n.is_read).length;

  // Calculate page badges based on notifications and settings
  const getPageBadge = (pageName) => {
    const pageNotifications = notifications.filter(n => {
      if (n.is_read || n.is_closed) return false;
      
      // Check if notification type is enabled
      const typeEnabledMap = {
        incomplete_trade: userSettings.incomplete_trade_enabled,
        risk_violation: userSettings.risk_violation_enabled,
        goal_achieved: userSettings.goal_achieved_enabled,
        market_outlook: userSettings.market_outlook_enabled
      };
      
      if (!typeEnabledMap[n.type]) return false;
      
      // Map notifications to pages
      if (pageName === 'Trades' && n.type === 'incomplete_trade') return true;
      if (pageName === 'RiskManager' && n.type === 'risk_violation') return true;
      if (pageName === 'Focus' && n.type === 'goal_achieved') return true;
      if (pageName === 'MarketOutlook' && n.type === 'market_outlook') return true;
      
      return false;
    });
    
    return pageNotifications.length;
  };

  const [showMarketOutlookReminder, setShowMarketOutlookReminder] = useState(false);

  useEffect(() => {
    if (!user?.preferred_timezone) return;
    
    const now = new Date();
    const userTz = user.preferred_timezone;
    const dayOfWeek = formatInTimeZone(now, userTz, 'i'); // 1=Monday, 7=Sunday
    
    // Only check on Monday
    if (dayOfWeek !== '1') {
      setShowMarketOutlookReminder(false);
      return;
    }

    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekStartStr = formatInTimeZone(weekStart, userTz, 'yyyy-MM-dd');
    
    const currentWeek = weeklyOutlooks.find(w => w.week_start === weekStartStr);
    
    if (!currentWeek || currentWeek.status !== 'completed') {
      setShowMarketOutlookReminder(true);
    } else {
      setShowMarketOutlookReminder(false);
    }
  }, [user, weeklyOutlooks]);

  const navItems = [
    { name: t('dashboard'), page: 'Dashboard', icon: LayoutDashboard },
    { name: t('trades'), page: 'Trades', icon: TrendingUp },
    { name: 'Analytics Hub', page: 'AnalyticsHub', icon: LineChart },
    { name: t('risk'), page: 'RiskManager', icon: Shield },
    { name: 'Focus', page: 'Focus', icon: Target },
    { name: t('marketOutlook'), page: 'MarketOutlook', icon: TrendingDown, badge: 'reminder' },
    { name: 'Learning', page: 'Notes', icon: FileText },
    { name: 'In Process', page: 'InProcess', icon: Zap },
    { name: t('settings'), page: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-[#111] border-b border-[#222] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69349b30698117be30e537d8/d941b1ccb_.jpg" 
              alt="Trading Pro Logo" 
              className="w-6 h-6 object-contain"
            />
            <span className="text-[#c0c0c0] font-bold">{t('tradingPro')}</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <button 
              onClick={() => setNotificationPanelOpen(true)}
              className="relative"
            >
              <Bell className="w-6 h-6 text-[#c0c0c0]" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </button>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="w-6 h-6 text-[#c0c0c0]" /> : <Menu className="w-6 h-6 text-[#c0c0c0]" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-[#111] pt-16">
          <nav className="p-4 space-y-2">
            {navItems.map(item => (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors relative",
                  currentPageName === item.page 
                    ? "bg-[#1a1a1a] text-[#c0c0c0]" 
                    : "text-[#666] hover:bg-[#1a1a1a] hover:text-[#888]"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.name}</span>
                {item.badge === 'reminder' && showMarketOutlookReminder && (
                  <span className="absolute right-3 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
                {getPageBadge(item.page) > 0 && (
                  <span className="absolute right-3 w-5 h-5 bg-violet-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse">
                    {getPageBadge(item.page)}
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 bg-[#111] border-r border-[#1a1a1a] flex-col z-50">
        <div className="p-6 border-b border-[#1a1a1a]">
          <div className="flex items-center gap-3 mb-4">
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69349b30698117be30e537d8/d941b1ccb_.jpg" 
              alt="Trading Pro Logo" 
              className="w-10 h-10 object-contain"
            />
            <div>
              <h1 className="text-[#c0c0c0] font-bold">{t('tradingPro')}</h1>
              <p className="text-[#666] text-xs">{t('analyticsSystem')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <button
              onClick={() => setNotificationPanelOpen(true)}
              className="relative p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors flex-1 flex items-center justify-center"
            >
              <Bell className="w-4 h-4 text-[#888]" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold leading-none">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </button>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => (
            <Link
              key={item.page}
              to={createPageUrl(item.page)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 relative",
                currentPageName === item.page 
                  ? "bg-[#1a1a1a] text-[#c0c0c0] shadow-lg" 
                  : "text-[#666] hover:bg-[#151515] hover:text-[#888]"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
              {item.badge === 'reminder' && showMarketOutlookReminder && (
                <span className="absolute right-4 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              )}
              {getPageBadge(item.page) > 0 && (
                <span className="absolute right-4 w-5 h-5 bg-violet-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse leading-none">
                  {getPageBadge(item.page)}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-[#1a1a1a]">
          <UserProfileSection />
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen pt-16 lg:pt-0 relative">
        {/* Background Pattern */}
        <div className="fixed inset-0 lg:left-64 pointer-events-none z-0">
          {/* Base gradient with green tint */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#0d120d] to-[#0a0f0a]" />

          {/* Continuous grid - top (white) */}
          <div className="absolute inset-0 top-0 h-[30%] opacity-[0.1]" style={{
            backgroundImage: `
              linear-gradient(to right, rgba(220,220,220,0.5) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(220,220,220,0.5) 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px'
          }} />
          
          {/* Continuous grid - middle (slight green) */}
          <div className="absolute inset-0 top-[30%] h-[40%] opacity-[0.13]" style={{
            backgroundImage: `
              linear-gradient(to right, rgba(100,180,140,0.6) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(100,180,140,0.6) 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px'
          }} />
          
          {/* Continuous grid - bottom (strong green) */}
          <div className="absolute inset-0 top-[70%] h-[30%] opacity-[0.16]" style={{
            backgroundImage: `
              linear-gradient(to right, rgba(16,185,129,0.8) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(16,185,129,0.8) 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px'
          }} />

          {/* Chaotic white dots */}
          <div className="absolute inset-0 opacity-[0.15]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='150' height='150' viewBox='0 0 150 150' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='12' cy='18' r='1.5' fill='white'/%3E%3Ccircle cx='68' cy='9' r='1' fill='white'/%3E%3Ccircle cx='112' cy='35' r='1.3' fill='white'/%3E%3Ccircle cx='27' cy='62' r='0.9' fill='white'/%3E%3Ccircle cx='130' cy='73' r='1.6' fill='white'/%3E%3Ccircle cx='45' cy='107' r='1.1' fill='white'/%3E%3Ccircle cx='135' cy='124' r='1.4' fill='white'/%3E%3Ccircle cx='88' cy='136' r='1' fill='white'/%3E%3Ccircle cx='18' cy='140' r='1.2' fill='white'/%3E%3Ccircle cx='95' cy='52' r='1.1' fill='white'/%3E%3Ccircle cx='58' cy='88' r='1.3' fill='white'/%3E%3Ccircle cx='105' cy='115' r='0.9' fill='white'/%3E%3Ccircle cx='35' cy='130' r='1.2' fill='white'/%3E%3Ccircle cx='142' cy='145' r='0.8' fill='white'/%3E%3Ccircle cx='75' cy='25' r='1' fill='white'/%3E%3Ccircle cx='120' cy='80' r='1.2' fill='white'/%3E%3C/svg%3E")`,
            backgroundSize: '150px 150px'
          }} />

          {/* More chaotic dots offset */}
          <div className="absolute inset-0 opacity-[0.12]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='180' height='180' viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='25' cy='35' r='1.3' fill='white'/%3E%3Ccircle cx='92' cy='15' r='0.9' fill='white'/%3E%3Ccircle cx='145' cy='58' r='1.1' fill='white'/%3E%3Ccircle cx='38' cy='95' r='1.2' fill='white'/%3E%3Ccircle cx='155' cy='115' r='1' fill='white'/%3E%3Ccircle cx='70' cy='138' r='1.4' fill='white'/%3E%3Ccircle cx='165' cy='165' r='0.8' fill='white'/%3E%3Ccircle cx='105' cy='175' r='1.1' fill='white'/%3E%3Ccircle cx='15' cy='168' r='1.3' fill='white'/%3E%3Ccircle cx='125' cy='70' r='0.9' fill='white'/%3E%3C/svg%3E")`,
            backgroundSize: '180px 180px',
            transform: 'translate(40px, 55px)'
          }} />

          {/* Strong white/silver glow at top */}
          <div className="absolute top-[10%] right-[20%] w-[800px] h-[800px] bg-gradient-radial from-white/6 via-[#c0c0c0]/3 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
          <div className="absolute top-[30%] left-[25%] w-[700px] h-[700px] bg-gradient-radial from-[#e5e5e5]/5 via-[#c0c0c0]/2 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '8s', animationDelay: '2s' }} />

          {/* STRONG green gradient at bottom - VERY VISIBLE */}
          <div className="absolute bottom-0 left-0 right-0 h-[60vh] bg-gradient-to-t from-emerald-500/18 via-emerald-500/8 to-transparent blur-2xl" />
          <div className="absolute bottom-[5%] left-[10%] w-[900px] h-[900px] bg-gradient-radial from-emerald-400/20 via-emerald-500/10 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '7s', animationDelay: '1s' }} />
          <div className="absolute bottom-[8%] right-[15%] w-[850px] h-[850px] bg-gradient-radial from-green-400/18 via-emerald-500/9 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '9s', animationDelay: '3s' }} />
          <div className="absolute bottom-[3%] left-[40%] w-[800px] h-[800px] bg-gradient-radial from-emerald-300/15 via-green-500/8 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '8s', animationDelay: '4s' }} />
        </div>

        <div className="p-4 lg:p-6 relative z-10">
          {children}
        </div>
        </main>

      <DailyReminder />
      <MarketOutlookNotificationChecker />
      <PageNotificationMarker currentPageName={currentPageName} />
      <NotificationPanel 
        open={notificationPanelOpen} 
        onOpenChange={setNotificationPanelOpen} 
      />
      <NotificationToast />
      </div>
      );
      }