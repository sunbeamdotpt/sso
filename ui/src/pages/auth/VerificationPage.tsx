import { useSearchParams } from 'react-router-dom'
import { useFlow } from '../../api/flows'
import FlowForm from '../../components/FlowNodes/FlowForm'

export default function VerificationPage() {
  const [params] = useSearchParams()
  const flowId = params.get('flow')

  if (!flowId) {
    window.location.href = '/kratos/self-service/verification/browser'
    return <div>Redirecting...</div>
  }

  return <VerificationFlow flowId={flowId} />
}

function VerificationFlow({ flowId }: { flowId: string }) {
  const { data: flow, isLoading, error } = useFlow('verification', flowId)

  if (isLoading) return <div>Loading...</div>
  if (error) return <div style={{ color: 'var(--c--theme--colors--danger-500)' }}>Error loading verification flow: {String(error)}</div>
  if (!flow) return null

  return (
    <div>
      <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Email verification</h2>
      <FlowForm ui={flow.ui} />
      <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.875rem' }}>
        <a href="/login">Back to sign in</a>
      </div>
    </div>
  )
}
