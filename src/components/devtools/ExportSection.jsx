import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from 'sonner';
import { Download, FileJson, FileSpreadsheet, Loader2, Zap } from 'lucide-react';
import { getActiveProfileId } from '../utils/profileUtils';
import { 
  calculateClosedMetrics, 
  calculateEquityCurve, 
  calculateMaxDrawdown,
  calculateOpenMetrics,
  calculateDisciplineScore,
  calculateExitMetrics,
  calculateDailyStats,
  calculateTradeMetrics
} from '../analytics/analyticsCalculations';

export default function ExportSection() {
  const [scope, setScope] = useState('active');
  const [filter, setFilter] = useState('all');
  const [testRunId, setTestRunId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [period, setPeriod] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [loadProgress, setLoadProgress] = useState('');

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['userProfiles', user?.email],
    queryFn: async () => {
      if (!user) return [];
      return base44.entities.UserProfile.filter({ created_by: user.email }, '-created_date', 10);
    },
    enabled: !!user,
  });

  const activeProfile = profiles.find(p => p.is_active);

  // Batch load all trades with pagination
  const loadAllTrades = async () => {
    if (!user) return [];

    let allTrades = [];
    let offset = 0;
    const batchSize = 500;
    let hasMore = true;

    setLoadProgress('Loading trades...');

    while (hasMore) {
      const query = { created_by: user.email };

      // Apply scope filter
      if (scope === 'active' && activeProfile) {
        query.profile_id = activeProfile.id;
      }

      // Apply source filter
      if (filter === 'seed') {
        query.import_source = 'seed';
      } else if (filter === 'test_run_id' && testRunId) {
        query.test_run_id = testRunId;
      }

      const batch = await base44.entities.Trade.filter(query, '-created_date', batchSize);
      
      allTrades = [...allTrades, ...batch];
      setLoadProgress(`Loaded ${allTrades.length} trades...`);

      if (batch.length < batchSize) {
        hasMore = false;
      } else {
        offset += batchSize;
      }

      // Safety limit
      if (allTrades.length > 50000) {
        toast.error('Too many trades (>50k). Please use filters.');
        hasMore = false;
      }
    }

    // Apply date range filter (client-side)
    if (dateFrom || dateTo) {
      allTrades = allTrades.filter(t => {
        const tradeDate = new Date(t.date_open || t.date);
        if (dateFrom && tradeDate < new Date(dateFrom)) return false;
        if (dateTo && tradeDate > new Date(dateTo)) return false;
        return true;
      });
    }

    setLoadProgress('');
    return allTrades;
  };

  const handleExportJSON = async () => {
    setIsLoading(true);
    try {
      const trades = await loadAllTrades();
      
      // Determine test_run_id if applicable
      let commonTestRunId = null;
      if (trades.length > 0) {
        const firstRunId = trades[0].test_run_id;
        const allSame = trades.every(t => t.test_run_id === firstRunId);
        if (allSame && firstRunId) {
          commonTestRunId = firstRunId;
        }
      }
      
      // Parse JSON fields and enrich with calculated metrics
      const exportData = trades.map(t => {
        const metrics = calculateTradeMetrics(t);
        return {
          ...t,
          adds_history: t.adds_history ? JSON.parse(t.adds_history) : null,
          partial_closes: t.partial_closes ? JSON.parse(t.partial_closes) : null,
          action_history: t.action_history ? JSON.parse(t.action_history) : null,
          // Enriched calculated fields
          calculated_pnl_usd: metrics.netPnlUsd,
          calculated_rr_ratio: metrics.rrRatio,
          calculated_pnl_percent: metrics.pnlPercentOfBalance,
          calculated_r_multiple: metrics.rMultiple,
          calculated_realized_pnl_usd: metrics.realizedPnlUsd
        };
      });

      const exportPayload = {
        meta: {
          exported_at: new Date().toISOString(),
          user_email: user.email,
          profile_id: activeProfile?.id || 'all_profiles',
          test_run_id: commonTestRunId || (testRunId || null),
          filters: { scope, filter, date_from: dateFrom || null, date_to: dateTo || null },
          total_count: trades.length
        },
        trades: exportData
      };

      const dataStr = JSON.stringify(exportPayload, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trades_export_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast.success(`✅ Exported ${trades.length} trades (JSON)`);
    } catch (error) {
      toast.error('Export failed', { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCSV = async () => {
    setIsLoading(true);
    try {
      const trades = await loadAllTrades();

      if (trades.length === 0) {
        toast.error('No trades to export');
        return;
      }

      // CSV headers
      const headers = [
        'id', 'created_by', 'profile_id', 'import_source', 'test_run_id',
        'coin', 'direction', 'strategy_tag', 'timeframe',
        'date_open', 'date_close', 'created_date',
        'entry_price', 'close_price', 'stop_price', 'take_price',
        'position_size', 'account_balance_at_entry',
        'pnl_usd', 'realized_pnl_usd', 'pnl_percent_of_balance',
        'risk_usd', 'risk_percent', 'rr_ratio', 'r_multiple',
        'rule_compliance', 'emotional_state', 'confidence_level',
        'entry_reason', 'trade_analysis', 'violation_tags',
        'adds_history', 'partial_closes'
      ];

      const rows = trades.map(t => [
        t.id || '',
        t.created_by || '',
        t.profile_id || '',
        t.import_source || '',
        t.test_run_id || '',
        t.coin || '',
        t.direction || '',
        t.strategy_tag || '',
        t.timeframe || '',
        t.date_open || '',
        t.date_close || '',
        t.created_date || '',
        t.entry_price || '',
        t.close_price || '',
        t.stop_price || '',
        t.take_price || '',
        t.position_size || '',
        t.account_balance_at_entry || '',
        t.pnl_usd || '',
        t.realized_pnl_usd || '',
        t.pnl_percent_of_balance || '',
        t.risk_usd || '',
        t.risk_percent || '',
        t.rr_ratio || '',
        t.r_multiple || '',
        t.rule_compliance || '',
        t.emotional_state || '',
        t.confidence_level || '',
        (t.entry_reason || '').replace(/"/g, '""'),
        (t.trade_analysis || '').replace(/"/g, '""'),
        t.violation_tags || '',
        t.adds_history || '',
        t.partial_closes || ''
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trades_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast.success(`✅ Exported ${trades.length} trades (CSV)`);
    } catch (error) {
      toast.error('Export failed', { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportSnapshot = async () => {
    setIsLoading(true);
    try {
      const trades = await loadAllTrades();

      if (trades.length === 0) {
        toast.error('No trades to analyze');
        return;
      }

      const userTz = user?.preferred_timezone || 'UTC';
      const startingBalance = activeProfile?.starting_balance || 100000;

      // Apply period filter
      let filteredTrades = trades;
      const now = new Date();
      if (period === 'last30') {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filteredTrades = trades.filter(t => new Date(t.date_open || t.date) >= thirtyDaysAgo);
      } else if (period === 'range' && (dateFrom || dateTo)) {
        filteredTrades = trades.filter(t => {
          const tradeDate = new Date(t.date_open || t.date);
          if (dateFrom && tradeDate < new Date(dateFrom)) return false;
          if (dateTo && tradeDate > new Date(dateTo)) return false;
          return true;
        });
      }

      // Calculate metrics using analyticsCalculations
      const closedMetrics = calculateClosedMetrics(filteredTrades, startingBalance);
      const equityCurve = calculateEquityCurve(filteredTrades, startingBalance);
      const maxDrawdown = calculateMaxDrawdown(equityCurve, startingBalance);
      const openMetrics = calculateOpenMetrics(filteredTrades, startingBalance);
      const disciplineScore = calculateDisciplineScore(filteredTrades);
      const exitMetrics = calculateExitMetrics(filteredTrades);
      const dailyStats = calculateDailyStats(filteredTrades, userTz);

      // Breakdown by coin
      const byCoin = {};
      filteredTrades.filter(t => t.close_price).forEach(t => {
        if (!byCoin[t.coin]) byCoin[t.coin] = { trades: 0, pnl: 0 };
        byCoin[t.coin].trades++;
        byCoin[t.coin].pnl += t.pnl_usd || 0;
      });

      // Breakdown by strategy
      const byStrategy = {};
      filteredTrades.filter(t => t.close_price && t.strategy_tag).forEach(t => {
        if (!byStrategy[t.strategy_tag]) byStrategy[t.strategy_tag] = { trades: 0, pnl: 0 };
        byStrategy[t.strategy_tag].trades++;
        byStrategy[t.strategy_tag].pnl += t.pnl_usd || 0;
      });

      // Best/worst days
      const dailyArray = Object.entries(dailyStats).map(([date, stats]) => ({
        date,
        pnl: stats.pnlUsd
      })).sort((a, b) => b.pnl - a.pnl);

      // Determine common test_run_id
      let commonTestRunId = null;
      if (filteredTrades.length > 0) {
        const firstRunId = filteredTrades[0].test_run_id;
        const allSame = filteredTrades.every(t => t.test_run_id === firstRunId);
        if (allSame && firstRunId) {
          commonTestRunId = firstRunId;
        }
      }

      // Split trades
      const tradesClosed = filteredTrades.filter(t => t.close_price).map(t => {
        const metrics = calculateTradeMetrics(t);
        return {
          ...t,
          calculated_pnl_usd: metrics.netPnlUsd,
          calculated_rr_ratio: metrics.rrRatio,
          calculated_pnl_percent: metrics.pnlPercentOfBalance,
          calculated_r_multiple: metrics.rMultiple,
          calculated_realized_pnl_usd: metrics.realizedPnlUsd
        };
      });

      const tradesOpen = filteredTrades.filter(t => !t.close_price).map(t => {
        const metrics = calculateTradeMetrics(t);
        return {
          ...t,
          calculated_rr_ratio: metrics.rrRatio
        };
      });

      const snapshot = {
        meta: {
          user_email: user.email,
          profile_id: activeProfile?.id || 'all_profiles',
          profile_name: activeProfile?.profile_name || 'All Profiles',
          generated_at_iso: new Date().toISOString(),
          period: period === 'all' ? 'all_time' : period,
          date_from: dateFrom || null,
          date_to: dateTo || null,
          filters_applied: { 
            scope, 
            filter, 
            test_run_id: commonTestRunId || (testRunId || null)
          },
          trades_count_total: filteredTrades.length,
          trades_count_closed: tradesClosed.length,
          trades_count_open: tradesOpen.length,
          starting_balance: startingBalance,
          timezone: userTz
        },
        trades_closed: tradesClosed,
        trades_open: tradesOpen,
        metrics: {
          net_pnl_usd: closedMetrics.netPnlUsd,
          net_pnl_percent: closedMetrics.netPnlPercent,
          winrate: closedMetrics.winrate,
          wins: closedMetrics.wins,
          losses: closedMetrics.losses,
          breakevens: closedMetrics.breakevens,
          avg_r: closedMetrics.avgR,
          profit_factor: closedMetrics.profitFactor,
          expectancy: closedMetrics.expectancy,
          gross_profit: closedMetrics.grossProfit,
          gross_loss: closedMetrics.grossLoss,
          max_drawdown_percent: maxDrawdown.percent,
          max_drawdown_usd: maxDrawdown.usd,
          discipline_score: disciplineScore,
          best_day: dailyArray[0] || null,
          worst_day: dailyArray[dailyArray.length - 1] || null,
          equity_curve_points_count: equityCurve.length
        },
        open_positions: {
          count: openMetrics.openCount,
          total_risk_usd: openMetrics.totalRiskUsd,
          total_risk_percent: openMetrics.totalRiskPercent,
          total_potential_usd: openMetrics.totalPotentialUsd,
          total_potential_percent: openMetrics.totalPotentialPercent,
          total_rr: openMetrics.totalRR
        },
        exit_analysis: exitMetrics,
        breakdowns: {
          by_coin: byCoin,
          by_strategy: byStrategy,
          by_weekday: null // Can be added if needed
        },
        equity_curve: equityCurve,
        daily_stats: dailyStats
      };

      const dataStr = JSON.stringify(snapshot, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics_snapshot_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast.success('✅ Analytics snapshot exported');
    } catch (error) {
      toast.error('Export failed', { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecalculateMetrics = async () => {
    setIsRecalculating(true);
    try {
      const response = await base44.functions.invoke('recalculateTradeMetrics', {});
      const data = response.data;
      toast.success(`✅ Recalculated ${data.recalculated_trades} trades`, {
        description: `Total: ${data.total_trades} trades in ${data.profile_name}`
      });
    } catch (error) {
      toast.error('Recalculation failed', { description: error.message });
    } finally {
      setIsRecalculating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Recalculate Metrics */}
      <Card className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 border-[#2a2a2a]/50 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-yellow-400" />
          <h2 className="text-xl font-bold text-[#c0c0c0]">Recalculate Trade Metrics</h2>
        </div>
        <p className="text-sm text-[#888] mb-4">
          Fixes PnL, R-multiple, RR-ratio, and PnL% for all closed trades in active profile using corrected formulas.
        </p>
        <Button
          onClick={handleRecalculateMetrics}
          disabled={isRecalculating}
          className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700"
        >
          {isRecalculating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Recalculating...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" />
              Recalculate All Metrics
            </>
          )}
        </Button>
      </Card>

      {/* Export Trades */}
      <Card className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 border-[#2a2a2a]/50 p-6">
        <div className="flex items-center gap-2 mb-6">
          <Download className="w-5 h-5 text-blue-400" />
          <h2 className="text-xl font-bold text-[#c0c0c0]">Export Trades</h2>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[#c0c0c0]">Scope</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active Profile</SelectItem>
                  <SelectItem value="all">All My Profiles</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[#c0c0c0]">Filter</Label>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Trades</SelectItem>
                  <SelectItem value="seed">Only Seed Trades</SelectItem>
                  <SelectItem value="test_run_id">By Test Run ID</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {filter === 'test_run_id' && (
            <div className="space-y-2">
              <Label className="text-[#c0c0c0]">Test Run ID</Label>
              <Input
                value={testRunId}
                onChange={(e) => setTestRunId(e.target.value)}
                placeholder="Enter test_run_id"
                className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[#c0c0c0]">Date From (Optional)</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[#c0c0c0]">Date To (Optional)</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
              />
            </div>
          </div>

          {loadProgress && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-sm text-blue-400">{loadProgress}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={handleExportJSON}
              disabled={isLoading}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileJson className="w-4 h-4 mr-2" />
              )}
              Download JSON
            </Button>

            <Button
              onClick={handleExportCSV}
              disabled={isLoading}
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 mr-2" />
              )}
              Download CSV
            </Button>
          </div>
        </div>
      </Card>

      {/* Export Analytics Snapshot */}
      <Card className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 border-[#2a2a2a]/50 p-6">
        <div className="flex items-center gap-2 mb-6">
          <FileJson className="w-5 h-5 text-purple-400" />
          <h2 className="text-xl font-bold text-[#c0c0c0]">Export Analytics Snapshot</h2>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[#c0c0c0]">Period</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="last30">Last 30 Days</SelectItem>
                <SelectItem value="range">Date Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {period === 'range' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#c0c0c0]">From</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[#c0c0c0]">To</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
                />
              </div>
            </div>
          )}

          <Button
            onClick={handleExportSnapshot}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileJson className="w-4 h-4 mr-2" />
                Download Analytics Snapshot (JSON)
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}