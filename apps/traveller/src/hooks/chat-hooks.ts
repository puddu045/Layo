import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { socketEvents, type Connection, type ConnectionStatus, type Message, type PaginatedResponse } from '@layo/contracts';
import { api } from '../lib/api-client';
import { getSocket } from '../lib/socket';
import { useAuth } from '../lib/auth-context';

export function useConnections(status?: ConnectionStatus) {
  return useQuery({
    queryKey: ['connections', status ?? 'all'],
    queryFn: () => api.get<Connection[]>(`/connections${status ? `?status=${status}` : ''}`),
  });
}

export function useCreateConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (addresseeUserId: string) => api.post<Connection>('/connections', { addresseeUserId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['discover'] });
    },
  });
}

export function useAcceptConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string) => api.post<Connection>(`/connections/${connectionId}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['discover'] });
    },
  });
}

export function useDeclineConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string) => api.post<Connection>(`/connections/${connectionId}/decline`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['connections'] }),
  });
}

export function useCancelConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string) => api.post<Connection>(`/connections/${connectionId}/cancel`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['connections'] }),
  });
}

export function useMessages(connectionId: string | undefined, page = 1, pageSize = 50) {
  return useQuery({
    queryKey: ['messages', connectionId, page],
    queryFn: () =>
      api.get<PaginatedResponse<Message>>(`/connections/${connectionId}/messages?page=${page}&pageSize=${pageSize}`),
    enabled: !!connectionId,
  });
}

export function useSendMessage(connectionId: string) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const messagesKey = ['messages', connectionId, 1];

  return useMutation({
    mutationFn: (body: string) => api.post<Message>(`/connections/${connectionId}/messages`, { body }),
    // True optimistic send: the sender's own bubble appears the instant they tap send, before
    // the request even reaches the network — writing the server's response in onSuccess (the
    // previous fix) still waited on a full round trip, which read as lag whenever that request
    // was slow (a cold Railway instance, a weak connection). A client-generated id distinguishes
    // the placeholder from the real row until the response (or a MESSAGE_NEW socket echo) arrives.
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: messagesKey });
      const previous = queryClient.getQueryData<PaginatedResponse<Message>>(messagesKey);
      const senderId = session?.user.id;
      if (!senderId) return { previous, optimisticId: undefined };

      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticMessage: Message = {
        id: optimisticId,
        connectionId,
        senderId,
        body,
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData<PaginatedResponse<Message>>(messagesKey, (old) =>
        old ? { ...old, items: [optimisticMessage, ...old.items], total: old.total + 1 } : old,
      );
      return { previous, optimisticId };
    },
    onSuccess: (message, _body, context) => {
      queryClient.setQueryData<PaginatedResponse<Message>>(messagesKey, (old) => {
        if (!old) return old;
        const withoutOptimistic = context?.optimisticId
          ? old.items.filter((m) => m.id !== context.optimisticId)
          : old.items;
        if (withoutOptimistic.some((m) => m.id === message.id)) {
          return { ...old, items: withoutOptimistic };
        }
        const replacedOptimistic = withoutOptimistic.length < old.items.length;
        return {
          ...old,
          items: [message, ...withoutOptimistic],
          total: replacedOptimistic ? old.total : old.total + 1,
        };
      });
      queryClient.invalidateQueries({ queryKey: ['connections'] });
    },
    // The optimistic bubble is wrong, not just unconfirmed — roll the cache back to what it was
    // before this send, the same way the chat screen already restores the composer's draft text.
    onError: (_err, _body, context) => {
      if (context && 'previous' in context) {
        queryClient.setQueryData(messagesKey, context.previous);
      }
    },
  });
}

export function useMarkRead(connectionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/connections/${connectionId}/messages/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['connections'] }),
  });
}

/**
 * Connects the messaging socket for the lifetime of the mounting component and
 * invalidates the relevant queries on incoming events, so open screens update
 * live instead of waiting for the next manual refetch. Safe to mount from
 * multiple screens at once — each just adds its own listener.
 */
export function useRealtimeMessages() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    getSocket().then((socket) => {
      if (cancelled) return;

      const onNew = (payload: { connectionId: string }) => {
        queryClient.invalidateQueries({ queryKey: ['messages', payload.connectionId] });
        queryClient.invalidateQueries({ queryKey: ['connections'] });
      };
      const onRead = () => {
        queryClient.invalidateQueries({ queryKey: ['connections'] });
      };

      socket.on(socketEvents.MESSAGE_NEW, onNew);
      socket.on(socketEvents.MESSAGE_READ, onRead);

      cleanup = () => {
        socket.off(socketEvents.MESSAGE_NEW, onNew);
        socket.off(socketEvents.MESSAGE_READ, onRead);
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [queryClient]);
}
