/**
 * Staff shell: the sidebar + main content frame.
 * This replaces drawFrame() from js/app.js — the same structure and CSS
 * classes, but as a React layout with <Outlet/> for the routed page.
 */
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import Brand from './Brand.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { useUnread } from '../hooks/useUnread.js'

/** Ordered nav, same list and wording as ADMIN_LINKS in js/app.js. */
export const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/reports', label: 'Accident reports' },
  { to: '/admin/summaries', label: 'Summaries and export' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/settings', label: 'Categories and settings' },
  { to: '/admin/audit', label: 'Audit trail' },
  { to: '/admin/notifications', label: 'Notifications', badge: true },
  { to: '/admin/account', label: 'My account' },
]

export default function Layout() {
  const { profile, signOut } = useAuth()
  const { count } = useUnread()
  const navigate = useNavigate()

  const onLogout = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="staff-shell">
      <a className="skip-link" href="#page">
        Skip to content
      </a>
      <aside className="sidebar">
        <div className="px-3 pt-3 pb-4">
          <Link to="/admin" className="text-decoration-none">
            <Brand light />
          </Link>
          <div className="small text-white-50 mt-2">Administrator</div>
        </div>

        <nav className="side-nav" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              {item.label}
              {item.badge && count > 0 && <span className="count-pill">{count >= 99 ? '99+' : count}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="small text-white mb-2 text-truncate" data-user-name>
            {profile?.full_name || profile?.email || 'Administrator'}
          </div>
          <button type="button" className="btn btn-sm btn-outline-light w-100" onClick={onLogout}>
            Log out
          </button>
        </div>
      </aside>

      <main id="page" className="staff-main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  )
}
