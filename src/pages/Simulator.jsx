import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Sparkles, Play, History, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import SimulatorSetup from "../components/simulator/SimulatorSetup";
import SimulatorChart from "../components/simulator/SimulatorChart";
import SimulatorStats from "../components/simulator/SimulatorStats";
import SimulationHistory from "../components/simulator/SimulationHistory";

export default function SimulatorPage() {
  const [activeTab, setActiveTab] = useState('setup'); // setup, results, history
  const [currentSimulation, setCurrentSimulation] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  const queryClient = useQueryClient();

  const { data: simulations = [] } = useQuery({
    queryKey: ['simulations'],
    queryFn: () => base44.entities.Simulation.list('-simulation_date', 50),
  });

  const createSimulationMutation = useMutation({
    mutationFn: (data) => base44.entities.Simulation.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['simulations'] });
      toast.success('Simulation saved');
    },
  });

  const runSimulation = (params) => {
    setIsRunning(true);
    
    // Simulate delay for realism
    setTimeout(() => {
      const {
        name,
        strategy_name,
        initial_capital,
        risk_per_trade,
        winrate,
        avg_rr,
        trades_per_day,
        simulation_days
      } = params;

      let capital = initial_capital;
      let peak = initial_capital;
      let maxDrawdown = 0;
      const tradesData = [];
      const equityCurve = [{ day: 0, equity: initial_capital }];
      const returns = [];

      const totalTrades = Math.floor(trades_per_day * simulation_days);

      for (let i = 0; i < totalTrades; i++) {
        const day = Math.floor(i / trades_per_day);
        const isWin = Math.random() * 100 < winrate;
        const riskAmount = capital * (risk_per_trade / 100);
        
        let pnl;
        if (isWin) {
          pnl = riskAmount * avg_rr;
        } else {
          pnl = -riskAmount;
        }

        capital += pnl;
        
        if (capital > peak) peak = capital;
        const drawdown = ((peak - capital) / peak) * 100;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;

        const returnPercent = (pnl / (capital - pnl)) * 100;
        returns.push(returnPercent);

        tradesData.push({
          trade_num: i + 1,
          day: day,
          win: isWin,
          pnl: pnl,
          capital: capital,
          drawdown: drawdown
        });

        if (i % trades_per_day === trades_per_day - 1) {
          equityCurve.push({ day: day + 1, equity: capital });
        }
      }

      // Calculate Sharpe Ratio
      const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
      const stdDev = Math.sqrt(variance);
      const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

      const totalPnl = capital - initial_capital;
      const totalPnlPercent = ((capital - initial_capital) / initial_capital) * 100;

      const simulationResult = {
        name: name || `Simulation ${new Date().toLocaleString()}`,
        strategy_name: strategy_name || 'Default Strategy',
        initial_capital,
        risk_per_trade,
        winrate,
        avg_rr,
        trades_per_day,
        simulation_days,
        final_capital: capital,
        total_trades: totalTrades,
        total_pnl: totalPnl,
        total_pnl_percent: totalPnlPercent,
        max_drawdown: maxDrawdown,
        sharpe_ratio: sharpeRatio,
        trades_data: JSON.stringify(tradesData),
        equity_curve: JSON.stringify(equityCurve),
        simulation_date: new Date().toISOString()
      };

      setCurrentSimulation(simulationResult);
      setActiveTab('results');
      setIsRunning(false);
      
      // Auto-save simulation
      createSimulationMutation.mutate(simulationResult);
    }, 1500);
  };

  const loadSimulation = (sim) => {
    setCurrentSimulation({
      ...sim,
      trades_data: JSON.parse(sim.trades_data),
      equity_curve: JSON.parse(sim.equity_curve)
    });
    setActiveTab('results');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#c0c0c0] mb-2">Trading Simulator</h1>
          <p className="text-[#888]">Test your strategies on historical data without risk</p>
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-violet-400" />
          <span className="text-[#666] text-sm">{simulations.length} simulations run</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#2a2a2a] pb-2">
        <button
          onClick={() => setActiveTab('setup')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            activeTab === 'setup'
              ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
              : 'text-[#666] hover:text-[#888]'
          }`}
        >
          <Play className="w-4 h-4" />
          Setup
        </button>
        <button
          onClick={() => setActiveTab('results')}
          disabled={!currentSimulation}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            activeTab === 'results'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'text-[#666] hover:text-[#888] disabled:opacity-50'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Results
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            activeTab === 'history'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'text-[#666] hover:text-[#888]'
          }`}
        >
          <History className="w-4 h-4" />
          History ({simulations.length})
        </button>
      </div>

      {/* Content */}
      {activeTab === 'setup' && (
        <SimulatorSetup onRun={runSimulation} isRunning={isRunning} />
      )}

      {activeTab === 'results' && currentSimulation && (
        <div className="space-y-6">
          <SimulatorStats simulation={currentSimulation} />
          <SimulatorChart simulation={currentSimulation} />
        </div>
      )}

      {activeTab === 'history' && (
        <SimulationHistory 
          simulations={simulations} 
          onLoad={loadSimulation}
        />
      )}
    </div>
  );
}