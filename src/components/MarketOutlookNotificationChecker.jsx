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
    staleTime: 30 * 60 * 1000,
  });

  const { data: weeklyOutlooks = [] } = useQuery({
    queryKey: ['weeklyOutlooks'],
    queryFn: () => base44.entities.WeeklyOutlook.list('-week_start', 5),
    staleTime: 24 * 60 * 60 * 1000, // Cache for 24 hours
    refetchOnWindowFocus: false,
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['notificationSettings'],
    queryFn: () => base44.entities.NotificationSettings.list('-created_date', 1),
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });

  const { data: existingNotifications = [] } = useQuery({
    queryKey: ['marketOutlookNotifications'],
    queryFn: () => base44.entities.Notification.filter({ type: 'market_outlook' }, '-created_date', 10),
    staleTime: 0,
    refetchOnWindowFocus: false,
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

      // Check if notification already exists for THIS WEEK (not just today)
      const notificationExistsThisWeek = existingNotifications.some(n => {
        const notifCreatedDate = new Date(n.created_date);
        const notifWeekStart = startOfWeek(notifCreatedDate, { weekStartsOn: 1 });
        const notifWeekStartStr = formatInTimeZone(notifWeekStart, userTz, 'yyyy-MM-dd');
        return notifWeekStartStr === weekStartStr && !n.is_closed;
      });

      if (notificationExistsThisWeek) return;

      // Check if current week outlook exists and is completed
      const currentWeek = weeklyOutlooks.find(w => w.week_start === weekStartStr);

      if (!currentWeek || currentWeek.status !== 'completed') {
        const lang = user.preferred_language || localStorage.getItem('tradingpro_lang') || 'en';
        
        createNotificationMutation.mutate({
          title: lang === 'ru' ? '📊 Заполните прогноз на неделю' : '📊 Fill in weekly outlook',
          message: lang === 'ru' 
            ? `Не забудьте заполнить прогноз на неделю ${weekStartStr}. Подготовка — ключ к успеху.`
            : `Don't forget to fill in the outlook for week ${weekStartStr}. Preparation is key to success.`,
          source_page: 'MarketOutlook',
          link_to: '/MarketOutlook',
          type: 'market_outlook',
          is_read: false,
          is_closed: false
        });
      }
    };

    // Check once when component mounts
    checkMarketOutlook();

    // Check once per day (every 24 hours)
    const interval = setInterval(checkMarketOutlook, 24 * 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user, weeklyOutlooks, userSettings, existingNotifications, createNotificationMutation]);

  return null;
}