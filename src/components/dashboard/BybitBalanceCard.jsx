import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { DollarSign, TrendingUp, TrendingDown, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function BybitBalanceCard() {
  const [balance, setBalance] = useState(null);
  const [previousBalance, setPreviousBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchBalance = async () => {
    try {
      const { data } = await base44.functions.invoke('getBybitBalance');
      
      if (data.success && data.balance !== null) {
        // Save previous balance before updating
        if (balance !== null && balance !== data.balance) {
          setPreviousBalance(balance);
          localStorage.setItem('bybit_previous_balance', balance.toString());
        } else if (previousBalance === null) {
          // Try to load from localStorage on first load
          const stored = localStorage.getItem('bybit_previous_balance');
          if (stored) setPreviousBalance(parseFloat(stored));
        }

        setBalance(data.balance);
        setError(null);
        setLastUpdate(new Date());
      } else {
        setError(data.error || 'Failed to fetch balance');
      }
    } catch (err) {
      setError(err.message || 'Proxy unreachable');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();
    const interval = setInterval(fetchBalance, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, []);

  const delta = balance !== null && previousBalance !== null ? balance - previousBalance : 0;
  const deltaPercent = previousBalance > 0 ? (delta / previousBalance) * 100 : 0;

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Balance Card */}
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl border border-[#2a2a2a] p-6 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-[#888] text-sm font-medium">Balance (USDT)</span>
          </div>
          {loading && <RefreshCw className="w-4 h-4 text-[#666] animate-spin" />}
        </div>

        {error ? (
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm">{error}</span>
          </div>
        ) : balance !== null ? (
          <>
            <p className="text-3xl font-bold text-[#c0c0c0] mb-1">
              ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            {lastUpdate && (
              <p className="text-xs text-[#666]">
                Updated {lastUpdate.toLocaleTimeString()}
              </p>
            )}
          </>
        ) : (
          <p className="text-[#666]">Loading...</p>
        )}
      </div>

      {/* Balance Change Card */}
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl border border-[#2a2a2a] p-6 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn(
              "p-2 rounded-lg",
              delta > 0 ? "bg-emerald-500/20" : delta < 0 ? "bg-red-500/20" : "bg-[#2a2a2a]"
            )}>
              {delta > 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              ) : delta < 0 ? (
                <TrendingDown className="w-4 h-4 text-red-400" />
              ) : (
                <DollarSign className="w-4 h-4 text-[#666]" />
              )}
            </div>
            <span className="text-[#888] text-sm font-medium">Balance Change</span>
          </div>
        </div>

        {error ? (
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm">{error}</span>
          </div>
        ) : balance !== null && previousBalance !== null ? (
          <>
            <p className={cn(
              "text-3xl font-bold mb-1",
              delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-400" : "text-[#888]"
            )}>
              {delta > 0 ? '+' : ''}${delta.toFixed(2)}
            </p>
            <p className={cn(
              "text-sm",
              delta > 0 ? "text-emerald-400/70" : delta < 0 ? "text-red-400/70" : "text-[#666]"
            )}>
              {delta > 0 ? '+' : ''}{deltaPercent.toFixed(2)}%
            </p>
          </>
        ) : (
          <p className="text-[#666] text-sm">Waiting for data...</p>
        )}
      </div>
    </div>
  );
}