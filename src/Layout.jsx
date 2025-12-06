import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { 
  LayoutDashboard, 
  LineChart, 
  Calendar, 
  CalendarDays,
  Shield, 
  Brain,
  Settings,
  TrendingUp,
  Menu,
  X
} from 'lucide-react';
import { useState } from 'react';
import { cn } from "@/lib/utils";

export default function Layout({ children, currentPageName }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { name: 'Dashboard', page: 'Dashboard', icon: LayoutDashboard },
    { name: 'Trades', page: 'Trades', icon: TrendingUp },
    { name: 'Daily', page: 'DailyAnalytics', icon: Calendar },
    { name: 'Weekly', page: 'WeeklyAnalytics', icon: CalendarDays },
    { name: 'Risk', page: 'RiskManager', icon: Shield },
    { name: 'Behavior', page: 'BehaviorAnalysis', icon: Brain },
    { name: 'Settings', page: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-[#111] border-b border-[#222] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LineChart className="w-6 h-6 text-[#c0c0c0]" />
            <span className="text-[#c0c0c0] font-bold">Trading Pro</span>
          </div>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-6 h-6 text-[#c0c0c0]" /> : <Menu className="w-6 h-6 text-[#c0c0c0]" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-[#111] pt-16">
          <nav className="p-4 space-y-2">
            {navItems.map(item => (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                  currentPageName === item.page 
                    ? "bg-[#1a1a1a] text-[#c0c0c0]" 
                    : "text-[#666] hover:bg-[#1a1a1a] hover:text-[#888]"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            ))}
          </nav>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 bg-[#111] border-r border-[#1a1a1a] flex-col">
        <div className="p-6 border-b border-[#1a1a1a]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#c0c0c0] to-[#888] flex items-center justify-center">
              <LineChart className="w-5 h-5 text-[#111]" />
            </div>
            <div>
              <h1 className="text-[#c0c0c0] font-bold">Trading Pro</h1>
              <p className="text-[#666] text-xs">Analytics System</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => (
            <Link
              key={item.page}
              to={createPageUrl(item.page)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                currentPageName === item.page 
                  ? "bg-[#1a1a1a] text-[#c0c0c0] shadow-lg" 
                  : "text-[#666] hover:bg-[#151515] hover:text-[#888]"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-[#1a1a1a]">
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] rounded-xl p-4">
            <p className="text-[#888] text-xs">Trading Analytics PRO</p>
            <p className="text-[#c0c0c0] text-sm font-medium mt-1">Dark Silver Edition</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen pt-16 lg:pt-0">
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}