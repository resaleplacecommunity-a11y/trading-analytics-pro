import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

export default function TestNotificationsRunner() {
  const [executed, setExecuted] = useState(false);

  useEffect(() => {
    const runTest = async () => {
      if (!executed) {
        try {
          const response = await base44.functions.invoke('sendTestNotifications', {});
          console.log('Test notifications created:', response.data);
          setExecuted(true);
          // Reload to show new notifications
          setTimeout(() => window.location.reload(), 1000);
        } catch (error) {
          console.error('Error creating test notifications:', error);
        }
      }
    };

    runTest();
  }, [executed]);

  return null;
}