import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { X } from 'lucide-react';
import { format } from 'date-fns';

export default function CloseTradeModal({ trade, onClose, onConfirm }) {
  const [closePrice, setClosePrice] = useState('');
  const [analysis, setAnalysis] = useState('');
  const isLong = trade.direction === 'Long';

  // Calculate max position size (including adds)
  const getMaxPositionSize = () => {
    let size = parseFloat(trade.position_size) || 0;
    
    // Add back partial closes to get original size
    try {
      const partialCloses = trade.partial_closes ? JSON.parse(trade.partial_closes) : [];
      const totalClosed = partialCloses.reduce((sum, close) => sum + (parseFloat(close.size_usd) || 0), 0);
      size += totalClosed;
    } catch {}
    
    return size;
  };

  const calculatePnL = () => {
    const close = parseFloat(closePrice);
    const entry = parseFloat(trade.entry_price);
    const size = getMaxPositionSize(); // Use max size including adds
    const balance = parseFloat(trade.account_balance_at_entry) || 10000;

    if (!close || !entry || !size) return { pnlUsd: 0, pnlPercent: 0, rMultiple: 0 };

    const pnlPercent = isLong ? ((close - entry) / entry) * 100 : ((entry - close) / entry) * 100;
    const pnlUsd = (pnlPercent / 100) * size;
    
    const stopPercent = trade.stop_percent || 0;
    const rMultiple = stopPercent !== 0 ? (pnlPercent / Math.abs(stopPercent)) : 0;

    const pnlPercentOfBalance = (pnlUsd / balance) * 100;

    return { pnlUsd, pnlPercent, rMultiple, pnlPercentOfBalance };
  };

  const handleConfirm = () => {
    const { pnlUsd, pnlPercent, rMultiple, pnlPercentOfBalance } = calculatePnL();
    // IMPORTANT: Store close time in UTC
    const nowUTC = new Date().toISOString();
    const openTime = new Date(trade.date_open || trade.date);
    const durationMinutes = Math.floor((new Date(nowUTC) - openTime) / 60000);
    const maxSize = getMaxPositionSize();

    onConfirm({
      ...trade,
      status: 'closed',
      close_price: parseFloat(closePrice),
      date_close: nowUTC, // Store in UTC
      position_size: maxSize,
      pnl_usd: pnlUsd,
      realized_pnl_usd: pnlUsd,
      pnl_percent: pnlPercent,
      pnl_percent_of_balance: pnlPercentOfBalance,
      r_multiple: rMultiple,
      actual_r: rMultiple,
      actual_duration_minutes: durationMinutes,
      trade_analysis: analysis || trade.trade_analysis
    });
  };

  const { pnlUsd, pnlPercent, rMultiple } = calculatePnL();
  const isProfit = pnlUsd >= 0;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
          <h3 className="text-[#c0c0c0] text-lg font-semibold">Close Position - {trade.coin}</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5 text-[#666]" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <p className="text-[#888] text-sm mb-2">Close Price</p>
            <Input
              type="number"
              step="any"
              value={closePrice}
              onChange={(e) => setClosePrice(e.target.value)}
              placeholder="Enter close price..."
              className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0]"
            />
          </div>

          {closePrice && (
            <div className="bg-[#151515] rounded-lg p-4">
              <p className="text-[#666] text-xs mb-2">Projected PNL</p>
              <p className={`text-2xl font-bold ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                {isProfit ? '+' : ''}${pnlUsd.toFixed(2)}
              </p>
              <p className={`text-sm ${isProfit ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                {isProfit ? '+' : ''}{pnlPercent.toFixed(2)}% • {rMultiple.toFixed(2)}R
              </p>
            </div>
          )}

          <div>
            <p className="text-[#888] text-sm mb-2">Post-Trade Analysis (Optional)</p>
            <Textarea
              value={analysis}
              onChange={(e) => setAnalysis(e.target.value)}
              placeholder="How did this trade go? What did you learn?"
              className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] min-h-[100px]"
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-[#2a2a2a] text-[#888]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!closePrice}
              className="flex-1 bg-[#c0c0c0] text-black hover:bg-[#a0a0a0]"
            >
              Close Position
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}