import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';

export default function TestNotificationsRunner() {
  const [isRunning, setIsRunning] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const runCleanup = async () => {
      if (isRunning) return;
      setIsRunning(true);

      try {
        // Get all market outlook notifications
        const allNotifications = await base44.entities.Notification.list();
        const marketOutlookNotifs = allNotifications.filter(n => n.type === 'market_outlook');
        
        // Delete all of them
        for (const notif of marketOutlookNotifs) {
          await base44.entities.Notification.delete(notif.id);
        }

        console.log(`Deleted ${marketOutlookNotifs.length} old market outlook notifications`);
        
        // Refresh notifications
        queryClient.invalidateQueries(['notifications']);
      } catch (error) {
        console.error('Failed to clean up notifications:', error);
      } finally {
        setIsRunning(false);
      }
    };

    // Run once on mount
    const timer = setTimeout(runCleanup, 2000);
    return () => clearTimeout(timer);
  }, []);

  return null;
}