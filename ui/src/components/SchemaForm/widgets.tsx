import type { WidgetProps } from '@rjsf/utils'
import { Input, Select, Checkbox } from '@gouvfr-lasuite/cunningham-react'

function TextWidget({ id, value, onChange, label, required, disabled, rawErrors }: WidgetProps) {
  return (
    <Input
      label={label}
      id={id}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || undefined)}
      required={required}
      disabled={disabled}
      state={rawErrors?.length ? 'error' : 'default'}
      text={rawErrors?.[0]}
    />
  )
}

function EmailWidget({ id, value, onChange, label, required, disabled, rawErrors }: WidgetProps) {
  return (
    <Input
      type="email"
      label={label}
      id={id}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || undefined)}
      required={required}
      disabled={disabled}
      state={rawErrors?.length ? 'error' : 'default'}
      text={rawErrors?.[0]}
    />
  )
}

function SelectWidget({ value, onChange, label, disabled, options, rawErrors }: WidgetProps) {
  const selectOptions = (options.enumOptions ?? []).map((o) => ({
    label: String(o.label),
    value: String(o.value),
  }))
  return (
    <Select
      label={label}
      options={selectOptions}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      state={rawErrors?.length ? 'error' : 'default'}
      text={rawErrors?.[0]}
    />
  )
}

function CheckboxWidget({ value, onChange, label, disabled }: WidgetProps) {
  return (
    <Checkbox
      label={label}
      checked={!!value}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
    />
  )
}

function NumberWidget({ id, value, onChange, label, required, disabled, rawErrors }: WidgetProps) {
  return (
    <Input
      type="number"
      label={label}
      id={id}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      required={required}
      disabled={disabled}
      state={rawErrors?.length ? 'error' : 'default'}
      text={rawErrors?.[0]}
    />
  )
}

export const CunninghamWidgets = {
  TextWidget,
  EmailWidget,
  SelectWidget,
  CheckboxWidget,
  NumberWidget,
}
