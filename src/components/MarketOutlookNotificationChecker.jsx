import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { startOfWeek } from 'date-fns';

export default function MarketOutlookNotificationChecker() {
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: weeklyOutlooks = [] } = useQuery({
    queryKey: ['weeklyOutlooks'],
    queryFn: () => base44.entities.WeeklyOutlook.list('-week_start', 10),
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['notificationSettings'],
    queryFn: () => base44.entities.NotificationSettings.list('-created_date', 1),
  });

  const { data: existingNotifications = [] } = useQuery({
    queryKey: ['marketOutlookNotifications'],
    queryFn: () => base44.entities.Notification.filter({ type: 'market_outlook' }, '-created_date', 10),
  });

  const userSettings = settings[0] || { market_outlook_enabled: true };

  const createNotificationMutation = useMutation({
    mutationFn: (data) => base44.entities.Notification.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications']);
      queryClient.invalidateQueries(['marketOutlookNotifications']);
    },
  });

  useEffect(() => {
    if (!user?.preferred_timezone || !userSettings.market_outlook_enabled) return;

    const checkMarketOutlook = () => {
      const now = new Date();
      const userTz = user.preferred_timezone || 'UTC';
      
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekStartStr = formatInTimeZone(weekStart, userTz, 'yyyy-MM-dd');

      console.log('[MarketOutlook Check]', {
        currentWeekStart: weekStartStr,
        weeklyOutlooks,
        existingNotifications
      });

      // Check if notification already exists for this week
      const notificationExists = existingNotifications.some(n => {
        const isSameWeek = n.created_date && n.created_date.startsWith(weekStartStr);
        const isNotClosed = !n.is_closed;
        return isSameWeek && isNotClosed;
      });

      console.log('[MarketOutlook Check] Notification exists?', notificationExists);

      if (notificationExists) return;

      // Check if current week outlook exists and is completed
      const currentWeek = weeklyOutlooks.find(w => w.week_start === weekStartStr);

      console.log('[MarketOutlook Check] Current week:', currentWeek);

      if (!currentWeek || currentWeek.status !== 'completed') {
        const lang = localStorage.getItem('tradingpro_lang') || 'ru';
        
        console.log('[MarketOutlook Check] Creating notification...');
        
        createNotificationMutation.mutate({
          title: lang === 'ru' ? 'Заполните прогноз на неделю' : 'Fill out weekly market outlook',
          message: lang === 'ru' 
            ? 'Заполните Market Outlook, чтобы торговать по плану.'
            : 'Fill out Market Outlook to trade according to plan.',
          source_page: 'MarketOutlook',
          link_to: '/MarketOutlook',
          type: 'market_outlook',
          is_read: false,
          is_closed: false
        });
      }
    };

    // Check immediately
    checkMarketOutlook();

    // Check every minute for testing
    const interval = setInterval(checkMarketOutlook, 60 * 1000);

    return () => clearInterval(interval);
  }, [user, weeklyOutlooks, userSettings, existingNotifications, createNotificationMutation]);

  return null;
}