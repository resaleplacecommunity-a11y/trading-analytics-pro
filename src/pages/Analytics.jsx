import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, TrendingUp, Target, DollarSign, Percent, BarChart3, Zap, AlertCircle } from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';
import { cn } from "@/lib/utils";
import StatsCard from '../components/dashboard/StatsCard';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function Analytics() {
  const [dateRange, setDateRange] = useState('month');
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [symbolFilter, setSymbolFilter] = useState('all');
  const [strategyFilter, setStrategyFilter] = useState('all');
  const [timeframeFilter, setTimeframeFilter] = useState('all');
  const [sideFilter, setSideFilter] = useState('all');

  const { data: allTrades = [] } = useQuery({
    queryKey: ['trades'],
    queryFn: () => base44.entities.Trade.list('-date_open', 1000)
  });

  // Calculate date range
  const today = startOfDay(new Date());
  let rangeStart = today;
  
  if (dateRange === 'today') rangeStart = today;
  else if (dateRange === 'week') rangeStart = subDays(today, 7);
  else if (dateRange === 'month') rangeStart = subDays(today, 30);
  else if (dateRange === 'custom' && dateFrom) rangeStart = startOfDay(dateFrom);

  const rangeEnd = dateRange === 'custom' && dateTo ? startOfDay(dateTo) : today;

  // Filter trades
  const filteredTrades = allTrades.filter(trade => {
    const tradeDate = startOfDay(new Date(trade.date_close || trade.date_open));
    if (tradeDate < rangeStart || tradeDate > rangeEnd) return false;
    if (symbolFilter !== 'all' && trade.coin?.replace('USDT', '') !== symbolFilter) return false;
    if (strategyFilter !== 'all' && trade.strategy_tag !== strategyFilter) return false;
    if (timeframeFilter !== 'all' && trade.timeframe !== timeframeFilter) return false;
    if (sideFilter !== 'all' && trade.direction !== sideFilter) return false;
    return true;
  });

  const closedTrades = filteredTrades.filter(t => t.close_price_final || t.close_price);
  const openTrades = filteredTrades.filter(t => !(t.close_price_final || t.close_price));

  // Overview calculations
  const totalPnlUsd = closedTrades.reduce((s, t) => s + (t.pnl_total_usd || t.pnl_usd || 0), 0);
  const totalPnlPct = (totalPnlUsd / 100000) * 100;

  const wins = closedTrades.filter(t => (t.pnl_total_usd || t.pnl_usd || 0) > 0);
  const losses = closedTrades.filter(t => (t.pnl_total_usd || t.pnl_usd || 0) < 0);
  const winrate = closedTrades.length > 0 ? (wins.length / closedTrades.length * 100) : 0;

  const grossProfit = wins.reduce((s, t) => s + (t.pnl_total_usd || t.pnl_usd || 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.pnl_total_usd || t.pnl_usd || 0), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;

  const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
  const expectancy = closedTrades.length > 0 ? totalPnlUsd / closedTrades.length : 0;

  const avgR = closedTrades.length > 0 ?
    closedTrades.reduce((s, t) => s + (t.r_multiple || 0), 0) / closedTrades.length : 0;

  const avgRiskPct = closedTrades.length > 0 ?
    closedTrades.reduce((s, t) => s + (t.max_risk_pct || 0), 0) / closedTrades.length : 0;

  // R-multiple distribution
  const rBuckets = { '-3+': 0, '-2': 0, '-1': 0, '0': 0, '1': 0, '2': 0, '3+': 0 };
  closedTrades.forEach(t => {
    const r = t.r_multiple || 0;
    if (r < -2) rBuckets['-3+']++;
    else if (r < -1) rBuckets['-2']++;
    else if (r < 0) rBuckets['-1']++;
    else if (r < 1) rBuckets['0']++;
    else if (r < 2) rBuckets['1']++;
    else if (r < 3) rBuckets['2']++;
    else rBuckets['3+']++;
  });

  const rDistribution = Object.entries(rBuckets).map(([bucket, count]) => ({
    bucket,
    count
  }));

  // Get unique values for filters
  const coins = [...new Set(allTrades.map(t => t.coin?.replace('USDT', '')).filter(Boolean))];
  const strategies = [...new Set(allTrades.map(t => t.strategy_tag).filter(Boolean))];

  const formatNumber = (num) => {
    if (num === undefined || num === null || num === '') return '—';
    const n = parseFloat(num);
    if (isNaN(n)) return '—';
    return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#c0c0c0]">Analytics Terminal</h1>
          <p className="text-[#666] text-sm">Advanced performance metrics</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-[#2a2a2a] rounded-xl p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* Date Range */}
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="bg-[#0d0d0d] border-[#2a2a2a] text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-[#333]">
              <SelectItem value="today" className="text-white">Today</SelectItem>
              <SelectItem value="week" className="text-white">Week</SelectItem>
              <SelectItem value="month" className="text-white">Month</SelectItem>
              <SelectItem value="custom" className="text-white">Custom</SelectItem>
            </SelectContent>
          </Select>

          {dateRange === 'custom' && (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="bg-[#0d0d0d] border-[#2a2a2a] text-white justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, 'MMM dd') : 'From'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-[#1a1a1a] border-[#333]">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="bg-[#0d0d0d] border-[#2a2a2a] text-white justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, 'MMM dd') : 'To'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-[#1a1a1a] border-[#333]">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} />
                </PopoverContent>
              </Popover>
            </>
          )}

          {/* Coin Filter */}
          <Select value={symbolFilter} onValueChange={setSymbolFilter}>
            <SelectTrigger className="bg-[#0d0d0d] border-[#2a2a2a] text-white">
              <SelectValue placeholder="All Coins" />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-[#333]">
              <SelectItem value="all" className="text-white">All Coins</SelectItem>
              {coins.map(c => (
                <SelectItem key={c} value={c} className="text-white">{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Strategy Filter */}
          <Select value={strategyFilter} onValueChange={setStrategyFilter}>
            <SelectTrigger className="bg-[#0d0d0d] border-[#2a2a2a] text-white">
              <SelectValue placeholder="All Strategies" />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-[#333]">
              <SelectItem value="all" className="text-white">All Strategies</SelectItem>
              {strategies.map(s => (
                <SelectItem key={s} value={s} className="text-white">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Timeframe Filter */}
          <Select value={timeframeFilter} onValueChange={setTimeframeFilter}>
            <SelectTrigger className="bg-[#0d0d0d] border-[#2a2a2a] text-white">
              <SelectValue placeholder="All Timeframes" />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-[#333]">
              <SelectItem value="all" className="text-white">All Timeframes</SelectItem>
              <SelectItem value="scalp" className="text-white">Scalp</SelectItem>
              <SelectItem value="day" className="text-white">Day</SelectItem>
              <SelectItem value="swing" className="text-white">Swing</SelectItem>
              <SelectItem value="mid_term" className="text-white">Mid-term</SelectItem>
              <SelectItem value="long_term" className="text-white">Long-term</SelectItem>
              <SelectItem value="spot" className="text-white">Spot</SelectItem>
            </SelectContent>
          </Select>

          {/* Side Filter */}
          <Select value={sideFilter} onValueChange={setSideFilter}>
            <SelectTrigger className="bg-[#0d0d0d] border-[#2a2a2a] text-white">
              <SelectValue placeholder="All Sides" />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-[#333]">
              <SelectItem value="all" className="text-white">All Sides</SelectItem>
              <SelectItem value="Long" className="text-white">Long Only</SelectItem>
              <SelectItem value="Short" className="text-white">Short Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard 
          title="Total PNL"
          value={totalPnlUsd >= 0 ? `+$${formatNumber(totalPnlUsd)}` : `-$${formatNumber(Math.abs(totalPnlUsd))}`}
          subtitle={`${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct.toFixed(2)}%`}
          icon={DollarSign}
        />
        <StatsCard 
          title="Winrate"
          value={closedTrades.length > 0 ? `${winrate.toFixed(1)}%` : '—'}
          subtitle={`${wins.length}W / ${losses.length}L`}
          icon={Percent}
          valueColor={winrate >= 50 ? 'text-emerald-400' : 'text-red-400'}
        />
        <StatsCard 
          title="Profit Factor"
          value={profitFactor > 0 ? profitFactor.toFixed(2) : '—'}
          subtitle={grossLoss > 0 ? `$${formatNumber(grossProfit)} / $${formatNumber(grossLoss)}` : '—'}
          icon={Target}
          valueColor={profitFactor >= 2 ? 'text-emerald-400' : profitFactor >= 1 ? 'text-yellow-400' : 'text-red-400'}
        />
        <StatsCard 
          title="Expectancy"
          value={expectancy !== 0 ? `$${formatNumber(expectancy)}` : '—'}
          subtitle="Per Trade"
          icon={TrendingUp}
          valueColor={expectancy > 0 ? 'text-emerald-400' : 'text-red-400'}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard 
          title="Avg R"
          value={avgR !== 0 ? `${avgR.toFixed(2)}R` : '—'}
          icon={Target}
          valueColor={avgR >= 2 ? 'text-emerald-400' : avgR >= 1 ? 'text-yellow-400' : 'text-red-400'}
        />
        <StatsCard 
          title="Avg Win"
          value={avgWin > 0 ? `+$${formatNumber(avgWin)}` : '—'}
          icon={TrendingUp}
        />
        <StatsCard 
          title="Avg Loss"
          value={avgLoss > 0 ? `-$${formatNumber(avgLoss)}` : '—'}
          icon={AlertCircle}
        />
        <StatsCard 
          title="Trades"
          value={`${closedTrades.length}`}
          subtitle={`${openTrades.length} open`}
          icon={BarChart3}
        />
      </div>

      {/* R-Multiple Distribution */}
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
        <h3 className="text-[#c0c0c0] text-sm font-medium mb-4">R-Multiple Distribution</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rDistribution}>
              <XAxis 
                dataKey="bucket" 
                axisLine={false} 
                tickLine={false}
                tick={{ fill: '#666', fontSize: 11 }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false}
                tick={{ fill: '#666', fontSize: 11 }}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload?.[0]) {
                    return (
                      <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3">
                        <p className="text-[#c0c0c0] text-sm font-bold">{payload[0].payload.bucket}R</p>
                        <p className="text-[#888] text-xs">{payload[0].value} trades</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {rDistribution.map((entry, index) => (
                  <Cell 
                    key={index} 
                    fill={entry.bucket.includes('-') ? '#ef4444' : entry.bucket === '0' ? '#888' : '#10b981'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Strategy Performance Table */}
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
        <h3 className="text-[#c0c0c0] text-sm font-medium mb-4">Strategy Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                <th className="text-left text-[10px] text-[#666] uppercase tracking-wide py-2 px-3">Strategy</th>
                <th className="text-center text-[10px] text-[#666] uppercase tracking-wide py-2 px-3">Trades</th>
                <th className="text-center text-[10px] text-[#666] uppercase tracking-wide py-2 px-3">WR</th>
                <th className="text-right text-[10px] text-[#666] uppercase tracking-wide py-2 px-3">PNL</th>
                <th className="text-center text-[10px] text-[#666] uppercase tracking-wide py-2 px-3">Avg R</th>
                <th className="text-center text-[10px] text-[#666] uppercase tracking-wide py-2 px-3">PF</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const strategyStats = {};
                closedTrades.forEach(t => {
                  const strategy = t.strategy_tag || 'No Strategy';
                  if (!strategyStats[strategy]) {
                    strategyStats[strategy] = { pnl: 0, count: 0, wins: 0, totalR: 0, grossProfit: 0, grossLoss: 0 };
                  }
                  const pnl = t.pnl_total_usd || t.pnl_usd || 0;
                  strategyStats[strategy].pnl += pnl;
                  strategyStats[strategy].count += 1;
                  strategyStats[strategy].totalR += t.r_multiple || 0;
                  if (pnl > 0) {
                    strategyStats[strategy].wins += 1;
                    strategyStats[strategy].grossProfit += pnl;
                  } else {
                    strategyStats[strategy].grossLoss += Math.abs(pnl);
                  }
                });

                return Object.entries(strategyStats)
                  .sort((a, b) => b[1].pnl - a[1].pnl)
                  .map(([name, stats]) => {
                    const wr = (stats.wins / stats.count * 100).toFixed(0);
                    const avgR = (stats.totalR / stats.count).toFixed(2);
                    const pf = stats.grossLoss > 0 ? (stats.grossProfit / stats.grossLoss).toFixed(2) : '∞';
                    
                    return (
                      <tr key={name} className="border-b border-[#1a1a1a] hover:bg-[#151515]">
                        <td className="py-2 px-3 text-sm text-[#c0c0c0]">{name}</td>
                        <td className="py-2 px-3 text-center text-sm text-[#888]">{stats.count}</td>
                        <td className="py-2 px-3 text-center text-sm text-[#888]">{wr}%</td>
                        <td className={cn(
                          "py-2 px-3 text-right text-sm font-bold",
                          stats.pnl >= 0 ? "text-emerald-400" : "text-red-400"
                        )}>
                          {stats.pnl >= 0 ? '+' : ''}${formatNumber(stats.pnl)}
                        </td>
                        <td className="py-2 px-3 text-center text-sm text-[#888]">{avgR}</td>
                        <td className={cn(
                          "py-2 px-3 text-center text-sm font-bold",
                          parseFloat(pf) >= 2 ? "text-emerald-400" : parseFloat(pf) >= 1 ? "text-yellow-400" : "text-red-400"
                        )}>{pf}</td>
                      </tr>
                    );
                  });
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}