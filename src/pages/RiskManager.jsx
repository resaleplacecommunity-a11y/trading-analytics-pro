import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AlertTriangle, CheckCircle, XCircle, Clock, TrendingDown, Shield, Activity } from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import StatsCard from '../components/dashboard/StatsCard';
import RiskSettingsForm from '../components/risk/RiskSettingsForm';

export default function RiskManager() {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: trades = [] } = useQuery({
    queryKey: ['trades'],
    queryFn: () => base44.entities.Trade.list('-date', 1000),
  });

  const { data: riskSettings, refetch: refetchSettings } = useQuery({
    queryKey: ['riskSettings'],
    queryFn: async () => {
      const settings = await base44.entities.RiskSettings.list();
      return settings[0] || null;
    },
  });

  const { data: behaviorLogs = [] } = useQuery({
    queryKey: ['behaviorLogs'],
    queryFn: () => base44.entities.BehaviorLog.list('-date', 100),
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async (data) => {
      if (riskSettings?.id) {
        return base44.entities.RiskSettings.update(riskSettings.id, data);
      } else {
        return base44.entities.RiskSettings.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['riskSettings']);
      toast.success('Settings saved');
    },
  });

  // Today's stats
  const todayTrades = trades.filter(t => t.date?.startsWith(today));
  const todayPnlUsd = todayTrades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
  const todayPnlPercent = todayTrades.reduce((s, t) => s + (t.pnl_percent || 0), 0);
  const todayR = todayTrades.reduce((s, t) => s + (t.r_multiple || 0), 0);
  const todayViolations = behaviorLogs.filter(l => l.date === today).length;

  // Calculate violations
  const violations = [];
  const warnings = [];

  if (riskSettings) {
    // Daily loss limit
    if (riskSettings.daily_max_loss_percent && todayPnlPercent < -riskSettings.daily_max_loss_percent) {
      violations.push({
        type: 'error',
        icon: TrendingDown,
        title: 'Daily Loss Limit Exceeded',
        message: `Lost ${Math.abs(todayPnlPercent).toFixed(2)}% today (limit: ${riskSettings.daily_max_loss_percent}%)`
      });
    } else if (riskSettings.daily_max_loss_percent && todayPnlPercent < -riskSettings.daily_max_loss_percent * 0.7) {
      warnings.push({
        type: 'warning',
        icon: AlertTriangle,
        title: 'Approaching Loss Limit',
        message: `Lost ${Math.abs(todayPnlPercent).toFixed(2)}% - ${(riskSettings.daily_max_loss_percent * 0.3).toFixed(1)}% remaining`
      });
    }

    // Daily R limit
    if (riskSettings.daily_max_r && todayR < -riskSettings.daily_max_r) {
      violations.push({
        type: 'error',
        icon: Activity,
        title: 'Daily R Limit Exceeded',
        message: `Lost ${Math.abs(todayR).toFixed(2)}R today (limit: ${riskSettings.daily_max_r}R)`
      });
    }

    // Trade count limit
    if (riskSettings.max_trades_per_day && todayTrades.length >= riskSettings.max_trades_per_day) {
      violations.push({
        type: 'error',
        icon: XCircle,
        title: 'Max Trades Reached',
        message: `${todayTrades.length} trades today (limit: ${riskSettings.max_trades_per_day})`
      });
    } else if (riskSettings.max_trades_per_day && todayTrades.length >= riskSettings.max_trades_per_day - 1) {
      warnings.push({
        type: 'warning',
        icon: AlertTriangle,
        title: 'Almost at Trade Limit',
        message: `${todayTrades.length}/${riskSettings.max_trades_per_day} trades used`
      });
    }

    // Consecutive losses
    const recentTrades = [...trades].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
    const consecutiveLosses = recentTrades.findIndex(t => (t.pnl_usd || 0) >= 0);
    const lossStreak = consecutiveLosses === -1 ? recentTrades.length : consecutiveLosses;
    
    if (lossStreak >= (riskSettings.max_consecutive_losses || 3)) {
      violations.push({
        type: 'error',
        icon: TrendingDown,
        title: 'Loss Streak',
        message: `${lossStreak} consecutive losses - take a break!`
      });
    }

    // Trading hours check
    const now = new Date();
    const currentTime = format(now, 'HH:mm');
    if (riskSettings.trading_hours_start && riskSettings.trading_hours_end) {
      if (currentTime < riskSettings.trading_hours_start || currentTime > riskSettings.trading_hours_end) {
        warnings.push({
          type: 'warning',
          icon: Clock,
          title: 'Outside Trading Hours',
          message: `Allowed: ${riskSettings.trading_hours_start} - ${riskSettings.trading_hours_end}`
        });
      }
    }

    // Emotional state check
    if (todayTrades.length > 0 && riskSettings.emotions_threshold) {
      const avgEmotion = todayTrades.filter(t => t.emotional_state).reduce((s, t, _, a) => 
        s + t.emotional_state / a.length, 0) || 5;
      if (avgEmotion < riskSettings.emotions_threshold) {
        warnings.push({
          type: 'warning',
          icon: AlertTriangle,
          title: 'Low Emotional State',
          message: `Avg: ${avgEmotion.toFixed(1)}/10 (threshold: ${riskSettings.emotions_threshold})`
        });
      }
    }
  }

  const canTrade = violations.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#c0c0c0]">Risk Manager</h1>
        <p className="text-[#666] text-sm">Monitor and manage your trading risk</p>
      </div>

      {/* Trading Status */}
      <div className={cn(
        "rounded-xl p-6 border-2",
        canTrade 
          ? "bg-emerald-500/5 border-emerald-500/30" 
          : "bg-red-500/5 border-red-500/30"
      )}>
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center",
            canTrade ? "bg-emerald-500/20" : "bg-red-500/20"
          )}>
            {canTrade ? (
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            ) : (
              <XCircle className="w-8 h-8 text-red-400" />
            )}
          </div>
          <div>
            <h2 className={cn(
              "text-2xl font-bold",
              canTrade ? "text-emerald-400" : "text-red-400"
            )}>
              {canTrade ? 'Ready to Trade' : 'Stop Trading'}
            </h2>
            <p className="text-[#888] mt-1">
              {canTrade 
                ? 'All risk parameters are within limits'
                : `${violations.length} violation(s) detected`
              }
            </p>
          </div>
        </div>
      </div>

      {/* Today's Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard 
          title="Today's PNL" 
          value={`${todayPnlUsd >= 0 ? '+' : ''}$${todayPnlUsd.toFixed(2)}`}
          subtitle={riskSettings?.daily_max_loss_percent ? 
            `Limit: -${riskSettings.daily_max_loss_percent}%` : undefined}
        />
        <StatsCard 
          title="Today's R" 
          value={`${todayR >= 0 ? '+' : ''}${todayR.toFixed(2)}R`}
          subtitle={riskSettings?.daily_max_r ? 
            `Limit: -${riskSettings.daily_max_r}R` : undefined}
        />
        <StatsCard 
          title="Trades Today" 
          value={todayTrades.length}
          subtitle={riskSettings?.max_trades_per_day ? 
            `Limit: ${riskSettings.max_trades_per_day}` : undefined}
        />
        <StatsCard 
          title="Violations" 
          value={todayViolations}
          icon={AlertTriangle}
        />
      </div>

      {/* Alerts */}
      {(violations.length > 0 || warnings.length > 0) && (
        <div className="space-y-3">
          <h3 className="text-[#c0c0c0] font-medium">Active Alerts</h3>
          
          {violations.map((v, i) => (
            <div key={i} className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <div className="p-2 rounded-lg bg-red-500/20">
                <v.icon className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-red-400 font-medium">{v.title}</p>
                <p className="text-[#888] text-sm mt-1">{v.message}</p>
              </div>
            </div>
          ))}
          
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
              <div className="p-2 rounded-lg bg-yellow-500/20">
                <w.icon className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-yellow-400 font-medium">{w.title}</p>
                <p className="text-[#888] text-sm mt-1">{w.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All Clear */}
      {violations.length === 0 && warnings.length === 0 && (
        <div className="flex items-center gap-3 bg-[#1a1a1a] rounded-xl p-4">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <p className="text-[#888]">No warnings or violations. You're good to trade!</p>
        </div>
      )}

      {/* Risk Settings */}
      <RiskSettingsForm 
        settings={riskSettings}
        onSave={(data) => saveSettingsMutation.mutate(data)}
      />
    </div>
  );
}