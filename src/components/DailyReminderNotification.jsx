import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { playNotificationSound } from './NotificationSound';
import { createPageUrl } from '../utils';

const getLanguage = (user) => user?.preferred_language || localStorage.getItem('tradingpro_lang') || 'en';

export default function DailyReminderNotification() {
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 30 * 60 * 1000,
    cacheTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.Notification.filter({ 
        created_by: user.email, 
        is_closed: false 
      }, '-created_date', 20);
    },
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!user?.preferred_timezone || !user?.email) return;

    const checkReminder = async () => {
      const now = new Date();
      const userTz = user.preferred_timezone;
      const today = now.toLocaleDateString('en-CA', { timeZone: userTz });
      const lastShown = localStorage.getItem(`dailyReminder_${user.email}`);
      
      // Only create ONE daily reminder per day per user
      if (lastShown === today) return;

      // Check if today's reminder exists
      const todayReminder = notifications.find(n => 
        n.type === 'daily_reminder' && 
        n.created_by === user.email &&
        n.created_date?.startsWith(today)
      );

      if (!todayReminder) {
        const lang = getLanguage(user);
        const message = lang === 'ru' 
          ? 'Помни дисциплину. Лучший трейдер — тот, кто соблюдает свои правила.'
          : 'Remember discipline. The best trader is one who follows their rules.';

        try {
          await base44.entities.Notification.create({
            title: lang === 'ru' ? '🌅 Ежедневное Напоминание' : '🌅 Daily Reminder',
            message: message,
            source_page: 'Dashboard',
            link_to: createPageUrl('Dashboard'),
            type: 'daily_reminder',
            is_read: false,
            is_closed: false
          });

          queryClient.invalidateQueries(['notifications']);
          playNotificationSound('daily_reminder');
          localStorage.setItem(`dailyReminder_${user.email}`, today);
        } catch (error) {
          console.error('Failed to create daily reminder:', error);
        }
      } else {
        localStorage.setItem(`dailyReminder_${user.email}`, today);
      }

      // Auto-close previous day reminders
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', { timeZone: userTz });
      const oldReminders = notifications.filter(n =>
        n.type === 'daily_reminder' &&
        n.created_by === user.email &&
        n.created_date?.startsWith(yesterday) &&
        !n.is_closed
      );

      for (const reminder of oldReminders) {
        try {
          await base44.entities.Notification.update(reminder.id, { is_closed: true });
        } catch (e) {
          console.error('Failed to close old reminder:', e);
        }
      }
    };

    checkReminder();
    const interval = setInterval(checkReminder, 10 * 60000); // Check every 10 minutes
    
    return () => clearInterval(interval);
  }, [user, notifications, queryClient]);

  return null;
}