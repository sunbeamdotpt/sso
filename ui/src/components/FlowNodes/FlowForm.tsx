import type { FlowUI, FlowNode } from '../../api/flows'
import NodeInput from './NodeInput'
import NodeText from './NodeText'
import NodeImage from './NodeImage'
import NodeScript from './NodeScript'
import NodeAnchor from './NodeAnchor'

interface FlowFormProps {
  ui: FlowUI
  only?: string // render only this group
  exclude?: string[] // exclude these groups
  onSubmit?: (action: string, data: FormData) => void // intercept submission with fetch()
}

function renderNode(node: FlowNode, index: number) {
  switch (node.type) {
    case 'input':
      return <NodeInput key={index} node={node} />
    case 'text':
      return <NodeText key={index} node={node} />
    case 'img':
      return <NodeImage key={index} node={node} />
    case 'script':
      return <NodeScript key={index} node={node} />
    case 'a':
      return <NodeAnchor key={index} node={node} />
    default:
      return null
  }
}

const GROUP_ORDER = [
  'default',
  'password',
  'oidc',
  'code',
  'webauthn',
  'totp',
  'lookup_secret',
]

export default function FlowForm({ ui, only, exclude, onSubmit }: FlowFormProps) {
  const groups = new Map<string, FlowNode[]>()
  for (const node of ui.nodes) {
    const group = node.group
    if (exclude?.includes(group)) continue
    if (only && group !== only && group !== 'default') continue
    if (!groups.has(group)) groups.set(group, [])
    groups.get(group)!.push(node)
  }

  const sortedGroups = [...groups.entries()].sort(
    ([a], [b]) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b),
  )

  const handleSubmit = onSubmit
    ? (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        onSubmit(ui.action, formData)
      }
    : undefined

  return (
    <form action={ui.action} method={ui.method} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {ui.messages?.map((msg) => {
        const isError = msg.type === 'error'
        const isSuccess = msg.type === 'success'
        return (
          <div key={msg.id} style={{
            padding: '0.75rem 1rem',
            borderRadius: 8,
            backgroundColor: isError
              ? 'var(--c--theme--colors--danger-50)'
              : isSuccess
              ? 'var(--c--theme--colors--success-50)'
              : 'var(--c--theme--colors--info-50)',
            border: `1px solid ${isError
              ? 'var(--c--theme--colors--danger-200)'
              : isSuccess
              ? 'var(--c--theme--colors--success-200)'
              : 'var(--c--theme--colors--info-200)'}`,
            color: isError
              ? 'var(--c--theme--colors--danger-800)'
              : isSuccess
              ? 'var(--c--theme--colors--success-800)'
              : 'var(--c--theme--colors--info-800)',
            fontSize: '0.875rem',
            lineHeight: 1.5,
          }}>
            {msg.text}
          </div>
        )
      })}

      {sortedGroups.map(([group, nodes]) => (
        <div key={group} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {nodes.map((node, i) => renderNode(node, i))}
        </div>
      ))}
    </form>
  )
}
