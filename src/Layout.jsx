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
      <main className="lg:ml-64 min-h-screen pt-16 lg:pt-0 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="fixed inset-0 lg:left-64 pointer-events-none -z-10">
          {/* Base gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#0d0d0d] to-[#0a0a0a]" />
          
          {/* Circuit board pattern */}
          <div className="absolute inset-0 opacity-[0.15]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 10h20v20H10zM70 10h20v20H70zM10 70h20v20H10zM70 70h20v20H70z' fill='none' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cline x1='20' y1='20' x2='70' y2='20' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cline x1='20' y1='80' x2='70' y2='80' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cline x1='20' y1='20' x2='20' y2='70' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cline x1='80' y1='20' x2='80' y2='70' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Ccircle cx='20' cy='20' r='2' fill='%23c0c0c0'/%3E%3Ccircle cx='80' cy='20' r='2' fill='%23c0c0c0'/%3E%3Ccircle cx='20' cy='80' r='2' fill='%23c0c0c0'/%3E%3Ccircle cx='80' cy='80' r='2' fill='%23c0c0c0'/%3E%3C/svg%3E")`,
            backgroundSize: '100px 100px'
          }} />

          {/* Hexagon pattern */}
          <div className="absolute inset-0 opacity-[0.12]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60 4.02 45V15z' fill='none' stroke='%23c0c0c0' stroke-width='0.8'/%3E%3C/svg%3E")`,
            backgroundSize: '60px 60px'
          }} />

          {/* Animated glows */}
          <div className="absolute top-1/4 right-1/4 w-[700px] h-[700px] bg-gradient-radial from-[#c0c0c0]/20 via-transparent to-transparent blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute bottom-1/3 left-1/3 w-[600px] h-[600px] bg-gradient-radial from-[#888]/25 via-transparent to-transparent blur-3xl animate-pulse" style={{ animationDuration: '10s', animationDelay: '3s' }} />

          {/* Grid dots */}
          <div className="absolute inset-0 opacity-[0.12]" style={{
            backgroundImage: 'radial-gradient(circle, #c0c0c0 1px, transparent 1px)',
            backgroundSize: '30px 30px'
          }} />

          {/* Diagonal lines */}
          <div className="absolute inset-0 opacity-[0.08]" style={{
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 50px, #c0c0c0 50px, #c0c0c0 51px)`
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