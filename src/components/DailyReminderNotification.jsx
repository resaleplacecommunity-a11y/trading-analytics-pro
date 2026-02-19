import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { playNotificationSound } from './NotificationSound';
import { createPageUrl } from '../utils';

const getLanguage = (user) => user?.preferred_language || localStorage.getItem('tradingpro_lang') || 'en';
const DAILY_REMINDER_HOUR = 8;
const DAILY_REMINDER_MINUTE = 0;
const DAILY_REMINDER_WINDOW_MINUTES = 15;

const getDatePartsInTimezone = (date, timeZone) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    dateKey: `${map.year}-${map.month}-${map.day}`,
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
};

const isNotificationInDate = (notificationDate, dateKey, timeZone) => {
  if (!notificationDate) return false;
  const createdAt = new Date(notificationDate);
  if (Number.isNaN(createdAt.getTime())) return false;
  const createdDateKey = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(createdAt);
  return createdDateKey === dateKey;
};

export default function DailyReminderNotification() {
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 30 * 60 * 1000,
    cacheTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!user?.preferred_timezone || !user?.email) return;

    const checkReminder = async () => {
      const now = new Date();
      const userTz = user.preferred_timezone;
      const { dateKey: today, hour, minute } = getDatePartsInTimezone(now, userTz);
      const lastShown = localStorage.getItem(`dailyReminder_${user.email}`);

      const totalMinutesNow = hour * 60 + minute;
      const totalMinutesSchedule = DAILY_REMINDER_HOUR * 60 + DAILY_REMINDER_MINUTE;
      const isReminderWindow =
        totalMinutesNow >= totalMinutesSchedule &&
        totalMinutesNow < totalMinutesSchedule + DAILY_REMINDER_WINDOW_MINUTES;
      
      // Fire only in the configured reminder window
      if (!isReminderWindow) return;

      // Local cache guard: do not recreate if already processed today
      if (lastShown === today) return;

      // Fetch fresh notifications to avoid duplicates across tabs/devices.
      const latestNotifications = await base44.entities.Notification.filter(
        { created_by: user.email },
        '-created_date',
        50
      );

      const todayReminders = latestNotifications.filter((n) =>
        n.type === 'daily_reminder' &&
        n.created_by === user.email &&
        isNotificationInDate(n.created_date, today, userTz)
      );

      if (todayReminders.length === 0) {
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
        // If we already have a reminder for today, just mark local cache.
        localStorage.setItem(`dailyReminder_${user.email}`, today);

        // Cleanup duplicates created earlier.
        if (todayReminders.length > 1) {
          const [keep, ...duplicates] = todayReminders;
          for (const duplicate of duplicates) {
            if (duplicate.id !== keep.id && !duplicate.is_closed) {
              try {
                await base44.entities.Notification.update(duplicate.id, { is_closed: true });
              } catch (e) {
                console.error('Failed to close duplicate reminder:', e);
              }
            }
          }
        }
      }

      // Auto-close previous day reminders
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', { timeZone: userTz });
      const oldReminders = latestNotifications.filter(n =>
        n.type === 'daily_reminder' &&
        n.created_by === user.email &&
        isNotificationInDate(n.created_date, yesterday, userTz) &&
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
    const interval = setInterval(checkReminder, 60000); // Check every minute around schedule
    
    return () => clearInterval(interval);
  }, [user, queryClient]);

  return null;
}
