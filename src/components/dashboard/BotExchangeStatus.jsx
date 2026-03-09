import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Wifi, Bot } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from "@/lib/utils";

function StatusDot({ status }) {
  const color =
    status === 'ok' ? 'bg-emerald-400' :
    status === 'error' ? 'bg-red-400' :
    'bg-amber-400';
  return <span className={cn("w-2 h-2 rounded-full inline-block flex-shrink-0", color)} />;
}

export default function BotExchangeStatus() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 30 * 60 * 1000,
  });

  const { data: connections = [] } = useQuery({
    queryKey: ['exchangeConnections', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.ExchangeConnection.filter({ created_by: user.email, is_active: true }, '-created_date', 5);
    },
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: botTokens = [] } = useQuery({
    queryKey: ['botTokens', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.BotApiToken.filter({ created_by: user.email, is_active: true }, '-created_date', 5);
    },
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (connections.length === 0 && botTokens.length === 0) return null;

  return (
    <div className="bg-[#111]/60 border border-[#2a2a2a]/60 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Wifi className="w-4 h-4 text-[#888]" />
        <span className="text-sm font-semibold text-[#c0c0c0]">Connections</span>
      </div>
      <div className="space-y-2">
        {connections.map(conn => (
          <div key={conn.id} className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2.5">
              <StatusDot status={conn.last_status || 'syncing'} />
              <span className="text-sm text-[#c0c0c0]">{conn.name}</span>
              <span className="text-xs text-[#555]">{conn.exchange} · {conn.mode}</span>
            </div>
            <span className="text-xs text-[#444]">
              {conn.last_sync_at ? formatDistanceToNow(new Date(conn.last_sync_at), { addSuffix: true }) : 'Never synced'}
            </span>
          </div>
        ))}
        {botTokens.map(token => (
          <div key={token.id} className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2.5">
              <Bot className="w-3.5 h-3.5 text-violet-400/70 flex-shrink-0" />
              <span className="text-sm text-[#c0c0c0]">{token.name}</span>
              <span className="text-xs text-[#555]">Bot Token</span>
            </div>
            <span className="text-xs text-[#444]">
              {token.last_used_at ? formatDistanceToNow(new Date(token.last_used_at), { addSuffix: true }) : 'Not used yet'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}