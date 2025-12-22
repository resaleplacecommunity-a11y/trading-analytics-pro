import { Sparkles } from "lucide-react";

export default function WisdomQuote() {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-transparent border-2 border-amber-500/30 rounded-2xl p-8">
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-amber-400/10 rounded-full blur-2xl" />
      
      <div className="relative flex items-start gap-4">
        <Sparkles className="w-8 h-8 text-amber-400 flex-shrink-0 mt-1" />
        <div>
          <p className="text-[#c0c0c0] text-xl font-medium italic mb-2">
            "Fast is slow. Slow is smooth. Smooth is fast."
          </p>
          <p className="text-[#888] text-sm">
            Быстро — это медленно, но стабильно.
          </p>
        </div>
      </div>
    </div>
  );
}