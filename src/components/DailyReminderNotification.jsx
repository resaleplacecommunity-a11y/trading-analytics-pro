import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { playNotificationSound } from './NotificationSound';
import { createPageUrl } from '../utils';

const getLanguage = () => localStorage.getItem('tradingpro_lang') || 'ru';

export default function DailyReminderNotification() {
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => base44.entities.Notification.filter({ is_closed: false }, '-created_date', 10),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  useEffect(() => {
    if (!user?.preferred_timezone) return;

    const checkReminder = async () => {
      const now = new Date();
      const userTz = user.preferred_timezone;
      const hour = parseInt(now.toLocaleString('en-US', { timeZone: userTz, hour: '2-digit', hour12: false }));
      
      // Show at 8:00 in user's timezone
      const today = now.toLocaleDateString('en-CA', { timeZone: userTz }); // YYYY-MM-DD format
      const lastShown = localStorage.getItem('lastDailyReminderShown');
      
      if (hour === 8 && lastShown !== today) {
        // Check if notification already exists for today
        const alreadyExists = notifications.some(n => 
          n.type === 'other' && 
          n.title.includes('Daily Reminder') &&
          n.created_date.startsWith(today)
        );

        if (!alreadyExists) {
          const lang = getLanguage();
          const message = lang === 'ru' 
            ? 'Помни дисциплину. Лучший трейдер — тот, кто соблюдает свои правила.'
            : 'Remember discipline. The best trader is one who follows their rules.';

          try {
            await base44.entities.Notification.create({
              title: lang === 'ru' ? '🌅 Ежедневное Напоминание' : '🌅 Daily Reminder',
              message: message,
              source_page: 'Dashboard',
              link_to: createPageUrl('Dashboard'),
              type: 'other',
              is_read: false,
              is_closed: false
            });

            queryClient.invalidateQueries(['notifications']);
            playNotificationSound('daily_reminder');
            localStorage.setItem('lastDailyReminderShown', today);
          } catch (error) {
            console.error('Failed to create daily reminder:', error);
          }
        }
      }
    };

    checkReminder();
    const interval = setInterval(checkReminder, 5 * 60000); // Check every 5 minutes
    
    return () => clearInterval(interval);
  }, [user, notifications, queryClient]);

  return null;
}