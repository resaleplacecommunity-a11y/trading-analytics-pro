import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, AlertCircle } from 'lucide-react';
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

export default function TimezoneSetupModal({ onComplete }) {
  const [selectedTimezone, setSelectedTimezone] = useState('');
  const queryClient = useQueryClient();
  const lang = localStorage.getItem('tradingpro_lang') || 'ru';

  const updateTimezoneMutation = useMutation({
    mutationFn: (timezone) => base44.auth.updateMe({ preferred_timezone: timezone }),
    onSuccess: () => {
      queryClient.invalidateQueries(['currentUser']);
      toast.success(lang === 'ru' ? 'Часовой пояс установлен' : 'Timezone set');
      setTimeout(() => {
        window.location.reload();
      }, 500);
    },
  });

  const handleSave = () => {
    if (!selectedTimezone) {
      toast.error(lang === 'ru' ? 'Выберите часовой пояс' : 'Select timezone');
      return;
    }
    updateTimezoneMutation.mutate(selectedTimezone);
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-[9999] flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] p-8 max-w-lg w-full">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Clock className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#c0c0c0]">
              {lang === 'ru' ? 'Выберите часовой пояс' : 'Select Timezone'}
            </h2>
            <p className="text-[#888] text-sm">
              {lang === 'ru' ? 'Это важно для корректного отображения данных' : 'Required for accurate data display'}
            </p>
          </div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-[#c0c0c0]">
            {lang === 'ru' 
              ? 'Выберите часовой пояс, в котором вы обычно торгуете. Это повлияет на отображение всех дат и статистики.'
              : 'Choose the timezone you usually trade in. This will affect how all dates and statistics are displayed.'
            }
          </div>
        </div>

        <div className="space-y-4">
          <Select value={selectedTimezone} onValueChange={setSelectedTimezone}>
            <SelectTrigger className="bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0] h-12">
              <SelectValue placeholder={lang === 'ru' ? 'Выберите часовой пояс...' : 'Select timezone...'} />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a] max-h-[300px]">
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value} className="text-[#c0c0c0]">
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedTimezone && (
            <div className="bg-[#111] rounded-lg p-3 border border-[#2a2a2a]">
              <div className="text-xs text-[#666] mb-1">
                {lang === 'ru' ? 'Текущее время:' : 'Current time:'}
              </div>
              <div className="text-[#c0c0c0] font-medium">
                {new Date().toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', { 
                  timeZone: selectedTimezone,
                  dateStyle: 'full',
                  timeStyle: 'short'
                })}
              </div>
            </div>
          )}

          <Button 
            onClick={handleSave}
            disabled={!selectedTimezone || updateTimezoneMutation.isPending}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white h-12 font-medium"
          >
            {updateTimezoneMutation.isPending 
              ? (lang === 'ru' ? 'Сохранение...' : 'Saving...') 
              : (lang === 'ru' ? 'Сохранить и продолжить' : 'Save and Continue')
            }
          </Button>
        </div>
      </div>
    </div>
  );
}