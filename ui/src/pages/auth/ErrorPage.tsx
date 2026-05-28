import { useSearchParams } from 'react-router-dom'
import { useFlowError } from '../../api/flows'

export default function ErrorPage() {
  const [params] = useSearchParams()
  const errorId = params.get('id')

  if (!errorId) {
    return (
      <div>
        <h2 style={{ marginTop: 0 }}>Error</h2>
        <p>An unknown error occurred.</p>
        <a href="/login">Back to sign in</a>
      </div>
    )
  }

  return <ErrorDetail errorId={errorId} />
}

function ErrorDetail({ errorId }: { errorId: string }) {
  const { data, isLoading, error: fetchError } = useFlowError(errorId)

  if (isLoading) return <div>Loading...</div>
  if (fetchError) return <div style={{ color: 'var(--c--theme--colors--danger-500)' }}>Failed to load error details.</div>

  const errorData = data?.error ?? data
  const message = errorData?.message ?? errorData?.reason ?? 'An error occurred'
  const status = errorData?.code ?? errorData?.status

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Error{status ? ` ${status}` : ''}</h2>
      <p>{message}</p>
      {errorData?.debug && (
        <pre>{errorData.debug}</pre>
      )}
      <a href="/login">Back to sign in</a>
    </div>
  )
}
