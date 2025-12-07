import { format } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Target } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function TradeRowCard({ trade, onClick }) {
  const isProfit = (trade.pnl_usd || 0) >= 0;
  const isLong = trade.direction === 'Long';
  const aiScore = trade.ai_score || 0;
  const aiScoreGood = aiScore > 5;
  
  return (
    <div 
      onClick={() => onClick?.(trade)}
      className="bg-gradient-to-br from-[#1a1a1a] to-[#141414] rounded-lg p-3 border border-[#2a2a2a] hover:border-[#3a3a3a] transition-all duration-300 cursor-pointer group"
    >
      <div className="flex items-center justify-between gap-4">
        {/* Coin & Direction */}
        <div className="flex items-center gap-3 min-w-[120px]">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
            isLong ? "bg-emerald-500/20" : "bg-red-500/20"
          )}>
            {isLong ? 
              <TrendingUp className="w-4 h-4 text-emerald-400" /> : 
              <TrendingDown className="w-4 h-4 text-red-400" />
            }
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[#c0c0c0] font-semibold">{trade.coin}</span>
              <Badge variant="outline" className={cn(
                "text-xs border-0 px-1 py-0",
                isLong ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
              )}>
                {isLong ? 'L' : 'S'}
              </Badge>
            </div>
            <p className="text-[#666] text-xs">{format(new Date(trade.date), 'dd.MM HH:mm')}</p>
          </div>
        </div>

        {/* Trade Data */}
        <div className="flex items-center gap-3 flex-1">
          {/* Entry */}
          <div className="text-center min-w-[80px]">
            <p className="text-[#666] text-xs">Entry</p>
            <p className="text-[#c0c0c0] text-sm font-medium">${trade.entry_price?.toFixed(4)}</p>
          </div>
          
          {/* Size */}
          <div className="text-center min-w-[80px]">
            <p className="text-[#666] text-xs">Size</p>
            <p className="text-[#c0c0c0] text-sm font-medium">${trade.position_size?.toFixed(0)}</p>
          </div>
          
          {/* RR */}
          <div className="text-center min-w-[60px]">
            <p className="text-[#666] text-xs">RR</p>
            <p className={cn(
              "text-sm font-medium",
              (trade.rr_ratio || 0) >= 1.3 ? "text-emerald-400" : 
              (trade.rr_ratio || 0) < 1.2 ? "text-red-400" : "text-[#c0c0c0]"
            )}>
              {(trade.rr_ratio || 0).toFixed(2)}
            </p>
          </div>
          
          {/* Close Price */}
          <div className="text-center min-w-[80px]">
            <p className="text-[#666] text-xs">Close</p>
            <p className="text-[#c0c0c0] text-sm font-medium">
              {trade.close_price ? `$${trade.close_price.toFixed(4)}` : '-'}
            </p>
          </div>
          
          {/* R Multiple */}
          <div className="text-center min-w-[60px]">
            <p className="text-[#666] text-xs">R</p>
            <p className={cn(
              "text-sm font-medium",
              (trade.r_multiple || 0) >= 0 ? "text-emerald-400" : "text-red-400"
            )}>
              {(trade.r_multiple || 0).toFixed(2)}R
            </p>
          </div>

          {/* PNL */}
          <div className="text-right min-w-[100px]">
            <p className={cn(
              "text-base font-bold",
              isProfit ? "text-emerald-400" : "text-red-400"
            )}>
              {isProfit ? '+' : ''}${(trade.pnl_usd || 0).toFixed(2)}
            </p>
            <p className={cn(
              "text-xs",
              isProfit ? "text-emerald-400/70" : "text-red-400/70"
            )}>
              {isProfit ? '+' : ''}{(trade.pnl_percent || 0).toFixed(2)}%
            </p>
          </div>
        </div>
      </div>

      {/* Strategy & AI Score */}
      <div className="flex items-center gap-2 mt-2">
        {trade.strategy_tag && (
          <Badge className="bg-[#252525] text-[#888] border-0 text-xs">
            {trade.strategy_tag}
          </Badge>
        )}
        <Badge className={cn(
          "border-0 text-xs",
          aiScoreGood ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
        )}>
          AI: {aiScore.toFixed(1)}/10
        </Badge>
      </div>
    </div>
  );
}