import { useQuery } from '@tanstack/react-query'
import { api } from './client'

export interface CourierMessage {
  id: string
  recipient: string
  subject: string
  status: string
  type: string
  created_at: string
  updated_at: string
  body?: string
}

export function useCourierMessages(params?: { page_size?: number; status?: string; recipient?: string }) {
  const search = new URLSearchParams()
  if (params?.page_size) search.set('page_size', String(params.page_size))
  if (params?.status) search.set('status', params.status)
  if (params?.recipient) search.set('recipient', params.recipient)
  return useQuery({
    queryKey: ['courier', params],
    queryFn: () => api.get<CourierMessage[]>(`/admin/courier/messages?${search}`),
  })
}

export function useCourierMessage(id: string) {
  return useQuery({
    queryKey: ['courier', id],
    queryFn: () => api.get<CourierMessage>(`/admin/courier/messages/${id}`),
    enabled: !!id,
  })
}
