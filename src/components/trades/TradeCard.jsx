import { format } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Target, Shield, Image } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function TradeCard({ trade, onClick }) {
  const isProfit = (trade.pnl_usd || 0) >= 0;
  const isLong = trade.direction === 'Long';
  
  return (
    <div 
      onClick={() => onClick?.(trade)}
      className="bg-gradient-to-br from-[#1a1a1a] to-[#141414] rounded-xl p-4 border border-[#2a2a2a] hover:border-[#3a3a3a] transition-all duration-300 cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center",
            isLong ? "bg-emerald-500/20" : "bg-red-500/20"
          )}>
            {isLong ? 
              <TrendingUp className="w-5 h-5 text-emerald-400" /> : 
              <TrendingDown className="w-5 h-5 text-red-400" />
            }
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[#c0c0c0] font-semibold">{trade.coin}</span>
              <Badge variant="outline" className={cn(
                "text-xs border-0",
                isLong ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
              )}>
                {trade.direction}
              </Badge>
            </div>
            <p className="text-[#666] text-xs">{format(new Date(trade.date), 'MMM dd, HH:mm')}</p>
          </div>
        </div>
        
        <div className="text-right">
          <p className={cn(
            "text-lg font-bold",
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
      
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div className="bg-[#151515] rounded-lg p-2 text-center">
          <p className="text-[#666]">Entry</p>
          <p className="text-[#c0c0c0] font-medium">${trade.entry_price?.toFixed(4)}</p>
        </div>
        <div className="bg-[#151515] rounded-lg p-2 text-center">
          <p className="text-[#666]">Size</p>
          <p className="text-[#c0c0c0] font-medium">${trade.position_size?.toFixed(0)}</p>
        </div>
        <div className="bg-[#151515] rounded-lg p-2 text-center">
          <p className="text-[#666]">R Multiple</p>
          <p className={cn(
            "font-medium",
            (trade.r_multiple || 0) >= 0 ? "text-emerald-400" : "text-red-400"
          )}>
            {(trade.r_multiple || 0).toFixed(2)}R
          </p>
        </div>
        <div className="bg-[#151515] rounded-lg p-2 text-center">
          <p className="text-[#666]">R:R</p>
          <p className="text-[#c0c0c0] font-medium">{trade.rr_ratio?.toFixed(1) || '-'}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {trade.strategy_tag && (
          <Badge className="bg-[#252525] text-[#888] border-0 text-xs">
            {trade.strategy_tag}
          </Badge>
        )}
        {trade.rule_compliance && (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs">
            <Shield className="w-3 h-3 mr-1" />
            Rules OK
          </Badge>
        )}
        {trade.screenshot_url && (
          <Badge className="bg-blue-500/20 text-blue-400 border-0 text-xs">
            <Image className="w-3 h-3 mr-1" />
            Screenshot
          </Badge>
        )}
        {trade.emotional_state && (
          <span className="text-[#666] text-xs">Emotion: {trade.emotional_state}/10</span>
        )}
        {trade.confidence_level && (
          <span className="text-[#666] text-xs">Confidence: {trade.confidence_level}/10</span>
        )}
      </div>
    </div>
  );
}