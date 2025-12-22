import { Sparkles } from "lucide-react";

export default function StrategyPlaceholder() {
  return (
    <div className="bg-gradient-to-br from-[#1a1a1a]/50 to-[#0d0d0d]/50 backdrop-blur-sm rounded-2xl border-2 border-dashed border-[#2a2a2a] p-8 h-full flex items-center justify-center">
      <div className="text-center">
        <Sparkles className="w-12 h-12 text-[#444] mx-auto mb-4" />
        <h3 className="text-[#666] text-lg font-bold mb-2">Strategy Generator</h3>
        <p className="text-[#555] text-sm">
          Set your goal to see recommended<br/>trading strategy
        </p>
      </div>
    </div>
  );
}