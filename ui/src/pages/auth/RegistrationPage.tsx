import { useSearchParams } from 'react-router-dom'
import { useFlow } from '../../api/flows'
import FlowForm from '../../components/FlowNodes/FlowForm'

export default function RegistrationPage() {
  const [params] = useSearchParams()
  const flowId = params.get('flow')

  if (!flowId) {
    const returnTo = params.get('return_to') ?? '/'
    window.location.href = `/kratos/self-service/registration/browser?return_to=${encodeURIComponent(returnTo)}`
    return <div>Redirecting...</div>
  }

  return <RegistrationFlow flowId={flowId} />
}

function RegistrationFlow({ flowId }: { flowId: string }) {
  const { data: flow, isLoading, error } = useFlow('registration', flowId)

  if (isLoading) return <div>Loading...</div>
  if (error) return <div style={{ color: 'var(--c--theme--colors--danger-500)' }}>Error loading registration flow: {String(error)}</div>
  if (!flow) return null

  return (
    <div>
      <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Create account</h2>
      <FlowForm ui={flow.ui} />
      <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.875rem' }}>
        <a href="/login">Already have an account? Sign in</a>
      </div>
    </div>
  )
}
