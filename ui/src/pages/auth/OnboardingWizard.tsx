import { useState } from 'react'
import { Button, Input } from '@gouvfr-lasuite/cunningham-react'
import FlowForm from '../../components/FlowNodes/FlowForm'
import { useFlow } from '../../api/flows'

type Step = 'password' | 'totp' | 'done'

const STEP_LABELS: Record<Step, string> = {
  password: 'Set password',
  totp: 'Authenticator app',
  done: 'Ready',
}

const STEPS: Step[] = ['password', 'totp', 'done']

export default function OnboardingWizard() {
  const [step, setStep] = useState<Step>('password')
  const stepIndex = STEPS.indexOf(step)

  return (
    <div>
      <h2 style={{ marginTop: 0, marginBottom: '0.25rem', textAlign: 'center' }}>
        Account setup
      </h2>
      <p style={{
        textAlign: 'center',
        color: 'var(--sunbeam--text-secondary)',
        fontSize: '0.875rem',
        marginBottom: '1.5rem',
      }}>
        Step {stepIndex + 1} of {STEPS.length}: {STEP_LABELS[step]}
      </p>

      <StepIndicator current={stepIndex} total={STEPS.length} />

      {step === 'password' && (
        <PasswordStep onComplete={() => setStep('totp')} />
      )}
      {step === 'totp' && (
        <TotpStep onComplete={() => setStep('done')} />
      )}
      {step === 'done' && <DoneStep />}
    </div>
  )
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div style={{
      display: 'flex',
      gap: '0.5rem',
      marginBottom: '1.5rem',
    }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            backgroundColor: i <= current
              ? 'var(--c--theme--colors--primary-500)'
              : 'var(--sunbeam--border)',
            transition: 'background-color 0.2s',
          }}
        />
      ))}
    </div>
  )
}

function PasswordStep({ onComplete }: { onComplete: () => void }) {
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
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
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
          onComplete()
        }
      } else {
        throw new Error('Failed to set password')
      }
    } catch (err) {
      setMessage({ type: 'error', text: String(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <p style={{ margin: 0, color: 'var(--sunbeam--text-secondary)', fontSize: '0.875rem' }}>
        Choose a strong password for your account.
      </p>

      {message && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: 8,
          backgroundColor: message.type === 'error'
            ? 'var(--c--theme--colors--danger-50)'
            : 'var(--c--theme--colors--success-50)',
          border: `1px solid ${message.type === 'error'
            ? 'var(--c--theme--colors--danger-200)'
            : 'var(--c--theme--colors--success-200)'}`,
          color: message.type === 'error'
            ? 'var(--c--theme--colors--danger-800)'
            : 'var(--c--theme--colors--success-800)',
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
      <Button color="brand" onClick={handleSubmit} disabled={saving || !password || mismatch} fullWidth>
        {saving ? 'Setting password...' : 'Set password & continue'}
      </Button>
    </div>
  )
}

function TotpStep({ onComplete }: { onComplete: () => void }) {
  const [flowId, setFlowId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [started, setStarted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        setStarted(true)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const handleTotpSubmit = async (action: string, formData: FormData) => {
    setSubmitting(true)
    setError(null)
    try {
      // Submit button name/value isn't captured by FormData — add it explicitly
      formData.set('method', 'totp')
      const resp = await fetch(action, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        credentials: 'include',
        body: new URLSearchParams(formData as unknown as Record<string, string>),
      })
      const result = await resp.json()
      const errMsg = result.ui?.messages?.find((m: { type: string }) => m.type === 'error')
      if (errMsg) {
        setError(errMsg.text)
      } else {
        // Verify TOTP was actually set up
        const sessionResp = await fetch('/api/auth/session')
        if (sessionResp.ok) {
          const data = await sessionResp.json()
          if (!data.needs2faSetup) {
            onComplete()
            return
          }
        }
        // If still needs setup, refresh the flow to show updated state
        startFlow()
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (!started) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <p style={{ margin: 0, color: 'var(--sunbeam--text-secondary)', fontSize: '0.875rem' }}>
          Two-factor authentication is required. You'll need an authenticator
          app like Google Authenticator, 1Password, or Authy.
        </p>
        <Button color="brand" onClick={startFlow} disabled={loading} fullWidth>
          {loading ? 'Loading...' : 'Set up authenticator app'}
        </Button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <p style={{ margin: 0, color: 'var(--sunbeam--text-secondary)', fontSize: '0.875rem' }}>
        Scan the QR code with your authenticator app, then enter the code below.
      </p>
      {error && (
        <div style={{
          padding: '0.75rem 1rem', borderRadius: 8,
          backgroundColor: 'var(--c--theme--colors--danger-50)',
          border: '1px solid var(--c--theme--colors--danger-200)',
          color: 'var(--c--theme--colors--danger-800)',
          fontSize: '0.875rem',
        }}>{error}</div>
      )}
      {flowId && <TotpFlow flowId={flowId} onSubmit={handleTotpSubmit} disabled={submitting} />}
    </div>
  )
}

function TotpFlow({ flowId, onSubmit, disabled }: {
  flowId: string
  onSubmit: (action: string, data: FormData) => void
  disabled?: boolean
}) {
  const { data: flow, isLoading, error } = useFlow('settings', flowId)

  if (isLoading) return <div>Loading...</div>
  if (error) return <div style={{ color: 'var(--c--theme--colors--danger-500)' }}>Error: {String(error)}</div>
  if (!flow) return null

  return (
    <div style={{ opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
      <FlowForm ui={flow.ui} only="totp" onSubmit={onSubmit} />
    </div>
  )
}

function DoneStep() {
  const returnTo = sessionStorage.getItem('onboarding_return_to') || '/profile'

  const handleContinue = () => {
    sessionStorage.removeItem('onboarding_return_to')
    window.location.replace(returnTo)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'center' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>&#10003;</div>
      <p style={{ margin: 0, fontSize: '1rem', fontWeight: 500 }}>
        You're all set!
      </p>
      <p style={{ margin: 0, color: 'var(--sunbeam--text-secondary)', fontSize: '0.875rem' }}>
        Your account is secured with a password and two-factor authentication.
      </p>
      <Button color="brand" onClick={handleContinue} fullWidth>
        Continue
      </Button>
    </div>
  )
}
