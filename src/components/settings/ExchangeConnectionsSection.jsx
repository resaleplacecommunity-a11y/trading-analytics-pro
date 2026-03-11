import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Plug, Plus, Trash2, RefreshCw, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, Eye, EyeOff, Loader2, Zap
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ImportModeDialog from './ImportModeDialog';

const EXCHANGES = [
  { id: 'bybit', label: 'Bybit', logo: '🟡' },
  // future: { id: 'binance', label: 'Binance', logo: '🟨' },
  // future: { id: 'okx', label: 'OKX', logo: '⚫' },
];

const MODES = [
  { id: 'demo', label: 'Demo', labelRu: 'Демо' },
  { id: 'real', label: 'Real', labelRu: 'Реальный' },
];

export default function ExchangeConnectionsSection({ profileId, lang }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    exchange: 'bybit',
    mode: 'demo',
    api_key: '',
    api_secret: '',
    import_history: true,
    history_limit: 500,
  });
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [syncingId, setSyncingId] = useState(null);
  const [importDialog, setImportDialog] = useState(null); // { id, name }

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['exchangeConnections', profileId],
    queryFn: async () => {
      if (!profileId) return [];
      // Pass profile_id directly — backend detects list request by presence of profile_id without api_key/name
      const res = await base44.functions.invoke('exchangeConnectionsApi', { profile_id: profileId });
      return res.data?.connections || [];
    },
    enabled: !!profileId,
    staleTime: 20_000,
    refetchInterval: 30_000,
  });

  const testMutation = async () => {
    if (!form.api_key || !form.api_secret) {
      toast.error(lang === 'ru' ? 'Введите API Key и Secret' : 'Enter API Key and Secret');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await base44.functions.invoke('exchangeConnectionsApi', {
        _path: 'connections/test',
        api_key: form.api_key,
        api_secret: form.api_secret,
        exchange: form.exchange,
        mode: form.mode,
      });
      setTestResult(res.data);
      if (res.data?.ok) {
        toast.success(lang === 'ru' ? `✅ Подключено! Баланс: ${res.data.balance?.toFixed(2) ?? 'N/A'} USDT` : `✅ Connected! Balance: ${res.data.balance?.toFixed(2) ?? 'N/A'} USDT`);
      } else {
        toast.error(res.data?.message || (lang === 'ru' ? 'Ошибка проверки' : 'Test failed'));
      }
    } catch (e) {
      setTestResult({ ok: false, message: e.message });
      toast.error(e.message);
    } finally {
      setTesting(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim() || !form.api_key || !form.api_secret) throw new Error(lang === 'ru' ? 'Заполните все поля' : 'Fill all fields');
      const res = await base44.functions.invoke('exchangeConnectionsApi', {
        _path: 'connections',
        profile_id: profileId,
        name: form.name.trim(),
        exchange: form.exchange,
        mode: form.mode,
        api_key: form.api_key,
        api_secret: form.api_secret,
        import_history: form.import_history,
        history_limit: form.import_history ? Number(form.history_limit || 500) : 0,
      });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Failed');
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['exchangeConnections', profileId]);
      const savedName = form.name.trim();
      setForm({ name: '', exchange: 'bybit', mode: 'demo', api_key: '', api_secret: '', import_history: true, history_limit: 500 });
      setTestResult(null);
      setShowForm(false);
      // Show import mode selection dialog after creating connection
      if (data?.connection?.id) {
        setImportDialog({ id: data.connection.id, name: savedName });
      } else {
        toast.success(lang === 'ru' ? 'Подключение создано' : 'Connection created');
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }) => {
      const res = await base44.functions.invoke('exchangeConnectionsApi', { _path: `connections/${id}`, _method: 'PATCH', is_active });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Failed');
    },
    onSuccess: () => queryClient.invalidateQueries(['exchangeConnections', profileId]),
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await base44.functions.invoke('exchangeConnectionsApi', { _path: `connections/${id}`, _method: 'DELETE' });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['exchangeConnections', profileId]);
      toast.success(lang === 'ru' ? 'Удалено' : 'Deleted');
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSync = async (connId) => {
    setSyncingId(connId);
    try {
      const res = await base44.functions.invoke('syncExchangeConnection', { connection_id: connId });
      queryClient.invalidateQueries({ queryKey: ['exchangeConnections', profileId] });
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      if (res.data?.ok) {
        toast.success(lang === 'ru'
          ? `✅ Синхронизировано: +${res.data.inserted} новых, ${res.data.updated} обновлено`
          : `✅ Synced: +${res.data.inserted} new, ${res.data.updated} updated`);
      } else {
        toast.error(res.data?.error || 'Sync failed');
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Plug className="w-5 h-5 text-cyan-400" />
          <h2 className="text-lg font-bold text-[#c0c0c0]">
            {lang === 'ru' ? 'Подключения к биржам' : 'Exchange Connections'}
          </h2>
        </div>
        <Button
          size="sm"
          onClick={() => { setShowForm(!showForm); setTestResult(null); }}
          className="bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30 h-8"
        >
          {showForm ? <ChevronUp className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
          {showForm
            ? (lang === 'ru' ? 'Свернуть' : 'Collapse')
            : (lang === 'ru' ? 'Добавить' : 'Add')}
        </Button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-[#0a0a0a] border border-cyan-500/20 rounded-xl p-5 space-y-4">
          {/* Exchange selector */}
          <div>
            <Label className="text-[#888] text-xs mb-2 block">
              {lang === 'ru' ? 'Биржа' : 'Exchange'}
            </Label>
            <div className="flex gap-2">
              {EXCHANGES.map(ex => (
                <button
                  key={ex.id}
                  onClick={() => setForm(f => ({ ...f, exchange: ex.id }))}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all",
                    form.exchange === ex.id
                      ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-400"
                      : "border-[#2a2a2a] bg-[#111] text-[#666] hover:border-[#3a3a3a]"
                  )}
                >
                  <span>{ex.logo}</span> {ex.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mode selector */}
          <div>
            <Label className="text-[#888] text-xs mb-2 block">
              {lang === 'ru' ? 'Режим' : 'Mode'}
            </Label>
            <div className="flex gap-2">
              {MODES.map(m => (
                <button
                  key={m.id}
                  onClick={() => setForm(f => ({ ...f, mode: m.id }))}
                  className={cn(
                    "px-4 py-2 rounded-lg border text-sm font-medium transition-all",
                    form.mode === m.id
                      ? m.id === 'real'
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                        : "border-blue-500/50 bg-blue-500/10 text-blue-400"
                      : "border-[#2a2a2a] bg-[#111] text-[#666] hover:border-[#3a3a3a]"
                  )}
                >
                  {lang === 'ru' ? m.labelRu : m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <Label className="text-[#888] text-xs mb-1.5 block">
              {lang === 'ru' ? 'Название подключения' : 'Connection name'}
            </Label>
            <Input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder={lang === 'ru' ? 'напр. Bybit Demo' : 'e.g. Bybit Demo'}
              className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] h-9"
            />
          </div>

          {/* API Key */}
          <div>
            <Label className="text-[#888] text-xs mb-1.5 block">API Key</Label>
            <Input
              type="password"
              value={form.api_key}
              onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
              placeholder="Enter API Key"
              className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] h-9 font-mono"
              autoComplete="off"
            />
          </div>

          {/* API Secret */}
          <div>
            <Label className="text-[#888] text-xs mb-1.5 block">API Secret</Label>
            <div className="relative">
              <Input
                type={showSecret ? 'text' : 'password'}
                value={form.api_secret}
                onChange={e => setForm(f => ({ ...f, api_secret: e.target.value }))}
                placeholder="Enter API Secret"
                className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] h-9 font-mono pr-10"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowSecret(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#888]"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Import mode */}
          <div>
            <Label className="text-[#888] text-xs mb-2 block">
              {lang === 'ru' ? 'Импорт после подключения' : 'Import after connect'}
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, import_history: true }))}
                className={cn(
                  "px-3 py-2 rounded-lg border text-sm text-left transition-all",
                  form.import_history
                    ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-300"
                    : "border-[#2a2a2a] bg-[#111] text-[#888]"
                )}
              >
                <div className="font-medium">{lang === 'ru' ? 'Импортировать старые сделки' : 'Import old trades'}</div>
                <div className="text-xs opacity-80">{lang === 'ru' ? 'Загрузить историю и считать метрики с историей' : 'Load history and compute metrics from it'}</div>
              </button>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, import_history: false }))}
                className={cn(
                  "px-3 py-2 rounded-lg border text-sm text-left transition-all",
                  !form.import_history
                    ? "border-violet-500/50 bg-violet-500/10 text-violet-300"
                    : "border-[#2a2a2a] bg-[#111] text-[#888]"
                )}
              >
                <div className="font-medium">{lang === 'ru' ? 'Только новые сделки' : 'Only new trades'}</div>
                <div className="text-xs opacity-80">{lang === 'ru' ? 'Игнорировать всё до времени подключения' : 'Ignore everything before connection time'}</div>
              </button>
            </div>
          </div>

          {form.import_history && (
            <div>
              <Label className="text-[#888] text-xs mb-2 block">
                {lang === 'ru' ? 'Лимит истории' : 'History limit'}
              </Label>
              <div className="flex gap-2">
                {[100, 500, 1000].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, history_limit: v }))}
                    className={cn(
                      "px-3 py-1.5 rounded-lg border text-sm",
                      Number(form.history_limit) === v
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                        : "border-[#2a2a2a] bg-[#111] text-[#888]"
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Security note */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-200/80">
            {lang === 'ru'
              ? '🔒 Ключи шифруются AES-GCM перед сохранением. Используйте Read-Only API ключ.'
              : '🔒 Keys are AES-GCM encrypted before storage. Use Read-Only API key.'}
          </div>

          {/* Test result */}
          {testResult && (
            <div className={cn(
              "flex items-center gap-2 p-3 rounded-lg border text-sm",
              testResult.ok
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-red-500/10 border-red-500/30 text-red-400"
            )}>
              {testResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
              <span>{testResult.message || (testResult.ok ? 'OK' : 'Failed')}</span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={testMutation}
              disabled={testing || !form.api_key || !form.api_secret}
              variant="outline"
              className="flex-1 border-[#2a2a2a] text-[#888] hover:text-[#c0c0c0] bg-[#111] h-9"
            >
              {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
              {lang === 'ru' ? 'Проверить' : 'Test'}
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.name || !form.api_key || !form.api_secret}
              className="flex-1 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30 h-9"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              {lang === 'ru' ? 'Сохранить' : 'Save'}
            </Button>
          </div>
        </div>
      )}

      {/* Connections list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-6 text-[#555]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">{lang === 'ru' ? 'Загрузка...' : 'Loading...'}</span>
        </div>
      ) : connections.length === 0 ? (
        <p className="text-center text-[#555] text-sm py-4">
          {lang === 'ru' ? 'Нет подключений. Добавьте первое.' : 'No connections. Add one.'}
        </p>
      ) : (
        <div className="space-y-3">
          {connections.map(conn => (
            <div
              key={conn.id}
              className={cn(
                "bg-[#0a0a0a] border rounded-xl p-4 transition-all",
                conn.is_active ? "border-[#2a2a2a]" : "border-[#1a1a1a] opacity-60"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="text-xl">🟡</div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[#c0c0c0] font-medium text-sm truncate">{conn.name}</span>
                      <Badge className={cn(
                        "text-[10px] px-1.5 py-0 shrink-0",
                        conn.mode === 'real' ? "bg-emerald-500/20 text-emerald-400" : "bg-blue-500/20 text-blue-400"
                      )}>
                        {conn.mode === 'real' ? (lang === 'ru' ? 'Реальный' : 'Real') : (lang === 'ru' ? 'Демо' : 'Demo')}
                      </Badge>
                      <Badge className={cn(
                        "text-[10px] px-1.5 py-0 shrink-0",
                        conn.last_status === 'ok' ? "bg-emerald-500/20 text-emerald-400"
                          : conn.last_status === 'error' ? "bg-red-500/20 text-red-400"
                          : conn.last_status === 'syncing' ? "bg-amber-500/20 text-amber-400"
                          : "bg-[#2a2a2a] text-[#666]"
                      )}>
                        {conn.last_status === 'ok' ? '● Connected'
                          : conn.last_status === 'error' ? '● Error'
                          : conn.last_status === 'syncing' ? '● Syncing...'
                          : '● —'}
                      </Badge>
                      <Badge className="text-[10px] px-1.5 py-0 shrink-0 bg-[#202020] text-[#9aa0b8] border border-[#2f2f2f]">
                        {conn.import_history ? `${lang === 'ru' ? 'История' : 'History'} ${conn.history_limit || 500}` : (lang === 'ru' ? 'Только новые' : 'New only')}
                      </Badge>
                    </div>
                    {conn.last_sync_at && (
                      <p className="text-[10px] text-[#555] mt-0.5">
                        {lang === 'ru' ? 'Синхр.:' : 'Synced:'} {new Date(conn.last_sync_at).toLocaleString()}
                      </p>
                    )}
                    {conn.last_error && (
                      <p className="text-[10px] text-red-400/70 mt-0.5 truncate max-w-xs">{conn.last_error}</p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => handleSync(conn.id)}
                    disabled={syncingId === conn.id || !conn.is_active}
                    className="h-8 px-3 bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 border border-violet-500/30 text-xs"
                  >
                    {syncingId === conn.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
                    {syncingId !== conn.id && (lang === 'ru' ? 'Синк' : 'Sync')}
                  </Button>
                  <button
                    onClick={() => toggleMutation.mutate({ id: conn.id, is_active: !conn.is_active })}
                    className="text-[10px] px-2 py-1.5 rounded-lg border border-[#2a2a2a] text-[#666] hover:text-[#c0c0c0] transition-colors"
                  >
                    {conn.is_active ? (lang === 'ru' ? 'Откл.' : 'Off') : (lang === 'ru' ? 'Вкл.' : 'On')}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(lang === 'ru' ? 'Удалить подключение?' : 'Delete connection?')) {
                        deleteMutation.mutate(conn.id);
                      }
                    }}
                    className="p-1.5 rounded-lg text-[#555] hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Import mode dialog shown after new connection is created */}
      {importDialog && (
        <ImportModeDialog
          open={!!importDialog}
          onOpenChange={(v) => { if (!v) setImportDialog(null); }}
          connectionId={importDialog.id}
          connectionName={importDialog.name}
          lang={lang}
          onComplete={() => {
            queryClient.invalidateQueries(['exchangeConnections', profileId]);
            queryClient.invalidateQueries({ queryKey: ['trades'] });
          }}
        />
      )}
    </div>
  );
}