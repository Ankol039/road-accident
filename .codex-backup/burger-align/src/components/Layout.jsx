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
  const sidebarRef = useRef(null)
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
    const sidebar = sidebarRef.current
    const previousOverflow = document.body.style.getPropertyValue('overflow')
    const previousPriority = document.body.style.getPropertyPriority('overflow')
    document.body.style.setProperty('overflow', 'hidden')
    const firstLink = sidebar.querySelector('.side-nav a')
    firstLink?.focus({ preventScroll: true })

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeMenu()
      } else if (event.key === 'Tab') {
        const controls = [
          ...sidebar.querySelectorAll('a[href], button:not([disabled]), [tabindex="0"]'),
          burgerRef.current,
        ].filter((el) => el && el.getClientRects().length)
        const index = controls.indexOf(document.activeElement)
        const next = (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length
        event.preventDefault()
        controls[next]?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (previousOverflow) document.body.style.setProperty('overflow', previousOverflow, previousPriority)
      else document.body.style.removeProperty('overflow')
      if (burgerRef.current?.isConnected && window.matchMedia(NARROW_MENU).matches) {
        burgerRef.current.focus({ preventScroll: true })
      }
    }
  }, [menuVisible, closeMenu])

  const onLogout = async () => {
    closeMenu()
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className={`staff-shell${menuVisible ? ' is-menu-open' : ''}`}>
      <a className="skip-link" href="#page" inert={menuVisible ? '' : undefined}>
        Skip to content
      </a>
      <header className="staff-topbar">
        <Link to="/admin" className="staff-topbar-brand text-decoration-none" inert={menuVisible ? '' : undefined}>
          <Brand light />
        </Link>
        <button
          ref={burgerRef}
          type="button"
          className="staff-menu-toggle"
          aria-label={menuVisible ? 'Close menu' : 'Open menu'}
          aria-expanded={menuVisible}
          aria-controls="staff-sidebar-nav"
          onClick={() => setMenuOpen((value) => !value)}
        >
          <span className="staff-menu-icon" aria-hidden="true"><span /><span /><span /></span>
          {count > 0 && <span className="staff-menu-dot" aria-hidden="true" />}
        </button>
      </header>
      <div className="staff-drawer-backdrop" aria-hidden="true" onClick={closeMenu} />
      <aside ref={sidebarRef} className="sidebar" inert={narrow && !menuVisible ? '' : undefined} aria-label="Administrator menu">
        <div className="px-3 pt-3 pb-4">
          <Link to="/admin" className="text-decoration-none" onClick={closeMenu}>
            <Brand light />
          </Link>
          <div className="small text-white-50 mt-2">Administrator</div>
        </div>

        <nav id="staff-sidebar-nav" className="side-nav" aria-label="Main">
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

      <main id="page" className="staff-main" tabIndex={-1} inert={menuVisible ? '' : undefined}>
        <Outlet />
      </main>
    </div>
  )
}
