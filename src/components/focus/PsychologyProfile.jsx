import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Brain } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export default function PsychologyProfile({ profile, onSave }) {
  const [localValue, setLocalValue] = useState(profile?.psychology_issues || '');
  const debounceRef = useRef(null);

  useEffect(() => {
    setLocalValue(profile?.psychology_issues || '');
  }, [profile?.psychology_issues]);

  const handleChange = (value) => {
    setLocalValue(value);
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSave({ ...profile, psychology_issues: value });
    }, 1000);
  };

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-xl border border-[#2a2a2a]/50 p-6">
      <div className="flex items-center gap-2 mb-6">
        <Brain className="w-5 h-5 text-cyan-400" />
        <h3 className="text-lg font-bold text-[#c0c0c0]">My Psychology Issues</h3>
      </div>

      <div className="bg-gradient-to-r from-cyan-500/10 via-cyan-500/5 to-transparent border-l-4 border-cyan-500/50 rounded-lg p-4 mb-6">
        <p className="text-[#888] text-sm">
          Describe your psychological challenges in trading. This will help AI provide personalized recommendations throughout the system.
        </p>
      </div>

      <div>
        <Label className="text-[#888] text-xs uppercase tracking-wider mb-2">What problems do you experience?</Label>
        <Textarea
          value={localValue}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="e.g., After a loss, I feel the urge to revenge trade. I struggle with FOMO when I see big moves. I tend to move my stop loss when price gets close..."
          className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] min-h-[150px]"
        />
      </div>

      <div className="mt-4 text-[#666] text-xs">
        💡 This data is used by AI to give you supportive but strict guidance
      </div>
    </div>
  );
}