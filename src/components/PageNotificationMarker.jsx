import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const PAGE_TO_NOTIFICATION_TYPE = {
  'Trades': 'incomplete_trade',
  'RiskManager': 'risk_violation',
  'Focus': 'goal_achieved',
  'MarketOutlook': 'market_outlook'
};

export default function PageNotificationMarker({ currentPageName }) {
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => base44.entities.Notification.filter({ is_closed: false }, '-created_date', 50),
  });

  const markAsReadMutation = useMutation({
    mutationFn: (notificationId) => 
      base44.entities.Notification.update(notificationId, { is_read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications']);
    },
  });

  useEffect(() => {
    const notificationType = PAGE_TO_NOTIFICATION_TYPE[currentPageName];
    if (!notificationType) return;

    const pageNotifications = notifications.filter(n => 
      n.type === notificationType && !n.is_read
    );

    pageNotifications.forEach(notification => {
      markAsReadMutation.mutate(notification.id);
    });
  }, [currentPageName, notifications]);

  return null;
}