import { useSearchParams } from 'react-router-dom'
import { useFlow } from '../../api/flows'
import FlowForm from '../../components/FlowNodes/FlowForm'

export default function RecoveryPage() {
  const [params] = useSearchParams()
  const flowId = params.get('flow')

  if (!flowId) {
    window.location.href = '/kratos/self-service/recovery/browser'
    return <div>Redirecting...</div>
  }

  return <RecoveryFlow flowId={flowId} />
}

function RecoveryFlow({ flowId }: { flowId: string }) {
  const { data: flow, isLoading, error } = useFlow('recovery', flowId)

  if (isLoading) return <div>Loading...</div>
  if (error) return <div style={{ color: 'var(--c--theme--colors--danger-500)' }}>Error loading recovery flow: {String(error)}</div>
  if (!flow) return null

  return (
    <div>
      <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Account recovery</h2>
      <FlowForm ui={flow.ui} />
      <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.875rem' }}>
        <a href="/login">Back to sign in</a>
      </div>
    </div>
  )
}
