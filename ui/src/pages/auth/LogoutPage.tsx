import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@gouvfr-lasuite/cunningham-react'
import { useLogoutRequest, acceptLogout } from '../../api/hydra'

export default function LogoutPage() {
  const [params] = useSearchParams()
  const challenge = params.get('logout_challenge')
  const { data: logoutReq, isLoading, error } = useLogoutRequest(challenge)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!challenge) {
      fetch('/kratos/self-service/logout/browser', {
        credentials: 'include',
        redirect: 'manual',
      }).then(async (resp) => {
        if (resp.ok) {
          const data = await resp.json()
          if (data.logout_url) {
            window.location.href = data.logout_url
            return
          }
        }
        window.location.href = '/login'
      }).catch(() => {
        window.location.href = '/login'
      })
    }
  }, [challenge])

  if (!challenge) return <div>Signing out...</div>
  if (isLoading) return <div>Loading...</div>
  if (error) return <div style={{ color: 'var(--c--theme--colors--danger-500)' }}>Error: {String(error)}</div>

  const handleAccept = async () => {
    setSubmitting(true)
    try {
      const result = await acceptLogout(challenge)
      window.location.href = result.redirect_to
    } catch {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Sign out</h2>
      <p>Do you want to sign out?</p>
      {logoutReq?.subject && (
        <p style={{ color: 'var(--sunbeam--text-secondary)' }}>
          Signed in as: <strong>{logoutReq.subject}</strong>
        </p>
      )}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
        <Button color="brand" onClick={handleAccept} disabled={submitting} fullWidth>
          Sign out
        </Button>
        <Button color="neutral" onClick={() => window.history.back()} disabled={submitting} fullWidth>
          Cancel
        </Button>
      </div>
    </div>
  )
}
