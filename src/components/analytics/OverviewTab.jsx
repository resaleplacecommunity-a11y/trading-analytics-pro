import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { DollarSign, Percent, Target, TrendingUp, TrendingDown, BarChart3, Zap, AlertTriangle } from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from "@/lib/utils";
import StatsCard from '../dashboard/StatsCard';
import { applyFilters } from './filterUtils';

const formatNumber = (num) => {
  if (num === undefined || num === null || num === '') return '—';
  const n = parseFloat(num);
  if (isNaN(n)) return '—';
  return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
};

export default function OverviewTab({ trades, filters }) {
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [aiInsights, setAiInsights] = useState(null);

  const filtered = applyFilters(trades, filters);
  const closedTrades = filtered.filter(t => t.close_price_final || t.close_price);

  // Calculate metrics
  const totalPnlUsd = closedTrades.reduce((s, t) => s + (t.pnl_total_usd || t.pnl_usd || 0), 0);
  const totalPnlPct = (totalPnlUsd / 100000) * 100;

  const wins = closedTrades.filter(t => (t.pnl_total_usd || t.pnl_usd || 0) > 0);
  const losses = closedTrades.filter(t => (t.pnl_total_usd || t.pnl_usd || 0) < 0);
  const breakevens = closedTrades.filter(t => (t.pnl_total_usd || t.pnl_usd || 0) === 0);
  const winrate = closedTrades.length > 0 ? (wins.length / closedTrades.length * 100) : 0;

  const grossProfit = wins.reduce((s, t) => s + (t.pnl_total_usd || t.pnl_usd || 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.pnl_total_usd || t.pnl_usd || 0), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;

  const avgR = closedTrades.length > 0 
    ? closedTrades.reduce((s, t) => s + (t.r_multiple || 0), 0) / closedTrades.length 
    : 0;

  // Max Drawdown calculation
  let maxDD = 0;
  let maxDDPct = 0;
  let peak = 100000;
  let balance = 100000;

  const sortedClosed = [...closedTrades].sort((a, b) => 
    new Date(a.date_close || a.date_open) - new Date(b.date_close || b.date_open)
  );

  sortedClosed.forEach(t => {
    balance += (t.pnl_total_usd || t.pnl_usd || 0);
    if (balance > peak) peak = balance;
    const dd = peak - balance;
    if (dd > maxDD) {
      maxDD = dd;
      maxDDPct = (dd / peak) * 100;
    }
  });

  // Equity curve data
  const equityData = [];
  let equity = 100000;
  
  for (let i = 29; i >= 0; i--) {
    const date = subDays(new Date(), i);
    const dateKey = format(date, 'yyyy-MM-dd');
    
    const dayTrades = sortedClosed.filter(t => {
      const tradeDate = format(new Date(t.date_close || t.date_open), 'yyyy-MM-dd');
      return tradeDate === dateKey;
    });
    
    dayTrades.forEach(t => {
      equity += (t.pnl_total_usd || t.pnl_usd || 0);
    });
    
    equityData.push({
      date: dateKey,
      day: format(date, 'dd'),
      equity: Math.round(equity),
      pnl: Math.round(equity - 100000)
    });
  }

  // Best/Worst trades
  const bestTrade = wins.length > 0 
    ? wins.reduce((max, t) => {
        const tPnl = t.pnl_total_usd || t.pnl_usd || 0;
        const maxPnl = max.pnl_total_usd || max.pnl_usd || 0;
        return tPnl > maxPnl ? t : max;
      })
    : null;

  const worstTrade = losses.length > 0
    ? losses.reduce((min, t) => {
        const tPnl = t.pnl_total_usd || t.pnl_usd || 0;
        const minPnl = min.pnl_total_usd || min.pnl_usd || 0;
        return tPnl < minPnl ? t : min;
      })
    : null;

  // Generate AI Insights
  const generateInsights = async () => {
    setGeneratingInsights(true);
    try {
      const prompt = `Analyze trading performance:
- Total PNL: $${totalPnlUsd.toFixed(2)} (${totalPnlPct.toFixed(1)}%)
- Winrate: ${winrate.toFixed(1)}%
- Profit Factor: ${profitFactor.toFixed(2)}
- Avg R: ${avgR.toFixed(2)}
- Max Drawdown: $${maxDD.toFixed(2)} (${maxDDPct.toFixed(1)}%)
- Trades: ${closedTrades.length} (${wins.length}W / ${losses.length}L)

Provide brief insights in JSON:
{
  "summary": "One sentence performance summary",
  "top_leaks": ["leak1", "leak2", "leak3"],
  "next_action": "What to focus on next"
}`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            top_leaks: { type: 'array', items: { type: 'string' } },
            next_action: { type: 'string' }
          }
        }
      });

      setAiInsights(result);
    } catch (error) {
      console.error('Failed to generate insights:', error);
    } finally {
      setGeneratingInsights(false);
    }
  };

  return (
    <div className="space-y-4 mt-4">
      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatsCard 
          title="Net PNL"
          value={totalPnlUsd >= 0 ? `+$${formatNumber(totalPnlUsd)}` : `-$${formatNumber(Math.abs(totalPnlUsd))}`}
          subtitle={`${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct.toFixed(2)}%`}
          icon={DollarSign}
          valueColor={totalPnlUsd >= 0 ? 'text-emerald-400' : 'text-red-400'}
        />
        <StatsCard 
          title="Winrate"
          value={closedTrades.length > 0 ? `${winrate.toFixed(1)}%` : '—'}
          subtitle={`${wins.length}W / ${losses.length}L`}
          icon={Percent}
          valueColor={winrate >= 50 ? 'text-emerald-400' : 'text-red-400'}
        />
        <StatsCard 
          title="Avg R"
          value={avgR !== 0 ? `${avgR.toFixed(2)}R` : '—'}
          icon={Target}
          valueColor={avgR >= 2 ? 'text-emerald-400' : avgR >= 1 ? 'text-yellow-400' : 'text-red-400'}
        />
        <StatsCard 
          title="Profit Factor"
          value={profitFactor > 0 ? profitFactor.toFixed(2) : '—'}
          icon={TrendingUp}
          valueColor={profitFactor >= 2 ? 'text-emerald-400' : profitFactor >= 1 ? 'text-yellow-400' : 'text-red-400'}
        />
        <StatsCard 
          title="Max DD"
          value={maxDD > 0 ? `-$${formatNumber(maxDD)}` : '—'}
          subtitle={maxDDPct > 0 ? `-${maxDDPct.toFixed(1)}%` : '—'}
          icon={TrendingDown}
          valueColor="text-red-400"
        />
        <StatsCard 
          title="Trades"
          value={closedTrades.length}
          subtitle={breakevens.length > 0 ? `${breakevens.length} BE` : ''}
          icon={BarChart3}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Equity Curve */}
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
          <h3 className="text-[#c0c0c0] text-sm font-medium mb-4">Equity Curve (30d)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityData}>
                <defs>
                  <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="day" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fill: '#666', fontSize: 10 }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fill: '#666', fontSize: 10 }}
                  tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload?.[0]) {
                      const value = payload[0].value;
                      const pnl = value - 100000;
                      return (
                        <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3">
                          <p className="text-[#888] text-xs mb-1">{format(new Date(payload[0].payload.date), 'MMM dd')}</p>
                          <p className="text-[#c0c0c0] text-sm font-bold">${formatNumber(value)}</p>
                          <p className={`text-xs ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {pnl >= 0 ? '+' : ''}${formatNumber(pnl)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="equity" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  fill="url(#equityGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Calendar Heatmap */}
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
          <h3 className="text-[#c0c0c0] text-sm font-medium mb-4">Daily PNL Heatmap</h3>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 28 }, (_, i) => {
              const date = subDays(new Date(), 27 - i);
              const dateKey = format(date, 'yyyy-MM-dd');
              
              const dayTrades = closedTrades.filter(t => {
                const tradeDate = format(new Date(t.date_close || t.date_open), 'yyyy-MM-dd');
                return tradeDate === dateKey;
              });
              
              const dayPnl = dayTrades.reduce((s, t) => s + (t.pnl_total_usd || t.pnl_usd || 0), 0);
              const dayPnlPct = (dayPnl / 100000) * 100;
              
              let bgColor = 'bg-[#1a1a1a]';
              if (dayPnl > 0) bgColor = dayPnl > 500 ? 'bg-emerald-500/40' : 'bg-emerald-500/20';
              else if (dayPnl < 0) bgColor = dayPnl < -500 ? 'bg-red-500/40' : 'bg-red-500/20';
              
              return (
                <div 
                  key={i}
                  className={cn(
                    "aspect-square rounded flex items-center justify-center cursor-pointer hover:ring-1 hover:ring-[#c0c0c0]/50 transition-all group relative",
                    bgColor
                  )}
                  title={`${format(date, 'MMM dd')}: ${dayPnl >= 0 ? '+' : ''}$${formatNumber(dayPnl)} (${dayPnlPct >= 0 ? '+' : ''}${dayPnlPct.toFixed(1)}%)`}
                >
                  <span className="text-[8px] text-[#888] group-hover:text-[#c0c0c0]">
                    {format(date, 'd')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Best/Worst Trades */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-emerald-500/10 to-[#0d0d0d] rounded-xl p-5 border border-emerald-500/30">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h3 className="text-emerald-400 text-sm font-medium">Best Trade</h3>
          </div>
          {bestTrade ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-[#666]">Coin</span>
                <span className="text-sm text-[#c0c0c0] font-medium">{bestTrade.coin?.replace('USDT', '')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-[#666]">PNL</span>
                <span className="text-lg font-bold text-emerald-400">
                  +${formatNumber(bestTrade.pnl_total_usd || bestTrade.pnl_usd || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-[#666]">R-Multiple</span>
                <span className="text-sm text-emerald-400">+{(bestTrade.r_multiple || 0).toFixed(2)}R</span>
              </div>
            </div>
          ) : (
            <p className="text-[#666] text-sm">No winning trades</p>
          )}
        </div>

        <div className="bg-gradient-to-br from-red-500/10 to-[#0d0d0d] rounded-xl p-5 border border-red-500/30">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="w-5 h-5 text-red-400" />
            <h3 className="text-red-400 text-sm font-medium">Worst Trade</h3>
          </div>
          {worstTrade ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-[#666]">Coin</span>
                <span className="text-sm text-[#c0c0c0] font-medium">{worstTrade.coin?.replace('USDT', '')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-[#666]">PNL</span>
                <span className="text-lg font-bold text-red-400">
                  -${formatNumber(Math.abs(worstTrade.pnl_total_usd || worstTrade.pnl_usd || 0))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-[#666]">R-Multiple</span>
                <span className="text-sm text-red-400">{(worstTrade.r_multiple || 0).toFixed(2)}R</span>
              </div>
            </div>
          ) : (
            <p className="text-[#666] text-sm">No losing trades</p>
          )}
        </div>
      </div>

      {/* AI Insights */}
      <div className="bg-gradient-to-br from-yellow-500/10 to-[#0d0d0d] rounded-xl p-5 border border-yellow-500/30">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            <h3 className="text-yellow-400 text-sm font-medium">AI Insights</h3>
          </div>
          {!aiInsights && (
            <Button
              size="sm"
              onClick={generateInsights}
              disabled={generatingInsights || closedTrades.length === 0}
              className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 text-xs h-7"
            >
              {generatingInsights ? 'Analyzing...' : 'Generate'}
            </Button>
          )}
        </div>

        {aiInsights ? (
          <div className="space-y-3">
            <div className="bg-[#151515] rounded-lg p-3">
              <p className="text-sm text-[#c0c0c0]">{aiInsights.summary}</p>
            </div>
            
            <div>
              <p className="text-xs text-[#888] mb-2 uppercase tracking-wide">Top 3 Leaks</p>
              <div className="space-y-1">
                {aiInsights.top_leaks?.map((leak, i) => (
                  <div key={i} className="flex items-start gap-2 bg-[#151515] rounded p-2">
                    <AlertTriangle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                    <span className="text-xs text-[#c0c0c0]">{leak}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
              <p className="text-xs text-emerald-400 font-semibold mb-1">Next Action</p>
              <p className="text-sm text-[#c0c0c0]">{aiInsights.next_action}</p>
            </div>
          </div>
        ) : (
          <p className="text-[#666] text-sm">Click Generate to get AI-powered insights</p>
        )}
      </div>
    </div>
  );
}