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

          {/* Chaotic scattered dots pattern - MORE DOTS */}
          <div className="absolute inset-0 opacity-[0.12]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='160' height='160' viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='12' cy='18' r='1.2' fill='%23c0c0c0'/%3E%3Ccircle cx='68' cy='9' r='0.8' fill='%23c0c0c0'/%3E%3Ccircle cx='112' cy='35' r='1' fill='%23c0c0c0'/%3E%3Ccircle cx='27' cy='62' r='0.7' fill='%23c0c0c0'/%3E%3Ccircle cx='130' cy='73' r='1.3' fill='%23c0c0c0'/%3E%3Ccircle cx='45' cy='107' r='0.9' fill='%23c0c0c0'/%3E%3Ccircle cx='148' cy='124' r='1.1' fill='%23c0c0c0'/%3E%3Ccircle cx='88' cy='136' r='0.8' fill='%23c0c0c0'/%3E%3Ccircle cx='18' cy='150' r='1' fill='%23c0c0c0'/%3E%3Ccircle cx='140' cy='18' r='1.2' fill='%23c0c0c0'/%3E%3Ccircle cx='95' cy='52' r='0.9' fill='%23c0c0c0'/%3E%3Ccircle cx='58' cy='88' r='1.1' fill='%23c0c0c0'/%3E%3Ccircle cx='105' cy='115' r='0.8' fill='%23c0c0c0'/%3E%3Ccircle cx='35' cy='140' r='1' fill='%23c0c0c0'/%3E%3Ccircle cx='152' cy='155' r='0.7' fill='%23c0c0c0'/%3E%3C/svg%3E")`,
            backgroundSize: '160px 160px'
          }} />

          {/* Random angular lines - MORE LINES */}
          <div className="absolute inset-0 opacity-[0.06]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='140' height='140' viewBox='0 0 140 140' xmlns='http://www.w3.org/2000/svg'%3E%3Cline x1='18' y1='35' x2='72' y2='40' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cline x1='95' y1='12' x2='122' y2='54' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cline x1='8' y1='82' x2='40' y2='100' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cline x1='105' y1='78' x2='132' y2='88' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cline x1='48' y1='118' x2='68' y2='135' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cline x1='75' y1='55' x2='95' y2='68' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cline x1='25' y1='108' x2='55' y2='120' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cline x1='112' y1='25' x2='128' y2='35' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3C/svg%3E")`,
            backgroundSize: '140px 140px'
          }} />

          {/* Hexagons scattered - MORE HEXAGONS */}
          <div className="absolute inset-0 opacity-[0.07]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='170' height='170' viewBox='0 0 170 170' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M28 14l13 7.5v15L28 44l-13-7.5v-15z' fill='none' stroke='%23c0c0c0' stroke-width='0.6'/%3E%3Cpath d='M130 45l9 5.2v10.4l-9 5.2-9-5.2V50.2z' fill='none' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cpath d='M65 100l11 6.35v12.7L65 125l-11-6.35v-12.7z' fill='none' stroke='%23c0c0c0' stroke-width='0.6'/%3E%3Cpath d='M148 128l7 4v8l-7 4-7-4v-8z' fill='none' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cpath d='M95 68l8 4.62v9.24l-8 4.62-8-4.62v-9.24z' fill='none' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cpath d='M38 145l6 3.46v6.93l-6 3.46-6-3.46v-6.93z' fill='none' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3C/svg%3E")`,
            backgroundSize: '170px 170px'
          }} />

          {/* Silver glows at top */}
          <div className="absolute top-[15%] right-[20%] w-[600px] h-[600px] bg-gradient-radial from-[#c0c0c0]/12 via-[#888]/6 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '7s' }} />
          <div className="absolute top-[5%] left-[30%] w-[500px] h-[500px] bg-gradient-radial from-[#888]/14 via-[#666]/7 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '9s', animationDelay: '2s' }} />
          <div className="absolute top-[40%] right-[10%] w-[400px] h-[400px] bg-gradient-radial from-[#a0a0a0]/10 via-transparent to-transparent blur-3xl animate-pulse" style={{ animationDuration: '11s', animationDelay: '5s' }} />

          {/* Green glows concentrated at bottom */}
          <div className="absolute bottom-[5%] left-[20%] w-[700px] h-[700px] bg-gradient-radial from-emerald-500/15 via-emerald-500/8 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '8s', animationDelay: '1s' }} />
          <div className="absolute bottom-[15%] right-[25%] w-[600px] h-[600px] bg-gradient-radial from-emerald-400/12 via-emerald-500/6 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '10s', animationDelay: '3s' }} />
          <div className="absolute bottom-[10%] left-[45%] w-[550px] h-[550px] bg-gradient-radial from-emerald-600/10 via-emerald-500/5 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '9s', animationDelay: '4s' }} />
          <div className="absolute bottom-[20%] right-[5%] w-[500px] h-[500px] bg-gradient-radial from-green-500/8 via-transparent to-transparent blur-3xl animate-pulse" style={{ animationDuration: '12s', animationDelay: '6s' }} />

          {/* Diagonal grid with gaps */}
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 60px, #c0c0c0 60px, #c0c0c0 61px, transparent 61px, transparent 180px)`
          }} />

          {/* Random tiny squares - MORE SQUARES */}
          <div className="absolute inset-0 opacity-[0.08]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='200' viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='22' y='28' width='2.5' height='2.5' fill='%23c0c0c0'/%3E%3Crect x='102' y='16' width='1.8' height='1.8' fill='%23c0c0c0'/%3E%3Crect x='162' y='60' width='2.2' height='2.2' fill='%23c0c0c0'/%3E%3Crect x='42' y='115' width='2.8' height='2.8' fill='%23c0c0c0'/%3E%3Crect x='138' y='148' width='1.8' height='1.8' fill='%23c0c0c0'/%3E%3Crect x='185' y='175' width='2.3' height='2.3' fill='%23c0c0c0'/%3E%3Crect x='68' y='82' width='2' height='2' fill='%23c0c0c0'/%3E%3Crect x='125' y='128' width='2.5' height='2.5' fill='%23c0c0c0'/%3E%3Crect x='8' y='155' width='2.2' height='2.2' fill='%23c0c0c0'/%3E%3Crect x='172' y='38' width='1.9' height='1.9' fill='%23c0c0c0'/%3E%3C/svg%3E")`,
            backgroundSize: '200px 200px'
          }} />

          {/* Subtle crosshairs - MORE CROSSHAIRS */}
          <div className="absolute inset-0 opacity-[0.05]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='280' height='280' viewBox='0 0 280 280' xmlns='http://www.w3.org/2000/svg'%3E%3Cline x1='45' y1='35' x2='45' y2='55' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cline x1='35' y1='45' x2='55' y2='45' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cline x1='205' y1='168' x2='205' y2='188' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cline x1='195' y1='178' x2='215' y2='178' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cline x1='115' y1='95' x2='115' y2='115' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cline x1='105' y1='105' x2='125' y2='105' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cline x1='245' y1='225' x2='245' y2='245' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cline x1='235' y1='235' x2='255' y2='235' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3C/svg%3E")`,
            backgroundSize: '280px 280px'
          }} />

          {/* Additional circuit elements */}
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='190' height='190' viewBox='0 0 190 190' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='30' cy='40' r='3' fill='none' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Ccircle cx='145' cy='75' r='2.5' fill='none' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Ccircle cx='70' cy='130' r='3.5' fill='none' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Ccircle cx='165' cy='160' r='2.8' fill='none' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cpath d='M50 20l5 5-5 5-5-5z' fill='none' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cpath d='M120 95l4 4-4 4-4-4z' fill='none' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3C/svg%3E")`,
            backgroundSize: '190px 190px'
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