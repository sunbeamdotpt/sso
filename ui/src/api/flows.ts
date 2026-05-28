import { useQuery } from '@tanstack/react-query'

export interface FlowUI {
  action: string
  method: string
  nodes: FlowNode[]
  messages?: FlowMessage[]
}

export interface FlowNode {
  type: 'input' | 'text' | 'img' | 'script' | 'a'
  group: string
  attributes: Record<string, unknown>
  messages: FlowMessage[]
  meta: {
    label?: { id: number; text: string; type: string }
  }
}

export interface FlowMessage {
  id: number
  text: string
  type: 'error' | 'info' | 'success'
  context?: Record<string, unknown>
}

export interface Flow {
  id: string
  type: string
  ui: FlowUI
  state?: string
  request_url?: string
  oauth2_login_challenge?: string
}

export function useFlow(type: string, flowId: string | null) {
  return useQuery({
    queryKey: ['flow', type, flowId],
    queryFn: async () => {
      const resp = await fetch(`/api/flow/${type}?flow=${flowId}`)
      if (!resp.ok) throw new Error(`Failed to fetch flow: ${resp.status}`)
      return resp.json() as Promise<Flow>
    },
    enabled: !!flowId,
  })
}

export function useFlowError(errorId: string | null) {
  return useQuery({
    queryKey: ['flowError', errorId],
    queryFn: async () => {
      const resp = await fetch(`/api/flow/error?id=${errorId}`)
      if (!resp.ok) throw new Error(`Failed to fetch error: ${resp.status}`)
      return resp.json()
    },
    enabled: !!errorId,
  })
}
