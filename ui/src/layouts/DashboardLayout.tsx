import { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useSessionStore } from '../stores/session'
import DashboardNav from '../components/DashboardNav'
import WaffleButton from '../components/WaffleButton'

export default function DashboardLayout() {
  const { session, isLoading, fetchSession } = useSessionStore()
  const navigate = useNavigate()

  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  useEffect(() => {
    if (!isLoading && !session) {
      navigate('/login', { replace: true })
    }
  }, [isLoading, session, navigate])

  if (isLoading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--sunbeam--text-secondary)',
      }}>
        Loading...
      </div>
    )
  }

  if (!session) return null

  const identity = session.identity
  const traits = (identity?.traits ?? {}) as Record<string, string>
  const fullName = [traits.given_name, traits.family_name].filter(Boolean).join(' ') || traits.email || ''

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <DashboardNav />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{
          padding: '0.75rem 1.5rem',
          borderBottom: '1px solid var(--sunbeam--border)',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <WaffleButton />
            <div style={{ width: 1, height: 24, backgroundColor: 'var(--sunbeam--border)' }} />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{fullName}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--sunbeam--text-secondary)' }}>{traits.email}</div>
            </div>
            {identity?.traits?.picture ? (
              <img
                src={`/api/avatar/${identity.id}`}
                alt=""
                style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: 'var(--sunbeam--avatar-bg)',
                color: 'var(--sunbeam--avatar-fg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}>
                {(fullName[0] ?? '?').toUpperCase()}
              </div>
            )}
          </div>
        </header>
        <main style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
