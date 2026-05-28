import { useRef, useEffect } from 'react'
import { Input, Button, Checkbox } from '@gouvfr-lasuite/cunningham-react'
import type { FlowNode } from '../../api/flows'

interface Props {
  node: FlowNode
}

export default function NodeInput({ node }: Props) {
  const attrs = node.attributes as {
    name: string
    type: string
    value?: string
    required?: boolean
    disabled?: boolean
    label?: string
    onclick?: string
  }

  const label = node.meta?.label?.text ?? attrs.label ?? attrs.name
  const errorMsg = node.messages.find((m) => m.type === 'error')
  const infoMsg = node.messages.find((m) => m.type === 'info')

  if (attrs.type === 'hidden') {
    return <input type="hidden" name={attrs.name} value={attrs.value ?? ''} />
  }

  // WebAuthn and other interactive buttons with onclick handlers
  // Use a native button so Kratos-injected scripts can attach via onclick attribute
  if ((attrs.type === 'submit' || attrs.type === 'button') && attrs.onclick) {
    return <NativeOnclickButton node={node} />
  }

  if (attrs.type === 'submit' || attrs.type === 'button') {
    const isPrimary = node.group === 'password' || node.group === 'default'
    return (
      <>
        {errorMsg && (
          <div style={{ color: 'var(--c--theme--colors--danger-400)', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
            {errorMsg.text}
          </div>
        )}
        <Button
          type="submit"
          name={attrs.name}
          value={attrs.value}
          color={isPrimary ? 'brand' : 'neutral'}
          disabled={attrs.disabled}
          fullWidth
        >
          {label}
        </Button>
      </>
    )
  }

  if (attrs.type === 'checkbox') {
    return (
      <Checkbox
        label={label}
        name={attrs.name}
        defaultChecked={attrs.value === 'true'}
        disabled={attrs.disabled}
      />
    )
  }

  // Text, email, password, number, tel, etc.
  return (
    <Input
      label={label}
      name={attrs.name}
      type={attrs.type === 'password' ? 'password' : attrs.type === 'email' ? 'email' : 'text'}
      defaultValue={attrs.value ?? ''}
      required={attrs.required}
      disabled={attrs.disabled}
      state={errorMsg ? 'error' : undefined}
      text={errorMsg?.text ?? infoMsg?.text}
      fullWidth
    />
  )
}

// Renders a native <button> and sets the onclick attribute via the DOM
// so Kratos-injected scripts (WebAuthn) can trigger their ceremony handlers.
function NativeOnclickButton({ node }: Props) {
  const ref = useRef<HTMLButtonElement>(null)
  const attrs = node.attributes as {
    name: string
    type: string
    value?: string
    disabled?: boolean
    onclick?: string
  }
  const label = node.meta?.label?.text ?? attrs.name

  useEffect(() => {
    if (ref.current && attrs.onclick) {
      ref.current.setAttribute('onclick', attrs.onclick)
    }
  }, [attrs.onclick])

  return (
    <button
      ref={ref}
      type={attrs.type === 'button' ? 'button' : 'submit'}
      name={attrs.name}
      value={attrs.value}
      disabled={attrs.disabled}
      style={{
        width: '100%',
        padding: '0.625rem 1rem',
        borderRadius: 4,
        border: '1px solid var(--sunbeam--border)',
        backgroundColor: 'var(--sunbeam--bg-muted)',
        cursor: attrs.disabled ? 'not-allowed' : 'pointer',
        fontSize: '0.875rem',
        fontWeight: 500,
      }}
    >
      {label}
    </button>
  )
}
