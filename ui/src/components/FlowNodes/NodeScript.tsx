import { useEffect, useRef } from 'react'
import type { FlowNode } from '../../api/flows'

interface Props {
  node: FlowNode
}

export default function NodeScript({ node }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const attrs = node.attributes as {
      src?: string
      async?: boolean
      type?: string
      integrity?: string
      crossorigin?: string
      nonce?: string
    }

    if (!attrs.src || !ref.current) return

    const script = document.createElement('script')
    script.src = attrs.src
    if (attrs.async) script.async = true
    if (attrs.type) script.type = attrs.type
    if (attrs.integrity) script.integrity = attrs.integrity
    if (attrs.crossorigin) script.crossOrigin = attrs.crossorigin
    if (attrs.nonce) script.nonce = attrs.nonce

    ref.current.appendChild(script)

    return () => {
      script.remove()
    }
  }, [node])

  return <div ref={ref} />
}
