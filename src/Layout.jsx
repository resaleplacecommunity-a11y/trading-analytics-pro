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

          {/* Trading candlestick charts */}
          <div className="absolute inset-0 opacity-[0.06]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='250' height='250' viewBox='0 0 250 250' xmlns='http://www.w3.org/2000/svg'%3E%3Cline x1='30' y1='60' x2='30' y2='90' stroke='%2310b981' stroke-width='1.5'/%3E%3Crect x='26' y='65' width='8' height='18' fill='%2310b981'/%3E%3Cline x1='60' y1='75' x2='60' y2='95' stroke='%23ef4444' stroke-width='1.5'/%3E%3Crect x='56' y='82' width='8' height='10' fill='%23ef4444'/%3E%3Cline x1='90' y1='55' x2='90' y2='85' stroke='%2310b981' stroke-width='1.5'/%3E%3Crect x='86' y='60' width='8' height='20' fill='%2310b981'/%3E%3Cline x1='120' y1='70' x2='120' y2='100' stroke='%2310b981' stroke-width='1.5'/%3E%3Crect x='116' y='75' width='8' height='15' fill='%2310b981'/%3E%3Cline x1='150' y1='80' x2='150' y2='105' stroke='%23ef4444' stroke-width='1.5'/%3E%3Crect x='146' y='88' width='8' height='12' fill='%23ef4444'/%3E%3C/svg%3E")`,
            backgroundSize: '250px 250px'
          }} />

          {/* Line chart pattern */}
          <div className="absolute inset-0 opacity-[0.05]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='300' height='300' viewBox='0 0 300 300' xmlns='http://www.w3.org/2000/svg'%3E%3Cpolyline points='20,150 50,120 80,140 110,90 140,110 170,70' fill='none' stroke='%2310b981' stroke-width='1'/%3E%3Ccircle cx='50' cy='120' r='2' fill='%2310b981'/%3E%3Ccircle cx='110' cy='90' r='2' fill='%2310b981'/%3E%3Ccircle cx='170' cy='70' r='2' fill='%2310b981'/%3E%3C/svg%3E")`,
            backgroundSize: '300px 300px'
          }} />

          {/* Trading arrows up/down */}
          <div className="absolute inset-0 opacity-[0.07]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='200' viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cpolygon points='40,60 45,70 35,70' fill='%2310b981'/%3E%3Cpolygon points='120,140 125,130 115,130' fill='%2310b981'/%3E%3Cpolygon points='160,90 165,100 155,100' fill='%23ef4444'/%3E%3Cpolygon points='80,170 85,180 75,180' fill='%23ef4444'/%3E%3C/svg%3E")`,
            backgroundSize: '200px 200px'
          }} />

          {/* Dollar and percentage signs */}
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='280' height='280' viewBox='0 0 280 280' xmlns='http://www.w3.org/2000/svg'%3E%3Ctext x='50' y='60' font-family='monospace' font-size='14' fill='%2310b981' opacity='0.5'%3E%24%3C/text%3E%3Ctext x='180' y='120' font-family='monospace' font-size='12' fill='%23c0c0c0' opacity='0.5'%3E%25%3C/text%3E%3Ctext x='100' y='200' font-family='monospace' font-size='14' fill='%2310b981' opacity='0.5'%3E%24%3C/text%3E%3Ctext x='230' y='250' font-family='monospace' font-size='12' fill='%23c0c0c0' opacity='0.5'%3E%25%3C/text%3E%3C/svg%3E")`,
            backgroundSize: '280px 280px'
          }} />

          {/* Hexagons scattered */}
          <div className="absolute inset-0 opacity-[0.05]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='180' height='180' viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 15l15 8.66v17.32L30 50l-15-8.66V24.02z' fill='none' stroke='%23c0c0c0' stroke-width='0.6'/%3E%3Cpath d='M140 50l10 5.77v11.55l-10 5.77-10-5.77V55.77z' fill='none' stroke='%2310b981' stroke-width='0.5'/%3E%3Cpath d='M70 110l12 6.93v13.86L70 140l-12-6.93v-13.86z' fill='none' stroke='%23c0c0c0' stroke-width='0.6'/%3E%3Cpath d='M160 140l8 4.62v9.24l-8 4.62-8-4.62v-9.24z' fill='none' stroke='%2310b981' stroke-width='0.5'/%3E%3C/svg%3E")`,
            backgroundSize: '180px 180px'
          }} />

          {/* Animated glows with green accent */}
          <div className="absolute top-[15%] right-[20%] w-[600px] h-[600px] bg-gradient-radial from-[#10b981]/8 via-[#10b981]/3 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '7s' }} />
          <div className="absolute bottom-[25%] left-[15%] w-[500px] h-[500px] bg-gradient-radial from-[#c0c0c0]/10 via-[#888]/5 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '9s', animationDelay: '2s' }} />
          <div className="absolute top-[60%] right-[40%] w-[400px] h-[400px] bg-gradient-radial from-[#10b981]/6 via-transparent to-transparent blur-3xl animate-pulse" style={{ animationDuration: '11s', animationDelay: '5s' }} />

          {/* Support/Resistance levels */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 120px, #10b981 120px, #10b981 121px, transparent 121px, transparent 240px)`
          }} />

          {/* Random tiny squares with green accent */}
          <div className="absolute inset-0 opacity-[0.06]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='220' height='220' viewBox='0 0 220 220' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='25' y='30' width='3' height='3' fill='%2310b981'/%3E%3Crect x='110' y='18' width='2' height='2' fill='%23c0c0c0'/%3E%3Crect x='175' y='65' width='2.5' height='2.5' fill='%2310b981'/%3E%3Crect x='45' y='125' width='3' height='3' fill='%23c0c0c0'/%3E%3Crect x='150' y='160' width='2' height='2' fill='%2310b981'/%3E%3Crect x='200' y='190' width='2.5' height='2.5' fill='%23c0c0c0'/%3E%3C/svg%3E")`,
            backgroundSize: '220px 220px'
          }} />

          {/* Price level markers */}
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='300' height='300' viewBox='0 0 300 300' xmlns='http://www.w3.org/2000/svg'%3E%3Cline x1='30' y1='50' x2='80' y2='50' stroke='%2310b981' stroke-width='0.5' stroke-dasharray='2,2'/%3E%3Cline x1='150' y1='120' x2='200' y2='120' stroke='%23c0c0c0' stroke-width='0.5' stroke-dasharray='2,2'/%3E%3Cline x1='50' y1='200' x2='100' y2='200' stroke='%2310b981' stroke-width='0.5' stroke-dasharray='2,2'/%3E%3C/svg%3E")`,
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