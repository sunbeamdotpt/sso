import { useQuery } from '@tanstack/react-query'

export interface ConsentRequest {
  challenge: string
  client: { client_id: string; client_name?: string; logo_uri?: string }
  requested_scope: string[]
  requested_access_token_audience: string[]
  subject?: string
  skip?: boolean
  redirect_to?: string
  auto?: boolean
}

export function useConsent(challenge: string | null) {
  return useQuery({
    queryKey: ['consent', challenge],
    queryFn: async () => {
      const resp = await fetch(`/api/hydra/consent?challenge=${challenge}`)
      if (!resp.ok) throw new Error(`Failed to fetch consent: ${resp.status}`)
      return resp.json() as Promise<ConsentRequest>
    },
    enabled: !!challenge,
  })
}

export async function acceptConsent(
  challenge: string,
  grantScope: string[],
  remember = false,
  session?: Record<string, unknown>,
): Promise<{ redirect_to: string }> {
  const resp = await fetch('/api/hydra/consent/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challenge, grantScope, remember, session }),
  })
  if (!resp.ok) throw new Error('Failed to accept consent')
  return resp.json()
}

export async function rejectConsent(
  challenge: string,
): Promise<{ redirect_to: string }> {
  const resp = await fetch('/api/hydra/consent/reject', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challenge }),
  })
  if (!resp.ok) throw new Error('Failed to reject consent')
  return resp.json()
}

export function useLogoutRequest(challenge: string | null) {
  return useQuery({
    queryKey: ['logout', challenge],
    queryFn: async () => {
      const resp = await fetch(`/api/hydra/logout?challenge=${challenge}`)
      if (!resp.ok) throw new Error(`Failed to fetch logout: ${resp.status}`)
      return resp.json()
    },
    enabled: !!challenge,
  })
}

export async function acceptLogout(
  challenge: string,
): Promise<{ redirect_to: string }> {
  const resp = await fetch('/api/hydra/logout/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challenge }),
  })
  if (!resp.ok) throw new Error('Failed to accept logout')
  return resp.json()
}
