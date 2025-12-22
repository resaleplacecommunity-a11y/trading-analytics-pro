import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Calendar, AlertTriangle } from "lucide-react";

export default function NewsSection({ data, onChange }) {
  const events = data?.news_events ? JSON.parse(data.news_events) : [];

  const addEvent = () => {
    onChange({ news_events: JSON.stringify([...events, { date: '', title: '', impact: 'medium' }]) });
  };

  const updateEvent = (index, field, value) => {
    const newEvents = [...events];
    newEvents[index] = { ...newEvents[index], [field]: value };
    onChange({ news_events: JSON.stringify(newEvents) });
  };

  const removeEvent = (index) => {
    onChange({ news_events: JSON.stringify(events.filter((_, i) => i !== index)) });
  };

  const impactColors = {
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/50',
    high: 'bg-red-500/20 text-red-400 border-red-500/50'
  };

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-xl border border-[#2a2a2a]/50 p-6">
      <div className="flex items-center gap-2 mb-6">
        <Calendar className="w-5 h-5 text-blue-400" />
        <h3 className="text-lg font-bold text-[#c0c0c0]">News & Events Backdrop</h3>
      </div>

      <div className="space-y-6">
        {/* News Events */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <Label className="text-[#888] text-xs uppercase tracking-wider">Key Events This Week</Label>
            <Button
              onClick={addEvent}
              size="sm"
              variant="outline"
              className="bg-[#111] border-[#2a2a2a] text-[#888] hover:text-[#c0c0c0]"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-3">
            {events.map((event, i) => (
              <div key={i} className="bg-[#111]/50 rounded-lg border border-[#2a2a2a] p-4">
                <div className="flex gap-3 mb-3">
                  <Input
                    type="date"
                    value={event.date}
                    onChange={(e) => updateEvent(i, 'date', e.target.value)}
                    className="bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0] w-40"
                  />
                  <div className="flex gap-1">
                    {['low', 'medium', 'high'].map(impact => (
                      <button
                        key={impact}
                        onClick={() => updateEvent(i, 'impact', impact)}
                        className={`px-3 py-1 rounded text-xs font-medium border transition-all ${
                          event.impact === impact ? impactColors[impact] : 'bg-[#0d0d0d] text-[#666] border-[#2a2a2a]'
                        }`}
                      >
                        {impact}
                      </button>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeEvent(i)}
                    className="text-red-400 hover:text-red-300 ml-auto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <Input
                  value={event.title}
                  onChange={(e) => updateEvent(i, 'title', e.target.value)}
                  placeholder="Event name (e.g., FOMC, NFP, CPI...)"
                  className="bg-[#0d0d0d] border-[#2a2a2a] text-[#c0c0c0]"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Risk Windows */}
        <div>
          <Label className="text-[#888] text-xs uppercase tracking-wider mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Risk Windows (no-trade zones)
          </Label>
          <Textarea
            value={data?.risk_windows || ''}
            onChange={(e) => onChange({ risk_windows: e.target.value })}
            placeholder="Times to avoid trading (e.g., 30min before/after major news)"
            className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
          />
        </div>
      </div>
    </div>
  );
}