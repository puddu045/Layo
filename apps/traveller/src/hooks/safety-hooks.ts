import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateReportRequest } from '@layo/contracts';
import { api } from '../lib/api-client';

export function useBlockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (blockedUserId: string) => api.post('/blocks', { blockedUserId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['discover'] });
    },
  });
}

export function useReportContent() {
  return useMutation({
    mutationFn: (dto: CreateReportRequest) => api.post('/reports', dto),
  });
}
