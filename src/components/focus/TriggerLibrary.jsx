import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { base44 } from '@/api/base44Client';
import { Zap, Plus, Trash2, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function TriggerLibrary({ profile, onSave }) {
  const [generating, setGenerating] = useState(null);
  const triggers = profile?.triggers ? JSON.parse(profile.triggers) : [];

  const addTrigger = () => {
    const newTriggers = [...triggers, { trigger: '', response: '', ai_suggestion: '' }];
    onSave({ ...profile, triggers: JSON.stringify(newTriggers) });
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-400" />
          <h3 className="text-lg font-bold text-[#c0c0c0]">Trigger Library</h3>
        </div>
        <Button
          onClick={addTrigger}
          size="sm"
          className="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/50"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Trigger
        </Button>
      </div>

      <div className="space-y-4">
        {triggers.map((item, i) => (
          <div key={i} className="bg-[#111]/50 rounded-lg border border-[#2a2a2a] p-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-3">
              <div>
                <div className="text-[#888] text-xs uppercase tracking-wider mb-2">Trigger</div>
                <Input
                  value={item.trigger}
                  onChange={(e) => updateTrigger(i, 'trigger', e.target.value)}
                  placeholder="e.g., After a stop I want revenge"
                  className="bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
                />
              </div>
              <div>
                <div className="text-[#888] text-xs uppercase tracking-wider mb-2">My Response</div>
                <Input
                  value={item.response}
                  onChange={(e) => updateTrigger(i, 'response', e.target.value)}
                  placeholder="What should I do?"
                  className="bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
                />
              </div>
            </div>

            <div className="flex gap-2 mb-3">
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
              <Button
                onClick={() => removeTrigger(i)}
                size="sm"
                variant="ghost"
                className="text-red-400 hover:text-red-300 ml-auto"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

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
            <p className="text-sm">No triggers added yet. Add your psychological triggers and responses.</p>
          </div>
        )}
      </div>
    </div>
  );
}