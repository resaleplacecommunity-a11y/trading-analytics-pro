import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Plus, Target, Percent, DollarSign, BarChart3, Image } from 'lucide-react';

// Translation hook
const useTranslation = () => {
  const [lang, setLang] = useState(localStorage.getItem('tradingpro_lang') || 'ru');
  useEffect(() => {
    const handleChange = () => setLang(localStorage.getItem('tradingpro_lang') || 'ru');
    window.addEventListener('languagechange', handleChange);
    return () => window.removeEventListener('languagechange', handleChange);
  }, []);
  return { lang, t: (key) => {
    const tr = {
      ru: {
        dashboard: 'Дашборд', analyticsOverview: 'Обзор Торговли', newTrade: 'Новая Сделка',
        addByPhoto: 'По Фото', balance: 'Баланс', totalPnl: 'Общий PNL', winrate: 'Винрейт',
        avgR: 'Средний R', avgPnl: 'Средний PNL', tradesCount: 'Сделок'
      },
      en: {
        dashboard: 'Dashboard', analyticsOverview: 'Analytics Overview', newTrade: 'New Trade',
        addByPhoto: 'By Photo', balance: 'Balance', totalPnl: 'Total PNL', winrate: 'Winrate',
        avgR: 'Avg R', avgPnl: 'Avg PNL', tradesCount: 'Trades'
      }
    };
    return tr[lang]?.[key] || key;
  }};
};

import StatsCard from '../components/dashboard/StatsCard';
import EquityCurve from '../components/dashboard/EquityCurve';
import PnlChart from '../components/dashboard/PnlChart';
import CoinPerformance from '../components/dashboard/CoinPerformance';
import StrategyPerformance from '../components/dashboard/StrategyPerformance';
import RiskOverviewNew from '../components/dashboard/RiskOverviewNew';
import AIRecommendations from '../components/ai/AIRecommendations';
import BestWorstTrade from '../components/dashboard/BestWorstTrade';
import DisciplinePsychology from '../components/dashboard/DisciplinePsychology';
import MissedOpportunities from '../components/dashboard/MissedOpportunities';
import TradeForm from '../components/trades/TradeForm';
import AgentChatModal from '../components/AgentChatModal';
import RiskViolationBanner from '../components/RiskViolationBanner';
import { formatInTimeZone } from 'date-fns-tz';

