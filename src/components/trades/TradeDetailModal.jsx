import { useState } from 'react';
import { format } from 'date-fns';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, TrendingUp, TrendingDown, Sparkles, Loader2, Edit, Trash2 } from 'lucide-react';
import { cn } from "@/lib/utils";
import { base44 } from '@/api/base44Client';

export default function TradeDetailModal({ trade, onClose, onEdit, onDelete }) {
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const isProfit = (trade.pnl_usd || 0) >= 0;
  const isLong = trade.direction === 'Long';

  const analyzeTradeAI = async () => {
    setAnalyzing(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this trading trade and provide insights in Russian:
        
        Trade Data:
        - Coin: ${trade.coin}
        - Direction: ${trade.direction}
        - Entry: ${trade.entry_price}
        - Stop: ${trade.stop_price}
        - Take: ${trade.take_price}
        - Close: ${trade.close_price}
        - PNL: ${trade.pnl_percent}% / $${trade.pnl_usd}
        - R Multiple: ${trade.r_multiple}
        - R:R Ratio: ${trade.rr_ratio}
        - Rule Compliance: ${trade.rule_compliance ? 'Yes' : 'No'}
        - Emotional State: ${trade.emotional_state}/10
        - Confidence: ${trade.confidence_level}/10
        - Entry Reason: ${trade.entry_reason || 'Not specified'}
        - Strategy: ${trade.strategy_tag || 'Not specified'}
        
        Provide analysis in this format:
        1. What mistakes were made (if any)
        2. What was done well
        3. What to improve next time
        4. Strategy compliance assessment`,
        response_json_schema: {
          type: "object",
          properties: {
            mistakes: { type: "string" },
            positives: { type: "string" },
            improvements: { type: "string" },
            strategy_assessment: { type: "string" }
          }
        }
      });
      setAiAnalysis(result);
    } catch (err) {
      console.error('AI analysis failed:', err);
    }
    setAnalyzing(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a] sticky top-0 bg-[#1a1a1a]">
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
              <h2 className="text-[#c0c0c0] text-lg font-semibold">{trade.coin}</h2>
              <p className="text-[#666] text-xs">{format(new Date(trade.date), 'MMM dd, yyyy HH:mm')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => onEdit(trade)}>
              <Edit className="w-4 h-4 text-[#888]" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(trade)}>
              <Trash2 className="w-4 h-4 text-red-400" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5 text-[#666]" />
            </Button>
          </div>
        </div>
        
        <div className="p-4 space-y-4">
          {/* PNL Summary */}
          <div className="bg-[#151515] rounded-xl p-4 text-center">
            <p className={cn(
              "text-3xl font-bold",
              isProfit ? "text-emerald-400" : "text-red-400"
            )}>
              {isProfit ? '+' : ''}${(trade.pnl_usd || 0).toFixed(2)}
            </p>
            <p className={cn(
              "text-sm",
              isProfit ? "text-emerald-400/70" : "text-red-400/70"
            )}>
              {isProfit ? '+' : ''}{(trade.pnl_percent || 0).toFixed(2)}% • {(trade.r_multiple || 0).toFixed(2)}R
            </p>
          </div>

          {/* Trade Details Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#151515] rounded-lg p-3 text-center">
              <p className="text-[#666] text-xs">Entry</p>
              <p className="text-[#c0c0c0] font-medium">${trade.entry_price}</p>
            </div>
            <div className="bg-[#151515] rounded-lg p-3 text-center">
              <p className="text-[#666] text-xs">Stop</p>
              <p className="text-red-400 font-medium">${trade.stop_price}</p>
              <p className="text-[#666] text-xs">{trade.stop_percent}% / ${trade.stop_usd}</p>
            </div>
            <div className="bg-[#151515] rounded-lg p-3 text-center">
              <p className="text-[#666] text-xs">Take Profit</p>
              <p className="text-emerald-400 font-medium">${trade.take_price || '-'}</p>
              <p className="text-[#666] text-xs">{trade.take_percent}% / ${trade.take_usd}</p>
            </div>
            <div className="bg-[#151515] rounded-lg p-3 text-center">
              <p className="text-[#666] text-xs">Close Price</p>
              <p className="text-[#c0c0c0] font-medium">${trade.close_price || '-'}</p>
            </div>
            <div className="bg-[#151515] rounded-lg p-3 text-center">
              <p className="text-[#666] text-xs">Position Size</p>
              <p className="text-[#c0c0c0] font-medium">${trade.position_size}</p>
            </div>
            <div className="bg-[#151515] rounded-lg p-3 text-center">
              <p className="text-[#666] text-xs">R:R Ratio</p>
              <p className="text-[#c0c0c0] font-medium">{trade.rr_ratio || '-'}</p>
            </div>
          </div>

          {/* Psychology */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#151515] rounded-lg p-3 text-center">
              <p className="text-[#666] text-xs">Emotions</p>
              <p className="text-amber-400 font-medium">{trade.emotional_state}/10</p>
            </div>
            <div className="bg-[#151515] rounded-lg p-3 text-center">
              <p className="text-[#666] text-xs">Confidence</p>
              <p className="text-purple-400 font-medium">{trade.confidence_level}/10</p>
            </div>
            <div className="bg-[#151515] rounded-lg p-3 text-center">
              <p className="text-[#666] text-xs">Rules</p>
              <p className={trade.rule_compliance ? "text-emerald-400 font-medium" : "text-red-400 font-medium"}>
                {trade.rule_compliance ? 'Followed' : 'Violated'}
              </p>
            </div>
          </div>

          {/* Tags & Notes */}
          <div className="flex flex-wrap gap-2">
            {trade.strategy_tag && (
              <Badge className="bg-[#252525] text-[#c0c0c0]">{trade.strategy_tag}</Badge>
            )}
            <Badge className={cn(
              isLong ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
            )}>
              {trade.direction}
            </Badge>
          </div>

          {trade.entry_reason && (
            <div className="bg-[#151515] rounded-lg p-4">
              <p className="text-[#888] text-xs mb-2">Entry Reason</p>
              <p className="text-[#c0c0c0] text-sm">{trade.entry_reason}</p>
            </div>
          )}

          {trade.trade_analysis && (
            <div className="bg-[#151515] rounded-lg p-4">
              <p className="text-[#888] text-xs mb-2">Trade Analysis</p>
              <p className="text-[#c0c0c0] text-sm">{trade.trade_analysis}</p>
            </div>
          )}

          {trade.screenshot_url && (
            <div>
              <p className="text-[#888] text-xs mb-2">Screenshot</p>
              <img src={trade.screenshot_url} alt="Trade screenshot" className="rounded-lg w-full" />
            </div>
          )}

          {/* AI Analysis */}
          <div className="border-t border-[#2a2a2a] pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-[#c0c0c0] text-sm font-medium">AI Analysis</span>
              </div>
              {!aiAnalysis && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={analyzeTradeAI}
                  disabled={analyzing}
                  className="border-[#2a2a2a] text-[#888]"
                >
                  {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Analyze'}
                </Button>
              )}
            </div>

            {aiAnalysis && (
              <div className="space-y-3">
                <div className="bg-red-500/10 rounded-lg p-3">
                  <p className="text-red-400 text-xs mb-1">Mistakes</p>
                  <p className="text-[#c0c0c0] text-sm">{aiAnalysis.mistakes}</p>
                </div>
                <div className="bg-emerald-500/10 rounded-lg p-3">
                  <p className="text-emerald-400 text-xs mb-1">Positives</p>
                  <p className="text-[#c0c0c0] text-sm">{aiAnalysis.positives}</p>
                </div>
                <div className="bg-blue-500/10 rounded-lg p-3">
                  <p className="text-blue-400 text-xs mb-1">Improvements</p>
                  <p className="text-[#c0c0c0] text-sm">{aiAnalysis.improvements}</p>
                </div>
                <div className="bg-purple-500/10 rounded-lg p-3">
                  <p className="text-purple-400 text-xs mb-1">Strategy Assessment</p>
                  <p className="text-[#c0c0c0] text-sm">{aiAnalysis.strategy_assessment}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}