import { useEffect } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
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

// The Notifications screen only ever renders the unread ones (see `notifications.tsx`) — reading
// a notification is how you "clear" it there — so both mutations below update the cache
// optimistically, marking it read right away instead of waiting on a round trip before it
// disappears from the list.

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => api.post(`/notifications/${notificationId}/read`),
    onMutate: async (notificationId: string) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const previousList = queryClient.getQueryData<InfiniteData<NotificationPage>>(['notifications']);
      const previousCount = queryClient.getQueryData<NotificationPage>(['notifications', 'unread-count']);
      const readAt = new Date().toISOString();

      queryClient.setQueryData<InfiniteData<NotificationPage>>(['notifications'], (old) =>
        old
          ? {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                items: page.items.map((n) => (n.id === notificationId ? { ...n, readAt } : n)),
              })),
            }
          : old,
      );
      queryClient.setQueryData<NotificationPage>(['notifications', 'unread-count'], (old) =>
        old ? { ...old, unreadCount: Math.max(0, old.unreadCount - 1) } : old,
      );

      return { previousList, previousCount };
    },
    onError: (_err, _id, context) => {
      if (context?.previousList) queryClient.setQueryData(['notifications'], context.previousList);
      if (context?.previousCount) queryClient.setQueryData(['notifications', 'unread-count'], context.previousCount);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const previousList = queryClient.getQueryData<InfiniteData<NotificationPage>>(['notifications']);
      const previousCount = queryClient.getQueryData<NotificationPage>(['notifications', 'unread-count']);
      const readAt = new Date().toISOString();

      queryClient.setQueryData<InfiniteData<NotificationPage>>(['notifications'], (old) =>
        old
          ? {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                items: page.items.map((n) => (n.readAt ? n : { ...n, readAt })),
              })),
            }
          : old,
      );
      queryClient.setQueryData<NotificationPage>(['notifications', 'unread-count'], (old) =>
        old ? { ...old, unreadCount: 0 } : old,
      );

      return { previousList, previousCount };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousList) queryClient.setQueryData(['notifications'], context.previousList);
      if (context?.previousCount) queryClient.setQueryData(['notifications', 'unread-count'], context.previousCount);
    },
    onSettled: () => {
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
