/**
 * Route guards.
 *
 * RequireAuth replaces savedStaffUser() from js/app.js: it waits for the
 * Firebase session to resolve, then either renders the page or sends the
 * visitor to the login screen, remembering where they were going.
 */
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div className="page-loading">Checking your session…</div>
  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  }
  return children
}

/** Login/landing redirect away when already signed in. */
export function RedirectIfAuthed({ children, to = '/admin' }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="page-loading">Loading…</div>
  if (user) return <Navigate to={to} replace />
  return children
}
