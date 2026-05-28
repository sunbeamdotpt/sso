import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Session } from './identities'

export function useSessions(params?: { page_size?: number; active?: boolean }) {
  const search = new URLSearchParams()
  if (params?.page_size) search.set('page_size', String(params.page_size))
  if (params?.active !== undefined) search.set('active', String(params.active))
  return useQuery({
    queryKey: ['sessions', params],
    queryFn: () => api.get<Session[]>(`/admin/sessions?${search}`),
  })
}

export function useSession(id: string) {
  return useQuery({
    queryKey: ['sessions', id],
    queryFn: () => api.get<Session>(`/admin/sessions/${id}`),
    enabled: !!id,
  })
}

export function useRevokeSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/sessions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  })
}

export function useExtendSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.patch(`/admin/sessions/${id}/extend`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  })
}
