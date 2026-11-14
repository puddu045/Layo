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
  PublicProfile,
  UpdatePhoneRequest,
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

export function useUpdatePhone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdatePhoneRequest) => api.patch<OwnProfile>('/me/phone', dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
    },
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: () => api.delete('/me'),
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

/** Powers the profile preview popup (tapping a name/photo anywhere) — the public view of
 * someone else's profile, same shape Discover already shows. */
export function usePublicProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', 'public', userId],
    queryFn: () => api.get<PublicProfile>(`/users/${userId}/profile`),
    enabled: !!userId,
  });
}

/** The same popup's "how you're connected" section — current flight/airport overlap with this
 * specific person, computed fresh rather than stored (a Connection row never records why it was
 * made). Empty array is a valid, common result: whatever trip first connected them may already
 * be over. */
export function useMatchContext(userId: string | undefined) {
  return useQuery({
    queryKey: ['discover', 'with', userId],
    queryFn: () => api.get<Match[]>(`/discover/with/${userId}`),
    enabled: !!userId,
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
