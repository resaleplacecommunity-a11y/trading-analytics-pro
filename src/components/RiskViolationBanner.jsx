import { AlertTriangle, XCircle, TrendingDown, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from "@/lib/utils";

export default function RiskViolationBanner({ violations }) {
  if (!violations || violations.length === 0) return null;

  const getIcon = (rule) => {
    if (rule.includes('Loss')) return TrendingDown;
    if (rule.includes('R')) return Activity;
    return XCircle;
  };

  const mainViolation = violations[0];
  const Icon = getIcon(mainViolation.rule);

  return (
    <div className="mb-6 bg-gradient-to-r from-red-500/20 via-red-500/10 to-transparent border-2 border-red-500/50 rounded-xl p-6 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-red-500/30 border border-red-500/50">
          <Icon className="w-7 h-7 text-red-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-red-400 font-bold text-xl mb-2">
            Trading Limit Exceeded
          </h3>
          <p className="text-[#c0c0c0] text-base mb-3">
            <span className="font-bold">{mainViolation.rule}</span> limit has been breached: 
            <span className="text-red-400 font-bold mx-2">{mainViolation.value}</span>
            (limit: {mainViolation.limit})
          </p>
          <p className="text-[#888] text-sm mb-4">
            Stop trading for today and analyze your mistakes to prevent them in the future. 
            Review your trades, identify patterns, and adjust your strategy before continuing.
          </p>
          <div className="flex gap-3">
            <Link 
              to={createPageUrl('RiskManager')}
              className="px-4 py-2 bg-red-500/20 border border-red-500/40 rounded-lg text-red-400 font-medium hover:bg-red-500/30 transition-all text-sm"
            >
              View Risk Settings
            </Link>
            {violations.length > 1 && (
              <div className="px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#888] text-sm">
                +{violations.length - 1} more violation{violations.length > 2 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}