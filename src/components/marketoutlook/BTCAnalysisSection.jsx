import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { TrendingUp } from "lucide-react";
import { useState, useEffect, useRef } from "react";

export default function BTCAnalysisSection({ data, onChange }) {
  const [localData, setLocalData] = useState({
    btc_analysis: data?.btc_analysis || '',
    what_missed: data?.what_missed || '',
  });
  const bullets = data?.what_mattered ? JSON.parse(data.what_mattered) : ['', '', ''];
  const [localBullets, setLocalBullets] = useState(bullets);
  const debounceRef = useRef(null);

  useEffect(() => {
    setLocalData({
      btc_analysis: data?.btc_analysis || '',
      what_missed: data?.what_missed || '',
    });
    setLocalBullets(data?.what_mattered ? JSON.parse(data.what_mattered) : ['', '', '']);
  }, [data?.btc_analysis, data?.what_missed, data?.what_mattered]);

  const handleChange = (field, value) => {
    setLocalData(prev => ({ ...prev, [field]: value }));
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange({ [field]: value });
    }, 800);
  };

  const updateBullet = (index, value) => {
    const newBullets = [...localBullets];
    newBullets[index] = value;
    setLocalBullets(newBullets);
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange({ what_mattered: JSON.stringify(newBullets) });
    }, 800);
  };

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-xl border border-[#2a2a2a]/50 p-6">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="w-5 h-5 text-orange-400" />
        <h3 className="text-lg font-bold text-[#c0c0c0]">BTC: Previous Move Analysis</h3>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-[#888] text-xs uppercase tracking-wider mb-2">Analysis</Label>
          <Textarea
            value={localData.btc_analysis}
            onChange={(e) => handleChange('btc_analysis', e.target.value)}
            placeholder="What happened with BTC last week? Key price action, patterns..."
            className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] min-h-[120px]"
          />
        </div>

        <div>
          <Label className="text-[#888] text-xs uppercase tracking-wider mb-2">What Mattered (3 bullets)</Label>
          {localBullets.map((bullet, i) => (
            <Input
              key={i}
              value={bullet}
              onChange={(e) => updateBullet(i, e.target.value)}
              placeholder={`Key point ${i + 1}...`}
              className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] mb-2"
            />
          ))}
        </div>

        <div>
          <Label className="text-[#888] text-xs uppercase tracking-wider mb-2">What I Missed (optional)</Label>
          <Textarea
            value={localData.what_missed}
            onChange={(e) => handleChange('what_missed', e.target.value)}
            placeholder="What did I fail to notice or act on?"
            className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
          />
        </div>
      </div>
    </div>
  );
}