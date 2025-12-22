import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, ChevronDown, ChevronUp, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

export default function WatchlistSection({ data, onChange }) {
  const [expanded, setExpanded] = useState({});
  const coins = data?.watchlist_coins ? JSON.parse(data.watchlist_coins) : [];

  const addCoin = () => {
    const newCoins = [...coins, {
      symbol: '',
      bias: 'Bullish',
      timeframe: '1D',
      thesis: '',
      levels: '',
      notes: ''
    }];
    onChange({ watchlist_coins: JSON.stringify(newCoins) });
  };

  const updateCoin = (index, field, value) => {
    const newCoins = [...coins];
    newCoins[index] = { ...newCoins[index], [field]: value };
    onChange({ watchlist_coins: JSON.stringify(newCoins) });
  };

  const removeCoin = (index) => {
    onChange({ watchlist_coins: JSON.stringify(coins.filter((_, i) => i !== index)) });
  };

  const toggleExpand = (index) => {
    setExpanded(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const biasColors = {
    Bullish: 'text-emerald-400',
    Bearish: 'text-red-400',
    Neutral: 'text-amber-400'
  };

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-xl border border-[#2a2a2a]/50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-bold text-[#c0c0c0]">Watchlist</h3>
        </div>
        <Button
          onClick={addCoin}
          size="sm"
          className="bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/50"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Coin
        </Button>
      </div>

      <div className="space-y-3">
        {coins.map((coin, i) => (
          <div key={i} className="bg-[#111]/80 rounded-lg border border-[#2a2a2a] overflow-hidden">
            <button
              onClick={() => toggleExpand(i)}
              className="w-full flex items-center justify-between p-4 hover:bg-[#151515] transition-colors"
            >
              <div className="flex items-center gap-4">
                <Input
                  value={coin.symbol}
                  onChange={(e) => {
                    e.stopPropagation();
                    updateCoin(i, 'symbol', e.target.value.toUpperCase());
                  }}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="BTC"
                  className="bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0] w-24 font-bold"
                />
                <span className={cn("text-sm font-medium", biasColors[coin.bias])}>{coin.bias}</span>
                <span className="text-xs text-[#666]">{coin.timeframe}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeCoin(i);
                  }}
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                {expanded[i] ? <ChevronUp className="w-4 h-4 text-[#666]" /> : <ChevronDown className="w-4 h-4 text-[#666]" />}
              </div>
            </button>

            {expanded[i] && (
              <div className="p-4 bg-[#0d0d0d] space-y-3 border-t border-[#2a2a2a]">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[#888] text-xs mb-1">Bias</Label>
                    <div className="flex gap-1">
                      {['Bullish', 'Neutral', 'Bearish'].map(bias => (
                        <button
                          key={bias}
                          onClick={() => updateCoin(i, 'bias', bias)}
                          className={cn(
                            "px-3 py-1 rounded text-xs font-medium transition-all",
                            coin.bias === bias
                              ? `${biasColors[bias]} bg-white/10 border border-current`
                              : "text-[#666] bg-[#111] border border-[#2a2a2a]"
                          )}
                        >
                          {bias}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-[#888] text-xs mb-1">Timeframe</Label>
                    <div className="flex gap-1">
                      {['1D', '4H', '1H'].map(tf => (
                        <button
                          key={tf}
                          onClick={() => updateCoin(i, 'timeframe', tf)}
                          className={cn(
                            "px-3 py-1 rounded text-xs font-medium transition-all",
                            coin.timeframe === tf
                              ? "text-purple-400 bg-purple-500/20 border border-purple-500/50"
                              : "text-[#666] bg-[#111] border border-[#2a2a2a]"
                          )}
                        >
                          {tf}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-[#888] text-xs mb-1">Thesis</Label>
                  <Textarea
                    value={coin.thesis}
                    onChange={(e) => updateCoin(i, 'thesis', e.target.value)}
                    placeholder="Why watching this coin? Setup idea..."
                    className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] text-sm"
                    rows={2}
                  />
                </div>

                <div>
                  <Label className="text-[#888] text-xs mb-1">Key Levels</Label>
                  <Input
                    value={coin.levels}
                    onChange={(e) => updateCoin(i, 'levels', e.target.value)}
                    placeholder="Entry, stop, targets (e.g., 50k/48k/54k)"
                    className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] text-sm"
                  />
                </div>

                <div>
                  <Label className="text-[#888] text-xs mb-1">Notes</Label>
                  <Input
                    value={coin.notes}
                    onChange={(e) => updateCoin(i, 'notes', e.target.value)}
                    placeholder="Additional notes..."
                    className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        ))}

        {coins.length === 0 && (
          <div className="text-center py-8 text-[#666]">
            <p className="text-sm">No coins in watchlist yet</p>
          </div>
        )}
      </div>
    </div>
  );
}