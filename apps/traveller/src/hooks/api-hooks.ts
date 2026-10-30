import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Airport,
  CreateJourneyRequest,
  CreateProfileRequest,
  DiscoverQuery,
  FlightLookupRequest,
  FlightLookupResponse,
  Journey,
  OwnProfile,
  PaginatedResponse,
  Match,
  UpdateProfileRequest,
} from '@layo/contracts';
import { api } from '../lib/api-client';

export function useOwnProfile() {
  return useQuery({
    queryKey: ['profile', 'me'],
    queryFn: () => api.get<OwnProfile>('/me/profile'),
    retry: false,
  });
}

export function useCreateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateProfileRequest) => api.post<OwnProfile>('/me/profile', dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateProfileRequest) => api.patch<OwnProfile>('/me/profile', dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
    },
  });
}

export function useJourneys() {
  return useQuery({
    queryKey: ['journeys'],
    queryFn: () => api.get<Journey[]>('/journeys'),
  });
}

export function useJourney(journeyId: string | undefined) {
  return useQuery({
    queryKey: ['journeys', journeyId],
    queryFn: () => api.get<Journey>(`/journeys/${journeyId}`),
    enabled: !!journeyId,
  });
}

export function useCreateJourney() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateJourneyRequest) => api.post<Journey>('/journeys', dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journeys'] });
    },
  });
}

export function useDeleteJourney() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (journeyId: string) => api.delete(`/journeys/${journeyId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journeys'] });
    },
  });
}

export function useFlightLookup() {
  return useMutation({
    mutationFn: (dto: FlightLookupRequest) => api.post<FlightLookupResponse>('/flights/lookup', dto),
  });
}

export function useAirports(search: string) {
  return useQuery({
    queryKey: ['airports', search],
    queryFn: () => api.get<Airport[]>(`/airports${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    enabled: search.length >= 2,
  });
}

export function useDiscover(query: Partial<DiscoverQuery>) {
  const params = new URLSearchParams();
  if (query.journeyId) params.set('journeyId', query.journeyId);
  if (query.category) params.set('category', query.category);
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));

  return useQuery({
    queryKey: ['discover', query],
    queryFn: () => api.get<PaginatedResponse<Match>>(`/discover?${params.toString()}`),
  });
}
