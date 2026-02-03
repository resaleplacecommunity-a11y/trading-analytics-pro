import { useState, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ScenariosSection({ data, onChange }) {
  const [expanded, setExpanded] = useState({ bull: false, base: false, bear: false });
  const [localScenarios, setLocalScenarios] = useState({
    scenario_bull: data?.scenario_bull || '',
    scenario_base: data?.scenario_base || '',
    scenario_bear: data?.scenario_bear || '',
  });
  const debounceRef = useRef(null);

  const handleChange = (field, value) => {
    setLocalScenarios(prev => ({ ...prev, [field]: value }));
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange({ [field]: value });
    }, 800);
  };

  const scenarios = [
    { key: 'bull', label: 'Bull Scenario', icon: TrendingUp, color: 'emerald', field: 'scenario_bull' },
    { key: 'base', label: 'Base Scenario', icon: Minus, color: 'amber', field: 'scenario_base' },
    { key: 'bear', label: 'Bear Scenario', icon: TrendingDown, color: 'red', field: 'scenario_bear' }
  ];

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-xl border border-[#2a2a2a]/50 p-6">
      <h3 className="text-lg font-bold text-[#c0c0c0] mb-4">Market Scenarios</h3>
      
      <div className="space-y-3">
        {scenarios.map(({ key, label, icon: Icon, color, field }) => (
          <div key={key} className="border border-[#2a2a2a] rounded-lg overflow-hidden">
            <button
              onClick={() => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))}
              className={cn(
                "w-full flex items-center justify-between p-4 transition-colors",
                expanded[key] ? "bg-[#1a1a1a]" : "bg-[#111] hover:bg-[#151515]"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 text-${color}-400`} />
                <span className="text-[#c0c0c0] font-medium">{label}</span>
              </div>
              {expanded[key] ? <ChevronUp className="w-4 h-4 text-[#666]" /> : <ChevronDown className="w-4 h-4 text-[#666]" />}
            </button>
            
            {expanded[key] && (
              <div className="p-4 bg-[#0d0d0d]">
                <Textarea
                  value={localScenarios[field]}
                  onChange={(e) => handleChange(field, e.target.value)}
                  placeholder={`If X happens, then I will... (${label.toLowerCase()})`}
                  className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] min-h-[80px]"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}