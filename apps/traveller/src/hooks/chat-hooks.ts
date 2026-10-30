import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { socketEvents, type Connection, type ConnectionStatus, type Message, type PaginatedResponse } from '@layo/contracts';
import { api } from '../lib/api-client';
import { getSocket } from '../lib/socket';

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
  return useMutation({
    mutationFn: (body: string) => api.post<Message>(`/connections/${connectionId}/messages`, { body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', connectionId] });
      queryClient.invalidateQueries({ queryKey: ['connections'] });
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
