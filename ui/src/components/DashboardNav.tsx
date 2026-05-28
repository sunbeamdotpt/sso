import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useSessionStore } from '../stores/session'
import { Button } from '@gouvfr-lasuite/cunningham-react'

interface HealthStatus {
  alive: boolean
  ready: boolean
}

const linkStyle: React.CSSProperties = {
  display: 'block',
  padding: '0.5rem 1rem',
  textDecoration: 'none',
  color: 'inherit',
  borderRadius: 4,
}

const activeLinkStyle: React.CSSProperties = {
  ...linkStyle,
  backgroundColor: 'var(--c--theme--colors--primary-100)',
  fontWeight: 600,
  color: 'var(--c--theme--colors--primary-700)',
}

export default function DashboardNav() {
  const { isAdmin, needs2faSetup, logout } = useSessionStore()
  const [health, setHealth] = useState<HealthStatus>({ alive: false, ready: false })

  useEffect(() => {
    const check = async () => {
      const [alive, ready] = await Promise.all([
        fetch('/api/health/alive').then((r) => r.ok).catch(() => false),
        fetch('/api/health/ready').then((r) => r.ok).catch(() => false),
      ])
      setHealth({ alive, ready })
    }

    check()
    const interval = setInterval(check, 30_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <nav style={{
      width: 220,
      borderRight: '1px solid var(--sunbeam--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '1rem 0',
    }}>
      <div style={{ padding: '0 1rem', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Sunbeam Studios</h2>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0 0.5rem' }}>
        {!needs2faSetup && (
          <NavLink
            to="/profile"
            style={({ isActive }) => (isActive ? activeLinkStyle : linkStyle)}
          >
            Profile
          </NavLink>
        )}
        <NavLink
          to="/security"
          style={({ isActive }) => (isActive ? activeLinkStyle : linkStyle)}
        >
          Security
        </NavLink>

        {isAdmin && !needs2faSetup && (
          <>
            <div style={{
              padding: '0.75rem 0.5rem 0.25rem',
              fontSize: '0.7rem',
              textTransform: 'uppercase',
              color: 'var(--sunbeam--text-muted)',
              fontWeight: 600,
              letterSpacing: '0.05em',
            }}>
              Administration
            </div>
            <NavLink to="/identities" style={({ isActive }) => (isActive ? activeLinkStyle : linkStyle)}>
              Identities
            </NavLink>
            <NavLink to="/sessions" style={({ isActive }) => (isActive ? activeLinkStyle : linkStyle)}>
              Sessions
            </NavLink>
            <NavLink to="/courier" style={({ isActive }) => (isActive ? activeLinkStyle : linkStyle)}>
              Courier
            </NavLink>
            <NavLink to="/schemas" style={({ isActive }) => (isActive ? activeLinkStyle : linkStyle)}>
              Schemas
            </NavLink>
          </>
        )}
      </div>

      <div style={{ padding: '0.5rem 1rem' }}>
        <Button color="brand" size="small" fullWidth onClick={logout}>
          Sign out
        </Button>
      </div>

      <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--sunbeam--border)', fontSize: '0.8rem', color: 'var(--sunbeam--text-secondary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            backgroundColor: health.alive ? 'var(--c--theme--colors--success-500)' : 'var(--c--theme--colors--danger-500)',
            display: 'inline-block',
          }} />
          Alive
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            backgroundColor: health.ready ? 'var(--c--theme--colors--success-500)' : 'var(--c--theme--colors--danger-500)',
            display: 'inline-block',
          }} />
          Ready
        </div>
      </div>
    </nav>
  )
}
