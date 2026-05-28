import { useSearchParams } from 'react-router-dom'
import { useFlow } from '../../api/flows'
import FlowForm from '../../components/FlowNodes/FlowForm'

export default function LoginPage() {
  const [params] = useSearchParams()
  const flowId = params.get('flow')
  const loginChallenge = params.get('login_challenge')

  // If no flow ID, redirect to Kratos to create one
  if (!flowId) {
    const returnTo = params.get('return_to') ?? '/'
    // Save return_to for the onboarding wizard to redirect back after setup
    if (returnTo && returnTo !== '/') {
      sessionStorage.setItem('onboarding_return_to', returnTo)
    }
    let url = `/kratos/self-service/login/browser?return_to=${encodeURIComponent(returnTo)}`
    if (loginChallenge) url += `&login_challenge=${loginChallenge}`
    window.location.href = url
    return <div>Redirecting...</div>
  }

  return <LoginFlow flowId={flowId} />
}

function LoginFlow({ flowId }: { flowId: string }) {
  const { data: flow, isLoading, error } = useFlow('login', flowId)

  if (isLoading) return <div>Loading...</div>
  if (error) return <div style={{ color: 'var(--c--theme--colors--danger-500)' }}>Error loading login flow: {String(error)}</div>
  if (!flow) return null

  // Detect dead-end: flow has messages but no actionable input nodes.
  // This happens when Kratos wants aal2 but the user has no 2FA method set up.
  const actionableNodes = flow.ui.nodes.filter(
    n => n.type === 'input' &&
    (n.attributes as Record<string, unknown>).type !== 'hidden' &&
    n.group !== 'default'
  )

  if (actionableNodes.length === 0 && flow.ui.messages?.length) {
    return (
      <div>
        <h2 style={{ marginTop: 0, marginBottom: '1.5rem', textAlign: 'center' }}>
          Additional setup required
        </h2>
        <FlowForm ui={flow.ui} />
        <p style={{
          color: 'var(--sunbeam--text-secondary)',
          fontSize: '0.875rem',
          textAlign: 'center',
          margin: '1rem 0',
        }}>
          You need to set up two-factor authentication before you can sign in to services.
        </p>
        <div style={{ textAlign: 'center' }}>
          <a href="/onboarding" style={{ fontWeight: 500 }}>Complete account setup</a>
        </div>
      </div>
    )
  }

  // Inject remember=true so Kratos tells Hydra to persist the login session.
  // Without this, every OAuth2 flow triggers a fresh login.
  const uiWithRemember = {
    ...flow.ui,
    nodes: [
      ...flow.ui.nodes,
      {
        type: 'input' as const,
        group: 'default',
        attributes: { name: 'remember', type: 'hidden', value: 'true', disabled: false, node_type: 'input' },
        messages: [],
        meta: {},
      },
    ],
  }

  return (
    <div>
      <h2 style={{ marginTop: 0, marginBottom: '1.5rem', textAlign: 'center' }}>Sign in</h2>
      <FlowForm ui={uiWithRemember} />
      <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.875rem' }}>
        <a href="/recovery">Forgot password?</a>
      </div>
    </div>
  )
}
