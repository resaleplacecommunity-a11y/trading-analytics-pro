import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { startOfWeek, endOfWeek, addWeeks, subWeeks, format as formatDate } from 'date-fns';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { 
  Calendar, CheckCircle, AlertTriangle, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, Minus, Plus, Trash2, Upload, ExternalLink,
  ChevronDown, ChevronUp, Target, Shield
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import BTCAnalysisSection from '../components/marketoutlook/BTCAnalysisSection';
import TrendSection from '../components/marketoutlook/TrendSection';
import TradingPlanSection from '../components/marketoutlook/TradingPlanSection';
import ScenariosSection from '../components/marketoutlook/ScenariosSection';
import NewsSection from '../components/marketoutlook/NewsSection';
import ExpectationsSection from '../components/marketoutlook/ExpectationsSection';
import KeyLevelsSection from '../components/marketoutlook/KeyLevelsSection';
import AttachmentsSection from '../components/marketoutlook/AttachmentsSection';
import WatchlistSection from '../components/marketoutlook/WatchlistSection';
import WeeklyHeader from '../components/marketoutlook/WeeklyHeader';

export default function MarketOutlook() {
  const queryClient = useQueryClient();
  const [selectedWeekStart, setSelectedWeekStart] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const userTimezone = user?.preferred_timezone || 'UTC';

  // Initialize to current week
  useEffect(() => {
    if (!selectedWeekStart && userTimezone) {
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      setSelectedWeekStart(formatInTimeZone(weekStart, userTimezone, 'yyyy-MM-dd'));
    }
  }, [userTimezone, selectedWeekStart]);

  const { data: weeklyOutlooks = [], isLoading } = useQuery({
    queryKey: ['weeklyOutlooks', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.WeeklyOutlook.filter({ created_by: user.email }, '-week_start', 50);
    },
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000,
  });

  const currentWeek = weeklyOutlooks.find(w => w.week_start === selectedWeekStart);

  const saveWeekMutation = useMutation({
    mutationFn: async (data) => {
      if (currentWeek?.id) {
        return base44.entities.WeeklyOutlook.update(currentWeek.id, data);
      } else {
        const weekEnd = formatInTimeZone(endOfWeek(new Date(selectedWeekStart), { weekStartsOn: 1 }), userTimezone, 'yyyy-MM-dd');
        return base44.entities.WeeklyOutlook.create({
          week_start: selectedWeekStart,
          week_end: weekEnd,
          timezone: userTimezone,
          ...data
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['weeklyOutlooks']);
      toast.success('Weekly outlook saved');
    },
  });

  const markCompletedMutation = useMutation({
    mutationFn: async () => {
      if (!currentWeek?.id) {
        toast.error('Please save the week first');
        return;
      }
      return base44.entities.WeeklyOutlook.update(currentWeek.id, {
        status: 'completed',
        completed_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['weeklyOutlooks']);
      toast.success('Week marked as completed!');
    },
  });

  if (isLoading || !selectedWeekStart) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-[#666]">Loading...</div>
      </div>
    );
  }

  // Check if reminder should show
  const now = new Date();
  const dayOfWeek = formatInTimeZone(now, userTimezone, 'i');
  const isMonday = dayOfWeek === '1';
  const currentWeekStart = formatInTimeZone(startOfWeek(now, { weekStartsOn: 1 }), userTimezone, 'yyyy-MM-dd');
  const showReminder = isMonday && selectedWeekStart === currentWeekStart && currentWeek?.status !== 'completed';

  const navigateWeek = (direction) => {
    const currentDate = new Date(selectedWeekStart);
    const newDate = direction === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1);
    setSelectedWeekStart(formatInTimeZone(newDate, userTimezone, 'yyyy-MM-dd'));
  };

  const weekLabel = `Week of ${formatDate(new Date(selectedWeekStart), 'dd MMM yyyy')}`;
  const isCurrentWeek = selectedWeekStart === currentWeekStart;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#c0c0c0]">Market Outlook</h1>
          <p className="text-[#666] text-sm">Weekly trading plan & analysis</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => navigateWeek('prev')}
            variant="outline"
            size="icon"
            className="bg-[#111] border-[#2a2a2a] text-[#888] hover:text-[#c0c0c0]"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#c0c0c0] flex items-center gap-2">
            <Calendar className="w-4 h-4 text-violet-400" />
            <span className="font-medium">{weekLabel}</span>
            {isCurrentWeek && (
              <span className="px-2 py-0.5 text-xs bg-violet-500/20 text-violet-400 rounded-full">Current</span>
            )}
            {currentWeek?.status === 'completed' && (
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            )}
          </div>
          <Button
            onClick={() => navigateWeek('next')}
            variant="outline"
            size="icon"
            className="bg-[#111] border-[#2a2a2a] text-[#888] hover:text-[#c0c0c0]"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Weekly Header */}
      <WeeklyHeader 
        currentWeek={currentWeek}
        weeklyOutlooks={weeklyOutlooks}
        weekLabel={weekLabel}
        isCurrentWeek={isCurrentWeek}
        onUpdateWeek={(updates) => saveWeekMutation.mutate(updates)}
      />

      {/* Reminder Banner */}
      {showReminder && (
        <div className="bg-gradient-to-r from-red-500/20 via-red-500/10 to-transparent border-2 border-red-500/50 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-red-400 font-bold text-lg mb-1">Weekly Plan Not Filled</h3>
              <p className="text-[#888] text-sm">
                It's Monday! Take time to fill your weekly market outlook and trading plan before the week starts.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Market Outlook Content */}
      <BTCAnalysisSection
        data={currentWeek}
        onChange={(updates) => saveWeekMutation.mutate(updates)}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrendSection
          data={currentWeek}
          onChange={(updates) => saveWeekMutation.mutate(updates)}
        />
        <NewsSection
          data={currentWeek}
          onChange={(updates) => saveWeekMutation.mutate(updates)}
        />
      </div>

      <ExpectationsSection
        data={currentWeek}
        onChange={(updates) => saveWeekMutation.mutate(updates)}
      />

      <KeyLevelsSection
        data={currentWeek}
        onChange={(updates) => saveWeekMutation.mutate(updates)}
      />

      <TradingPlanSection
        data={currentWeek}
        onChange={(updates) => saveWeekMutation.mutate(updates)}
      />

      <ScenariosSection
        data={currentWeek}
        onChange={(updates) => saveWeekMutation.mutate(updates)}
      />

      <WatchlistSection
        data={currentWeek}
        onChange={(updates) => saveWeekMutation.mutate(updates)}
      />

      <AttachmentsSection
        data={currentWeek}
        onChange={(updates) => saveWeekMutation.mutate(updates)}
      />

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <Button
          onClick={() => saveWeekMutation.mutate({})}
          disabled={saveWeekMutation.isLoading}
          className="bg-[#c0c0c0] text-black hover:bg-[#a0a0a0]"
        >
          {saveWeekMutation.isLoading ? 'Saving...' : 'Save Changes'}
        </Button>
        {currentWeek?.status !== 'completed' && (
          <Button
            onClick={() => markCompletedMutation.mutate()}
            disabled={markCompletedMutation.isLoading}
            className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            {markCompletedMutation.isLoading ? 'Marking...' : 'Mark Week as Completed'}
          </Button>
        )}
      </div>
    </div>
  );
}