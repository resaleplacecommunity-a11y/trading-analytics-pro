import { useState } from 'react';
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bot, Plus, Copy, Trash2, Eye, EyeOff, RefreshCw, Key, Shield } from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function generateToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return 'tpro_' + Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const SCOPE_LABELS = {
  read:  { ru: 'только чтение', en: 'read only',  color: 'bg-blue-500/20 text-blue-400' },
  write: { ru: 'чтение + запись', en: 'read + write', color: 'bg-emerald-500/20 text-emerald-400' },
  admin: { ru: 'полный доступ', en: 'full access', color: 'bg-violet-500/20 text-violet-400' },
};

export default function BotApiTokensSection({ profileId, lang }) {
  const queryClient = useQueryClient();
  const { confirm: confirmDialog, Dialog: ConfirmDialogComponent } = useConfirm();
  const [newName, setNewName] = useState('');
  const [newScope, setNewScope] = useState('write');
  // newlyCreated: { id, plaintext } — shown once after creation
  const [newlyCreated, setNewlyCreated] = useState(null);

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
      if (!newName.trim()) throw new Error(lang === 'ru' ? 'Введите название' : 'Enter a name');
      const plaintext = generateToken();
      const hash = await sha256hex(plaintext);
      const created = await base44.entities.BotApiToken.create({
        name: newName.trim(),
        token_hash: hash,
        token: null, // never store plaintext
        profile_id: profileId,
        scope: newScope,
        is_active: true,
        created_by: user?.email,
        permissions: JSON.stringify(newScope === 'read' ? ['read'] : ['read', 'trade']), // backward compat
      });
      return { created, plaintext };
    },
    onSuccess: ({ created, plaintext }) => {
      queryClient.invalidateQueries(['botApiTokens']);
      setNewName('');
      setNewlyCreated({ id: created.id, plaintext });
      toast.success(lang === 'ru' ? 'Токен создан — скопируйте сейчас!' : 'Token created — copy it now!', { duration: 6000 });
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Bot className="w-5 h-5 text-emerald-400" />
        <h2 className="text-lg font-bold text-[#c0c0c0]">
          {lang === 'ru' ? 'API токены (tradingApiV2)' : 'API Tokens (tradingApiV2)'}
        </h2>
      </div>

      {/* API info */}
      <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl p-4 space-y-1.5">
        <p className="text-xs text-[#666] font-medium">
          {lang === 'ru' ? 'Endpoint:' : 'Endpoint:'}
        </p>
        <code className="block text-[10px] text-emerald-400 bg-[#111] border border-[#1a1a1a] rounded px-2 py-1.5 overflow-x-auto">
          Dashboard → Code → Functions → tradingApiV2
        </code>
        <p className="text-[10px] text-[#555]">
          {lang === 'ru'
            ? 'Authorization: Bearer tpro_... | Токены хранятся только в виде SHA-256 хэша'
            : 'Authorization: Bearer tpro_... | Tokens stored as SHA-256 hash only'}
        </p>
        <div className="text-[10px] text-[#555] space-y-0.5 pt-1">
          <p>GET /health &nbsp;• GET /profiles &nbsp;• GET /trades &nbsp;• GET /stats</p>
          <p>POST /trades &nbsp;• PATCH /trades/:id &nbsp;• POST /trades/:id/close</p>
          <p>POST /connections/test &nbsp;• POST /connections/sync</p>
        </div>
      </div>

      {/* Newly created — one-time display */}
      {newlyCreated && (
        <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-4 space-y-2">
          <p className="text-amber-400 font-semibold text-sm flex items-center gap-2">
            <Key className="w-4 h-4" />
            {lang === 'ru' ? '⚠️ Скопируйте токен — он больше не будет показан!' : '⚠️ Copy the token — it will not be shown again!'}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] text-emerald-300 bg-[#111] border border-emerald-500/30 rounded-lg px-3 py-2 overflow-x-auto whitespace-nowrap font-mono">
              {newlyCreated.plaintext}
            </code>
            <Button size="sm" onClick={() => copyToken(newlyCreated.plaintext)} className="h-8 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30">
              <Copy className="w-3.5 h-3.5 mr-1" />
              {lang === 'ru' ? 'Копировать' : 'Copy'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNewlyCreated(null)} className="h-8 text-[#555] hover:text-[#888]">
              ✕
            </Button>
          </div>
        </div>
      )}

      {/* Create form */}
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={lang === 'ru' ? 'Название (напр. MyBot v1)' : 'Name (e.g. MyBot v1)'}
          className="bg-[#0a0a0a] border-[#2a2a2a] text-[#c0c0c0] h-9 text-sm"
          onKeyDown={(e) => e.key === 'Enter' && createMutation.mutate()}
        />
        <select
          value={newScope}
          onChange={(e) => setNewScope(e.target.value)}
          className="bg-[#0a0a0a] border border-[#2a2a2a] text-[#c0c0c0] h-9 text-xs rounded-md px-2"
        >
          <option value="read">{lang === 'ru' ? 'read' : 'read'}</option>
          <option value="write">{lang === 'ru' ? 'write' : 'write'}</option>
          <option value="admin">{lang === 'ru' ? 'admin' : 'admin'}</option>
        </select>
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
          {tokens.map(t => {
            const scopeInfo = SCOPE_LABELS[t.scope || 'write'];
            return (
              <div key={t.id} className={cn(
                "bg-[#0a0a0a] border rounded-xl p-4 space-y-2 transition-colors",
                t.is_active ? "border-[#2a2a2a]" : "border-[#1a1a1a] opacity-50"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[#c0c0c0] font-medium text-sm">{t.name}</span>
                    <Badge className={cn("text-[10px] px-1.5 py-0", t.is_active ? "bg-emerald-500/20 text-emerald-400" : "bg-[#2a2a2a] text-[#666]")}>
                      {t.is_active ? (lang === 'ru' ? 'активен' : 'active') : (lang === 'ru' ? 'откл' : 'off')}
                    </Badge>
                    {t.scope && (
                      <Badge className={cn("text-[10px] px-1.5 py-0", scopeInfo.color)}>
                        <Shield className="w-2.5 h-2.5 mr-1" />
                        {scopeInfo[lang === 'ru' ? 'ru' : 'en']}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleMutation.mutate({ id: t.id, is_active: !t.is_active })}
                      className="text-xs px-2 py-1 rounded-lg border border-[#2a2a2a] text-[#666] hover:text-[#c0c0c0] transition-colors"
                    >
                      {t.is_active ? (lang === 'ru' ? 'Откл.' : 'Disable') : (lang === 'ru' ? 'Вкл.' : 'Enable')}
                    </button>
                    <button
                      onClick={async () => {
                        const ok = await confirmDialog(lang === 'ru' ? 'Удалить токен?' : 'Delete token?');
                        if (ok) deleteMutation.mutate(t.id);
                      }}
                      className="p-1.5 rounded-lg text-[#555] hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Token value — only show if this is newly created and has plaintext, else show hash hint */}
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[10px] text-[#555] bg-[#111] border border-[#1a1a1a] rounded-lg px-3 py-1.5 overflow-x-auto whitespace-nowrap font-mono">
                    {t.token_hash
                      ? `sha256: ${t.token_hash.slice(0, 16)}...`
                      : (lang === 'ru' ? '(токен скрыт — сохранён только хэш)' : '(token hidden — only hash stored)')}
                  </code>
                </div>

                {t.last_used_at && (
                  <p className="text-[10px] text-[#555]">
                    {lang === 'ru' ? 'Последнее использование:' : 'Last used:'} {new Date(t.last_used_at).toLocaleString()}
                  </p>
                )}
                {t.profile_id && (
                  <p className="text-[10px] text-[#444]">
                    profile_id: {t.profile_id.slice(0, 8)}...
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
      <ConfirmDialogComponent />
    </div>
  );
}