import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Select } from '@gouvfr-lasuite/cunningham-react'
import { useIdentity, useUpdateIdentity } from '../../api/identities'
import { useSchema } from '../../api/schemas'
import SchemaForm from '../../components/SchemaForm'
import type { RJSFSchema } from '@rjsf/utils'

export default function IdentityEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: identity, isLoading } = useIdentity(id!)
  const updateIdentity = useUpdateIdentity(id!)
  const { data: fetchedSchema } = useSchema(identity?.schema_id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<string | null>(null)

  if (isLoading) return <div>Loading identity...</div>
  if (!identity) return <div>Identity not found.</div>

  const traitsSchema = fetchedSchema as RJSFSchema | undefined
  const currentState = state ?? identity.state

  const stateOptions = [
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' },
  ]

  const handleSubmit = async (traits: unknown) => {
    setError(null)
    try {
      await updateIdentity.mutateAsync({
        schema_id: identity.schema_id,
        traits: traits as Record<string, unknown>,
        state: currentState as 'active' | 'inactive',
      })
      navigate(`/identities/${id}`)
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <div>
      <h1>Edit Identity</h1>
      <p style={{ color: 'var(--sunbeam--text-secondary)', marginBottom: '1rem' }}>
        Schema: {identity.schema_id} | ID: <code>{identity.id}</code>
      </p>

      <div style={{ marginBottom: '1rem' }}>
        <Select
          label="State"
          options={stateOptions}
          value={currentState}
          onChange={(e) => setState(e.target.value as string)}
        />
      </div>

      {error && (
        <div style={{ color: 'var(--c--theme--colors--danger-500)', marginBottom: '1rem' }}>{error}</div>
      )}

      {traitsSchema ? (
        <SchemaForm
          schema={traitsSchema}
          formData={identity.traits}
          onSubmit={handleSubmit}
          disabled={updateIdentity.isPending}
        >
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <Button type="submit" color="brand" disabled={updateIdentity.isPending}>
              {updateIdentity.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button type="button" color="neutral" onClick={() => navigate(`/identities/${id}`)}>Cancel</Button>
          </div>
        </SchemaForm>
      ) : (
        <div>
          <h2>Traits (raw JSON)</h2>
          <pre>{JSON.stringify(identity.traits, null, 2)}</pre>
          <p style={{ color: 'var(--sunbeam--text-secondary)' }}>Schema not available for form editing.</p>
          <Button color="neutral" onClick={() => navigate(`/identities/${id}`)}>Back</Button>
        </div>
      )}
    </div>
  )
}
