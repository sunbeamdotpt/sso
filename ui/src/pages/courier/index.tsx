import { useState } from 'react'
import { Button } from '@gouvfr-lasuite/cunningham-react'
import { useCourierMessages, useCourierMessage } from '../../api/courier'

const STATUS_COLORS: Record<string, string> = {
  queued: 'var(--c--theme--colors--info-600)',
  sent: 'var(--c--theme--colors--success-600)',
  processing: 'var(--c--theme--colors--warning-600)',
  abandoned: 'var(--c--theme--colors--danger-600)',
}

export default function CourierPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data: messages, isLoading, error } = useCourierMessages({
    page_size: 50,
    status: statusFilter || undefined,
  })
  const { data: detail } = useCourierMessage(selectedId ?? '')

  if (isLoading) return <div>Loading courier messages...</div>
  if (error) return <div style={{ color: 'var(--c--theme--colors--danger-500)' }}>Error: {String(error)}</div>

  return (
    <div>
      <h1>Courier Messages</h1>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {['', 'queued', 'sent', 'processing', 'abandoned'].map((s) => (
          <Button
            key={s}
            size="small"
            color={statusFilter === s ? 'brand' : 'neutral'}
            onClick={() => setStatusFilter(s)}
          >
            {s || 'All'}
          </Button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <table>
            <thead>
              <tr>
                <th>Recipient</th>
                <th>Subject</th>
                <th>Type</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {(messages ?? []).map((msg) => (
                <tr
                  key={msg.id}
                  style={{
                    cursor: 'pointer',
                    backgroundColor: selectedId === msg.id ? 'var(--c--theme--colors--primary-50)' : undefined,
                  }}
                  onClick={() => setSelectedId(msg.id)}
                >
                  <td>{msg.recipient}</td>
                  <td>{msg.subject}</td>
                  <td>{msg.type}</td>
                  <td>
                    <span style={{ color: STATUS_COLORS[msg.status] ?? 'var(--sunbeam--text-secondary)' }}>
                      {msg.status}
                    </span>
                  </td>
                  <td>{new Date(msg.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {(messages ?? []).length === 0 && (
            <p style={{ color: 'var(--sunbeam--text-secondary)', textAlign: 'center', marginTop: '2rem' }}>No messages found.</p>
          )}
        </div>

        {selectedId && detail && (
          <div style={{
            width: 400,
            border: '1px solid var(--sunbeam--border)',
            borderRadius: 8,
            padding: '1rem',
          }}>
            <h3 style={{ marginTop: 0 }}>Message Detail</h3>
            <table>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 600 }}>ID</td>
                  <td><code>{detail.id}</code></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Recipient</td>
                  <td>{detail.recipient}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Subject</td>
                  <td>{detail.subject}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Type</td>
                  <td>{detail.type}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Status</td>
                  <td>
                    <span style={{ color: STATUS_COLORS[detail.status] ?? 'var(--sunbeam--text-secondary)' }}>
                      {detail.status}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Created</td>
                  <td>{new Date(detail.created_at).toLocaleString()}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Updated</td>
                  <td>{new Date(detail.updated_at).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
            {detail.body && (
              <>
                <h4>Body</h4>
                <pre style={{ maxHeight: 300 }}>{detail.body}</pre>
              </>
            )}
            <div style={{ marginTop: '0.5rem' }}>
              <Button color="neutral" size="small" onClick={() => setSelectedId(null)}>Close</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
