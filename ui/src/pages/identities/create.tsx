import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Select } from '@gouvfr-lasuite/cunningham-react'
import { useSchemas, useSchema } from '../../api/schemas'
import { useCreateIdentity } from '../../api/identities'
import SchemaForm from '../../components/SchemaForm'
import type { RJSFSchema } from '@rjsf/utils'

export default function IdentityCreatePage() {
  const navigate = useNavigate()
  const { data: schemas, isLoading: schemasLoading } = useSchemas()
  const createIdentity = useCreateIdentity()
  const [selectedSchema, setSelectedSchema] = useState('')
  const [state, setState] = useState<'active' | 'inactive'>('active')
  const [error, setError] = useState<string | null>(null)

  const { data: fetchedSchema } = useSchema(selectedSchema)
  const traitsSchema = fetchedSchema as RJSFSchema | undefined

  const schemaOptions = (schemas ?? []).map((s) => ({ label: s.id, value: s.id }))
  const stateOptions = [
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' },
  ]

  const handleSubmit = async (traits: unknown) => {
    setError(null)
    try {
      const result = await createIdentity.mutateAsync({
        schema_id: selectedSchema,
        traits,
        state,
      })
      navigate(`/identities/${result.id}`)
    } catch (e) {
      setError(String(e))
    }
  }

  if (schemasLoading) return <div>Loading schemas...</div>

  return (
    <div>
      <h1>Create Identity</h1>

      <div style={{ marginBottom: '1rem' }}>
        <Select
          label="Schema"
          options={schemaOptions}
          value={selectedSchema}
          onChange={(e) => setSelectedSchema(e.target.value as string)}
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <Select
          label="State"
          options={stateOptions}
          value={state}
          onChange={(e) => setState(e.target.value as 'active' | 'inactive')}
        />
      </div>

      {error && (
        <div style={{ color: 'var(--c--theme--colors--danger-500)', marginBottom: '1rem' }}>{error}</div>
      )}

      {traitsSchema ? (
        <SchemaForm
          schema={traitsSchema}
          onSubmit={handleSubmit}
          disabled={createIdentity.isPending}
        >
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <Button type="submit" color="brand" disabled={createIdentity.isPending}>
              {createIdentity.isPending ? 'Creating...' : 'Create Identity'}
            </Button>
            <Button type="button" color="neutral" onClick={() => navigate('/identities')}>Cancel</Button>
          </div>
        </SchemaForm>
      ) : (
        selectedSchema && <div>Schema has no traits definition.</div>
      )}
    </div>
  )
}
