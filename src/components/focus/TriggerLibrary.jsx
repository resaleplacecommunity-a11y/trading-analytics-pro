import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from '@/api/base44Client';
import { Zap, Plus, Trash2, Sparkles, Loader2, Target } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TRIGGER_TYPES = [
  'Revenge Trade',
  'Overtrading',
  'Night Trading',
  'Wide Stops',
  'Moving Stop',
  'FOMO Entry',
  'Early Exit',
  'Greed',
  'Fear',
  'Boredom Entry',
  'Ignoring Plan',
  'Tilt'
];

export default function TriggerLibrary({ profile, onSave, trades = [] }) {
  const [generating, setGenerating] = useState(null);
  const [selectedTrigger, setSelectedTrigger] = useState(null);
  const [selectedTrades, setSelectedTrades] = useState([]);
  
  const triggers = profile?.triggers ? JSON.parse(profile.triggers) : [];

  const addTrigger = () => {
    if (!selectedTrigger) {
      toast.error('Please select a trigger type');
      return;
    }
    
    const newTriggers = [...triggers, { 
      trigger: selectedTrigger, 
      response: '', 
      ai_suggestion: '',
      tradeIds: selectedTrades 
    }];
    onSave({ ...profile, triggers: JSON.stringify(newTriggers) });
    setSelectedTrigger(null);
    setSelectedTrades([]);
    toast.success('Trigger added');
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

      {/* Add New Trigger Section */}
      <div className="bg-[#111]/50 rounded-xl border border-[#2a2a2a] p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-violet-400" />
          <h4 className="text-sm font-bold text-[#c0c0c0]">Add New Trigger</h4>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-3">
          {TRIGGER_TYPES.map(trigger => (
            <button
              key={trigger}
              onClick={() => setSelectedTrigger(trigger)}
              className={cn(
                "px-3 py-2 rounded-lg text-xs font-medium transition-all border",
                selectedTrigger === trigger
                  ? "bg-violet-500/20 border-violet-500/50 text-violet-400"
                  : "bg-[#0d0d0d] border-[#2a2a2a] text-[#888] hover:border-[#3a3a3a] hover:text-[#c0c0c0]"
              )}
            >
              {trigger}
            </button>
          ))}
        </div>

        {selectedTrigger && (
          <div className="space-y-3">
            <div>
              <div className="text-[#888] text-xs uppercase tracking-wider mb-2">Link to Trades (optional)</div>
              <Select 
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
              className="w-full bg-gradient-to-r from-violet-500 to-violet-600 text-white hover:from-violet-600 hover:to-violet-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add "{selectedTrigger}"
            </Button>
          </div>
        )}
      </div>

      {/* Existing Triggers */}
      <div className="space-y-4">
        {triggers.map((item, i) => (
          <div key={i} className="bg-[#111]/50 rounded-lg border border-[#2a2a2a] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[#c0c0c0] font-bold">{item.trigger}</div>
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
                    <span key={tradeId} className="px-2 py-1 bg-[#0d0d0d] border border-[#2a2a2a] text-[#888] rounded text-xs">
                      {trade.coin} {trade.direction}
                    </span>
                  ) : null;
                })}
              </div>
            )}

            <div className="mb-3">
              <div className="text-[#888] text-xs uppercase tracking-wider mb-2">My Response</div>
              <Input
                value={item.response || ''}
                onChange={(e) => updateTrigger(i, 'response', e.target.value)}
                placeholder="What should I do when this happens?"
                className="bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
              />
            </div>

            <Button
              onClick={() => generateSuggestion(i)}
              disabled={generating === i}
              size="sm"
              variant="outline"
              className="bg-[#0d0d0d] border-[#2a2a2a] text-[#888] hover:text-[#c0c0c0] mb-3"
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
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <div className="text-yellow-400 text-xs font-bold uppercase tracking-wider mb-1">AI Recommendation</div>
                <p className="text-[#c0c0c0] text-sm">{item.ai_suggestion}</p>
              </div>
            )}
          </div>
        ))}

        {triggers.length === 0 && (
          <div className="text-center py-8 text-[#666]">
            <p className="text-sm">No triggers added yet. Select a trigger above to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}