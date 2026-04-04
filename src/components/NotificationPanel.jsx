import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { X, Bell, CheckCircle2, AlertCircle, Target, FileWarning, TrendingUp, Zap, Calendar, ExternalLink, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from "@/lib/utils";

const NOTIF_CONFIG = {
  incomplete_trade:  { icon: FileWarning,   color: 'text-amber-400',   bg: 'bg-amber-500/8',   border: 'border-amber-500/25'  },
  risk_violation:    { icon: AlertCircle,   color: 'text-red-400',     bg: 'bg-red-500/8',     border: 'border-red-500/25'    },
  goal_achieved:     { icon: Target,        color: 'text-emerald-400', bg: 'bg-emerald-500/8', border: 'border-emerald-500/25'},
  market_outlook:    { icon: TrendingUp,    color: 'text-violet-400',  bg: 'bg-violet-500/8',  border: 'border-violet-500/25' },
  daily_reminder:    { icon: Calendar,      color: 'text-blue-400',    bg: 'bg-blue-500/8',    border: 'border-blue-500/25'   },
  trade_closed:      { icon: CheckCircle2,  color: 'text-emerald-400', bg: 'bg-emerald-500/8', border: 'border-emerald-500/25'},
  system:            { icon: Zap,           color: 'text-[#888]',      bg: 'bg-white/[0.03]',  border: 'border-white/[0.07]'  },
};

function timeAgo(dateStr, lang) {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return lang === 'ru' ? `${d}д назад` : `${d}d ago`;
    if (h > 0) return lang === 'ru' ? `${h}ч назад` : `${h}h ago`;
    if (m > 0) return lang === 'ru' ? `${m}м назад` : `${m}m ago`;
    return lang === 'ru' ? 'только что' : 'just now';
  } catch { return ''; }
}

export default function NotificationPanel({ open, onOpenChange }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const lang = localStorage.getItem('tradingpro_lang') || 'ru';

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 30 * 60 * 1000,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.Notification.filter({ created_by: user.email, is_closed: false }, '-created_date', 20);
    },
    enabled: !!user?.email,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.update(id, { is_read: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', user?.email] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.delete(id),
    onMutate: (id) => {
      queryClient.setQueryData(['notifications', user?.email], (old) => (old || []).filter(n => n.id !== id));
    },
    onError: () => queryClient.invalidateQueries({ queryKey: ['notifications', user?.email] }),
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(notifications.map(n => base44.entities.Notification.delete(n.id)));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', user?.email] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter(n => !n.is_read);
      await Promise.all(unread.map(n => base44.entities.Notification.update(n.id, { is_read: true })));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', user?.email] }),
  });

  const handleClick = (n) => {
    if (!n.is_read) markReadMutation.mutate(n.id);
    if (n.link_to) { onOpenChange(false); navigate(n.link_to); }
  };

  const unread = notifications.filter(n => !n.is_read).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] sm:w-[420px] p-0 border-l border-white/[0.08] flex flex-col" style={{background:'#090909', boxShadow:'-8px 0 40px rgba(0,0,0,0.6)'}}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <Bell className="w-4 h-4 text-[#888]" />
            <span className="text-[#c0c0c0] font-semibold text-sm">
              {lang === 'ru' ? 'Уведомления' : 'Notifications'}
            </span>
            {unread > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/20 text-violet-400 border border-violet-500/30">
                {unread}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unread > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                className="text-[10px] text-[#555] hover:text-emerald-400 transition-colors px-2 py-1"
              >
                {lang === 'ru' ? 'Прочитать все' : 'Mark all read'}
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={() => clearAllMutation.mutate()}
                className="text-[10px] text-[#555] hover:text-red-400 transition-colors px-2 py-1"
              >
                {lang === 'ru' ? 'Очистить' : 'Clear all'}
              </button>
            )}
            <button onClick={() => onOpenChange(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#555] hover:text-[#c0c0c0] hover:bg-white/[0.05] transition-all ml-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <Bell className="w-10 h-10 text-[#333]" />
              <p className="text-[#555] text-sm">{lang === 'ru' ? 'Нет уведомлений' : 'No notifications'}</p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {notifications.map(n => {
                const cfg = NOTIF_CONFIG[n.type] || NOTIF_CONFIG.system;
                const Icon = cfg.icon;
                return (
                  <div
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={cn(
                      "relative rounded-xl border p-3.5 cursor-pointer transition-all group",
                      cfg.bg, cfg.border,
                      !n.is_read && "shadow-[0_0_12px_rgba(0,0,0,0.3)]",
                      n.link_to && "hover:brightness-110"
                    )}
                  >
                    {/* Unread dot */}
                    {!n.is_read && (
                      <span className="absolute top-3 right-8 w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                    )}

                    {/* Delete btn */}
                    <button
                      onClick={e => { e.stopPropagation(); deleteMutation.mutate(n.id); }}
                      className="absolute top-2.5 right-2.5 w-5 h-5 flex items-center justify-center rounded text-[#555] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X className="w-3 h-3" />
                    </button>

                    <div className="flex gap-3 pr-4">
                      <Icon className={cn("w-4 h-4 shrink-0 mt-0.5", cfg.color)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className={cn("text-xs font-semibold leading-tight", n.is_read ? "text-[#888]" : "text-[#c0c0c0]")}>
                            {n.title}
                          </p>
                          <span className="text-[9px] text-[#555] shrink-0 mt-0.5">{timeAgo(n.created_date, lang)}</span>
                        </div>
                        <p className="text-[11px] text-[#666] leading-relaxed">{n.message}</p>
                        {n.link_to && (
                          <div className={cn("flex items-center gap-1 mt-2 text-[10px] font-medium", cfg.color)}>
                            <ExternalLink className="w-3 h-3" />
                            {lang === 'ru' ? 'Перейти' : 'View'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
