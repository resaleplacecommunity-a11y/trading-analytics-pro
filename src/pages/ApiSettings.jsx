import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plug, CheckCircle, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from "sonner";

const useTranslation = () => {
  const [lang, setLang] = useState(localStorage.getItem('tradingpro_lang') || 'ru');
  useEffect(() => {
    const h = () => setLang(localStorage.getItem('tradingpro_lang') || 'ru');
    window.addEventListener('languagechange', h);
    return () => window.removeEventListener('languagechange', h);
  }, []);
  return { lang, t: (k) => {
    const tr = {
      ru: { bybitApi: 'Интеграция Bybit API', apiKey: 'API Ключ', apiSecret: 'API Секрет', connect: 'Подключить', disconnect: 'Отключить', syncTrades: 'Синхронизировать Сделки', openPositions: 'Открытые Позиции', closedTrades: 'Закрытые Сделки', status: 'Статус', connected: 'Подключено', notConnected: 'Не Подключено', lastSync: 'Последняя Синхронизация' },
      en: { bybitApi: 'Bybit API Integration', apiKey: 'API Key', apiSecret: 'API Secret', connect: 'Connect', disconnect: 'Disconnect', syncTrades: 'Sync Trades', openPositions: 'Open Positions', closedTrades: 'Closed Trades', status: 'Status', connected: 'Connected', notConnected: 'Not Connected', lastSync: 'Last Sync' }
    };
    return tr[lang]?.[k] || k;
  }};
};

export default function ApiSettings() {
  const [formData, setFormData] = useState({ api_key: '', api_secret: '' });
  const [syncing, setSyncing] = useState(false);
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: apiSettings = [] } = useQuery({
    queryKey: ['apiSettings'],
    queryFn: () => base44.entities.ApiSettings.list(),
  });

  const currentSettings = apiSettings[0];

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (currentSettings) {
        return base44.entities.ApiSettings.update(currentSettings.id, data);
      } else {
        return base44.entities.ApiSettings.create({ ...data, exchange: 'bybit', is_active: true });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['apiSettings']);
      toast.success(t('connected'));
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => base44.entities.ApiSettings.update(currentSettings.id, { is_active: false }),
    onSuccess: () => {
      queryClient.invalidateQueries(['apiSettings']);
      toast.success(t('disconnect'));
    },
  });

  const syncTrades = async () => {
    if (!currentSettings?.is_active) {
      toast.error('API не подключен');
      return;
    }
    
    setSyncing(true);
    try {
      const { data } = await base44.functions.invoke('syncBybitTrades');
      
      // Display all notifications from sync
      if (data.notifications && Array.isArray(data.notifications)) {
        data.notifications.forEach(notif => {
          if (notif.startsWith('✅')) {
            toast.success(notif);
          } else if (notif.startsWith('⚠️')) {
            toast.warning(notif);
          } else if (notif.startsWith('❌')) {
            toast.error(notif, { duration: 6000 });
          } else {
            toast.info(notif);
          }
        });
      }
      
      if (data.error) {
        toast.error(data.error, { duration: 6000 });
      } else if (data.message) {
        toast.success(data.message);
      }
      
      queryClient.invalidateQueries(['apiSettings']);
      queryClient.invalidateQueries(['trades']);
    } catch (err) {
      toast.error('Ошибка синхронизации: ' + err.message, { duration: 6000 });
    }
    setSyncing(false);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-[#c0c0c0]">{t('bybitApi')}</h1>
        <p className="text-[#666] text-sm">Автоматический импорт сделок с Bybit</p>
      </div>

      {/* Status Card */}
      <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#c0c0c0]">
            <Plug className="w-5 h-5" />
            {t('status')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {currentSettings?.is_active ? (
                <>
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                  <div>
                    <p className="text-emerald-400 font-medium">{t('connected')}</p>
                    {currentSettings.last_sync && (
                      <p className="text-[#666] text-xs">
                        {t('lastSync')}: {new Date(currentSettings.last_sync).toLocaleString()}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="w-8 h-8 text-red-400" />
                  <div>
                    <p className="text-red-400 font-medium">{t('notConnected')}</p>
                    <p className="text-[#666] text-xs">Введите API ключи для подключения</p>
                  </div>
                </>
              )}
            </div>
            {currentSettings?.is_active && (
              <div className="flex gap-2">
                <Button 
                  onClick={syncTrades}
                  disabled={syncing}
                  className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                  {t('syncTrades')}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => disconnectMutation.mutate()}
                  className="border-red-500/30 text-red-400"
                >
                  {t('disconnect')}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* API Credentials */}
      {!currentSettings?.is_active && (
        <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
          <CardHeader>
            <CardTitle className="text-[#c0c0c0]">Подключение API</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
              <div className="text-sm text-amber-200">
                <p className="font-medium mb-1">Важно:</p>
                <p>Используйте API ключ только с правами read-only (чтение). Никогда не давайте права на торговлю или вывод средств.</p>
              </div>
            </div>

            <div>
              <Label className="text-[#888]">{t('apiKey')}</Label>
              <Input 
                type="password"
                value={formData.api_key}
                onChange={(e) => setFormData({...formData, api_key: e.target.value})}
                className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] mt-1"
                placeholder="Введите API Key"
              />
            </div>

            <div>
              <Label className="text-[#888]">{t('apiSecret')}</Label>
              <Input 
                type="password"
                value={formData.api_secret}
                onChange={(e) => setFormData({...formData, api_secret: e.target.value})}
                className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] mt-1"
                placeholder="Введите API Secret"
              />
            </div>

            <Button 
              onClick={() => saveMutation.mutate(formData)}
              disabled={!formData.api_key || !formData.api_secret}
              className="w-full bg-[#c0c0c0] text-black hover:bg-[#a0a0a0]"
            >
              {t('connect')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
        <CardHeader>
          <CardTitle className="text-[#c0c0c0]">Как получить API ключи Bybit</CardTitle>
        </CardHeader>
        <CardContent className="text-[#888] text-sm space-y-2">
          <p>1. Войдите в свой аккаунт Bybit</p>
          <p>2. Перейдите в: Профиль → API Management</p>
          <p>3. Создайте новый API ключ</p>
          <p>4. Выберите права доступа: <strong className="text-[#c0c0c0]">Read Only</strong></p>
          <p>5. Скопируйте API Key и Secret</p>
          <p>6. Вставьте их в форму выше</p>
        </CardContent>
      </Card>
    </div>
  );
}