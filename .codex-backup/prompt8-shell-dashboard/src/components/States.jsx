/**
 * Shared loading / error / empty states, so every page looks the same.
 */
export default function States({ loading, error, empty, emptyText = 'Nothing to show yet.', children }) {
  if (loading) return <div className="page-loading">Loading…</div>
  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        {typeof error === 'string' ? error : error.message || 'Something went wrong.'}
      </div>
    )
  }
  if (empty) return <p className="text-secondary">{emptyText}</p>
  return children
}
