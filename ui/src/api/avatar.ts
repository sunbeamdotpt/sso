import { useMutation, useQueryClient } from '@tanstack/react-query'

export function avatarUrl(identityId: string): string {
  return `/api/avatar/${identityId}`
}

export function useUploadAvatar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('avatar', file)
      const resp = await fetch('/api/avatar', {
        method: 'PUT',
        body: formData,
      })
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        throw new Error(data.error ?? 'Upload failed')
      }
      return resp.json() as Promise<{ url: string }>
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['session'] })
    },
  })
}

export function useDeleteAvatar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const resp = await fetch('/api/avatar', { method: 'DELETE' })
      if (!resp.ok) throw new Error('Delete failed')
      return resp.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['session'] })
    },
  })
}
