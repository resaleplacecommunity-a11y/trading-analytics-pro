import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from 'lucide-react';
import { toast } from "sonner";

const TIMEZONES = [
  // Europe
  { value: 'Europe/Moscow', label: '🇷🇺 Москва (UTC+3)' },
  { value: 'Europe/London', label: '🇬🇧 Лондон (UTC+0)' },
  { value: 'Europe/Paris', label: '🇫🇷 Париж (UTC+1)' },
  { value: 'Europe/Berlin', label: '🇩🇪 Берлин (UTC+1)' },
  { value: 'Europe/Rome', label: '🇮🇹 Рим (UTC+1)' },
  { value: 'Europe/Madrid', label: '🇪🇸 Мадрид (UTC+1)' },
  { value: 'Europe/Athens', label: '🇬🇷 Афины (UTC+2)' },
  { value: 'Europe/Istanbul', label: '🇹🇷 Стамбул (UTC+3)' },
  { value: 'Europe/Warsaw', label: '🇵🇱 Варшава (UTC+1)' },
  { value: 'Europe/Prague', label: '🇨🇿 Прага (UTC+1)' },
  
  // Americas
  { value: 'America/New_York', label: '🇺🇸 Нью-Йорк (UTC-5)' },
  { value: 'America/Los_Angeles', label: '🇺🇸 Лос-Анджелес (UTC-8)' },
  { value: 'America/Chicago', label: '🇺🇸 Чикаго (UTC-6)' },
  { value: 'America/Denver', label: '🇺🇸 Денвер (UTC-7)' },
  { value: 'America/Toronto', label: '🇨🇦 Торонто (UTC-5)' },
  { value: 'America/Vancouver', label: '🇨🇦 Ванкувер (UTC-8)' },
  { value: 'America/Mexico_City', label: '🇲🇽 Мехико (UTC-6)' },
  { value: 'America/Sao_Paulo', label: '🇧🇷 Сан-Паулу (UTC-3)' },
  { value: 'America/Buenos_Aires', label: '🇦🇷 Буэнос-Айрес (UTC-3)' },
  
  // Asia
  { value: 'Asia/Tokyo', label: '🇯🇵 Токио (UTC+9)' },
  { value: 'Asia/Shanghai', label: '🇨🇳 Шанхай (UTC+8)' },
  { value: 'Asia/Hong_Kong', label: '🇭🇰 Гонконг (UTC+8)' },
  { value: 'Asia/Singapore', label: '🇸🇬 Сингапур (UTC+8)' },
  { value: 'Asia/Seoul', label: '🇰🇷 Сеул (UTC+9)' },
  { value: 'Asia/Dubai', label: '🇦🇪 Дубай (UTC+4)' },
  { value: 'Asia/Bangkok', label: '🇹🇭 Бангкок (UTC+7)' },
  { value: 'Asia/Kolkata', label: '🇮🇳 Калькутта (UTC+5:30)' },
  { value: 'Asia/Karachi', label: '🇵🇰 Карачи (UTC+5)' },
  { value: 'Asia/Tashkent', label: '🇺🇿 Ташкент (UTC+5)' },
  { value: 'Asia/Almaty', label: '🇰🇿 Алматы (UTC+6)' },
  { value: 'Asia/Yekaterinburg', label: '🇷🇺 Екатеринбург (UTC+5)' },
  { value: 'Asia/Novosibirsk', label: '🇷🇺 Новосибирск (UTC+7)' },
  
  // Oceania
  { value: 'Australia/Sydney', label: '🇦🇺 Сидней (UTC+11)' },
  { value: 'Australia/Melbourne', label: '🇦🇺 Мельбурн (UTC+11)' },
  { value: 'Pacific/Auckland', label: '🇳🇿 Окленд (UTC+13)' },
  
  // Middle East & Africa
  { value: 'Africa/Cairo', label: '🇪🇬 Каир (UTC+2)' },
  { value: 'Africa/Johannesburg', label: '🇿🇦 Йоханнесбург (UTC+2)' },
  { value: 'Asia/Jerusalem', label: '🇮🇱 Иерусалим (UTC+2)' },
  { value: 'Asia/Riyadh', label: '🇸🇦 Эр-Рияд (UTC+3)' },
];

export default function TimezoneSettings({ compact = false }) {
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const updateTimezoneMutation = useMutation({
    mutationFn: (timezone) => base44.auth.updateMe({ preferred_timezone: timezone }),
    onSuccess: () => {
      queryClient.invalidateQueries(['currentUser']);
      queryClient.invalidateQueries(['trades']);
      toast.success('Часовой пояс обновлён');
      window.dispatchEvent(new Event('timezonechange'));
      setTimeout(() => window.location.reload(), 500);
    },
  });

  const currentTimezone = user?.preferred_timezone;
  const lang = localStorage.getItem('tradingpro_lang') || 'ru';

  if (compact) {
    return (
      <Select
        value={currentTimezone || ''}
        onValueChange={(value) => updateTimezoneMutation.mutate(value)}
      >
        <SelectTrigger className={`bg-[#1a1a1a] border-[#2a2a2a] h-9 w-[180px] ${!currentTimezone ? 'border-amber-500/50 text-amber-400' : 'text-[#c0c0c0]'}`}>
          <Clock className="w-4 h-4 mr-2" />
          <SelectValue placeholder={lang === 'ru' ? '⚠️ Не выбран' : '⚠️ Not set'} />
        </SelectTrigger>
        <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a] max-h-[300px]">
          {TIMEZONES.map((tz) => (
            <SelectItem key={tz.value} value={tz.value} className="text-[#c0c0c0]">
              {tz.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Card className={`bg-[#1a1a1a] ${!currentTimezone ? 'border-amber-500/50' : 'border-[#2a2a2a]'}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#c0c0c0]">
          <Clock className="w-5 h-5" />
          {lang === 'ru' ? 'Часовой пояс' : 'Timezone'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {!currentTimezone && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-3">
              <div className="flex items-start gap-2">
                <span className="text-amber-400 text-lg">⚠️</span>
                <div className="text-sm text-amber-400">
                  {lang === 'ru' 
                    ? 'Важно! Выберите часовой пояс для корректного отображения всех данных.'
                    : 'Important! Select your timezone for accurate data display.'
                  }
                </div>
              </div>
            </div>
          )}
          <Label className="text-[#888]">
            {lang === 'ru' ? 'Выберите часовой пояс для отображения времени' : 'Select timezone for time display'}
          </Label>
          <Select
            value={currentTimezone || ''}
            onValueChange={(value) => updateTimezoneMutation.mutate(value)}
          >
            <SelectTrigger className={`bg-[#151515] border-[#2a2a2a] ${!currentTimezone ? 'border-amber-500/50' : ''}`}>
              <SelectValue placeholder={lang === 'ru' ? 'Выберите часовой пояс...' : 'Select timezone...'} />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a] max-h-[300px]">
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currentTimezone && (
            <p className="text-xs text-[#666]">
              {lang === 'ru' ? 'Текущее время: ' : 'Current time: '}
              {new Date().toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', { timeZone: currentTimezone })}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}