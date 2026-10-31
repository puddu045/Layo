import { useEffect } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { socketEvents, type NotificationPage } from '@layo/contracts';
import { api } from '../lib/api-client';
import { getSocket } from '../lib/socket';

export function useNotifications() {
  return useInfiniteQuery({
    queryKey: ['notifications'],
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      api.get<NotificationPage>(`/notifications?limit=30${pageParam ? `&cursor=${pageParam}` : ''}`),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

/** Cheap enough to poll from the bell icon's badge: `limit=1` still returns the full unread count. */
export function useUnreadNotificationsCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get<NotificationPage>('/notifications?limit=1'),
    select: (page) => page.unreadCount,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => api.post(`/notifications/${notificationId}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

/** New notifications arrive on the same per-user socket room messaging already uses — no
 * explicit join needed (the gateway puts every authenticated socket in `user:<id>` on connect). */
export function useRealtimeNotifications() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    getSocket().then((socket) => {
      if (cancelled) return;
      const onNew = () => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      };
      socket.on(socketEvents.NOTIFICATION_NEW, onNew);
      cleanup = () => socket.off(socketEvents.NOTIFICATION_NEW, onNew);
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [queryClient]);
}
