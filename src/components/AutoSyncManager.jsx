import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const INTERVAL_VISIBLE_MS   = 60_000;   // 60s when tab active
const INTERVAL_HIDDEN_MS    = 180_000;  // 3min when tab hidden
const INTERVAL_BACKOFF_MS   = 180_000;  // 3min after 3+ failures
const FAILURE_THRESHOLD     = 3;
const TICK_MS               = 10_000;   // check every 10s

export default function AutoSyncManager() {
  const queryClient = useQueryClient();
  const inFlight  = useRef(new Set());  // connection_ids currently syncing
  const failures  = useRef({});         // id -> consecutive failure count
  const lastSync  = useRef({});         // id -> timestamp ms

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 30 * 60_000,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['userProfiles', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.UserProfile.filter({ created_by: user.email }, '-created_date', 50);
    },
    enabled: !!user?.email,
    staleTime: 5 * 60_000,
  });

  const activeProfile = profiles.find(p => p.is_active) || profiles[0];

  const { data: connections = [] } = useQuery({
    queryKey: ['exchangeConnections', activeProfile?.id],
    queryFn: async () => {
      if (!activeProfile?.id) return [];
      const res = await base44.functions.invoke('exchangeConnectionsApi', { profile_id: activeProfile.id });
      return res.data?.connections || [];
    },
    enabled: !!activeProfile?.id,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const active = connections.filter(c => c.is_active);
    if (!active.length) return;

    const runSync = async (conn) => {
      if (inFlight.current.has(conn.id)) return;
      inFlight.current.add(conn.id);
      console.log(`[AutoSync] start: ${conn.name}`);
      try {
        const res = await base44.functions.invoke('syncExchangeConnection', { connection_id: conn.id });
        if (res.data?.ok) {
          failures.current[conn.id] = 0;
          console.log(`[AutoSync] OK: +${res.data.inserted} new, ${res.data.updated} updated, ${res.data.skipped} skipped`);
          queryClient.invalidateQueries({ queryKey: ['exchangeConnections', activeProfile?.id] });
          queryClient.invalidateQueries({ queryKey: ['trades'] });
        } else {
          failures.current[conn.id] = (failures.current[conn.id] || 0) + 1;
          console.warn(`[AutoSync] error (${conn.name}):`, res.data?.error);
        }
      } catch (e) {
        failures.current[conn.id] = (failures.current[conn.id] || 0) + 1;
        console.warn(`[AutoSync] exception (${conn.name}):`, e.message);
      } finally {
        lastSync.current[conn.id] = Date.now();
        inFlight.current.delete(conn.id);
      }
    };

    const tick = () => {
      const hidden = document.visibilityState === 'hidden';
      const now = Date.now();
      for (const conn of active) {
        const fails = failures.current[conn.id] || 0;
        const interval = hidden
          ? INTERVAL_HIDDEN_MS
          : fails >= FAILURE_THRESHOLD
            ? INTERVAL_BACKOFF_MS
            : INTERVAL_VISIBLE_MS;
        if (now - (lastSync.current[conn.id] || 0) >= interval) {
          runSync(conn);
        }
      }
    };

    const timerId = setInterval(tick, TICK_MS);
    tick(); // immediate first run
    return () => clearInterval(timerId);
  }, [connections, activeProfile?.id, queryClient]);

  return null;
}