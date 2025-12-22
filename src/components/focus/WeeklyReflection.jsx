import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { base44 } from '@/api/base44Client';
import { Calendar, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function WeeklyReflection({ reflection, onSave, psychologyProfile }) {
  const [generating, setGenerating] = useState(false);

  const handleChange = (field, value) => {
    onSave({ ...reflection, [field]: value });
  };

  const generatePlan = async () => {
    if (!reflection?.key_takeaways || !reflection?.biggest_mistake) {
      toast.error('Please fill takeaways and mistake first');
      return;
    }

    setGenerating(true);
    try {
      const prompt = `You are a strict but supportive trading coach. Based on this trader's weekly reflection, generate a concise action plan for next week.

Trader Psychology Profile: ${psychologyProfile || 'Not provided'}

Weekly Reflection:
- Key Takeaways: ${reflection.key_takeaways}
- Biggest Mistake: ${reflection.biggest_mistake}
- Focus for Next Week: ${reflection.next_week_focus || 'Not set'}

Generate a bullet-point checklist (5-7 items) that:
1. Addresses the mistakes made
2. Leverages the takeaways
3. Considers the trader's psychology issues
4. Provides specific, actionable tasks

Be direct, no fluff. Format as markdown bullet list.`;

      const result = await base44.integrations.Core.InvokeLLM({ prompt });
      handleChange('weekly_plan', result);
      toast.success('Weekly plan generated');
    } catch (error) {
      toast.error('Failed to generate plan');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-xl border border-[#2a2a2a]/50 p-6">
      <div className="flex items-center gap-2 mb-6">
        <Calendar className="w-5 h-5 text-pink-400" />
        <h3 className="text-lg font-bold text-[#c0c0c0]">Weekly Reflection</h3>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-[#888] text-xs uppercase tracking-wider mb-2">3 Key Takeaways of the Week</Label>
          <Textarea
            value={reflection?.key_takeaways || ''}
            onChange={(e) => handleChange('key_takeaways', e.target.value)}
            placeholder="What did I learn this week?"
            className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] min-h-[100px]"
          />
        </div>

        <div>
          <Label className="text-[#888] text-xs uppercase tracking-wider mb-2">1 Mistake That Cost the Most</Label>
          <Textarea
            value={reflection?.biggest_mistake || ''}
            onChange={(e) => handleChange('biggest_mistake', e.target.value)}
            placeholder="What was my biggest mistake?"
            className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
          />
        </div>

        <div>
          <Label className="text-[#888] text-xs uppercase tracking-wider mb-2">Focus for Next Week</Label>
          <Textarea
            value={reflection?.next_week_focus || ''}
            onChange={(e) => handleChange('next_week_focus', e.target.value)}
            placeholder="What should I focus on?"
            className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
          />
        </div>

        <Button
          onClick={generatePlan}
          disabled={generating}
          className="w-full bg-gradient-to-r from-pink-500 to-pink-600 text-white hover:from-pink-600 hover:to-pink-700"
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Weekly Plan (AI)
            </>
          )}
        </Button>

        {reflection?.weekly_plan && (
          <div className="mt-4 bg-[#111]/50 rounded-lg border border-pink-500/30 p-4">
            <Label className="text-pink-400 text-xs uppercase tracking-wider mb-2">AI-Generated Plan</Label>
            <div className="text-[#c0c0c0] text-sm whitespace-pre-wrap">{reflection.weekly_plan}</div>
          </div>
        )}
      </div>
    </div>
  );
}