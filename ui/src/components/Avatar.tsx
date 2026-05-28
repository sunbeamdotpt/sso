interface AvatarProps {
  identityId?: string
  name?: string
  picture?: string
  size?: 'xsmall' | 'small' | 'medium' | 'large'
}

const sizes = {
  xsmall: 24,
  small: 32,
  medium: 48,
  large: 80,
}

export default function Avatar({ identityId, name, picture, size = 'medium' }: AvatarProps) {
  const px = sizes[size]
  const initial = (name?.[0] ?? '?').toUpperCase()

  if (picture && identityId) {
    return (
      <img
        src={`/api/avatar/${identityId}`}
        alt={name ?? ''}
        style={{
          width: px,
          height: px,
          borderRadius: '50%',
          objectFit: 'cover',
        }}
      />
    )
  }

  return (
    <div style={{
      width: px,
      height: px,
      borderRadius: '50%',
      backgroundColor: 'var(--sunbeam--avatar-bg)',
      color: 'var(--sunbeam--avatar-fg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: px * 0.4,
      fontWeight: 600,
    }}>
      {initial}
    </div>
  )
}
