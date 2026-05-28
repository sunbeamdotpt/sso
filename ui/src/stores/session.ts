import { create } from 'zustand'

interface Identity {
  id: string
  schema_id: string
  traits: Record<string, unknown>
  state: string
  metadata_public?: Record<string, unknown>
}

interface Session {
  id: string
  active: boolean
  identity: Identity
  authenticated_at: string
  expires_at: string
}

interface SessionState {
  session: Session | null
  isAdmin: boolean
  needs2faSetup: boolean
  isLoading: boolean
  error: string | null
  fetchSession: () => Promise<void>
  logout: () => Promise<void>
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  isAdmin: false,
  needs2faSetup: false,
  isLoading: true,
  error: null,

  fetchSession: async () => {
    set({ isLoading: true, error: null })
    try {
      const resp = await fetch('/api/auth/session')
      if (resp.status === 403) {
        const data = await resp.json().catch(() => null)
        // AAL2 required — redirect to TOTP/WebAuthn step-up
        if (data?.needsAal2) {
          const returnTo = encodeURIComponent(window.location.href)
          window.location.href = `/kratos/self-service/login/browser?aal=aal2&return_to=${returnTo}`
          return
        }
        // 2FA not set up — redirect to onboarding wizard
        if (data?.needs2faSetup) {
          set({ session: null, isAdmin: false, needs2faSetup: true, isLoading: false })
          if (window.location.pathname !== '/onboarding' && window.location.pathname !== '/security') {
            window.location.href = '/onboarding'
          }
          return
        }
      }
      if (!resp.ok) {
        set({ session: null, isAdmin: false, needs2faSetup: false, isLoading: false })
        return
      }
      const data = await resp.json()
      if (data.needs2faSetup && window.location.pathname !== '/onboarding' && window.location.pathname !== '/security') {
        window.location.href = '/onboarding'
        return
      }
      set({
        session: data.session,
        isAdmin: data.isAdmin,
        needs2faSetup: data.needs2faSetup ?? false,
        isLoading: false,
      })
    } catch (err) {
      set({
        session: null,
        isAdmin: false,
        needs2faSetup: false,
        isLoading: false,
        error: String(err),
      })
    }
  },

  logout: async () => {
    try {
      // Revoke ALL sessions for this identity (force logout everywhere)
      await fetch('/api/auth/sessions', { method: 'DELETE', credentials: 'include' })

      // Then perform the browser logout flow to clear the current cookie
      const resp = await fetch('/kratos/self-service/logout/browser', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })
      if (resp.ok) {
        const data = await resp.json()
        if (data.logout_url) {
          window.location.href = data.logout_url
          return
        }
      }
    } catch {
      // Fall through
    }
    window.location.href = '/login'
  },
}))
