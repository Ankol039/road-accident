/**
 * Staff shell: the sidebar + main content frame.
 * This replaces drawFrame() from js/app.js — the same structure and CSS
 * classes, but as a React layout with <Outlet/> for the routed page.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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
// Change only this constant to 'left' to move the drawer to the other edge.
const DRAWER_SIDE = 'right'

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
  const { pathname } = location
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_MENU).matches)
  const [menuOpen, setMenuOpen] = useState(false)
  const burgerRef = useRef(null)
  const mainRef = useRef(null)
  const drawerRef = useRef(null)
  const closeRef = useRef(null)
  const brandRef = useRef(null)
  const skipRef = useRef(null)
  const openedLocationRef = useRef(null)
  const locationRef = useRef(location)
  locationRef.current = location
  const restoreFocusRef = useRef(true)
  const [drawerPresent, setDrawerPresent] = useState(false)
  const previousPathRef = useRef(pathname)
  const menuVisible = narrow && menuOpen && openedLocationRef.current === location
  const closeMenu = useCallback((reason = 'dismiss') => {
    restoreFocusRef.current = reason === 'dismiss'
    setMenuOpen(false)
  }, [])
  const toggleMenu = () => {
    openedLocationRef.current = location
    restoreFocusRef.current = true
    setMenuOpen((value) => !value)
  }

  useLayoutEffect(() => {
    if (menuVisible) {
      setDrawerPresent(true)
      return undefined
    }
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 250
    const timer = window.setTimeout(() => setDrawerPresent(false), delay)
    return () => window.clearTimeout(timer)
  }, [menuVisible])

  useLayoutEffect(() => {
    if (!menuVisible) return undefined
    const openedLocation = location
    const drawer = drawerRef.current
    const savedStyles = []
    const setStyle = (element, property, value) => {
      savedStyles.push([element, property, element.style.getPropertyValue(property), element.style.getPropertyPriority(property)])
      element.style.setProperty(property, value)
    }
    const root = document.documentElement
    const body = document.body
    const scrollbar = window.innerWidth - root.clientWidth
    if (scrollbar > 0 && CSS.supports('scrollbar-gutter: stable')) {
      setStyle(root, 'scrollbar-gutter', 'stable')
    } else if (scrollbar > 0) {
      setStyle(body, 'padding-right', `${parseFloat(getComputedStyle(body).paddingRight) + scrollbar}px`)
    }
    // Lock the viewport only: making body a scroll container breaks the sticky bar.
    setStyle(root, 'overflow-x', 'hidden')
    setStyle(root, 'overflow-y', 'hidden')

    closeRef.current?.focus({ preventScroll: true })
    const background = [mainRef.current, burgerRef.current, brandRef.current, skipRef.current].filter(Boolean)
    const savedAttributes = background.map((element) => [element, element.getAttribute('inert'), element.getAttribute('aria-hidden')])
    background.forEach((element) => {
      element.setAttribute('inert', '')
      element.setAttribute('aria-hidden', 'true')
    })
    const focusable = () => [...drawer.querySelectorAll('a[href], button:not(:disabled), [tabindex="0"]')]
      .filter((element) => element.getClientRects().length > 0)
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeMenu()
      } else if (event.key === 'Tab') {
        const elements = focusable()
        const first = elements[0]
        const last = elements[elements.length - 1]
        if (event.shiftKey && (document.activeElement === first || !drawer.contains(document.activeElement))) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && (document.activeElement === last || !drawer.contains(document.activeElement))) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    const onFocus = (event) => {
      if (!drawer.contains(event.target)) closeRef.current?.focus({ preventScroll: true })
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('focusin', onFocus)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('focusin', onFocus)
      savedAttributes.forEach(([element, inert, hidden]) => {
        for (const [name, value] of [['inert', inert], ['aria-hidden', hidden]]) {
          if (value === null) element.removeAttribute(name)
          else element.setAttribute(name, value)
        }
      })
      savedStyles.reverse().forEach(([element, property, value, priority]) => {
        if (value) element.style.setProperty(property, value, priority)
        else element.style.removeProperty(property)
      })
      if (restoreFocusRef.current && locationRef.current === openedLocation && window.matchMedia(NARROW_MENU).matches) {
        burgerRef.current?.focus({ preventScroll: true })
      }
    }
  }, [menuVisible, closeMenu])

  useLayoutEffect(() => {
    // Browser history restoration must not override the admin route's scroll reset.
    const previous = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    return () => { window.history.scrollRestoration = previous }
  }, [])

  useLayoutEffect(() => {
    const previousTitle = document.title
    const title = NAV_ITEMS.find((item) => item.to === pathname)?.label
      || (pathname.startsWith('/admin/reports/') ? 'Report details' : 'Dashboard')
    document.title = `${title} — RoadReport`
    // Explicitly bypass the public stylesheet's global smooth scrolling.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    if (previousPathRef.current !== pathname) {
      mainRef.current?.focus({ preventScroll: true })
    }
    previousPathRef.current = pathname
    return () => { document.title = previousTitle }
  }, [pathname])

  useEffect(() => {
    const media = window.matchMedia(NARROW_MENU)
    const update = () => {
      setNarrow(media.matches)
      if (!media.matches) closeMenu('resize')
    }
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [closeMenu])

  useEffect(() => closeMenu('navigation'), [location, closeMenu])

  const onLogout = async () => {
    closeMenu('navigation')
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="staff-shell">
      <a ref={skipRef} className="skip-link" href="#page">
        Skip to content
      </a>
      <aside className={`sidebar${menuVisible ? ' rr-menu-open' : ''}`} aria-label="Administrator menu">
        <button
          ref={burgerRef}
          type="button"
          className="rr-burger"
          aria-label={menuVisible ? 'Close menu' : 'Open menu'}
          aria-expanded={menuVisible}
          aria-controls="admin-menu-drawer"
          onClick={toggleMenu}
        >
          <span className="rr-burger-bars" aria-hidden="true" />
        </button>
        <div ref={brandRef} className="rr-sidebar-brand">
          <Link to="/admin" className="text-decoration-none" onClick={() => closeMenu(pathname === '/admin' ? 'dismiss' : 'navigation')}>
            <Brand light />
          </Link>
          <div className="small rr-sidebar-role mt-2">Administrator</div>
        </div>

        <div className="rr-menu-backdrop" data-visible={menuVisible || drawerPresent} aria-hidden="true" onClick={() => closeMenu()} />
        <div
          ref={drawerRef}
          id="admin-menu-drawer"
          className="rr-menu-drawer"
          data-side={DRAWER_SIDE}
          data-visible={menuVisible || drawerPresent}
          role={narrow ? 'dialog' : undefined}
          aria-modal={menuVisible ? 'true' : undefined}
          aria-label={narrow ? 'Main menu' : undefined}
          aria-hidden={narrow && !menuVisible ? 'true' : undefined}
          inert={narrow && !menuVisible ? '' : undefined}
        >
          <div className="rr-menu-header">
            <span className="rr-menu-title">Menu</span>
            <button ref={closeRef} type="button" className="rr-menu-close" aria-label="Close menu" onClick={() => closeMenu()}>
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </div>
          <div className="rr-nav-label" aria-hidden="true">Main menu</div>
          <nav id="site-nav" className="side-nav" aria-label="Main">
            {NAV_ITEMS.map((item, index) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => (isActive ? 'active' : undefined)}
                onClick={() => closeMenu(item.to === pathname ? 'dismiss' : 'navigation')}
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
        </div>
      </aside>

      <main ref={mainRef} id="page" className="staff-main" tabIndex={-1}>
        <div key={pathname} className="rr-page-enter">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
