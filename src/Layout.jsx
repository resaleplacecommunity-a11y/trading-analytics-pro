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

          {/* Very distorted chaotic grid - top (white-green gradient) */}
          <div className="absolute inset-0 top-0 h-[33%] opacity-[0.12]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='90' height='90' viewBox='0 0 90 90' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='g1' x1='0%25' y1='0%25' x2='100%25' y2='0%25'%3E%3Cstop offset='0%25' style='stop-color:rgb(192,192,192);stop-opacity:0.5' /%3E%3Cstop offset='50%25' style='stop-color:rgb(100,200,150);stop-opacity:0.4' /%3E%3Cstop offset='100%25' style='stop-color:rgb(192,192,192);stop-opacity:0.5' /%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M0 22Q8 16 18 24T38 18Q52 28 65 19T90 25' stroke='url(%23g1)' fill='none' stroke-width='1.2'/%3E%3Cpath d='M0 48Q12 42 22 50T44 43Q58 54 72 45T90 52' stroke='url(%23g1)' fill='none' stroke-width='1.2'/%3E%3Cpath d='M0 74Q10 68 20 76T42 70Q56 80 70 71T90 78' stroke='url(%23g1)' fill='none' stroke-width='1.2'/%3E%3Cpath d='M22 0Q16 12 24 22T18 44Q28 58 19 72T25 90' stroke='url(%23g1)' fill='none' stroke-width='1.2'/%3E%3Cpath d='M48 0Q42 10 50 20T43 42Q54 56 45 70T52 90' stroke='url(%23g1)' fill='none' stroke-width='1.2'/%3E%3Cpath d='M74 0Q68 8 76 18T70 40Q80 54 71 68T78 90' stroke='url(%23g1)' fill='none' stroke-width='1.2'/%3E%3C/svg%3E")`,
            backgroundSize: '90px 90px'
          }} />

          {/* Very distorted chaotic grid - middle (more green) */}
          <div className="absolute inset-0 top-[33%] h-[34%] opacity-[0.15]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='90' height='90' viewBox='0 0 90 90' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='g2' x1='0%25' y1='0%25' x2='100%25' y2='0%25'%3E%3Cstop offset='0%25' style='stop-color:rgb(150,192,170);stop-opacity:0.6' /%3E%3Cstop offset='50%25' style='stop-color:rgb(16,185,129);stop-opacity:0.7' /%3E%3Cstop offset='100%25' style='stop-color:rgb(150,192,170);stop-opacity:0.6' /%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M0 20Q12 14 24 22T46 16Q62 26 78 17T90 23' stroke='url(%23g2)' fill='none' stroke-width='1.3'/%3E%3Cpath d='M0 46Q10 40 20 48T42 42Q58 52 74 43T90 50' stroke='url(%23g2)' fill='none' stroke-width='1.3'/%3E%3Cpath d='M0 72Q14 66 28 74T50 68Q66 78 82 69T90 76' stroke='url(%23g2)' fill='none' stroke-width='1.3'/%3E%3Cpath d='M20 0Q14 10 22 20T16 42Q26 56 17 70T23 90' stroke='url(%23g2)' fill='none' stroke-width='1.3'/%3E%3Cpath d='M46 0Q40 12 48 22T42 44Q52 58 43 72T50 90' stroke='url(%23g2)' fill='none' stroke-width='1.3'/%3E%3Cpath d='M72 0Q66 14 74 24T68 46Q78 60 69 74T76 90' stroke='url(%23g2)' fill='none' stroke-width='1.3'/%3E%3C/svg%3E")`,
            backgroundSize: '90px 90px',
            transform: 'translate(20px, 10px)'
          }} />

          {/* Very distorted chaotic grid - bottom (most green) */}
          <div className="absolute inset-0 top-[67%] h-[33%] opacity-[0.18]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='90' height='90' viewBox='0 0 90 90' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='g3' x1='0%25' y1='0%25' x2='100%25' y2='0%25'%3E%3Cstop offset='0%25' style='stop-color:rgb(16,185,129);stop-opacity:0.8' /%3E%3Cstop offset='50%25' style='stop-color:rgb(52,211,153);stop-opacity:0.9' /%3E%3Cstop offset='100%25' style='stop-color:rgb(16,185,129);stop-opacity:0.8' /%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M0 18Q15 12 30 20T55 14Q70 24 85 15T90 21' stroke='url(%23g3)' fill='none' stroke-width='1.4'/%3E%3Cpath d='M0 44Q18 38 36 46T60 40Q75 50 90 41T90 48' stroke='url(%23g3)' fill='none' stroke-width='1.4'/%3E%3Cpath d='M0 70Q20 64 40 72T65 66Q80 76 90 67T90 74' stroke='url(%23g3)' fill='none' stroke-width='1.4'/%3E%3Cpath d='M18 0Q12 15 20 30T14 55Q24 70 15 85T21 90' stroke='url(%23g3)' fill='none' stroke-width='1.4'/%3E%3Cpath d='M44 0Q38 18 46 36T40 60Q50 75 41 90T48 90' stroke='url(%23g3)' fill='none' stroke-width='1.4'/%3E%3Cpath d='M70 0Q64 20 72 40T66 65Q76 80 67 90T74 90' stroke='url(%23g3)' fill='none' stroke-width='1.4'/%3E%3C/svg%3E")`,
            backgroundSize: '90px 90px',
            transform: 'translate(35px, 25px)'
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