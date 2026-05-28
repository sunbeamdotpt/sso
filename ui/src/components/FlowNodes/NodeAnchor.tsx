import { Button } from '@gouvfr-lasuite/cunningham-react'
import type { FlowNode } from '../../api/flows'

interface Props {
  node: FlowNode
}

export default function NodeAnchor({ node }: Props) {
  const attrs = node.attributes as { href: string; title?: string; id?: string }
  const label = node.meta?.label?.text ?? attrs.title ?? 'Link'

  return (
    <a href={attrs.href} style={{ textDecoration: 'none' }}>
      <Button color="neutral" fullWidth>
        {label}
      </Button>
    </a>
  )
}
