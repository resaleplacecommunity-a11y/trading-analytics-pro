import { useState, useMemo, useRef } from 'react';
import { Clock, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";

const formatNumber = (num) => {
  if (num === undefined || num === null || num === '') return '—';
  const n = parseFloat(num);
  if (isNaN(n)) return '—';
  return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
};

export default function TradeDurationCompact({ trades, onDrillDown }) {
  const scrollRef = useRef(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTrades, setDrawerTrades] = useState([]);
  const [drawerTitle, setDrawerTitle] = useState('');

  const analysis = useMemo(() => {
    const closedTrades = trades.filter(t => t.actual_duration_minutes && t.actual_duration_minutes > 0);
    
    if (closedTrades.length === 0) {
      return { avgDuration: 0, buckets: [] };
    }

    const totalMinutes = closedTrades.reduce((sum, t) => sum + t.actual_duration_minutes, 0);
    const avgDuration = totalMinutes / closedTrades.length;

    const bucketDefs = [
      { name: '< 15m', min: 0, max: 15 },
      { name: '15m - 1h', min: 15, max: 60 },
      { name: '1h - 4h', min: 60, max: 240 },
      { name: '4h - 1d', min: 240, max: 1440 },
      { name: '1d - 3d', min: 1440, max: 4320 },
      { name: '> 3d', min: 4320, max: Infinity }
    ];

    const buckets = bucketDefs.map(def => {
      const buckeTrades = closedTrades.filter(t => t.actual_duration_minutes >= def.min && t.actual_duration_minutes < def.max);
      const wins = buckeTrades.filter(t => (t.pnl_usd || 0) > 0).length;
      const totalPnl = buckeTrades.reduce((sum, t) => sum + (t.pnl_usd || 0), 0);
      const avgPnl = buckeTrades.length > 0 ? totalPnl / buckeTrades.length : 0;
      const winrate = buckeTrades.length > 0 ? (wins / buckeTrades.length) * 100 : 0;

      return {
        name: def.name,
        count: buckeTrades.length,
        winrate,
        avgPnl,
        totalPnl,
        trades: buckeTrades
      };
    }).filter(b => b.count > 0);

    return { avgDuration, buckets };
  }, [trades]);

  const formatDuration = (minutes) => {
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = Math.floor(minutes % 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -280 : 280;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const handlePanelClick = (bucket) => {
    setDrawerTitle(`Duration: ${bucket.name}`);
    setDrawerTrades(bucket.trades);
    setDrawerOpen(true);
  };

  if (analysis.buckets.length === 0) {
    return null;
  }

  return (
    <>
      <div className="backdrop-blur-md bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 rounded-xl border border-[#2a2a2a]/50 p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-[#c0c0c0] flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            Trade Duration Analysis
          </h3>
          <div className="bg-[#111]/50 rounded-lg px-4 py-2">
            <div className="text-xs text-[#666] mb-0.5">Avg Duration</div>
            <div className="text-xl font-bold text-cyan-400">{formatDuration(analysis.avgDuration)}</div>
          </div>
        </div>

        <div className="relative">
          {analysis.buckets.length > 3 && (
            <>
              <Button
                onClick={() => scroll('left')}
                variant="ghost"
                size="icon"
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-[#111]/90 hover:bg-[#1a1a1a] border border-[#2a2a2a]"
              >
                <ChevronLeft className="w-5 h-5 text-[#888]" />
              </Button>
              <Button
                onClick={() => scroll('right')}
                variant="ghost"
                size="icon"
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-[#111]/90 hover:bg-[#1a1a1a] border border-[#2a2a2a]"
              >
                <ChevronRight className="w-5 h-5 text-[#888]" />
              </Button>
            </>
          )}

          <div 
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto scrollbar-hide px-10"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {analysis.buckets.map((bucket) => {
              const isProfit = bucket.avgPnl >= 0;
              const isGoodWR = bucket.winrate >= 50;
              
              return (
                <div 
                  key={bucket.name}
                  onClick={() => handlePanelClick(bucket)}
                  className={cn(
                    "relative rounded-xl border-2 p-4 overflow-hidden transition-all hover:scale-[1.02] cursor-pointer min-w-[240px]",
                    isProfit 
                      ? "bg-gradient-to-br from-emerald-500/15 via-[#0d0d0d] to-emerald-500/5 border-emerald-500/40 hover:border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                      : "bg-gradient-to-br from-red-500/15 via-[#0d0d0d] to-red-500/5 border-red-500/40 hover:border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.15)]"
                  )}
                >
                  <div className="absolute inset-0 opacity-[0.04]" style={{
                    backgroundImage: `linear-gradient(to right, #c0c0c0 1px, transparent 1px), linear-gradient(to bottom, #c0c0c0 1px, transparent 1px)`,
                    backgroundSize: '20px 20px'
                  }} />

                  <div className="relative z-10">
                    <div className="text-center mb-3">
                      <div className="text-xs text-[#888] uppercase tracking-wider mb-1">{bucket.name}</div>
                      <div className="text-2xl font-black text-[#c0c0c0]">{bucket.count}</div>
                      <div className="text-[9px] text-[#666]">trades</div>
                    </div>

                    <div className="space-y-2">
                      <div className="bg-[#0d0d0d]/50 rounded-lg px-2 py-1.5">
                        <div className="text-[9px] text-[#666] mb-0.5">Winrate</div>
                        <div className={cn(
                          "text-sm font-bold",
                          isGoodWR ? "text-emerald-400" : "text-red-400"
                        )}>
                          {bucket.winrate.toFixed(0)}%
                        </div>
                      </div>
                      
                      <div className="bg-[#0d0d0d]/50 rounded-lg px-2 py-1.5">
                        <div className="text-[9px] text-[#666] mb-0.5">Avg PNL</div>
                        <div className={cn(
                          "text-sm font-bold",
                          isProfit ? "text-emerald-400" : "text-red-400"
                        )}>
                          {isProfit ? '+' : ''}${formatNumber(Math.abs(bucket.avgPnl))}
                        </div>
                      </div>
                      
                      <div className="bg-[#0d0d0d]/50 rounded-lg px-2 py-1.5">
                        <div className="text-[9px] text-[#666] mb-0.5">Total</div>
                        <div className={cn(
                          "text-sm font-bold",
                          bucket.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"
                        )}>
                          {bucket.totalPnl >= 0 ? '+' : ''}${formatNumber(Math.abs(bucket.totalPnl))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-[600px] bg-[#0a0a0a] border-l border-[#2a2a2a] p-0">
          <div className="p-6 border-b border-[#2a2a2a]">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-[#c0c0c0]">{drawerTitle}</h3>
              <button onClick={() => setDrawerOpen(false)} className="text-[#888] hover:text-[#c0c0c0]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[#666] text-sm mt-1">{drawerTrades.length} trades</p>
          </div>
          
          <div className="p-6 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 100px)' }}>
            {drawerTrades.map((trade) => (
              <div 
                key={trade.id}
                className="bg-[#111]/50 rounded-lg border border-[#2a2a2a] p-4 hover:bg-[#1a1a1a] transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-bold text-[#c0c0c0]">{trade.coin?.replace('USDT', '')}</div>
                    <div className="text-xs text-[#666]">
                      {new Date(trade.date_close || trade.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className={cn(
                    "text-xl font-bold",
                    (trade.pnl_usd || 0) >= 0 ? "text-emerald-400" : "text-red-400"
                  )}>
                    {(trade.pnl_usd || 0) >= 0 ? '+' : ''}${formatNumber(Math.abs(trade.pnl_usd || 0))}
                  </div>
                </div>
                {trade.entry_reason && (
                  <p className="text-xs text-[#888] line-clamp-2">{trade.entry_reason}</p>
                )}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}