import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save, Download, Upload, Trash2, AlertTriangle, Plug, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import RiskSettingsForm from '../components/risk/RiskSettingsForm';

export default function Settings() {
  const queryClient = useQueryClient();
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [formData, setFormData] = useState({ api_key: '', api_secret: '' });

  const { data: riskSettings } = useQuery({
    queryKey: ['riskSettings'],
    queryFn: async () => {
      const settings = await base44.entities.RiskSettings.list();
      return settings[0] || null;
    },
  });

  const { data: trades = [] } = useQuery({
    queryKey: ['trades'],
    queryFn: () => base44.entities.Trade.list('-date', 1000),
  });

  const { data: apiSettings = [] } = useQuery({
    queryKey: ['apiSettings'],
    queryFn: () => base44.entities.ApiSettings.filter({ is_active: true }, '-created_date', 1),
  });

  const currentSettings = apiSettings[0];

  const saveSettingsMutation = useMutation({
    mutationFn: async (data) => {
      if (riskSettings?.id) {
        return base44.entities.RiskSettings.update(riskSettings.id, data);
      } else {
        return base44.entities.RiskSettings.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['riskSettings']);
      toast.success('Settings saved');
    },
  });

  // Export all data
  const exportData = () => {
    const data = {
      trades: trades,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trading-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    toast.success('Data exported');
  };

  // Export as CSV
  const exportCSV = () => {
    const headers = [
      'Date', 'Coin', 'Direction', 'Entry Price', 'Position Size', 
      'Stop Price', 'Take Price', 'Close Price', 'PNL $', 'PNL %',
      'R Multiple', 'R:R Ratio', 'Strategy', 'Rule Compliance',
      'Emotional State', 'Confidence Level', 'Entry Reason', 'Analysis'
    ];
    
    const rows = trades.map(t => [
      t.date,
      t.coin,
      t.direction,
      t.entry_price,
      t.position_size,
      t.stop_price,
      t.take_price,
      t.close_price,
      t.pnl_usd,
      t.pnl_percent,
      t.r_multiple,
      t.rr_ratio,
      t.strategy_tag,
      t.rule_compliance ? 'Yes' : 'No',
      t.emotional_state,
      t.confidence_level,
      `"${(t.entry_reason || '').replace(/"/g, '""')}"`,
      `"${(t.trade_analysis || '').replace(/"/g, '""')}"`
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trades-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('CSV exported');
  };

  // Import data
  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (data.trades && Array.isArray(data.trades)) {
        for (const trade of data.trades) {
          delete trade.id;
          delete trade.created_date;
          delete trade.updated_date;
          await base44.entities.Trade.create(trade);
        }
        queryClient.invalidateQueries(['trades']);
        toast.success(`Imported ${data.trades.length} trades`);
      }
    } catch (err) {
      console.error('Import failed:', err);
      toast.error('Import failed');
    }
    setImporting(false);
    e.target.value = '';
  };

  // Clear all trades
  const clearAllTrades = async () => {
    if (!confirm('Are you sure you want to delete ALL trades? This cannot be undone!')) return;
    if (!confirm('This will permanently delete all your trading data. Continue?')) return;
    
    for (const trade of trades) {
      await base44.entities.Trade.delete(trade.id);
    }
    queryClient.invalidateQueries(['trades']);
    toast.success('All trades deleted');
  };

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (currentSettings) {
        return base44.entities.ApiSettings.update(currentSettings.id, data);
      } else {
        return base44.entities.ApiSettings.create({ ...data, exchange: 'bybit', is_active: true });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['apiSettings']);
      toast.success('API подключен');
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => base44.entities.ApiSettings.update(currentSettings.id, { is_active: false }),
    onSuccess: () => {
      queryClient.invalidateQueries(['apiSettings']);
      toast.success('API отключен');
    },
  });

  const syncTrades = async () => {
    console.log('Sync button clicked');
    console.log('Current settings:', currentSettings);

    if (!currentSettings?.is_active) {
      toast.error('API не подключен');
      return;
    }

    setSyncing(true);
    toast.loading('Синхронизация...', { id: 'sync' });

    try {
      console.log('Invoking syncBybitTrades function...');
      const response = await base44.functions.invoke('syncBybitTrades', {});
      console.log('Response:', response);

      const data = response.data;
      console.log('Data:', data);

      toast.dismiss('sync');

      if (data.error) {
        toast.error(data.error + (data.details ? ': ' + data.details : ''));
      } else {
        toast.success(data.message || 'Синхронизация завершена', { duration: 5000 });
      }

      queryClient.invalidateQueries(['apiSettings']);
      queryClient.invalidateQueries(['trades']);
    } catch (err) {
      console.error('Sync error:', err);
      toast.dismiss('sync');
      toast.error('Ошибка синхронизации: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#c0c0c0]">Settings</h1>
        <p className="text-[#666] text-sm">Configure your trading analytics system</p>
      </div>

      {/* Bybit API Integration */}
      <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#c0c0c0]">
            <Plug className="w-5 h-5" />
            Bybit API Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-[#151515] rounded-lg">
              <div className="flex items-center gap-3">
                {currentSettings?.is_active ? (
                  <>
                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                    <div>
                      <p className="text-emerald-400 font-medium">Подключено</p>
                      {currentSettings.last_sync && (
                        <p className="text-[#666] text-xs">
                          Последняя синхронизация: {new Date(currentSettings.last_sync).toLocaleString('ru-RU')}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="w-8 h-8 text-red-400" />
                    <div>
                      <p className="text-red-400 font-medium">Не подключено</p>
                      <p className="text-[#666] text-xs">Введите API ключи ниже</p>
                    </div>
                  </>
                )}
              </div>
              {currentSettings?.is_active && (
                <div className="flex gap-2">
                  <Button 
                    onClick={syncTrades}
                    disabled={syncing}
                    className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                    Синхронизировать
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => disconnectMutation.mutate()}
                    className="border-red-500/30 text-red-400"
                  >
                    Отключить
                  </Button>
                </div>
              )}
            </div>

            {!currentSettings?.is_active && (
              <>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
                  <div className="text-sm text-amber-200">
                    <p className="font-medium mb-1">Важно:</p>
                    <p>Используйте API ключ только с правами read-only (чтение).</p>
                  </div>
                </div>

                <div>
                  <Label className="text-[#888]">API Key</Label>
                  <Input 
                    type="password"
                    value={formData.api_key}
                    onChange={(e) => setFormData({...formData, api_key: e.target.value})}
                    className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] mt-1"
                    placeholder="Введите API Key"
                  />
                </div>

                <div>
                  <Label className="text-[#888]">API Secret</Label>
                  <Input 
                    type="password"
                    value={formData.api_secret}
                    onChange={(e) => setFormData({...formData, api_secret: e.target.value})}
                    className="bg-[#151515] border-[#2a2a2a] text-[#c0c0c0] mt-1"
                    placeholder="Введите API Secret"
                  />
                </div>

                <Button 
                  onClick={() => saveMutation.mutate(formData)}
                  disabled={!formData.api_key || !formData.api_secret}
                  className="w-full bg-[#c0c0c0] text-black hover:bg-[#a0a0a0]"
                >
                  Подключить
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Risk Settings */}
      <RiskSettingsForm 
        settings={riskSettings}
        onSave={(data) => saveSettingsMutation.mutate(data)}
      />

      {/* Data Management */}
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-6 border border-[#2a2a2a]">
        <h3 className="text-[#c0c0c0] font-semibold mb-4">Data Management</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-[#151515] rounded-lg">
            <div>
              <p className="text-[#c0c0c0] font-medium">Export All Data (JSON)</p>
              <p className="text-[#666] text-xs">Download complete backup of your trades</p>
            </div>
            <Button 
              onClick={exportData}
              variant="outline"
              className="border-[#2a2a2a] text-[#888]"
            >
              <Download className="w-4 h-4 mr-2" />
              Export JSON
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 bg-[#151515] rounded-lg">
            <div>
              <p className="text-[#c0c0c0] font-medium">Export Trades (CSV)</p>
              <p className="text-[#666] text-xs">Export for spreadsheet analysis</p>
            </div>
            <Button 
              onClick={exportCSV}
              variant="outline"
              className="border-[#2a2a2a] text-[#888]"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 bg-[#151515] rounded-lg">
            <div>
              <p className="text-[#c0c0c0] font-medium">Import Data</p>
              <p className="text-[#666] text-xs">Import trades from JSON backup</p>
            </div>
            <label>
              <Button 
                variant="outline"
                className="border-[#2a2a2a] text-[#888]"
                disabled={importing}
              >
                <Upload className="w-4 h-4 mr-2" />
                {importing ? 'Importing...' : 'Import'}
              </Button>
              <input 
                type="file" 
                accept=".json"
                className="hidden"
                onChange={handleImport}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-gradient-to-br from-red-500/10 to-[#0d0d0d] rounded-xl p-6 border border-red-500/20">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <h3 className="text-red-400 font-semibold">Danger Zone</h3>
        </div>
        
        <div className="flex items-center justify-between p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
          <div>
            <p className="text-red-400 font-medium">Delete All Trades</p>
            <p className="text-[#666] text-xs">Permanently remove all trading data</p>
          </div>
          <Button 
            onClick={clearAllTrades}
            variant="outline"
            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete All
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-6 border border-[#2a2a2a]">
        <h3 className="text-[#c0c0c0] font-semibold mb-4">Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-[#151515] rounded-lg">
            <p className="text-[#666] text-xs">Total Trades</p>
            <p className="text-2xl font-bold text-[#c0c0c0]">{trades.length}</p>
          </div>
          <div className="text-center p-4 bg-[#151515] rounded-lg">
            <p className="text-[#666] text-xs">Total PNL</p>
            <p className={`text-2xl font-bold ${trades.reduce((s, t) => s + (t.pnl_usd || 0), 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              ${trades.reduce((s, t) => s + (t.pnl_usd || 0), 0).toFixed(2)}
            </p>
          </div>
          <div className="text-center p-4 bg-[#151515] rounded-lg">
            <p className="text-[#666] text-xs">Unique Coins</p>
            <p className="text-2xl font-bold text-[#c0c0c0]">
              {[...new Set(trades.map(t => t.coin).filter(Boolean))].length}
            </p>
          </div>
          <div className="text-center p-4 bg-[#151515] rounded-lg">
            <p className="text-[#666] text-xs">Strategies</p>
            <p className="text-2xl font-bold text-[#c0c0c0]">
              {[...new Set(trades.map(t => t.strategy_tag).filter(Boolean))].length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}