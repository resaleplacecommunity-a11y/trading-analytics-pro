import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from '@/api/base44Client';
import { Zap, Plus, Trash2, Sparkles, Loader2, Target } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TRIGGER_TYPES = [
  { name: 'Revenge Trade', color: 'red', bgColor: 'bg-red-500/20', borderColor: 'border-red-500/50', textColor: 'text-red-400' },
  { name: 'Overtrading', color: 'orange', bgColor: 'bg-orange-500/20', borderColor: 'border-orange-500/50', textColor: 'text-orange-400' },
  { name: 'Night Trading', color: 'indigo', bgColor: 'bg-indigo-500/20', borderColor: 'border-indigo-500/50', textColor: 'text-indigo-400' },
  { name: 'Wide Stops', color: 'rose', bgColor: 'bg-rose-500/20', borderColor: 'border-rose-500/50', textColor: 'text-rose-400' },
  { name: 'Moving Stop', color: 'amber', bgColor: 'bg-amber-500/20', borderColor: 'border-amber-500/50', textColor: 'text-amber-400' },
  { name: 'FOMO Entry', color: 'purple', bgColor: 'bg-purple-500/20', borderColor: 'border-purple-500/50', textColor: 'text-purple-400' },
  { name: 'Early Exit', color: 'cyan', bgColor: 'bg-cyan-500/20', borderColor: 'border-cyan-500/50', textColor: 'text-cyan-400' },
  { name: 'Greed', color: 'emerald', bgColor: 'bg-emerald-500/20', borderColor: 'border-emerald-500/50', textColor: 'text-emerald-400' },
  { name: 'Fear', color: 'blue', bgColor: 'bg-blue-500/20', borderColor: 'border-blue-500/50', textColor: 'text-blue-400' },
  { name: 'Boredom Entry', color: 'slate', bgColor: 'bg-slate-500/20', borderColor: 'border-slate-500/50', textColor: 'text-slate-400' },
  { name: 'Ignoring Plan', color: 'pink', bgColor: 'bg-pink-500/20', borderColor: 'border-pink-500/50', textColor: 'text-pink-400' },
  { name: 'Tilt', color: 'red', bgColor: 'bg-red-600/20', borderColor: 'border-red-600/50', textColor: 'text-red-500' }
];

