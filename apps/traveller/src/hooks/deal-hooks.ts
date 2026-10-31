import { useQuery } from '@tanstack/react-query';
import type { Deal } from '@layo/contracts';
import { api } from '../lib/api-client';

/** Approved, currently valid deals at airports the traveller's own journeys touch. */
export function useMyDeals() {
  return useQuery({
    queryKey: ['deals', 'for-me'],
    queryFn: () => api.get<Deal[]>('/deals/for-me'),
  });
}
