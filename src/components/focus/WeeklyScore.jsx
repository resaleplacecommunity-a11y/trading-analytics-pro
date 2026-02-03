import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";

export default function WeeklyScore({ reflection, onUpdate }) {
  const [localChecks, setLocalChecks] = useState({
    followed_routine: reflection?.followed_routine || false,
    respected_risk: reflection?.respected_risk || false,
    followed_plan: reflection?.followed_plan || false,
  });
  const debounceRef = useRef(null);

  useEffect(() => {
    setLocalChecks({
      followed_routine: reflection?.followed_routine || false,
      respected_risk: reflection?.respected_risk || false,
      followed_plan: reflection?.followed_plan || false,
    });
  }, [reflection?.followed_routine, reflection?.respected_risk, reflection?.followed_plan]);

  const questions = [
    { key: 'followed_routine', label: 'Did I follow my routine?' },
    { key: 'respected_risk', label: 'Did I respect risk rules?' },
    { key: 'followed_plan', label: 'Did I trade according to plan?' }
  ];

  const score = questions.reduce((sum, q) => sum + (localChecks[q.key] ? 33.33 : 0), 0);

  const getScoreColor = (s) => {
    if (s >= 90) return 'text-emerald-400';
    if (s >= 60) return 'text-amber-400';
    return 'text-red-400';
  };

  const handleChange = (key, checked) => {
    setLocalChecks(prev => ({ ...prev, [key]: checked }));
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onUpdate({ ...reflection, [key]: checked });
    }, 300);
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
              checked={localChecks[key]}
              onCheckedChange={(checked) => handleChange(key, checked)}
              className="border-white data-[state=checked]:bg-white data-[state=checked]:text-black"
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