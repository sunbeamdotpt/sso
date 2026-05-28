import { useEffect, useRef, useCallback } from 'react'

const INTEGRATION_ORIGIN = window.location.origin.replace(/^https?:\/\/auth\./, 'https://integration.')

/**
 * Waffle menu button that loads the La Gaufre v2 widget from the integration service.
 * The widget is a Shadow DOM popup that shows links to all studio services.
 */
export default function WaffleButton() {
  const btnRef = useRef<HTMLButtonElement>(null)
  const initialized = useRef(false)

  const toggle = useCallback(() => {
    window._lasuite_widget = window._lasuite_widget || []
    window._lasuite_widget.push(['lagaufre', 'toggle'])
  }, [])

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    // Load the lagaufre v2 widget script
    const script = document.createElement('script')
    script.src = `${INTEGRATION_ORIGIN}/api/v2/lagaufre.js`
    script.onload = () => {
      window._lasuite_widget = window._lasuite_widget || []
      window._lasuite_widget.push(['lagaufre', 'init', {
        api: `${INTEGRATION_ORIGIN}/api/v2/services.json`,
        buttonElement: btnRef.current!,
        label: 'Sunbeam Studios',
        closeLabel: 'Close',
        newWindowLabelSuffix: ' · new window',
      }])
    }
    document.head.appendChild(script)

    return () => {
      window._lasuite_widget = window._lasuite_widget || []
      window._lasuite_widget.push(['lagaufre', 'destroy'])
    }
  }, [])

  return (
    <button
      ref={btnRef}
      onClick={toggle}
      aria-label="Apps"
      aria-expanded="false"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 36,
        borderRadius: 8,
        border: '1px solid var(--sunbeam--border)',
        backgroundColor: 'transparent',
        cursor: 'pointer',
        padding: 0,
        color: 'var(--sunbeam--text-secondary)',
        transition: 'background-color 0.15s, border-color 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--c--theme--colors--greyscale-100)'
        e.currentTarget.style.borderColor = 'var(--c--theme--colors--greyscale-300)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent'
        e.currentTarget.style.borderColor = 'var(--sunbeam--border)'
      }}
    >
      {/* 3x3 grid icon (waffle) */}
      <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
        <circle cx="3" cy="3" r="1.5" />
        <circle cx="9" cy="3" r="1.5" />
        <circle cx="15" cy="3" r="1.5" />
        <circle cx="3" cy="9" r="1.5" />
        <circle cx="9" cy="9" r="1.5" />
        <circle cx="15" cy="9" r="1.5" />
        <circle cx="3" cy="15" r="1.5" />
        <circle cx="9" cy="15" r="1.5" />
        <circle cx="15" cy="15" r="1.5" />
      </svg>
    </button>
  )
}

// Global type augmentation for the widget API
declare global {
  interface Window {
    _lasuite_widget: unknown[]
  }
}
