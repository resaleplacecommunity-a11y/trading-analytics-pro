import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Target } from "lucide-react";
import { cn } from "@/lib/utils";

export default function KeyLevelsSection({ data, onChange }) {
  const levels = data?.key_levels ? JSON.parse(data.key_levels) : [];

  const addLevel = () => {
    onChange({ key_levels: JSON.stringify([...levels, { price: '', type: 'support', note: '' }]) });
  };

  const updateLevel = (index, field, value) => {
    const newLevels = [...levels];
    newLevels[index] = { ...newLevels[index], [field]: value };
    onChange({ key_levels: JSON.stringify(newLevels) });
  };

  const removeLevel = (index) => {
    onChange({ key_levels: JSON.stringify(levels.filter((_, i) => i !== index)) });
  };

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-xl border border-[#2a2a2a]/50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-bold text-[#c0c0c0]">Key Levels</h3>
        </div>
        <Button
          onClick={addLevel}
          size="sm"
          variant="outline"
          className="bg-[#111] border-[#2a2a2a] text-[#888] hover:text-[#c0c0c0]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Level
        </Button>
      </div>

      <div className="space-y-3">
        {levels.map((level, i) => (
          <div key={i} className="bg-[#111]/50 rounded-lg border border-[#2a2a2a] p-4">
            <div className="flex gap-3 mb-2">
              <Input
                type="number"
                value={level.price}
                onChange={(e) => updateLevel(i, 'price', e.target.value)}
                placeholder="Price"
                className="bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0] w-32"
              />
              <div className="flex gap-2">
                {['support', 'resistance'].map(type => (
                  <button
                    key={type}
                    onClick={() => updateLevel(i, 'type', type)}
                    className={cn(
                      "px-3 py-2 rounded text-xs font-medium transition-all",
                      level.type === type
                        ? type === 'support'
                          ? "bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/50"
                          : "bg-red-500/20 text-red-400 border-2 border-red-500/50"
                        : "bg-[#0d0d0d] text-[#666] border border-[#2a2a2a]"
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeLevel(i)}
                className="text-red-400 hover:text-red-300 ml-auto"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <Input
              value={level.note}
              onChange={(e) => updateLevel(i, 'note', e.target.value)}
              placeholder="Note (e.g., major weekly level, liquidity zone...)"
              className="bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
            />
          </div>
        ))}

        {levels.length === 0 && (
          <div className="text-center py-8 text-[#666]">
            <p className="text-sm">No key levels added yet</p>
          </div>
        )}
      </div>
    </div>
  );
}