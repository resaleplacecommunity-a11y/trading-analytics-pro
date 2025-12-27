import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle2, Target, FileWarning } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { playNotificationSound } from './NotificationSound';

let lastNotificationId = null;

export default function NotificationToast() {
  const navigate = useNavigate();
  const lang = localStorage.getItem('tradingpro_lang') || 'ru';

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => base44.entities.Notification.filter({ is_closed: false }, '-created_date', 10),
    refetchInterval: 5000, // Poll every 5 seconds
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['notificationSettings'],
    queryFn: () => base44.entities.NotificationSettings.list('-created_date', 1),
  });

  const userSettings = settings[0] || {
    incomplete_trade_enabled: true,
    risk_violation_enabled: true,
    goal_achieved_enabled: true,
    market_outlook_enabled: true,
    sound_enabled: true
  };

  useEffect(() => {
    if (notifications.length === 0) return;

    const latestNotification = notifications[0];
    
    // Show toast only for new notifications
    if (latestNotification.id !== lastNotificationId) {
      lastNotificationId = latestNotification.id;

      // Check if this type of notification is enabled
      const typeEnabledMap = {
        incomplete_trade: userSettings.incomplete_trade_enabled,
        risk_violation: userSettings.risk_violation_enabled,
        goal_achieved: userSettings.goal_achieved_enabled,
        market_outlook: userSettings.market_outlook_enabled
      };

      if (!typeEnabledMap[latestNotification.type]) {
        return;
      }

      // Play sound if enabled
      if (userSettings.sound_enabled) {
        playNotificationSound(latestNotification.type);
      }

      const getIcon = (type) => {
        switch (type) {
          case 'incomplete_trade':
            return <FileWarning className="w-5 h-5" />;
          case 'risk_violation':
            return <AlertCircle className="w-5 h-5" />;
          case 'goal_achieved':
            return <Target className="w-5 h-5" />;
          default:
            return <CheckCircle2 className="w-5 h-5" />;
        }
      };

      const toastStyles = {
        incomplete_trade: { className: 'bg-gradient-to-r from-amber-500/20 to-amber-600/20 border-amber-500/50 text-amber-100' },
        risk_violation: { className: 'bg-gradient-to-r from-red-500/20 to-red-600/20 border-red-500/50 text-red-100' },
        goal_achieved: { className: 'bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 border-emerald-500/50 text-emerald-100' },
        other: { className: 'bg-gradient-to-r from-blue-500/20 to-blue-600/20 border-blue-500/50 text-blue-100' }
      };

      toast(
        <div className="flex items-start gap-3 p-1">
          <div className="flex-shrink-0 mt-0.5">
            {getIcon(latestNotification.type)}
          </div>
          <div className="flex-1">
            <div className="font-bold text-sm mb-1">{latestNotification.title}</div>
            <div className="text-xs opacity-90">{latestNotification.message}</div>
            {latestNotification.link_to && (
              <button
                onClick={() => navigate(latestNotification.link_to)}
                className="text-xs underline mt-2 opacity-80 hover:opacity-100"
              >
                {lang === 'ru' ? 'Перейти →' : 'Go →'}
              </button>
            )}
          </div>
        </div>,
        {
          duration: 4000,
          ...toastStyles[latestNotification.type] || toastStyles.other,
        }
      );
    }
  }, [notifications, navigate, lang]);

  return null;
}