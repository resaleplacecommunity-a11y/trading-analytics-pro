import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { X } from 'lucide-react';
import { cn } from "@/lib/utils";
import AnalyticsFilters from '../components/analytics/AnalyticsFilters';
import OverviewTab from '../components/analytics/OverviewTab';
import PerformanceTab from '../components/analytics/PerformanceTab';
import RiskDrawdownTab from '../components/analytics/RiskDrawdownTab';
import BehaviorDisciplineTab from '../components/analytics/BehaviorDisciplineTab';
import PsychologyTab from '../components/analytics/PsychologyTab';
import StrategiesTab from '../components/analytics/StrategiesTab';
import SymbolsTab from '../components/analytics/SymbolsTab';
import SessionsTab from '../components/analytics/SessionsTab';

export default function Analytics() {
  const [filters, setFilters] = useState({
    dateRange: 'month',
    dateFrom: null,
    dateTo: null,
    status: 'closed',
    symbols: [],
    strategies: [],
    timeframes: [],
    direction: 'all',
    market: 'all',
    includeFees: true
  });

  const { data: allTrades = [] } = useQuery({
    queryKey: ['trades'],
    queryFn: () => base44.entities.Trade.list('-date_open', 10000)
  });

  const { data: behaviorLogs = [] } = useQuery({
    queryKey: ['behaviorLogs'],
    queryFn: () => base44.entities.BehaviorLog.list('-date', 1000)
  });

  const hasActiveFilters = 
    filters.symbols.length > 0 || 
    filters.strategies.length > 0 || 
    filters.timeframes.length > 0 || 
    filters.direction !== 'all' || 
    filters.market !== 'all' ||
    filters.dateRange === 'custom';

  const resetFilters = () => {
    setFilters({
      dateRange: 'month',
      dateFrom: null,
      dateTo: null,
      status: 'closed',
      symbols: [],
      strategies: [],
      timeframes: [],
      direction: 'all',
      market: 'all',
      includeFees: true
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#c0c0c0]">Analytics Hub</h1>
          <p className="text-[#666] text-sm">Performance intelligence center</p>
        </div>
      </div>

      {/* Global Filters */}
      <AnalyticsFilters 
        filters={filters} 
        setFilters={setFilters}
        allTrades={allTrades}
      />

      {/* Active Filters Indicator */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-1.5">
          <span className="text-xs text-amber-400">Filters active</span>
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={resetFilters}
            className="h-5 px-2 text-xs text-amber-400 hover:text-amber-300"
          >
            <X className="w-3 h-3 mr-1" />
            Clear all
          </Button>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-[#1a1a1a] border border-[#2a2a2a] p-1 flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="data-[state=active]:bg-[#c0c0c0] data-[state=active]:text-black text-[#888] text-xs">
            Overview
          </TabsTrigger>
          <TabsTrigger value="performance" className="data-[state=active]:bg-[#c0c0c0] data-[state=active]:text-black text-[#888] text-xs">
            Performance
          </TabsTrigger>
          <TabsTrigger value="risk" className="data-[state=active]:bg-[#c0c0c0] data-[state=active]:text-black text-[#888] text-xs">
            Risk & Drawdown
          </TabsTrigger>
          <TabsTrigger value="behavior" className="data-[state=active]:bg-[#c0c0c0] data-[state=active]:text-black text-[#888] text-xs">
            Behavior
          </TabsTrigger>
          <TabsTrigger value="psychology" className="data-[state=active]:bg-[#c0c0c0] data-[state=active]:text-black text-[#888] text-xs">
            Psychology
          </TabsTrigger>
          <TabsTrigger value="strategies" className="data-[state=active]:bg-[#c0c0c0] data-[state=active]:text-black text-[#888] text-xs">
            Strategies
          </TabsTrigger>
          <TabsTrigger value="symbols" className="data-[state=active]:bg-[#c0c0c0] data-[state=active]:text-black text-[#888] text-xs">
            Symbols
          </TabsTrigger>
          <TabsTrigger value="sessions" className="data-[state=active]:bg-[#c0c0c0] data-[state=active]:text-black text-[#888] text-xs">
            Sessions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab trades={allTrades} filters={filters} />
        </TabsContent>

        <TabsContent value="performance">
          <PerformanceTab trades={allTrades} filters={filters} />
        </TabsContent>

        <TabsContent value="risk">
          <RiskDrawdownTab trades={allTrades} filters={filters} />
        </TabsContent>

        <TabsContent value="behavior">
          <BehaviorDisciplineTab trades={allTrades} filters={filters} behaviorLogs={behaviorLogs} />
        </TabsContent>

        <TabsContent value="psychology">
          <PsychologyTab trades={allTrades} filters={filters} />
        </TabsContent>

        <TabsContent value="strategies">
          <StrategiesTab trades={allTrades} filters={filters} />
        </TabsContent>

        <TabsContent value="symbols">
          <SymbolsTab trades={allTrades} filters={filters} />
        </TabsContent>

        <TabsContent value="sessions">
          <SessionsTab trades={allTrades} filters={filters} />
        </TabsContent>
      </Tabs>
    </div>
  );
}