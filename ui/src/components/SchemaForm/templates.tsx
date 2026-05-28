import type { ObjectFieldTemplateProps, ArrayFieldTemplateProps } from '@rjsf/utils'
import { Button } from '@gouvfr-lasuite/cunningham-react'

export function ObjectFieldTemplate({ title, properties, description }: ObjectFieldTemplateProps) {
  return (
    <fieldset style={{ border: '1px solid var(--c--theme--colors--greyscale-200)', borderRadius: '4px', padding: '1rem', marginBottom: '1rem' }}>
      {title && <legend style={{ fontWeight: 600, padding: '0 0.5rem' }}>{title}</legend>}
      {description && <p style={{ color: 'var(--c--theme--colors--greyscale-600)', marginBottom: '0.5rem' }}>{description}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {properties.map((prop) => prop.content)}
      </div>
    </fieldset>
  )
}

// In rjsf v6, items are pre-rendered ReactElements (each rendered by ArrayFieldItemTemplate,
// which handles its own remove/reorder buttons). ArrayFieldTemplate just provides the layout.
export function ArrayFieldTemplate({ title, items, canAdd, onAddClick }: ArrayFieldTemplateProps) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      {title && <h4 style={{ marginBottom: '0.5rem' }}>{title}</h4>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {items}
      </div>
      {canAdd && (
        <div style={{ marginTop: '0.5rem' }}>
          <Button color="neutral" size="small" onClick={onAddClick}>+ Add item</Button>
        </div>
      )}
    </div>
  )
}
