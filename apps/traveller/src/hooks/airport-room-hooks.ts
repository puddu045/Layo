import { useEffect } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { socketEvents, type AirportRoomSummary, type RoomMessagePage } from '@layo/contracts';
import { api } from '../lib/api-client';
import { getSocket } from '../lib/socket';

export function useMyAirportRooms() {
  return useQuery({
    queryKey: ['airport-rooms'],
    queryFn: () => api.get<AirportRoomSummary[]>('/airport-rooms'),
  });
}

export function useRoomMessages(airportIata: string | undefined) {
  return useInfiniteQuery({
    queryKey: ['room-messages', airportIata],
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      api.get<RoomMessagePage>(
        `/airport-rooms/${airportIata}/messages?limit=50${pageParam ? `&cursor=${pageParam}` : ''}`,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!airportIata,
  });
}

export function useSendRoomMessage(airportIata: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api.post(`/airport-rooms/${airportIata}/messages`, { body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room-messages', airportIata] });
      queryClient.invalidateQueries({ queryKey: ['airport-rooms'] });
    },
  });
}

/** Joins the room's socket channel for the lifetime of the mounting screen (re-verified
 * server-side against the same eligibility windows the REST endpoints enforce), and
 * invalidates the message query on live pushes. */
export function useRealtimeRoomMessages(airportIata: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!airportIata) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    getSocket().then((socket) => {
      if (cancelled) return;

      socket.emit('room:join', { airportIata });
      const onNew = () => {
        queryClient.invalidateQueries({ queryKey: ['room-messages', airportIata] });
      };
      socket.on(socketEvents.ROOM_MESSAGE_NEW, onNew);

      cleanup = () => {
        socket.off(socketEvents.ROOM_MESSAGE_NEW, onNew);
        socket.emit('room:leave', { airportIata });
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [airportIata, queryClient]);
}