export default function Dashboard() {
  const [showAgentChat, setShowAgentChat] = useState(false);
  const [, forceUpdate] = useState();
  const [generatingLogo, setGeneratingLogo] = useState(false);
  const [newLogoUrl, setNewLogoUrl] = useState('');
  const [showLogoPrompt, setShowLogoPrompt] = useState(false);
  const [logoPrompt, setLogoPrompt] = useState('');
  const [referenceImages, setReferenceImages] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const { t } = useTranslation();

  const { data: trades = [], refetch: refetchTrades } = useQuery({
    queryKey: ['trades'],
    queryFn: () => base44.entities.Trade.list('-date', 1000),
  });

  const { data: riskSettings } = useQuery({
    queryKey: ['riskSettings'],
    queryFn: async () => {
      const settings = await base44.entities.RiskSettings.list();
      return settings[0] || null;
    },
  });

  const { data: behaviorLogs = [] } = useQuery({
    queryKey: ['behaviorLogs'],
    queryFn: () => base44.entities.BehaviorLog.list('-date', 100),
  });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // Auto-refresh at midnight in user timezone
  useEffect(() => {
    const userTimezone = user?.preferred_timezone || 'UTC';
    const checkMidnight = () => {
      const now = new Date();
      const currentDay = formatInTimeZone(now, userTimezone, 'yyyy-MM-dd');
      const nextMidnight = new Date(currentDay);
      nextMidnight.setDate(nextMidnight.getDate() + 1);
      nextMidnight.setHours(0, 0, 0, 0);
      
      const msUntilMidnight = nextMidnight.getTime() - now.getTime();
      
      const timer = setTimeout(() => {
        forceUpdate({}); // Force re-render
      }, msUntilMidnight + 1000);
      
      return timer;
    };
    
    const timer = checkMidnight();
    return () => clearTimeout(timer);
  }, [user]);



  // Calculate stats
  const startingBalance = 100000;
  const now = new Date();
  const userTimezone = user?.preferred_timezone || 'UTC';
  const today = formatInTimeZone(now, userTimezone, 'yyyy-MM-dd');
  
  // Only closed trades for metrics
  const closedTrades = trades.filter(t => t.close_price);
  
  const totalPnlUsd = closedTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
  const totalPnlPercent = (totalPnlUsd / startingBalance) * 100;
  
  // Today's closed trades
  const todayClosedTrades = closedTrades.filter(t => {
    if (!t.date_close) return false;
    try {
      const closeDateInUserTz = formatInTimeZone(new Date(t.date_close), userTimezone, 'yyyy-MM-dd');
      return closeDateInUserTz === today;
    } catch {
      return t.date_close.split('T')[0] === today;
    }
  });
  const todayPnl = todayClosedTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
  
  // Daily loss = sum of all negative PNL today (in percent)
  const todayPnlPercent = todayClosedTrades.reduce((s, t) => {
    const pnl = t.pnl_usd || 0;
    if (pnl < 0) {
      const balance = t.account_balance_at_entry || startingBalance;
      return s + ((pnl / balance) * 100);
    }
    return s;
  }, 0);
  
  const todayR = todayClosedTrades.reduce((s, t) => s + (t.r_multiple || 0), 0);

  // Trades opened today (for violations check)
  const todayOpenedTrades = trades.filter(t => {
    const tradeDate = t.date_open || t.date;
    if (!tradeDate) return false;
    try {
      const tradeDateInUserTz = formatInTimeZone(new Date(tradeDate), userTimezone, 'yyyy-MM-dd');
      return tradeDateInUserTz === today;
    } catch {
      return tradeDate.startsWith(today);
    }
  });

  const recentTrades = [...trades].filter(t => t.close_price).sort((a, b) => 
    new Date(b.date_close || b.date) - new Date(a.date_close || a.date)
  ).slice(0, 10);
  const consecutiveLosses = recentTrades.findIndex(t => (t.pnl_usd || 0) >= 0);
  const lossStreak = consecutiveLosses === -1 ? Math.min(recentTrades.length, riskSettings?.max_consecutive_losses || 3) : consecutiveLosses;

  const violations = [];
  if (riskSettings) {
    if (riskSettings.daily_max_loss_percent && todayPnlPercent < -riskSettings.daily_max_loss_percent) {
      violations.push({
        rule: 'Daily Loss Limit',
        value: `${todayPnlPercent.toFixed(2)}%`,
        limit: `${riskSettings.daily_max_loss_percent}%`,
      });
    }
    if (riskSettings.daily_max_r && todayR < -riskSettings.daily_max_r) {
      violations.push({
        rule: 'Daily R Loss',
        value: `${todayR.toFixed(2)}R`,
        limit: `${riskSettings.daily_max_r}R`,
      });
    }
    if (riskSettings.max_trades_per_day && todayOpenedTrades.length >= riskSettings.max_trades_per_day) {
      violations.push({
        rule: 'Max Trades',
        value: `${todayOpenedTrades.length}`,
        limit: `${riskSettings.max_trades_per_day}`,
      });
    }
    if (lossStreak >= (riskSettings.max_consecutive_losses || 3)) {
      violations.push({
        rule: 'Loss Streak',
        value: `${lossStreak} losses`,
        limit: `${riskSettings.max_consecutive_losses}`,
      });
    }
  }
  
  // Winrate calculation - exclude BE trades (±0.5$ or ±0.01%)
  const epsilon = 0.5;
  const wins = closedTrades.filter((t) => {
    const pnl = t.pnl_usd || 0;
    const pnlPercent = Math.abs((pnl / (t.account_balance_at_entry || startingBalance)) * 100);
    return pnl > epsilon && pnlPercent > 0.01;
  });
  const losses = closedTrades.filter((t) => {
    const pnl = t.pnl_usd || 0;
    const pnlPercent = Math.abs((pnl / (t.account_balance_at_entry || startingBalance)) * 100);
    return pnl < -epsilon && pnlPercent > 0.01;
  });
  const winrate = (wins.length + losses.length) > 0 ? ((wins.length / (wins.length + losses.length)) * 100).toFixed(1) : 0;
  
  const avgR = closedTrades.length > 0 ? 
    closedTrades.reduce((s, t) => s + (t.r_multiple || 0), 0) / closedTrades.length : 0;
  const avgPnlPerTrade = closedTrades.length > 0 ? 
    closedTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0) / closedTrades.length : 0;
  const currentBalance = startingBalance + totalPnlUsd;
  
  const formatNumber = (num) => {
    if (num === undefined || num === null || num === '') return '—';
    const n = parseFloat(num);
    if (isNaN(n)) return '—';
    return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
  };

  const handleImageUpload = async (file) => {
    setUploadingImage(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setReferenceImages(prev => [...prev, file_url]);
    } catch (error) {
      console.error('Image upload failed:', error);
    } finally {
      setUploadingImage(false);
    }
  };

  const generateLogo = async () => {
    setGeneratingLogo(true);
    try {
      const basePrompt = "Ultra-modern premium trading logo for 'Trading Pro'. Design features: 1) Five silver metallic ascending bars forming a rising chart pattern with smooth gradients from dark silver to bright platinum, 2) Integrate stylized 'TP' letters geometrically within the rightmost tallest bar, 3) Use brushed metal texture with realistic highlights and shadows for 3D depth, 4) Add subtle emerald green (#10b981) glow/accent on the top of highest bar symbolizing success and profit, 5) Dark charcoal background (#0a0a0a), 6) Professional, minimalist, luxury fintech aesthetic. The bars should have isometric 3D perspective with light coming from top-right. Sharp edges, polished surfaces, premium quality, 8K detail.";
      const finalPrompt = logoPrompt ? `${basePrompt}\n\nДополнительные пожелания: ${logoPrompt}` : basePrompt;
      
      const existingImages = [
        "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69349b30698117be30e537d8/dc2407d5f_59b0e6ba6_logo.png",
        ...referenceImages
      ];
      
      const result = await base44.integrations.Core.GenerateImage({
        prompt: finalPrompt,
        existing_image_urls: existingImages
      });
      setNewLogoUrl(result.url);
      setShowLogoPrompt(false);
      setLogoPrompt('');
      setReferenceImages([]);
    } catch (error) {
      console.error('Logo generation failed:', error);
    } finally {
      setGeneratingLogo(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#c0c0c0]">{t('dashboard')}</h1>
          <p className="text-[#666] text-sm">{t('analyticsOverview')}</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setShowLogoPrompt(!showLogoPrompt)}
            disabled={generatingLogo}
            className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
          >
            <Image className="w-4 h-4 mr-2" />
            {generatingLogo ? 'Генерация...' : 'Улучшить Логотип'}
          </Button>
          <Button 
            onClick={() => setShowAgentChat(true)}
            className="bg-[#c0c0c0] text-black hover:bg-[#a0a0a0]"
          >
            <Plus className="w-4 h-4 mr-2" />
            AI Ассистент
          </Button>
        </div>
      </div>

      {/* Risk Violation Banner */}
      <RiskViolationBanner violations={violations} />

      {/* Logo Prompt Input */}
      {showLogoPrompt && (
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-emerald-500/30 rounded-xl p-4">
          <h3 className="text-emerald-400 font-semibold mb-3">Опишите ваши пожелания к логотипу</h3>
          <textarea
            value={logoPrompt}
            onChange={(e) => setLogoPrompt(e.target.value)}
            placeholder="Например: добавить больше золота, сделать буквы крупнее, изменить цвет на синий..."
            className="w-full h-24 bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3 text-[#c0c0c0] text-sm resize-none focus:outline-none focus:border-emerald-500/50 mb-3"
          />
          
          <div className="mb-3">
            <label className="text-[#888] text-sm mb-2 block">Референсы (необязательно)</label>
            <div className="flex gap-2 flex-wrap mb-2">
              {referenceImages.map((url, i) => (
                <div key={i} className="relative w-20 h-20 bg-[#0d0d0d] rounded-lg overflow-hidden border border-[#2a2a2a]">
                  <img src={url} alt="Reference" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setReferenceImages(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <Button
              onClick={() => document.getElementById('logo-reference-upload').click()}
              disabled={uploadingImage}
              variant="outline"
              size="sm"
              className="border-[#2a2a2a] text-[#888] hover:text-[#c0c0c0]"
            >
              <Image className="w-3 h-3 mr-2" />
              {uploadingImage ? 'Загрузка...' : 'Добавить фото'}
            </Button>
            <input
              id="logo-reference-upload"
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                Array.from(e.target.files || []).forEach(file => handleImageUpload(file));
                e.target.value = '';
              }}
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={generateLogo}
              disabled={generatingLogo}
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              {generatingLogo ? 'Генерация...' : 'Сгенерировать'}
            </Button>
            <Button
              onClick={() => {
                setShowLogoPrompt(false);
                setReferenceImages([]);
              }}
              variant="outline"
              className="border-[#2a2a2a] text-[#888] hover:text-[#c0c0c0]"
            >
              Отмена
            </Button>
          </div>
        </div>
      )}

      {/* New Logo Preview */}
      {newLogoUrl && (
        <div className="bg-gradient-to-br from-emerald-500/20 via-[#0d0d0d] to-emerald-500/10 border-2 border-emerald-500/40 rounded-xl p-6 shadow-[0_0_35px_rgba(16,185,129,0.25)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-emerald-400 font-bold text-lg">✨ Новый Логотип Готов!</h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setNewLogoUrl('')}
              className="text-[#888] hover:text-[#c0c0c0]"
            >
              ✕
            </Button>
          </div>
          <div className="bg-[#0a0a0a] rounded-lg p-8 flex items-center justify-center">
            <img src={newLogoUrl} alt="New Logo" className="max-w-md w-full h-auto" />
          </div>
          <div className="mt-4 flex gap-2 justify-center">
            <Button
              onClick={() => window.open(newLogoUrl, '_blank')}
              className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400"
            >
              Открыть в новой вкладке
            </Button>
            <Button
              onClick={() => {
                const a = document.createElement('a');
                a.href = newLogoUrl;
                a.download = 'trading-pro-logo.png';
                a.click();
              }}
              className="bg-[#c0c0c0] text-black hover:bg-[#a0a0a0]"
            >
              Скачать
            </Button>
          </div>
        </div>
      )}

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <StatsCard 
          title={t('balance')}
          value={`$${formatNumber(currentBalance)}`}
          subtitle={todayPnl !== 0 ? (todayPnl > 0 ? `Today: +$${formatNumber(Math.abs(todayPnl))}` : `Today: -$${formatNumber(Math.abs(todayPnl))}`) : 'Today: $0'}
          subtitleColor={todayPnl > 0 ? 'text-emerald-400' : todayPnl < 0 ? 'text-red-400' : 'text-[#666]'}
          icon={DollarSign}
          className={currentBalance < startingBalance ? "border-red-500/30" : ""}
        />
        <StatsCard 
          title={t('totalPnl')}
          value={totalPnlUsd >= 0 ? `+$${formatNumber(totalPnlUsd)}` : `-$${formatNumber(Math.abs(totalPnlUsd))}`}
          subtitle={`${totalPnlPercent >= 0 ? '+' : ''}${totalPnlPercent.toFixed(2)}%`}
          icon={DollarSign}
          className={totalPnlUsd < 0 ? "border-red-500/30" : ""}
        />
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard 
          title={t('winrate')}
          value={`${winrate}%`}
          icon={Percent}
          valueColor={parseFloat(winrate) > 50 ? 'text-emerald-400' : parseFloat(winrate) < 50 ? 'text-red-400' : 'text-[#c0c0c0]'}
        />
        <StatsCard 
          title={t('avgR')}
          value={`${avgR.toFixed(2)}R`}
          icon={Target}
          valueColor={avgR > 2 ? 'text-emerald-400' : avgR < 2 ? 'text-red-400' : 'text-[#c0c0c0]'}
        />
        <StatsCard 
          title={t('avgPnl')}
          value={avgPnlPerTrade >= 0 ? `+$${formatNumber(avgPnlPerTrade)}` : `-$${formatNumber(Math.abs(avgPnlPerTrade))}`}
          icon={DollarSign}
          className={avgPnlPerTrade < 0 ? "border-red-500/30" : ""}
        />
        <StatsCard 
          title={t('tradesCount')}
          value={trades.length}
          icon={BarChart3}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EquityCurve trades={trades} />
        <PnlChart trades={trades} />
      </div>

      {/* AI & Risk Row - AI expands with col-span-2, Risk stays in place */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AIRecommendations trades={trades} behaviorLogs={behaviorLogs} />
        <div className="lg:col-start-2 lg:row-start-1">
          <RiskOverviewNew trades={trades} riskSettings={riskSettings} behaviorLogs={behaviorLogs} />
        </div>
      </div>

      {/* Discipline & Psychology + Missed Opportunities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DisciplinePsychology trades={closedTrades} />
        <MissedOpportunities trades={closedTrades} />
      </div>

      {/* Performance Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StrategyPerformance trades={closedTrades} />
        <BestWorstTrade trades={closedTrades} />
      </div>

      {/* Coins */}
      <CoinPerformance trades={closedTrades} />

      {/* Agent Chat Modal */}
      {showAgentChat && (
        <AgentChatModal 
          onClose={() => setShowAgentChat(false)}
          onTradeCreated={() => {
            refetchTrades();
            setShowAgentChat(false);
          }}
        />
      )}
    </div>
  );
}