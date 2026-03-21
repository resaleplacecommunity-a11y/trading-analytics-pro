import { useState } from 'react';
import { useConfirm } from "@/components/ui/ConfirmDialog";
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

// ── Exchange registry ──────────────────────────────────────────────────────────

const EXCHANGES = [
  { id: 'bybit',   label: 'Bybit',   logo: '🟡', hasDemoReal: true,  needsPassphrase: false },
  { id: 'binance', label: 'Binance', logo: '🟨', hasDemoReal: true,  needsPassphrase: false },
  { id: 'okx',     label: 'OKX',     logo: '⚫', hasDemoReal: true,  needsPassphrase: true  },
  { id: 'bingx',   label: 'BingX',   logo: '🔵', hasDemoReal: true,  needsPassphrase: false },
  { id: 'mexc',    label: 'MEXC',    logo: '🟢', hasDemoReal: false, needsPassphrase: false },
  { id: 'bitget',  label: 'Bitget',  logo: '🔶', hasDemoReal: true,  needsPassphrase: true  },
];

const EXCHANGE_LOGOS = Object.fromEntries(EXCHANGES.map(e => [e.id, e.logo]));

// ── Exchange icons (colored badges, no external deps) ─────────────────────────
const EXCHANGE_ICONS = {
  bybit:   { bg: '#F7A600', text: 'B',   label: 'Bybit' },
  binance: { bg: '#F3BA2F', text: 'BN',  label: 'Binance' },
  bingx:   { bg: '#1890FF', text: 'BX',  label: 'BingX' },
  okx:     { bg: '#191919', text: 'OKX', label: 'OKX' },
  mexc:    { bg: '#3366FF', text: 'MX',  label: 'MEXC' },
  bitget:  { bg: '#00C8D5', text: 'BG',  label: 'Bitget' },
};

const ExchangeIcon = ({ exchange, size = 'md' }) => {
  const key = exchange?.toLowerCase?.() || '';
  const cfg = EXCHANGE_ICONS[key] || { bg: '#333', text: '?', label: exchange || '?' };
  const sizeClass = size === 'sm' ? 'w-6 h-6 text-[9px]' : 'w-8 h-8 text-[10px]';
  // Use white text for dark backgrounds, black for bright yellow/gold
  const darkBg = ['okx', 'mexc', 'bingx', 'bitget'].includes(key);
  return (
    <div
      style={{ background: cfg.bg, color: darkBg ? '#fff' : '#000' }}
      className={`${sizeClass} rounded-lg flex items-center justify-center font-bold shrink-0`}
      title={cfg.label}
    >
      {cfg.text}
    </div>
  );
};

// Demo/Real mode label overrides per exchange
function getModeLabel(exchange, modeId, lang) {
  const labels = {
    demo: lang === 'ru' ? 'Демо' : 'Demo',
    real: lang === 'ru' ? 'Реальный' : 'Real',
  };
  return labels[modeId] || modeId;
}

// Default form state
const DEFAULT_FORM = {
  name: '',
  exchange: 'bybit',
  mode: 'demo',
  api_key: '',
  api_secret: '',
  api_passphrase: '',
  import_history: true,
  history_limit: 500,
};

