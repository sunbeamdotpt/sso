import { useEffect, useRef } from 'react'
import { Button } from '@gouvfr-lasuite/cunningham-react'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  confirmColor?: 'brand' | 'error'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  confirmColor = 'brand',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen && !dialog.open) {
      dialog.showModal()
    } else if (!isOpen && dialog.open) {
      dialog.close()
    }
  }, [isOpen])

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      style={{
        border: '1px solid var(--sunbeam--border)',
        borderRadius: 12,
        padding: '1.5rem',
        maxWidth: 420,
        width: '100%',
      }}
    >
      <h3 style={{ margin: '0 0 0.75rem' }}>{title}</h3>
      <p style={{ margin: '0 0 1.5rem', color: 'var(--sunbeam--text-secondary)' }}>{message}</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
        <Button color="neutral" onClick={onCancel}>
          Cancel
        </Button>
        <Button color={confirmColor} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  )
}