export default function TriggerLibrary({ profile, onSave, trades = [] }) {
  const [generating, setGenerating] = useState(null);
  const [selectedTrigger, setSelectedTrigger] = useState(null);
  const [selectedTrades, setSelectedTrades] = useState([]);
  const [filterTrigger, setFilterTrigger] = useState(null);
  const [viewTrade, setViewTrade] = useState(null);
  const triggers = profile?.triggers ? JSON.parse(profile.triggers) : [];
  
  const filteredTriggers = filterTrigger 
    ? triggers.filter(t => t.trigger === filterTrigger)
    : triggers;

  const addTrigger = () => {
    if (!selectedTrigger) {
      toast.error('Please select a trigger type');
      return;
    }
    const triggerConfig = TRIGGER_TYPES.find(t => t.name === selectedTrigger);
    const newTriggers = [...triggers, { 
      trigger: selectedTrigger,
      color: triggerConfig?.color || 'gray',
      response: '', 
      ai_suggestion: '',
      tradeIds: selectedTrades 
    }];
    onSave({ ...profile, triggers: JSON.stringify(newTriggers) });
    setSelectedTrigger(null);
    setSelectedTrades([]);
  };

  const updateTrigger = (index, field, value) => {
    const newTriggers = [...triggers];
    newTriggers[index] = { ...newTriggers[index], [field]: value };
    onSave({ ...profile, triggers: JSON.stringify(newTriggers) });
  };

  const removeTrigger = (index) => {
    const newTriggers = triggers.filter((_, i) => i !== index);
    onSave({ ...profile, triggers: JSON.stringify(newTriggers) });
  };

  const generateSuggestion = async (index) => {
    const trigger = triggers[index];
    if (!trigger.trigger) {
      toast.error('Please describe the trigger first');
      return;
    }

    setGenerating(index);
    try {
      const prompt = `You are a strict trading psychologist. A trader has this psychological trigger:

Trigger: "${trigger.trigger}"

Their current response: ${trigger.response || 'Not set'}

Trader's psychology profile: ${profile?.psychology_issues || 'Not provided'}

Provide a short, actionable response (2-3 sentences) on what they should do when this trigger appears. Be direct and practical.`;

      const result = await base44.integrations.Core.InvokeLLM({ prompt });
      updateTrigger(index, 'ai_suggestion', result);
      toast.success('AI suggestion generated');
    } catch (error) {
      toast.error('Failed to generate suggestion');
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-xl border border-[#2a2a2a]/50 p-6">
      <div className="flex items-center gap-2 mb-6">
        <Zap className="w-5 h-5 text-yellow-400" />
        <h3 className="text-lg font-bold text-[#c0c0c0]">Trigger Library</h3>
      </div>

      {/* Quick Trigger Selection */}
      <div className="bg-[#111]/50 rounded-xl border border-[#2a2a2a] p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-violet-400" />
          <h4 className="text-sm font-bold text-[#c0c0c0]">Add New Trigger</h4>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-3">
          {TRIGGER_TYPES.map(trigger => (
            <button
              key={trigger.name}
              onClick={() => setSelectedTrigger(trigger.name)}
              className={cn(
                "px-3 py-2 rounded-lg text-xs font-medium transition-all border",
                selectedTrigger === trigger.name
                  ? `${trigger.bgColor} ${trigger.borderColor} ${trigger.textColor}`
                  : "bg-[#0d0d0d] border-[#2a2a2a] text-[#888] hover:border-[#3a3a3a] hover:text-[#c0c0c0]"
              )}
            >
              {trigger.name}
            </button>
          ))}
        </div>

        {selectedTrigger && (
          <div className="space-y-3">
            <div>
              <div className="text-[#888] text-xs mb-2">Link to Trades (optional)</div>
              <Select 
                value="" 
                onValueChange={(value) => {
                  if (value && !selectedTrades.includes(value)) {
                    setSelectedTrades([...selectedTrades, value]);
                  }
                }}
              >
                <SelectTrigger className="bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]">
                  <SelectValue placeholder="Select trade" />
                </SelectTrigger>
                <SelectContent>
                  {trades.slice(0, 20).map(trade => (
                    <SelectItem key={trade.id} value={trade.id}>
                      {trade.coin} {trade.direction} - {new Date(trade.date_open).toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedTrades.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedTrades.map(tradeId => {
                  const trade = trades.find(t => t.id === tradeId);
                  return trade ? (
                    <span key={tradeId} className="px-2 py-1 bg-violet-500/20 text-violet-400 rounded text-xs flex items-center gap-1">
                      {trade.coin}
                      <button onClick={() => setSelectedTrades(selectedTrades.filter(id => id !== tradeId))}>
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ) : null;
                })}
              </div>
            )}

            <Button
              onClick={addTrigger}
              className="w-full bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/50"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add "{selectedTrigger}"
            </Button>
          </div>
        )}
      </div>

      {/* Filter */}
      {triggers.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <div className="text-[#888] text-xs">Filter:</div>
          <button
            onClick={() => setFilterTrigger(null)}
            className={cn(
              "px-3 py-1 rounded-lg text-xs transition-all",
              !filterTrigger ? "bg-violet-500/20 text-violet-400" : "bg-[#0d0d0d] text-[#666] hover:text-[#888]"
            )}
          >
            All
          </button>
          {TRIGGER_TYPES.map(trigger => (
            <button
              key={trigger.name}
              onClick={() => setFilterTrigger(trigger.name)}
              className={cn(
                "px-3 py-1 rounded-lg text-xs transition-all",
                filterTrigger === trigger.name 
                  ? `${trigger.bgColor} ${trigger.textColor}` 
                  : "bg-[#0d0d0d] text-[#666] hover:text-[#888]"
              )}
            >
              {trigger.name}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {filteredTriggers.map((item, i) => {
          const triggerConfig = TRIGGER_TYPES.find(t => t.name === item.trigger);
          return (
          <div key={i} className={cn("rounded-lg border-2 p-4", triggerConfig?.bgColor, triggerConfig?.borderColor)}>
            <div className="flex items-center justify-between mb-3">
              <div className={cn("font-bold text-lg", triggerConfig?.textColor)}>{item.trigger}</div>
              <Button
                onClick={() => removeTrigger(i)}
                size="sm"
                variant="ghost"
                className="text-red-400 hover:text-red-300"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            {item.tradeIds && item.tradeIds.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {item.tradeIds.map(tradeId => {
                  const trade = trades.find(t => t.id === tradeId);
                  return trade ? (
                    <button
                      key={tradeId}
                      onClick={() => setViewTrade(trade)}
                      className="px-3 py-1.5 bg-[#0d0d0d] text-[#c0c0c0] rounded-lg text-xs hover:bg-[#1a1a1a] transition-all border border-[#2a2a2a] hover:border-[#3a3a3a]"
                    >
                      {trade.coin} {trade.direction}
                    </button>
                  ) : null;
                })}
              </div>
            )}

            <div className="mb-3">
              <div className="text-[#888] text-xs uppercase tracking-wider mb-2">My Response</div>
              <Input
                value={item.response}
                onChange={(e) => updateTrigger(i, 'response', e.target.value)}
                placeholder="What should I do?"
                className="bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
              />
            </div>

            <Button
              onClick={() => generateSuggestion(i)}
              disabled={generating === i}
              size="sm"
              variant="outline"
              className="bg-[#0d0d0d] border-[#2a2a2a] text-[#888] hover:text-[#c0c0c0]"
            >
              {generating === i ? (
                <>
                  <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3 mr-2" />
                  AI Suggestion
                </>
              )}
            </Button>

            {item.ai_suggestion && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mt-3">
                <div className="text-yellow-400 text-xs font-bold uppercase tracking-wider mb-1">AI Recommendation</div>
                <p className="text-[#c0c0c0] text-sm">{item.ai_suggestion}</p>
              </div>
            )}
          </div>
        );
        })}

        {filteredTriggers.length === 0 && triggers.length > 0 && (
          <div className="text-center py-8 text-[#666]">
            <p className="text-sm">No triggers match this filter.</p>
          </div>
        )}

        {triggers.length === 0 && (
          <div className="text-center py-8 text-[#666]">
            <p className="text-sm">No triggers added yet. Select a trigger above to start.</p>
          </div>
        )}
      </div>

      {/* Trade Detail Modal */}
      {viewTrade && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setViewTrade(null)}>
          <div className="bg-[#111] rounded-2xl border-2 border-[#2a2a2a] p-6 max-w-2xl w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-[#c0c0c0]">Trade Details</h3>
              <Button variant="ghost" size="sm" onClick={() => setViewTrade(null)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[#666] text-xs mb-1">Coin</div>
                  <div className="text-[#c0c0c0] font-bold">{viewTrade.coin}</div>
                </div>
                <div>
                  <div className="text-[#666] text-xs mb-1">Direction</div>
                  <div className={cn("font-bold", viewTrade.direction === 'Long' ? 'text-emerald-400' : 'text-red-400')}>
                    {viewTrade.direction}
                  </div>
                </div>
                <div>
                  <div className="text-[#666] text-xs mb-1">Entry Price</div>
                  <div className="text-[#c0c0c0]">${viewTrade.entry_price?.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[#666] text-xs mb-1">Position Size</div>
                  <div className="text-[#c0c0c0]">${viewTrade.position_size?.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[#666] text-xs mb-1">PNL</div>
                  <div className={cn("font-bold", (viewTrade.pnl_usd || 0) >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    ${viewTrade.pnl_usd?.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[#666] text-xs mb-1">R Multiple</div>
                  <div className="text-[#c0c0c0]">{viewTrade.r_multiple?.toFixed(2)}R</div>
                </div>
              </div>
              
              {viewTrade.entry_reason && (
                <div>
                  <div className="text-[#666] text-xs mb-1">Entry Reason</div>
                  <div className="text-[#c0c0c0] text-sm bg-[#0d0d0d] rounded-lg p-3">{viewTrade.entry_reason}</div>
                </div>
              )}
              
              {viewTrade.trade_analysis && (
                <div>
                  <div className="text-[#666] text-xs mb-1">Analysis</div>
                  <div className="text-[#c0c0c0] text-sm bg-[#0d0d0d] rounded-lg p-3">{viewTrade.trade_analysis}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}