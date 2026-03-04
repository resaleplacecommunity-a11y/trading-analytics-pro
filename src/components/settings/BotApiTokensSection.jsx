import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bot, Plus, Copy, Trash2, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function generateToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return 'tpro_' + Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function BotApiTokensSection({ profileId, lang }) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [visibleTokens, setVisibleTokens] = useState({});

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 30 * 60 * 1000,
  });

  const { data: tokens = [], isLoading } = useQuery({
    queryKey: ['botApiTokens', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.BotApiToken.filter({ created_by: user.email }, '-created_date', 20);
    },
    enabled: !!user?.email,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!newName.trim()) throw new Error('Enter a name');
      return base44.entities.BotApiToken.create({
        name: newName.trim(),
        token: generateToken(),
        profile_id: profileId,
        is_active: true,
        permissions: JSON.stringify(['read', 'trade']),
      });
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries(['botApiTokens']);
      setNewName('');
      setVisibleTokens(prev => ({ ...prev, [created.id]: true }));
      toast.success(lang === 'ru' ? 'Токен создан' : 'Token created');
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.BotApiToken.update(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries(['botApiTokens']),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.BotApiToken.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['botApiTokens']);
      toast.success(lang === 'ru' ? 'Токен удалён' : 'Token deleted');
    },
  });

  const copyToken = (token) => {
    navigator.clipboard.writeText(token);
    toast.success(lang === 'ru' ? 'Скопировано!' : 'Copied!');
  };

  const toggleVisible = (id) => {
    setVisibleTokens(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Get function URL hint
  const appId = typeof BASE44_APP_ID !== 'undefined' ? BASE44_APP_ID : '';
  const apiUrl = `https://api.base44.com/api/apps/${appId}/functions/botApi`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Bot className="w-5 h-5 text-emerald-400" />
        <h2 className="text-lg font-bold text-[#c0c0c0]">
          {lang === 'ru' ? 'API для внешних ботов' : 'Bot API Tokens'}
        </h2>
      </div>

      {/* API URL info */}
      <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl p-4 space-y-2">
        <p className="text-xs text-[#666]">
          {lang === 'ru' ? 'Базовый URL API (использовать в боте):' : 'Base API URL (use in your bot):'}
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-[10px] text-emerald-400 bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 overflow-x-auto whitespace-nowrap">
            Dashboard → Code → Functions → botApi
          </code>
        </div>
        <div className="text-[10px] text-[#555] space-y-0.5">
          <p>• <span className="text-[#888]">Authorization: Bearer &lt;token&gt;</span></p>
          <p>• GET /trades/open &nbsp;• GET /trades/closed &nbsp;• GET /stats</p>
          <p>• POST /trades &nbsp;• PATCH /trades/:id &nbsp;• POST /trades/:id/close</p>
        </div>
      </div>

      {/* Create new */}
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={lang === 'ru' ? 'Название бота (напр. TradingBot v1)' : 'Bot name (e.g. TradingBot v1)'}
          className="bg-[#0a0a0a] border-[#2a2a2a] text-[#c0c0c0] h-9 text-sm"
          onKeyDown={(e) => e.key === 'Enter' && createMutation.mutate()}
        />
        <Button
          onClick={() => createMutation.mutate()}
          disabled={!newName.trim() || createMutation.isPending}
          size="sm"
          className="h-9 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 whitespace-nowrap"
        >
          <Plus className="w-4 h-4 mr-1" />
          {lang === 'ru' ? 'Создать' : 'Create'}
        </Button>
      </div>

      {/* Token list */}
      {isLoading ? (
        <div className="text-[#555] text-sm text-center py-4">
          <RefreshCw className="w-4 h-4 animate-spin mx-auto" />
        </div>
      ) : tokens.length === 0 ? (
        <p className="text-[#555] text-sm text-center py-4">
          {lang === 'ru' ? 'Нет токенов. Создайте первый.' : 'No tokens yet. Create one.'}
        </p>
      ) : (
        <div className="space-y-2">
          {tokens.map(t => (
            <div key={t.id} className={cn(
              "bg-[#0a0a0a] border rounded-xl p-4 space-y-2 transition-colors",
              t.is_active ? "border-[#2a2a2a]" : "border-[#1a1a1a] opacity-60"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[#c0c0c0] font-medium text-sm">{t.name}</span>
                  <Badge className={cn(
                    "text-[10px] px-1.5 py-0",
                    t.is_active ? "bg-emerald-500/20 text-emerald-400" : "bg-[#2a2a2a] text-[#666]"
                  )}>
                    {t.is_active ? (lang === 'ru' ? 'активен' : 'active') : (lang === 'ru' ? 'отключён' : 'disabled')}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleMutation.mutate({ id: t.id, is_active: !t.is_active })}
                    className="text-xs px-2 py-1 rounded-lg border border-[#2a2a2a] text-[#666] hover:text-[#c0c0c0] transition-colors"
                  >
                    {t.is_active ? (lang === 'ru' ? 'Откл.' : 'Disable') : (lang === 'ru' ? 'Вкл.' : 'Enable')}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(lang === 'ru' ? 'Удалить токен?' : 'Delete token?')) {
                        deleteMutation.mutate(t.id);
                      }
                    }}
                    className="p-1.5 rounded-lg text-[#555] hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Token value */}
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[10px] text-[#888] bg-[#111] border border-[#1a1a1a] rounded-lg px-3 py-1.5 overflow-x-auto whitespace-nowrap">
                  {visibleTokens[t.id] ? t.token : '••••••••••••••••••••••••••••••••••••••••••••'}
                </code>
                <button onClick={() => toggleVisible(t.id)} className="p-1.5 text-[#555] hover:text-[#c0c0c0]">
                  {visibleTokens[t.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => copyToken(t.token)} className="p-1.5 text-[#555] hover:text-emerald-400">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>

              {t.last_used_at && (
                <p className="text-[10px] text-[#555]">
                  {lang === 'ru' ? 'Последнее использование:' : 'Last used:'} {new Date(t.last_used_at).toLocaleString()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}