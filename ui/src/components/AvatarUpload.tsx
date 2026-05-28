import { useRef, useState } from 'react'
import { Button } from '@gouvfr-lasuite/cunningham-react'
import { useUploadAvatar, useDeleteAvatar } from '../api/avatar'

interface AvatarUploadProps {
  identityId: string
  picture?: string
  name?: string
  onUploaded?: () => void
}

export default function AvatarUpload({ identityId, picture, name, onUploaded }: AvatarUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const upload = useUploadAvatar()
  const remove = useDeleteAvatar()

  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const currentSrc = preview ?? uploadedUrl ?? (picture ? `/api/avatar/${identityId}?t=${Date.now()}` : null)
  const initial = (name?.[0] ?? '?').toUpperCase()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result as string)
    reader.readAsDataURL(file)

    try {
      await upload.mutateAsync(file)
      setUploadedUrl(`/api/avatar/${identityId}?t=${Date.now()}`)
      onUploaded?.()
    } catch {
      setPreview(null)
      setUploadedUrl(null)
    }
  }

  const handleDelete = async () => {
    await remove.mutateAsync()
    setPreview(null)
    onUploaded?.()
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div
        onClick={() => fileRef.current?.click()}
        style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          overflow: 'hidden',
          cursor: 'pointer',
          position: 'relative',
          backgroundColor: 'var(--sunbeam--avatar-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {currentSrc ? (
          <img src={currentSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ color: 'var(--sunbeam--avatar-fg)', fontSize: '2rem', fontWeight: 600 }}>{initial}</span>
        )}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0,
          transition: 'opacity 0.2s',
          color: '#fff',
          fontSize: '0.7rem',
          fontWeight: 500,
        }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = '1' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = '0' }}
        >
          Change
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <Button color="neutral" size="small" onClick={() => fileRef.current?.click()}>
          {upload.isPending ? 'Uploading...' : 'Upload photo'}
        </Button>
        {currentSrc && !preview && (
          <Button color="error" size="small" onClick={handleDelete}>
            {remove.isPending ? 'Removing...' : 'Remove'}
          </Button>
        )}
      </div>
    </div>
  )
}