export default function ExchangeConnectionsSection({ profileId, lang }) {
  const queryClient = useQueryClient();
  const { confirm: confirmDialog, Dialog: ConfirmDialogComponent } = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [fieldErrors, setFieldErrors] = useState({});
  const [showSecret, setShowSecret] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [syncingId, setSyncingId] = useState(null);
  const [importDialog, setImportDialog] = useState(null);

  const selectedExchange = EXCHANGES.find(e => e.id === form.exchange) || EXCHANGES[0];

  // When exchange changes — reset mode to appropriate default
  const handleExchangeChange = (exId) => {
    const ex = EXCHANGES.find(e => e.id === exId);
    setForm(f => ({
      ...f,
      exchange: exId,
      mode: ex?.hasDemoReal ? 'demo' : 'real',
      api_passphrase: '',
    }));
    setTestResult(null);
  };

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['exchangeConnections', profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const res = await base44.functions.invoke('exchangeConnectionsApi', { method: 'GET', path: '/connections', profile_id: profileId });
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
    if (selectedExchange.needsPassphrase && !form.api_passphrase) {
      toast.error(lang === 'ru' ? `${selectedExchange.label} требует Passphrase` : `${selectedExchange.label} requires Passphrase`);
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const payload = {
        _path: 'connections/test',
        api_key: form.api_key,
        api_secret: form.api_secret,
        exchange: form.exchange,
        mode: form.mode,
      };
      if (selectedExchange.needsPassphrase) {
        payload.api_passphrase = form.api_passphrase;
      }
      const res = await base44.functions.invoke('exchangeConnectionsApi', payload);
      setTestResult(res.data);
      if (res.data?.ok) {
        const bal = res.data.balance != null ? res.data.balance.toFixed(2) : 'N/A';
        toast.success(lang === 'ru' ? `✅ Подключено! Баланс: ${bal} USDT` : `✅ Connected! Balance: ${bal} USDT`);
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

  const validateForm = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = lang === 'ru' ? 'Введите название' : 'Enter connection name';
    if (!form.api_key.trim()) errors.api_key = lang === 'ru' ? 'Введите API Key' : 'Enter API Key';
    if (!form.api_secret.trim()) errors.api_secret = lang === 'ru' ? 'Введите API Secret' : 'Enter API Secret';
    if (selectedExchange.needsPassphrase && !form.api_passphrase?.trim())
      errors.api_passphrase = lang === 'ru' ? 'Введите Passphrase' : 'Enter Passphrase';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!validateForm()) throw new Error('validation');
      if (!form.name.trim() || !form.api_key || !form.api_secret)
        throw new Error(lang === 'ru' ? 'Заполните все поля' : 'Fill all fields');
      if (selectedExchange.needsPassphrase && !form.api_passphrase)
        throw new Error(lang === 'ru' ? `${selectedExchange.label} требует Passphrase` : `${selectedExchange.label} requires Passphrase`);

      const payload = {
        _path: 'connections',
        profile_id: profileId,
        name: form.name.trim(),
        exchange: form.exchange,
        mode: form.mode,
        api_key: form.api_key,
        api_secret: form.api_secret,
        import_history: form.import_history,
        history_limit: form.import_history ? Number(form.history_limit || 500) : 0,
      };
      if (selectedExchange.needsPassphrase) {
        payload.api_passphrase = form.api_passphrase;
      }

      const res = await base44.functions.invoke('exchangeConnectionsApi', payload);
      if (!res.data?.ok) throw new Error(res.data?.error || 'Failed');
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['exchangeConnections', profileId]);
      const savedName = form.name.trim();
      setForm({ ...DEFAULT_FORM });
      setTestResult(null);
      setShowForm(false);
      if (data?.connection?.id) {
        // Import mode is set in the form — no need for extra dialog
        queryClient.invalidateQueries(['exchangeConnections', profileId]);
        queryClient.invalidateQueries({ queryKey: ['trades'] });
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
            <div className="flex flex-wrap gap-2">
              {EXCHANGES.map(ex => (
                <button
                  key={ex.id}
                  onClick={() => handleExchangeChange(ex.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all",
                    form.exchange === ex.id
                      ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-400"
                      : "border-[#2a2a2a] bg-[#111] text-[#666] hover:border-[#3a3a3a]"
                  )}
                >
                  <ExchangeIcon exchange={ex.id} size="sm" />
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mode selector — only show if exchange has demo/real */}
          {selectedExchange.hasDemoReal ? (
            <div>
              <Label className="text-[#888] text-xs mb-2 block">
                {lang === 'ru' ? 'Режим' : 'Mode'}
              </Label>
              <div className="flex gap-2">
                {['demo', 'real'].map(modeId => (
                  <button
                    key={modeId}
                    onClick={() => setForm(f => ({ ...f, mode: modeId }))}
                    className={cn(
                      "px-4 py-2 rounded-lg border text-sm font-medium transition-all",
                      form.mode === modeId
                        ? modeId === 'real'
                          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                          : "border-blue-500/50 bg-blue-500/10 text-blue-400"
                        : "border-[#2a2a2a] bg-[#111] text-[#666] hover:border-[#3a3a3a]"
                    )}
                  >
                    {getModeLabel(form.exchange, modeId, lang)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-xs text-[#555] px-1">
              {lang === 'ru' ? `${selectedExchange.label}: только реальный счёт` : `${selectedExchange.label}: real account only`}
            </div>
          )}

          {/* Connection name */}
          <div>
            <Label className="text-[#888] text-xs mb-1.5 block">
              {lang === 'ru' ? 'Название подключения' : 'Connection name'}
            </Label>
            <Input
              value={form.name}
              onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setFieldErrors(e => ({ ...e, name: '' })); }}
              placeholder={`e.g. ${selectedExchange.label} ${selectedExchange.hasDemoReal ? (form.mode === 'demo' ? 'Demo' : 'Real') : 'Real'}`}
              className={cn("bg-[#111] border-[#2a2a2a] text-[#c0c0c0] h-9", fieldErrors.name && "border-red-500/60")}
            />
            {fieldErrors.name && <p className="text-red-400 text-xs mt-1">{fieldErrors.name}</p>}
          </div>

          {/* API Key */}
          <div>
            <Label className="text-[#888] text-xs mb-1.5 block">API Key</Label>
            <Input
              type="password"
              value={form.api_key}
              onChange={e => { setForm(f => ({ ...f, api_key: e.target.value })); setFieldErrors(e => ({ ...e, api_key: '' })); }}
              placeholder="Enter API Key"
              className={cn("bg-[#111] border-[#2a2a2a] text-[#c0c0c0] h-9 font-mono", fieldErrors.api_key && "border-red-500/60")}
              autoComplete="off"
            />
            {fieldErrors.api_key && <p className="text-red-400 text-xs mt-1">{fieldErrors.api_key}</p>}
          </div>

          {/* API Secret */}
          <div>
            <Label className="text-[#888] text-xs mb-1.5 block">API Secret</Label>
            <div className="relative">
              <Input
                type={showSecret ? 'text' : 'password'}
                value={form.api_secret}
                onChange={e => { setForm(f => ({ ...f, api_secret: e.target.value })); setFieldErrors(e => ({ ...e, api_secret: '' })); }}
                placeholder="Enter API Secret"
                className={cn("bg-[#111] border-[#2a2a2a] text-[#c0c0c0] h-9 font-mono pr-10", fieldErrors.api_secret && "border-red-500/60")}
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
            {fieldErrors.api_secret && <p className="text-red-400 text-xs mt-1">{fieldErrors.api_secret}</p>}
          </div>

          {/* Passphrase (OKX + Bitget only) */}
          {selectedExchange.needsPassphrase && (
            <div>
              <Label className="text-[#888] text-xs mb-1.5 block">
                Passphrase {lang === 'ru' ? '(обязательно для ' : '(required for '}{selectedExchange.label})
              </Label>
              <div className="relative">
                <Input
                  type={showPassphrase ? 'text' : 'password'}
                  value={form.api_passphrase}
                  onChange={e => setForm(f => ({ ...f, api_passphrase: e.target.value }))}
                  placeholder={`${selectedExchange.label} API Passphrase`}
                  className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] h-9 font-mono pr-10"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowPassphrase(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#888]"
                >
                  {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

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
                <div className="text-xs opacity-80">
                  {form.exchange === 'bybit'
                    ? (lang === 'ru' ? 'Bybit: до 1 года истории' : 'Bybit: up to 1 year of history')
                    : (lang === 'ru' ? 'Загрузить историю и считать метрики с историей' : 'Load history and compute metrics from it')
                  }
                </div>
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

          {form.import_history && form.exchange !== 'bybit' && (
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

          {/* Action buttons */}
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
              disabled={createMutation.isPending}
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
                  <ExchangeIcon exchange={conn.exchange} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[#c0c0c0] font-medium text-sm truncate">{conn.name}</span>
                      {/* Exchange badge */}
                      <Badge className="text-[10px] px-1.5 py-0 shrink-0 bg-[#1a1a2e] text-[#8888cc] border border-[#2a2a4a]">
                        {(conn.exchange || 'bybit').toUpperCase()}
                      </Badge>
                      {/* Mode badge */}
                      <Badge className={cn(
                        "text-[10px] px-1.5 py-0 shrink-0",
                        conn.mode === 'real' ? "bg-emerald-500/20 text-emerald-400" : "bg-blue-500/20 text-blue-400"
                      )}>
                        {conn.mode === 'real' ? (lang === 'ru' ? 'Реальный' : 'Real') : (lang === 'ru' ? 'Демо' : 'Demo')}
                      </Badge>
                      {/* Status badge */}
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
                    {conn.current_balance != null && (
                      <p className="text-[10px] text-cyan-400/80 mt-0.5 font-mono">
                        {lang === 'ru' ? 'Баланс:' : 'Balance:'} {conn.current_balance.toFixed(2)} USDT
                      </p>
                    )}
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
                    onClick={async () => {
                      const ok = await confirmDialog(lang === 'ru' ? 'Удалить подключение?' : 'Delete connection?');
                      if (ok) deleteMutation.mutate(conn.id);
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

      {/* Import mode dialog removed — import settings are in the connection form */}
      <ConfirmDialogComponent />
    </div>
  );
}
