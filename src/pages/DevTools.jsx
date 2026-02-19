import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from 'sonner';
import { Zap, Trash2, AlertTriangle, Database, Target, TestTube, Download } from 'lucide-react';
import ExportSection from '../components/devtools/ExportSection';

const ALLOWED_EMAILS = [
  'resaleplacecommunity@gmail.com',
  'roman.dev.ff@gmail.com',
];

export default function DevTools() {
  const queryClient = useQueryClient();
  const [count, setCount] = useState(20);
  const [mode, setMode] = useState('SMOKE');
  const [seed, setSeed] = useState('');
  const [lastRunId, setLastRunId] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // Access control
  if (!user || !ALLOWED_EMAILS.includes(user.email)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-[#c0c0c0] mb-2">Access Denied</h2>
          <p className="text-[#888]">You don't have permission to access DevTools</p>
        </div>
      </div>
    );
  }

  const generateMutation = useMutation({
    mutationFn: async () => {
      const params = {
        count: parseInt(count) || 20,
        mode,
        seed: seed ? parseInt(seed) : undefined,
        includeOpen: true
      };
      
      console.log('[DevTools] Starting generation:', params);
      const response = await base44.functions.invoke('generateTestTrades', params);
      console.log('[DevTools] Generation response:', response.data);
      
      return response.data;
    },
    onSuccess: (data) => {
      console.log('[DevTools] Generation succeeded:', data);
      setLastRunId(data.test_run_id);
      
      // Force aggressive cache clear and refetch
      setTimeout(() => {
        queryClient.resetQueries({ queryKey: ['trades'] });
        queryClient.resetQueries({ queryKey: ['tradeCounts'] });
        queryClient.invalidateQueries();
      }, 100);
      
      const mismatch = data.inserted_count !== data.requested_count;
      
      toast.success(`✅ Generated ${data.inserted_count} test trades`, {
        description: `Open: ${data.open_count}, Closed: ${data.closed_count}\nDuration: ${(data.duration_ms / 1000).toFixed(1)}s${mismatch ? '\n⚠️ Count mismatch!' : ''}`,
        duration: 5000
      });
    },
    onError: (error) => {
      console.error('[DevTools] Generation failed:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
      const debugInfo = error.response?.data?.debug ? JSON.stringify(error.response.data.debug) : '';
      
      toast.error('❌ Failed to generate trades', {
        description: `${errorMsg}\n${debugInfo}`,
        duration: 10000,
        action: {
          label: 'Copy Error',
          onClick: () => {
            navigator.clipboard.writeText(`Error: ${errorMsg}\nDebug: ${debugInfo}\nStack: ${error.stack}`);
            toast.info('Error copied to clipboard');
          }
        }
      });
    }
  });

  const wipeMutation = useMutation({
    mutationFn: async (testRunId) => {
      const response = await base44.functions.invoke('wipeTestTrades', { 
        test_run_id: testRunId 
      });
      return response.data;
    },
    onSuccess: (data) => {
      const { deleted_count, remaining_count } = data;
      
      queryClient.resetQueries({ queryKey: ['trades'] });
      queryClient.resetQueries({ queryKey: ['tradeCounts'] });
      
      if (remaining_count > 0) {
        toast.error(`⚠️ Wipe incomplete: ${deleted_count} deleted, ${remaining_count} remaining`);
      } else {
        toast.success(`✅ Wiped ${deleted_count} test trades`);
      }
      
      if (data.test_run_id === lastRunId) {
        setLastRunId(null);
      }
    },
    onError: (error) => {
      toast.error('Failed to delete trades', {
        description: error.message
      });
    }
  });

  const handleGenerate = () => {
    const countNum = parseInt(count);
    if (!countNum || countNum < 1) {
      toast.error('Count must be at least 1');
      return;
    }
    generateMutation.mutate();
  };

  const handleWipeLastRun = () => {
    if (!lastRunId) {
      toast.error('No last run to wipe');
      return;
    }
    if (confirm('Delete all trades from last run?')) {
      wipeMutation.mutate(lastRunId);
    }
  };

  const handleWipeAll = () => {
    if (confirm('⚠️ Delete ALL seed trades? This cannot be undone!')) {
      wipeMutation.mutate(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
          <TestTube className="w-6 h-6 text-violet-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-[#c0c0c0]">DevTools</h1>
          <p className="text-[#666] text-sm">Test Data Generator & Data Export</p>
        </div>
      </div>

      <Tabs defaultValue="seeder" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-[#1a1a1a]">
          <TabsTrigger value="seeder">Seeder</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        <TabsContent value="seeder" className="space-y-6 mt-6">

      <Card className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 border-[#2a2a2a]/50 p-6">
        <div className="flex items-center gap-2 mb-6">
          <Zap className="w-5 h-5 text-emerald-400" />
          <h2 className="text-xl font-bold text-[#c0c0c0]">Generate Test Trades</h2>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[#c0c0c0]">Count</Label>
              <Input
                type="number"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                placeholder="Number of trades"
                className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
                min="1"
                max="5000"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[#c0c0c0]">Mode</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SMOKE">SMOKE (20 simple trades)</SelectItem>
                  <SelectItem value="EDGE">EDGE (80 complex trades)</SelectItem>
                  <SelectItem value="LOAD">LOAD (2000 trades)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[#c0c0c0]">Seed (Optional)</Label>
            <Input
              type="number"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="Random seed for reproducibility"
              className="bg-[#111] border-[#2a2a2a] text-[#c0c0c0]"
            />
          </div>

          <div className="pt-2">
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
            >
              {generateMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating {count} trades...
                </div>
              ) : (
                <>
                  <Database className="w-4 h-4 mr-2" />
                  Generate Test Trades
                </>
              )}
            </Button>
          </div>

          {lastRunId && generateMutation.data && (
            <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg space-y-1">
              <p className="text-sm text-emerald-400 font-mono">
                Last Run ID: {lastRunId.slice(0, 8)}...
              </p>
              <div className="text-xs text-emerald-400/70 space-y-0.5">
                <div>Created: {generateMutation.data.created_count} ({generateMutation.data.open_count} open, {generateMutation.data.closed_count} closed)</div>
                <div>Mode: {mode} • Seed: {seed || 'auto'} • Duration: {(generateMutation.data.duration_ms / 1000).toFixed(1)}s</div>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#0d0d0d]/90 border-[#2a2a2a]/50 p-6">
        <div className="flex items-center gap-2 mb-6">
          <Trash2 className="w-5 h-5 text-red-400" />
          <h2 className="text-xl font-bold text-[#c0c0c0]">Cleanup</h2>
        </div>

        <div className="space-y-3">
          <Button
            onClick={handleWipeLastRun}
            disabled={!lastRunId || wipeMutation.isPending}
            variant="destructive"
            className="w-full"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Wipe Last Run
          </Button>

          <Button
            onClick={handleWipeAll}
            disabled={wipeMutation.isPending}
            variant="destructive"
            className="w-full bg-red-700 hover:bg-red-800"
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Wipe All Seed Trades
          </Button>
        </div>
      </Card>

      <div className="p-4 bg-violet-500/10 border border-violet-500/30 rounded-lg">
        <h3 className="text-sm font-bold text-violet-400 mb-2">Mode Description</h3>
        <ul className="text-xs text-[#888] space-y-1">
          <li><span className="text-[#c0c0c0] font-mono">SMOKE:</span> 20 simple trades, basic validation</li>
          <li><span className="text-[#c0c0c0] font-mono">EDGE:</span> 80 trades with DCA, partial closes, null stops/takes</li>
          <li><span className="text-[#c0c0c0] font-mono">LOAD:</span> 2000 trades across 365 days for performance testing</li>
        </ul>
      </div>
        </TabsContent>

        <TabsContent value="export" className="mt-6">
          <ExportSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}