import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Play, Loader2 } from "lucide-react";

export default function SimulatorSetup({ onRun, isRunning }) {
  const [params, setParams] = useState({
    name: '',
    strategy_name: '',
    initial_capital: 10000,
    risk_per_trade: 1,
    winrate: 55,
    avg_rr: 2.5,
    trades_per_day: 3,
    simulation_days: 90
  });

  const handleRun = () => {
    onRun(params);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column - Basic Settings */}
      <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-2xl border-2 border-[#2a2a2a] p-6">
        <h3 className="text-lg font-bold text-[#c0c0c0] mb-6">Basic Settings</h3>
        <div className="space-y-4">
          <div>
            <Label className="text-[#888] text-xs uppercase tracking-wider mb-2">Simulation Name</Label>
            <Input
              value={params.name}
              onChange={(e) => setParams({ ...params, name: e.target.value })}
              placeholder="My Strategy Test"
              className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
            />
          </div>
          <div>
            <Label className="text-[#888] text-xs uppercase tracking-wider mb-2">Strategy Name</Label>
            <Input
              value={params.strategy_name}
              onChange={(e) => setParams({ ...params, strategy_name: e.target.value })}
              placeholder="Breakout Strategy"
              className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
            />
          </div>
          <div>
            <Label className="text-[#888] text-xs uppercase tracking-wider mb-2">Initial Capital ($)</Label>
            <Input
              type="number"
              value={params.initial_capital}
              onChange={(e) => setParams({ ...params, initial_capital: Number(e.target.value) })}
              className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
            />
          </div>
          <div>
            <Label className="text-[#888] text-xs uppercase tracking-wider mb-2">Simulation Period (days)</Label>
            <Input
              type="number"
              value={params.simulation_days}
              onChange={(e) => setParams({ ...params, simulation_days: Number(e.target.value) })}
              className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
            />
          </div>
        </div>
      </div>

      {/* Right Column - Strategy Parameters */}
      <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-2xl border-2 border-[#2a2a2a] p-6">
        <h3 className="text-lg font-bold text-[#c0c0c0] mb-6">Strategy Parameters</h3>
        <div className="space-y-4">
          <div>
            <Label className="text-[#888] text-xs uppercase tracking-wider mb-2">Risk Per Trade (%)</Label>
            <Input
              type="number"
              step="0.1"
              value={params.risk_per_trade}
              onChange={(e) => setParams({ ...params, risk_per_trade: Number(e.target.value) })}
              className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
            />
          </div>
          <div>
            <Label className="text-[#888] text-xs uppercase tracking-wider mb-2">Win Rate (%)</Label>
            <Input
              type="number"
              value={params.winrate}
              onChange={(e) => setParams({ ...params, winrate: Number(e.target.value) })}
              className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
            />
          </div>
          <div>
            <Label className="text-[#888] text-xs uppercase tracking-wider mb-2">Average R:R Ratio</Label>
            <Input
              type="number"
              step="0.1"
              value={params.avg_rr}
              onChange={(e) => setParams({ ...params, avg_rr: Number(e.target.value) })}
              className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
            />
          </div>
          <div>
            <Label className="text-[#888] text-xs uppercase tracking-wider mb-2">Trades Per Day</Label>
            <Input
              type="number"
              value={params.trades_per_day}
              onChange={(e) => setParams({ ...params, trades_per_day: Number(e.target.value) })}
              className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
            />
          </div>
        </div>
      </div>

      {/* Run Button */}
      <div className="lg:col-span-2">
        <Button
          onClick={handleRun}
          disabled={isRunning}
          className="w-full bg-gradient-to-r from-violet-500 to-violet-600 text-white hover:from-violet-600 hover:to-violet-700 py-6 text-lg"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Running Simulation...
            </>
          ) : (
            <>
              <Play className="w-5 h-5 mr-2" />
              Run Simulation
            </>
          )}
        </Button>
      </div>
    </div>
  );
}