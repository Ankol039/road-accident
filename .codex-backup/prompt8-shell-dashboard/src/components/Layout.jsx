/**
 * Staff shell: the sidebar + main content frame.
 * This replaces drawFrame() from js/app.js — the same structure and CSS
 * classes, but as a React layout with <Outlet/> for the routed page.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
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

const NARROW_MENU = '(max-width: 991.98px)'

export default function Layout() {
  const { profile, signOut } = useAuth()
  const { count } = useUnread()
  const navigate = useNavigate()
  const location = useLocation()
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_MENU).matches)
  const [menuOpen, setMenuOpen] = useState(false)
  const burgerRef = useRef(null)
  const menuVisible = narrow && menuOpen
  const closeMenu = useCallback(() => setMenuOpen(false), [])

  useEffect(() => {
    const media = window.matchMedia(NARROW_MENU)
    const update = () => {
      setNarrow(media.matches)
      if (!media.matches) closeMenu()
    }
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [closeMenu])

  useEffect(() => closeMenu(), [location, closeMenu])

  useEffect(() => {
    if (!menuVisible) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeMenu()
        burgerRef.current?.focus({ preventScroll: true })
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menuVisible, closeMenu])

  const onLogout = async () => {
    closeMenu()
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="staff-shell">
      <a className="skip-link" href="#page">
        Skip to content
      </a>
      <aside className={`sidebar${menuVisible ? ' rr-menu-open' : ''}`} aria-label="Administrator menu">
        <button
          ref={burgerRef}
          type="button"
          className="rr-burger"
          aria-label={menuVisible ? 'Close menu' : 'Open menu'}
          aria-expanded={menuVisible}
          aria-controls="site-nav"
          onClick={() => setMenuOpen((value) => !value)}
        >
          <span className="rr-burger-bars" aria-hidden="true" />
        </button>
        <div className="px-3 pt-3 pb-4">
          <Link to="/admin" className="text-decoration-none" onClick={closeMenu}>
            <Brand light />
          </Link>
          <div className="small text-white-50 mt-2">Administrator</div>
        </div>

        <div className="rr-nav-label" aria-hidden="true">Main menu</div>
        <nav id="site-nav" className="side-nav" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
              onClick={closeMenu}
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
