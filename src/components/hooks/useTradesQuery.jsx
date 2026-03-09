import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// Single shared query key — all pages must use this
export const tradesQueryKey = (profileId) => ['trades', profileId];

// Shared hook — one source of truth for all pages
export function useTradesQuery(profileId) {
  return useQuery({
    queryKey: tradesQueryKey(profileId),
    queryFn: async () => {
      if (!profileId) return [];
      let all = [];
      let skip = 0;
      const BATCH = 500;
      while (true) {
        const batch = await base44.entities.Trade.filter(
          { profile_id: profileId }, '-date_open', BATCH, skip
        );
        if (!batch || batch.length === 0) break;
        all = all.concat(batch);
        skip += batch.length;
        if (batch.length < BATCH) break;
      }
      return all;
    },
    enabled: !!profileId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    gcTime: 10 * 60 * 1000,
  });
}