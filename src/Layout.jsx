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

          {/* Chaotic grid layer 1 - varies wildly */}
          <div className="absolute inset-0 opacity-[0.11]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='200' viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='g1' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:rgb(192,192,192);stop-opacity:0.5' /%3E%3Cstop offset='100%25' style='stop-color:rgb(100,200,150);stop-opacity:0.3' /%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M0 45Q15 38 32 47T68 39Q92 54 115 42T165 50Q185 58 200 52' stroke='url(%23g1)' fill='none' stroke-width='1.1'/%3E%3Cpath d='M0 92Q22 85 45 95T88 82Q118 101 148 89T200 98' stroke='url(%23g1)' fill='none' stroke-width='1.1'/%3E%3Cpath d='M0 148Q28 138 58 151T105 135Q142 156 178 142T200 152' stroke='url(%23g1)' fill='none' stroke-width='1.1'/%3E%3Cpath d='M45 0Q38 22 47 45T39 88Q54 118 42 148T50 200' stroke='url(%23g1)' fill='none' stroke-width='1.1'/%3E%3Cpath d='M115 0Q105 28 118 58T98 105Q125 142 108 178T122 200' stroke='url(%23g1)' fill='none' stroke-width='1.1'/%3E%3C/svg%3E")`,
            backgroundSize: '200px 200px'
          }} />
          
          {/* Chaotic grid layer 2 - different pattern */}
          <div className="absolute inset-0 opacity-[0.14]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='180' height='180' viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='g2' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:rgb(150,192,170);stop-opacity:0.5' /%3E%3Cstop offset='100%25' style='stop-color:rgb(16,185,129);stop-opacity:0.7' /%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M0 38Q18 31 38 42T72 33Q98 48 125 37T180 45' stroke='url(%23g2)' fill='none' stroke-width='1.2'/%3E%3Cpath d='M0 88Q25 78 52 91T95 76Q128 96 158 84T180 93' stroke='url(%23g2)' fill='none' stroke-width='1.2'/%3E%3Cpath d='M0 135Q32 122 65 138T112 119Q148 142 180 128' stroke='url(%23g2)' fill='none' stroke-width='1.2'/%3E%3Cpath d='M38 0Q31 25 42 52T33 95Q48 128 37 158T45 180' stroke='url(%23g2)' fill='none' stroke-width='1.2'/%3E%3Cpath d='M125 0Q112 32 128 65T108 112Q135 148 118 180' stroke='url(%23g2)' fill='none' stroke-width='1.2'/%3E%3C/svg%3E")`,
            backgroundSize: '180px 180px',
            transform: 'translate(45px, 30px)'
          }} />
          
          {/* Chaotic grid layer 3 - most green at bottom */}
          <div className="absolute inset-0 opacity-[0.16]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='220' height='220' viewBox='0 0 220 220' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='g3' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:rgb(100,200,150);stop-opacity:0.6' /%3E%3Cstop offset='100%25' style='stop-color:rgb(16,211,129);stop-opacity:0.9' /%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M0 52Q28 42 58 55T105 44Q145 65 185 52T220 62' stroke='url(%23g3)' fill='none' stroke-width='1.3'/%3E%3Cpath d='M0 115Q38 102 78 118T135 98Q182 125 220 112' stroke='url(%23g3)' fill='none' stroke-width='1.3'/%3E%3Cpath d='M0 172Q48 155 95 175T158 152Q195 178 220 165' stroke='url(%23g3)' fill='none' stroke-width='1.3'/%3E%3Cpath d='M52 0Q42 38 55 78T44 135Q65 182 52 220' stroke='url(%23g3)' fill='none' stroke-width='1.3'/%3E%3Cpath d='M145 0Q128 48 148 95T122 158Q155 195 138 220' stroke='url(%23g3)' fill='none' stroke-width='1.3'/%3E%3C/svg%3E")`,
            backgroundSize: '220px 220px',
            transform: 'translate(80px, 60px)'
          }} />
          
          {/* Random additional layer - completely different */}
          <div className="absolute inset-0 opacity-[0.09]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='250' height='250' viewBox='0 0 250 250' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='g4' x1='0%25' y1='50%25' x2='100%25' y2='50%25'%3E%3Cstop offset='0%25' style='stop-color:rgb(192,192,192);stop-opacity:0.4' /%3E%3Cstop offset='50%25' style='stop-color:rgb(16,185,129);stop-opacity:0.6' /%3E%3Cstop offset='100%25' style='stop-color:rgb(192,192,192);stop-opacity:0.4' /%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M0 68Q35 55 72 71T142 58Q188 82 250 68' stroke='url(%23g4)' fill='none' stroke-width='1'/%3E%3Cpath d='M0 155Q48 138 98 158T195 142Q230 165 250 152' stroke='url(%23g4)' fill='none' stroke-width='1'/%3E%3Cpath d='M68 0Q55 48 71 98T58 195Q82 230 68 250' stroke='url(%23g4)' fill='none' stroke-width='1'/%3E%3Cpath d='M182 0Q165 52 185 108T162 205Q192 240 178 250' stroke='url(%23g4)' fill='none' stroke-width='1'/%3E%3C/svg%3E")`,
            backgroundSize: '250px 250px',
            transform: 'translate(120px, 45px)'
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