import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Input, Checkbox } from '@gouvfr-lasuite/cunningham-react'
import { useIdentities, useDeleteIdentity, useGenerateRecoveryLink, useGenerateRecoveryCode, useDeleteAllIdentitySessions } from '../../api/identities'
import ConfirmModal from '../../components/ConfirmModal'

export default function IdentitiesPage() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [recoveryResult, setRecoveryResult] = useState<{ link?: string; code?: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)

  const { data: identities, isLoading, error } = useIdentities(
    debouncedSearch ? { credentials_identifier: debouncedSearch } : { page_size: 50 }
  )
  const deleteIdentity = useDeleteIdentity()
  const generateLink = useGenerateRecoveryLink()
  const generateCode = useGenerateRecoveryCode()
  const deleteAllSessions = useDeleteAllIdentitySessions()

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    clearTimeout((window as unknown as { _searchTimer?: number })._searchTimer)
    ;(window as unknown as { _searchTimer?: number })._searchTimer = window.setTimeout(
      () => setDebouncedSearch(e.target.value),
      300
    )
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  const handleBulkDelete = async () => {
    for (const id of selected) await deleteIdentity.mutateAsync(id)
    setSelected(new Set())
    setConfirmBulkDelete(false)
  }

  const handleRecoveryLink = async (id: string) => {
    const r = await generateLink.mutateAsync({ identity_id: id })
    setRecoveryResult({ link: r.recovery_link })
  }

  const handleRecoveryCode = async (id: string) => {
    const r = await generateCode.mutateAsync({ identity_id: id })
    setRecoveryResult({ link: r.recovery_link, code: r.recovery_code })
  }

  if (isLoading) return <div>Loading identities...</div>
  if (error) return <div style={{ color: 'var(--c--theme--colors--danger-500)' }}>Error: {String(error)}</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1>Identities</h1>
        <Link to="/identities/create">
          <Button color="brand" size="small">+ Create Identity</Button>
        </Link>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <Input
            label="Search by email"
            value={search}
            onChange={handleSearch}
          />
        </div>
        {selected.size > 0 && (
          <Button color="error" size="small" onClick={() => setConfirmBulkDelete(true)}>
            Delete {selected.size} selected
          </Button>
        )}
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

      <table>
        <thead>
          <tr>
            <th style={{ width: '2rem' }}></th>
            <th>Email</th>
            <th>Schema</th>
            <th>State</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {(identities ?? []).map((identity) => {
            const email = (identity.traits as { email?: string })?.email ?? identity.id.slice(0, 8)
            return (
              <tr key={identity.id}>
                <td>
                  <Checkbox
                    aria-label="Select identity"
                    checked={selected.has(identity.id)}
                    onChange={() => toggleSelect(identity.id)}
                  />
                </td>
                <td>
                  <Link to={`/identities/${identity.id}`}>{email}</Link>
                </td>
                <td>{identity.schema_id}</td>
                <td>
                  <span style={{ color: identity.state === 'active' ? 'var(--c--theme--colors--success-600)' : 'var(--sunbeam--text-muted)' }}>
                    {identity.state}
                  </span>
                </td>
                <td style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                  <Link to={`/identities/${identity.id}`}>
                    <Button color="neutral" size="small">View</Button>
                  </Link>
                  <Link to={`/identities/${identity.id}/edit`}>
                    <Button color="neutral" size="small">Edit</Button>
                  </Link>
                  <Button color="neutral" size="small" onClick={() => handleRecoveryLink(identity.id)}>Link</Button>
                  <Button color="neutral" size="small" onClick={() => handleRecoveryCode(identity.id)}>Code</Button>
                  <Button color="neutral" size="small" onClick={() => deleteAllSessions.mutateAsync(identity.id)}>Revoke Sessions</Button>
                  <Button color="error" size="small" onClick={() => setConfirmDelete(identity.id)}>Delete</Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <ConfirmModal
        isOpen={!!confirmDelete}
        title="Delete Identity"
        message="Are you sure you want to delete this identity? This cannot be undone."
        confirmLabel="Delete"
        confirmColor="error"
        onConfirm={async () => {
          if (confirmDelete) await deleteIdentity.mutateAsync(confirmDelete)
          setConfirmDelete(null)
        }}
        onCancel={() => setConfirmDelete(null)}
      />

      <ConfirmModal
        isOpen={confirmBulkDelete}
        title="Bulk Delete"
        message={`Delete ${selected.size} identities? This cannot be undone.`}
        confirmLabel="Delete All"
        confirmColor="error"
        onConfirm={handleBulkDelete}
        onCancel={() => setConfirmBulkDelete(false)}
      />
    </div>
  )
}
