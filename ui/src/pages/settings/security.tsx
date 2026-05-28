import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Input } from '@gouvfr-lasuite/cunningham-react'
import { useFlow } from '../../api/flows'
import { useSessionStore } from '../../stores/session'
import FlowForm from '../../components/FlowNodes/FlowForm'

export default function SecurityPage() {
  const [params] = useSearchParams()
  const flowId = params.get('flow')
  const { needs2faSetup } = useSessionStore()

  // New users arriving from recovery flow: redirect to onboarding wizard
  if (needs2faSetup) {
    window.location.href = '/onboarding'
    return <div>Redirecting to account setup...</div>
  }

  // If redirected back from Kratos with a flow param, show the result
  if (flowId) {
    return (
      <div style={{ maxWidth: '640px' }}>
        <h1 style={{ marginTop: 0 }}>Security</h1>
        <SettingsFlow flowId={flowId} exclude={['profile']} />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '640px' }}>
      <h1 style={{ marginTop: 0 }}>Security</h1>

      {needs2faSetup && (
        <div style={{
          padding: '1rem',
          borderRadius: 8,
          marginBottom: '1.5rem',
          backgroundColor: 'var(--c--theme--colors--warning-100, #FFF3CD)',
          border: '1px solid var(--c--theme--colors--warning-300, #FFDA6A)',
          color: 'var(--c--theme--colors--warning-900, #664D03)',
          fontSize: '0.875rem',
          fontWeight: 500,
        }}>
          You must set up two-factor authentication before you can use this app.
          Configure an authenticator app or security key below.
        </div>
      )}

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.125rem' }}>Password</h2>
        <PasswordSection />
      </section>

      <section>
        <h2 style={{ fontSize: '1.125rem' }}>Two-Factor Authentication</h2>
        <p style={{ color: 'var(--sunbeam--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          Add a second layer of security to your account using an authenticator app, security key, or backup codes.
        </p>
        <MfaSection method="totp" title="Authenticator App" description="Use an app like Google Authenticator or 1Password to generate one-time codes." />
        <MfaSection method="webauthn" title="Security Key" description="Use a hardware security key, fingerprint, or Face ID." />
        <MfaSection method="lookup_secret" title="Backup Codes" description="Generate one-time recovery codes in case you lose access to your other methods." />
      </section>
    </div>
  )
}

function PasswordSection() {
  const [expanded, setExpanded] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const mismatch = confirm.length > 0 && password !== confirm

  const handleSubmit = async () => {
    if (!password || password !== confirm) return
    setSaving(true)
    setMessage(null)
    try {
      const flowResp = await fetch('/kratos/self-service/settings/browser', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })
      if (!flowResp.ok) throw new Error('Failed to create settings flow')
      const flow = await flowResp.json()

      const csrfToken = flow.ui.nodes.find(
        (n: { attributes: { name: string } }) => n.attributes.name === 'csrf_token'
      )?.attributes?.value ?? ''

      const submitResp = await fetch(flow.ui.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        credentials: 'include',
        body: new URLSearchParams({
          csrf_token: csrfToken,
          method: 'password',
          password,
        }),
      })

      if (submitResp.ok || submitResp.status === 422) {
        const result = await submitResp.json()
        const errorMsg = result.ui?.messages?.find((m: { type: string }) => m.type === 'error')
        if (errorMsg) {
          setMessage({ type: 'error', text: errorMsg.text })
        } else {
          setMessage({ type: 'success', text: 'Password changed successfully.' })
          setPassword('')
          setConfirm('')
          setExpanded(false)
        }
      } else {
        throw new Error('Failed to change password')
      }
    } catch (err) {
      setMessage({ type: 'error', text: String(err) })
    } finally {
      setSaving(false)
    }
  }

  if (!expanded) {
    return (
      <>
        {message && (
          <div style={{
            padding: '0.75rem 1rem',
            borderRadius: 8,
            marginBottom: '0.75rem',
            backgroundColor: message.type === 'success' ? 'var(--c--theme--colors--success-50)' : 'var(--c--theme--colors--danger-50)',
            border: `1px solid ${message.type === 'success' ? 'var(--c--theme--colors--success-200)' : 'var(--c--theme--colors--danger-200)'}`,
            color: message.type === 'success' ? 'var(--c--theme--colors--success-800)' : 'var(--c--theme--colors--danger-800)',
            fontSize: '0.875rem',
          }}>
            {message.text}
          </div>
        )}
        <Button color="brand" onClick={() => setExpanded(true)}>
          Change password
        </Button>
      </>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {message && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: 8,
          backgroundColor: message.type === 'success' ? 'var(--c--theme--colors--success-50)' : 'var(--c--theme--colors--danger-50)',
          border: `1px solid ${message.type === 'success' ? 'var(--c--theme--colors--success-200)' : 'var(--c--theme--colors--danger-200)'}`,
          color: message.type === 'success' ? 'var(--c--theme--colors--success-800)' : 'var(--c--theme--colors--danger-800)',
          fontSize: '0.875rem',
        }}>
          {message.text}
        </div>
      )}
      <Input
        label="New password"
        type="password"
        value={password}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
        fullWidth
      />
      <Input
        label="Confirm password"
        type="password"
        value={confirm}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirm(e.target.value)}
        state={mismatch ? 'error' : undefined}
        text={mismatch ? 'Passwords do not match' : undefined}
        fullWidth
      />
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <Button color="brand" onClick={handleSubmit} disabled={saving || !password || mismatch}>
          {saving ? 'Saving...' : 'Update password'}
        </Button>
        <Button color="neutral" onClick={() => { setExpanded(false); setPassword(''); setConfirm('') }}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

function MfaSection({ method, title, description }: { method: string; title: string; description: string }) {
  const [flowId, setFlowId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const startFlow = async () => {
    setLoading(true)
    try {
      const resp = await fetch('/kratos/self-service/settings/browser', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })
      if (resp.ok) {
        const flow = await resp.json()
        setFlowId(flow.id)
        setExpanded(true)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      border: '1px solid var(--sunbeam--border)',
      borderRadius: 8,
      padding: '1rem',
      marginBottom: '0.75rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 500, fontSize: '0.9375rem' }}>{title}</div>
          <div style={{ color: 'var(--sunbeam--text-secondary)', fontSize: '0.8125rem', marginTop: 2 }}>
            {description}
          </div>
        </div>
        {!expanded && (
          <Button color="brand" size="small" onClick={startFlow} disabled={loading}>
            {loading ? 'Loading...' : 'Configure'}
          </Button>
        )}
      </div>
      {expanded && flowId && (
        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--sunbeam--border)', paddingTop: '1rem' }}>
          <SettingsFlow flowId={flowId} only={method} />
        </div>
      )}
    </div>
  )
}

function SettingsFlow({ flowId, only, exclude }: { flowId: string; only?: string; exclude?: string[] }) {
  const { data: flow, isLoading, error } = useFlow('settings', flowId)

  if (isLoading) return <div>Loading...</div>
  if (error) return <div style={{ color: 'var(--c--theme--colors--danger-500)' }}>Error: {String(error)}</div>
  if (!flow) return null

  return <FlowForm ui={flow.ui} only={only} exclude={exclude} />
}
