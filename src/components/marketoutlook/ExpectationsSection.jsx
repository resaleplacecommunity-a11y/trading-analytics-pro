import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Zap } from "lucide-react";

export default function ExpectationsSection({ data, onChange }) {
  return (
    <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-xl border border-[#2a2a2a]/50 p-6">
      <div className="flex items-center gap-2 mb-6">
        <Zap className="w-5 h-5 text-yellow-400" />
        <h3 className="text-lg font-bold text-[#c0c0c0]">Expectations</h3>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-[#888] text-xs uppercase tracking-wider mb-2">This Week</Label>
          <Textarea
            value={data?.expectations_week || ''}
            onChange={(e) => onChange({ expectations_week: e.target.value })}
            placeholder="What do I expect this week? Price targets, key levels to watch..."
            className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] min-h-[100px]"
          />
        </div>

        <div>
          <Label className="text-[#888] text-xs uppercase tracking-wider mb-2">This Month</Label>
          <Textarea
            value={data?.expectations_month || ''}
            onChange={(e) => onChange({ expectations_month: e.target.value })}
            placeholder="Broader monthly outlook and goals..."
            className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] min-h-[100px]"
          />
        </div>
      </div>
    </div>
  );
}