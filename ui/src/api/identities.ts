import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'

export interface Identity {
  id: string
  schema_id: string
  state: 'active' | 'inactive'
  traits: Record<string, unknown>
  metadata_public?: Record<string, unknown>
  metadata_admin?: Record<string, unknown>
  credentials?: Record<string, { type: string; created_at: string }>
  created_at: string
  updated_at: string
}

export function useIdentities(params?: { page_size?: number; page_token?: string; credentials_identifier?: string }) {
  const search = new URLSearchParams()
  if (params?.page_size) search.set('page_size', String(params.page_size))
  if (params?.page_token) search.set('page_token', params.page_token)
  if (params?.credentials_identifier) search.set('credentials_identifier', params.credentials_identifier)
  return useQuery({
    queryKey: ['identities', params],
    queryFn: () => api.get<Identity[]>(`/admin/identities?${search}`),
  })
}

export function useIdentity(id: string) {
  return useQuery({
    queryKey: ['identities', id],
    queryFn: () => api.get<Identity>(`/admin/identities/${id}`),
    enabled: !!id,
  })
}

export function useCreateIdentity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { schema_id: string; traits: unknown; state?: string }) =>
      api.post<Identity>('/admin/identities', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['identities'] }),
  })
}

export function useUpdateIdentity(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<Identity>) =>
      api.put<Identity>(`/admin/identities/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['identities'] }),
  })
}

export function useDeleteIdentity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/identities/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['identities'] }),
  })
}

export function useGenerateRecoveryLink() {
  return useMutation({
    mutationFn: (body: { identity_id: string; expires_in?: string }) =>
      api.post<{ recovery_link: string; expires_at: string }>('/admin/recovery/link', body),
  })
}

export function useGenerateRecoveryCode() {
  return useMutation({
    mutationFn: (body: { identity_id: string; expires_in?: string }) =>
      api.post<{ recovery_code: string; recovery_link: string; expires_at: string }>('/admin/recovery/code', body),
  })
}

export interface Session {
  id: string
  identity_id?: string
  active: boolean
  expires_at: string
  authenticated_at: string
  authenticator_assurance_level: string
}

export function useIdentitySessions(identityId: string) {
  return useQuery({
    queryKey: ['identities', identityId, 'sessions'],
    queryFn: () => api.get<Session[]>(`/admin/identities/${identityId}/sessions`),
    enabled: !!identityId,
  })
}

export function useDeleteAllIdentitySessions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (identityId: string) =>
      api.delete(`/admin/identities/${identityId}/sessions`),
    onSuccess: (_, identityId) =>
      qc.invalidateQueries({ queryKey: ['identities', identityId, 'sessions'] }),
  })
}
