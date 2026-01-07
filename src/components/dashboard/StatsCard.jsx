import { cn } from "@/lib/utils";
import { DollarSign, Percent, Target, BarChart3 } from 'lucide-react';

const iconMap = {
  DollarSign,
  Percent,
  Target,
  BarChart3
};

const formatValue = (value) => {
  if (typeof value !== 'string') return value;
  
  // Check if it's a dollar amount with no spaces
  const match = value.match(/^([+\-]?)(\$?)(\d+)$/);
  if (match) {
    const [, sign, dollar, num] = match;
    const formatted = parseInt(num).toLocaleString('ru-RU').replace(/,/g, ' ');
    return `${sign}${dollar}${formatted}`;
  }
  
  return value;
};

export default function StatsCard({ title, value, subtitle, icon: Icon, iconName, trend, trendUp, className, valueColor, subtitleColor }) {
  const IconComponent = iconName ? iconMap[iconName] : Icon;
  const displayValue = formatValue(value);
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
            valueColor ? valueColor :
            className?.includes('border-red') ? "text-red-400" :
            typeof value === 'string' && value.includes('-') ? "text-red-400" : 
            typeof value === 'string' && value.includes('+') ? "text-emerald-400" : "text-[#c0c0c0]"
          )}>
            {displayValue}
          </p>
          {subtitle && (
            <p className="text-xs mt-1">
              {subtitle.startsWith('Today: ') ? (
                <span className="text-[#666]">Today: <span className={subtitleColor || "text-[#666]"}>{subtitle.substring(7)}</span></span>
              ) : (
                <span className={subtitleColor || "text-[#666]"}>{subtitle}</span>
              )}
            </p>
          )}
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
        {IconComponent && (
          <div className="p-3 rounded-lg bg-[#252525] flex items-center justify-center shrink-0 self-center">
            <IconComponent className={cn(
              "w-5 h-5",
              className?.includes('border-red') && title?.toLowerCase().includes('balance') ? "text-red-400" : "text-[#c0c0c0]"
            )} />
          </div>
        )}
      </div>
    </div>
  );
}