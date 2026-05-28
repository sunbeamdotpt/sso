import { useParams, Link, useNavigate } from 'react-router-dom'
import { Button } from '@gouvfr-lasuite/cunningham-react'
import { useIdentity, useIdentitySessions, useDeleteIdentity, useDeleteAllIdentitySessions, useGenerateRecoveryLink, useGenerateRecoveryCode } from '../../api/identities'
import { useState } from 'react'
import ConfirmModal from '../../components/ConfirmModal'

export default function IdentityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: identity, isLoading, error } = useIdentity(id!)
  const { data: sessions } = useIdentitySessions(id!)
  const deleteIdentity = useDeleteIdentity()
  const deleteAllSessions = useDeleteAllIdentitySessions()
  const generateLink = useGenerateRecoveryLink()
  const generateCode = useGenerateRecoveryCode()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [recoveryResult, setRecoveryResult] = useState<{ link?: string; code?: string } | null>(null)

  if (isLoading) return <div>Loading identity...</div>
  if (error) return <div style={{ color: 'var(--c--theme--colors--danger-500)' }}>Error: {String(error)}</div>
  if (!identity) return <div>Identity not found.</div>

  const handleDelete = async () => {
    await deleteIdentity.mutateAsync(identity.id)
    navigate('/identities')
  }

  const handleRecoveryLink = async () => {
    const r = await generateLink.mutateAsync({ identity_id: identity.id })
    setRecoveryResult({ link: r.recovery_link })
  }

  const handleRecoveryCode = async () => {
    const r = await generateCode.mutateAsync({ identity_id: identity.id })
    setRecoveryResult({ link: r.recovery_link, code: r.recovery_code })
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1>Identity Detail</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link to={`/identities/${identity.id}/edit`}>
            <Button color="neutral" size="small">Edit</Button>
          </Link>
          <Button color="neutral" size="small" onClick={handleRecoveryLink}>Recovery Link</Button>
          <Button color="neutral" size="small" onClick={handleRecoveryCode}>Recovery Code</Button>
          <Button color="neutral" size="small" onClick={() => deleteAllSessions.mutateAsync(identity.id)}>Revoke All Sessions</Button>
          <Button color="error" size="small" onClick={() => setConfirmDelete(true)}>Delete</Button>
        </div>
      </div>

      {recoveryResult && (
        <div style={{
          background: 'var(--c--theme--colors--info-50)',
          border: '1px solid var(--c--theme--colors--info-300)',
          borderRadius: 8,
          padding: '1rem',
          marginBottom: '1rem',
        }}>
          <strong>Recovery:</strong>
          {recoveryResult.code && <div>Code: <code>{recoveryResult.code}</code></div>}
          {recoveryResult.link && <div>Link: <a href={recoveryResult.link} target="_blank" rel="noreferrer">{recoveryResult.link}</a></div>}
          <div style={{ marginTop: '0.5rem' }}>
            <Button color="neutral" size="small" onClick={() => setRecoveryResult(null)}>Close</Button>
          </div>
        </div>
      )}

      <table style={{ marginBottom: '1.5rem' }}>
        <tbody>
          <tr>
            <td style={{ fontWeight: 600 }}>ID</td>
            <td><code>{identity.id}</code></td>
          </tr>
          <tr>
            <td style={{ fontWeight: 600 }}>Schema</td>
            <td>{identity.schema_id}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 600 }}>State</td>
            <td>
              <span style={{ color: identity.state === 'active' ? 'var(--c--theme--colors--success-600)' : 'var(--sunbeam--text-muted)' }}>
                {identity.state}
              </span>
            </td>
          </tr>
          <tr>
            <td style={{ fontWeight: 600 }}>Created</td>
            <td>{new Date(identity.created_at).toLocaleString()}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 600 }}>Updated</td>
            <td>{new Date(identity.updated_at).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <h2>Traits</h2>
      <pre>{JSON.stringify(identity.traits, null, 2)}</pre>

      {identity.metadata_public && (
        <>
          <h2>Public Metadata</h2>
          <pre>{JSON.stringify(identity.metadata_public, null, 2)}</pre>
        </>
      )}

      {identity.metadata_admin && (
        <>
          <h2>Admin Metadata</h2>
          <pre>{JSON.stringify(identity.metadata_admin, null, 2)}</pre>
        </>
      )}

      {identity.credentials && (
        <>
          <h2>Credentials</h2>
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(identity.credentials).map(([key, cred]) => (
                <tr key={key}>
                  <td>{cred.type}</td>
                  <td>{new Date(cred.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2>Sessions</h2>
      {sessions && sessions.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Active</th>
              <th>AAL</th>
              <th>Authenticated</th>
              <th>Expires</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td><code>{s.id.slice(0, 8)}...</code></td>
                <td>{s.active ? 'Yes' : 'No'}</td>
                <td>{s.authenticator_assurance_level}</td>
                <td>{new Date(s.authenticated_at).toLocaleString()}</td>
                <td>{new Date(s.expires_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ color: 'var(--sunbeam--text-secondary)' }}>No active sessions.</p>
      )}

      <ConfirmModal
        isOpen={confirmDelete}
        title="Delete Identity"
        message="Are you sure you want to delete this identity? This cannot be undone."
        confirmLabel="Delete"
        confirmColor="error"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
