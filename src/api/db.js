import { supabase } from './supabaseClient';

// Generic entity factory — mirrors base44.entities.X API
export function createEntity(tableName) {
  return {
    async filter(query = {}, sortKey = 'created_at', limit = 500, skip = 0) {
      let q = supabase.from(tableName).select('*');
      for (const [key, val] of Object.entries(query)) {
        if (val !== undefined && val !== null) {
          q = q.eq(key, val);
        }
      }
      if (typeof sortKey === 'string' && sortKey.startsWith('-')) {
        q = q.order(sortKey.slice(1), { ascending: false });
      } else {
        q = q.order(sortKey || 'created_at', { ascending: true });
      }
      q = q.range(skip, skip + limit - 1);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },

    async list(sortKey = '-created_at', limit = 500) {
      return this.filter({}, sortKey, limit, 0);
    },

    async get(id) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },

    async create(payload) {
      const { data, error } = await supabase
        .from(tableName)
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async update(id, payload) {
      const { data, error } = await supabase
        .from(tableName)
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async delete(id) {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) throw error;
      return { ok: true };
    },

    async upsert(payload, conflictKey = 'id') {
      const { data, error } = await supabase
        .from(tableName)
        .upsert(payload, { onConflict: conflictKey })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
  };
}

// All entities — one per Supabase table
export const UserProfile = createEntity('user_profiles');
export const Trade = createEntity('trades');
export const ExchangeConnection = createEntity('exchange_connections');
export const RiskSettings = createEntity('risk_settings');
export const Notification = createEntity('notifications');
export const NotificationSettings = createEntity('notification_settings');
export const TradeTemplates = createEntity('trade_templates');
export const BotApiToken = createEntity('bot_api_tokens');
export const WeeklyOutlook = createEntity('weekly_outlooks');
export const TestRun = createEntity('test_runs');
export const BehaviorLog = createEntity('behavior_logs');
export const PsychologyProfile = createEntity('psychology_profiles');
export const FocusGoal = createEntity('focus_goals');
export const ApiSettings = createEntity('api_settings');
export const Note = createEntity('notes');
export const SubscriptionPlan = createEntity('subscription_plans');
export const Query = createEntity('queries');
