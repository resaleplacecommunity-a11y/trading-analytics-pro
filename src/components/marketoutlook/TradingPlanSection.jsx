import { useState, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Target, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function TradingPlanSection({ data, onChange }) {
  const [localRiskPlan, setLocalRiskPlan] = useState(data?.risk_plan || '');
  const debounceRef = useRef(null);
  
  const setups = data?.setups_to_trade ? JSON.parse(data.setups_to_trade) : [];
  const noTradeRules = data?.no_trade_rules ? JSON.parse(data.no_trade_rules) : [];
  const executionChecklist = data?.execution_checklist ? JSON.parse(data.execution_checklist) : [];
  const topSetups = data?.top_setups ? JSON.parse(data.top_setups) : ['', '', ''];

  const addItem = (type) => {
    if (type === 'setup') {
      onChange({ setups_to_trade: JSON.stringify([...setups, { text: '', checked: false }]) });
    } else if (type === 'rule') {
      onChange({ no_trade_rules: JSON.stringify([...noTradeRules, { text: '', checked: false }]) });
    } else {
      onChange({ execution_checklist: JSON.stringify([...executionChecklist, { text: '', checked: false }]) });
    }
  };

  const updateItem = (type, index, field, value) => {
    let items;
    let key;
    if (type === 'setup') {
      items = [...setups];
      key = 'setups_to_trade';
    } else if (type === 'rule') {
      items = [...noTradeRules];
      key = 'no_trade_rules';
    } else {
      items = [...executionChecklist];
      key = 'execution_checklist';
    }
    items[index] = { ...items[index], [field]: value };
    
    if (field === 'text') {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onChange({ [key]: JSON.stringify(items) });
      }, 500);
    } else {
      onChange({ [key]: JSON.stringify(items) });
    }
  };

  const removeItem = (type, index) => {
    let items;
    let key;
    if (type === 'setup') {
      items = setups.filter((_, i) => i !== index);
      key = 'setups_to_trade';
    } else if (type === 'rule') {
      items = noTradeRules.filter((_, i) => i !== index);
      key = 'no_trade_rules';
    } else {
      items = executionChecklist.filter((_, i) => i !== index);
      key = 'execution_checklist';
    }
    onChange({ [key]: JSON.stringify(items) });
  };

  const updateTopSetup = (index, value) => {
    const newTopSetups = [...topSetups];
    newTopSetups[index] = value;
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange({ top_setups: JSON.stringify(newTopSetups) });
    }, 500);
  };

  const handleRiskPlanChange = (value) => {
    setLocalRiskPlan(value);
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange({ risk_plan: value });
    }, 800);
  };

  const ChecklistItem = ({ item, index, type, label }) => (
    <div className="flex items-start gap-3 group">
      <Checkbox
        checked={item.checked}
        onCheckedChange={(checked) => updateItem(type, index, 'checked', checked)}
        className="mt-1"
      />
      <Input
        value={item.text}
        onChange={(e) => updateItem(type, index, 'text', e.target.value)}
        placeholder={`${label}...`}
        className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] flex-1"
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={() => removeItem(type, index)}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-xl border border-[#2a2a2a]/50 p-6">
      <div className="flex items-center gap-2 mb-6">
        <Target className="w-5 h-5 text-violet-400" />
        <h3 className="text-lg font-bold text-[#c0c0c0]">Trading Plan</h3>
      </div>

      <div className="space-y-6">
        {/* Top 3 Setups Focus */}
        <div className="bg-violet-500/5 border border-violet-500/20 rounded-lg p-4">
          <Label className="text-violet-400 text-sm font-bold mb-3 block">🎯 Top 3 Priority Setups</Label>
          <div className="space-y-2">
            {topSetups.map((setup, i) => (
              <Input
                key={i}
                value={setup}
                onChange={(e) => updateTopSetup(i, e.target.value)}
                placeholder={`Priority setup #${i + 1}`}
                className="bg-[#111] border-violet-500/30 text-[#c0c0c0]"
              />
            ))}
          </div>
        </div>

        {/* Setups to Trade */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <Label className="text-[#888] text-xs uppercase tracking-wider">Setups I Will Trade</Label>
            <Button
              onClick={() => addItem('setup')}
              size="sm"
              variant="outline"
              className="bg-[#111] border-[#2a2a2a] text-[#888] hover:text-[#c0c0c0]"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {setups.map((item, i) => (
              <ChecklistItem key={i} item={item} index={i} type="setup" label="Setup" />
            ))}
          </div>
        </div>

        {/* No-Trade Rules */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <Label className="text-[#888] text-xs uppercase tracking-wider">No-Trade Rules</Label>
            <Button
              onClick={() => addItem('rule')}
              size="sm"
              variant="outline"
              className="bg-[#111] border-[#2a2a2a] text-[#888] hover:text-[#c0c0c0]"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {noTradeRules.map((item, i) => (
              <ChecklistItem key={i} item={item} index={i} type="rule" label="Don't trade if..." />
            ))}
          </div>
        </div>

        {/* Risk Plan */}
        <div>
          <Label className="text-[#888] text-xs uppercase tracking-wider mb-2">Risk Management Plan</Label>
          <Textarea
            value={localRiskPlan}
            onChange={(e) => handleRiskPlanChange(e.target.value)}
            placeholder="Position sizing, max daily loss, risk per trade..."
            className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0] min-h-[100px]"
          />
        </div>

        {/* Execution Checklist */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <Label className="text-[#888] text-xs uppercase tracking-wider">Execution Checklist</Label>
            <Button
              onClick={() => addItem('execution')}
              size="sm"
              variant="outline"
              className="bg-[#111] border-[#2a2a2a] text-[#888] hover:text-[#c0c0c0]"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {executionChecklist.map((item, i) => (
              <ChecklistItem key={i} item={item} index={i} type="execution" label="Before entry..." />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}