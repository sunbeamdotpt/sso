import { useSessionStore } from '../stores/session'

export function useSession() {
  const { session, isAdmin, isLoading, error } = useSessionStore()
  return { session, isAdmin, isLoading, error }
}
