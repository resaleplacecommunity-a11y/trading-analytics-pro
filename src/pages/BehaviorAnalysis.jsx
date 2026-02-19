
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import BehaviorChart from '../components/behavior/BehaviorChart';
import BehaviorInsights from '../components/behavior/BehaviorInsights';
import EmotionTrend from '../components/dashboard/EmotionTrend';
import { getTradesForActiveProfile, getActiveProfileId, getDataForActiveProfile } from '../components/utils/profileUtils';

const TRIGGER_TYPES = [
  'Revenge Trade',
  'Overtrading',
  'Night Trading',
  'Wide Stops',
  'Moving Stop',
  'FOMO Entry',
  'Early Exit',
  'Greed',
  'Fear',
  'Boredom Entry',
  'Ignoring Plan',
  'Tilt'
];

export default function BehaviorAnalysis() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLog, setNewLog] = useState({
    date: new Date().toISOString().split('T')[0],
    trigger_name: '',
    trigger_count: 1,
    description: '',
    severity: 'medium'
  });

  const queryClient = useQueryClient();

  const { data: trades = [] } = useQuery({
    queryKey: ['trades'],
    queryFn: () => getTradesForActiveProfile(),
  });

  const { data: behaviorLogs = [] } = useQuery({
    queryKey: ['behaviorLogs'],
    queryFn: () => getDataForActiveProfile('BehaviorLog', '-date', 500),
  });

  const addLogMutation = useMutation({
    mutationFn: async (data) => {
      const profileId = await getActiveProfileId();
      return base44.entities.BehaviorLog.create({ ...data, profile_id: profileId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['behaviorLogs']);
      setShowAddForm(false);
      setNewLog({
        date: new Date().toISOString().split('T')[0],
        trigger_name: '',
        trigger_count: 1,
        description: '',
        severity: 'medium'
      });
      toast.success('Behavior logged');
    },
  });

  const deleteLogMutation = useMutation({
    mutationFn: (id) => base44.entities.BehaviorLog.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['behaviorLogs']);
    },
  });

  // Stats
  const totalTriggers = behaviorLogs.reduce((s, l) => s + (l.trigger_count || 1), 0);
  const uniqueTriggers = [...new Set(behaviorLogs.map(l => l.trigger_name))].length;
  const mostCommon = behaviorLogs.reduce((acc, l) => {
    acc[l.trigger_name] = (acc[l.trigger_name] || 0) + (l.trigger_count || 1);
    return acc;
  }, {});
  const topTrigger = Object.entries(mostCommon).sort((a, b) => b[1] - a[1])[0];

  // Emotional correlation
  const lowEmotionTrades = trades.filter(t => t.emotional_state && t.emotional_state < 5);
  const highEmotionTrades = trades.filter(t => t.emotional_state && t.emotional_state >= 7);
  const lowEmotionPnl = lowEmotionTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
  const highEmotionPnl = highEmotionTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#c0c0c0]">Behavior Analysis</h1>
          <p className="text-[#666] text-sm">Track and analyze your trading psychology</p>
        </div>
        <Button 
          onClick={() => setShowAddForm(true)}
          className="bg-[#c0c0c0] text-black hover:bg-[#a0a0a0]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Log Behavior
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-4 border border-[#2a2a2a]">
          <p className="text-[#888] text-xs">Total Triggers</p>
          <p className="text-2xl font-bold text-[#c0c0c0] mt-1">{totalTriggers}</p>
        </div>
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-4 border border-[#2a2a2a]">
          <p className="text-[#888] text-xs">Unique Types</p>
          <p className="text-2xl font-bold text-[#c0c0c0] mt-1">{uniqueTriggers}</p>
        </div>
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-4 border border-[#2a2a2a]">
          <p className="text-[#888] text-xs">Most Common</p>
          <p className="text-lg font-bold text-red-400 mt-1">{topTrigger?.[0] || 'N/A'}</p>
        </div>
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-4 border border-[#2a2a2a]">
          <p className="text-[#888] text-xs">This Month</p>
          <p className="text-2xl font-bold text-[#c0c0c0] mt-1">
            {behaviorLogs.filter(l => l.date?.startsWith(format(new Date(), 'yyyy-MM'))).length}
          </p>
        </div>
      </div>

      {/* Emotional Impact */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={cn(
          "rounded-xl p-4 border",
          lowEmotionPnl < 0 ? "bg-red-500/5 border-red-500/20" : "bg-[#1a1a1a] border-[#2a2a2a]"
        )}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-5 h-5 text-red-400" />
            <span className="text-[#888] text-sm">Low Emotion Trades (1-4)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#c0c0c0]">{lowEmotionTrades.length} trades</span>
            <span className={lowEmotionPnl >= 0 ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
              ${Math.round(lowEmotionPnl).toLocaleString('ru-RU').replace(/,/g, ' ')}
            </span>
          </div>
        </div>
        <div className={cn(
          "rounded-xl p-4 border",
          highEmotionPnl > 0 ? "bg-emerald-500/5 border-emerald-500/20" : "bg-[#1a1a1a] border-[#2a2a2a]"
        )}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <span className="text-[#888] text-sm">High Emotion Trades (7-10)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#c0c0c0]">{highEmotionTrades.length} trades</span>
            <span className={highEmotionPnl >= 0 ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
              ${Math.round(highEmotionPnl).toLocaleString('ru-RU').replace(/,/g, ' ')}
            </span>
          </div>
        </div>
      </div>

      {/* Charts & Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BehaviorChart behaviorLogs={behaviorLogs} />
        <BehaviorInsights trades={trades} behaviorLogs={behaviorLogs} />
      </div>

      {/* Emotion Trend */}
      <EmotionTrend trades={trades} />

      {/* Recent Logs */}
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
        <h3 className="text-[#c0c0c0] font-medium mb-4">Recent Behavior Logs</h3>
        {behaviorLogs.length > 0 ? (
          <div className="space-y-2">
            {behaviorLogs.slice(0, 10).map(log => (
              <div 
                key={log.id} 
                className="flex items-center justify-between p-3 bg-[#151515] rounded-lg group"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    log.severity === 'high' ? "bg-red-400" :
                    log.severity === 'medium' ? "bg-yellow-400" : "bg-blue-400"
                  )} />
                  <div>
                    <p className="text-[#c0c0c0] text-sm font-medium">{log.trigger_name}</p>
                    <p className="text-[#666] text-xs">
                      {format(new Date(log.date), 'MMM d')} 
                      {log.trigger_count > 1 && ` • ${log.trigger_count}x`}
                      {log.description && ` • ${log.description}`}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => deleteLogMutation.mutate(log.id)}
                >
                  <X className="w-4 h-4 text-[#666]" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[#666] text-sm text-center py-4">No behavior logs yet</p>
        )}
      </div>

      {/* Add Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[#c0c0c0] font-semibold">Log Behavior Trigger</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowAddForm(false)}>
                <X className="w-5 h-5 text-[#666]" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-[#888]">Date</Label>
                <Input 
                  type="date"
                  value={newLog.date}
                  onChange={(e) => setNewLog({...newLog, date: e.target.value})}
                  className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] mt-1"
                />
              </div>

              <div>
                <Label className="text-[#888]">Trigger Type</Label>
                <Select 
                  value={newLog.trigger_name}
                  onValueChange={(v) => setNewLog({...newLog, trigger_name: v})}
                >
                  <SelectTrigger className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] mt-1">
                    <SelectValue placeholder="Select trigger" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
                    {TRIGGER_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[#888]">Severity</Label>
                <Select 
                  value={newLog.severity}
                  onValueChange={(v) => setNewLog({...newLog, severity: v})}
                >
                  <SelectTrigger className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[#888]">Count</Label>
                <Input 
                  type="number"
                  min="1"
                  value={newLog.trigger_count}
                  onChange={(e) => setNewLog({...newLog, trigger_count: parseInt(e.target.value)})}
                  className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] mt-1"
                />
              </div>

              <div>
                <Label className="text-[#888]">Description (optional)</Label>
                <Textarea 
                  placeholder="What happened?"
                  value={newLog.description}
                  onChange={(e) => setNewLog({...newLog, description: e.target.value})}
                  className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] mt-1 h-20"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="ghost" onClick={() => setShowAddForm(false)} className="text-[#888]">
                Cancel
              </Button>
              <Button 
                onClick={() => addLogMutation.mutate(newLog)}
                disabled={!newLog.trigger_name}
                className="bg-[#c0c0c0] text-black hover:bg-[#a0a0a0]"
              >
                Save Log
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
