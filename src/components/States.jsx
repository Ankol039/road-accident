/**
 * Shared loading / error / empty states, so every page looks the same.
 */
export default function States({ loading, error, empty, emptyText = 'Nothing to show yet.', children }) {
  if (loading) return <div className="page-loading rr-state" role="status">Loading…</div>
  if (error) {
    return (
      <div className="alert alert-danger rr-state rr-state-error" role="alert">
        {typeof error === 'string' ? error : error.message || 'Something went wrong.'}
      </div>
    )
  }
  if (empty) return <p className="text-secondary rr-state rr-state-empty">{emptyText}</p>
  return children
}
