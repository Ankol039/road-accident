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

/** Decorative icons from the finished shared-shell design, in navigation order. */
const NAV_ICONS = [
  <><rect x="3.5" y="3.5" width="7" height="7" rx="1.6" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.6" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.6" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.6" /></>,
  <><path d="M6 3h8.5L19 7.5V21H6z" /><path d="M14 3v5h5" /><path d="M9.5 13h6M9.5 17h4" /></>,
  <><path d="M4 20V11M10 20V4M16 20v-7" /><path d="M2.5 20.5h19" /><path d="M19 4v6m0 0-2.2-2.2M19 10l2.2-2.2" /></>,
  <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M18.5 14.8c1.8.8 3 2.4 3.3 5.2" /></>,
  <><path d="M3.5 7h10M18 7h2.5M3.5 17H6m4.5 0h10" /><circle cx="15.7" cy="7" r="2.2" /><circle cx="8.2" cy="17" r="2.2" /></>,
  <><circle cx="12" cy="12" r="9" /><path d="M12 7v5.2l3.2 1.9" /></>,
  <><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l2 2H4z" /><path d="M10 21.2h4" /></>,
  <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="10" r="3" /><path d="M6.4 18.2c1.2-2.2 3-3.2 5.6-3.2s4.4 1 5.6 3.2" /></>,
]

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
        <div className="rr-sidebar-brand">
          <Link to="/admin" className="text-decoration-none" onClick={closeMenu}>
            <Brand light />
          </Link>
          <div className="small rr-sidebar-role mt-2">Administrator</div>
        </div>

        <div className="rr-nav-label" aria-hidden="true">Main menu</div>
        <nav id="site-nav" className="side-nav" aria-label="Main">
          {NAV_ITEMS.map((item, index) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
              onClick={closeMenu}
            >
              <svg className="rr-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">{NAV_ICONS[index]}</svg>
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
