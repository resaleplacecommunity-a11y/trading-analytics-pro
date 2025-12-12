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
  Plug
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from "@/lib/utils";
import LanguageSwitcher from './components/LanguageSwitcher';
import DailyReminder from './components/DailyReminder';

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
  const { t } = useTranslation();

  const navItems = [
    { name: t('dashboard'), page: 'Dashboard', icon: LayoutDashboard },
    { name: t('trades'), page: 'Trades', icon: TrendingUp },
    { name: t('weekly'), page: 'WeeklyAnalytics', icon: CalendarDays },
    { name: t('risk'), page: 'RiskManager', icon: Shield },
    { name: t('behavior'), page: 'BehaviorAnalysis', icon: Brain },
    { name: t('notes'), page: 'Notes', icon: FileText },
    { name: t('marketOutlook'), page: 'MarketOutlook', icon: TrendingDown },
    { name: t('settings'), page: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-[#111] border-b border-[#222] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-xl bg-gradient-to-br from-[#c0c0c0] to-[#888] flex items-center justify-center">
              <span className="text-[#111] font-bold text-xs">TP</span>
            </div>
            <span className="text-[#c0c0c0] font-bold">{t('tradingPro')}</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
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
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                  currentPageName === item.page 
                    ? "bg-[#1a1a1a] text-[#c0c0c0]" 
                    : "text-[#666] hover:bg-[#1a1a1a] hover:text-[#888]"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            ))}
          </nav>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 bg-[#111] border-r border-[#1a1a1a] flex-col z-50">
        <div className="p-6 border-b border-[#1a1a1a]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#c0c0c0] to-[#888] flex items-center justify-center">
              <span className="text-[#111] font-bold text-lg">TP</span>
            </div>
            <div>
              <h1 className="text-[#c0c0c0] font-bold">{t('tradingPro')}</h1>
              <p className="text-[#666] text-xs">{t('analyticsSystem')}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => (
            <Link
              key={item.page}
              to={createPageUrl(item.page)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                currentPageName === item.page 
                  ? "bg-[#1a1a1a] text-[#c0c0c0] shadow-lg" 
                  : "text-[#666] hover:bg-[#151515] hover:text-[#888]"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-[#1a1a1a]">
          <div className="mb-3">
            <LanguageSwitcher />
          </div>
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] rounded-xl p-4">
            <p className="text-[#888] text-xs">Trading Analytics PRO</p>
            <p className="text-[#c0c0c0] text-sm font-medium mt-1">Dark Silver Edition</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen pt-16 lg:pt-0 relative">
        {/* Background Pattern */}
        <div className="fixed inset-0 lg:left-64 pointer-events-none z-0">
          {/* Base gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#0d0d0d] to-[#0a0a0a]" />

          {/* Chaotic scattered dots pattern */}
          <div className="absolute inset-0 opacity-[0.08]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='200' viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='15' cy='23' r='1.5' fill='%23c0c0c0'/%3E%3Ccircle cx='87' cy='12' r='1' fill='%23c0c0c0'/%3E%3Ccircle cx='143' cy='45' r='1.2' fill='%23c0c0c0'/%3E%3Ccircle cx='34' cy='78' r='0.8' fill='%23c0c0c0'/%3E%3Ccircle cx='165' cy='92' r='1.5' fill='%23c0c0c0'/%3E%3Ccircle cx='56' cy='134' r='1' fill='%23c0c0c0'/%3E%3Ccircle cx='189' cy='156' r='1.3' fill='%23c0c0c0'/%3E%3Ccircle cx='112' cy='171' r='0.9' fill='%23c0c0c0'/%3E%3Ccircle cx='23' cy='189' r='1.1' fill='%23c0c0c0'/%3E%3Ccircle cx='178' cy='23' r='1.4' fill='%23c0c0c0'/%3E%3C/svg%3E")`,
            backgroundSize: '200px 200px'
          }} />

          {/* Random angular lines */}
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='150' height='150' viewBox='0 0 150 150' xmlns='http://www.w3.org/2000/svg'%3E%3Cline x1='20' y1='40' x2='80' y2='45' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cline x1='100' y1='15' x2='130' y2='60' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cline x1='10' y1='90' x2='45' y2='110' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cline x1='110' y1='85' x2='140' y2='95' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cline x1='55' y1='130' x2='75' y2='145' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3C/svg%3E")`,
            backgroundSize: '150px 150px'
          }} />

          {/* Hexagons scattered */}
          <div className="absolute inset-0 opacity-[0.05]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='180' height='180' viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 15l15 8.66v17.32L30 50l-15-8.66V24.02z' fill='none' stroke='%23c0c0c0' stroke-width='0.6'/%3E%3Cpath d='M140 50l10 5.77v11.55l-10 5.77-10-5.77V55.77z' fill='none' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cpath d='M70 110l12 6.93v13.86L70 140l-12-6.93v-13.86z' fill='none' stroke='%23c0c0c0' stroke-width='0.6'/%3E%3Cpath d='M160 140l8 4.62v9.24l-8 4.62-8-4.62v-9.24z' fill='none' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3C/svg%3E")`,
            backgroundSize: '180px 180px'
          }} />

          {/* Animated multi-color glows */}
          <div className="absolute top-[15%] right-[20%] w-[600px] h-[600px] bg-gradient-radial from-[#c0c0c0]/10 via-[#888]/5 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '7s' }} />
          <div className="absolute bottom-[25%] left-[15%] w-[500px] h-[500px] bg-gradient-radial from-[#888]/12 via-[#666]/6 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '9s', animationDelay: '2s' }} />
          <div className="absolute top-[60%] right-[40%] w-[400px] h-[400px] bg-gradient-radial from-[#a0a0a0]/8 via-transparent to-transparent blur-3xl animate-pulse" style={{ animationDuration: '11s', animationDelay: '5s' }} />

          {/* Diagonal grid with gaps */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 60px, #c0c0c0 60px, #c0c0c0 61px, transparent 61px, transparent 180px)`
          }} />

          {/* Random tiny squares */}
          <div className="absolute inset-0 opacity-[0.06]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='220' height='220' viewBox='0 0 220 220' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='25' y='30' width='3' height='3' fill='%23c0c0c0'/%3E%3Crect x='110' y='18' width='2' height='2' fill='%23c0c0c0'/%3E%3Crect x='175' y='65' width='2.5' height='2.5' fill='%23c0c0c0'/%3E%3Crect x='45' y='125' width='3' height='3' fill='%23c0c0c0'/%3E%3Crect x='150' y='160' width='2' height='2' fill='%23c0c0c0'/%3E%3Crect x='200' y='190' width='2.5' height='2.5' fill='%23c0c0c0'/%3E%3C/svg%3E")`,
            backgroundSize: '220px 220px'
          }} />

          {/* Subtle crosshairs */}
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='300' height='300' viewBox='0 0 300 300' xmlns='http://www.w3.org/2000/svg'%3E%3Cline x1='50' y1='40' x2='50' y2='60' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cline x1='40' y1='50' x2='60' y2='50' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cline x1='220' y1='180' x2='220' y2='200' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cline x1='210' y1='190' x2='230' y2='190' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3C/svg%3E")`,
            backgroundSize: '300px 300px'
          }} />
        </div>

        <div className="p-4 lg:p-6 relative z-10">
          {children}
        </div>
        </main>
      
      <DailyReminder />
    </div>
  );
}