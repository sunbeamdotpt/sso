import { useState } from 'react'
import { Button } from '@gouvfr-lasuite/cunningham-react'
import { useSchemas, useSchema } from '../../api/schemas'
import SchemaForm from '../../components/SchemaForm'
import type { RJSFSchema } from '@rjsf/utils'

export default function SchemasPage() {
  const { data: schemas, isLoading, error } = useSchemas()
  const [selectedId, setSelectedId] = useState('')
  const [viewMode, setViewMode] = useState<'json' | 'preview'>('json')
  const { data: schema } = useSchema(selectedId)

  if (isLoading) return <div>Loading schemas...</div>
  if (error) return <div style={{ color: 'var(--c--theme--colors--danger-500)' }}>Error: {String(error)}</div>

  const schemaTitle = (schema as Record<string, unknown>)?.title as string | undefined

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Identity Schemas</h1>

      <div style={{ display: 'flex', gap: '1.5rem' }}>
        <div style={{ width: 200, flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {(schemas ?? []).map((s) => (
              <Button
                key={s.id}
                size="small"
                color={selectedId === s.id ? 'brand' : 'neutral'}
                onClick={() => setSelectedId(s.id)}
                fullWidth
              >
                {s.id}
              </Button>
            ))}
          </div>
          {(schemas ?? []).length === 0 && (
            <p style={{ color: 'var(--sunbeam--text-secondary)', fontSize: '0.875rem' }}>No schemas found.</p>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {schema ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.125rem' }}>{selectedId}</h2>
                  {schemaTitle && (
                    <div style={{ color: 'var(--sunbeam--text-secondary)', fontSize: '0.8125rem', marginTop: 2 }}>
                      {schemaTitle}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button
                    size="small"
                    color={viewMode === 'json' ? 'brand' : 'neutral'}
                    onClick={() => setViewMode('json')}
                  >
                    JSON
                  </Button>
                  <Button
                    size="small"
                    color={viewMode === 'preview' ? 'brand' : 'neutral'}
                    onClick={() => setViewMode('preview')}
                  >
                    Form Preview
                  </Button>
                </div>
              </div>

              {viewMode === 'json' ? (
                <pre style={{ maxHeight: 600 }}>
                  {JSON.stringify(schema, null, 2)}
                </pre>
              ) : (
                <div style={{
                  border: '1px solid var(--sunbeam--border)',
                  borderRadius: 8,
                  padding: '1rem',
                }}>
                  <p style={{ color: 'var(--sunbeam--text-secondary)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                    Preview of the form generated from this schema. Submit is disabled.
                  </p>
                  <SchemaForm
                    schema={schema as RJSFSchema}
                    onSubmit={() => {}}
                    disabled
                  >
                    <Button type="submit" color="brand" size="small" disabled style={{ marginTop: '1rem' }}>
                      Submit (disabled)
                    </Button>
                  </SchemaForm>
                </div>
              )}
            </>
          ) : (
            <p style={{ color: 'var(--sunbeam--text-secondary)', marginTop: '2rem' }}>
              Select a schema to view its details.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
