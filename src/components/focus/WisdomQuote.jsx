import { Sparkles } from "lucide-react";

export default function WisdomQuote() {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-transparent border-2 border-amber-500/30 rounded-xl p-4 max-w-md">
      <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl" />
      
      <div className="relative flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[#c0c0c0] text-sm font-medium italic">
            "Fast is slow. Slow is smooth. Smooth is fast."
          </p>
        </div>
      </div>
    </div>
  );
}