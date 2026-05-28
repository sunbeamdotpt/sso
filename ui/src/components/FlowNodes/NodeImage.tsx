import type { FlowNode } from '../../api/flows'

interface Props {
  node: FlowNode
}

export default function NodeImage({ node }: Props) {
  const attrs = node.attributes as { src: string; width?: number; height?: number }
  const label = node.meta?.label?.text

  return (
    <div style={{ textAlign: 'center' }}>
      {label && <div style={{ marginBottom: '0.5rem', fontWeight: 500 }}>{label}</div>}
      <img
        src={attrs.src}
        width={attrs.width ?? 200}
        height={attrs.height ?? 200}
        alt={label ?? 'QR Code'}
        style={{ maxWidth: '100%' }}
      />
    </div>
  )
}
