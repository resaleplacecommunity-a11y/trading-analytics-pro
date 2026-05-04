import { supabase } from './supabaseClient';
import { UserProfile, Trade, ExchangeConnection } from './db.js';

// Replaces base44.functions.invoke(name, payload)
export async function invoke(functionName, payload = {}) {
  switch (functionName) {
    case 'enforceActiveProfile':
      return enforceActiveProfile(payload);
    case 'healProfileIntegrity':
      return healProfileIntegrity(payload);
    case 'recalculateTradeMetrics':
      return recalculateTradeMetrics(payload);
    case 'generateTestTrades':
    case 'wipeTestTrades':
    case 'syncBybitTrades':
      return { data: { ok: false, error: 'Use syncExchangeConnectionV2 instead' } };
    case 'syncExchangeConnectionV2/main':
    case 'syncExchangeConnectionV2':
      return supabase.functions.invoke('sync-exchange', { body: payload });
    case 'exchangeConnectionsApi':
      return exchangeConnectionsApi(payload);
    case 'connectBybit':
      return { data: { ok: false, error: 'Use exchangeConnectionsApi instead' } };
    default:
      console.warn('Unknown function:', functionName);
      return { data: { ok: false, error: `Unknown function: ${functionName}` } };
  }
}

async function enforceActiveProfile({ profileId }) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Deactivate all profiles for this user
    await supabase
      .from('user_profiles')
      .update({ is_active: false })
      .eq('created_by', user.email);

    // Activate the selected one
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ is_active: true })
      .eq('id', profileId)
      .eq('created_by', user.email)
      .select('name')
      .single();

    if (error) throw error;
    return { data: { success: true, active_profile_name: data.name } };
  } catch (e) {
    return { data: { success: false, error: e.message } };
  }
}

async function healProfileIntegrity() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const profiles = await UserProfile.filter({ created_by: user.email });
    const active = profiles.filter(p => p.is_active);

    if (active.length <= 1) return { data: { healed_profiles: 0, fixed_count: 0 } };

    // Keep first active, deactivate the rest
    const toDeactivate = active.slice(1).map(p => p.id);
    for (const id of toDeactivate) {
      await supabase.from('user_profiles').update({ is_active: false }).eq('id', id);
    }
    return { data: { healed_profiles: toDeactivate.length, fixed_count: toDeactivate.length } };
  } catch (e) {
    return { data: { healed_profiles: 0, error: e.message } };
  }
}

async function recalculateTradeMetrics() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: { success: false, error: 'Not authenticated' } };

    const trades = await Trade.filter({ created_by: user.email }, 'created_at', 10000);
    let count = 0;

    for (const trade of trades) {
      if (!trade.entry_price || !trade.stop_price || !trade.position_size) continue;

      const entry = parseFloat(trade.entry_price);
      const stop = parseFloat(trade.stop_price);
      const size = parseFloat(trade.position_size);
      const risk_usd = (Math.abs(entry - stop) / entry) * size;

      let r_multiple = null;
      if (trade.close_price && risk_usd > 0) {
        const close = parseFloat(trade.close_price);
        const pnl = trade.direction === 'Long'
          ? size * (close / entry - 1)
          : size * (1 - close / entry);
        r_multiple = pnl / risk_usd;
      }

      await supabase.from('trades').update({ risk_usd, r_multiple }).eq('id', trade.id);
      count++;
    }

    return { data: { success: true, recalculated_count: count } };
  } catch (e) {
    return { data: { success: false, error: e.message } };
  }
}

async function exchangeConnectionsApi(payload) {
  // Stub — will be replaced by Supabase Edge Function
  const method = payload._method || payload.method || 'GET';
  const path = payload._path || payload.path || '/connections';

  try {
    if (path === '/connections' || path === 'connections') {
      if (method === 'GET') {
        const conns = await ExchangeConnection.filter({ profile_id: payload.profile_id });
        return { data: { ok: true, connections: conns } };
      }
    }
    if (path && path.startsWith('connections/')) {
      const id = path.split('/')[1];
      if (method === 'DELETE') {
        await ExchangeConnection.delete(id);
        return { data: { ok: true } };
      }
      if (method === 'PATCH') {
        const { _path, _method, ...updates } = payload;
        const updated = await ExchangeConnection.update(id, updates);
        return { data: { ok: true, connection: updated } };
      }
    }
    return { data: { ok: false, error: 'Exchange API not fully implemented — needs Edge Function' } };
  } catch (e) {
    return { data: { ok: false, error: e.message } };
  }
}
