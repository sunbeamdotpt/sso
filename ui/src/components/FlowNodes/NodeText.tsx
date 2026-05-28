import type { FlowNode } from '../../api/flows'

interface Props {
  node: FlowNode
}

export default function NodeText({ node }: Props) {
  const attrs = node.attributes as { text?: { text: string; id: number } }
  const text = attrs.text?.text ?? ''
  const label = node.meta?.label?.text

  return (
    <div style={{
      padding: '1rem',
      backgroundColor: 'var(--sunbeam--bg-muted)',
      border: '1px solid var(--sunbeam--border)',
      borderRadius: 8,
      fontFamily: 'monospace',
      fontSize: '0.875rem',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
    }}>
      {label && <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontFamily: 'inherit' }}>{label}</div>}
      {text}
    </div>
  )
}
