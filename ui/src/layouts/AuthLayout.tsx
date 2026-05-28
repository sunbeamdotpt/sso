import { Outlet } from 'react-router-dom'

export default function AuthLayout() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--sunbeam--bg-page)',
      padding: '2rem',
    }}>
      <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        <h1 style={{
          margin: 0,
          fontSize: '1.5rem',
          fontWeight: 600,
          letterSpacing: '-0.01em',
          color: 'var(--sunbeam--text-primary)',
        }}>Sunbeam Studios</h1>
      </div>
      <div style={{
        width: '100%',
        maxWidth: 420,
        backgroundColor: 'var(--sunbeam--bg-surface)',
        borderRadius: 12,
        padding: '2rem',
        border: '1px solid var(--sunbeam--border)',
      }}>
        <Outlet />
      </div>
    </div>
  )
}
