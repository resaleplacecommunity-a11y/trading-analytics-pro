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

          {/* Complex geometric constellation - creates abstract silhouettes */}
          <div className="absolute inset-0 opacity-[0.09]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='250' height='250' viewBox='0 0 250 250' xmlns='http://www.w3.org/2000/svg'%3E%3Cpolygon points='30,20 45,15 50,30 40,40 25,35' fill='none' stroke='%23c0c0c0' stroke-width='0.6'/%3E%3Cpolygon points='180,40 195,50 190,70 175,75 170,55' fill='none' stroke='%23c0c0c0' stroke-width='0.6'/%3E%3Cpolygon points='60,120 80,115 85,135 75,145 55,140' fill='none' stroke='%23c0c0c0' stroke-width='0.7'/%3E%3Cpolygon points='200,180 215,185 210,205 195,200' fill='none' stroke='%23c0c0c0' stroke-width='0.6'/%3E%3Cpolyline points='45,60 55,65 60,75 50,80' fill='none' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cpolyline points='140,100 155,110 150,125' fill='none' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cline x1='35' y1='25' x2='50' y2='32' stroke='%23c0c0c0' stroke-width='0.4' stroke-dasharray='2,3'/%3E%3Cline x1='175' y1='60' x2='185' y2='70' stroke='%23c0c0c0' stroke-width='0.4' stroke-dasharray='2,3'/%3E%3Cline x1='70' y1='130' x2='80' y2='140' stroke='%23c0c0c0' stroke-width='0.4' stroke-dasharray='2,3'/%3E%3C/svg%3E")`,
            backgroundSize: '250px 250px'
          }} />

          {/* Triangular formations - mountain/arrow silhouettes */}
          <div className="absolute inset-0 opacity-[0.07]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='220' height='220' viewBox='0 0 220 220' xmlns='http://www.w3.org/2000/svg'%3E%3Cpolygon points='40,60 60,30 80,60' fill='none' stroke='%23c0c0c0' stroke-width='0.7'/%3E%3Cpolygon points='150,90 165,70 180,90' fill='none' stroke='%23c0c0c0' stroke-width='0.6'/%3E%3Cpolygon points='70,160 85,140 100,160' fill='none' stroke='%23c0c0c0' stroke-width='0.7'/%3E%3Cpolygon points='190,180 200,165 210,180' fill='none' stroke='%23c0c0c0' stroke-width='0.6'/%3E%3Cpolygon points='25,130 35,115 45,130 35,145' fill='none' stroke='%23c0c0c0' stroke-width='0.6'/%3E%3Cpolygon points='125,45 135,30 145,45 135,60' fill='none' stroke='%23c0c0c0' stroke-width='0.6'/%3E%3C/svg%3E")`,
            backgroundSize: '220px 220px'
          }} />

          {/* Scattered stars and crosses - cosmic feel */}
          <div className="absolute inset-0 opacity-[0.08]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='200' viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30,40 L32,38 L34,40 L32,42 Z' fill='%23c0c0c0'/%3E%3Cpath d='M150,25 L153,22 L156,25 L153,28 Z' fill='%23c0c0c0'/%3E%3Cpath d='M85,110 L88,107 L91,110 L88,113 Z' fill='%23c0c0c0'/%3E%3Cpath d='M175,165 L177,163 L179,165 L177,167 Z' fill='%23c0c0c0'/%3E%3Cline x1='55' y1='70' x2='65' y2='70' stroke='%23c0c0c0' stroke-width='0.7'/%3E%3Cline x1='60' y1='65' x2='60' y2='75' stroke='%23c0c0c0' stroke-width='0.7'/%3E%3Cline x1='130' y1='145' x2='140' y2='145' stroke='%23c0c0c0' stroke-width='0.7'/%3E%3Cline x1='135' y1='140' x2='135' y2='150' stroke='%23c0c0c0' stroke-width='0.7'/%3E%3Ccircle cx='45' cy='155' r='1.5' fill='%23c0c0c0'/%3E%3Ccircle cx='165' cy='85' r='1.3' fill='%23c0c0c0'/%3E%3Ccircle cx='105' cy='180' r='1.4' fill='%23c0c0c0'/%3E%3C/svg%3E")`,
            backgroundSize: '200px 200px'
          }} />

          {/* Interlocking hexagons - tech pattern */}
          <div className="absolute inset-0 opacity-[0.06]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='180' height='180' viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M40 30l12 6.93v13.86L40 58l-12-6.93V37.21z' fill='none' stroke='%23c0c0c0' stroke-width='0.6'/%3E%3Cpath d='M130 70l10 5.77v11.55l-10 5.77-10-5.77V75.77z' fill='none' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cpath d='M75 130l11 6.35v12.7L75 155l-11-6.35v-12.7z' fill='none' stroke='%23c0c0c0' stroke-width='0.6'/%3E%3Cpath d='M155 145l8 4.62v9.24l-8 4.62-8-4.62v-9.24z' fill='none' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cline x1='40' y1='30' x2='55' y2='38' stroke='%23c0c0c0' stroke-width='0.3' stroke-dasharray='1,2'/%3E%3Cline x1='130' y1='70' x2='145' y2='78' stroke='%23c0c0c0' stroke-width='0.3' stroke-dasharray='1,2'/%3E%3C/svg%3E")`,
            backgroundSize: '180px 180px'
          }} />

          {/* Silver glows at top/middle */}
          <div className="absolute top-[10%] right-[25%] w-[650px] h-[650px] bg-gradient-radial from-[#c0c0c0]/14 via-[#888]/7 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '7s' }} />
          <div className="absolute top-[5%] left-[35%] w-[550px] h-[550px] bg-gradient-radial from-[#a0a0a0]/16 via-[#666]/8 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '9s', animationDelay: '2s' }} />
          <div className="absolute top-[35%] right-[15%] w-[450px] h-[450px] bg-gradient-radial from-[#888]/12 via-transparent to-transparent blur-3xl animate-pulse" style={{ animationDuration: '11s', animationDelay: '5s' }} />

          {/* GREEN GLOWS - Much more visible at bottom */}
          <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-gradient-radial from-emerald-500/25 via-emerald-500/12 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '8s', animationDelay: '1s' }} />
          <div className="absolute bottom-[8%] right-[20%] w-[700px] h-[700px] bg-gradient-radial from-emerald-400/22 via-emerald-500/10 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '10s', animationDelay: '3s' }} />
          <div className="absolute bottom-[5%] left-[40%] w-[650px] h-[650px] bg-gradient-radial from-emerald-600/18 via-emerald-500/9 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '9s', animationDelay: '4s' }} />
          <div className="absolute bottom-[15%] right-[5%] w-[600px] h-[600px] bg-gradient-radial from-green-500/20 via-green-400/8 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '12s', animationDelay: '6s' }} />
          <div className="absolute bottom-[10%] left-[15%] w-[550px] h-[550px] bg-gradient-radial from-emerald-300/16 via-transparent to-transparent blur-3xl animate-pulse" style={{ animationDuration: '10s', animationDelay: '7s' }} />

          {/* Circuit board interconnections */}
          <div className="absolute inset-0 opacity-[0.05]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='240' height='240' viewBox='0 0 240 240' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M40 50h30v20h-30z' fill='none' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Ccircle cx='85' cy='60' r='3' fill='none' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cline x1='70' y1='60' x2='82' y2='60' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cpath d='M170 120h25v15h-25z' fill='none' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Ccircle cx='210' cy='127.5' r='2.5' fill='none' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Cline x1='195' y1='127.5' x2='207.5' y2='127.5' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Crect x='60' y='180' width='15' height='15' fill='none' stroke='%23c0c0c0' stroke-width='0.5'/%3E%3Ccircle cx='67.5' cy='187.5' r='2' fill='%23c0c0c0'/%3E%3C/svg%3E")`,
            backgroundSize: '240px 240px'
          }} />

          {/* Abstract constellation connections */}
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='280' height='280' viewBox='0 0 280 280' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='50' cy='60' r='2' fill='%23c0c0c0'/%3E%3Ccircle cx='90' cy='45' r='1.5' fill='%23c0c0c0'/%3E%3Ccircle cx='110' cy='75' r='1.8' fill='%23c0c0c0'/%3E%3Cline x1='50' y1='60' x2='90' y2='45' stroke='%23c0c0c0' stroke-width='0.3' opacity='0.6'/%3E%3Cline x1='90' y1='45' x2='110' y2='75' stroke='%23c0c0c0' stroke-width='0.3' opacity='0.6'/%3E%3Cline x1='110' y1='75' x2='50' y2='60' stroke='%23c0c0c0' stroke-width='0.3' opacity='0.6'/%3E%3Ccircle cx='190' cy='170' r='2' fill='%23c0c0c0'/%3E%3Ccircle cx='225' cy='155' r='1.6' fill='%23c0c0c0'/%3E%3Ccircle cx='240' cy='190' r='1.8' fill='%23c0c0c0'/%3E%3Cline x1='190' y1='170' x2='225' y2='155' stroke='%23c0c0c0' stroke-width='0.3' opacity='0.6'/%3E%3Cline x1='225' y1='155' x2='240' y2='190' stroke='%23c0c0c0' stroke-width='0.3' opacity='0.6'/%3E%3C/svg%3E")`,
            backgroundSize: '280px 280px'
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