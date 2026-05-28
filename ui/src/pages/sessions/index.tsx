import { useState } from 'react'
import { Button } from '@gouvfr-lasuite/cunningham-react'
import { useSessions, useRevokeSession, useExtendSession } from '../../api/sessions'
import ConfirmModal from '../../components/ConfirmModal'

export default function SessionsPage() {
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined)
  const { data: sessions, isLoading, error } = useSessions({
    page_size: 50,
    active: activeFilter,
  })
  const revokeSession = useRevokeSession()
  const extendSession = useExtendSession()
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null)

  if (isLoading) return <div>Loading sessions...</div>
  if (error) return <div style={{ color: 'var(--c--theme--colors--danger-500)' }}>Error: {String(error)}</div>

  return (
    <div>
      <h1>Sessions</h1>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <Button
          size="small"
          color={activeFilter === undefined ? 'brand' : 'neutral'}
          onClick={() => setActiveFilter(undefined)}
        >
          All
        </Button>
        <Button
          size="small"
          color={activeFilter === true ? 'brand' : 'neutral'}
          onClick={() => setActiveFilter(true)}
        >
          Active
        </Button>
        <Button
          size="small"
          color={activeFilter === false ? 'brand' : 'neutral'}
          onClick={() => setActiveFilter(false)}
        >
          Inactive
        </Button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Session ID</th>
            <th>Identity</th>
            <th>Active</th>
            <th>AAL</th>
            <th>Authenticated</th>
            <th>Expires</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {(sessions ?? []).map((session) => (
            <tr key={session.id}>
              <td><code>{session.id.slice(0, 8)}...</code></td>
              <td>
                {session.identity_id ? (
                  <a href={`/identities/${session.identity_id}`}>
                    <code>{session.identity_id.slice(0, 8)}...</code>
                  </a>
                ) : (
                  '-'
                )}
              </td>
              <td>
                <span style={{ color: session.active ? 'var(--c--theme--colors--success-600)' : 'var(--sunbeam--text-muted)' }}>
                  {session.active ? 'Yes' : 'No'}
                </span>
              </td>
              <td>{session.authenticator_assurance_level}</td>
              <td>{new Date(session.authenticated_at).toLocaleString()}</td>
              <td>{new Date(session.expires_at).toLocaleString()}</td>
              <td style={{ display: 'flex', gap: '0.25rem' }}>
                <Button
                  size="small"
                  color="neutral"
                  onClick={() => extendSession.mutate(session.id)}
                  disabled={!session.active}
                >
                  Extend
                </Button>
                <Button
                  size="small"
                  color="error"
                  onClick={() => setConfirmRevoke(session.id)}
                  disabled={!session.active}
                >
                  Revoke
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {(sessions ?? []).length === 0 && (
        <p style={{ color: 'var(--sunbeam--text-secondary)', textAlign: 'center', marginTop: '2rem' }}>No sessions found.</p>
      )}

      <ConfirmModal
        isOpen={!!confirmRevoke}
        title="Revoke Session"
        message="Are you sure you want to revoke this session? The user will be logged out."
        confirmLabel="Revoke"
        confirmColor="error"
        onConfirm={async () => {
          if (confirmRevoke) await revokeSession.mutateAsync(confirmRevoke)
          setConfirmRevoke(null)
        }}
        onCancel={() => setConfirmRevoke(null)}
      />
    </div>
  )
}
