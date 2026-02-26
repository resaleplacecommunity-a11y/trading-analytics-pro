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
  const [connecting, setConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles', user?.email],
    queryFn: async () => {
      if (!user) return [];
      return base44.entities.UserProfile.filter({ created_by: user.email });
    },
    enabled: !!user,
  });

  const activeProfile = profiles.find(p => p.is_active);

  const { data: apiSettings = [] } = useQuery({
    queryKey: ['apiSettings', activeProfile?.id],
    queryFn: async () => {
      if (!activeProfile) return [];
      return base44.entities.ApiSettings.filter({ 
        created_by: user.email,
        profile_id: activeProfile.id 
      });
    },
    enabled: !!activeProfile,
  });

  const currentSettings = apiSettings[0];

  const handleConnect = async () => {
    if (!formData.api_key || !formData.api_secret) {
      toast.error('Enter both API Key and Secret');
      return;
    }

    if (!activeProfile) {
      toast.error('No active profile found');
      return;
    }

    setConnecting(true);
    setConnectionStatus(null);

    try {
      const { data } = await base44.functions.invoke('connectBybit', {
        apiKey: formData.api_key,
        apiSecret: formData.api_secret,
        environment: 'mainnet',
        profileId: activeProfile.id
      });

      setConnectionStatus(data);

      if (data.ok && data.connected) {
        toast.success(data.message);
        setFormData({ api_key: '', api_secret: '' });
        queryClient.invalidateQueries(['apiSettings']);
      } else {
        toast.error(data.message, { duration: 6000 });
      }
    } catch (error) {
      console.error('[ApiSettings] Connection error:', error);
      setConnectionStatus({
        ok: false,
        connected: false,
        message: 'Unexpected error occurred',
        errorCode: 'UNEXPECTED_ERROR',
        nextStep: 'Try again or contact support',
        lastCheckedAt: new Date().toISOString()
      });
      toast.error('Failed to connect. Try again.');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!currentSettings) return;
    
    try {
      await base44.entities.ApiSettings.update(currentSettings.id, { 
        is_active: false,
        last_sync: new Date().toISOString()
      });
      queryClient.invalidateQueries(['apiSettings']);
      setConnectionStatus(null);
      toast.success(t('disconnect'));
    } catch (error) {
      toast.error('Failed to disconnect');
    }
  };

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
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {currentSettings?.is_active ? (
                  <>
                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                    <div>
                      <p className="text-emerald-400 font-medium">{t('connected')}</p>
                      {currentSettings.last_sync && (
                        <p className="text-[#666] text-xs">
                          Last checked: {new Date(currentSettings.last_sync).toLocaleString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      )}
                    </div>
                  </>
                ) : connectionStatus?.ok === false ? (
                  <>
                    <XCircle className="w-8 h-8 text-red-400" />
                    <div>
                      <p className="text-red-400 font-medium">Error</p>
                      <p className="text-[#888] text-xs">{connectionStatus.message}</p>
                      <p className="text-[#666] text-xs mt-1">→ {connectionStatus.nextStep}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="w-8 h-8 text-[#666]" />
                    <div>
                      <p className="text-[#888] font-medium">{t('notConnected')}</p>
                      <p className="text-[#666] text-xs">Enter API credentials to connect</p>
                    </div>
                  </>
                )}
              </div>
              {currentSettings?.is_active && (
                <div className="flex gap-2">
                  <Button 
                    onClick={syncTrades}
                    disabled={syncing}
                    className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                    {t('syncTrades')}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={handleDisconnect}
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                  >
                    {t('disconnect')}
                  </Button>
                </div>
              )}
            </div>

            {/* Connection status from last test */}
            {connectionStatus && connectionStatus.lastCheckedAt && (
              <div className={`p-3 rounded-lg border text-xs ${
                connectionStatus.ok 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}>
                <p className="font-medium">{connectionStatus.message}</p>
                {connectionStatus.nextStep && (
                  <p className="text-[#888] mt-1">→ {connectionStatus.nextStep}</p>
                )}
                <p className="text-[#666] mt-1">
                  Tested: {new Date(connectionStatus.lastCheckedAt).toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
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
              onClick={handleConnect}
              disabled={!formData.api_key || !formData.api_secret || connecting}
              className="w-full bg-[#c0c0c0] text-black hover:bg-[#a0a0a0] relative"
            >
              {connecting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Testing connection...
                </>
              ) : (
                t('connect')
              )}
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