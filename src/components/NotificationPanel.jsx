import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { X, ExternalLink, AlertCircle, CheckCircle2, Target, FileWarning } from 'lucide-react';
import { createPageUrl } from '../utils';
import { useNavigate } from 'react-router-dom';
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from 'date-fns';
import { ru, enUS } from 'date-fns/locale';

const getNotificationIcon = (type) => {
  switch (type) {
    case 'incomplete_trade':
      return <FileWarning className="w-5 h-5 text-amber-400" />;
    case 'risk_violation':
      return <AlertCircle className="w-5 h-5 text-red-400" />;
    case 'goal_achieved':
      return <Target className="w-5 h-5 text-emerald-400" />;
    default:
      return <CheckCircle2 className="w-5 h-5 text-blue-400" />;
  }
};

const getNotificationColor = (type) => {
  switch (type) {
    case 'incomplete_trade':
      return 'border-amber-500/30 bg-amber-500/5';
    case 'risk_violation':
      return 'border-red-500/30 bg-red-500/5';
    case 'goal_achieved':
      return 'border-emerald-500/30 bg-emerald-500/5';
    default:
      return 'border-blue-500/30 bg-blue-500/5';
  }
};

export default function NotificationPanel({ open, onOpenChange }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const lang = localStorage.getItem('tradingpro_lang') || 'ru';

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => base44.entities.Notification.filter({ is_closed: false }, '-created_date', 10),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const closeNotificationMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.update(id, { is_closed: true }),
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications']);
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      // Optimistically clear all from UI
      queryClient.setQueryData(['notifications'], []);
      
      // Delete all notifications with error handling
      const promises = notifications.map(n => 
        base44.entities.Notification.delete(n.id).catch(err => {
          console.warn(`Failed to delete notification ${n.id}:`, err);
          return null;
        })
      );
      return await Promise.all(promises);
    },
    onError: () => {
      // Refetch on error to restore correct state
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.update(id, { is_read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications']);
    },
  });

  const handleNavigate = (notification) => {
    if (notification.link_to) {
      markAsReadMutation.mutate(notification.id);
      onOpenChange(false);
      navigate(notification.link_to);
    }
  };

  const handleClose = async (e, id) => {
    e.stopPropagation();
    
    // Optimistically remove from UI
    queryClient.setQueryData(['notifications'], (old) => 
      (old || []).filter(n => n.id !== id)
    );
    
    // Delete notification permanently
    try {
      await base44.entities.Notification.delete(id);
    } catch (err) {
      console.warn(`Failed to delete notification ${id}:`, err);
      // Refetch to restore correct state
      queryClient.invalidateQueries(['notifications']);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px] bg-[#0a0a0a] border-l border-[#2a2a2a] p-0">
        <SheetHeader className="p-6 border-b border-[#2a2a2a]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SheetTitle className="text-[#c0c0c0] text-xl">
                {lang === 'ru' ? 'Уведомления' : 'Notifications'}
              </SheetTitle>
              {unreadCount > 0 && (
                <span className="px-2.5 py-1 bg-violet-500/20 text-violet-400 rounded-full text-xs font-bold">
                  {unreadCount} {lang === 'ru' ? 'новых' : 'new'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => clearAllMutation.mutate()}
                  disabled={clearAllMutation.isPending}
                  className="text-[#888] hover:text-[#c0c0c0] text-xs"
                >
                  {clearAllMutation.isPending ? '...' : (lang === 'ru' ? 'Очистить все' : 'Clear all')}
                </Button>
              )}
              <button
                onClick={() => onOpenChange(false)}
                className="text-white hover:text-[#c0c0c0] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-100px)]">
          <div className="p-4 space-y-3">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-[#444] mb-3" />
                <p className="text-[#666]">
                  {lang === 'ru' ? 'Нет уведомлений' : 'No notifications'}
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "relative rounded-xl border-2 p-4 transition-all hover:border-[#3a3a3a] cursor-pointer",
                    getNotificationColor(notification.type),
                    !notification.is_read && "shadow-lg"
                  )}
                  onClick={() => handleNavigate(notification)}
                >
                  <button
                    onClick={(e) => handleClose(e, notification.id)}
                    className="absolute top-3 right-3 text-[#666] hover:text-[#c0c0c0] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div className="flex gap-3 pr-6">
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h4 className="text-[#c0c0c0] font-bold text-sm">
                          {notification.title}
                        </h4>
                        {!notification.is_read && (
                          <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" />
                        )}
                      </div>
                      
                      <p className="text-[#888] text-xs leading-relaxed">
                        {notification.message}
                      </p>

                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-3 text-[#666] text-xs">
                          <span className="font-medium">{notification.source_page}</span>
                          <span>•</span>
                          <span>
                            {formatDistanceToNow(new Date(notification.created_date), {
                              addSuffix: true,
                              locale: lang === 'ru' ? ru : enUS
                            })}
                          </span>
                        </div>

                        {notification.link_to && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-violet-400 hover:text-violet-300 hover:bg-violet-500/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNavigate(notification);
                            }}
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            {lang === 'ru' ? 'Перейти' : 'Go'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}