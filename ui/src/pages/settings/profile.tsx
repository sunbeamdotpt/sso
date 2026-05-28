import { useState, useEffect } from 'react'
import { Input, Button } from '@gouvfr-lasuite/cunningham-react'
import { useSessionStore } from '../../stores/session'
import AvatarUpload from '../../components/AvatarUpload'

export default function ProfilePage() {
  const { session, fetchSession } = useSessionStore()

  if (!session) return <div>Loading...</div>

  const identity = session.identity
  const traits = (identity?.traits ?? {}) as Record<string, string>
  const isEmployee = identity?.schema_id === 'employee'

  return (
    <div style={{ maxWidth: '640px' }}>
      <h1 style={{ marginTop: 0 }}>Profile</h1>

      <AvatarUpload
        identityId={identity.id}
        picture={traits.picture}
        name={traits.given_name ?? traits.email}
        onUploaded={fetchSession}
      />

      <ProfileForm traits={traits} isEmployee={isEmployee} />
    </div>
  )
}

function ProfileForm({
  traits,
  isEmployee,
}: {
  traits: Record<string, string>
  isEmployee: boolean
}) {
  const [values, setValues] = useState(traits)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    setValues(traits)
  }, [traits])

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const flowResp = await fetch('/kratos/self-service/settings/browser', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })
      if (!flowResp.ok) throw new Error('Failed to create settings flow')
      const flow = await flowResp.json()

      const submitResp = await fetch(flow.ui.action, {
        method: flow.ui.method,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        credentials: 'include',
        body: new URLSearchParams({
          'csrf_token': flow.ui.nodes.find(
            (n: { attributes: { name: string } }) => n.attributes.name === 'csrf_token'
          )?.attributes?.value ?? '',
          method: 'profile',
          'traits.email': traits.email ?? '',
          'traits.given_name': values.given_name ?? '',
          'traits.family_name': values.family_name ?? '',
          'traits.nickname': values.nickname ?? '',
          // Preserve picture trait so avatar isn't cleared on save
          ...(traits.picture ? { 'traits.picture': traits.picture } : {}),
          ...(isEmployee ? {
            'traits.middle_name': values.middle_name ?? '',
            'traits.phone_number': values.phone_number ?? '',
            // Admin-managed fields: pass original values so Kratos doesn't clear them
            'traits.job_title': traits.job_title ?? '',
            'traits.department': traits.department ?? '',
            'traits.office_location': traits.office_location ?? '',
            'traits.employee_id': traits.employee_id ?? '',
            'traits.hire_date': traits.hire_date ?? '',
            'traits.manager': traits.manager ?? '',
          } : {}),
        }),
      })

      if (submitResp.ok || submitResp.status === 422) {
        setMessage({ type: 'success', text: 'Profile updated successfully.' })
        useSessionStore.getState().fetchSession()
      } else {
        throw new Error('Failed to update profile')
      }
    } catch (err) {
      setMessage({ type: 'error', text: String(err) })
    } finally {
      setSaving(false)
    }
  }

  const update = (key: string, value: string) => {
    setValues((v) => ({ ...v, [key]: value }))
  }

  return (
    <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
        label="Email"
        value={values.email ?? ''}
        disabled
        type="email"
        fullWidth
      />

      <div style={{ display: 'flex', gap: '1rem' }}>
        <Input
          label="First name"
          value={values.given_name ?? ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('given_name', e.target.value)}
          fullWidth
        />
        <Input
          label="Last name"
          value={values.family_name ?? ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('family_name', e.target.value)}
          fullWidth
        />
      </div>

      {isEmployee && (
        <Input
          label="Middle name"
          value={values.middle_name ?? ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('middle_name', e.target.value)}
          fullWidth
        />
      )}

      <Input
        label="Nickname"
        value={values.nickname ?? ''}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('nickname', e.target.value)}
        fullWidth
      />

      {isEmployee && (
        <Input
          label="Phone number"
          value={values.phone_number ?? ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('phone_number', e.target.value)}
          fullWidth
        />
      )}

      <div>
        <Button color="brand" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save profile'}
        </Button>
      </div>

      {isEmployee && (
        <>
          <div style={{
            marginTop: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--sunbeam--border)',
          }}>
            <h3 style={{ margin: '0 0 0.25rem', fontSize: '0.9375rem' }}>Organization</h3>
            <p style={{ margin: '0 0 1rem', color: 'var(--sunbeam--text-secondary)', fontSize: '0.8125rem' }}>
              These fields are managed by an administrator.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <Input label="Job title" value={traits.job_title ?? ''} disabled fullWidth />
                <Input label="Department" value={traits.department ?? ''} disabled fullWidth />
              </div>
              <Input label="Office location" value={traits.office_location ?? ''} disabled fullWidth />
              <div style={{ display: 'flex', gap: '1rem' }}>
                <Input label="Employee ID" value={traits.employee_id ?? ''} disabled fullWidth />
                <Input label="Hire date" value={traits.hire_date ?? ''} disabled fullWidth />
              </div>
              <Input label="Manager" value={traits.manager ?? ''} disabled fullWidth />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
