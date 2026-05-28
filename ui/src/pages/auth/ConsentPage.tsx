import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Checkbox } from '@gouvfr-lasuite/cunningham-react'
import { useConsent, acceptConsent, rejectConsent } from '../../api/hydra'

const SCOPE_INFO: Record<string, { label: string; description: string }> = {
  openid: { label: 'OpenID', description: 'Verify your identity' },
  email: { label: 'Email', description: 'View your email address' },
  profile: { label: 'Profile', description: 'View your name and profile info' },
  offline_access: { label: 'Offline access', description: 'Stay signed in' },
}

export default function ConsentPage() {
  const [params] = useSearchParams()
  const challenge = params.get('consent_challenge')
  const { data: consent, isLoading, error } = useConsent(challenge)
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set())
  const [remember, setRemember] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (consent?.redirect_to && consent?.auto) {
      window.location.href = consent.redirect_to
    }
    if (consent?.requested_scope) {
      setSelectedScopes(new Set(consent.requested_scope))
    }
  }, [consent])

  if (!challenge) {
    return <p style={{ color: 'var(--sunbeam--text-secondary)' }}>Missing consent challenge.</p>
  }

  if (isLoading) return <p style={{ color: 'var(--sunbeam--text-secondary)' }}>Loading...</p>
  if (error) return <p style={{ color: 'var(--c--theme--colors--danger-500)' }}>Error: {String(error)}</p>
  if (!consent) return null

  if (consent.redirect_to && consent.auto) {
    return <p style={{ color: 'var(--sunbeam--text-secondary)' }}>Redirecting...</p>
  }

  if (consent.skip) {
    const doAccept = async () => {
      const result = await acceptConsent(challenge, consent.requested_scope, true)
      window.location.href = result.redirect_to
    }
    doAccept()
    return <p style={{ color: 'var(--sunbeam--text-secondary)' }}>Redirecting...</p>
  }

  const handleAccept = async () => {
    setSubmitting(true)
    try {
      const result = await acceptConsent(challenge, [...selectedScopes], remember)
      window.location.href = result.redirect_to
    } catch {
      setSubmitting(false)
    }
  }

  const handleReject = async () => {
    setSubmitting(true)
    try {
      const result = await rejectConsent(challenge)
      window.location.href = result.redirect_to
    } catch {
      setSubmitting(false)
    }
  }

  const toggleScope = (scope: string) => {
    const next = new Set(selectedScopes)
    next.has(scope) ? next.delete(scope) : next.add(scope)
    setSelectedScopes(next)
  }

  const clientName = consent.client?.client_name ?? consent.client?.client_id ?? 'An application'

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: 'var(--c--theme--colors--primary-100)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '0.75rem',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--c--theme--colors--primary-600)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.25rem', fontWeight: 600 }}>
          Authorize {clientName}
        </h2>
        <p style={{ margin: 0, color: 'var(--sunbeam--text-secondary)', fontSize: '0.875rem' }}>
          This app would like permission to access your account.
        </p>
      </div>

      <div style={{
        border: '1px solid var(--sunbeam--border)',
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: '1rem',
      }}>
        {consent.requested_scope.map((scope, i) => {
          const info = SCOPE_INFO[scope]
          return (
            <label
              key={scope}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.75rem 1rem',
                cursor: 'pointer',
                borderTop: i > 0 ? '1px solid var(--sunbeam--border)' : 'none',
              }}
            >
              <Checkbox
                checked={selectedScopes.has(scope)}
                onChange={() => toggleScope(scope)}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                  {info?.label ?? scope}
                </div>
                {info?.description && (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--sunbeam--text-secondary)', marginTop: 1 }}>
                    {info.description}
                  </div>
                )}
              </div>
            </label>
          )
        })}
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <Checkbox
          label="Remember this decision"
          checked={remember}
          onChange={() => setRemember(!remember)}
        />
      </div>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <Button color="brand" onClick={handleAccept} disabled={submitting} fullWidth>
          Allow
        </Button>
        <Button color="neutral" onClick={handleReject} disabled={submitting} fullWidth>
          Deny
        </Button>
      </div>
    </div>
  )
}
