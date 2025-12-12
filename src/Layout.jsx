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
          {/* Base gradient with green tint */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#0d120d] to-[#0a0f0a]" />

          {/* Grid top - almost pure white */}
          <div className="absolute inset-0 top-0 h-[30%] opacity-[0.1]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='g1' x1='0%25' y1='0%25' x2='100%25' y2='0%25'%3E%3Cstop offset='0%25' style='stop-color:rgb(220,220,220);stop-opacity:0.5' /%3E%3Cstop offset='100%25' style='stop-color:rgb(200,200,200);stop-opacity:0.5' /%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M0 20Q10 18 20 20T40 20Q50 22 60 20T80 20' stroke='url(%23g1)' fill='none' stroke-width='1'/%3E%3Cpath d='M0 40Q10 38 20 40T40 40Q50 42 60 40T80 40' stroke='url(%23g1)' fill='none' stroke-width='1'/%3E%3Cpath d='M0 60Q10 58 20 60T40 60Q50 62 60 60T80 60' stroke='url(%23g1)' fill='none' stroke-width='1'/%3E%3Cpath d='M20 0Q18 10 20 20T20 40Q22 50 20 60T20 80' stroke='url(%23g1)' fill='none' stroke-width='1'/%3E%3Cpath d='M40 0Q38 10 40 20T40 40Q42 50 40 60T40 80' stroke='url(%23g1)' fill='none' stroke-width='1'/%3E%3Cpath d='M60 0Q58 10 60 20T60 40Q62 50 60 60T60 80' stroke='url(%23g1)' fill='none' stroke-width='1'/%3E%3C/svg%3E")`,
            backgroundSize: '80px 80px'
          }} />
          
          {/* Grid middle - slight green tint */}
          <div className="absolute inset-0 top-[30%] h-[40%] opacity-[0.13]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='g2' x1='0%25' y1='0%25' x2='100%25' y2='0%25'%3E%3Cstop offset='0%25' style='stop-color:rgb(180,200,190);stop-opacity:0.6' /%3E%3Cstop offset='100%25' style='stop-color:rgb(100,180,140);stop-opacity:0.6' /%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M0 20Q10 17 20 20T40 20Q50 23 60 20T80 20' stroke='url(%23g2)' fill='none' stroke-width='1.1'/%3E%3Cpath d='M0 40Q10 37 20 40T40 40Q50 43 60 40T80 40' stroke='url(%23g2)' fill='none' stroke-width='1.1'/%3E%3Cpath d='M0 60Q10 57 20 60T40 60Q50 63 60 60T80 60' stroke='url(%23g2)' fill='none' stroke-width='1.1'/%3E%3Cpath d='M20 0Q17 10 20 20T20 40Q23 50 20 60T20 80' stroke='url(%23g2)' fill='none' stroke-width='1.1'/%3E%3Cpath d='M40 0Q37 10 40 20T40 40Q43 50 40 60T40 80' stroke='url(%23g2)' fill='none' stroke-width='1.1'/%3E%3Cpath d='M60 0Q57 10 60 20T60 40Q63 50 60 60T60 80' stroke='url(%23g2)' fill='none' stroke-width='1.1'/%3E%3C/svg%3E")`,
            backgroundSize: '80px 80px',
            transform: 'translate(10px, 5px)'
          }} />
          
          {/* Grid bottom - strong green */}
          <div className="absolute inset-0 top-[70%] h-[30%] opacity-[0.16]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='g3' x1='0%25' y1='0%25' x2='100%25' y2='0%25'%3E%3Cstop offset='0%25' style='stop-color:rgb(16,185,129);stop-opacity:0.8' /%3E%3Cstop offset='100%25' style='stop-color:rgb(52,211,153);stop-opacity:0.8' /%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M0 20Q10 16 20 20T40 20Q50 24 60 20T80 20' stroke='url(%23g3)' fill='none' stroke-width='1.2'/%3E%3Cpath d='M0 40Q10 36 20 40T40 40Q50 44 60 40T80 40' stroke='url(%23g3)' fill='none' stroke-width='1.2'/%3E%3Cpath d='M0 60Q10 56 20 60T40 60Q50 64 60 60T80 60' stroke='url(%23g3)' fill='none' stroke-width='1.2'/%3E%3Cpath d='M20 0Q16 10 20 20T20 40Q24 50 20 60T20 80' stroke='url(%23g3)' fill='none' stroke-width='1.2'/%3E%3Cpath d='M40 0Q36 10 40 20T40 40Q44 50 40 60T40 80' stroke='url(%23g3)' fill='none' stroke-width='1.2'/%3E%3Cpath d='M60 0Q56 10 60 20T60 40Q64 50 60 60T60 80' stroke='url(%23g3)' fill='none' stroke-width='1.2'/%3E%3C/svg%3E")`,
            backgroundSize: '80px 80px',
            transform: 'translate(20px, 10px)'
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
    </div>
  );
}