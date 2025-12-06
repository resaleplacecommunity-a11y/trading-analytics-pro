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
import EmotionTrend from '../components/dashboard/EmotionTrend';
import RiskOverview from '../components/dashboard/RiskOverview';
import AIRecommendations from '../components/ai/AIRecommendations';
import TradeForm from '../components/trades/TradeForm';

export default function Dashboard() {
  const [showTradeForm, setShowTradeForm] = useState(false);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
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

  // Calculate stats
  const totalPnlUsd = trades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
  const totalPnlPercent = trades.reduce((s, t) => s + (t.pnl_percent || 0), 0);
  const wins = trades.filter(t => (t.pnl_usd || 0) > 0).length;
  const winrate = trades.length > 0 ? (wins / trades.length * 100).toFixed(1) : 0;
  const avgR = trades.length > 0 ? 
    trades.reduce((s, t) => s + (t.r_multiple || 0), 0) / trades.length : 0;
  const avgPnlPerTrade = trades.length > 0 ? totalPnlUsd / trades.length : 0;
  
  // Balance (starting balance + total PNL)
  const startingBalance = 10000; // можно сделать настраиваемым
  const currentBalance = startingBalance + totalPnlUsd;

  const handleSaveTrade = async (tradeData) => {
    await base44.entities.Trade.create(tradeData);
    refetchTrades();
    setShowTradeForm(false);
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
            onClick={() => setShowPhotoUpload(true)}
            variant="outline"
            className="border-[#2a2a2a] text-[#888]"
          >
            <Image className="w-4 h-4 mr-2" />
            {t('addByPhoto')}
          </Button>
          <Button 
            onClick={() => setShowTradeForm(true)}
            className="bg-[#c0c0c0] text-black hover:bg-[#a0a0a0]"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('newTrade')}
          </Button>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatsCard 
          title={t('balance')}
          value={`$${currentBalance.toFixed(2)}`}
          icon={DollarSign}
        />
        <StatsCard 
          title={t('totalPnl')}
          value={`${totalPnlUsd >= 0 ? '+' : ''}$${totalPnlUsd.toFixed(2)}`}
          subtitle={`${totalPnlPercent >= 0 ? '+' : ''}${totalPnlPercent.toFixed(2)}%`}
          icon={DollarSign}
        />
        <StatsCard 
          title={t('winrate')}
          value={`${winrate}%`}
          subtitle={`${wins}W / ${trades.length - wins}L`}
          icon={Percent}
        />
        <StatsCard 
          title={t('avgR')}
          value={`${avgR.toFixed(2)}R`}
          icon={Target}
        />
        <StatsCard 
          title={t('avgPnl')}
          value={`${avgPnlPerTrade >= 0 ? '+' : ''}$${avgPnlPerTrade.toFixed(2)}`}
          icon={DollarSign}
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

      {/* AI & Risk Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AIRecommendations trades={trades} behaviorLogs={behaviorLogs} />
        <RiskOverview trades={trades} riskSettings={riskSettings} behaviorLogs={behaviorLogs} />
      </div>

      {/* Performance Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StrategyPerformance trades={trades} />
        <EmotionTrend trades={trades} />
      </div>

      {/* Coins */}
      <CoinPerformance trades={trades} />

      {/* Trade Form Modal */}
      {showTradeForm && (
        <TradeForm 
          onSubmit={handleSaveTrade}
          onClose={() => setShowTradeForm(false)}
        />
      )}
      
      {/* Photo Upload Modal */}
      {showPhotoUpload && (
        <PhotoUploadModal
          onClose={() => setShowPhotoUpload(false)}
          onTradeExtracted={(tradeData) => {
            setShowPhotoUpload(false);
            handleSaveTrade(tradeData);
          }}
        />
      )}
    </div>
  );
}

// Photo Upload Component
function PhotoUploadModal({ onClose, onTradeExtracted }) {
  const [uploading, setUploading] = useState(false);
  const [extractedData, setExtractedData] = useState(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      // Extract data using AI
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract trading data from this screenshot. Return JSON with: coin, direction (Long/Short), entry_price, position_size, stop_price, take_price, close_price (if visible)`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            coin: { type: "string" },
            direction: { type: "string" },
            entry_price: { type: "number" },
            position_size: { type: "number" },
            stop_price: { type: "number" },
            take_price: { type: "number" },
            close_price: { type: "number" }
          }
        }
      });
      
      setExtractedData({ ...result, screenshot_url: file_url, date: new Date().toISOString() });
    } catch (err) {
      console.error('Failed to extract:', err);
    }
    setUploading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] w-full max-w-md p-6">
        <h3 className="text-[#c0c0c0] font-semibold mb-4">Добавить Сделку по Фото</h3>
        
        {!extractedData ? (
          <div>
            <label className="flex flex-col items-center gap-3 p-8 border-2 border-dashed border-[#2a2a2a] rounded-xl cursor-pointer hover:border-[#3a3a3a] transition-colors">
              <Image className="w-12 h-12 text-[#666]" />
              <span className="text-[#888]">{uploading ? 'Загрузка и анализ...' : 'Загрузить скриншот'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
            </label>
            <Button onClick={onClose} variant="ghost" className="w-full mt-4">Отмена</Button>
          </div>
        ) : (
          <div>
            <div className="space-y-2 mb-4 text-sm">
              <p className="text-[#888]">Монета: <span className="text-[#c0c0c0]">{extractedData.coin}</span></p>
              <p className="text-[#888]">Направление: <span className="text-[#c0c0c0]">{extractedData.direction}</span></p>
              <p className="text-[#888]">Вход: <span className="text-[#c0c0c0]">${extractedData.entry_price}</span></p>
              <p className="text-[#888]">Размер: <span className="text-[#c0c0c0]">${extractedData.position_size}</span></p>
            </div>
            <div className="flex gap-2">
              <Button onClick={onClose} variant="ghost" className="flex-1">Отмена</Button>
              <Button onClick={() => onTradeExtracted(extractedData)} className="flex-1 bg-[#c0c0c0] text-black">
                Подтвердить
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}