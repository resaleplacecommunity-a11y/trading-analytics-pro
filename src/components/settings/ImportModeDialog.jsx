import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { base44 } from '@/api/base44Client';
import { Loader2, Clock, History, CheckCircle2 } from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const LIMITS = [100, 500, 1000];

export default function ImportModeDialog({ open, onOpenChange, connectionId, connectionName, lang, onComplete }) {
  const [mode, setMode] = useState(null); // 'import' | 'skip'
  const [limit, setLimit] = useState(100);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!mode) return;
    setLoading(true);
    try {
      if (mode === 'skip') {
        // Set cutoff = now → sync will only pull trades after this moment
        const res = await base44.functions.invoke('syncExchangeConnectionV2/main', {
          connection_id: connectionId,
          cutoff_override_ms: Date.now(),
        });
        if (res.data?.ok) {
          toast.success(lang === 'ru'
            ? '✅ Подключено! Теперь будут импортироваться только новые сделки.'
            : '✅ Connected! Only new trades will be imported from now on.');
        } else {
          toast.error(res.data?.error || 'Sync failed');
        }
      } else {
        // Import N most recent historical trades (no cursor = fetch from beginning, limited by history_limit)
        const res = await base44.functions.invoke('syncExchangeConnectionV2/main', {
          connection_id: connectionId,
          history_limit: limit,
        });
        if (res.data?.ok) {
          toast.success(lang === 'ru'
            ? `✅ Импортировано: ${res.data.inserted} новых + ${res.data.updated} обновлено`
            : `✅ Imported: ${res.data.inserted} new + ${res.data.updated} updated`);
        } else {
          toast.error(res.data?.error || 'Sync failed');
        }
      }
      onComplete?.();
      onOpenChange(false);
      setMode(null);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111] border border-cyan-500/30 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#c0c0c0] flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            {lang === 'ru' ? `Подключено: ${connectionName}` : `Connected: ${connectionName}`}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-[#888]">
          {lang === 'ru' ? 'Выберите режим импорта сделок:' : 'Choose trade import mode:'}
        </p>

        <div className="space-y-3">
          {/* Option: Import history */}
          <button
            onClick={() => setMode('import')}
            className={cn(
              "w-full p-4 rounded-xl border text-left transition-all",
              mode === 'import'
                ? "border-cyan-500/60 bg-cyan-500/10"
                : "border-[#2a2a2a] bg-[#0a0a0a] hover:border-[#3a3a3a]"
            )}
          >
            <div className="flex items-start gap-3">
              <History className={cn("w-5 h-5 mt-0.5 shrink-0", mode === 'import' ? "text-cyan-400" : "text-[#555]")} />
              <div className="flex-1">
                <div className={cn("font-medium text-sm", mode === 'import' ? "text-cyan-400" : "text-[#c0c0c0]")}>
                  {lang === 'ru' ? 'Импортировать историю сделок' : 'Import trade history'}
                </div>
                <div className="text-xs text-[#666] mt-0.5">
                  {lang === 'ru'
                    ? 'Подтянуть закрытые сделки за выбранный период'
                    : 'Pull closed trades for the selected period'}
                </div>
              </div>
              {mode === 'import' && <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />}
            </div>

            {mode === 'import' && (
              <div className="mt-3 pt-3 border-t border-cyan-500/20">
                <p className="text-xs text-[#888] mb-2">
                  {lang === 'ru' ? 'Количество последних сделок:' : 'Number of recent trades:'}
                </p>
                <div className="flex gap-2">
                  {LIMITS.map(l => (
                    <button
                      key={l}
                      onClick={(e) => { e.stopPropagation(); setLimit(l); }}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg border text-sm font-medium transition-all",
                        limit === l
                          ? "border-cyan-500/60 bg-cyan-500/20 text-cyan-400"
                          : "border-[#2a2a2a] bg-[#111] text-[#666] hover:border-[#3a3a3a]"
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </button>

          {/* Option: Skip history */}
          <button
            onClick={() => setMode('skip')}
            className={cn(
              "w-full p-4 rounded-xl border text-left transition-all",
              mode === 'skip'
                ? "border-emerald-500/60 bg-emerald-500/10"
                : "border-[#2a2a2a] bg-[#0a0a0a] hover:border-[#3a3a3a]"
            )}
          >
            <div className="flex items-start gap-3">
              <Clock className={cn("w-5 h-5 mt-0.5 shrink-0", mode === 'skip' ? "text-emerald-400" : "text-[#555]")} />
              <div className="flex-1">
                <div className={cn("font-medium text-sm", mode === 'skip' ? "text-emerald-400" : "text-[#c0c0c0]")}>
                  {lang === 'ru' ? 'Только новые сделки' : 'New trades only'}
                </div>
                <div className="text-xs text-[#666] mt-0.5">
                  {lang === 'ru'
                    ? 'Импортировать только сделки, открытые после подключения'
                    : 'Import only trades opened after connection time'}
                </div>
              </div>
              {mode === 'skip' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
            </div>
          </button>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 border-[#2a2a2a] text-[#666] hover:text-[#c0c0c0] bg-[#0a0a0a]"
          >
            {lang === 'ru' ? 'Позже' : 'Later'}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!mode || loading}
            className={cn(
              "flex-1",
              mode === 'import' ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30" :
              mode === 'skip' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30" :
              "bg-[#1a1a1a] text-[#444] border border-[#2a2a2a] cursor-not-allowed"
            )}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {loading
              ? (lang === 'ru' ? 'Синхронизация...' : 'Syncing...')
              : (lang === 'ru' ? 'Начать' : 'Start')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}