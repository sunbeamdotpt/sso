import { useQuery } from '@tanstack/react-query'
import { api } from './client'

export interface SchemaListItem {
  id: string
  url?: string
}

export function useSchemas() {
  return useQuery({
    queryKey: ['schemas'],
    queryFn: () => api.get<SchemaListItem[]>('/schemas'),
  })
}

// Kratos GET /schemas/{id} returns the raw JSON schema directly
export function useSchema(id: string) {
  return useQuery({
    queryKey: ['schemas', id],
    queryFn: () => api.get<Record<string, unknown>>(`/schemas/${encodeURIComponent(id)}`),
    enabled: !!id,
  })
}
