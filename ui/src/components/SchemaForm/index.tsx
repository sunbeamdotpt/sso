import Form from '@rjsf/core'
import validator from '@rjsf/validator-ajv8'
import type { RJSFSchema, UiSchema, ErrorSchema } from '@rjsf/utils'
import { CunninghamWidgets } from './widgets'
import { ObjectFieldTemplate, ArrayFieldTemplate } from './templates'

interface SchemaFormProps {
  schema: RJSFSchema
  uiSchema?: UiSchema
  formData?: unknown
  onSubmit: (data: unknown) => void
  onError?: (errors: unknown) => void
  extraErrors?: ErrorSchema<unknown>
  disabled?: boolean
  children?: React.ReactNode
}

export default function SchemaForm({
  schema,
  uiSchema,
  formData,
  onSubmit,
  onError,
  extraErrors,
  disabled,
  children,
}: SchemaFormProps) {
  return (
    <Form
      schema={schema}
      uiSchema={uiSchema}
      formData={formData}
      validator={validator}
      widgets={CunninghamWidgets}
      templates={{ ObjectFieldTemplate, ArrayFieldTemplate }}
      extraErrors={extraErrors}
      disabled={disabled}
      onSubmit={({ formData }) => onSubmit(formData)}
      onError={onError}
    >
      {children}
    </Form>
  )
}
