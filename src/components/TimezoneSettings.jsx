import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from 'lucide-react';
import { toast } from "sonner";

const TIMEZONES = [
  { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
  { value: 'Europe/London', label: 'Лондон (UTC+0)' },
  { value: 'America/New_York', label: 'Нью-Йорк (UTC-5)' },
  { value: 'America/Los_Angeles', label: 'Лос-Анджелес (UTC-8)' },
  { value: 'Asia/Tokyo', label: 'Токио (UTC+9)' },
  { value: 'Asia/Shanghai', label: 'Шанхай (UTC+8)' },
  { value: 'Asia/Dubai', label: 'Дубай (UTC+4)' },
  { value: 'Australia/Sydney', label: 'Сидней (UTC+11)' },
];

export default function TimezoneSettings() {
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const updateTimezoneMutation = useMutation({
    mutationFn: (timezone) => base44.auth.updateMe({ preferred_timezone: timezone }),
    onSuccess: () => {
      queryClient.invalidateQueries(['currentUser']);
      toast.success('Часовой пояс обновлён');
      window.dispatchEvent(new Event('timezonechange'));
    },
  });

  const currentTimezone = user?.preferred_timezone || 'Europe/Moscow';

  return (
    <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#c0c0c0]">
          <Clock className="w-5 h-5" />
          Часовой пояс
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Label className="text-[#888]">Выберите часовой пояс для отображения времени</Label>
          <Select
            value={currentTimezone}
            onValueChange={(value) => updateTimezoneMutation.mutate(value)}
          >
            <SelectTrigger className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-[#666]">
            Текущее время: {new Date().toLocaleString('ru-RU', { timeZone: currentTimezone })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}