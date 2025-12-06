import { cn } from "@/lib/utils";

export default function StatsCard({ title, value, subtitle, icon: Icon, trend, trendUp, className }) {
  return (
    <div className={cn(
      "bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a] hover:border-[#3a3a3a] transition-all duration-300",
      className
    )}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[#888] text-xs uppercase tracking-wider mb-1">{title}</p>
          <p className={cn(
            "text-2xl font-bold truncate",
            typeof value === 'string' && value.includes('-') ? "text-red-400" : 
            typeof value === 'string' && value.includes('+') ? "text-emerald-400" : "text-[#c0c0c0]"
          )}>
            {value}
          </p>
          {subtitle && <p className="text-[#666] text-xs mt-1">{subtitle}</p>}
          {trend && (
            <div className={cn(
              "flex items-center gap-1 mt-2 text-xs",
              trendUp ? "text-emerald-400" : "text-red-400"
            )}>
              <span>{trendUp ? "↑" : "↓"}</span>
              <span>{trend}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className="p-3 rounded-lg bg-[#252525] flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-[#c0c0c0]" />
          </div>
        )}
      </div>
    </div>
  );
}