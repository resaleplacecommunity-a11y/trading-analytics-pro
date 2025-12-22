import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Award } from "lucide-react";
import { cn } from "@/lib/utils";

export default function WeeklyScore({ reflection, onUpdate }) {
  const questions = [
    { key: 'followed_routine', label: 'Did I follow my routine?' },
    { key: 'respected_risk', label: 'Did I respect risk rules?' },
    { key: 'followed_plan', label: 'Did I trade according to plan?' }
  ];

  const score = questions.reduce((sum, q) => sum + (reflection?.[q.key] ? 33.33 : 0), 0);

  const getScoreColor = (s) => {
    if (s >= 90) return 'text-emerald-400';
    if (s >= 60) return 'text-amber-400';
    return 'text-red-400';
  };

  const handleChange = (key, checked) => {
    onUpdate({ ...reflection, [key]: checked });
  };

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-xl border border-[#2a2a2a]/50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-bold text-[#c0c0c0]">Weekly Score: Mental Hygiene</h3>
        </div>
        <div className={cn("text-3xl font-bold", getScoreColor(score))}>
          {score.toFixed(0)}
        </div>
      </div>

      <div className="space-y-4">
        {questions.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3 p-3 bg-[#111]/50 rounded-lg border border-[#2a2a2a]">
            <Checkbox
              checked={reflection?.[key] || false}
              onCheckedChange={(checked) => handleChange(key, checked)}
            />
            <Label className="text-[#c0c0c0] text-sm flex-1">{label}</Label>
          </div>
        ))}
      </div>

      <div className="mt-4 text-[#666] text-xs text-center">
        Honest self-assessment drives improvement
      </div>
    </div>
  );
}