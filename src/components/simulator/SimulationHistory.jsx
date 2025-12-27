import { Eye, Calendar, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function SimulationHistory({ simulations, onLoad }) {
  if (simulations.length === 0) {
    return (
      <div className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-2xl border-2 border-[#2a2a2a] p-12 text-center">
        <p className="text-[#666]">No simulations yet. Run your first simulation to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {simulations.map((sim) => {
        const isProfitable = sim.total_pnl > 0;
        
        return (
          <div
            key={sim.id}
            className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 backdrop-blur-sm rounded-xl border-2 border-[#2a2a2a] p-6 hover:border-[#3a3a3a] transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-[#c0c0c0] mb-1">{sim.name}</h3>
                <p className="text-[#666] text-sm">{sim.strategy_name}</p>
              </div>
              <div className="flex items-center gap-2 text-[#666] text-sm">
                <Calendar className="w-4 h-4" />
                {format(new Date(sim.simulation_date), 'MMM dd, yyyy')}
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
              <div>
                <div className="text-[#888] text-xs uppercase tracking-wider mb-1">P&L</div>
                <div className={cn(
                  "text-lg font-bold",
                  isProfitable ? "text-emerald-400" : "text-red-400"
                )}>
                  {isProfitable ? '+' : ''}{sim.total_pnl_percent.toFixed(2)}%
                </div>
              </div>
              <div>
                <div className="text-[#888] text-xs uppercase tracking-wider mb-1">Final Capital</div>
                <div className="text-[#c0c0c0] text-lg font-bold">
                  ${sim.final_capital.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[#888] text-xs uppercase tracking-wider mb-1">Trades</div>
                <div className="text-[#c0c0c0] text-lg font-bold">{sim.total_trades}</div>
              </div>
              <div>
                <div className="text-[#888] text-xs uppercase tracking-wider mb-1">Max DD</div>
                <div className="text-[#c0c0c0] text-lg font-bold">{sim.max_drawdown.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-[#888] text-xs uppercase tracking-wider mb-1">Sharpe</div>
                <div className="text-[#c0c0c0] text-lg font-bold">{sim.sharpe_ratio.toFixed(2)}</div>
              </div>
            </div>

            <Button
              onClick={() => onLoad(sim)}
              variant="outline"
              className="w-full bg-[#111] border-[#2a2a2a] text-[#888] hover:text-[#c0c0c0] hover:border-[#3a3a3a]"
            >
              <Eye className="w-4 h-4 mr-2" />
              View Detailed Results
            </Button>
          </div>
        );
      })}
    </div>
  );
}